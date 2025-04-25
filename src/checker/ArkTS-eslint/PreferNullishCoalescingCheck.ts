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
import { RuleListUtil } from '../../utils/common/DefectsList';
import { AbstractBinopExpr, ArkAssignStmt, ArkFile, Stmt, ts, ArkIfStmt, ArkClass, ArkNormalBinopExpr, Local } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { AstTreeUtils } from 'arkanalyzer';
import { Rule } from '../../model/Rule';
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PreferNullishCoalescing');

interface Condition {
  bigint: false,
  boolean: false,
  number: false,
  string: false,
}

interface Options {
  allowRuleToRunWithoutStrictNullChecks?: boolean;
  ignoreConditionalTests?: boolean;
  ignoreTernaryTests?: boolean;
  ignoreMixedLogicalExpressions?: boolean;
  ignorePrimitives?: Condition;
}

export class PreferNullishCoalescingCheck implements BaseChecker {
  private processedStatements = new Set<string>();
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private defaultOptions: Options = {
    ignoreConditionalTests: false,
    ignoreTernaryTests: false,
    ignoreMixedLogicalExpressions: false,
    ignorePrimitives: {
      bigint: false,
      boolean: false,
      number: false,
      string: false,
    }
  };
  public metaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/prefer-nullish-coalescing-check.md',
    description: 'Enforce using nullish coalescing operator instead of logical OR',
  };

  private options: Options;

  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  public registerMatchers(): MatcherCallback[] {
    const matchfileBuildCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    };
    return [matchfileBuildCb];
  }

  public check = (targetField: ArkFile): void => {
    this.options = this.rule && this.rule.option[0] ? this.rule.option[0] as Options : this.defaultOptions;
    const classes = targetField.getClasses() ?? [];
    // 使用并行处理类
    classes.forEach(clazz => {
      // 异步处理每个类，避免阻塞主线程
      void Promise.resolve().then(() => this.getStmts(clazz)); 
    });
  };

  private getStmts(clazz: ArkClass): void {
    let record: Map<string, string> = new Map();
    const methods = clazz.getMethods();
    // 减少循环嵌套，使用 for...of 循环替代 forEach
    for (const method of methods) {
      const stmts = method?.getBody()?.getCfg().getStmts() ?? [];
      for (const stmt of stmts) {
        const originText = stmt.getOriginalText() ?? '';
        const position = stmt.getOriginPositionInfo();
        const key = `${position.getLineNo()}:${position.getColNo()}`;
        if (!record.has(key) && originText) {
          // 缓存 AST 节点，避免重复解析
          const sourceFile = AstTreeUtils.getASTNode('', originText);
          this.executeCheckWithCachedAST(sourceFile, stmt);
          record.set(key, originText);
        }
      }
    }
  }

  // 优化思路：1. 提前终止不必要的递归；2. 使用尾递归优化；3. 减少重复判断。
  private executeCheckWithCachedAST(sourceFile: ts.SourceFile, stmt: Stmt): void {
    // 提取 options 到局部变量，减少属性访问
    const { ignoreTernaryTests } = this.options;
    const checkNode = (node: ts.Node): void => {
      if (ignoreTernaryTests && !(ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
        return;
      }
      if (!ignoreTernaryTests && ts.isConditionalExpression(node) && !this.isConditionalExpression(node)) {
        this.checkConditionalExpression(node, stmt);
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        this.checkLogicalOrExpression(node, stmt);
      }
      // 尾递归优化，使用 forEach 代替递归调用
      ts.forEachChild(node, checkNode);
    };

    ts.forEachChild(sourceFile, checkNode);
  }

  isConditionalExpression(node: ts.ConditionalExpression): boolean {
    let isConditional = false;
    if (ts.isBinaryExpression(node.condition)) {
      const condition = node.condition;
      if (condition.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        const left = condition.left;
        const right = condition.right;
        if (!ts.isBinaryExpression(left) && !ts.isBinaryExpression(right)) {
          isConditional = true;
        }
      }
    }
    return isConditional;
  }

  private executeCheck(originText: string, stmt: Stmt): void {
    let sourceFile = AstTreeUtils.getASTNode('', originText);
    const checkNode = (node: ts.Node): void => {
      if (!this.options.ignoreTernaryTests && ts.isConditionalExpression(node) &&
        !this.isConditionalExpression(node)) {
        this.checkConditionalExpression(node, stmt);
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        this.checkLogicalOrExpression(node, stmt);
      }
      ts.forEachChild(node, checkNode);
    };

    ts.forEachChild(sourceFile, checkNode);
  }

  private checkConditionalExpression(node: ts.ConditionalExpression, stmt: Stmt): void {
    if (this.options.ignoreTernaryTests) {
      return;
    }

    const { testNodes, operator } = this.checkCondition(node.condition);
    if (!operator) {
      return;
    }

    const { identifier, hasNull, hasUndefined } = this.validateTestNodes(testNodes, node, operator);
    if (this.shouldSkipReport(stmt, operator, identifier, hasNull, hasUndefined)) {
      return;
    }

    this.addIssueReportForTernaryTests(stmt);
  }

  private checkCondition(condition: ts.Node): { testNodes: ts.Node[], operator?: ts.SyntaxKind } {
    if (ts.isBinaryExpression(condition)) {
      switch (condition.operatorToken.kind) {
        case ts.SyntaxKind.BarBarToken:
          return this.handleLogicalOr(condition);
        case ts.SyntaxKind.AmpersandAmpersandToken:
          return this.handleLogicalAnd(condition);
        default:
          return this.handleBasicBinary(condition);
      }
    }
    return { testNodes: [] };
  }

  private handleLogicalOr(condition: ts.BinaryExpression): { testNodes: ts.Node[]; operator?: ts.SyntaxKind } {
    const left = condition.left;
    const right = condition.right;
    if (ts.isBinaryExpression(left) && ts.isBinaryExpression(right)) {
      const sameOperator = left.operatorToken.kind === right.operatorToken.kind;
      const isLeftCheck = this.isNullCheckOperator(left.operatorToken.kind) &&
        (this.isNull(left.right) || this.isUndefinedIdentifier(left.right));
      const isRightCheck = this.isNullCheckOperator(right.operatorToken.kind) &&
        (this.isNull(right.right) || this.isUndefinedIdentifier(right.right));

      if (isLeftCheck && isRightCheck && this.isSameNode(left.left, right.left) && sameOperator) {
        return {
          testNodes: [left.left, left.right, right.left, right.right],
          operator: ts.SyntaxKind.EqualsEqualsToken
        };
      }
    }
    return { testNodes: [] };
  }

  private handleLogicalAnd(condition: ts.BinaryExpression): { testNodes: ts.Node[]; operator?: ts.SyntaxKind } {
    const left = condition.left;
    const right = condition.right;
    if (ts.isBinaryExpression(left) && ts.isBinaryExpression(right)) {
      const isEqualsEqualsEqualsToken = left.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        right.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken;
      const sameOperator = left.operatorToken.kind === right.operatorToken.kind;
      const isLeftStrict = this.isStrictNullCheck(left);
      const isRightStrict = this.isStrictNullCheck(right);

      if (isLeftStrict && isRightStrict && this.isSameNode(left.left, right.left) &&
        sameOperator && !isEqualsEqualsEqualsToken) {
        const hasNullCheck = this.isNull(left.right) || this.isNull(right.right);
        const hasUndefinedCheck = this.isUndefinedIdentifier(left.right) || this.isUndefinedIdentifier(right.right);

        if (hasNullCheck && hasUndefinedCheck) {
          return {
            testNodes: [left.left, left.right, right.left, right.right],
            operator: ts.SyntaxKind.ExclamationEqualsEqualsToken
          };
        }
      }
    }
    return { testNodes: [] };
  }

  private handleBasicBinary(condition: ts.BinaryExpression): { testNodes: ts.Node[]; operator?: ts.SyntaxKind } {
    const operatorKind = condition.operatorToken.kind;
    return this.isNullCheckOperator(operatorKind) ? {
      testNodes: [condition.left, condition.right],
      operator: operatorKind
    } : { testNodes: [] };
  }

  private validateTestNodes(testNodes: ts.Node[], node: ts.ConditionalExpression, operator: ts.SyntaxKind): 
  { identifier?: ts.Node; hasNull: boolean; hasUndefined: boolean } {
    let identifier: ts.Node | undefined;
    let hasNull = false;
    let hasUndefined = false;

    for (const testNode of testNodes) {
      if (this.isNull(testNode)) {
        hasNull = true;
      } else if (this.isUndefinedIdentifier(testNode)) {
        hasUndefined = true;
      } else if (this.isMatchingIdentifier(testNode, node, operator)) {
        identifier = testNode;
      } else {
        break;
      }
    }
    return { identifier, hasNull, hasUndefined };
  }

  private isMatchingIdentifier(testNode: ts.Node, node: ts.ConditionalExpression, operator: ts.SyntaxKind): boolean {
    return (operator === ts.SyntaxKind.EqualsEqualsToken && this.isSameNode(testNode, node.whenFalse)) ||
      (operator === ts.SyntaxKind.EqualsEqualsEqualsToken && this.isSameNode(testNode, node.whenFalse)) ||
      (operator === ts.SyntaxKind.ExclamationEqualsEqualsToken && this.isSameNode(testNode, node.whenTrue)) ||
      (operator === ts.SyntaxKind.ExclamationEqualsToken && this.isSameNode(testNode, node.whenTrue));
  }

  private shouldSkipReport(stmt: Stmt, operator: ts.SyntaxKind, identifier?: ts.Node,
    hasNull?: boolean, hasUndefined?: boolean): boolean | undefined {
    if (this.isIncludeundefindOrNull(stmt) &&
      operator !== ts.SyntaxKind.ExclamationEqualsToken &&
      operator !== ts.SyntaxKind.EqualsEqualsToken &&
      identifier
    ) {
      return (hasNull && !hasUndefined) || (hasUndefined && !hasNull);
    }
    return !identifier || (!(hasNull || hasUndefined) && !(hasNull && hasUndefined));
  }

  isIncludeundefindOrNull(stmt: Stmt): boolean {
    if (stmt instanceof ArkIfStmt) {
      let op1Type = stmt.getConditionExpr().getOp1().getType().getTypeString();
      let op2Type = stmt.getConditionExpr().getOp2().getType().getTypeString();
      if ((op1Type.includes('undefined') && op1Type.includes('null')) ||
        (op2Type.includes('undefined') && op2Type.includes('null'))) {
        return true;
      }
    }
    return false;
  }
  private checkLogicalOrExpression(node: ts.BinaryExpression, stmt: Stmt): void {
    if (this.options.ignoreMixedLogicalExpressions) {
      return;
    }
    if (this.isTernaryExpression(stmt)) {
      return;
    }
    if (this.options.ignoreMixedLogicalExpressions && this.isMixedLogicalExpression(node)) {
      return;
    }
    if (this.options.ignoreConditionalTests && this.isConditionalTest(node)) {
      return;
    }

    const leftType = this.isLogicalNullOrUndefined(stmt);
    const rightType = this.isRightNotNullOrUndefind(stmt);

    if (!leftType) {
      return;
    }
    if (rightType.undefindExpress !== undefined && rightType.includeOther.includes('=')) {
      return;
    }
    this.addIssueReportForConditionalTests(stmt);
  }

  private isTernaryExpression(stmt: Stmt): boolean {
    let text = stmt.getOriginalText() ?? '';
    const ternaryPattern =
      /^\s*([\s\S]+?)\s*\?\s*([\s\S]+?)\s*:\s*([\s\S]+)\s*$/;
    // 修改后的条件匹配规则，要求必须包含null/undefined检查
    const conditionPattern =
      /(\b\w+\s*(===|!==|==|!=)\s*(null|undefined)\b)(\s*\|\|\s*(\b\w+\s*(===|!==|==|!=)\s*(null|undefined)\b))+\s*\?/;
    return ternaryPattern.test(text) && conditionPattern.test(text);
  }


  private isNullCheckOperator(kind: ts.SyntaxKind): boolean {
    return kind === ts.SyntaxKind.EqualsEqualsToken ||
      kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      kind === ts.SyntaxKind.ExclamationEqualsToken ||
      kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
  }

  private isStrictNullCheck(expr: ts.BinaryExpression): boolean {
    return expr.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      expr.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
  }

  private isNull(node: ts.Node): boolean {
    return node.kind === ts.SyntaxKind.NullKeyword;
  }

  private isUndefinedIdentifier(node: ts.Node): boolean {
    return ts.isIdentifier(node) && node.text === 'undefined';
  }

  private isSameNode(a: ts.Node, b: ts.Node): boolean {

    return a.getText() === b.getText();
  }

  private isMixedLogicalExpression(node: ts.Node): boolean {
    let hasOr = false;
    let hasAnd = false;

    const checkNode = (current: ts.Node): void => {
      if (ts.isParenthesizedExpression(current)) {
        checkNode(current.expression);
        return;
      }
      if (ts.isBinaryExpression(current)) {
        if (current.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
          hasOr = true;
        } else if (current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
          hasAnd = true;
        }
        checkNode(current.left);
        checkNode(current.right);
      }
    };
    checkNode(node);
    return hasOr && hasAnd;
  }

  private isConditionalTest(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    const parents = new Set<ts.Node>([node]);
    while (current.parent) {
      parents.add(current.parent);
      current = current.parent;
      if (ts.isIfStatement(current) ||
        ts.isWhileStatement(current) ||
        ts.isDoStatement(current) ||
        ts.isForStatement(current) ||
        ts.isConditionalExpression(current)) {
        return true;
      }
      if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
        return false;
      }
    }
    return false;
  }

  private isLogicalNullOrUndefined(stmt: Stmt): boolean {
    if (!(stmt instanceof ArkAssignStmt)) {
      return false;
    }
    const rightOp = stmt.getRightOp();
    if (!(rightOp instanceof AbstractBinopExpr)) {
      return false;
    }
    return this.checkTypesValid(rightOp);
  }

  // 新增方法：类型检查主逻辑
  private checkTypesValid(expr: AbstractBinopExpr): boolean {
    const leftType = expr.getOp1().getType().getTypeString();
    const rightType = expr.getOp2().getType().getTypeString();
    return this.checkTypeIncludesNullUndefined(leftType) ||
      this.checkTypeIncludesNullUndefined(rightType);
  }

  private isRightNotNullOrUndefind(stmt: Stmt): { undefindExpress: string, includeOther: string } {
    let isNotNullOrUndefind = {
      undefindExpress: '',
      includeOther: ''
    };
    if (stmt instanceof ArkAssignStmt) {
      let rightOp = stmt.getRightOp();
      if (rightOp instanceof ArkNormalBinopExpr) {
        let op1 = rightOp.getOp1();
        if (op1 instanceof Local) {
          let op1Declear = op1.getDeclaringStmt();
          if (op1Declear instanceof ArkAssignStmt) {
            let op1Right = op1Declear.getRightOp();
            isNotNullOrUndefind = {
              undefindExpress: op1Right.getType().getTypeString(),
              includeOther: op1Declear.getOriginalText() ?? ''
            };
          }
        }
      }
    }
    return isNotNullOrUndefind;
  }



  // 新增方法：单个类型检查
  private checkTypeIncludesNullUndefined(typeString: string): boolean {
    return !this.shouldIgnoreType(typeString) &&
      (typeString.includes('null') || typeString.includes('undefined'));
  }

  // 提取原有 shouldIgnoreType 逻辑为独立方法
  private shouldIgnoreType(type: string): boolean | undefined {
    return (
      (type.includes('string') && this.options.ignorePrimitives?.string) ||
      (type.includes('number') && this.options.ignorePrimitives?.number) ||
      (type.includes('bigint') && this.options.ignorePrimitives?.bigint) ||
      (type.includes('boolean') && this.options.ignorePrimitives?.boolean)
    );
  }

  private addIssueReportForTernaryTests(stmt: Stmt): void {
    const severity = this.rule.alert ?? this.metaData.severity;
    let lineAndColLocation = stmt.getOriginPositionInfo();
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
    let textLength = 0;
    if (stmt !== undefined && stmt.getOriginalText() !== undefined) {
      textLength = stmt.getOriginalText()?.length ?? 0;
    }
    let endCol = lineAndColLocation.getColNo() + textLength;
    let message = 'Prefer using nullish coalescing operator (`??`) instead of a ternary expression, as it is simpler to read.';
    let defects = new Defects(lineAndColLocation.getLineNo(), lineAndColLocation.getColNo(), endCol,
      message, severity, this.rule.ruleId, arkFile.getFilePath(), this.metaData.ruleDocPath, true, false, true);
    this.issues.push(new IssueReport(defects, undefined));
    RuleListUtil.push(defects);
  }

  private addIssueReportForConditionalTests(stmt: Stmt): void {
    const position = stmt.getOriginPositionInfo();
    const stmtHash = `${stmt.getOriginalText()}_${position.getLineNo()}_${position.getColNo()}`;
    if (this.processedStatements.has(stmtHash)) {
      return;
    }
    this.processedStatements.add(stmtHash);
    const severity = this.rule.alert ?? this.metaData.severity;
    const warnInfos = this.getLineAndColumns(stmt);
    const message = 'Prefer using nullish coalescing operator (`??`) instead of a logical or (`||`), as it is a safer operator.';
    warnInfos.forEach(warnInfo => {
      const defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol,
        message, severity, this.rule.ruleId, warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
      this.issues.push(new IssueReport(defect, undefined));
      RuleListUtil.push(defect);
    });
  }

  private getLineAndColumns(stmt: Stmt): Array<{
    line: number; startCol: number;
    endCol: number; filePath: string
  }> {
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
    if (!arkFile) {
      return [{ line: -1, startCol: -1, endCol: -1, filePath: '' }];
    }
    const baseLine = stmt.getOriginPositionInfo().getLineNo();
    const originText = stmt.getOriginalText() ?? '';
    return this.processAllLines(originText, baseLine, arkFile.getFilePath());
  }

  // 处理所有行文本
  private processAllLines(text: string, baseLine: number, filePath: string):
    Array<{ line: number; startCol: number; endCol: number; filePath: string }> {
    const results = [];
    const lines = text.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineResults = this.processLine(lines[lineIndex], lineIndex, baseLine, filePath);
      results.push(...lineResults);
    }
    return results.length > 0 ? results : [{ line: -1, startCol: -1, endCol: -1, filePath: '' }];
  }

  // 处理单行文本
  private processLine(lineText: string, lineIndex: number, baseLine: number, filePath: string):
    Array<{ line: number; startCol: number; endCol: number; filePath: string }> {
    const lineResults = [];
    let searchPos = 0;

    while ((searchPos = lineText.indexOf('||', searchPos)) !== -1) {
      const actualLine = baseLine + lineIndex;
      const startCol = searchPos + 1;
      lineResults.push({
        line: actualLine,
        startCol: startCol,
        endCol: startCol + 1,
        filePath: filePath
      });
      searchPos += 2;
    }

    return lineResults;
  }
}