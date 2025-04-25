/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
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

import { ArkFile, ts, AstTreeUtils } from "arkanalyzer/lib";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../Index";

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  "NamingConventionCheck"
);

type Selector =
  | 'default'
  | 'variable'
  | 'function'
  | 'parameter'
  | 'property'
  | 'parameterProperty'
  | 'method'
  | 'accessor'
  | 'enumMember'
  | 'class'
  | 'interface'
  | 'typeAlias'
  | 'enum'
  | 'typeParameter'
  | 'memberLike'
  | 'typeLike'
  | 'variableLike'
  | 'classMethod'
  | 'objectLiteralMethod'
  | 'typeMethod'
  | 'classProperty'
  | 'objectLiteralProperty'
  | 'typeProperty'
  | 'import';

type Format =
  | 'camelCase'
  | 'strictCamelCase'
  | 'PascalCase'
  | 'StrictPascalCase'
  | 'snake_case'
  | 'UPPER_CASE';

type Modifier =
  | 'abstract'
  | 'async'
  | 'const'
  | 'default'
  | 'destructured'
  | 'exported'
  | 'global'
  | 'namespace'
  | 'override'
  | '#private'
  | 'private'
  | 'protected'
  | 'public'
  | 'readonly'
  | 'requiresQuotes'
  | 'static'
  | 'unused';

type TypeOption = 'array' | 'boolean' | 'function' | 'number' | 'string';

type Option = {
  selector: Selector | Selector[];
  format?: Format[] | null;
  modifiers?: Modifier[];
  types?: TypeOption[];
  filter?:
    | string
    | {
        regex: string;
        match: boolean;
      };
  custom?: {
    regex: string;
    match: boolean;
  };
  leadingUnderscore?:
    | 'forbid'
    | 'require'
    | 'requireDouble'
    | 'allow'
    | 'allowDouble'
    | 'allowSingleOrDouble';
  trailingUnderscore?:
    | 'forbid'
    | 'require'
    | 'requireDouble'
    | 'allow'
    | 'allowDouble'
    | 'allowSingleOrDouble';
  prefix?: string[];
  suffix?: string[];
};

const defaultOptions: Option[] = [
  {
    selector: 'default',
    format: ['camelCase'],
    leadingUnderscore: 'allow',
    trailingUnderscore: 'allow',
  },
  {
    selector: 'import',
    format: ['camelCase', 'PascalCase'],
  },
  {
    selector: 'variable',
    format: ['camelCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow',
    trailingUnderscore: 'allow',
  },
  {
    selector: 'typeLike',
    format: ['PascalCase'],
  },
];

export class NamingConventionCheck implements BaseChecker {
  readonly metaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/naming-convention-check.md",
    description: "Enforce naming conventions for everything across a codebase.",
  };

  public issues: any[] = [];
  public defects: Defects[] = [];
  public rule: Rule;
  private currentArkFile: ArkFile | null = null;
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };
  private selectors: string[] = [];
  private formats: Format[] = [];
  private ruleConfigs = {
    prefixes: new Set<string>(),
    suffixes: new Set<string>(),
  };

  private options: Option[];
  private methodArr: ts.Node[] = [];
  private defaultArr: ts.Node[] = [];
  private variableArr: ts.Node[] = [];
  private functionArr: ts.Node[] = [];
  private parameterArr: ts.Node[] = [];
  private parameterPropertyArr: ts.Node[] = [];
  private accessorArr: ts.Node[] = [];
  private enumMemberArr: ts.Node[] = [];
  private classArr: ts.Node[] = [];
  private interfaceArr: ts.Node[] = [];
  private typeAliasArr: ts.Node[] = [];
  private enumArr: ts.Node[] = [];
  private typeParameterArr: ts.Node[] = [];
  private memberLikeArr: ts.Node[] = [];
  private typeLikeArr: ts.Node[] = [];
  private variableLikeArr: ts.Node[] = [];
  private classMethodArr: ts.Node[] = [];
  private objectLiteralMethodArr: ts.Node[] = [];
  private typeMethodArr: ts.Node[] = [];
  private classPropertyArr: ts.Node[] = [];
  private objectLiteralPropertyArr: ts.Node[] = [];
  private typePropertyArr: ts.PropertySignature[] = [];
  private importArr: ts.ImportDeclaration[] = [];
  private propertyArr: ts.Node[] = [];
  private checkParamMap: Map<string, number> = new Map();
  private selectorProcessors: Record<Selector, (option: Option) => void> = {
    'variable': this.processVariableSelector.bind(this),
    'function': this.processFunctionSelector.bind(this),
    'class': this.processClassSelector.bind(this),
    'interface': this.processInterfaceSelector.bind(this),
    'enum': this.processEnumSelector.bind(this),
    'parameter': this.processParameterSelector.bind(this),
    'import': this.processImportSelector.bind(this),
    'parameterProperty': this.processParameterPropertySelector.bind(this),
    'accessor': this.processAccessorSelector.bind(this),
    'enumMember': this.processEnumMemberSelector.bind(this),
    'typeAlias': this.processTypeAliasSelector.bind(this),
    'typeParameter': this.processTypeParameterSelector.bind(this),
    'classMethod': this.processClassMethodSelector.bind(this),
    'objectLiteralMethod': this.processObjectLiteralMethodSelector.bind(this),
    'typeMethod': this.processTypeMethodSelector.bind(this),
    'classProperty': this.processClassPropertySelector.bind(this),
    'objectLiteralProperty': this.processObjectLiteralPropertySelector.bind(this),
    'typeProperty': this.processTypePropertySelector.bind(this),
    'memberLike': this.processMemberLikeSelector.bind(this),
    'method': this.processMethodSelector.bind(this),
    'property': this.processPropertySelector.bind(this),
    'typeLike': this.processTypeLikeSelector.bind(this),
    'variableLike': this.processVariableLikeSelector.bind(this),
    'default': this.processDefaultSelector.bind(this)
  };

  constructor(customOption?: Option[]) {
    if (customOption) {
      this.options = customOption;
    }
  }

  public registerMatchers(): MatcherCallback[] {
    const matchFileCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check,
    };
    return [matchFileCb];
  }

  public check = (targetField: ArkFile): void => {
    this.currentArkFile = targetField;
    const node = AstTreeUtils.getSourceFileFromArkFile(targetField);
    this.options = this.rule.option?.length
      ? (this.rule.option as Option[])
      : defaultOptions;
    const defaultItems = this.options.filter(
      (item) => item.selector === 'default'
    );
    const nonDefaultItems = this.options.filter(
      (item) => item.selector !== 'default'
    );
    const result1: Option[] = [...nonDefaultItems, ...defaultItems];
    const defaultItems1 = result1.filter((item) => item.modifiers);
    const nonDefaultItems1 = result1.filter((item) => !item.modifiers);
    const result: Option[] = [...nonDefaultItems1, ...defaultItems1];
    const neededSelectors = new Set<Selector>();
    result.forEach((option) => {
      if (Array.isArray(option.selector)) {
        option.selector.forEach((selector) => neededSelectors.add(selector));
      } else {
        neededSelectors.add(option.selector);
      }
      option.format?.forEach((format) => {
        this.formats.push(format);
      });
      option.prefix?.forEach((p) => this.ruleConfigs.prefixes.add(p));
      option.suffix?.forEach((s) => this.ruleConfigs.suffixes.add(s));
    });
    this.collectNeededNodes(node, neededSelectors);
    result.forEach((option) => {
      if (Array.isArray(option.selector)) {
        option.selector.forEach((selector) => {
          this.getOptionForSelector(selector, option);
          this.selectors.push(selector);
        });
      } else {
        this.getOptionForSelector(option.selector, option);
        this.selectors.push(option.selector);
      }
    });
  };

  private checkSelectors(Selectors: Set<Selector>, selectors: string[]): boolean {
    return selectors.some(selector => Selectors.has(selector as Selector));
  }

  private collectNeededNodes(node: ts.Node, neededSelectors: Set<Selector>): void {
    const needVariableGroup = this.checkSelectors(neededSelectors, ['variable', 'variableLike', 'default']);
    const needFunctionGroup = this.checkSelectors(neededSelectors, ['function', 'variableLike', 'default']);
    const needParameterGroup = this.checkSelectors(neededSelectors, ['parameter', 'variableLike', 'default']);
    const needTypeGroup = this.checkSelectors(neededSelectors, ['class', 'interface', 'enum', 'typeAlias', 'typeLike', 'default']);
    const needMemberGroup = this.checkSelectors(neededSelectors, ['method', 'property', 'accessor', 'memberLike', 'default']);
    const needImportGroup = this.checkSelectors(neededSelectors, ['import', 'default']);
    const visit = (node: ts.Node): void => {
      if (needVariableGroup && ts.isVariableDeclaration(node)) {
        this.collectVariableNodes(node);
      }
      if (needFunctionGroup && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node))) {
        this.collectFunctionNodes(node);
      }
      if (needParameterGroup && ts.isParameter(node)) {
        this.parameterArr.push(node);
        if (ts.isParameterPropertyDeclaration(node, node.parent)) {
          this.parameterPropertyArr.push(node);
        }
        if (needVariableGroup) {
          this.variableLikeArr.push(node);
        }
      }
      if (needTypeGroup) {
        this.collectTypeNodes(node, neededSelectors);
      }
      if (needMemberGroup) {
        this.collectMemberNodes(node, neededSelectors);
      }
      if (needImportGroup && ts.isImportDeclaration(node)) {
        this.importArr.push(node);
      }
      if (neededSelectors.has('default')) {
        this.collectDefaultNodes(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(node);
  }

  /**
   * 收集变量相关节点
   */
  private collectVariableNodes(node: ts.VariableDeclaration): void {
    this.variableArr.push(node);
    this.variableLikeArr.push(node);
    
    // 处理解构模式
    if (ts.isObjectBindingPattern(node.name)) {
      this.collectDestructuringNames(node.name);
    } else if (ts.isArrayBindingPattern(node.name)) {
      this.collectDestructuringNames(node.name);
    }
  }

  /**
   * 收集函数相关节点
   */
  private collectFunctionNodes(node: ts.FunctionDeclaration | ts.FunctionExpression): void {
    this.functionArr.push(node);
    
    if (ts.isFunctionDeclaration(node)) {
      this.variableLikeArr.push(node);
    }
  }

  /**
   * 收集类型相关节点
   */
  private collectTypeNodes(node: ts.Node, neededSelectors: Set<Selector>): void {
    const needClass = neededSelectors.has('class') || neededSelectors.has('typeLike');
    const needInterface = neededSelectors.has('interface') || neededSelectors.has('typeLike');
    const needEnum = neededSelectors.has('enum') || neededSelectors.has('typeLike');
    const needTypeAlias = neededSelectors.has('typeAlias') || neededSelectors.has('typeLike');
    const needTypeParameter = neededSelectors.has('typeParameter') || neededSelectors.has('typeLike');
    
    if (needClass && ts.isClassDeclaration(node)) {
      this.classArr.push(node);
      if (neededSelectors.has('typeLike')) {
        this.typeLikeArr.push(node);
      }
    }
    
    if (needInterface && ts.isInterfaceDeclaration(node)) {
      this.interfaceArr.push(node);
      if (neededSelectors.has('typeLike')) {
        this.typeLikeArr.push(node);
      }
    }
    
    if (needEnum && ts.isEnumDeclaration(node)) {
      this.enumArr.push(node);
      if (neededSelectors.has('typeLike')) {
        this.typeLikeArr.push(node);
      }
    }
    
    if (needTypeAlias && ts.isTypeAliasDeclaration(node)) {
      this.typeAliasArr.push(node);
      if (neededSelectors.has('typeLike')) {
        this.typeLikeArr.push(node);
      }
    }
    
    if (needTypeParameter && ts.isTypeParameterDeclaration(node)) {
      this.typeParameterArr.push(node);
      if (neededSelectors.has('typeLike')) {
        this.typeLikeArr.push(node);
      }
    }
  }

  /**
   * 收集成员相关节点
   */
  private collectMemberNodes(node: ts.Node, neededSelectors: Set<Selector>): void {
    const needMethod = this.checkSelectors(neededSelectors, ['method', 'memberLike', 'classMethod', 'objectLiteralMethod', 'typeMethod']);
    const needProperty = this.checkSelectors(neededSelectors, ['property', 'memberLike', 'classProperty', 'objectLiteralProperty', 'typeProperty']);
    const needAccessor = this.checkSelectors(neededSelectors, ['accessor', 'memberLike']);
    const needEnumMember = this.checkSelectors(neededSelectors, ['enumMember', 'memberLike']);

    if (needMethod && ts.isMethodDeclaration(node)) {
      this.methodArr.push(node);
      this.collectMethod(node, neededSelectors);
      }
    if (needProperty) {
      this.collectProperty(node, neededSelectors);
      }
    if (needAccessor && (ts.isGetAccessor(node) || ts.isSetAccessor(node))) {
      this.accessorArr.push(node);
      if (neededSelectors.has('memberLike')) {
        this.memberLikeArr.push(node);
      }
    }
    if (needEnumMember && ts.isEnumMember(node)) {
      this.enumMemberArr.push(node);
      if (neededSelectors.has('memberLike')) {
        this.memberLikeArr.push(node);
      }
    }
    if (needMethod && ts.isMethodSignature(node) && neededSelectors.has('typeMethod')) {
      this.typeMethodArr.push(node);
    }
  }

    private collectMethod(node: ts.Node, neededSelectors: Set<Selector>): void {
      if (neededSelectors.has('memberLike')) {
        this.memberLikeArr.push(node);
      }
      if (neededSelectors.has('classMethod') && ts.isClassDeclaration(node.parent)) {
        this.classMethodArr.push(node);
      }
      if (neededSelectors.has('objectLiteralMethod') && ts.isObjectLiteralExpression(node.parent)) {
        this.objectLiteralMethodArr.push(node);
      }
    }

    private collectProperty(node: ts.Node, neededSelectors: Set<Selector>): void {
      if (ts.isPropertyDeclaration(node)) {
        this.propertyArr.push(node);
        if (neededSelectors.has('memberLike')) {
          this.memberLikeArr.push(node);
        }
        if (neededSelectors.has('classProperty') && ts.isClassDeclaration(node.parent)) {
          this.classPropertyArr.push(node);
        }}
      if (ts.isPropertySignature(node) && neededSelectors.has('typeProperty')) {
        this.typePropertyArr.push(node);
      }
      if (ts.isPropertyAssignment(node) && 
          ts.isObjectLiteralExpression(node.parent) && 
          neededSelectors.has('objectLiteralProperty')) {
        this.objectLiteralPropertyArr.push(node);
      }
    }

  /**
   * 收集需要进行命名规范检查的默认节点
   * @param node 当前遍历的节点
   */
  private collectDefaultNodes(node: ts.Node): void {
    // 使用分类处理的方式代替长串的 if-else 链
    this.collectDefaultIdentifiers(node);
    this.collectImportAndFunctionNodes(node);
    this.collectPropertyNodes(node);
    this.collectNonIdentifierNames(node);
    this.collectMiscNodes(node);
  }

  /**
   * 收集标识符节点
   */
  private collectDefaultIdentifiers(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      this.defaultArr.push(node);
    }
  }

  /**
   * 收集导入和函数表达式节点
   */
  private collectImportAndFunctionNodes(node: ts.Node): void {
    // 处理默认导入名称，如 import _ from 'lodash-es' 中的 _
    if (ts.isImportClause(node) && node.name) {
      this.defaultArr.push(node.name);
    }
    // 处理命名的函数表达式
    else if (ts.isFunctionExpression(node) && node.name) {
      this.defaultArr.push(node.name);
    }
  }

  /**
   * 收集属性节点
   */
  private collectPropertyNodes(node: ts.Node): void {
    // 处理属性赋值中的标识符属性名，如 { AKey: true } 中的 AKey
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      this.defaultArr.push(node.name);
    }
    // 处理简写属性赋值中的标识符属性名，如 { Foo } 中的 Foo
    else if (ts.isShorthandPropertyAssignment(node)) {
      this.defaultArr.push(node.name);
    }
    // 处理属性访问表达式中的标识符，如 obj.foo 中的 foo
    else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
      this.defaultArr.push(node.name);
    }
  }

  /**
   * 收集非标识符名称的节点
   */
  private collectNonIdentifierNames(node: ts.Node): void {
    // 处理属性签名中的字符串字面量名称
    if (ts.isPropertySignature(node) && node.name && !ts.isIdentifier(node.name)) {
      if (ts.isStringLiteral(node.name)) {
        this.defaultArr.push(node.name);
      }
    }
    // 处理方法声明中的非标识符名称
    else if (ts.isMethodDeclaration(node) && node.name && !ts.isIdentifier(node.name)) {
      if (ts.isNumericLiteral(node.name) || ts.isStringLiteral(node.name)) {
        this.defaultArr.push(node.name);
      }
    }
    // 处理属性声明中的非标识符名称
    else if (ts.isPropertyDeclaration(node) && node.name && !ts.isIdentifier(node.name)) {
      if (ts.isNumericLiteral(node.name) || ts.isStringLiteral(node.name)) {
        this.defaultArr.push(node.name);
      }
    }
    // 处理属性赋值中的非标识符名称
    else if (ts.isPropertyAssignment(node) && node.name && !ts.isIdentifier(node.name)) {
      if (ts.isNumericLiteral(node.name) || ts.isStringLiteral(node.name)) {
        this.defaultArr.push(node.name);
      }
    }
  }

  /**
   * 收集其他类型的节点
   */
  private collectMiscNodes(node: ts.Node): void {
    // 处理计算属性名
    if (ts.isComputedPropertyName(node) && node.expression) {
      this.defaultArr.push(node);
    }
  }
  
  private getOptionForSelector(selector: Selector, option: Option): void {
    const processor = this.selectorProcessors[selector];
    
    if (processor) {
      processor(option);
    } else {
      const exhaustiveCheck = (s: never) => {
        throw new Error(`Unprocessed selector types: ${s}`);
      };
      exhaustiveCheck(selector as never);
    }
  }

  private processVariableSelector(option: Option): void {
    this.variableArr.forEach((node) => {
      this.checkVariable(node as ts.VariableDeclaration, option);
    });
  }

  private processFunctionSelector(option: Option): void {
    this.functionArr.forEach((node) => {
      this.checkFunction(
        node as ts.FunctionDeclaration | ts.FunctionExpression,
        option
      );
    });
  }

  private processClassSelector(option: Option): void {
    this.classArr.forEach((node) => {
      this.checkClass(node as ts.ClassDeclaration, option);
    });
  }

  private processInterfaceSelector(option: Option): void {
    this.interfaceArr.forEach((node) => {
      this.checkInterface(node, option);
    });
  }

  private processEnumSelector(option: Option): void {
    this.enumArr.forEach((node) => {
      this.checkEnum(node, option);
    });
  }

  private processParameterSelector(option: Option): void {
    this.parameterArr.forEach((node) => {
      this.checkParameter(node, option);
    });
  }

  private processImportSelector(option: Option): void {
    this.importArr.forEach((node) => {
      this.processImportNode(node, option);
    });
  }

  /**
   * 处理单个导入节点
   * @param node 导入声明节点
   * @param option 命名选项
   */
  private processImportNode(node: ts.ImportDeclaration, option: Option): void {
    if (!node.importClause) {
      return; // 没有导入子句，直接返回
    }
    
    // 处理默认导入
    this.processDefaultImport(node.importClause, option);
    
    // 处理命名导入
    this.processNamedImports(node.importClause, option);
  }
  
  /**
   * 处理默认导入
   * @param importClause 导入子句
   * @param option 命名选项
   */
  private processDefaultImport(importClause: ts.ImportClause, option: Option): void {
    if (importClause.name) {
      this.checkImport(importClause, option);
    }
  }
  
  /**
   * 处理命名导入
   * @param importClause 导入子句
   * @param option 命名选项
   */
  private processNamedImports(importClause: ts.ImportClause, option: Option): void {
    const namedBindings = importClause.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      return;
    }
    
    namedBindings.elements.forEach((element) => {
      this.checkImport(element, option);
    });
  }

  private checkImport(node: ts.Node, option: Option): void {
    if (ts.isImportSpecifier(node)) {
      const importName = node.name.text;
      this.checkNaming(node, importName, option, 'Import');
      if (!option.prefix && !option.suffix) {
        const [line, character] = this.getNodePosition(node);
        this.checkParamMap.set(importName, line);
      }
    }
    // 处理默认导入，如 import _ from 'lodash-es'
    else if (ts.isImportClause(node) && node.name) {
      const importName = node.name.text;
      this.checkNaming(node.name, importName, option, 'Import');
      if (!option.prefix && !option.suffix) {
        const [line, character] = this.getNodePosition(node.name);
        this.checkParamMap.set(importName, line);
      }
    }
  }

  private processParameterPropertySelector(option: Option): void {
    this.parameterPropertyArr.forEach((node) => {
      this.checkParameterProperty(node, option);
    });
  }

  private processAccessorSelector(option: Option): void {
    this.accessorArr.forEach((node) => {
      this.checkAccessor(node, option);
    });
  }

  private processEnumMemberSelector(option: Option): void {
    this.enumMemberArr.forEach((node) => {
      this.checkEnumMember(node, option);
    });
  }

  private processTypeAliasSelector(option: Option): void {
    this.typeAliasArr.forEach((node) => {
      this.checkTypeAlias(node, option);
    });
  }

  private processTypeParameterSelector(option: Option): void {
    this.typeParameterArr.forEach((node) => {
      this.checkTypeParameter(node, option);
    });
  }

  private processClassMethodSelector(option: Option): void {
    this.classMethodArr.forEach((node) => {
      this.checkClassMethod(node, option);
    });
  }

  private processObjectLiteralMethodSelector(option: Option): void {
    this.objectLiteralMethodArr.forEach((node) => {
      this.checkObjectLiteralMethod(node, option);
    });
  }

  private processTypeMethodSelector(option: Option): void {
    this.typeMethodArr.forEach((node) => {
      this.checkTypeMethod(node, option);
    });
  }

  private processClassPropertySelector(option: Option): void {
    this.classPropertyArr.forEach((node) => {
      this.checkClassProperty(node, option);
    });
  }

  private processObjectLiteralPropertySelector(option: Option): void {
    this.objectLiteralPropertyArr.forEach((node) => {
      this.checkObjectLiteralProperty(node, option);
    });
  }

  private processTypePropertySelector(option: Option): void {
    this.typePropertyArr.forEach((node) => {
      this.checkTypeProperty(node, option);
    });
  }

  private processMemberLikeSelector(option: Option): void {
    this.memberLikeArr.forEach((node) => {
      this.checkMemberLike(node, option);
    });
  }

  private processMethodSelector(option: Option): void {
    this.methodArr.forEach((node) => {
      this.checkMethod(node as ts.MethodDeclaration, option);
    });
  }

  private processPropertySelector(option: Option): void {
    this.propertyArr.forEach((node) => {
      this.checkProperty(node, option);
    });
  }

  private processTypeLikeSelector(option: Option): void {
    this.typeLikeArr.forEach((node) => {
      this.checkTypeLike(node, option);
    });
  }

  private processVariableLikeSelector(option: Option): void {
    this.variableLikeArr.forEach((node) => {
      this.checkVariableLike(node, option);
    });
  }

  private processDefaultSelector(option: Option): void {
    this.defaultArr.forEach((node) => {
      this.checkDefault(node, option);
    });
  }

  private checkDefault(node: ts.Node, option: Option): void {
    let name: string;
    // 根据节点类型提取名称
    if (ts.isIdentifier(node)) {
      name = node.text;
    } else if (ts.isNumericLiteral(node)) {
      name = node.text;
    } else if (ts.isStringLiteral(node)) {
      name = node.text;
    } else {
      // 其他类型的节点
      name = node.getText();
    }
    
    let kind = this.getIdentifierKind(node);
    if (kind) {
      this.checkNaming(node, name, option, kind);
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(name, line);
    }
  }

  private getIdentifierKind(node: ts.Node): string | undefined {
    if (!node.parent) {
      return 'Default';
    }

    // 首先检查字面量类型 (数字、字符串等)
    if (ts.isNumericLiteral(node) || ts.isStringLiteral(node)) {
      return this.getLiteralNodeKind(node, node.parent);
    }

    // 只有标识符才进行下一步分析
    if (!ts.isIdentifier(node)) {
      return undefined;
    }

    // 检查是否应该跳过此节点
    if (this.shouldSkipNode(node, node.parent)) {
      return undefined;
    }

    // 按照节点类型分类处理
    return this.getIdentifierNodeKind(node, node.parent);
  }

  /**
   * 处理字面量节点类型
   */
  private getLiteralNodeKind(node: ts.Node, parent: ts.Node): string | undefined {
    if (ts.isMethodDeclaration(parent)) {
      return 'Class Method';
    }
    if (ts.isPropertyDeclaration(parent)) {
      return 'Class Property';
    }
    if (ts.isPropertyAssignment(parent)) {
      return 'Object Literal Property';
    }
    if (ts.isPropertySignature(parent)) {
      return 'Type Property';
    }
    return undefined;
  }

  /**
   * 处理标识符节点类型
   */
  private getIdentifierNodeKind(node: ts.Identifier, parent: ts.Node): string | undefined {
    // 处理对象属性和解构赋值
    const propertyKind = this.getPropertyKindIfApplicable(node, parent);
    if (propertyKind) {
      return propertyKind;
    }

    // 处理函数相关
    const functionKind = this.getFunctionKindIfApplicable(node, parent);
    if (functionKind) {
      return functionKind;
    }

    // 处理类型相关声明
    const typeKind = this.getTypeKindIfApplicable(node, parent);
    if (typeKind) {
      return typeKind;
    }

    // 处理类成员
    const memberKind = this.getClassMemberKindIfApplicable(node, parent);
    if (memberKind) {
      return memberKind;
    }

    // 处理变量和参数
    const variableKind = this.getVariableKindIfApplicable(node, parent);
    if (variableKind) {
      return variableKind;
    }

    return undefined;
  }

  /**
   * 获取属性相关的类型
   */
  private getPropertyKindIfApplicable(node: ts.Identifier, parent: ts.Node): string | undefined {
    // 处理对象字面量中的属性名
    if (ts.isPropertyAssignment(parent) && parent.name === node) {
      return 'Object Literal Property';
    }

    // 处理简写属性赋值
    if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
      return 'Object Literal Property';
    }

    // 处理属性签名
    if (ts.isPropertySignature(parent)) {
      return 'Type Property';
    }

    return undefined;
  }

  /**
   * 获取函数相关的类型
   */
  private getFunctionKindIfApplicable(node: ts.Identifier, parent: ts.Node): string | undefined {
    // 处理函数表达式的名称
    if (ts.isFunctionExpression(parent) && parent.name === node) {
      return 'Function';
    }

    // 处理函数声明
    if (ts.isFunctionDeclaration(parent)) {
      return 'Function';
    }

    // 处理方法声明
    if (ts.isMethodDeclaration(parent)) {
      return 'Class Method';
    }

    // 处理方法签名
    if (ts.isMethodSignature(parent)) {
      return 'Type Method';
    }

    return undefined;
  }

  /**
   * 获取类型相关的声明
   */
  private getTypeKindIfApplicable(node: ts.Identifier, parent: ts.Node): string | undefined {
    if (this.options === defaultOptions) {
      return undefined;
    }

    // 处理类声明
    if (ts.isClassDeclaration(parent)) {
      return 'Class';
    }

    // 处理接口声明
    if (ts.isInterfaceDeclaration(parent)) {
      return 'Interface';
    }

    // 处理类型别名
    if (ts.isTypeAliasDeclaration(parent)) {
      return 'Type Alias';
    }

    // 处理枚举声明
    if (ts.isEnumDeclaration(parent)) {
      return 'Enum';
    }

    // 处理类型参数
    if (ts.isTypeParameterDeclaration(parent)) {
      return 'Type Parameter';
    }

    return undefined;
  }

  /**
   * 获取类成员相关的类型
   */
  private getClassMemberKindIfApplicable(node: ts.Identifier, parent: ts.Node): string | undefined {
    // 处理枚举成员
    if (ts.isEnumMember(parent)) {
      return 'Enum Member';
    }

    // 处理属性声明
    if (ts.isPropertyDeclaration(parent)) {
      return 'Class Property';
    }

    // 处理访问器
    if (ts.isGetAccessor(parent)) {
      return 'Getter';
    }
    if (ts.isSetAccessor(parent)) {
      return 'Setter';
    }

    return undefined;
  }

  /**
   * 获取变量和参数相关的类型
   */
  private getVariableKindIfApplicable(node: ts.Identifier, parent: ts.Node): string | undefined {
    // 处理变量声明
    if (ts.isVariableDeclaration(parent) && this.options !== defaultOptions) {
      return 'Variable';
    }

    // 处理参数
    if (ts.isParameter(parent) && !ts.isIndexSignatureDeclaration(node.parent)) {
      if (ts.isMethodDeclaration(parent.parent)) {
        return 'Method Parameter';
      }
      return 'Parameter';
    }

    // 处理解构赋值中的变量
    if (ts.isBindingElement(parent) && parent.name === node) {
      return 'Variable';
    }

    // 处理导入
    if ((ts.isImportSpecifier(parent) || ts.isImportClause(parent)) && this.options !== defaultOptions) {
      return 'Import';
    }

    // 处理默认导入名称
    if (ts.isImportClause(parent) && parent.name === node && this.options !== defaultOptions) {
      return 'Import';
    }

    return undefined;
  }

  private shouldSkipNode(node: ts.Node, parent: ts.Node): boolean {
    if (ts.isParameter(parent) && ts.isIdentifier(parent.name) && parent.name.text === '_') {
      return true;
    }
    
    if (ts.isParameter(parent) && this.isInGlobalTypeDeclaration(parent)) {
      return true;
    }

    if (ts.isParameter(parent) && parent.parent && ts.isIndexSignatureDeclaration(parent.parent)) {
      return true;
    }

    if (ts.isEnumMember(parent) && parent.initializer && node !== parent.name) {
      return true;
    }
    
    if (ts.isPropertyDeclaration(parent) && parent.initializer && node !== parent.name) {
      return true;
    }
    
    if (ts.isVariableDeclaration(parent) && parent.initializer && node !== parent.name) {
      return true;
    }
    
    return false;
  }

  private checkVariable(node: ts.VariableDeclaration, option: Option): void {
    // 处理普通变量声明
    if (ts.isIdentifier(node.name)) {
      this.checkNaming(node, node.name.text, option, 'Variable');
      if (!option.prefix && !option.suffix) {
        const [line, character] = this.getNodePosition(node);
        this.checkParamMap.set(node.name.text, line);
      }
    }
    // 处理对象解构模式
    else if (ts.isObjectBindingPattern(node.name)) {
      this.checkObjectBindingPattern(node.name, option);
    }
    // 处理数组解构模式
    else if (ts.isArrayBindingPattern(node.name)) {
      this.checkArrayBindingPattern(node.name, option);
    }
  }

  /**
   * 检查对象解构模式中的变量命名
   * @param pattern 对象解构模式
   * @param option 命名选项
   */
  private checkObjectBindingPattern(pattern: ts.ObjectBindingPattern, option: Option): void {
    if (!pattern || !pattern.elements) {
      return;
    }

    pattern.elements.forEach(element => this.processBindingElement(element, option));
  }

  /**
   * 处理单个解构绑定元素
   * @param element 绑定元素
   * @param option 命名选项
   */
  private processBindingElement(element: ts.BindingElement, option: Option): void {
    if (!ts.isBindingElement(element)) {
      return;
    }

    // 处理标识符名称
    if (ts.isIdentifier(element.name)) {
      this.processIdentifierBinding(element, option);
      return;
    }

    // 处理嵌套对象解构
    if (ts.isObjectBindingPattern(element.name)) {
      this.checkObjectBindingPattern(element.name, option);
      return;
    }

    // 处理嵌套数组解构
    if (ts.isArrayBindingPattern(element.name)) {
      this.checkArrayBindingPattern(element.name, option);
    }
  }

  /**
   * 处理解构绑定中的标识符
   * @param element 包含标识符的绑定元素
   * @param option 命名选项
   */
  private processIdentifierBinding(element: ts.BindingElement, option: Option): void {
    if (!ts.isIdentifier(element.name)) {
      return;
    }

    const identifierName = element.name.text;
    const nodeToCheck = element.propertyName ? element : element.name;
    
    // 检查变量名称是否符合命名规范
    this.checkNaming(nodeToCheck, identifierName, option, 'Variable');
    
    // 记录已检查的变量位置，避免重复检查
    const [line] = this.getNodePosition(nodeToCheck);
    this.checkParamMap.set(identifierName, line);
  }

  /**
   * 检查数组解构模式中的变量命名
   * @param pattern 数组解构模式
   * @param option 命名选项
   */
  private checkArrayBindingPattern(pattern: ts.ArrayBindingPattern, option: Option): void {
    if (!pattern || !pattern.elements) {
      return;
    }

    pattern.elements.forEach(element => {
      // 跳过省略的表达式（如 [a,,c] 中的空位）
      if (ts.isBindingElement(element)) {
        this.processBindingElement(element, option);
      }
    });
  }

  private checkFunction(
    node: ts.FunctionDeclaration | ts.FunctionExpression,
    option: Option
  ): void {
    if (node.name && ts.isIdentifier(node.name)) {
      this.checkNaming(node, node.name.text, option, 'Function');
      if (!option.prefix && !option.suffix) {
        const [line, character] = this.getNodePosition(node);
        this.checkParamMap.set(node.name.text, line);
      }
    }
  }

  private checkParameter(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'Parameter');
    const [line, character] = this.getNodePosition(node);
    this.checkParamMap.set(node.getText(), line);
  }

  private checkProperty(node: ts.Node, option: Option): void {
    const kind = this.getPropertyKind(node);
    if (ts.isPropertyDeclaration(node)) {
      this.checkNaming(node, node.name.getText(), option, kind);
      this.propertyArr.push(node);
    }
    const name = ts.isIdentifier(node) ? node.text : node.getText();
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(name, line);
    }
  }

  private getPropertyKind(node: ts.Node): string {
    if (ts.isPropertyDeclaration(node) && ts.isClassDeclaration(node.parent)) {
        return 'Class Property';
    }
    
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
        return 'Object Literal Property';
    }
    
    if (ts.isPropertySignature(node)) {
        return 'Type Property';
    }
    
    return 'Property';
  }

  private checkParameterProperty(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'ParameterProperty');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkMethod(node: ts.MethodDeclaration, option: Option): void {
    if (ts.isIdentifier(node.name)) {
      const kind = this.getMethodKind(node);
      this.checkNaming(node, node.name.text, option, kind);
      if (!option.prefix && !option.suffix) {
        const [line, character] = this.getNodePosition(node);
        this.checkParamMap.set(node.name.text, line);
      }
    }
  }

  private getMethodKind(node: ts.MethodDeclaration): string {
    if (ts.isClassDeclaration(node.parent)) {
        return 'Class Method';
    }
    
    if (ts.isObjectLiteralExpression(node.parent)) {
        return 'Object Literal Method';
    }
    
    if (ts.isInterfaceDeclaration(node.parent) || ts.isTypeLiteralNode(node.parent)) {
        return 'Type Method';
    }
    
    return 'Method';
  }

  private checkAccessor(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'Accessor');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkEnumMember(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'EnumMember');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkClass(node: ts.ClassDeclaration, option: Option): void {
    if (node.name) {
      this.checkNaming(node, node.name.text, option, 'Class');
      if (!option.prefix && !option.suffix) {
        const [line, character] = this.getNodePosition(node);
        this.checkParamMap.set(node.name.text, line);
      }
    }
  }

  private checkInterface(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'Interface');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkTypeAlias(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'TypeAlias');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkEnum(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'Enum');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkTypeParameter(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'TypeParameter');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkMemberLike(node: ts.Node, option: Option): void {
    let kind = this.getMemberLikeKind(node);
    let name = this.getMemberName(node);
    
    if (name) {
        this.checkNaming(node, name, option, kind);
        if (!option.prefix && !option.suffix) {
            const [line, character] = this.getNodePosition(node);
            this.checkParamMap.set(name, line);
        }
    }
  }

  private getMemberLikeKind(node: ts.Node): string {
    if (ts.isGetAccessor(node)) {
        return 'Accessor';
    }
    if (ts.isSetAccessor(node)) {
        return 'Accessor';
    }

    if (ts.isEnumMember(node)) {
        return 'Enum Member';
    }

    if (ts.isMethodDeclaration(node)) {
        if (ts.isClassDeclaration(node.parent)) {
            return 'Class Method';
        }
        if (ts.isObjectLiteralExpression(node.parent)) {
            return 'Object Literal Method';
        }
        return 'Method';
    }

    if (ts.isParameter(node) && node.parent && ts.isConstructorDeclaration(node.parent)) {
        return 'Parameter Property';
    }

    if (ts.isPropertyDeclaration(node)) {
        if (ts.isClassDeclaration(node.parent)) {
            return 'Class Property';
        }
        return 'Property';
    }
    if (ts.isPropertyAssignment(node)) {
        return 'Object Literal Property';
    }
    if (ts.isPropertySignature(node)) {
        return 'Type Property';
    }

    return 'MemberLike';
  }

  private getMemberName(node: ts.Node): string | undefined {
    if (ts.isIdentifier(node)) {
        return node.text;
    }
    
    if ('name' in node) {
        const name = (node as any).name;
        if (ts.isIdentifier(name)) {
            return name.text;
        }
        if (ts.isPrivateIdentifier(name)) {
            return name.text;
        }
    }
    
    return node.getText();
  }

  private checkTypeLike(node: ts.Node, option: Option): void {
    const kind = this.getTypeLikeKind(node);
    let name = this.getTypeLikeName(node);
    
    if (name) {
        this.checkNaming(node, name, option, kind);
        if (!option.prefix && !option.suffix) {
            const [line, character] = this.getNodePosition(node);
            this.checkParamMap.set(name, line);
        }
    }
  }

  private getTypeLikeKind(node: ts.Node): string {
    if (ts.isClassDeclaration(node)) {
        return 'Class';
    }
    
    if (ts.isEnumDeclaration(node)) {
        return 'Enum';
    }
    
    if (ts.isInterfaceDeclaration(node)) {
        return 'Interface';
    }
    
    if (ts.isTypeAliasDeclaration(node)) {
        return 'Type Alias';
    }
    
    if (ts.isTypeParameterDeclaration(node)) {
        return 'Type Parameter';
    }
    
    return 'TypeLike';
  }

  private getTypeLikeName(node: ts.Node): string | undefined {
    if (ts.isClassDeclaration(node) || 
        ts.isInterfaceDeclaration(node) || 
        ts.isTypeAliasDeclaration(node) || 
        ts.isEnumDeclaration(node)) {
        return node.name?.text;
    }
    
    if (ts.isTypeParameterDeclaration(node)) {
        return node.name.text;
    }
    
    return node.getText();
  }

  private checkVariableLike(node: ts.Node, option: Option): void {
    const kind = this.getVariableLikeKind(node);
    const name = ts.isIdentifier(node) ? node.text : node.getText();
    
    this.checkNaming(node, name, option, kind);
    if (!option.prefix && !option.suffix) {
        const [line, character] = this.getNodePosition(node);
        this.checkParamMap.set(name, line);
    }
  }

  private getVariableLikeKind(node: ts.Node): string {
    if (ts.isFunctionDeclaration(node)) {
        return 'Function';
    }
    
    if (ts.isParameter(node)) {
        if (ts.isMethodDeclaration(node.parent)) {
            return 'Method Parameter';
        }
        if (ts.isFunctionDeclaration(node.parent)) {
            return 'Function Parameter';
        }
        return 'Parameter';
    }
    
    if (ts.isVariableDeclaration(node)) {
        return 'Variable';
    }
    
    return 'VariableLike';
  }

  private checkClassMethod(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'ClassMethod');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkObjectLiteralMethod(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'ObjectLiteralMethod');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkTypeMethod(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'TypeMethod');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkClassProperty(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'ClassProperty');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkObjectLiteralProperty(node: ts.Node, option: Option): void {
    this.checkNaming(node, node.getText(), option, 'ObjectLiteralProperty');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), line);
    }
  }

  private checkTypeProperty(node: ts.PropertySignature, option: Option): void {
    this.checkNaming(node, node.name.getText(), option, 'TypeProperty');
    if (!option.prefix && !option.suffix) {
      const [line, character] = this.getNodePosition(node);
      this.checkParamMap.set(node.name.getText(), line);
    }
  }

  private checkModifiers(node: ts.Node, option: Option): boolean {
    if (!option.modifiers || option.modifiers.length === 0) {
        return true;
    }

    const nodeModifiers = ts.canHaveModifiers(node)
        ? ts.getModifiers(node)
        : undefined;
    const modifierKinds = new Set(
        nodeModifiers?.map((modifier) => modifier.kind)
    );

    return option.modifiers.every((modifier) => 
        this.checkSingleModifier(node, modifier, modifierKinds));
  }

  private checkSingleModifier(
    node: ts.Node, 
    modifier: Modifier, 
    modifierKinds: Set<number>
  ): boolean {
    switch (modifier) {
        case 'abstract':
        case 'async':
        case 'exported':
        case 'private':
        case 'protected':
        case 'readonly':
        case 'static':
            return this.checkSimpleModifier(modifier, modifierKinds);
        case 'const':
            return this.checkConstModifier(node);
        case 'global':
            return this.checkGlobalModifier(node);
        case '#private':
            return this.checkPrivateIdentifier(node);
        case 'public':
            return this.checkPublicModifier(modifierKinds);
        case 'unused':
            return this.checkUnusedModifier(node);
        default:
            return true;
    }
  }

  private checkSimpleModifier(modifier: Modifier, modifierKinds: Set<number>): boolean {
    const modifierMap: { [key in Modifier]?: number } = {
        'abstract': ts.SyntaxKind.AbstractKeyword,
        'async': ts.SyntaxKind.AsyncKeyword,
        'exported': ts.SyntaxKind.ExportKeyword,
        'private': ts.SyntaxKind.PrivateKeyword,
        'protected': ts.SyntaxKind.ProtectedKeyword,
        'readonly': ts.SyntaxKind.ReadonlyKeyword,
        'static': ts.SyntaxKind.StaticKeyword
    };
    
    const syntaxKind = modifierMap[modifier];
    return syntaxKind ? modifierKinds.has(syntaxKind) : false;
  }

  private checkConstModifier(node: ts.Node): boolean {
    return ts.isVariableDeclaration(node) &&
        node.parent &&
        ts.isVariableDeclarationList(node.parent) &&
        !!(node.parent.flags & ts.NodeFlags.Const);
  }

  private checkGlobalModifier(node: ts.Node): boolean {
    return !node.parent || ts.isSourceFile(node.parent);
  }

  private checkPrivateIdentifier(node: ts.Node): boolean {
    return ts.isPrivateIdentifier(node);
  }

  private checkPublicModifier(modifierKinds: Set<number>): boolean {
    return modifierKinds.has(ts.SyntaxKind.PublicKeyword) ||
        !(modifierKinds.has(ts.SyntaxKind.PrivateKeyword) ||
          modifierKinds.has(ts.SyntaxKind.ProtectedKeyword));
  }

  private checkUnusedModifier(node: ts.Node): boolean {
    if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
        return !this.findNodeReferences(node, node.parent);
    }
    return true;
  }

  private checkTypes(node: ts.Node, option: Option): boolean {
    if (!option.types || option.types.length === 0) {
      return true;
    }

    const nodeType = this.getNodeType(node);
    if (!nodeType) return false;

    return option.types.some((typeOption) => {
      switch (typeOption) {
        case 'array':
          return this.isArrayType(node);
        case 'boolean':
          return this.isBooleanType(node);
        case 'function':
          return this.isFunctionType(node);
        case 'number':
          return this.isNumberType(node);
        case 'string':
          return this.isStringType(node);
        default:
          return false;
      }
    });
  }

  private findNodeReferences(node: ts.Node, scope: ts.Node): boolean {
    let found = false;
    
    function visit(n: ts.Node): void {
      if (found) {
        return;
      }
      
      if (ts.isIdentifier(n) && n !== node && n.text === (node as any).name?.text) {
        found = true;
        return;
      }
      
      ts.forEachChild(n, visit);
    }
    
    ts.forEachChild(scope, visit);
    return found;
  }

  private getNodeType(node: ts.Node): string | undefined {
    if (ts.isVariableDeclaration(node) && node.type) {
      return node.type.getText();
    }
    
    if (ts.isParameter(node) && node.type) {
      return node.type.getText(); 
    }
    
    if (ts.isPropertyDeclaration(node) && node.type) {
      return node.type.getText();
    }
    
    return undefined;
  }

  private isArrayType(node: ts.Node): boolean {
    const type = this.getNodeType(node);
    return type ? /Array<.*>|.*\[\]/.test(type) : false;
  }

  private isBooleanType(node: ts.Node): boolean {
    const type = this.getNodeType(node);
    return type === 'boolean';
  }

  private isFunctionType(node: ts.Node): boolean {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || 
        ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      return true;
    }
    const type = this.getNodeType(node);
    return type ? /\=\>/.test(type) || type.startsWith('Function') : false;
  }

  private isNumberType(node: ts.Node): boolean {
    const type = this.getNodeType(node);
    return type === 'number';
  }

  private isStringType(node: ts.Node): boolean {
    const type = this.getNodeType(node);
    return type === 'string';
  }

  private checkNaming(
    node: ts.Node,
    name: string,
    config: Option,
    kind: string
  ) {
    const identifier = name.split(':')[0].trim();
    name = identifier;
    const line = this.getNodePosition(node)[0];
    const character = node.getText();
    const violations: string[] = [];
    const isCopy = this.selectors.some(
      (item, index) => this.selectors.indexOf(item) !== index
    );

    if (this.isAlreadyChecked(character, line)) {
      return;
    }

    this.runNamingChecks(
      node, name, config, kind, isCopy, character, line, violations
    );

    if (violations.length > 0) {
      this.handleViolations(node, violations);
    }
  }

  private runNamingChecks(node: ts.Node, name: string, config: Option, kind: string,
    isCopy: boolean, character: string, line: number, violations: string[]): void {
    const checks = [
      {
        condition: (): boolean | undefined => config.types && config.types.length > 0,
        check: (): boolean => this.checkTypesCondition(node, config)
      },
      {
        condition: (): boolean | undefined => config.modifiers && config.modifiers.length > 0,
        check: (): boolean => this.checkModifiersCondition(node, config)
      },
      {
        condition: (): boolean => !!config.custom, check: (): boolean => this.checkCustomRegex(name, config, kind, violations)
      },
      {
        condition: (): boolean => !!config.filter, check: (): boolean => this.checkFilter(name, config, kind, violations)
      },
      {
        condition: (): boolean => !!config.leadingUnderscore,
        check: (): boolean => this.checkLeadingUnderscore(name, config, kind, violations)
      },
      {
        condition: (): boolean => !!config.trailingUnderscore,
        check: (): boolean => this.checkTrailingUnderscore(name, config, kind, violations)
      },
      {
        condition: (): boolean => !!config.prefix?.length,
        check: (): boolean => this.checkPrefix(node, name, config, kind, isCopy, character, line, violations)
      },
      {
        condition: (): boolean => !!config.suffix?.length,
        check: (): boolean => this.checkSuffix(node, name, config, kind, isCopy, character, line, violations)
      },
      {
        condition: (): boolean => !!config.format?.length,
        check: (): boolean => {
          this.checkFormat(name, config, kind, isCopy, violations);
          return false;
        }
      }
    ];

    for (const { condition, check } of checks) {
      if (condition() && check()) {
        break;
      }
    }
  }

  private isAlreadyChecked(character: string, line: number): boolean {
    let isChecked = false;
    this.checkParamMap.forEach((value, key) => {
      if (key === character && value === line) {
        isChecked = true;
      }
    });
    return isChecked;
  }

  private checkTypesCondition(node: ts.Node, config: Option): boolean {
    return !this.checkTypes(node, config);
  }

  private checkModifiersCondition(node: ts.Node, config: Option): boolean {
    return !this.checkModifiers(node, config);
  }

  private checkCustomRegex(name: string, config: Option, kind: string, violations: string[]): boolean {
    try {
      if (!config.custom) {
        return false;
      }
      
      const customRegex = new RegExp(config.custom.regex);
      const matchesCustom = customRegex.test(name);
      
      if (config.custom.match) {
        if (!matchesCustom) {
          violations.push(
            `${kind} name '${name}' Must match custom pattern: ${config.custom.regex}`
          );
          return true;
        }
      } else {
        if (matchesCustom) {
          violations.push(
            `${kind} name '${name}' Must not match custom pattern: ${config.custom.regex}`
          );
          return true;
        }
      }
      return false;
    } catch (e) {
      violations.push(
        `${kind} name '${name}' Invalid custom regex pattern: ${config.custom?.regex || 'unknown'}`
      );
      return true;
    }
  }

  private checkFilter(name: string, config: Option, kind: string, violations: string[]): boolean {
    try {
      if (!config.filter) {
        return false;
      }
      
      let filterMatch = true;
      if (typeof config.filter === 'string') {
        const filterRegex = new RegExp(config.filter);
        filterMatch = filterRegex.test(name);
        return filterMatch;
      } else {
        let isNeedMatch = config.filter.match;
        const filterRegex = new RegExp(config.filter.regex);
        filterMatch = filterRegex.test(name);
        if (isNeedMatch) {
          return !filterMatch;
        } else {
          return filterMatch;
        }
      }
    } catch (e) {
      violations.push(`${kind} name '${name}' Invalid filter regex pattern`);
      return true;
    }
  }

  private checkLeadingUnderscore(name: string, config: Option, kind: string, violations: string[]): boolean {
    if (!config.leadingUnderscore) {
      return false;
    }
    const hasLeadingUnderscore = /^_/.test(name);
    const hasDoubleLeadingUnderscore = /^__/.test(name);
    switch (config.leadingUnderscore) {
      case 'forbid':
        if (hasLeadingUnderscore) {
          violations.push(
            `${kind} name '${name}' Leading underscore is forbidden`
          );
          return true;
        }
        break;
      case 'require':
        if (!hasLeadingUnderscore || hasDoubleLeadingUnderscore) {
          violations.push(
            `${kind} name '${name}' Single leading underscore is required`
          );
          return true;
        }
        break;
      case 'requireDouble':
        if (!hasDoubleLeadingUnderscore) {
          violations.push(
            `${kind} name '${name}' Double leading underscore is required`
          );
          return true;
        }
        break;
      case 'allowDouble':
        if (hasLeadingUnderscore && !hasDoubleLeadingUnderscore) {
          violations.push(
            `${kind} name '${name}' Only double leading underscore is allowed`
          );
          return true;
        }
        break;
    }
    
    return false;
  }

  private checkTrailingUnderscore(name: string, config: Option, kind: string, violations: string[]): boolean {
    if (!config.trailingUnderscore) { 
      return false; 
    }
    const hasTrailingUnderscore = /_$/.test(name);
    const hasDoubleTrailingUnderscore = /__$/.test(name);
    switch (config.trailingUnderscore) {
      case 'forbid':
        if (hasTrailingUnderscore) {
          violations.push(`${kind} name '${name}' Trailing underscore is forbidden`);
          return true;
        }
        break;
      case 'require':
        if (!hasTrailingUnderscore || hasDoubleTrailingUnderscore) {
          violations.push(`${kind} name '${name}' Single trailing underscore is required`);
          return true;
        }
        break;
      case 'requireDouble':
        if (!hasDoubleTrailingUnderscore) {
          violations.push(`${kind} name '${name}' Double trailing underscore is required`);
          return true;
        }
        break;
      case 'allowDouble':
        if (hasTrailingUnderscore && !hasDoubleTrailingUnderscore) {
          violations.push(`${kind} name '${name}' Only double trailing underscore is allowed`);
          return true;
        }
        break;
    }
    
    return false;
  }

  private checkPrefix(
    node: ts.Node, 
    name: string, 
    config: Option, 
    kind: string, 
    isCopy: boolean, 
    character: string, 
    line: number, 
    violations: string[]
  ): boolean {
    if (!config.prefix?.length) { 
      return false;
    }
    const prefixArr = config.prefix;
    let isChecked = this.isAlreadyChecked(character, line);
    if (isChecked) { 
      return true; 
    }
    if (!node.flags) {
       return false; 
    }
    const valueName = name;
    let hasPrefix: Boolean = false;
    if (isCopy) {
      this.ruleConfigs.prefixes.forEach((prefix) => {
        if (valueName.startsWith(prefix)) {
          hasPrefix = true;
        }
      });
      prefixArr.forEach((prefix) => {
        if (valueName.startsWith(prefix)) {
          hasPrefix = true;
        }
      });
    } else {
      prefixArr.forEach((prefix) => {
        if (valueName.startsWith(prefix)) {
          hasPrefix = true;
        }
      });
    }
    if (!hasPrefix) {
      violations.push(`${kind} name '${name}' '${config.prefix}' Must start with one of: ${prefixArr.join(', ')}`);
      this.checkParamMap.set(node.getText(), line);
      return true;
    }
    if (config.types && hasPrefix) {
      const [newLine, newCharacter] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), newLine);
    }
    return false;
  }

  private checkSuffix(
    node: ts.Node, 
    name: string, 
    config: Option, 
    kind: string, 
    isCopy: boolean, 
    character: string, 
    line: number, 
    violations: string[]
  ): boolean {
    if (!config.suffix?.length) {
      return false; 
    }
    const suffixArr = config.suffix;
    let isChecked = this.isAlreadyChecked(character, line);
    if (isChecked) {
      return true; 
    }
    if (!node.flags) {
      return false;
    }
    const valueName = name;
    let hasSuffix: Boolean = false;

    if (isCopy) {
      this.ruleConfigs.suffixes.forEach((suffix) => {
        if (valueName.endsWith(suffix)) {
          hasSuffix = true;
        }
      });
      suffixArr.forEach((suffix) => {
        if (valueName.endsWith(suffix)) {
          hasSuffix = true;
        }
      });
    } else {
      suffixArr.forEach((suffix) => {
        if (valueName.endsWith(suffix)) {
          hasSuffix = true;
        }
      });
    }
    if (!hasSuffix) {
      violations.push(`${kind} name '${name}' Must end with one of: ${suffixArr.join(', ')}`);
      this.checkParamMap.set(node.getText(), line);
      return true;
    }
    if (config.types && hasSuffix) {
      const [newLine, newCharacter] = this.getNodePosition(node);
      this.checkParamMap.set(node.getText(), newLine);
    }
    return false;
  }

  private checkFormat(name: string, config: Option, kind: string, isCopy: boolean, violations: string[]): void {
    if (!config.format?.length) {
      return;
    }
    let nameWithoutAffixes = name.replace(/^_+|_+$/g, '');
    if (config.prefix && config.prefix.length > 0) {
      const prefixesArr = [...this.ruleConfigs.prefixes, ...config.prefix];
      for (const prefix of prefixesArr) {
        if (nameWithoutAffixes.startsWith(prefix)) {
          nameWithoutAffixes = nameWithoutAffixes.slice(prefix.length);
          break;
        }
      }
    }
    if (config.suffix && config.suffix.length > 0) {
      for (const suffix of this.ruleConfigs.suffixes) {
        if (nameWithoutAffixes.endsWith(suffix)) {
          nameWithoutAffixes = nameWithoutAffixes.slice(0, -suffix.length);
          break;
        }
      }
    }
    const formatRegex: { [key in Format]: RegExp } = {
      camelCase: /^[a-z][a-zA-Z0-9]*$/,
      strictCamelCase: /^[a-z](?:(?:[a-z0-9]*?[A-Z](?<![A-Z]))?[a-z0-9]*)*$/,
      PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
      StrictPascalCase: /^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/,
      snake_case: /^[a-z]+(_[a-z0-9]+)*$/,
      UPPER_CASE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
    };
    let formatMatches = false;
    if (isCopy) {
      const formats = [...config.format, ...this.formats];
      if (formats.length > this.formats.length) {
        formatMatches = formats.some((format) =>
          formatRegex[format].test(nameWithoutAffixes)
        );
      }
    } else {
      formatMatches = config.format.some((format) =>
        formatRegex[format].test(nameWithoutAffixes)
      );
    }
    if (!formatMatches) {
      this.addFormatViolation(violations, kind, name, nameWithoutAffixes, config);
    }
  }

  private addFormatViolation(violations: string[], kind: string, name: string, nameWithoutAffixes: string, config: Option): void {
    const formats = config.format?.join(', ') || [];
    if (/__$/.test(name)) {
      violations.push(`${kind} name ${'`'}${name}${'`'} trimmed as ${'`_'}${nameWithoutAffixes}${'_`'} must match one of the following formats: ${formats}`);
    } else {
      violations.push(`${kind} name ${'`'}${name}${'`'} must match one of the following formats: ${formats}`);
    }
  }

  private handleViolations(node: ts.Node, violations: string[]): void {
    const position = this.getNodePosition(node);
    const line = position[0];
    const column = position[1];
    const endColumn = node.getEnd();

    violations.forEach((violation) => {
      const description = `${violation}`;
      const severity = this.rule.alert ?? this.metaData.severity;
      const fileName = this.currentArkFile?.getFilePath() ?? '';

      const defect = new Defects(
        line,
        column,
        endColumn,
        `${description}`,
        severity,
        this.rule.ruleId,
        fileName,
        this.metaData.ruleDocPath,
        true,
        false,
        false
      );

      this.issues.push(new IssueReport(defect, undefined));
      RuleListUtil.push(defect);
    });
  }

  private getNodePosition(node: ts.Node): [number, number] {
    if (!this.currentArkFile || !node.getSourceFile()) {
      return [0, 0];
    }
    
    const sourceFile = node.getSourceFile();
    const pos = this.getNodeStartPosition(node, sourceFile);
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
    
    // TypeScript 行列从0开始，显示时从1开始
    return [line + 1, character + 1];
  }

  /**
   * 获取节点的起始位置
   * @param node 当前节点
   * @param sourceFile 源文件
   * @returns 节点起始位置
   */
  private getNodeStartPosition(node: ts.Node, sourceFile: ts.SourceFile): number {
    // 处理声明类节点
    if (this.isTypeDeclarationNode(node)) {
      return this.getNamedDeclarationPosition(node as ts.NamedDeclaration);
    }
    
    // 处理各种方法、函数和属性节点
    if (this.isMethodOrPropertyNode(node)) {
      return this.getNamedDeclarationPosition(node as ts.NamedDeclaration);
    }
    
    // 处理变量声明和参数节点
    if (ts.isVariableDeclaration(node)) {
      return node.name.getStart();
    }
    
    if (ts.isParameter(node)) {
      return ts.isIdentifier(node.name) ? node.name.getStart() : node.getStart();
    }
    
    // 处理绑定元素（解构赋值）
    if (ts.isBindingElement(node)) {
      return this.getBindingElementPosition(node, sourceFile);
    }
    
    // 处理标识符节点
    if (ts.isIdentifier(node)) {
      return node.getStart();
    }
    
    // 其他类型的节点
    return node.getStart();
  }

  /**
   * 检查节点是否为类型声明节点（类、接口、枚举、类型别名）
   */
  private isTypeDeclarationNode(node: ts.Node): boolean {
    return ts.isClassDeclaration(node) || 
           ts.isInterfaceDeclaration(node) || 
           ts.isEnumDeclaration(node) || 
           ts.isTypeAliasDeclaration(node);
  }

  /**
   * 检查节点是否为方法或属性相关节点
   */
  private isMethodOrPropertyNode(node: ts.Node): boolean {
    return ts.isMethodDeclaration(node) || 
           ts.isFunctionDeclaration(node) ||
           ts.isPropertyDeclaration(node) || 
           ts.isGetAccessor(node) || 
           ts.isSetAccessor(node);
  }

  /**
   * 获取命名声明节点的位置
   */
  private getNamedDeclarationPosition(node: ts.NamedDeclaration): number {
    return node.name?.getStart() ?? node.getStart();
  }

  /**
   * 获取绑定元素（解构赋值）的位置，特别处理重命名变量
   */
  private getBindingElementPosition(node: ts.BindingElement, sourceFile: ts.SourceFile): number {
    let pos = node.name.getStart();
    
    // 处理重命名变量，如 { a: b } 中的 b
    if (node.propertyName) {
      pos = this.findRenamedBindingPosition(node, sourceFile);
    }
    
    return pos;
  }

  /**
   * 查找重命名绑定变量的实际位置
   * 例如对于 { a: b } 要找到 b 的实际位置
   */
  private findRenamedBindingPosition(node: ts.BindingElement, sourceFile: ts.SourceFile): number {
    // 确保propertyName存在
    if (!node.propertyName) {
      return node.name.getStart();
    }
    
    const fullText = sourceFile.getFullText();
    const propertyEnd = node.propertyName.getEnd();
    
    // 跳过冒号和空格，找到实际变量名开始的位置
    let offset = propertyEnd;
    
    // 跳过冒号和紧随其后的空格
    while (offset < fullText.length && (fullText[offset] === ' ' || fullText[offset] === ':')) {
      offset++;
    }
    
    // 继续跳过更多空格
    while (offset < fullText.length && fullText[offset] === ' ') {
      offset++;
    }
    
    return offset;
  }

  /**
   * 收集解构赋值模式中的变量名
   * @param pattern 解构赋值模式
   */
  private collectDestructuringNames(pattern: ts.BindingPattern): void {
    pattern.elements.forEach(element => {
      if (ts.isBindingElement(element)) {
        // 处理对象解构中的重命名，如 { a: b } 中的 b
        if (ts.isIdentifier(element.name)) {
          this.defaultArr.push(element.name);
        } 
        // 递归处理嵌套解构，如 { a: { b } }
        else if (ts.isObjectBindingPattern(element.name) || ts.isArrayBindingPattern(element.name)) {
          this.collectDestructuringNames(element.name);
        }
      }
    });
  }

  private isInGlobalTypeDeclaration(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    let inTypeDeclaration = false;
    let inGlobalScope = false;
    
    while (current && !inTypeDeclaration) {
        if (ts.isTypeLiteralNode(current) || 
            ts.isTypeAliasDeclaration(current) || 
            ts.isFunctionTypeNode(current)) {
            inTypeDeclaration = true;
        }
        current = current.parent;
    }
    
    if (inTypeDeclaration && current) {
        while (current) {
            if (ts.isModuleDeclaration(current) && 
                ts.isIdentifier(current.name) && 
                current.name.text === 'global') {
                inGlobalScope = true;
                break;
            }
            current = current.parent;
        }
    }
    
    return inTypeDeclaration && inGlobalScope;
  }
}