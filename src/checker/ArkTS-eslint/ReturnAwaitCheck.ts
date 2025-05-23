/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { RuleListUtil } from '../../utils/common/DefectsList';
import { ArkFile, Stmt, ts, ArkReturnStmt, Local, ArkAwaitExpr, ArkAssignStmt, BasicBlock, ArkInstanceInvokeExpr, ArkMethod, ArkBody, ArkStaticInvokeExpr, Value, ArkPtrInvokeExpr, FunctionType } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { AstTreeUtils } from 'arkanalyzer';
import { Rule } from '../../model/Rule';
import { IssueReport } from '../../model/Defects';
import { RuleFix } from '../../model/Fix';
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ReturnAwaitCheck');


type Options = ['in-try-catch' | 'always' | 'never'];

interface LocationInfo {
  line: number;
  character: number;
  startCol: number;
  endCol: number;
  returnString: string;
  testObjectText?: string;
}

export class ReturnAwaitCheck implements BaseChecker {
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  public metaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/return-await.md',
    description: 'Enforce consistent returning of awaited values.',
  };
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };
  private defaultOptions: Options = ['in-try-catch'];
  private promiseTypeCache = new Map<string, boolean>();
  private ancestorCache = new Map<string, boolean>();
  private asyncFunctions: ts.FunctionLikeDeclaration[] = [];
  private returnStatements = new Map<ts.FunctionLikeDeclaration, ts.ReturnStatement[]>();
  private declarationCache = new Map<string, ts.Node>();
  private tryStmts: Stmt[] = [];
  private catchStmts: Stmt[] = [];
  private norStmts: Stmt[] = [];
  private filePath: string = '';
  private sourceFile: ts.SourceFile;
  public registerMatchers(): MatcherCallback[] {
    const fileMatcher: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    };
    return [fileMatcher];
  }

  public check = (target: ArkFile): void => {
    this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
    this.resetCheckerState(target);
    this.processClassMethods(target);
    this.collectAllAsyncFunctions();
    this.analyzeAllAsyncFunctions();
  };

  // 提取的初始化方法
  private resetCheckerState(target: ArkFile): void {
    this.promiseTypeCache.clear();
    this.ancestorCache.clear();
    this.asyncFunctions = [];
    this.returnStatements.clear();
    this.declarationCache.clear();
    this.filePath = target.getFilePath();
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    this.sourceFile = sourceFile;
  }

  // 提取的类处理方法
  private processClassMethods(target: ArkFile): void {
    target.getClasses().forEach(clazz => {
      clazz.getMethods().forEach(method => {
        this.processMethodStatements(method);
      });
    });
  }

  // 提取的方法语句处理
  private processMethodStatements(method: ArkMethod): void {
    const stmts = method?.getBody()?.getCfg().getStmts() ?? [];
    stmts.forEach(stmt => {
      if (stmt !== undefined) {
        this.norStmts.push(stmt);
      }
    });
    method?.getBody()?.getTraps()?.forEach(trap => {
      const tryBlocks = trap.getTryBlocks();
      const catchBlocks = trap.getCatchBlocks();
      tryBlocks?.forEach(tryBlock => {
        this.tryStmts.push(...tryBlock.getStmts());
      });
      catchBlocks?.forEach(catchBlock =>
        this.catchStmts.push(...catchBlock.getStmts())
      );
    });
  }

  // 提取的异步函数收集
  private collectAllAsyncFunctions(): void {
    this.collectAsyncFunctions(this.sourceFile);
    this.collectDeclarations(this.sourceFile);
    this.collectReturnStatements();
  }

  // 提取的异步函数分析
  private analyzeAllAsyncFunctions(): void {
    this.asyncFunctions.forEach(node => {
      this.analyzeFunction(node, this.filePath);
    });
  }


  private collectAsyncFunctions(sourceFile: ts.SourceFile): void {
    const visit = (node: ts.Node): void => {
      // 新增变量声明检测
      if (ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isArrowFunction(node.initializer) &&
        node.initializer.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
        this.asyncFunctions.push(node.initializer);
      }

      if ((ts.isFunctionDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
        node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
        this.asyncFunctions.push(node);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  private collectDeclarations(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      this.declarationCache.set(node.name.text, node);
    }
    ts.forEachChild(node, child => this.collectDeclarations(child));
  }

  private collectReturnStatements(): void {
    this.asyncFunctions.forEach(funcNode => {
      const returns: ts.ReturnStatement[] = [];

      const visit = (node: ts.Node): void => {
        // 新增嵌套函数过滤逻辑
        if (ts.isFunctionLike(node) && node !== funcNode) {
          return;
        }

        if (ts.isReturnStatement(node) && node.expression) {
          returns.push(node);
        }
        if (ts.isArrowFunction(funcNode) &&
          !ts.isBlock(funcNode.body) &&
          node === funcNode.body) {
          const virtualReturn = ts.factory.createReturnStatement(node as ts.Expression);
          returns.push(virtualReturn);
        }
        ts.forEachChild(node, visit);
      };

      ts.forEachChild(funcNode, visit);
      this.returnStatements.set(funcNode, returns);
    });
  }

  private analyzeFunction(funcNode: ts.FunctionLikeDeclaration, filePath: string): void {
    const returns = this.returnStatements.get(funcNode) || [];
    returns.forEach(node => {
      if (node.expression) {
        this.testReturnStatement(node.expression, filePath);
      }
    });
  }
  private containsAwait(node: ts.Node): boolean {
    if (ts.isAwaitExpression(node)) {
      return true;
    }
    // 递归检查子节点
    let found = false;
    ts.forEachChild(node, child => {
      if (this.containsAwait(child)) {
        found = true;
      }
    });
    return found;
  }
  private testReturnStatement(expression: ts.Expression, filePath: string): void {
    let child: ts.Node;
    const isAwait = ts.isAwaitExpression(expression);
    if (isAwait) {
      child = expression.expression;
    } else {
      child = expression;
    }
    let isFalseBranch = false;
    let isThenable: boolean = false;
    if (this.isPromiseType(child) instanceof Object) {
      let promiseObj = this.isPromiseType(child) as { isPromise: boolean, isFalseBranch: boolean };
      isThenable = promiseObj.isPromise;
      isFalseBranch = promiseObj.isFalseBranch;
    } else {
      isThenable = this.isPromiseType(child) as boolean;
    }

    if (!isAwait && !isThenable) {
      return;
    }
    if (isAwait && !isThenable) {
      this.reportIssue(expression, filePath, 'nonPromiseAwait', 'not-in-try-catch', isFalseBranch);
      return;
    }
    if (this.defaultOptions[0] === 'never' || (this.defaultOptions[0] === 'in-try-catch' && !this.isInTryCatch(expression))) {
      if (isAwait) {
        this.reportIssue(expression, filePath, 'disallowedPromiseAwait', 'not-in-try-catch', isFalseBranch);
        return;
      }
    }
    if (this.defaultOptions[0] === 'always') {
      this.alwaysOption(expression, isAwait, isThenable, filePath, isFalseBranch);
    }
    if (this.defaultOptions[0] === 'never') {
      this.NeverOption(expression, isAwait, isThenable, filePath, isFalseBranch);
    }
    if (this.defaultOptions[0] === 'in-try-catch') {
      this.inTryCatch(expression, isAwait, isThenable, filePath, isFalseBranch);
    }
  }
  private alwaysOption(expression: ts.Expression, isAwait: boolean, isThenable: boolean, filePath: string, isFalseBranch: boolean): void {
    if (!isAwait && isThenable) {
      this.reportIssue(expression, filePath, 'requiredPromiseAwait', 'always-fix', isFalseBranch);
    }
    return;
  }

  private NeverOption(expression: ts.Expression, isAwait: boolean, isThenable: boolean, filePath: string, isFalseBranch: boolean): void {
    if (isAwait) {
      this.reportIssue(expression, filePath, 'disallowedPromiseAwait', 'not-in-try-catch', isFalseBranch);
    }
  }
  private inTryCatch(expression: ts.Expression, isAwait: boolean, isThenable: boolean, filePath: string, isFalseBranch: boolean): void {
    const isInTry = this.inTry(expression);
    const isInCatch = this.inCatch(expression);
    const isInFinally = this.isReturnPromiseInFinally(expression);
    const hasFinally = this.hasFinallyBlock(expression);
    if (isInTry && isThenable && !isAwait) {
      this.reportIssue(expression, filePath, 'requiredPromiseAwait', 'in-try-catch', isFalseBranch);
      return;
    }
    if (isInCatch && !hasFinally) {
      return;
    }
    if (isInCatch && hasFinally && isThenable && !isAwait) {
      this.reportIssue(expression, filePath, 'requiredPromiseAwait', 'in-try-catch', isFalseBranch);
      return;
    }
    if (isInFinally) {
      return;
    }
  }

  private isInTryCatch(expression: ts.Expression): boolean {
    const isInTry = this.inTry(expression);
    const isInCatch = this.inCatch(expression);
    const isInFinally = this.isReturnPromiseInFinally(expression);
    return isInTry || isInCatch || isInFinally;
  }


  private isPromiseType(node: ts.Node, stmtAwait?: Stmt): boolean | { isPromise: boolean, isFalseBranch: boolean } {
    let isPromise: boolean | { isPromise: boolean, isFalseBranch: boolean } = false;
    let pos = ts.getLineAndCharacterOfPosition(this.sourceFile, node.getStart());
    this.norStmts.forEach(stmt => {
      if (stmt.getOriginPositionInfo().getLineNo() === pos.line + 1) {
        stmtAwait = stmt;
      }
    });
    this.tryStmts.forEach(stmt => {
      if (stmt.getOriginPositionInfo().getLineNo() === pos.line + 1) {
        stmtAwait = stmt;
      }
    });
    this.catchStmts.forEach(stmt => {
      if (stmt.getOriginPositionInfo().getLineNo() === pos.line + 1) {
        stmtAwait = stmt;
      }
    });
    if (stmtAwait instanceof ArkReturnStmt) {
      isPromise = this.isVarReturnPro(stmtAwait);
    }
    return isPromise;
  }

  private isVarReturnPro(stmt: Stmt): boolean | { isPromise: boolean, isFalseBranch: boolean } {
    if (!(stmt instanceof ArkReturnStmt)) {
      return false;
    }
    const op = stmt.getOp();
    // 修改返回值结构以包含分支信息
    const ternaryResult = this.checkTernary(stmt);
    if (ternaryResult.isTernary) {
      return {
        isPromise: true,
        isFalseBranch: ternaryResult.isFalseBranch
      };
    }

    return this.checkLocalReturn(op) || this.checkAwaitReturn(op) || this.checkMethodType(op);
  }
  private checkTernary(stmt: Stmt): { isTernary: boolean, isFalseBranch: boolean } {
    let typeString = '';
    let isTernary = false;
    let isFalseBranch = false;
    if (stmt instanceof ArkReturnStmt) {
      stmt.getCfg().getBlocks().forEach(block => {
        let predecessor = block.getPredecessors();
        typeString = this.TernayString(predecessor);
        if (typeString.includes('Promise<')) {
          isTernary = true;
          isFalseBranch = true;
        }
      });
    }
    return { isTernary, isFalseBranch };
  }

  private TernayString(blocks: BasicBlock[]): string {
    let ternaryString = '';
    if (blocks.length === 2) {
      blocks.forEach(pre => {
        let stmts = pre.getStmts();
        if (stmts.length === 1) {
          let stmt = stmts[0];
          ternaryString = this.getTernayString(stmt);
        }
      });
    }
    return ternaryString;
  }
  private getTernayString(stmt: Stmt): string {
    let ternaryString = '';
    if (stmt instanceof ArkAssignStmt) {
      let right = stmt.getRightOp();
      if (right instanceof ArkInstanceInvokeExpr) {
        let base = right.getBase();
        if (base instanceof Local) {
          ternaryString = base.getType().getTypeString();
        }
      }
    }
    return ternaryString;
  }

  private checkMethodType(op: unknown): boolean {
    if (!(op instanceof Local)) {
      return false;
    }

    const methods = this.getRelatedMethods(op);
    return this.checkMethodModifier(methods, op);
  }

  private getRelatedMethods(op: Local): ArkMethod[] {
    const declarer = op.getDeclaringStmt();
    return declarer?.getCfg()?.getDeclaringMethod()
      ?.getDeclaringArkClass()?.getMethods() || [];
  }

  private checkMethodModifier(methods: ArkMethod[], op: Local): boolean {
    const declarer = op.getDeclaringStmt();
    if (!(declarer instanceof ArkAssignStmt)) {
      return false;
    }

    const rightOp = declarer.getRightOp();
    if (!(rightOp instanceof ArkStaticInvokeExpr)) {
      return false;
    }

    const targetMethodName = rightOp.getMethodSignature()
      .getMethodSubSignature().getMethodName();

    return methods.some(method =>
      method.getName() === targetMethodName &&
      method.getModifiers() === 64
    );
  }


  private checkLocalReturn(op: unknown): boolean {
    if (!(op instanceof Local)) {
      return false;
    }

    const declear = op.getDeclaringStmt();
    return declear
      ? this.getDlears(declear).includes('Promise<T>')
      : false;
  }

  private checkAwaitReturn(op: unknown): boolean {
    if (!(op instanceof ArkAwaitExpr)) {
      return false;
    }

    const promise = op.getPromise();
    if (!(promise instanceof Local)) {
      return false;
    }

    const declear = promise.getDeclaringStmt();
    return declear
      ? this.getDlears(declear).includes('Promise<')
      : false;
  }


  getDlears(declare: Stmt, depth: number = 0): string {
    // 添加递归深度限制
    if (declare instanceof ArkAssignStmt) {
      const right = declare.getRightOp();
      return this.handleExpressionType(right, depth);
    }
    return 'unknown';
  }

  private handleExpressionType(expr: Value, depth: number): string {
    if (expr instanceof ArkInstanceInvokeExpr) {
      return this.handleInstanceInvoke(expr);
    }
    if (expr instanceof ArkPtrInvokeExpr) {
      return this.handlePtrInvoke(expr);
    }
    if (expr instanceof ArkStaticInvokeExpr) {
      return this.handleStaticInvoke(expr);
    }
    if (expr instanceof Local) {
      return this.handleLocal(expr, depth);
    }

    return 'unknown';
  }


  private handleInstanceInvoke(expr: ArkInstanceInvokeExpr): string {
    const base = expr.getBase();
    let typeString = '';
    if (base.getName() === 'this') {
      typeString = expr.getMethodSignature().getMethodSubSignature().getReturnType().getTypeString();
    } else {
      typeString = base.getType().getTypeString();
    }
    if (base instanceof Local) {
      let declaringStmt = base.getDeclaringStmt();
      if (declaringStmt) {
        typeString = this.handleArkAssignStmt(declaringStmt);
      }

    }
    return typeString;
  }
  private handleArkAssignStmt(declaringStmt: Stmt): string {
    let typeString = '';
    if (declaringStmt instanceof ArkAssignStmt) {
      const right = declaringStmt.getRightOp();
      if (right instanceof ArkInstanceInvokeExpr) {
        let base = right.getBase();
        if (base instanceof Local) {
          typeString = base.getType().getTypeString();
        }
      }
    }
    return typeString;
  }


  private handlePtrInvoke(expr: ArkPtrInvokeExpr): string {
    const funcPtr = expr.getFuncPtrLocal();
    if (!(funcPtr instanceof Local)) {
      return 'unknown';
    }

    const funcType = funcPtr.getType();
    return funcType instanceof FunctionType
      ? funcType.getMethodSignature().getMethodSubSignature().getReturnType().getTypeString()
      : 'unknown';
  }

  private handleStaticInvoke(expr: ArkStaticInvokeExpr): string {
    return expr.getMethodSignature().getMethodSubSignature().getReturnType().getTypeString();
  }

  private handleLocal(expr: Local, depth: number): string {
    const declaringStmt = expr.getDeclaringStmt();
    return declaringStmt ? this.getDlears(declaringStmt, depth + 1) : 'unknown';
  }


  private checkAncestor(node: ts.Node, type: string, predicate: (node: ts.Node) => boolean): boolean {
    const cacheKey = `${type}_${node.pos}_${node.end}`;
    if (this.ancestorCache.has(cacheKey)) {
      return this.ancestorCache.get(cacheKey)!;
    }

    let ancestor = node.parent;
    let depth = 0;
    const MAX_DEPTH = 10;
    while (ancestor && !ts.isFunctionLike(ancestor) && depth < MAX_DEPTH) {
      if (predicate(ancestor)) {
        this.ancestorCache.set(cacheKey, true);
        return true;
      }
      ancestor = ancestor.parent;
      depth++;
    }
    this.ancestorCache.set(cacheKey, false);
    return false;
  }

  private inTry(node: ts.Node): boolean {
    return this.checkAncestor(node, 'try', ancestor =>
      ts.isTryStatement(ancestor.parent) &&
      ts.isBlock(ancestor) &&
      ancestor.parent.tryBlock === ancestor
    );
  }

  private inCatch(node: ts.Node): boolean {
    return this.checkAncestor(node, 'catch', ancestor =>
      ts.isCatchClause(ancestor.parent) &&
      ts.isBlock(ancestor) &&
      ancestor.parent.block === ancestor
    );
  }

  private hasFinallyBlock(node: ts.Node): boolean {
    return this.checkAncestor(node, 'finally', ancestor =>
      ts.isTryStatement(ancestor) && !!ancestor.finallyBlock
    );
  }

  private isReturnPromiseInFinally(node: ts.Node): boolean {
    return this.checkAncestor(node, 'finallyReturn', ancestor =>
      ts.isTryStatement(ancestor.parent) &&
      ts.isBlock(ancestor) &&
      ancestor.parent.end === ancestor.end
    );
  }
  ruleFix(sourceFile: ts.SourceFile, loc: LocationInfo): RuleFix {
    const startPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.startCol - 1);
    if (loc.testObjectText === undefined) {
      return { range: [startPosition, startPosition], text: '' };
    }
    if (loc.returnString === 'in-try-catch') {
      let fixText: string = `await ${loc.testObjectText}`;
      return { range: [startPosition, startPosition + loc.testObjectText?.length], text: fixText };
    }
    if (loc.returnString === 'not-in-try-catch') {
      const originalText = loc.testObjectText || '';
      const fixedText = this.removeFirstAwait(originalText);
      return { range: [startPosition, startPosition + loc.testObjectText?.length], text: fixedText };
    }
    if (loc.returnString === 'always-fix') {
      let fixText: string = `await ${loc.testObjectText}`;
      return { range: [startPosition, startPosition + loc.testObjectText?.length], text: fixText };
    }
    return { range: [startPosition, startPosition], text: '' };
  }


  private removeFirstAwait(str: string): string {
    // 使用正则表达式匹配 await 关键字及后续空格
    const awaitPattern = /\bawait\s+/;
    const match = str.match(awaitPattern);

    if (!match) {
      return str;
    }

    // 计算需要替换的起始位置和长度
    const startIndex = str.indexOf(match[0]);
    const replaceLength = match[0].length;

    return str.substring(0, startIndex) +
      str.substring(startIndex + replaceLength);
  }

  private reportIssue(node: ts.Node, filePath: string, messageId: string, returnString: string, isFalseBranch: boolean): void {
    // 处理三元表达式的情况
    let targetNode = node;
    if (ts.isConditionalExpression(node) && isFalseBranch) {
      // 获取三元表达式的 false 分支（: 后面的部分）
      targetNode = node.whenFalse;
    } else if (ts.isConditionalExpression(node) && !isFalseBranch) {
      targetNode = node.whenTrue;
    }
    const pos = ts.getLineAndCharacterOfPosition(this.sourceFile, targetNode.getStart());
    const endPos = ts.getLineAndCharacterOfPosition(this.sourceFile, targetNode.getEnd());
    const description = this.getMessageDescription(messageId);
    let loc: LocationInfo = {
      line: pos.line + 1,
      character: pos.character + 1,
      startCol: pos.character + 1,
      endCol: endPos.character + 1,
      returnString: returnString,
      testObjectText: targetNode.getText()
    };
    const defect = new Defects(loc.line, loc.character, loc.endCol, description, this.rule.alert ?? this.metaData.severity, this.rule.ruleId,
      filePath, this.metaData.ruleDocPath, true, false, true);
    let fix: RuleFix = this.ruleFix(this.sourceFile, loc);
    this.issues.push(new IssueReport(defect, fix));
    RuleListUtil.push(defect);
  }

  private getMessageDescription(messageId: string): string {
    switch (messageId) {
      case 'nonPromiseAwait':
        return 'Returning an awaited value that is not a promise is not allowed.';
      case 'disallowedPromiseAwait':
        return 'Returning an awaited promise is not allowed in this context.';
      case 'requiredPromiseAwait':
        return 'Returning an awaited promise is required in this context.';
      default:
        return 'Unknown issue with return statement.';
    }
  }
}
