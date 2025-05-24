/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ArkField, ArkMethod, Scene, ArkClass, LiteralType, FunctionType, Type, ArrayType,
   ArkInstanceInvokeExpr, TupleType, ClassType, GenericType, LineColPosition} from 'arkanalyzer/lib';
import { MethodParameter } from 'arkanalyzer/lib/core/model/builder/ArkMethodBuilder';
import {
  ClassSignature,
  MethodSignature,
} from 'arkanalyzer/lib/core/model/ArkSignature';
import { ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import {
  ClassMatcher,
  MatcherCallback,
  MatcherTypes,
  MethodMatcher,
} from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { CheckerUtils } from '../../Index';

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'PreferReadonlyParametertypesCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/prefer-readonly-parameter-types.md', // TODO: support url
  description: 'Parameter should be a read only type.',
};
const readonlyReg = /^readonly \[/;
const readReg = /\]$/;
const stringliteralReg = /^(['"])(.*)\1$/;
const numberliteralReg = /^-?\d+(\.\d+)?$/;
const stringPureReg = /^[a-zA-Z0-9 _,!?'"()@]*$/;
const VariableReferenceReg = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const replaceStringReg = /[.*+?^=!:${}()|\[\]\/\\]/g;
const funcallTowReg = /^\s*[a-zA-Z_$][\w$]*\s*\(.*\)\s*$/;
const funcallOneReg = /^[a-zA-Z0-9_]+\($/;
const cleanedModifierReg = /^\s*(public|private|protected)\s+/;
type AllowElement =
  | string
  | { from: 'file'; name: [string, ...string[]] | string; path?: string }
  | { from: 'lib'; name: [string, ...string[]] | string }
  | { from: 'package'; name: [string, ...string[]] | string; package: string };

interface ClassifiedItem {
  from: string;
  path?: string;
  names: string[];
}
type Options = {
  /** An array of type specifiers to ignore. */
  allow?: AllowElement[];
  /** Whether to check class parameter properties. */
  checkParameterProperties?: boolean;
  /** Whether to ignore parameters which don't explicitly specify a type. */
  ignoreInferredTypes?: boolean;
  /** Whether to treat all mutable methods as though they are readonly. */
  treatMethodsAsReadonly?: boolean;
};
const defaultOptions: Options = {
  allow: [],
  checkParameterProperties: true, //是否对构造方法进行检查默认检查
  ignoreInferredTypes: false, //忽略隐式
  treatMethodsAsReadonly: false,
};
//接收参数信息
interface methodArgType {
  name?: string;
  baseType?: { name?: string };
  dimension?: number;
  genericTypes?: { classSignature?: ClassSignature; name?: string }[];
  types?: {
    classSignature?: ClassSignature;
    name?: string;
    genericTypes?: { name?: string }[];
  }[];
  classSignature?: ClassSignature;
  methodSignature?: MethodSignature;
  originalType?: { classSignature?: ClassSignature };
}
export class PreferReadonlyParametertypesCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private clsMatcher: ClassMatcher = {
    matcherType: MatcherTypes.CLASS,
  };

  private buildMatcher: MethodMatcher = {
    matcherType: MatcherTypes.METHOD,
    class: [this.clsMatcher],
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildTs: MatcherCallback = {
      matcher: this.buildMatcher,
      callback: this.check,
    };
    return [matchBuildTs];
  }

  //此规则允许您强制函数参数解析为 readonly 类型
  public check = (targetMethod: ArkMethod) => {
    //获取Scene
    let declareClass = targetMethod.getDeclaringArkClass();
    const arkfile = declareClass.getDeclaringArkFile();
    const scene = arkfile.getScene();
    const severity = this.rule.alert ?? this.metaData.severity;
    const options: Options = this.rule.option[0] as unknown as Options;
    const mergedOptions: Options = {
      ...defaultOptions,
      ...options,
    };
    const allow = mergedOptions.allow;
    const methodPath = arkfile.getFilePath();
    let allowClass: ClassifiedItem[] = []; //存放白名单
    if (allow) {
      allowClass = this.classifyAllow(allow, methodPath);
    }

    //1.获取参数列表2.判断是否是只读
    const methodCode = targetMethod.getCode() ?? '';
    const methodName = targetMethod.getName() ?? '';
    const paramsDef = this.extractParameters(methodCode);
    let lineCode =
      targetMethod.getLine() ??
      (targetMethod.getDeclareLines()
        ? targetMethod.getDeclareLines()![0] ?? 0
        : 0); //接口内或者type或者function 无行号
    let lineColCode = targetMethod.getColumn() ?? (targetMethod.getDeclareColumns() ? targetMethod.getDeclareColumns()![0] ?? 0 : 0);
    if (
      (!mergedOptions.checkParameterProperties && this.checkConstructor(methodName))) {
      return;
    }

    if (targetMethod.getParameters()) {
      this.processParam(
        targetMethod,
        paramsDef,
        mergedOptions,
        scene,
        allowClass,
        methodPath,
        severity,
        lineCode,
        lineColCode,
        methodCode
      );
    }
    this.execFunctionCallParamType(targetMethod, methodPath, severity, scene);
  };

  //抽取函数参数语句
  private extractParameters(methodCode: string): string[] {
    const start = methodCode.indexOf('(');
    if (start === -1) {
      return [];
    }
  
    let depth = 0;
    let end = -1;
  
    // 找到配对的第一个括号
    for (let i = start; i < methodCode.length; i++) {
      const char = methodCode[i];
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
  
    if (end === -1) {
      return [];
    }
  
    const paramStr = methodCode.slice(start + 1, end);
    const paramList: string[] = [];
  
    let current = '';
    let nested = 0;
    let inString: string | null = null;
    let inArrowFn = false;
  
    for (let i = 0; i < paramStr.length; i++) {
      const char = paramStr[i];
      const prev = paramStr[i - 1];
      const next = paramStr[i + 1];
  
      // 字符串处理：支持 '', "", ``
      if (!inString && (char === '\'' || char === '"' || char === '`')) {
        inString = char;
      } else if (inString && char === inString && prev !== '\\') {
        inString = null;
      }
  
      if (inString) {
        current += char;
        continue;
      }
  
      // 判断箭头函数 =>
      if (char === '=' && next === '>') {
        inArrowFn = true;
        current += '=>';
        i++; // 跳过 >
        continue;
      }
  
      // 处理嵌套结构
      if (['{', '[', '(', '<'].includes(char)) {
        nested++;
      }
      else if (['}', ']', ')', '>'].includes(char)) {
        nested--;
      }
  
      // 只有在顶层并且不在箭头函数中才处理逗号分割
      if (char === ',' && nested === 0 && !inArrowFn) {
        paramList.push(current.trim());
        current = '';
      } else {
        current += char;
      }
  
      // 重置箭头函数标识
      if (inArrowFn && (char === '}' || char === ')')) {
        inArrowFn = false;
      }
    }
  
    if (current.trim()) {
      paramList.push(current.trim());
    }
  
    return paramList;
  }

  //判断参数是否是只读
  private isReadonlyType(
    argType: methodArgType,
    paramDef: string,
    scene: Scene,
    allowClass: ClassifiedItem[],
    treatMethodsAsReadonly: boolean
  ): boolean {
    // 处理白名单类型
    if (this.isAllowedClassType(argType, allowClass)) {
      return true;
    }

    // 处理 type 类型
    if (
      this.isReadonlyTypeType(
        argType,
        scene,
        allowClass,
        treatMethodsAsReadonly
      )
    ) {
      return true;
    }
      

    // 处理对象/接口类型
    if (this.isReadonlyObjectType(argType, scene, allowClass)) {
      return true;
    }

    // 处理基本类型
    if (this.isReadonlyPrimitiveType(argType, paramDef)) {
      return true;
    }

    // 处理数组或元组类型
    if (this.isReadonlyArrayOrTupleType(argType, paramDef)) {
      return true;
    }

    // 处理 Union 类型
    if (this.isReadonlyUnionType(argType, paramDef, scene, allowClass)) {
      return true;
    }
     

    // 处理特殊类型（函数、TypeQuery、SymbolKeyword）
    if (this.isSpecialReadonlyType(argType, paramDef)) {
      return true;
    }
   
    // 处理 Object<T> 泛型类型
    if (this.isReadonlyGenericType(argType, scene, allowClass) || argType instanceof GenericType) {
      return true;
    }
    return false;
  }

  //判断参数的类型是否定义因为无定义不处理 天坑
 private paramTypeisUndefined(
    argType: methodArgType,
    paramDef: string,
 ): boolean {
  const specialTypes = ['FunctionType', 'TypeQuery', 'SymbolKeyword', 'RegExp']; 
  const argTypeString = argType.toString();
  paramDef = paramDef.replace(cleanedModifierReg, '');
if (argType.originalType !== undefined &&
    argType.originalType.classSignature !== undefined ) {
      //type
      return true;
    } else if (argType.classSignature !== undefined || argType.originalType) {
      //class
      return true;
    } else if (this.isReadonlyPrimitiveType(argType, paramDef)) {
      //基本类型
      return true;
    } else if (this.isArrayOrTupleType(argTypeString) || argType.toString() === 'TypeOperator') {
      //数组或者元组
      return true;
    } else if (argType.types) {
      //union 类型
      return true;
    } else if (specialTypes.includes(argTypeString) || argType.methodSignature !== undefined ) {
      // 特殊类型
      return true;
    } else if (argType.genericTypes && argType.genericTypes.length > 0) {
      //泛型
      return true;
    } else if (this.isComplexParamDef(paramDef, argTypeString)) {
      // 数组类型 + as
      return true;

    }
  return false;
 }

 private isComplexParamDef(paramDef: string, argTypeString: string): boolean {
    const strictWordRegex = new RegExp(`(?<![a-zA-Z0-9])as(?![a-zA-Z0-9])`);
    const includeInt = ['Int8Array', 'Int16Array', 'Int32Array', 'Uint8Array', 
      'Uint16Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'SafeString'];
  const trimmed = paramDef.trim();
  return paramDef.startsWith('...') || 
    (trimmed.startsWith('[') && trimmed.endsWith(']')) || 
    strictWordRegex.test(paramDef) || 
    paramDef.includes('=') || 
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    includeInt.includes(argTypeString.trim());

}



  // 判断是否在白名单中
  private isAllowedClassType(
    argType: methodArgType,
    allowClass: ClassifiedItem[]
  ): boolean {
    return this.findNames(allowClass).includes(
      argType.classSignature?.getClassName() ?? '-1'
    );
  }

  // 处理 Type 类型
  private isReadonlyTypeType(
    argType: methodArgType,
    scene: Scene,
    allowClass: ClassifiedItem[],
    treatMethodsAsReadonly: boolean
  ): boolean {
    return (
      argType.originalType !== undefined &&
      argType.originalType.classSignature !== undefined &&
      this.areAllTypePropertiesReadonly(
        argType.originalType.classSignature,
        scene,
        allowClass,
        treatMethodsAsReadonly
      )
    );
  }

  // 处理对象/接口类型
  private isReadonlyObjectType(
    argType: methodArgType,
    scene: Scene,
    allowClass: ClassifiedItem[]
  ): boolean {
    return (
      argType.classSignature !== undefined &&
      this.areAllClassPropertiesReadonly(
        argType.classSignature,
        scene,
        allowClass
      )
    );
  }

  // 处理基本类型
  private isReadonlyPrimitiveType(
    argType: methodArgType,
    paramDef: string
  ): boolean {
    return (
      this.isPrimitiveType(argType.toString()) && paramDef.trim().length > 0
    );
  }

  // 处理数组或元组类型
  private isReadonlyArrayOrTupleType(
    argType: methodArgType,
    paramDef: string
  ): boolean {
    const paramParts = paramDef.split(':')[1]?.trim() ?? '';
    return (
      (this.isArrayOrTupleType(argType.toString()) ||
        argType.toString() === 'TypeOperator') &&
      this.isReadonlyArrayOrTuple(paramParts)
    );
  }

  // 处理 Union 类型
  private isReadonlyUnionType(
    argType: methodArgType,
    paramDef: string,
    scene: Scene,
    allowClass: ClassifiedItem[]
  ): boolean {
    if (!argType.types || this.isArrayOrTupleType(argType.toString())) {
      return false;
    }
      

    for (const unionType of argType.types) {
      if (unionType instanceof LiteralType) {
        return true;
      }
      if (!this.isReadonlySingleUnionType(unionType, paramDef, scene, allowClass)) {
        return false;
      }
       
    }
    return true;
  }

  // 处理单个 Union 类型
  private isReadonlySingleUnionType(
    unionType: methodArgType,
    paramDef: string,
    scene: Scene,
    allowClass: ClassifiedItem[]
  ): boolean {
    if (
      unionType.classSignature &&
      !this.areAllClassPropertiesReadonly(
        unionType.classSignature,
        scene,
        allowClass
      )
    ) {
      return false;
    }
    if (
      this.isPrimitiveType(unionType.toString()) &&
      paramDef.trim().startsWith('readonly')
    ) {
      return false;
    }
      

    const paramParts = paramDef.split('|')[0]?.split(':')[1]?.trim() ?? '';
    if (
      (this.isArrayOrTupleType(unionType.toString()) ||
        unionType.toString() === 'TypeOperator') &&
      !this.isReadonlyArrayOrTuple(paramParts)
    ) {
      return false;
    }

    return this.isReadonlyOtherUnionType(unionType);
  }

  // 处理其他 Union 类型
  private isReadonlyOtherUnionType(unionType: methodArgType): boolean {
    const typeObName = unionType.name;
    return (
      !typeObName ||
      unionType.classSignature !== undefined ||
      this.isArrayOrTupleType(unionType.toString()) ||
      unionType.toString() === 'TypeOperator' ||
      this.isPrimitiveType(unionType.toString()) ||
      typeObName.toString().trim().startsWith('Readonly')
    );
  }

  // 处理特殊类型（函数、TypeQuery、SymbolKeyword）
  private isSpecialReadonlyType(argType: methodArgType, paramDef: string): boolean {
    const specialTypes = ['FunctionType', 'TypeQuery', 'SymbolKeyword'];
    return (
      specialTypes.includes(argType.toString()) ||
      argType.methodSignature !== undefined ||
      argType.toString().startsWith('typeof') ||
      (this.containsIsolatedFragment(paramDef, 'as') && paramDef.split('as')[1].trim().includes('.'))
    );
  }

  // 处理 Object<T> 泛型类型
    private isReadonlyGenericType(
      argType: methodArgType,
      scene: Scene,
      allowClass: ClassifiedItem[]
    ): boolean {
       if (argType.name && argType.name.trim().startsWith('Readonly')) {
        return true;
      }
      for (const type of argType.genericTypes ?? []) {
        if (this.isArrayOrTupleType(type.toString())) {
          return false;
        } else if (type.classSignature && this.areAllClassPropertiesReadonly( type.classSignature, scene, allowClass)
        ) {
          return true;
        } 
      
    }
    return false;
  }

  /**
   * 判断字符串是否表示基础类型，包括 any 和 undefined
   * @param type 要检查的字符串
   * @returns 如果字符串表示基础类型，则返回 true；否则返回 false
   */
  private isPrimitiveType(type: string): boolean {
    const primitiveTypes = [
      'string',
      'number',
      'boolean',
      'symbol',
      'bigint',
      'undefined',
      'null',
      'any',
      'void',
      'never'
    ];
    if (type === 'UnknownKeyword') {
      return true;
    }
    return primitiveTypes.includes(type);
  }

  //检查是否是数组或者是元组
  private isArrayOrTupleType(type: string): boolean {
    // 检查是否是数组类型
    if (type.endsWith('[]')) {
      return true;
    }
    // 检查是否是元组类型
    if (type.startsWith('[') && type.endsWith(']')) {
      return true;
    }
    return false;
  }

  //判断一个数组或元组的定义字符串是否符合全部为只读
  /**
   * 判断一个数组或元组的定义字符串是否符合全部为只读
   * @param type 要检查的字符串
   * @returns 如果字符串表示的数组或元组全部为只读，则返回 true；否则返回 false
   */
  private isReadonlyArrayOrTuple(type: string): boolean {
    // 检查是否是只读数组类型
    type = type.replace(/\(/g, '').replace(/\)/g, '');
    if (type.startsWith('readonly ') && type.endsWith('[]')) {
      // // 检查多维数组
      const dimensions = this.extractArrayDimensions(type);
      return dimensions.every((dim) => dim.startsWith('readonly'));
      
    }

    // 检查是否是只读元组类型
    if (type.startsWith('readonly [') && type.endsWith(']')) {
      // 去掉开头的 'readonly [' 和结尾的 ']'
      const elements = type
        .replace(readonlyReg, '')
        .replace(readReg, '')
        .split(',');
      // 检查每个元素是否包含 'readonly'
      const op = elements.every((el) => {
        if (el.includes('[]')) {
          return this.isReadonlyArrayOrTuple(el);
        } else {
          return true;
        }
      });
      return op;
    }

    return false;
  }

  private extractArrayDimensions(type: string): string[] {
    // 去除括号和多余空格
    type = type.replace(/[()]/g, '').trim();
  
    // 拆分出所有 readonly 和 base 类型
  
    const result: string[] = [];
    
    while (type.includes('[]')) {
      const readonlyStart = type.indexOf('readonly');
      const endArr = type.lastIndexOf('[]');
      const dimensionType = readonlyStart > -1 ? 'readonly []' : '[]';
      result.push(dimensionType);
      //去除第一个 readonly和最后一个[]
      if (readonlyStart > -1) {
        type = type.slice(readonlyStart + 8, endArr).trim();
      
    } else {
      type = type.slice(0, endArr).trim();
    }
    
  }
  
    return result.reverse();
  }
  

  /**
   * 检查类的属性是否全部为只读
   * @param classSignature 类的签名
   * @param scene 场景对象
   * @returns 如果类的所有属性都是只读的，则返回 true；否则返回 false
   */
  private isClassInAllowList(
    classSignature: ClassSignature,
    allowClass: ClassifiedItem[]
  ): boolean {
    return this.findNames(allowClass).includes(classSignature.getClassName());
  }

  private areFieldsReadonly(
    arkClass: ArkClass | undefined,
    scene: Scene,
    allowClass: ClassifiedItem[],
    depth: number,
    visitedClasses: Set<ClassSignature>
  ): boolean {
    if (!arkClass) {
      return true;
    }

    const fields: ArkField[] = arkClass.getFields() ?? [];
    for (const field of fields) {
      const fieldTypeClassSignature = (field.getType() as methodArgType)?.classSignature;
      if (
        !field.isReadonly() || (fieldTypeClassSignature && !this.isTypeFieldReadonly(fieldTypeClassSignature, scene))
      ) {
        return false;
      }
    }
    return true;
  }

  private isTypeFieldReadonly(classSign: ClassSignature, scene: Scene, visited = new Set<string>()): boolean {
    const arkClass = scene.getClass(classSign);
    if (!arkClass) {
      return true; // 没找到类，默认只读
    }
  
    const classKey = classSign.toString(); // 防止循环引用
    if (visited.has(classKey)) {
      return true;
    }
    visited.add(classKey);
  
    const fields: ArkField[] = arkClass.getFields() ?? [];
  
    for (const field of fields) {
      if (!field.isReadonly()) {
        return false;
      }
  
      const fieldTypeClassSignature = (field.getType() as methodArgType)?.classSignature;
        if (fieldTypeClassSignature && !this.isTypeFieldReadonly(fieldTypeClassSignature, scene, visited)) {
          return false;
        }
    }
  
    return true;
  }
  

  private isFieldReadonly(
    field: ArkField,
    scene: Scene,
    allowClass: ClassifiedItem[],
    depth: number,
    visitedClasses: Set<ClassSignature>
  ): boolean {
    const fieldType = field.getType() as methodArgType;
    const type = fieldType.toString();
    const fieldCode = field.getCode();

    if (fieldType.classSignature) {
      return this.areAllClassPropertiesReadonly(
        fieldType.classSignature,
        scene,
        allowClass,
        depth + 1,
        visitedClasses
      );
    }

    if (
      this.isPrimitiveType(type) &&
      !fieldCode.trim().startsWith('readonly')
    ) {
      return false;
    }

    const fieldCodeType = fieldCode.split(':')[1] ?? '';
    if (this.isArrayOrTupleType(type) || type === 'TypeOperator') {
      return this.isReadonlyArrayOrTuple(fieldCodeType);
    }

    return true;
  }

  private checkSuperClassReadonly(
    arkClass: ArkClass | undefined,
    scene: Scene,
    allowClass: ClassifiedItem[],
    depth: number,
    visitedClasses: Set<ClassSignature>
  ): boolean {
    const superClass = arkClass?.getSuperClass();
    if (!superClass) {
      return true;
    }

    return this.areAllClassPropertiesReadonly(
      superClass.getSignature(),
      scene,
      allowClass,
      depth + 1,
      visitedClasses
    );
  }

  private areAllClassPropertiesReadonly(
    classSignature: ClassSignature,
    scene: Scene,
    allowClass: ClassifiedItem[],
    depth: number = 0,
    visitedClasses: Set<ClassSignature> = new Set()
  ): boolean {
    if (depth > 10) {
      logger.warn('Recursion depth exceeded, stopping.');
      return true;
    }
    const arkClass = scene.getClass(classSignature);
    if (visitedClasses.has(classSignature) || (arkClass && arkClass.getCategory() === ClassCategory.ENUM)) {
      return true;
    }
    visitedClasses.add(classSignature);

    if (this.isClassInAllowList(classSignature, allowClass)) {
      return true;
    }

    
    const methods = (arkClass?.getMethods() ?? []).filter(method => !method.getName().startsWith('create') && !method.getName().startsWith('constructor'));
    if (
      arkClass &&
      (methods.length > 0 || !this.areFieldsReadonly(arkClass, scene, allowClass, depth, visitedClasses))
    ) {
      return false;
    }
    return (
      arkClass !== null &&
      this.checkSuperClassReadonly(
        arkClass,
        scene,
        allowClass,
        depth,
        visitedClasses
      )
    );
  }

  // Function to verify if methods are readonly
  private verifyMethodsReadonly(
    arkClass: ArkClass,
    treatMethodsAsReadonly: boolean
  ): boolean {
    if (!treatMethodsAsReadonly) {
      const methods: ArkMethod[] = arkClass?.getMethods() ?? [];
      for (const method of methods) {
        if (
          !method.getName().includes('%') &&
          !method.getCode()?.trim().startsWith('readonly')
        ) {
          return false;
        }
      }
    }
    return true;
  }

  // Function to verify if fields are readonly
  private verifyFieldsReadonly(
    arkClass: ArkClass,
    scene: Scene,
    allowClass: ClassifiedItem[]
  ): boolean {
    const fields: ArkField[] = arkClass?.getFields() ?? [];
    for (const field of fields) {
      const fieldType = field.getType() as methodArgType;
      const type = fieldType.toString();
      const fieldCode = field.getCode();

      if (fieldType.classSignature) {
        if (
          !this.areAllClassPropertiesReadonly(
            fieldType.classSignature,
            scene,
            allowClass
          )
        ) {
          return false;
        }
      }
      if (
        this.isPrimitiveType(type) &&
        !fieldCode.trim().startsWith('readonly')
      ) {
        return false;
      }
      const fieldCodeNeed = fieldCode.split(':')[1] ?? '';
      if (
        (this.isArrayOrTupleType(type) || type === 'TypeOperator') &&
        !this.isReadonlyArrayOrTuple(fieldCodeNeed)
      ) {
        return false;
      }
    }
    return true;
  }

  // Function to verify if the superclass properties are readonly
  private verifySuperClassReadonly(
    arkClass: ArkClass,
    scene: Scene,
    allowClass: ClassifiedItem[]
  ): boolean {
    const superClass = arkClass?.getSuperClass();
    if (superClass) {
      return this.areAllClassPropertiesReadonly(
        superClass.getSignature(),
        scene,
        allowClass
      );
    }
    return true;
  }

  // Refactored main function using the updated helper methods
  public areAllTypePropertiesReadonly(
    classSignature: ClassSignature,
    scene: Scene,
    allowClass: ClassifiedItem[],
    treatMethodsAsReadonly: boolean
  ): boolean {
    const arkClass = scene.getClass(classSignature);

    // Check if methods are readonly
    if (
      arkClass !== null &&
      !this.verifyMethodsReadonly(arkClass, treatMethodsAsReadonly)
    ) {
      return false;
    }

    // Check if fields are readonly
    if (
      arkClass !== null &&
      !this.verifyFieldsReadonly(arkClass, scene, allowClass)
    ) {
      return false;
    }

    // Check if superclass properties are readonly
    return (
      arkClass !== null &&
      this.verifySuperClassReadonly(arkClass, scene, allowClass)
    );
  }

  //解析allow属性
  private classifyAllow(
    allow: AllowElement[],
    methodPath: string
  ): ClassifiedItem[] {
    const classifiedMap: { [key: string]: { [key: string]: Set<string> } } = {};
    allow.forEach((element) => {
      let from: string;
      let path: string;
      let names: string[];

      if (typeof element === 'string') {
        from = 'string';
        path = methodPath;
        names = [element];
      } else {
        from = element.from;
        if (element.from === 'file') {
          path = element.path ? element.path : methodPath;
        } else {
          path =
            element.from === 'package' && element.package
              ? element.package
              : '';
        }

        names = Array.isArray(element.name) ? element.name : [element.name];
      }

      if (!classifiedMap[from]) {
        classifiedMap[from] = {};
      }
      if (!classifiedMap[from][path]) {
        classifiedMap[from][path] = new Set();
      }
      names.forEach((name) => classifiedMap[from][path].add(name));
    });

    const classifiedItems: ClassifiedItem[] = [];
    for (const from in classifiedMap) {
      for (const path in classifiedMap[from]) {
        classifiedItems.push({
          from,
          path: path || undefined,
          names: Array.from(classifiedMap[from][path]),
        });
      }
    }

    return classifiedItems;
  }

  //获取所有的白名单
  private findNames(classifiedItems: ClassifiedItem[]): string[] {
    return classifiedItems.reduce((allClassNames, item) => {
      return allClassNames.concat(item.names);
    }, [] as string[]);
  }

  private checkConstructor(text: string): boolean {
   return text === 'constructor' || text === 'constructor()';
  }

  private addIssueReport(
    linePos: [x: number, y: number, label: string],
    arkFilePath: string,
    methodCode: string,
    name: string,
    severity: number
  ): void {
    const warnInfo = this.getLineAndColumnMethod(linePos, arkFilePath, methodCode, name);
    let defect = new Defects(
      warnInfo.line,
      warnInfo.startCol,
      warnInfo.endCol,
      this.metaData.description,
      severity,
      this.rule.ruleId,
      warnInfo.filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }

  private getLineAndColumnMethod(
    linePos: [line: number, col: number, code: string],
    arkFilePath: string,
    methodCode: string,
    named: string
  ): { line: number; startCol: number; endCol: number; filePath: string } {
    let line = linePos[0];
    if (arkFilePath) {
      let startCol = linePos[1];
      const startOther = named.startsWith('(');
      let name = startOther ? named.substring(1) : named;
      let isModifier = this.isModifierType(name);
      const modifiers = ['readonly', 'static', 'private', 'protected', 'public'];
      const modifierRegex = new RegExp(`^(${modifiers.join('|')})\\s+`);
      const posionStart = this.getTextPosition(methodCode, name.trim());
      while (posionStart.line === 0 && isModifier && modifierRegex.test(name)) {
        name = name.replace(modifierRegex, '');
        isModifier = this.isModifierType(name);
      };
      if (name.startsWith('...')) {
          name = named;
      }
      const posion = this.getTextPosition(methodCode, name.trim());
      startCol = posion.line === 0 ? startCol + posion.column - 1 : posion.column;
      line = posion.line > 0 ? line + posion.line : line;
      const endCol = startCol + name.length - 1;
      return { line, startCol, endCol, filePath: arkFilePath };
    } else {
      logger.debug('originStmt or arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }
  private isModifierType(name: string): boolean {
      return name.startsWith('readonly') || name.startsWith('static') || 
      name.startsWith('private') || name.startsWith('protected') || name.startsWith('public');
  }

  private processParam(
    targetMethod: ArkMethod,
    paramsDef: string[],
    mergedOptions: Options,
    scene: Scene,
    allowClass: ClassifiedItem[],
    arkfilePath: string,
    severity: number,
    lineCode: number,
    lineColCode: number,
    methodCode: string
  ): boolean {
    const params: MethodParameter[] = targetMethod.getParameters();
    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      //获取参数的类别
      const paramType: methodArgType = param.getType() as methodArgType;
      const paramDef = i < paramsDef.length ? paramsDef[i] : '';
      const isVariable = paramDef.startsWith('...') && !paramDef.includes(':');
      //ignoreInferredTypes---->忽略未定义参数
      if (mergedOptions.ignoreInferredTypes && !paramDef) {
        return true;
      }
      if (
         this.paramTypeisUndefined(paramType, paramDef) &&
        (isVariable || !this.isReadonlyType(paramType, paramDef, scene, allowClass, mergedOptions.treatMethodsAsReadonly ?? false) ) &&
        !this.execArgAssignType(paramDef) 
      ) {
        this.addIssueReport(
          [lineCode, lineColCode, methodCode],
          arkfilePath,
          methodCode,
          paramDef,
          severity
        );
      }
    }
    return false;
  }

private escapeRegExp(str: string): string {
  return str.replace(replaceStringReg, '\\$&'); // 转义所有正则特殊字符
}

private getTextPosition(text: string, target: string): { line: number, column: number } {
  const escapedTarget = this.escapeRegExp(target);
  const strictWordRegex = new RegExp(`(?<![a-zA-Z0-9])${escapedTarget}(?![a-zA-Z0-9])`, 's'); // 's' 模式支持跨行

  const match = strictWordRegex.exec(text);
  if (!match) {
    return { line: -1, column: -1 };
  }

  const index = match.index;

  const linesUpToMatch = text.slice(0, index).split('\n');
  const line = linesUpToMatch.length - 1;
  const column = linesUpToMatch[linesUpToMatch.length - 1].length + 1;

  return { line, column };
}


//针对scen不能解析参数内赋值逻辑特殊处理--->foo(a = 1, b: number)
 private execArgAssignType(pref: string): boolean {
  const asIndext = pref.indexOf('as');
  pref = asIndext > -1 ? pref.slice(0, pref.indexOf('as')).trim() : pref;
  const argAssignType = pref.split('=');
  if (argAssignType.length <= 1 && ( stringPureReg.test(pref) && pref !== '')) {
    return true;
  } else if (argAssignType.length <= 1) {
    return false;
  }
  else {
 const value = argAssignType[1].trim();
 // 字符串字面量：'xxx' 或 "xxx"
 const isString = stringliteralReg.test(value);

 // 数字字面量：整数或浮点数
 const isNumber = numberliteralReg.test(value.replace(')', ''));

 //引用变量
 const isVariableReference = VariableReferenceReg.test(value);

 // 布尔字面量
 const isBoolean = value === 'true' || value === 'false';

 //函数
 const isFunctionCall = this.isFunctionCall(value);

 return isString || isNumber || isBoolean || isVariableReference || isFunctionCall;
  }
 

}
private isFunctionCall(value: string): boolean {
  // 去除所有空格并检查是否以 '(' 开头，且字符串是一个函数调用
  return value.replace(/\s/g, '').match(funcallOneReg) !== null || funcallTowReg.test(value);
}

//需要额外处理执行函数参数类型 天坑
private execFunctionCallParamType(
  arkMethod: ArkMethod,
  arkFilePath: string,
  severity: number,
  scene:Scene

): void {
  //1.获取所有执行语句
  const stmts = arkMethod.getBody()?.getCfg().getStmts() ?? [];
  for (const stmt of stmts) {
    const methodCall = CheckerUtils.getInvokeExprFromStmt(stmt);
    if (methodCall instanceof ArkInstanceInvokeExpr) {
      const params = methodCall.getArgs();
      const methodCode = stmt.getOriginalText() ?? '';
      const methodName = methodCall.getMethodSignature().getMethodSubSignature().getMethodName();
      const realGenericArr = methodCall.getRealGenericTypes();
      const baseType = methodCall.getBase(); 
      let medCode = '';
      for (const param of params) {
        const paramType = param.getType();
        const baseTypeT = baseType.getType(); 
        const posion = stmt.getOriginPositionInfo();
        if (paramType instanceof FunctionType) {
          medCode = scene.getMethod(paramType.getMethodSignature())?.getCode() ?? '';
        }
      this.extractParametersAddReport(paramType, realGenericArr, baseTypeT, methodName, methodCode, 
        posion, arkFilePath, medCode, severity, scene, params.length);
      }
    }
}
}
private extractParametersAddReport(paramType: Type, realGenericArr: Type[] | undefined, baseTypeT: Type, methodName: string, 
  methodCode: string, posion: LineColPosition, arkFilePath: string, medCode: string, severity: number, scene: Scene, paraLength: number): void {
  if (paramType instanceof FunctionType && this.iscontainsChainCallFunc(methodName) && 
  !this.containsIsolatedFragment(methodCode, 'new') && methodCode.includes('=>') && 
  (((baseTypeT instanceof ArrayType) && (realGenericArr !== undefined && !this.isStartReadOnly(realGenericArr))) || 
  ( (methodCode.startsWith('return') || baseTypeT.toString().includes('|')) && realGenericArr === undefined && paraLength === 1 )) 
 ) {
    
    this.addIssueReport([posion.getLineNo(), posion.getColNo(), methodCode], arkFilePath, methodCode, medCode, severity);
  }
  const classSSign = paramType as methodArgType;
  if ((realGenericArr === undefined || (realGenericArr && !this.isStartReadOnly(realGenericArr))) && (baseTypeT instanceof ArrayType) && 
  ((paramType instanceof ArrayType && !paramType.toString().includes('readonly')) ||
     (paramType instanceof ClassType && (!this.isReadonlyObjectType(classSSign, scene, []) || !paramType.toString().startsWith('Record') ))) ) {
    this.addIssueReport(
      [posion.getLineNo(), posion.getColNo(), methodCode],
       arkFilePath,
       methodCode,
       medCode,
       severity
     );
  }
}
private containsIsolatedFragment(source: string, fragment: string): boolean {
  const regex = new RegExp(`(?<![a-zA-Z0-9])${this.escapeRegExp(fragment)}(?![a-zA-Z0-9])`);
  return regex.test(source);
}

//判断是否是链式调用函数
private iscontainsChainCallFunc(methodName: string): boolean {
  const containsChainName = ['map', 'filter', 'reduce', 'forEach', 'every', 'some', 'find', 'findIndex'];
  return containsChainName.includes(methodName);
}
private isStartReadOnly(type: Type[]): boolean {
  for (const t of type) {
    if ((t instanceof ArrayType || t instanceof TupleType ) && !(t.toString().startsWith('readonly') || t.toString().startsWith('Readonly'))) {
      return false;
    } else if (t.getTypeString().startsWith('Record') ) {
      return false;
    }
  }
  return true;
}
}