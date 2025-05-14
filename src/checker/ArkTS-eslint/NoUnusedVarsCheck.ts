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

import {
  ArkMethod,
  ClassSignature,
  MethodSignature,
  Stmt,
  ArkAssignStmt,
  Local,
  ArkInvokeStmt,
  ts,
  AstTreeUtils,
  ArkFile,
  ArkNamespace,
  Value,
  FieldSignature,
  AbstractBinopExpr,
  ArkReturnStmt,
  AbstractInvokeExpr,
  ArkIfStmt,
  FunctionType,
  ArkInstanceInvokeExpr,
  ExportInfo,
  ClassType,
  FullPosition,
  LineColPosition,
  ArkThrowStmt,
} from 'arkanalyzer/lib';
import { NoUnusedVarsCheckUtils } from '../../utils/checker/ArkTSEslintUtils/NoUnusedVarsCheckUtils';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { RuleListUtil } from '../../utils/common/DefectsList';
import {
  FileMatcher,
  MatcherCallback,
  MatcherTypes,
} from '../../matcher/Matchers';
import { CheckerUtils } from '../../utils/checker/CheckerUtils';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { CommentsMetadata } from 'arkanalyzer/lib/core/model/ArkMetadata';
type Var_base = {
  name?: string;
  type?: { name?: string };
  usedStmts?: Stmt[];
  declaringStmt?: Stmt;
};
const leftNameReg = /\[|\]/g;
const objectArrayPatternsReg = /(\w+):\s*(\[[^\]]+\])/g;
const arrayElementsReg = /^\[|\]$/g;
const findModifierReg = /^\s*(public|private|protected|readonly)\b/;
const exceGlobalReg = /\/\*\s*global\s+(.+?)\s*\*\//i;
type Method_Param = {
  arrayElements?: { name?: string }[];
  name: string;
  objElements: [];
};
enum VarType {
  Var = 'var',
  Class = 'class',
  Import = 'import',
  Method = 'method',
  Type = 'type',
  Args = 'args',
  ArgsP = 'ArrayBindingPattern',
  Catch = 'catch',
  Static = 'static',
  UsedIgnorePattern = 'UsedIgnorePattern',
}
type noUseVars = {
  varType: VarType; //方法名称
  stmt?: Stmt;
  arkClass?: ArkClass; //获取类信息
  arkNamespace?: ArkNamespace; //命名空间信息
  declareStmt?: Stmt; //有方法或者类不能固定
  name: string | string[]; //解构-特殊情况
  local?: 'local' | 'all'; //本地或者全局
  isMethodParam?: boolean; //是否是方法参数
  arkMethod?: ArkMethod; //方便获取方法的位置信息20250207
  isRestSiblings?: boolean; //是否与解构同级
  methodName?: string; //方法名称
  parammaxUsedIndex?: number; //被使用最大参数下标
  paramIndex?: number; //用于方法参数的判定
  static?: boolean; //是否是静态
  varInit?: boolean; //2025-02-07 优化方案
  ArrayBindingPattern?: boolean;
  argPosion?: [lineNo: number, strClo: number, endClo: number]; //记录缺失的位置信息
  filePath?: string; //参数stmt不包含
  isAll?: boolean; //注释标明global
};
type Options =
  | 'all'
  | 'local'
  | {
      args?: 'after-used' | 'all' | 'none';
      argsIgnorePattern?: string;
      caughtErrors?: 'all' | 'none';
      caughtErrorsIgnorePattern?: string;
      destructuredArrayIgnorePattern?: string;
      ignoreClassWithStaticInitBlock?: boolean;
      ignoreRestSiblings?: boolean;
      reportUsedIgnorePattern?: boolean;
      vars?: 'all' | 'local';
      varsIgnorePattern?: string;
    };
//对参数进行解释
interface TranslatedOptions {
  args: 'after-used' | 'all' | 'none'; //检查使用之后的----全部----不检查
  argsIgnorePattern?: RegExp; //忽略特定格式函数参数
  caughtErrors: 'all' | 'none'; //处理捕获的错误
  caughtErrorsIgnorePattern?: RegExp; //忽略特定
  destructuredArrayIgnorePattern?: RegExp; //忽略解构数组
  ignoreClassWithStaticInitBlock: boolean; //忽略静态代码块
  ignoreRestSiblings: boolean; //结构赋值中忽略兄弟元素->它控制在使用**对象解构赋值（destructuring）和剩余属性（rest property）**时，是否将剩余属性的同级属性视为未使用的变量。
  reportUsedIgnorePattern: boolean; //是否报告那些匹配忽略模式的变量
  vars: 'all' | 'local'; //处理变脸范围all全局 local允许全局
  varsIgnorePattern?: RegExp; //忽略指定匹配模式
}
const defaultOptions: TranslatedOptions = {
  args: 'all',
  caughtErrors: 'all',
  ignoreClassWithStaticInitBlock: false,
  ignoreRestSiblings: false,
  reportUsedIgnorePattern: false,
  vars: 'all',
};
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/no-unused-vars.md',
  description: `Require 'compare' argument.`,
};
//编译过程中检测未使用的本地变量和参数
export class NoUnusedVarsCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  readonly SHORT_STR: string = 'sort';
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private clsMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildCb: MatcherCallback = {
      matcher: this.clsMatcher,
      callback: this.check,
    };
    return [matchBuildCb];
  }
  public check = (targetFile: ArkFile) => {
    const exportInfos = targetFile.getExportInfos();
    const exportNames = exportInfos.map((info) => {
      // 如果 nameBeforeAs 存在且不为空，则使用它；否则使用 exportClauseName
      return info.getNameBeforeAs() || info.getOriginName();
    });
    const importInfos = targetFile.getImportInfos();
    const namespaces = NoUnusedVarsCheckUtils.getAllNamespaces(targetFile);
    let astRoot = AstTreeUtils.getSourceFileFromArkFile(targetFile);
    let nousedSet: noUseVars[] = [];
    let unuseds: noUseVars[] = [];
    const targetFilePath = targetFile.getFilePath();
    const options: Options = this.rule.option[0] as unknown as Options;
    const mergedOptions: TranslatedOptions = defaultOptions;
    this.mergedOptions(options, mergedOptions); //options参数赋值
    //获取定义在arkfile最外层的变量集合
    const allVar: noUseVars[] = []; //存放全局变量信息;
    const defaultMethod = targetFile.getDefaultClass().getDefaultArkMethod();
    this.processDefaultMethod(defaultMethod, allVar, nousedSet); //获取全局变量

    //未使用的方法集合
    const inusedGlobal: Map<string, Stmt | null> = new Map();
    const inNeedSpecialArray: Map<string, { stmt: Stmt } | null> = new Map();
    const collectClass = this.collectUnusedClasses(targetFile, exportNames, mergedOptions, allVar, inusedGlobal, inNeedSpecialArray);
    nousedSet = nousedSet.concat(collectClass);
    // //处理命名空间
    const collectNameSpaces = this.collectUnusednameSpaces(namespaces, targetFile, exportNames, mergedOptions, allVar, inusedGlobal, inNeedSpecialArray);
    nousedSet = nousedSet.concat(collectNameSpaces);

    nousedSet = this.beforeFilternoUsedSet(nousedSet, inusedGlobal, inNeedSpecialArray);

    const importNoused = NoUnusedVarsCheckUtils.noUsedImport(astRoot);
    const collectImports = NoUnusedVarsCheckUtils.collecUnusedImports(importInfos, targetFilePath, importNoused);
    nousedSet = nousedSet.concat(collectImports);
    const noUsedtype = NoUnusedVarsCheckUtils.noUsedType(astRoot); //包含interface便于处理
    const collectTypes = NoUnusedVarsCheckUtils.collecUnusedTypes(noUsedtype, targetFilePath);
    nousedSet = nousedSet.concat(collectTypes);
    const generics = NoUnusedVarsCheckUtils.getUnusedGenerics(astRoot);
    const noUsedGenerics = NoUnusedVarsCheckUtils.collecUnusedGenerics(generics, targetFilePath);
    nousedSet = nousedSet.concat(noUsedGenerics);
    unuseds = this.filterUnuseds(mergedOptions, nousedSet);
    for (const unused of unuseds) {
      this.addIssueReport(unused);
    }
  };

  private beforeFilternoUsedSet(
    nousedSet: noUseVars[],
    inusedGlobal: Map<string, Stmt | null>,
    inNeedSpecialArray: Map<string, { stmt: Stmt } | null>
  ): noUseVars[] {
    // 最终筛选：只保留 local 为 'all' 且 name 存在于 usedAllGlobalsKeys 中的项
    nousedSet = nousedSet.filter(
      (item) =>
        !(
          item.local === 'all' &&
          inusedGlobal.has(item.name?.toString?.()) &&
          inusedGlobal.get(item.name?.toString?.()) !== item?.declareStmt
        )
    );
    //过滤特殊数组
    nousedSet = nousedSet.filter(
      (item) =>
        !(
          item.local === 'all' &&
          inNeedSpecialArray.has(item.name?.toString?.()) &&
          inNeedSpecialArray.get(item.name?.toString?.()) === null
        )
    );
    nousedSet = nousedSet.filter(
      (item) =>
        !(
          item.local === 'local' &&
          inNeedSpecialArray.has(item.name?.toString?.()) &&
          inNeedSpecialArray.get(item.name?.toString?.())?.stmt === item.stmt
        )
    );
    //处理import + 处理type + 处理泛型
    return nousedSet;
  }

  private processDefaultMethod(
    defaultMethod: ArkMethod | null,
    allVar: noUseVars[],
    nousedSet: noUseVars[]
  ) {
    if (defaultMethod) {
      const vstmts = defaultMethod.getBody()?.getCfg().getStmts() ?? [];
      const filePath = defaultMethod.getDeclaringArkFile().getFilePath();
      for (const stmt of vstmts) {
         this.pushAllVar(stmt, allVar, nousedSet, filePath);
      }
    }
  }
  private isVariableDeclaration(varName: string): boolean {
    return (
      varName.startsWith('var') ||
      varName.startsWith('let') ||
      varName.startsWith('const')
    );
  }

  private pushAllVar(
    stmt: Stmt,
    allVar: noUseVars[],
    nousedSet: noUseVars[],
    filePath: string
  ): void {
    if (stmt instanceof ArkAssignStmt) {
      const varName = stmt.getLeftOp().toString();
      const originalText = stmt.getOriginalText() ?? '';
      let miniOrinalText = '';
      if (/\s{2,}/.test(originalText)) {
        miniOrinalText = originalText.replace(/\s+/g, ' ');
      } else {
        miniOrinalText = originalText; // 无需处理
      }
      const startVar = miniOrinalText.split('=')[0].replace('}', '').trim(); //获取变量名称
      if (
        !varName.endsWith('this') &&
        !varName.startsWith('%') &&
        this.isVariableDeclaration(originalText) &&
        (startVar.endsWith(varName) || miniOrinalText.includes(','))
      ) {
        allVar.push({
          varType: VarType.Var,
          stmt: stmt,
          name: varName,
        });
      }
      const metadata = stmt?.getMetadata(0) ?? undefined;
      if (metadata instanceof CommentsMetadata) {
        for (const comment of metadata.getComments()) {
          const result = this.extractGlobalVarsFromComment(comment.content);

          this.pushAllGlobal(
            comment.content.toString(),
            result,
            comment.position,
            allVar,
            nousedSet,
            filePath
          );
        }
      }
    }
  }

  private extractGlobalVarsFromComment(comment: string): string[] {
    const match = comment.match(exceGlobalReg);
    if (!match || !match[1]) {
      return [];
    }
    return match[1]
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private pushAllGlobal(
    commentCode: string,
    comment: string[],
    posion: FullPosition,
    allVar: noUseVars[],
    nousedSet: noUseVars[],
    filePath: string
  ): void {
    for (const conString of comment) {
      const posionIntext = NoUnusedVarsCheckUtils.getTextPosition(
        commentCode,
        conString
      );
      let startLine = posion.getFirstLine();
      let startCol = posion.getFirstCol() + posionIntext.column - 1;
      if (posionIntext.line > 0) {
        startLine += posionIntext.line;
        startCol = posionIntext.column;
      }
      nousedSet.push({
        name: conString,
        varType: VarType.Var,
        argPosion: [startLine, startCol, posion.getLastCol()],
        filePath: filePath,
        isAll: true,
      });
    }
  }

  private mergedOptions(
    options: Options,
    mergedOptions: TranslatedOptions
  ): void {
    if (typeof options === 'string') {
      mergedOptions.vars = options;
    } else {
      this.mergeArgs(options, mergedOptions);
      this.mergeCaughtErrors(options, mergedOptions);
      this.mergeDestructuredArray(options, mergedOptions);
      this.mergeBooleanFlags(options, mergedOptions);
      this.mergeVars(options, mergedOptions);
    }
  }
  private mergeArgs(options: Options, mergedOptions: TranslatedOptions): void {
    if (typeof options === 'object' && options?.args) {
      mergedOptions.args = options.args;
    }
    if (typeof options === 'object' && options?.argsIgnorePattern) {
      mergedOptions.argsIgnorePattern = new RegExp(options.argsIgnorePattern);
    }
  }
  private mergeCaughtErrors(
    options: Options,
    mergedOptions: TranslatedOptions
  ): void {
    if (typeof options === 'object' && options?.caughtErrors) {
      mergedOptions.caughtErrors = options.caughtErrors;
    }
    if (typeof options === 'object' && options?.caughtErrorsIgnorePattern) {
      mergedOptions.caughtErrorsIgnorePattern = new RegExp(
        options.caughtErrorsIgnorePattern
      );
    }
  }
  private mergeDestructuredArray(
    options: Options,
    mergedOptions: TranslatedOptions
  ): void {
    if (
      typeof options === 'object' &&
      options?.destructuredArrayIgnorePattern
    ) {
      mergedOptions.destructuredArrayIgnorePattern = new RegExp(
        options.destructuredArrayIgnorePattern
      );
    }
  }

  private mergeBooleanFlags(
    options: Options,
    mergedOptions: TranslatedOptions
  ): void {
    if (
      typeof options === 'object' &&
      options?.ignoreClassWithStaticInitBlock !== undefined
    ) {
      mergedOptions.ignoreClassWithStaticInitBlock =
        options.ignoreClassWithStaticInitBlock;
    }
    if (
      typeof options === 'object' &&
      options?.ignoreRestSiblings !== undefined
    ) {
      mergedOptions.ignoreRestSiblings = options.ignoreRestSiblings;
    }
    if (
      typeof options === 'object' &&
      options?.reportUsedIgnorePattern !== undefined
    ) {
      mergedOptions.reportUsedIgnorePattern = options.reportUsedIgnorePattern;
    }
  }

  private mergeVars(options: Options, mergedOptions: TranslatedOptions): void {
    if (typeof options === 'object' && options?.vars) {
      mergedOptions.vars = options.vars;
    }
    if (typeof options === 'object' && options?.varsIgnorePattern) {
      mergedOptions.varsIgnorePattern = new RegExp(options.varsIgnorePattern);
    }
  }
  private getNoUsedVars(
    arkfile: ArkFile,
    exportNames: string[],
    methods: ArkMethod[],
    mergedOptions: TranslatedOptions,
    nameSpaceTrue: boolean,
    parenttFtrue: boolean,
    allvar: noUseVars[],
    usedAllGlobalsKeys: Map<string, Stmt | null>,
    specialArray: Map<string, { stmt: Stmt } | null>,
    nousedSet: noUseVars[],
    targetClass?: ArkClass
  ): noUseVars[] {
    //存放全局被使用变量最后进行筛选(最优解)
    let usedArrayPartnGlobalsKeys: string[] = []; //存放全局被使用变量最后进行筛选(最优解)
    //处理函数
    nousedSet = this.processMethod(methods, arkfile, nameSpaceTrue, nousedSet);
    nousedSet = this.processBody(
      methods,
      exportNames,
      mergedOptions,
      nousedSet,
      usedAllGlobalsKeys,
      parenttFtrue,
      usedArrayPartnGlobalsKeys,
      allvar,
      specialArray,
      targetClass
    );

    return nousedSet;
  }
  private processMethod(
    methods: ArkMethod[],
    arkfile: ArkFile,
    nameSpaceTrue: boolean,
    nousedSet: noUseVars[]
  ): noUseVars[] {
    for (const method of methods) {
      let methodName = method.getName();
      if (methodName.startsWith('%') && !methodName.includes('$')) {
        continue;
      }
      if (method.getDeclaringArkClass().getName() !== '%dflt') {
        continue;
      }
      let lineNum = method.getDeclareLines() ?? [-1];
      if (lineNum[0] === -1) {
        lineNum[0] = method.getLine() ?? -1;
      }
      let col = method.getColumn() ?? -1;
      const methodCode = method.getCode() ?? '';
      methodName = methodName.split('$')[0].replace('%', '').trim();
      const posion = NoUnusedVarsCheckUtils.getAccuratePosition(
        methodCode,
        methodName
      );
      const decTrueCol = this.getMethodOffset(method);
      const lineNo = posion.line + lineNum[0] - 1;
      let colNo = posion.col + decTrueCol;
      if (methodCode.startsWith(' ')) {
        colNo = col + colNo;
      }
      // 判断是否是全局函数支持 export
      const isDefaultClass =
        method.getDeclaringArkClass().getName() === '%dflt';
      const exportMap: ExportInfo[] = arkfile.getExportInfos() ?? [];
      const isExport = exportMap.some(
        (item) => item.getExportClauseName() === methodName
      );
      if (
        !(method?.isExport() || (isDefaultClass && isExport)) &&
        !nameSpaceTrue
      ) {
        nousedSet.push({
          varType: VarType.Method,
          stmt: method.getBody()?.getCfg().getStmts()[0] ?? ({} as Stmt),
          declareStmt: method.getBody()?.getCfg().getStmts()[0] ?? ({} as Stmt),
          argPosion: [lineNo, colNo, colNo + methodName.length],
          arkMethod: method,
          name: methodName,
          filePath: method.getDeclaringArkFile().getFilePath(),
        });
      }
    }
    return nousedSet;
  }
  //获取方法位置偏移量
  private getMethodOffset(method: ArkMethod): number {
    const declareAsCol = method.getDeclareColumns() ?? [0];
    const decTrueCol = declareAsCol[0] > 0 ? declareAsCol[0] - 1 : declareAsCol[0];
    return decTrueCol;
  }
  private processBody(
    methods: ArkMethod[],
    exportNames: string[],
    mergedOptions: TranslatedOptions,
    nousedSet: noUseVars[],
    usedAllGlobalsKeys: Map<string, Stmt | null>,
    parenttFtrue: boolean,
    usedArrayPartnGlobalsKeys: string[],
    allvar: noUseVars[],
    specialArray: Map<string, { stmt: Stmt } | null>,
    targetClass?: ArkClass
  ): noUseVars[] {
    for (const method of methods) {
      const methodStmts = method.getBody()?.getCfg().getStmts() ?? [];
      this.filterInvokeMethodOrClass(methodStmts, nousedSet, method, targetClass);
      const arrayBindingPattern = this.getArrayBindingPatternParameters(method);
      const objArrayBindingPattern = this.getObjectBindingPatternParameters(method);
      let objArrayBindingPatternNames: {name?: string; methodParamIndex: number; elementIndex: number;}[] = [];
      if (objArrayBindingPattern.length > 0) {
        objArrayBindingPatternNames = this.extractObjectArrayBindingPatternNames(method);
      }
      const arrayBindingPatternNames = arrayBindingPattern.flatMap(
        (param, paramIndex) =>
          param.arrayElements?.map((element, elementIndex) => ({
            name: element.name, methodParamIndex: paramIndex, elementIndex: elementIndex
          })).filter((item) => Boolean(item.name)) || []
      );
      const arrayElementNames = [
        ...objArrayBindingPatternNames,
        ...arrayBindingPatternNames,
      ];
      const usedGlobals = method.getBody()?.getUsedGlobals() ?? new Map<string, Value>();
      const globalKeys = usedGlobals ? Array.from(usedGlobals.keys()) : [];
      if (usedGlobals) {
        usedGlobals.forEach((value, key) => {
          usedAllGlobalsKeys.set(key, null);
        });
      }
      //维持原逻辑舔砖加瓦
      this.commentGlobalVars(usedGlobals, nousedSet);
      this.execLocalandGlobal(
        method,
        usedGlobals,
        globalKeys,
        nousedSet,
        arrayElementNames,
        methodStmts,
        usedArrayPartnGlobalsKeys,
        parenttFtrue,
        exportNames,
        mergedOptions,
        allvar,
        usedAllGlobalsKeys,
        specialArray
      );
    }
    return nousedSet;
  }

  private filterInvokeMethodOrClass(stmts: Stmt[], nousedSet: noUseVars[], method: ArkMethod, targetClass?: ArkClass): void {
   const nousedSetfilter = nousedSet.filter(item => !(item.varType === VarType.Method && 
    (this.isUsedMethod(stmts, item?.arkMethod?.getSignature()) && (item?.arkMethod?.getSignature() !== method?.getSignature())
  )));
   nousedSet.length = 0;
   nousedSet.push(...nousedSetfilter);
   const nousedSetfilterTow = nousedSet.filter(item => !(item.varType === VarType.Class && item?.arkClass?.getSignature() &&
    this.isUsedClass(stmts, item?.arkClass?.getSignature()) && (item?.arkClass?.getSignature() !== targetClass?.getSignature())));
   nousedSet.length = 0;
   nousedSet.push(...nousedSetfilterTow);
    
  }

  private isUsedMethod(stmts: Stmt[], signature: MethodSignature | undefined): boolean {
    for (const stmt of stmts) {
      if (signature && this.isMethodInvoked(stmt, signature)) {
        return true;
      }
    }
      return false;
  }

  private isUsedClass(stmts: Stmt[], signature: ClassSignature | undefined): boolean {
    for (const stmt of stmts) {
      if (signature && this.isClassAssigned(stmt, signature)) {
        return true;
      }
    }
      return false;
    
  }
  private commentGlobalVars(
    usedGlobals: Map<string, Value>,
    nousedSet: noUseVars[]
  ): void {
    nousedSet.filter((item) => {
      !(item.isAll && usedGlobals.has(item.name.toString()));
    });
  }
  private extractObjectArrayBindingPatternNames(
    method: ArkMethod
  ): { name: string; methodParamIndex: number; elementIndex: number }[] {
    return method.getParameters().flatMap((param, paramIndex) =>
      this.extractObjectArrayPatterns(
        method.getCode()?.toString() ?? ''
      ).flatMap(
        (objParam) =>
          objParam.arrayElements
            ?.map((element, elementIndex) => ({
              name: element.name,
              methodParamIndex: paramIndex,
              elementIndex: elementIndex,
            }))
            .filter((item) => Boolean(item.name)) || []
      )
    );
  }

  //辅助函数: 通过正则获取函数特殊情况ObjectArrayPatterns
  private extractObjectArrayPatterns(paramStr: string) {
    const matches = [];
    let match;
    while ((match = objectArrayPatternsReg.exec(paramStr)) !== null) {
      matches.push({
        paramName: match[1], // 'p'
        arrayElements: match[2]
          .replace(arrayElementsReg, '')
          .split(',')
          .map((name) => ({
            name: name.trim(), // 去掉多余空格
          })),
      });
    }

    return matches;
  }

  private execLocalandGlobal(
    method: ArkMethod,
    usedGlobals: Map<string, Value>,
    globalKeys: string[],
    nousedSet: noUseVars[],
    arrayElementNames: {
      name?: string;
      methodParamIndex: number;
      elementIndex: number;
    }[],
    methodStmts: Stmt[],
    usedArrayPartnGlobalsKeys: string[],
    parenttFtrue: boolean,
    exportNames: string[],
    mergedOptions: TranslatedOptions,
    allvar: noUseVars[],
    usedAllGlobalsKeys: Map<string, Stmt | null>,
    specialArray: Map<string, { stmt: Stmt } | null>
  ): void {
    const isDefaultMethod = method.getDeclaringArkClass().getName() === '%dflt';
    const varLocal: Map<string, Local> = method.getBody()?.getLocals() ?? new Map<string, Local>();
    if (isDefaultMethod) {
      varLocal.forEach((value, key) => {
        const stmt = value.getDeclaringStmt();
        if (this.isRealGlobal(stmt)) {
          usedAllGlobalsKeys.set(key, stmt);
        }
      });
    }

    this.processLocalVar(
      varLocal,
      method,
      usedGlobals,
      globalKeys,
      nousedSet,
      usedArrayPartnGlobalsKeys,
      parenttFtrue,
      exportNames,
      mergedOptions,
      specialArray
    );
    this.processOtherVarsity(
      methodStmts,
      arrayElementNames,
      globalKeys,
      method,
      nousedSet,
      usedGlobals,
      allvar
    );
  }
  private isRealGlobal(stmt: Stmt | null): boolean {
    return stmt === null;
  }

  private getArrayBindingPatternParameters(method: ArkMethod): Method_Param[] {
    return (method.getParameters() as unknown as Method_Param[]).filter(
      (param) => param.name === 'ArrayBindingPattern'
    );
  }

  private getObjectBindingPatternParameters(method: ArkMethod): Method_Param[] {
    return (method.getParameters() as unknown as Method_Param[]).filter(
      (param) => param.name === 'ObjectBindingPattern'
    );
  }

  private processArrayBindingPatternVars(
    stmt: ArkAssignStmt,
    arrayElementNames: {
      name?: string;
      methodParamIndex: number;
      elementIndex: number;
    }[],
    globalKeys: string[],
    method: ArkMethod,
    nousedSet: noUseVars[]
  ) {
    if ((stmt.getLeftOp() as Var_base).name !== VarType.ArgsP) {
      return;
    }

    const unusedArrayElements = arrayElementNames.filter(
      (
        item
      ): item is {
        name: string;
        methodParamIndex: number;
        elementIndex: number;
      } => item.name !== undefined && !globalKeys.includes(item.name)
    );
    const paramDefs = NoUnusedVarsCheckUtils.extractParameters(
      method.getCode() ?? ''
    ); 
    for (const unusedParam of unusedArrayElements) {
      const position = this.computeVariablePosition(
        method,
        unusedParam.name,
        unusedParam.methodParamIndex
      );
      const paramDef = paramDefs.length > unusedParam.methodParamIndex ? paramDefs[unusedParam.methodParamIndex] : '';
      const isInit = paramDef.includes('=') && (!paramDef.includes('=>'));
      const filePath = method.getDeclaringArkFile().getFilePath();
      nousedSet.push({
        varType: VarType.ArgsP,
        stmt: stmt,
        name: unusedParam.name,
        declareStmt: this.isMyselfDec(stmt),
        isMethodParam: true,
        paramIndex: unusedParam.methodParamIndex,
        methodName: method.getName(),
        argPosion: position,
        varInit: isInit,
        filePath: filePath,
      });
    }
  }

  private processObjectBindingPatternVars(
    stmt: ArkAssignStmt,
    arrayElementNames: {
      name?: string;
      methodParamIndex: number;
      elementIndex: number;
    }[],
    globalKeys: string[],
    method: ArkMethod,
    nousedSet: noUseVars[]
  ) {
    if ((stmt.getLeftOp() as Var_base).name !== 'ObjectBindingPattern') {
      return;
    }

    const unusedArrayElements = arrayElementNames.filter(
      (
        item
      ): item is {
        name: string;
        methodParamIndex: number;
        elementIndex: number;
      } => item.name !== undefined && !globalKeys.includes(item.name)
    );

    for (const unusedParam of unusedArrayElements) {
      const position = this.computeVariablePosition(
        method,
        unusedParam.name,
        unusedParam.methodParamIndex
      );
      const filePath = method.getDeclaringArkFile().getFilePath();

      nousedSet.push({
        varType: VarType.ArgsP,
        stmt: stmt,
        name: unusedParam.name,
        declareStmt: this.isMyselfDec(stmt),
        isMethodParam: true,
        paramIndex: unusedParam.methodParamIndex,
        arkMethod: method,
        methodName: method.getName(),
        argPosion: position,
        filePath: filePath,
      });
    }
  }

  private processRegularVars(
    stmt: ArkAssignStmt,
    globalKeys: string[],
    method: ArkMethod,
    nousedSet: noUseVars[],
    usedGlobals: Map<string, Value>,
    allVar: noUseVars[]
  ): void {
    const left = stmt.getLeftOp() as Var_base;
    if (
      !left.name ||
      left.name === 'this' ||
      this.isVarUsed(left, false, usedGlobals, method)
    ) {
      return;
    }
    if (
      globalKeys.includes(left.name) &&
      method.getName() !== '%dflt' &&
      allVar.find((item) => item.name === left.name)
    ) {
      this.addallVarByEndIndex(stmt, left.name, nousedSet);
    }
  }
  private addallVarByEndIndex(
    stmt: Stmt,
    name: string,
    nousedSet: noUseVars[]
  ): void {
    const result = nousedSet.find(
      (item) =>
        item.name === name &&
        item.varType === VarType.Var &&
        item.local === 'all'
    );
    if (result) {
      //修改nousedSet 中的
      result.stmt = stmt;
      result.declareStmt = this.isMyselfDec(stmt);
    } else {
      nousedSet.push({
        varType: VarType.Var,
        stmt: stmt,
        declareStmt: this.isMyselfDec(stmt),
        name: name,
        local: 'all',
      });
    }
  }

  private computeVariablePosition(
    method: ArkMethod,
    varName: string,
    methodParamIndex: number
  ): [number, number, number] {
    const lineNo = method.getLine() ?? -1;
    const methodCol = method.getColumn() ?? -1;
    const posion = NoUnusedVarsCheckUtils.getTextPosition(
      method.getCode() ?? '',
      varName
    );
    let startCol = posion.column;
    if (posion.line === 0) {
      startCol = methodCol + posion.column - 2;
    }
    return [lineNo, startCol, startCol + varName.length];
  }
  private processOtherVarsity(
    methodStmts: Stmt[],
    arrayElementNames: {
      name?: string;
      methodParamIndex: number;
      elementIndex: number;
    }[],
    globalKeys: string[],
    method: ArkMethod,
    nousedSet: noUseVars[],
    usedGlobals: Map<string, Value>,
    allVar: noUseVars[]
  ) {
    for (const stmt of methodStmts) {
      if (stmt instanceof ArkAssignStmt) {
        this.processArrayBindingPatternVars(
          stmt,
          arrayElementNames,
          globalKeys,
          method,
          nousedSet
        );
        this.processObjectBindingPatternVars(
          stmt,
          arrayElementNames,
          globalKeys,
          method,
          nousedSet
        );
        this.processRegularVars(
          stmt,
          globalKeys,
          method,
          nousedSet,
          usedGlobals,
          allVar
        );
      }
    }
  }

  private processLocalVar(
    varLocal: Map<string, Local>,
    method: ArkMethod,
    usedGlobals: Map<string, Value>,
    globalKeys: string[],
    nousedSet: noUseVars[],
    usedArrayPartnGlobalsKeys: string[],
    parenttFtrue: boolean,
    exportNames: string[],
    mergedOptions: TranslatedOptions,
    specialArray: Map<string, { stmt: Stmt } | null>
  ): void {
    let maxProcess = 0; // 记录最大使用下标
    for (const [key, local] of varLocal) {
      const localType = local.getType() as unknown as {methodSignature: MethodSignature};
      //扩展变量为箭头函数
      if (
        (localType?.methodSignature && !localType.methodSignature.getMethodSubSignature().getMethodName().startsWith('%')) ||
         key === 'this'
      ) {
        continue;
      }

      const declaringStmt = local.getDeclaringStmt() as unknown as {rightOp: { paramType?: any; index?: number }};
      const export_type = local.getDeclaringStmt()?.getOriginalText()?.trim()?.startsWith('export');
      if (export_type) {
        continue; //如果是export直接忽略掉
      }
      const stmt = local.getDeclaringStmt();
      this.execDeclareStmt(
        key,
        declaringStmt,
        stmt,
        method,
        usedGlobals,
        globalKeys,
        nousedSet,
        usedArrayPartnGlobalsKeys,
        parenttFtrue,
        exportNames,
        mergedOptions,
        specialArray
      );
      maxProcess = this.execDeclareStmtIndex(
        key,
        declaringStmt,
        stmt,
        method,
        usedGlobals,
        nousedSet,
        maxProcess
      );
    }
    nousedSet = nousedSet.map((item) =>
      item.methodName === method.getName()
        ? { ...item, parammaxUsedIndex: maxProcess }
        : item
    );
  }

  private execDeclareStmt(
    key: string,
    declaringStmt: { rightOp: { paramType?: any; index?: number } },
    stmt: Stmt | null,
    method: ArkMethod,
    usedGlobals: Map<string, Value>,
    globalKeys: string[],
    nousedSet: noUseVars[],
    usedArrayPartnGlobalsKeys: string[],
    parenttFtrue: boolean,
    exportNames: string[],
    mergedOptions: TranslatedOptions,
    specialArray: Map<string, { stmt: Stmt } | null>
  ): void {
    if (
      key === 'ArrayBindingPattern' ||
      key === 'ObjectBindingPattern' ||
      declaringStmt?.rightOp?.paramType
    ) {
      return;
    }
    if (stmt instanceof ArkAssignStmt) {
      const left = stmt.getLeftOp() as Var_base;
      const leftName = left?.name?.toString() ?? '';
      const rightOp = stmt.getRightOp();

      if (!leftName || leftName.includes('%')) {
        return;
      }
      const isSpecialCase = declaringStmt?.rightOp?.index;
      if (!this.isVarUsed(left, false, usedGlobals, method)) {
        isSpecialCase ? specialArray.set(leftName, { stmt: stmt }) : '';
        this.handleUnusedVariable(
          stmt,
          leftName,
          rightOp,
          nousedSet,
          globalKeys,
          method,
          parenttFtrue,
          exportNames
        );
      } else {
        isSpecialCase ? specialArray.set(leftName, null) : '';
        this.handleUsedIgnorePattern(stmt, leftName, nousedSet, mergedOptions);
      }

      this.handleArrayPattern(
        stmt,
        leftName,
        usedArrayPartnGlobalsKeys,
        method
      );
    }
  }

  private execDeclareStmtIndex(
    key: string,
    declaringStmt: { rightOp: { paramType?: any; index?: number } },
    stmt: Stmt | null,
    method: ArkMethod,
    usedGlobals: Map<string, Value>,
    nousedSet: noUseVars[],
    maxProcess: number
  ): number {
    const paramDefs = NoUnusedVarsCheckUtils.extractParameters(
      method.getCode() ?? ''
    );
    if (
      !key.includes('%dflt') &&
      key !== 'ArrayBindingPattern' &&
      key !== 'ObjectBindingPattern' &&
      declaringStmt?.rightOp?.paramType
    ) {
      if (stmt instanceof ArkAssignStmt) {
        const left = stmt.getLeftOp() as Var_base;
        const methoodCode = method.getCode() ?? '';
        const bodyCode = NoUnusedVarsCheckUtils.extractMethodBody(methoodCode);
        const leftName = left?.name?.toString();
        const paramIndex = declaringStmt.rightOp.index ?? -1;
        const paramDef = paramDefs.length > paramIndex ? paramDefs[paramIndex] : '';
        const isInit = paramDef.includes('=') && (!paramDef.includes('=>') || !paramDef.replace(' ', '').startsWith(`${leftName}:`));
        const isModiferStart = findModifierReg.test(paramDef);
        if (
          leftName &&
          !isModiferStart &&
          !(
            this.isVarUsed(left, true, usedGlobals, method) ||
            NoUnusedVarsCheckUtils.isTextUsed(bodyCode, leftName)
          )
        ) {
          const position = this.getPosionParamsIndex(method, leftName);
          const filePath = method.getDeclaringArkFile().getFilePath();
          nousedSet.push({
            varType: VarType.Args,
            stmt,
            declareStmt: this.isMyselfDec(stmt),
            name: leftName,
            isMethodParam: true,
            paramIndex,
            methodName: method.getName(),
            arkMethod: method,
            argPosion: position,
            varInit: isInit,
            filePath: filePath,
          });
          //删除前面的非赋值参数
          this.removeInitArgsVars(nousedSet, isInit, method);
          console.assert('baga');
        } else {
          maxProcess = Math.max(maxProcess, paramIndex ?? 0);
        }
      }
    }
    return maxProcess;
  }

  private removeInitArgsVars(nousedSet: noUseVars[], isInit: boolean, method: ArkMethod): void {
    for (let i = nousedSet.length - 1; i >= 0; i--) {
      if (isInit && nousedSet[i].varType === VarType.Args && nousedSet[i].arkMethod?.getSignature() === method.getSignature() && !nousedSet[i].varInit) {
        nousedSet.splice(i, 1);
      }
    }
  }

  private getPosionParamsIndex(
    method: ArkMethod,
    leftName: string
  ): [number, number, number] {
    const lineNo = method.getLine() ?? -1; //函数内参数stmt未关联位置方案代替
    const methodCode = method.getCode() ?? '';
    const methodName = method.getName() ?? ''; // Ensure leftName is defined
    const lines = methodCode.split('\n'); // Split code into lines
    let methodInex = -1;
    let paramInex = -1;
    let startCol = -1;
    for (let i = 0; i < lines.length; i++) {
      methodInex = lines[i].indexOf(methodName);
      if (methodInex !== -1) {
        break;
      }
    }
    for (let i = 0; i < lines.length; i++) {
      paramInex = lines[i].indexOf(leftName);
      if (paramInex !== -1) {
        break;
      }
    }
    if (methodInex > paramInex) {
      startCol = methodInex + 1 + (paramInex ?? 0) + leftName.length;
    } else {
      startCol = paramInex;
    }

    const position: [number, number, number] = [
      lineNo,
      startCol,
      startCol + leftName.length,
    ];
    return position;
  }

  /**
   * 处理未使用变量的逻辑
   */
  private handleUnusedVariable(
    stmt: ArkAssignStmt,
    leftName: string,
    rightOp: any,
    nousedSet: noUseVars[],
    globalKeys: string[],
    method: ArkMethod,
    parenttFtrue: boolean,
    exportNames: string[]
  ): void {
    const originalText = stmt.getOriginalText()?.trim() ?? '';
    const isDestructuredArray =
      leftName.startsWith('[') && leftName.endsWith(']');
    const varInit = stmt.getRightOp().toString() !== 'undefined';

    if (this.isSpecialCase(originalText, stmt, leftName, nousedSet)) {
      return;
    }
    if (
      this.isDestructuredArrayCase(
        leftName,
        isDestructuredArray,
        stmt,
        globalKeys,
        varInit,
        nousedSet
      )
    ) {
      return;
    }
    if (this.isCaughtVariableCase(rightOp, leftName, stmt, nousedSet)) {
      return;
    }
    this.handleDefaultCase(
      leftName,
      stmt,
      method,
      parenttFtrue,
      exportNames,
      varInit,
      nousedSet
    );
  }
  private isSpecialCase(
    originalText: string,
    stmt: ArkAssignStmt,
    leftName: string,
    nousedSet: noUseVars[]
  ): boolean {
    if (originalText.includes('...') || this.isOherDeclareStmt(stmt)) {
      const varInit = stmt.getRightOp().toString() !== 'undefined';
      this.addNoUseVar(leftName, stmt, 'local', true, varInit, true, nousedSet);
      return true;
    } else if (originalText.split('=')[0].endsWith(']')) {
      const varInit = stmt.getRightOp().toString() !== 'undefined';
      this.addNoUseVar(leftName, stmt, 'local', true, varInit, true, nousedSet);
      return true;
    }
    return false;
  }
  private isDestructuredArrayCase(
    leftName: string,
    isDestructuredArray: boolean,
    stmt: ArkAssignStmt,
    globalKeys: string[],
    varInit: boolean,
    nousedSet: noUseVars[]
  ): boolean {
    if (isDestructuredArray) {
      const vars = this.getDestructuredArrayVars(leftName, globalKeys);
      vars.forEach((variable) => {
        this.addNoUseVar(
          variable,
          stmt,
          'local',
          false,
          varInit,
          false,
          nousedSet
        );
      });
      return true;
    }
    return false;
  }
  private isCaughtVariableCase(
    rightOp: any,
    leftName: string,
    stmt: ArkAssignStmt,
    nousedSet: noUseVars[]
  ): boolean {
    if (rightOp.toString().startsWith('caught')) {
      nousedSet.push({
        varType: VarType.Catch,
        stmt,
        declareStmt: this.isMyselfDec(stmt),
        name: leftName,
      });
      return true;
    }
    return false;
  }

  private handleDefaultCase(
    leftName: string,
    stmt: ArkAssignStmt,
    method: ArkMethod,
    parenttFtrue: boolean,
    exportNames: string[],
    varInit: boolean,
    nousedSet: noUseVars[]
  ): void {
    if (
      !(method?.getName() === '%dflt' && parenttFtrue) &&
      !exportNames.includes(leftName)
    ) {
      const isallVar =
        method.getDeclaringArkClass().getName() === '%dflt' &&
        method.getName() === '%dflt';
      this.addNoUseVar(
        leftName,
        stmt,
        isallVar ? 'all' : 'local',
        false,
        varInit,
        false,
        nousedSet
      );
    }
  }
  private getDestructuredArrayVars(
    leftName: string,
    globalKeys: string[]
  ): string[] {
    return leftName
      .replace(leftNameReg, '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v && !globalKeys.includes(v));
  }
  private addNoUseVar(
    leftName: string,
    stmt: ArkAssignStmt,
    local: 'local' | 'all',
    isMethodParam: boolean,
    varInit: boolean,
    isRestSiblings: boolean,
    nousedSet: noUseVars[]
  ): void { 
    const usedstmt = this.isMyselfMaxDec(stmt);
    const varInitTrue = usedstmt instanceof ArkAssignStmt ? usedstmt.getRightOp()?.toString() !== 'undefined' : varInit;
    nousedSet.push({
      varType: VarType.Var,
      stmt: usedstmt,
      declareStmt: this.isMyselfDec(stmt),
      name: leftName,
      local,
      isMethodParam,
      varInit: varInitTrue,
      isRestSiblings,
    });
    //做判断赋值处理防止 先定义后赋值情况发生
    
  }

  /**
   * 处理已使用但符合 `reportUsedIgnorePattern` 规则的变量
   */
  private handleUsedIgnorePattern(
    stmt: ArkAssignStmt,
    leftName: string,
    nousedSet: noUseVars[],
    mergedOptions: TranslatedOptions
  ): void {
    if (
      mergedOptions.reportUsedIgnorePattern &&
      mergedOptions.varsIgnorePattern?.test(leftName)
    ) {
      nousedSet.push({
        varType: VarType.UsedIgnorePattern,
        stmt,
        declareStmt: this.isMyselfDec(stmt),
        name: leftName,
        local: 'local',
        isMethodParam: false,
      });
    }
  }

  /**
   * 处理 `ArrayBindingPattern` 相关逻辑
   */
  private handleArrayPattern(
    stmt: ArkAssignStmt,
    leftName: string,
    usedArrayPartnGlobalsKeys: string[],
    method: ArkMethod
  ): void {
    const originalText = stmt.getOriginalText() ?? '';
    if (
      !method.getName().includes('%df') &&
      originalText.split('=')[0].trim().endsWith(']') &&
      stmt.getRightOp().toString().startsWith('%') &&
      stmt.getRightOp().toString().endsWith(']')
    ) {
      usedArrayPartnGlobalsKeys.push(leftName);
    }
  }

  private isVarUsed(
    left: Var_base,
    ismethodParams: boolean,
    usedGlobals: Map<string, Value>,
    arkmethod: ArkMethod
  ): boolean {
    if (!left.usedStmts) {
      return false;
    }
    if (ismethodParams && left.usedStmts.length > 0) {
      return true;
    }
    const execStmtsResult = this.execUsedStmts(left);
    let globalResult = false;
    //追加全局的
    if (ismethodParams) {
      globalResult = this.execUsedGlobals(usedGlobals, left);
    }
    //遍历参数中调用
    //获取同层级或者以下层级 stmts
    const methodStmts = arkmethod.getBody()?.getCfg()?.getStmts() ?? [];
    const methodName = arkmethod.getName();
    const result = methodStmts.some((stmt) => {
      return (
        !methodName.startsWith('%') &&
        this.execMethodStmt(stmt, left, methodName)
      );
    }); //本层级
    // 如果没有返回 true，表示没有使用
    return false || globalResult || execStmtsResult || result;
  }

  private execUsedStmts(left: Var_base): boolean {
    let originalText = '';
    const stmts = left.usedStmts ?? [];
    for (const stmt of stmts) {
      // 如果原始文本重复，跳过
      const stmtText = stmt.getOriginalText();
      if (originalText === stmtText) {
        continue;
      }
      // 如果 name 不相等，说明有使用，直接返回 true
      if (stmt instanceof ArkIfStmt) {
        return true;
      }

      if (
        stmt instanceof ArkAssignStmt &&
        left.declaringStmt !== (stmt.getLeftOp() as Var_base).declaringStmt
      ) {
        return true;
      }
      if (stmt instanceof ArkInvokeStmt || stmt instanceof ArkThrowStmt) {
        return true;
      }
      //追加条件20250304 && || !=  &&= ||= 
      if (
        stmt instanceof ArkAssignStmt &&
        stmt.getRightOp() instanceof AbstractBinopExpr
      ) {
        const abstractBinopExpr = stmt.getRightOp() as AbstractBinopExpr;
        const operator = abstractBinopExpr.getOperator().toString();
        if (
          abstractBinopExpr &&
          !['+', '+=', '-', '-=', '='].includes(operator)
        ) {
          return true;
        }
      }
      originalText = stmtText ?? ''; // 缓存原始文本，避免重复调用
    }
    return false;
  }

  private execUsedGlobals(
    usedGlobals: Map<string, Value>,
    left: Var_base
  ): boolean {
    for (const val of usedGlobals.values()) {
      const vall = val as Var_base;
      if (vall.usedStmts) {
        return this.foreachStmts(vall.usedStmts, left);
      }
    }
    return false;
  }

  private foreachStmts(stmsts: Stmt[], left: Var_base): boolean {
    for (const stmt of stmsts) {
      if (stmt instanceof ArkAssignStmt) {
        // Keep this case for special handling later if needed
      } else if (stmt instanceof ArkInvokeStmt) {
        if (this.isFieldNameMatched(stmt, left.name ?? '')) {
          return true;
        }
      }
    }
    return false;
  }
  private isFieldNameMatched(stmt: ArkInvokeStmt, fieldName: string): boolean {
    const args = stmt.getInvokeExpr().getArgs();
    for (const arg of args) {
      const decArg = arg as Var_base;
      const declareStmt = decArg.declaringStmt;
      if (declareStmt && declareStmt instanceof ArkAssignStmt) {
        const decAs = declareStmt.getRightOp() as unknown as {
          fieldSignature: FieldSignature;
        };
        if (decAs?.fieldSignature?.getFieldName() === fieldName) {
          return true;
        }
      }
    }
    return false;
  }

  private execMethodStmt(
    stmt: Stmt,
    left: Var_base,
    methodName: string
  ): boolean {
    if (stmt instanceof ArkInvokeStmt) {
      const originalText = stmt.getOriginalText() ?? '';
      if (NoUnusedVarsCheckUtils.isTextUsed(originalText, left.name ?? 'errorP')) {
        return true;
      }
      return stmt
        .getInvokeExpr()
        .getArgs()
        .some((arg) => arg.toString() === left.name);
    }
    if (stmt instanceof ArkReturnStmt) {
      return NoUnusedVarsCheckUtils.isTextUsed(
        stmt.getOriginalText() ?? '',
        left.name ?? 'errorP'
      );
    }
    if (
      stmt instanceof ArkAssignStmt &&
      stmt.getRightOp() instanceof AbstractInvokeExpr
    ) {
      const expre = stmt.getRightOp() as AbstractInvokeExpr;
      const methodSign = expre.getMethodSignature().getMethodSubSignature();
      if (methodSign.getMethodName() === methodName) {
        return false;
      }
      return expre.getArgs().some((arg) => arg.toString() === left.name);
    }
    if (
      stmt instanceof ArkAssignStmt &&
      stmt.getRightOp().getType() instanceof FunctionType
    ) {
      const originalText = stmt.getOriginalText() ?? '';
      if (NoUnusedVarsCheckUtils.isTextUsed(originalText, left.name ?? 'errorP')) {
        return true;
      }
    }
    return false;
  }

  private isClassAssigned(stmt: Stmt, signature: ClassSignature): boolean {
    if (!(stmt instanceof ArkAssignStmt)) {
      return false;
    }

    const right = stmt.getRightOp() as unknown as {
      classType: { classSignature?: ClassSignature };
    };
    const originalText = stmt.getOriginalText() ?? '';
    const classname = signature?.getClassName().split('$')[0] ?? '-false';
    const tighttype = stmt?.getRightOp()?.getType()?.getTypeString() ?? '-101p';
    const leftop = stmt.getLeftOp() as Var_base;
    const leftopType = stmt.getLeftOp().getType();
    // 检查左操作数的使用情况
    const isLeftOpUsed = this.checkLeftOpUsage(leftop, classname);

    // 检查右操作数是否是目标类
    if (this.isRightClassAssigned(right, signature, stmt)) {
      return true;
    }

    return (
      ((leftopType instanceof ClassType &&
        leftopType.getClassSignature() === signature) ||
        NoUnusedVarsCheckUtils.isTextUsed(tighttype, classname) ||
        isLeftOpUsed ||
        leftopType.toString() === classname) &&
      right.toString() !== 'this' &&
      !NoUnusedVarsCheckUtils.isTextUsed(originalText, 'this')
    );
  }

  private checkLeftOpUsage(leftop: Var_base, classname: string): boolean {
    if (!leftop.usedStmts) {
      return false;
    }

    for (const stmt of leftop.usedStmts) {
      if (stmt instanceof ArkAssignStmt) {
        const leftCode = stmt.getLeftOp().getType().getTypeString();
        if (NoUnusedVarsCheckUtils.isTextUsed(leftCode, classname)) {
          return true;
        }
      }
    }
    return false;
  }

  private isRightClassAssigned(
    right: { classType: { classSignature?: ClassSignature } },
    signature: ClassSignature,
    stmt: ArkAssignStmt
  ): boolean {
    const left = stmt.getLeftOp() as unknown as { name: string };
    return (
      right.classType?.classSignature === signature &&
      left.name !== 'this' &&
      left.name !== '%dflt'
    );
  }

  private isMethodInvoked(
    stmt: Stmt,
    signature: MethodSignature | ClassSignature
  ): boolean {
    let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
    if (
      stmt instanceof ArkThrowStmt &&
      stmt.getOp() instanceof AbstractInvokeExpr
    ) {
      invokeExpr = stmt.getOp() as AbstractInvokeExpr;
    }
    const iniInvokeDefParam = this.callFunctionDecParams(invokeExpr, signature);
    return iniInvokeDefParam || invokeExpr?.getMethodSignature() === signature;
  }
  //判断执行函数内参数是定义函数 坑爹
  private callFunctionDecParams(
    invokeExpr: AbstractInvokeExpr | null,
    signature: MethodSignature | ClassSignature
  ): boolean {
    if (!invokeExpr) {
      return false;
    }

    return invokeExpr.getArgs().some((arg) => {
      const type = arg.getType();
      const rightOpInvoke = (
        arg as unknown as { declaringStmt: ArkAssignStmt }
      )?.declaringStmt?.getRightOp();
      const invokebaseType =
        rightOpInvoke instanceof ArkInstanceInvokeExpr
          ? rightOpInvoke?.getBase()?.getType()
          : type;
      return (
        invokebaseType instanceof FunctionType &&
        invokebaseType.getMethodSignature() === signature
      );
    });
  }

  // 辅助函数: 判断stmt是否在当前文件stmts 的定义语句中
  private isOherDeclareStmt(stmt: Stmt): boolean {
    for (const st of stmt?.getCfg()?.getStmts() ?? []) {
      if (st instanceof ArkAssignStmt) {
        const left = st.getLeftOp() as Var_base;
        if (
          left.declaringStmt === stmt &&
          (st.getOriginalText()?.includes('...') ?? false)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  //获取未使用的自调用最后一个(填坑--->20250207)无法通过usedStmt只能遍历全部 ----注意无需判断是否被使用(大条件下已经是未使用)
  private isMyselfDec(stmt: Stmt): Stmt {
    let stmto = stmt;
    if (stmt instanceof ArkAssignStmt) {
      const left = stmt.getLeftOp() as Var_base;
      if (left.declaringStmt) {
        stmto = left.declaringStmt;
      }
    }
    return stmto;
  }

  //最后调用点
  private isMyselfMaxDec(stmt: Stmt): Stmt {
    let stmto = stmt;
    const stms = stmt?.getCfg()?.getStmts() ?? [];
    for (const st of stms) {
      if (st instanceof ArkAssignStmt) {
        const left = st.getLeftOp() as Var_base;
        if (left.declaringStmt === stmt) {
          stmto = st;
        }
      }
    }
    return stmto;
  }

  //获取过滤后的结果
  private filterUnuseds(
    mergedOptions: TranslatedOptions,
    unuseds: noUseVars[]
  ) {
    if (mergedOptions.vars === 'local') {
      unuseds = unuseds.filter(
        (item) => !(item.varType === VarType.Var && item.isAll)
      );
    }
    if (mergedOptions.varsIgnorePattern) {
      unuseds = unuseds.filter((item) => !(item.varType === VarType.Var && mergedOptions.varsIgnorePattern?.test(item.name.toString())));
    }
    if (mergedOptions.args === 'after-used') {
      unuseds = unuseds.filter((item) => !((item.parammaxUsedIndex ?? -1) > (item.paramIndex ?? -1)));
    }
    if (mergedOptions.args === 'none') {
      unuseds = unuseds.filter((item) => !item.isMethodParam);
    }
    if (mergedOptions.argsIgnorePattern) {
      unuseds = unuseds.filter((item) => !(item.varType === VarType.Args && mergedOptions.argsIgnorePattern?.test(item.name.toString())));
    }
    if (mergedOptions.caughtErrors === 'none') {
      unuseds = unuseds.filter((item) => !(item.varType === VarType.Catch)); //过滤掉错误代码块参数
    }
    if (mergedOptions.caughtErrorsIgnorePattern) {
      unuseds = unuseds.filter((item) => !(item.varType === VarType.Catch && mergedOptions.caughtErrorsIgnorePattern?.test(item.name.toString())));
    }
    if (mergedOptions.destructuredArrayIgnorePattern) {
      //4.1 destructuredArrayIgnorePattern
      unuseds = unuseds.filter((item) =>!(item.varType === VarType.ArgsP && mergedOptions.destructuredArrayIgnorePattern?.test(item.name.toString())));
    }
    if (mergedOptions.ignoreRestSiblings) {
      unuseds = unuseds.filter((item) => !(item.varType === VarType.Var && item.isRestSiblings)); //过滤掉同级
    }
    if (mergedOptions.ignoreClassWithStaticInitBlock) {
      unuseds = unuseds.filter((item) => !(item.varType === VarType.Class && item.static));
    }
    if (mergedOptions.reportUsedIgnorePattern) {
      unuseds = unuseds.filter((item) => !(item.varType === VarType.UsedIgnorePattern));
    }
    return unuseds;
  }

  //装配描述信息
  private addDescription(noUseVar: noUseVars): string {
    switch (noUseVar.varType) {
      case VarType.Var:
        return noUseVar.varInit
          ? `'${noUseVar.name}' is assigned a value but never used.`
          : `'${noUseVar.name}' is defined but never used.`;
      case VarType.Class:
        return `'${noUseVar.name}' is defined but never used.`;
      case VarType.Method:
        return `'${noUseVar.name}' is defined but never used.`;
      case VarType.Args:
        return noUseVar.varInit
        ? `'${noUseVar.name}' is assigned a value but never used.`
        : `'${noUseVar.name}' is defined but never used.`;
      case VarType.ArgsP:
        return noUseVar.varInit
        ? `'${noUseVar.name}' is assigned a value but never used.`
        : `'${noUseVar.name}' is defined but never used.`;
      case VarType.Catch:
        return `'${noUseVar.name}' is defined but never used.`;
      case VarType.Static:
        return `'${noUseVar.name}' is defined but never used.`;
      case VarType.UsedIgnorePattern:
        return `'${noUseVar.name}' is defined but never used.`;
      case VarType.Import:
        return `'${noUseVar.name}' is defined but never used.`;
      case VarType.Type:
        return `'${noUseVar.name}' is defined but never used.`;
      default:
        return 'Unknown type.';
    }
  }

  private addIssueReport(noUseVar: noUseVars): void {
    const severity = this.rule.alert ?? this.metaData.severity;
    const warnInfo = this.getLineAndColumn(noUseVar);
    // Handle specific cases based on varType
    this.setWarnInfoForVarTypePosion(noUseVar, warnInfo);
    if (warnInfo.startCol > -1 && warnInfo.startCol > 0) {
      const defect = this.createDefect(warnInfo, noUseVar, severity);
      this.issues.push(new IssueReport(defect, undefined));
      RuleListUtil.push(defect);
    }
  }

  private setWarnInfoForVarTypePosion(
    noUseVar: noUseVars,
    warnInfo: any
  ): void {
    switch (noUseVar.varType) {
      case VarType.Var:
        NoUnusedVarsCheckUtils.setWarnInfoForVar(noUseVar, warnInfo);
        break;
      case VarType.ArgsP:
        NoUnusedVarsCheckUtils.setWarnInfoForArgs(noUseVar, warnInfo);
        break;
      case VarType.Import:
        NoUnusedVarsCheckUtils.setWarnInfoForArgType(noUseVar, warnInfo); //更换处理方式
        break;
      case VarType.Type:
        NoUnusedVarsCheckUtils.setWarnInfoForType(noUseVar, warnInfo);
        break;
      case VarType.Method:
        NoUnusedVarsCheckUtils.setWarnInfoForMethodNobody(noUseVar, warnInfo); //处理没有方法体的情况
        break;
      case VarType.Class:
        if (noUseVar.arkClass) {
          NoUnusedVarsCheckUtils.setWarnInfoForClass(noUseVar, warnInfo);
        } else if (noUseVar.arkNamespace) {
          NoUnusedVarsCheckUtils.setWarnInfoForNamespace(noUseVar, warnInfo);
        }
        break;
    }
  }

  private createDefect(
    warnInfo: any,
    noUseVar: noUseVars,
    severity: number
  ): Defects {
    return new Defects(
      warnInfo.line,
      warnInfo.startCol,
      warnInfo.endCol,
      this.addDescription(noUseVar),
      severity,
      this.rule.ruleId,
      warnInfo.filePath === '' ? noUseVar?.filePath : warnInfo.filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
  }

  private getLineAndColumn(noUseVar: noUseVars): {
    line: number;
    startCol: number;
    endCol: number;
    filePath: string;
  } {
    if (
      !noUseVar.stmt ||
      typeof noUseVar.stmt.getOriginPositionInfo !== 'function'
    ) {
      return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }

    const originPosition = noUseVar?.stmt?.getOriginPositionInfo();
    const declarePosition = noUseVar.declareStmt?.getOriginPositionInfo();
    const arkMethod = noUseVar.arkMethod;
    const arkFile = noUseVar.stmt
      .getCfg()
      ?.getDeclaringMethod()
      ?.getDeclaringArkFile();
    let line = this.getLineAndColumn_line(
      originPosition,
      declarePosition,
      arkMethod
    );
    const finallyOrigText = this.getLineAndColumn_OrigText(noUseVar);
    let startCol = this.getLineAndColumn_startLine(
      originPosition,
      declarePosition,
      arkMethod
    );
    const posions = NoUnusedVarsCheckUtils.getTextPosition(
      finallyOrigText,
      noUseVar.name.toString()
    );

    if (startCol === -1 || !arkFile) {
      return { line, startCol: -1, endCol: -1, filePath: '' };
    }
    line = posions.line + line; // 行号从0开始，所以加1
    startCol =
      (posions.line === 0 ? posions.column + startCol : posions.column + 1) - 1; // 列号从1开始，所以-1
    const endCol = startCol + noUseVar.name.toString().length - 1;
    return { line, startCol, endCol, filePath: arkFile.getFilePath() };
  }

  private getLineAndColumn_line(
    originPosition: LineColPosition | undefined,
    declarePosition: LineColPosition | undefined,
    arkMethod: ArkMethod | undefined
  ): number {
    let line =
      originPosition && (originPosition?.getLineNo() ?? -1) >= 0
        ? originPosition.getLineNo()
        : arkMethod?.getLine() ?? -1;
    line = line === -1 ? declarePosition?.getLineNo() ?? -1 : line; //类似于fianlly 中 语句存在位置信息为空情况
    return line;
  }

  private getLineAndColumn_OrigText(noUseVar: noUseVars): string {
    const arkMethod = noUseVar.arkMethod;
    const originText = arkMethod
      ? arkMethod.getCode() ?? ''
      : noUseVar.stmt?.getOriginalText() ?? '';
    const textOrigtext = arkMethod ? arkMethod.getCode() ?? '' : originText;
    const finallyOrigText =
      textOrigtext === ''
        ? noUseVar?.declareStmt?.getOriginalText() ?? ''
        : textOrigtext;
    return finallyOrigText;
  }
  private getLineAndColumn_startLine(
    originPosition: LineColPosition | undefined,
    declarePosition: LineColPosition | undefined,
    arkMethod: ArkMethod | undefined
  ): number {
    let startCol =
      originPosition && (originPosition?.getLineNo() ?? -1) >= 0
        ? originPosition.getColNo()
        : arkMethod?.getColumn() ?? -1;
    startCol = startCol === -1 ? declarePosition?.getColNo() ?? -1 : startCol;
    return startCol;
  }

  //获取所有箭头函数使用的全局变量
  private loopNode(
    targetFile: ArkFile,
    sourceFile: ts.SourceFile,
    aNode: ts.Node,
    usedGlobalP: string[] = [] // 在递归调用时保持所有的全局变量
  ): string[] {
    const children = aNode.getChildren();
    for (const node of children) {
      if (ts.isArrowFunction(node)) {
        // 提取箭头函数的参数
        const params: string[] = [];
        const cd = node.parameters;
        this.execLoopParams(cd, params, node, usedGlobalP);
        // 递归调用，继续遍历子节点
        if (node.getChildren().length > 0) {
          this.loopNode(targetFile, sourceFile, node, usedGlobalP);
        }
      } else {
        // 对于非箭头函数节点，继续递归遍历子节点
        ts.forEachChild(node, (child) => {
          this.loopNode(targetFile, sourceFile, child, usedGlobalP);
        });
      }
    }
    return usedGlobalP; // 返回最终的所有 usedGlobalP
  }

  private execLoopParams(
    cd: ts.NodeArray<ts.ParameterDeclaration>,
    params: string[],
    node: ts.ArrowFunction,
    usedGlobalP: string[]
  ): void {
    params = this.exceLoopParams_next(cd, params);
    // 检查箭头函数体内的全局变量（比如 num）
    if (ts.isBlock(node.body)) {
      // 如果箭头函数体是块语句，递归检查每个子节点
      node.body.statements.forEach((statement) => {
        this.exceLoopParamsStatement(statement, params, usedGlobalP);
      });
    } else if (
      ts.isIdentifier(node.body) &&
      params.indexOf(node.body.getText()) === -1
    ) {
      // 如果箭头函数体是一个简单的标识符（例如 num），并且它不在参数列表中
      usedGlobalP.push(node.body.getText());
    }
  }

  private exceLoopParamsStatement(
    statement: ts.Statement,
    params: string[],
    usedGlobalP: string[]
  ): void {
    if (ts.isExpressionStatement(statement)) {
      const expr = statement.expression;
      if (ts.isIdentifier(expr) && params.indexOf(expr.getText()) === -1) {
        // 如果是标识符，且不在参数列表中，视为全局变量
        usedGlobalP.push(expr.getText());
      }
    }
  }

  private exceLoopParams_next(
    cd: ts.NodeArray<ts.ParameterDeclaration>,
    params: string[]
  ): string[] {
    for (const cdd of cd) {
      if (ts.isParameter(cdd)) {
        const cfd = cdd.getChildren();
        this.exceLoopParams_nextnode(cfd, params);
      }
    }
    return params;
  }
  private exceLoopParams_nextnode(cfd: ts.Node[], params: string[]): void {
    for (const cds of cfd) {
      if (ts.isIdentifier(cds)) {
        params.push(cds.getText());
      }
    }
  }
  //判断换class中是否包含static块
  hasStaticBlock(sourceFile: ts.SourceFile): boolean {
    for (let child of sourceFile.statements) {
      return this.loopStatic(sourceFile, child);
    }
    return false;
  }

  loopStatic(sourceFile: ts.SourceFile, aNode: ts.Node): boolean {
    const children = aNode.getChildren();
    for (const node of children) {
      if (ts.isClassStaticBlockDeclaration(node)) {
        return true;
      }
      if (node.getChildren().length > 0) {
        return this.loopStatic(sourceFile, node);
      }
    }
    return false;
  }



  


  private collectUnusednameSpaces(
    namespaces: ArkNamespace[],
    targetFile: ArkFile,
    exportNames: string[],
    mergedOptions: TranslatedOptions,
    allvar: noUseVars[],
    inusedGlobal: Map<string, Stmt | null>,
    specialArray: Map<string, { stmt: Stmt } | null>
  ): noUseVars[] {
    let nousedSet: noUseVars[] = [];
    for (const namespace of namespaces) {
      //1.将namespace 特殊处理 module也在其中module不处理
      const nameSpaceName = namespace.getName();
      let currentNamespace: ArkNamespace | undefined | null =
        namespace.getDeclaringArkNamespace();
      let namespaceName = currentNamespace?.getName() ?? '';
      namespace.getSignature();
      // 递归查找最外层命名空间用来判断是否export
      while (currentNamespace?.getDeclaringArkNamespace()) {
        currentNamespace = currentNamespace?.getDeclaringArkNamespace();
      }
      const nameSpaceTrue = namespace?.isDeclare() ?? false;
      const currentNamespaceTrue = currentNamespace?.isDeclare() ?? false;
      const namespaceCode = namespace?.getCode() ?? '';
      const methods = namespace.getAllMethodsUnderThisNamespace();
      const ismodule = NoUnusedVarsCheckUtils.isTextUsed(
        namespaceCode.substring(0, 20),
        'module'
      );
      if (
        !(namespaceName !== '' && currentNamespaceTrue) &&
        !namespace.isExport() &&
        !NoUnusedVarsCheckUtils.isNamespaceUse(targetFile, namespace.getSignature()) &&
        !ismodule &&
        !NoUnusedVarsCheckUtils.isTextUsed(namespaceCode, 'global') &&
        !exportNames.includes(nameSpaceName)
      ) {
        nousedSet.push({
          varType: VarType.Class,
          arkNamespace: namespace,
          name: nameSpaceName,
        });
      }
      nousedSet = this.getNoUsedVars(
          targetFile,
          exportNames,
          methods,
          mergedOptions,
          nameSpaceTrue,
          currentNamespaceTrue || nameSpaceTrue,
          allvar,
          inusedGlobal,
          specialArray,
          nousedSet);
    }
    return nousedSet;
  }

  

  private collectUnusedClasses(
    targetFile: ArkFile,
    exportNames: string[],
    mergedOptions: TranslatedOptions,
    allvar: noUseVars[],
    inusedGlobal: Map<string, Stmt | null>,
    specialArray: Map<string, { stmt: Stmt } | null>
  ): noUseVars[] {
    let nousedSet: noUseVars[] = [];
    const arkFileAllClass =
      NoUnusedVarsCheckUtils.getArkFileAllClasss(targetFile);
      nousedSet.push(...NoUnusedVarsCheckUtils.getClassOrMethod(arkFileAllClass, targetFile));
    for (const targetClass of arkFileAllClass) {
      let methods = targetClass.getMethods();
      const methodStatic = targetClass.getMethodWithName('%statBlock0'); //获取static块
      if (methodStatic) {
        methods.push(methodStatic);
      }
      const filterClass = nousedSet.filter(item => this.isUsedClassFilter(item, targetClass, exportNames));
      nousedSet.length = 0;
      nousedSet.push(...filterClass);
      nousedSet = this.getNoUsedVars(
          targetFile,
          exportNames,
          methods,
          mergedOptions,
          false,
          false,
          allvar,
          inusedGlobal,
          specialArray,
          nousedSet,
          targetClass
        );
     
    }
    return nousedSet;
  }
//新加卡控自身不检索自身
  private isUsedClassFilter(item: noUseVars, targetClass: ArkClass, exportNames: string[]): boolean {
   return !(item.varType === VarType.Class && item?.arkClass?.getSignature() && item?.arkClass?.getSignature() !== targetClass.getSignature() &&  
    NoUnusedVarsCheckUtils.filterClass(targetClass, item?.arkClass?.getSignature(), exportNames));
  }
 
     
}
