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
  Stmt,
  ArkAssignStmt,
  ArkNormalBinopExpr,
  Value,
  AbstractInvokeExpr,
  ArkInstanceInvokeExpr,
  AbstractExpr,
  FunctionType,
  PrimitiveType,
  ArkNewArrayExpr,
  ArkUnopExpr,
  AbstractBinopExpr,
  StringType,
  ArkNamespace
} from 'arkanalyzer/lib';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../checker/BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import {
  ClassMatcher,
  MatcherCallback,
  MatcherTypes,
  NamespaceMatcher,
} from '../../matcher/Matchers';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { CheckerUtils } from '../../utils/checker/CheckerUtils';
import { Rule } from '../../model/Rule';
import { NumberUtils } from '../../utils/checker/NumberUtils';
import { NumberValue } from '../../model/NumberValue';

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'NoUnusedExpressionsCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/no-unused-expressions.md', // TODO: support url
  description:
    'Expected an assignment or function call and instead saw an expression.',
};
type Scene_base = {
  declaringStmt?: Stmt;
  name?: string;
  usedStmts?: Stmt[];
  promise?:{declaringStmt?: Stmt}
};
//结果类型
enum ExpType {
  Tag = 'tag',
  func = 'function',
  allowShortCircuit = 'allowShortCircuit',
  allowTernary = 'allowTernary',
  allowTaggedTemplates = 'allowTaggedTemplates',
}
type NoUsedExpression = {
  stmt: Stmt;
  originalText: string;
  exptype?: ExpType;
  posion?: [lineNo: number, lineCol: number]
};
type AllowOptionEntries = {
  allowShortCircuit?: boolean;
  allowTaggedTemplates?: boolean;
  allowTernary?: boolean;
};

interface Options {
  allow: AllowOptionEntries;
}
const defaultOptions: Options = {
  allow: {
    allowShortCircuit: false,
    allowTaggedTemplates: false,
    allowTernary: false,
  },
};
const assignmentPattern =
  /^\(?[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[a-zA-Z_][a-zA-Z0-9_]*\)?$/;

// 匹配有效的函数调用，例如 'f()' 或 'f(a, b)'
const functionCallPattern = /^[a-zA-Z_][a-zA-Z0-9_]*\s*\([a-zA-Z0-9_,\s]*\)$/;
const pressfuncReg = /^[a-zA-Z]\w*\s*\($/;
const funcCallReg = /^\s*[a-zA-Z_]\w*\s*\(/;
const loopOrConditionReg = /^\s*(for|if|while|switch|with)\s*\(.*\)\s*{/;
const isTaggedStringReg = /^[a-zA-Z]\s+'.*`$/;
const isfunCallReg = /^\s*(\w+\s*\([^)]*\)|\([^)]+\))\s*\.\w+\([^)]*\)\s*$/;
const isAssignDefaultStatementReg =
  /^(?!.*!=|==|===)(?!\d+=)(?:(?:[^=\d]*=\s*)?delete\s+.*|[^=\d]+=\s*[^!=].*|(?:var|let|const)\s+\w+\s*=\s*[^!=].*)$/;
const logicalAssignReg = /^\s*\w+\s*(\&\&=|\|\|=|\?\?=)\s*.+$/;//逻辑赋值语句
const isFilterAsginReg = /^\s*(?:var|let|const)\s+\w+\s*(?::\s*\w+)?\s*=(?!=)/;
const includeOperator = /[+\-*/]/;




export class NoUnusedExpressionsCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  textTernary = ''; //存放三元表达式信息---->锁定三元表达相关语句;
  textTernaryBefor = ''; //存放三元表达式信息---->锁定三元表达相关语句;
  textCircuit = ''; //存放逻辑运算信息信息---->锁定|| &&相关语句;
  textCircuitBefor = ''; //存放逻辑运算信息信息---->锁定|| &&相关语句;
  TernaryErrorCount = 0;
  CircuitErrorCount = 0;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private clsMatcher: ClassMatcher = {
    matcherType: MatcherTypes.CLASS,
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildCb: MatcherCallback = {
      matcher: this.clsMatcher,
      callback: this.check,
    };

    return [matchBuildCb];
  }

  public check = (arkClass: ArkClass) => {
    this.arkFieldExpressionsProcess(arkClass);
  };

  //类体
  private arkFieldExpressionsProcess(arkClass: ArkClass): void {
    const options: Options = this.rule.option as unknown as Options;
    const mergedOptions: Options = {
      ...defaultOptions,
      ...options,
    };
    let exportLineNo = 100000;
     const inNamespace = arkClass.getDeclaringArkNamespace();
     if (inNamespace) {
      const exports = inNamespace?.getExportInfos() ?? [];
      exportLineNo = exports.length > 0 ? exports[0].getOriginTsPosition()?.getLineNo() : -1;

  }
    const arkMethods = arkClass.getMethods();
    const staticMethod = arkClass.getMethodWithName('%statBlock0');
    staticMethod ? arkMethods.push(staticMethod) : arkMethods;
    let noUsedExpression: NoUsedExpression[] = [];
    for (const arkMethod of arkMethods) {
      const stmts = arkMethod.getBody()?.getCfg().getStmts() ?? []; //获取方法体的所有语句()
      //执行体
      this.expressionsProcess(stmts, mergedOptions, noUsedExpression, exportLineNo);
    }
  }

  //方法体
  expressionsProcess(stmts: Stmt[], mergedOptions: Options, noUsedExpression: NoUsedExpression[], exportLineNo: number): void {
    this.processExpress(stmts, noUsedExpression, exportLineNo);
    noUsedExpression = this.filterUnuseds(mergedOptions, noUsedExpression);
    //装配报错信息
    for (const noUsed of noUsedExpression) {
      this.addIssueReport(noUsed, noUsed.originalText);
    }
  }

  private checkExpression(
    noUsedExpression: NoUsedExpression[],
    nowline: number
  ): boolean {
    for (let i = 0; i < noUsedExpression.length; i++) {
      const item = noUsedExpression[i];
      const lineNo = item.stmt.getOriginPositionInfo().getLineNo() ?? -1;
      if (lineNo === nowline) {
        return true;
      }
    }
    return false;
  }
  //判断是否是未使用
  private isNoExpression(stmt: ArkAssignStmt): boolean {
    const leftOp = stmt.getLeftOp() as Scene_base;
    const originalText = stmt.getOriginalText() ?? '';
    const rightOp = stmt.getRightOp();
    if ((leftOp.name?.startsWith('%') && leftOp.usedStmts?.length === 0) && !this.isrightOpExpr(rightOp, originalText)) {
      return true;
    }
    return false; // Return false if the condition is not met.
  }

  isrightOpExpr(rightOp: Value, originalText: string): boolean {
    const isInvokeExpr = rightOp instanceof AbstractInvokeExpr;
    const isNewArrayExpr = rightOp instanceof ArkNewArrayExpr;
    const originalTextfunc = loopOrConditionReg.test(originalText);
    const isAbstractBinopExpr = rightOp instanceof AbstractBinopExpr;
    const originalTextPres = ((originalText?.startsWith('new') && !originalText.includes('.')) || 
    originalText?.startsWith('void') || originalText?.startsWith('await') || originalText?.startsWith('yield') || 
    isFilterAsginReg.test(originalText) || originalText?.startsWith('delete') || originalText?.startsWith('export'));
    if (!isAbstractBinopExpr && (isInvokeExpr || isNewArrayExpr || originalTextfunc || originalTextPres)) {
      return true;
    } else if (originalText?.startsWith('const')) {
      return true;
    }
    return false;
  }
  

  isCircuit(rightOp: Value): boolean {
    if (rightOp instanceof ArkNormalBinopExpr) {
      let Operator = rightOp.getOperator();
      let Op2 = rightOp.getOp2() as Scene_base;
      Op2.declaringStmt;
      if (Operator === '&&' || Operator === '||') {
        return true;
      }
    }

    return false;
  }
  allowShortCircuitExpressions(rightOp: Value): Boolean {
    if (rightOp instanceof ArkNormalBinopExpr) {
      let Operator = rightOp.getOperator();

      let Op2 = rightOp.getOp2() as Scene_base;
      Op2.declaringStmt;
      let isExpression = false;
      if (
        Op2.declaringStmt instanceof ArkAssignStmt &&
        !this.isNoExpression(Op2.declaringStmt)
      ) {
        isExpression = true;
      }
      const declareStmtOp = Op2?.declaringStmt ? Op2.declaringStmt : Op2?.promise?.declaringStmt;
      if (
        (Operator === '&&' || Operator === '||') && (declareStmtOp && (CheckerUtils.getInvokeExprFromStmt(declareStmtOp)))
      ) {
        return true;
      }
    }

    return false;
  }

  allowTernaryExpressions(Op: any): Boolean {
    const rightOrLeft = Op as Scene_base;
    let isExpression = false;
    if (
      rightOrLeft.declaringStmt instanceof ArkAssignStmt &&
      !this.isNoExpression(rightOrLeft.declaringStmt)
    ) {
      isExpression = true;
    }
    if (Op instanceof AbstractInvokeExpr || isExpression) {
      return true;
    }
    return false;
  }
  isValidTernary(expression: string): boolean {
    // 用于存储问号和冒号的索引
    const stack: string[] = [];
    let questionIndex = -1;
    let colonIndex = -1;

    // 遍历表达式，记录问号和冒号的索引
    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];
      if (char === '?') {
        if (stack.length === 0) {
          questionIndex = i;
        }
        stack.push('?');
      } else if (char === ':') {
        if (stack.length === 1) {
          colonIndex = i;
        }
        stack.pop();
      }
    }

    // 如果没有问号或冒号，表示没有有效的三元表达式
    if (questionIndex === -1 || colonIndex === -1) {
      return false;
    }

    // 获取问号之前、问号之后到冒号之前、冒号之后的表达式
    const beforeQuestion = expression.substring(0, questionIndex).trim();
    const betweenQuestionAndColon = expression
      .substring(questionIndex + 1, colonIndex)
      .trim();
    const afterColon = expression.substring(colonIndex + 1).trim();

    // 如果任何一个部分为空，表示表达式不完整
    if (!beforeQuestion || !betweenQuestionAndColon || !afterColon) {
      return false;
    }

    return betweenQuestionAndColon !== '' && !betweenQuestionAndColon.startsWith('.');
  }
  // 判断普通的表达式是否有效
  isValidExpression(expression: string): boolean {
    // 判断是否是有效的赋值表达式或函数调用
    return (
      assignmentPattern.test(expression) || functionCallPattern.test(expression)
    );
  }

  //检查三元表达方程执行符串是否是函数
  isPressfunc(expression: string): boolean {
    // 检查一个表达式是否可能是函数调用
    function isFunction(expr: string): boolean {
      return pressfuncReg.test(expr.trim());
    }

    // 分割表达式并检查每个部分
    function splitAndCheck(expr: string): boolean {
      // 查找第一个问号和对应的冒号
      const questionIndex = expr.indexOf('?');
      const colonIndex = expr.indexOf(':');

      // 如果没有问号或冒号，表示没有更多的三元表达式
      if (questionIndex === -1 || colonIndex === -1) {
        return false;
      }

      // 检查问号是否在冒号之前
      if (questionIndex > colonIndex) {
        return false;
      }

      // 获取问号之前、问号之后到冒号之前、冒号之后的表达式
      const beforeQuestion = expr.substring(0, questionIndex).trim();
      const betweenQuestionAndColon = expr
        .substring(questionIndex + 1, colonIndex)
        .trim();
      const afterColon = expr.substring(colonIndex + 1).trim();

      // 检查问号之后和冒号之后的表达式是否是函数
      if (!isFunction(betweenQuestionAndColon) || !isFunction(afterColon)) {
        return false;
      }

      // 递归检查问号之前的表达式``
      return splitAndCheck(beforeQuestion);
    }

    // 开始递归检查整个表达式
    return splitAndCheck(expression);
  }
  //allowTaggedTemplates--->true
  isTaggedString(expression: string): boolean {
    // 正则表达式解释：
    // ^[a-zA-Z] - 字符串以一个字母开始
    // \\s+ - 后面跟着一个或多个空格
    // ' - 然后是一个双引号
    // .* - 引号内可以包含任意字符
    // '$ - 以双引号结束
    return isTaggedStringReg.test(expression);
  }
  private filterUnuseds(
    mergedOptions: Options,
    unuseds: NoUsedExpression[]
  ): NoUsedExpression[] {
    //开启检查
    //1.本地检查

    if (mergedOptions.allow.allowShortCircuit === true) {
      unuseds = unuseds.filter(
        (item) => !(item.exptype === ExpType.allowShortCircuit)
      );
    }
    //1.1是否过滤变量
    if (mergedOptions.allow.allowTaggedTemplates === true) {
      unuseds = unuseds.filter(
        (item) => !(item.exptype === ExpType.allowTaggedTemplates)
      );
    }
    //2.函数参数 (忽略最后调用之前--默认值)
    if (mergedOptions.allow.allowTernary === true) {
      unuseds = unuseds.filter(
        (item) => !(item.exptype === ExpType.allowTernary)
      );
    }

    return unuseds;
  }

  //判断是否是赋值语句
  public isAssignDefaultStatement(text: string): boolean {
    let containsInvalidChars = false;
    if (text.length === 0) {
      return true;
    }
    // 正则表达式用于检查字符串是否包含赋值操作符（=），
    // 确保赋值操作符的左边不是纯数字，
    //     ^：字符串的开始。
    // (?!\d+=)：负向前瞻断言，确保字符串不是以数字后跟等号开始的。
    // (?: ... )：非捕获组，用于组合多个选择。
    // (?:[^=\d]*=\s*)?：匹配零个或多个不是等号或数字的字符，后跟一个等号和任意数量的空白字符。整个组是可选的，以便 “delete” 可以在字符串的开始位置。
    // delete\s+：匹配 “delete” 字符串后跟至少一个空格。
    // .*：匹配任意数量的任意字符（除了换行符）。
    // |：逻辑“或”操作符，用于分隔两个选择。
    // [^=\d]+=.*$：匹配不是等号或数字的字符后跟等号，然后是任意数量的任意字符直到字符串的末尾。
    // (?:var|let|const)\s+：匹配 var、let 或 const 后跟至少一个空格。  const pattern = /^(?!\d+=)(?:(?:[^=\d]*=\s*)?delete\s+.*|[^=\d]+=.*$)/;
    containsInvalidChars = isAssignDefaultStatementReg.test(text);
    return !text.startsWith('/') && containsInvalidChars;
  }
  private isAssignText(text: string): boolean {
    const result = text.split('=');
    return result.length >= 2 && result[1] !== '';

  }

  private addIssueReport(noUsedExpression: NoUsedExpression, name: string): void {
    const severity = this.rule.alert ?? this.metaData.severity;
    const warnInfo = this.getLineAndColumn(noUsedExpression.stmt, name);
    if (noUsedExpression.posion) {
      warnInfo.line = noUsedExpression.posion[0];
      warnInfo.startCol = noUsedExpression.posion[1];
      warnInfo.endCol = noUsedExpression.posion[1];
    }
    const defect = new Defects(
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
    this.defects.push(defect);
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }

  private getLineAndColumn(
    stmt: Stmt,
    name: string
  ): { line: number; startCol: number; endCol: number; filePath: string } {
    const originPosition = stmt.getOriginPositionInfo();
    const line = originPosition.getLineNo();
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
    if (arkFile) {
      const originText = stmt.getOriginalText() ?? '';
      let startCol = originPosition.getColNo();
      const pos = originText.indexOf(name);
      if (pos !== -1) {
        startCol += pos;
        const endCol = startCol + name.length - 1;
        const originPath = arkFile.getFilePath();
        return { line, startCol, endCol, filePath: originPath };
      }
    } else {
      logger.debug('originStmt or arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }
  private processExpress(
    stmts: Stmt[],
    noUsedExpression: NoUsedExpression[],
    exportLineNo: number
  ): void {
    let prevStm: Stmt = stmts[0];
    for (const index in stmts) {
      const statement = stmts[index];
      const nowline = statement.getOriginPositionInfo().getLineNo() ?? -1;
      const originalText = statement.getOriginalText() ?? '';
      const isValidTernary = statement instanceof ArkAssignStmt && 
      (this.isValidTernary(statement.getRightOp().toString()) || this.funcInTernary(originalText));
      let exists = this.checkExpression(noUsedExpression, nowline);
      exists = this.execPress(originalText, isValidTernary, noUsedExpression, prevStm, nowline);
      prevStm = this.execAsignStmt(
        statement,
        prevStm,
        originalText,
        exists,
        isValidTernary,
        noUsedExpression,
        index,
        stmts,
        nowline,
        exportLineNo
      );

      const invockeStmt = CheckerUtils.getInvokeExprFromAwaitStmt(statement);
      this.execInvoke(invockeStmt, noUsedExpression, exists, statement, originalText);
    }
  }
//处理 (function(){}) ? a() : b();
  private funcInTernary(text: string): boolean {
   return !this.isAssignText(text) && this.isValidTernary(text);
  }

  private execPress(
    originalText: string,
    isValidTernary: boolean,
    noUsedExpression: NoUsedExpression[],
    prevStm: Stmt,
    nowline: number
  ): boolean {
    let exists = false;
    this.execText(originalText, isValidTernary);
    if (this.textTernaryBefor !== '') {
      if (!exists && this.TernaryErrorCount === 0) {
        noUsedExpression.push({
          stmt: prevStm,
          originalText: this.textTernaryBefor,
          exptype: ExpType.allowTernary,
        });
      } else if (!this.textTernaryBefor.startsWith('await') && !funcCallReg.test(this.textTernaryBefor.trim())) {
        noUsedExpression.push({
          stmt: prevStm,
          originalText: this.textTernaryBefor,
        });
      }
      this.textTernary = '';
      this.textTernaryBefor = '';
      this.TernaryErrorCount = 0;
    }
    if (this.textCircuitBefor !== '' && !logicalAssignReg.test(this.textCircuitBefor)) {
      exists = this.checkExpression(noUsedExpression, nowline);
      if (!exists && this.CircuitErrorCount === 0 && !this.isAssignText(this.textCircuitBefor) && !this.textCircuitBefor.startsWith('await')) {
        noUsedExpression.push({
          stmt: prevStm,
          originalText: this.textCircuitBefor,
          exptype: ExpType.allowShortCircuit,
        });
      } else {
        noUsedExpression.push({
          stmt: prevStm,
          originalText: this.textCircuit,
        });
      }
      this.textCircuit = '';
      this.textCircuitBefor = '';
      this.CircuitErrorCount = 0;
    }
    return exists;
  }

  private execPressV(
    currentOriginalText: string,
    leftOp: Value,
    rightOp: Value
  ): boolean {
    const leftOPScene = leftOp as Scene_base;
    const isCircuit = this.isCircuit(rightOp) && leftOPScene?.usedStmts?.length === 0 && leftOp.toString().startsWith('%');
    if (this.textCircuit === '' && isCircuit && !logicalAssignReg.test(currentOriginalText)) {
      this.textCircuit = currentOriginalText;
    }
    if (this.textTernary !== '' && currentOriginalText === this.textTernary) {
      let isValidTernary;
      if (leftOp.toString().startsWith('%')) {
        isValidTernary = this.allowTernaryExpressions(rightOp);
      } else {
        isValidTernary = true;
      }
      if (!isValidTernary) {
        this.TernaryErrorCount++;
      }
    }
    if (
      this.textCircuit === currentOriginalText &&
      !this.allowShortCircuitExpressions(rightOp)
    ) {
      this.CircuitErrorCount += 1;
    }
    return isCircuit;
  }

  private execText(originalText: string, isValidTernary: boolean): void {
    if (this.textTernary !== '' && originalText !== this.textTernary) {
      this.textTernaryBefor = this.textTernary;
    }
    if (this.textCircuit !== '' && originalText !== this.textCircuit) {
      this.textCircuitBefor = this.textCircuit;
    }
    if (this.textTernary === '' && isValidTernary) {
      this.textTernary = originalText;
    }
  }

  private execEnd(
    index: string,
    stmts: Stmt[],
    noUsedExpression: NoUsedExpression[],
    nowline: number,
    statement: Stmt,
    exists: boolean
  ): boolean {
    //排除最后还有语句
    if (Number(index) === stmts.length - 1) {
      if (this.textTernaryBefor !== '') {
        exists = this.checkExpression(noUsedExpression, nowline);
        if (!exists && this.TernaryErrorCount === 0) {
          noUsedExpression.push({
            stmt: statement,
            originalText: this.textTernary,
            exptype: ExpType.allowTernary,
          });
        } else {
          noUsedExpression.push({
            stmt: statement,
            originalText: this.textTernary,
          });
        }
        this.textTernary = '';
        this.textTernaryBefor = '';
        this.TernaryErrorCount = 0;
      }

      if (this.textCircuitBefor !== '') {
        exists = this.checkExpression(noUsedExpression, nowline);
        if (!exists && this.CircuitErrorCount === 0) {
          noUsedExpression.push({
            stmt: statement,
            originalText: this.textCircuit,
            exptype: ExpType.allowShortCircuit,
          });
        } else {
          noUsedExpression.push({
            stmt: statement,
            originalText: this.textCircuit,
          });
        }
        this.textCircuit = '';
        this.textCircuitBefor = '';
        this.CircuitErrorCount = 0;
      }
    }
    return exists;
  }

  private execInvoke(
    invockeStmt: AbstractInvokeExpr | null,
    noUsedExpression: NoUsedExpression[],
    exists: boolean,
    statement: Stmt,
    originalText: string
  ) {
    if (invockeStmt) {
      const args = invockeStmt.getArgs();
      //排除特殊情况 
      const invokeName = invockeStmt?.getMethodSignature()?.getMethodSubSignature()?.getMethodName() ?? '';
      const originalText = statement.getOriginalText() ?? '';
      const isAssign = this.isAssignText(originalText) || 
      (originalText.startsWith('new') && !originalText.includes('.'));
      const otherTions = ['await', 'log', 'Boolean', 'RegExp', 'info', 'err'];
      const isTagTem = !originalText.includes('(') || (originalText.includes('(') && originalText.includes('`') && !originalText.includes(').'));
      if (isTagTem && !isAssign && !exists && !otherTions.includes(invokeName) && args.some((item) => 
        item.toString().startsWith('%') && !(item.getType() instanceof FunctionType ))) {
        noUsedExpression.push({
          stmt: statement,
          originalText: originalText,
          exptype: ExpType.allowTaggedTemplates,
        });
      }
    }
  }

  private execAsignStmt(
    statement: Stmt,
    prevStm: Stmt,
    originalText: string,
    exists: boolean,
    isValidTernary: boolean,
    noUsedExpression: NoUsedExpression[],
    index: string,
    stmts: Stmt[],
    nowline: number,
    exportLineNo: number
  ): Stmt {
    if (statement instanceof ArkAssignStmt) {
      prevStm = statement;
      const leftOp = statement.getLeftOp();
      const rightOp = statement.getRightOp();
      if (leftOp.toString() === 'this') {
        return prevStm;
      }
      const isCircuit = this.execPressV(originalText, leftOp, rightOp);
      if (
        !exists &&
        !isCircuit &&
        !isValidTernary &&
        this.isNoExpression(statement)
      ) {
        if (this.isAssignDefaultStatement(rightOp.toString()) || logicalAssignReg.test(rightOp.toString()) || this.isKeyWord(originalText)) {
          return prevStm;
        } else if (!this.removeSemicolonAndCheckExclamation(originalText) && !this.isFunctionCall(originalText) && 
        (!this.isFirstStringNoAsgin(index, leftOp, rightOp, originalText) || 
        (this.isFirstStringNoAsgin(index, leftOp, rightOp, originalText) && nowline > exportLineNo))
        ) {
          noUsedExpression.push({
            stmt: statement,
            originalText: originalText,
          });
        }
        
      }

      exists = this.execEnd(
        index,
        stmts,
        noUsedExpression,
        nowline,
        statement,
        exists
      );
    }
    return prevStm;
  }

  private isFirstStringNoAsgin(index:string, leftOp: Value, rightOp: Value, originalText: string): boolean {
    const num: number = Number(index) ?? -1; 
   const result = (num === 1 && leftOp.toString() === '%0' && rightOp.getType() instanceof StringType && 
   (originalText.trim().startsWith('\'') || originalText.trim().startsWith('\"'))) && !includeOperator.test(originalText);
    return result;
  }

  private removeSemicolonAndCheckExclamation(originalText: string): boolean {
    // 如果以分号结尾，删除分号
    if (originalText.endsWith(';')) {
        originalText = originalText.slice(0, -1);
    }
    // 判断是否以 "!" 结尾
    return originalText.endsWith('!') && !originalText.includes('==');
}

private isFunctionCall(originalText: string): boolean {
  // 如果以分号结尾，删除分号
  if (originalText.endsWith(';')) {
      originalText = originalText.slice(0, -1);
  }
  // 判断是否以 "!" 结尾
  return isfunCallReg.test(originalText) || (originalText.startsWith('/') && originalText.endsWith(')'));
}

  private isKeyWord(text: string): boolean {
    const keywords = ['yield'];
    return keywords.includes(text);
  }


}
