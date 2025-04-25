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
import { ArkFile, ts, Stmt, ArkAssignStmt, Local, ArkInvokeStmt, ArkInstanceInvokeExpr, Value, ArkMethod } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { MatcherCallback, MatcherTypes, FileMatcher, ClassMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleFix } from '../../model/Fix';
import { AstTreeUtils } from 'arkanalyzer';
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: 'docs/prefer-reduce-type-parameter-check.md',
  description: 'Unnecessary cast: Array#reduce accepts a type parameter for the default value.',
  defaultOptions: [],
};
interface LocationInfo {
  line: number;
  character?: number;
  startCol: number;
  endCol: number;
  node?: ts.Node;
  filePath: string;
  argString?: string;
}

export class PreferReduceTypeParameterCheck implements BaseChecker {
  public issues: IssueReport[] = [];
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public sourceFile: ts.SourceFile;
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };
  public registerMatchers(): MatcherCallback[] {
    const fileMatcher: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    };
    return [fileMatcher];
  }

  public check = (target: ArkFile): void => {
    if (target instanceof ArkFile) {
      this.sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    }
    const classes = target.getClasses() ?? [];
    classes.forEach(clazz => {
      const methods = clazz.getMethods();
      this.getStmts(methods, target);
    });
  };
  private getStmts(methods: ArkMethod[], target: ArkFile): void {
    let record: Map<string, string> = new Map();
    methods.forEach(method => {
      const stmts = method?.getBody()?.getCfg().getStmts() ?? [];
      stmts.forEach(stmt => {
        const originText = stmt.getOriginalText() ?? '';
        const position = stmt.getOriginPositionInfo();
        const key = `${position.getLineNo()}:${position.getColNo()}`;
        if (!record.has(key) && originText) {
          this.checkForReduceTypeParameter(originText, target, stmt);
          record.set(key, originText);
        }
      });
    });
  }


  private checkForReduceTypeParameter(originText: string, target: ArkFile, stmt: Stmt): void {
    let sourceFile = AstTreeUtils.getASTNode('', originText);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const { isReduceMethod, targetExpression } = this.checkIsReduceMethod(node);
        if (isReduceMethod && targetExpression) {
          this.processReduceArguments(node, originText, stmt);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  private checkIsReduceMethod(node: ts.CallExpression): { isReduceMethod: boolean; targetExpression: ts.Expression | undefined } {
    let isReduceMethod = false;
    let targetExpression: ts.Expression | undefined;

    const checkPropertyAccess = (expr: ts.PropertyAccessExpression): boolean => {
      const methodName = expr.name.text;
      return methodName === 'reduce';
    };

    const checkElementAccess = (expr: ts.ElementAccessExpression): boolean => {
      const arg = expr.argumentExpression;
      return ts.isStringLiteral(arg) && (arg.text === 'reduce');
    };

    if (ts.isPropertyAccessExpression(node.expression)) {
      isReduceMethod = checkPropertyAccess(node.expression);
      targetExpression = node.expression.expression;
    } else if (ts.isElementAccessExpression(node.expression)) {
      isReduceMethod = checkElementAccess(node.expression);
      targetExpression = node.expression.expression;
    }

    return { isReduceMethod, targetExpression };
  }


  private processReduceArguments(node: ts.CallExpression, originText: string, stmt: Stmt): void {
    const args = node.arguments;
    if (args.length < 2) {
      return;
    }


    const secondArg = args[1];
    if (secondArg.getChildCount() <= 1) {
      return;
    }
    let secondArgText = '';
    let secondArgTextFull = secondArg.getText();

    if (secondArgTextFull.startsWith('<')) {
      if (!ts.isAsExpression(secondArg) && !ts.isTypeAssertionExpression(secondArg)) {
        return;
      }
      secondArgText = secondArg.getChildren()[1].getText();
      if (this.isArrayType(stmt)) {
        const firstArg = args[0].getText();
        const warnInfo = this.getWarnInfo(secondArg.getText(), stmt);
        const pureInitialValue = secondArg.getChildren()[secondArg.getChildCount() - 1].getText();
        this.addIssueReportNodeFix(this.sourceFile, warnInfo, stmt, node, secondArgText, firstArg, pureInitialValue);
      }
    } else {
      if (!ts.isAsExpression(secondArg) && !ts.isTypeAssertionExpression(secondArg)) {
        return;
      }
      secondArgText = secondArg.getChildren()[secondArg.getChildCount() - 1].getText();
      const firstArg = args[0].getText();
      const initialValueText = originText.slice(secondArg.getStart(), secondArg.getEnd());
      const pureInitialValue = initialValueText.replace(/\s+as\s+.+$/, '');
      if (this.isArrayType(stmt)) {
        const warnInfo = this.getWarnInfo(secondArg.getText(), stmt);
        this.addIssueReportNodeFix(this.sourceFile, warnInfo, stmt, node, secondArgText, firstArg, pureInitialValue);
      }
    }
  }


  private getReduceInfo(checkText: string, stmt: Stmt): LocationInfo {
    const text = stmt.getOriginalText();
    if (text === undefined) {
      return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
    const arrayLentgth = this.getRedueceTextForArray(text);
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
    if (!arkFile || !text || text.length === 0) {
      return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
    const normalize = (str: string): string => str
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ');
    const normalizedText = normalize(text);
    const normalizedCheck = normalize(checkText);
    const startIndex = normalizedText.indexOf(normalizedCheck);

    if (startIndex === -1) {
      return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
    const rawLines = text.split(/\r?\n/);
    let currentPos = 0;
    let targetLine = -1;
    let targetColumn = -1;
    for (let lineNum = 0; lineNum < rawLines.length; lineNum++) {
      const lineLength = rawLines[lineNum].length + 1;
      if (currentPos <= startIndex && startIndex < currentPos + lineLength) {
        targetLine = lineNum;
        targetColumn = startIndex - currentPos;
        break;
      }
      currentPos += lineLength;
    }

    const originalPosition = stmt.getOriginPositionInfo();
    stmt.getOriginalText();
    originalPosition.getColNo();
    return {
      line: originalPosition.getLineNo() + targetLine,
      startCol: originalPosition.getColNo() + arrayLentgth,
      endCol: checkText.length,
      filePath: arkFile.getFilePath(),
      argString: checkText
    };
  }

  private getRedueceTextForArray(arrayText: string): number {
    const parts = arrayText.split(/\.reduce(?:Right)?\(/);
    return parts.length > 1 ? parts[0].length : 0;
  }
  private getWarnInfo(checkText: string, stmt: Stmt): LocationInfo {
    const text = stmt.getOriginalText();
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
    if (!arkFile || !text || text.length === 0) {
      return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
    let lineCount = - 1;
    let startColum = - 1;
    let originalPosition = stmt.getOriginPositionInfo();
    const sparse = originalPosition.getColNo();
    const originalTexts = text.split('\n');
    for (let originalText of originalTexts) {
      lineCount++;
      if (originalText.includes(checkText)) {
        if (lineCount === 0) {
          startColum = originalText.indexOf(checkText) + sparse;
        } else {
          startColum = originalText.indexOf(checkText) + 1;
        }
        break;
      }
    }
    if (startColum === -1) {
      return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
    let lineNo = originalPosition.getLineNo() + lineCount;
    const endColumn = startColum + checkText.length - 1;
    const filePath = arkFile.getFilePath();
    return { line: lineNo, startCol: startColum, endCol: endColumn, filePath: filePath, argString: checkText };
  }

  private isArrayType(stmt: Stmt): boolean {
    let isArray = false;
    let retuenType = this.getTypeForReduce(stmt);
    if (retuenType.includes('[') && retuenType.includes('[]') && retuenType.includes(']') && !retuenType.includes('|')) {
      isArray = true;
    }
    return isArray;
  }
  getTypeForReduce(stmt: Stmt): string {
    if (stmt instanceof ArkAssignStmt) {
      let leftOp = stmt.getLeftOp();
      return this.getType(leftOp);
    }
    return 'unknown';
  }

  getType(stmt: Stmt | Value): string {
    if (!(stmt instanceof Local)) {
      return 'unknown';
    }

    for (const used of stmt.getUsedStmts()) {
      const type = this.getTypeFromUsedStmt(used);
      if (type !== 'unknown') {
        return type;
      }
    }

    return 'unknown';
  }

  getTypeFromUsedStmt(used: Stmt): string {
    if (used instanceof ArkInvokeStmt) {
      return this.getTypeFromInvokeStmt(used);
    }

    if (used instanceof ArkAssignStmt) {
      return this.getTypeFromAssignStmt(used);
    }

    return 'unknown';
  }

  getTypeFromInvokeStmt(invokeStmt: ArkInvokeStmt): string {
    const invokeExpr = invokeStmt.getInvokeExpr();
    if (invokeExpr instanceof ArkInstanceInvokeExpr) {
      const type = invokeExpr.getBase().getType().getTypeString();
      if (!type.startsWith('@')) {
        return type;
      }
    }
    return 'unknown';
  }

  getTypeFromAssignStmt(assignStmt: ArkAssignStmt): string {
    const usedRightOp = assignStmt.getRightOp();
    if (usedRightOp instanceof ArkInstanceInvokeExpr) {
      const invokeExpr = usedRightOp.getBase();
      if (invokeExpr instanceof Local) {
        return invokeExpr.getType().getTypeString();
      }
    }
    const usedLeftOp = assignStmt.getLeftOp();
    return this.getType(usedLeftOp);
  }

  private reduceruleFix(sourceFile: ts.SourceFile, loc: LocationInfo,
    secondArgText: string, firstText: string, repleaseText: string, pureInitialValue: string): RuleFix {
    // 获取原始调用特征
    const originalCall = repleaseText;
    const typeParam = secondArgText.replace(/^as\s+/, '');

    // 分析原始参数格式特征
    const paramStartIndex = originalCall.indexOf('(');
    const paramEndIndex = originalCall.lastIndexOf(')');
    const originalParams = originalCall.slice(paramStartIndex + 1, paramEndIndex);

    // 判断原始格式类型（单行/多行）
    const isMultiline = originalParams.includes('\n');
    const indent = isMultiline ? '\n  ' : '';
    const lineEnd = isMultiline ? '\n' : '';

    // 构建符合原始格式的新参数
    const newParams = `${indent}${firstText},${indent}${pureInitialValue}${lineEnd}`;

    const newReduceCall = `${originalCall.split('.reduce')[0]}.reduce<${typeParam}>(${newParams})`;
    const startPos = this.sourceFile.getPositionOfLineAndCharacter(loc.line! - 1, loc.startCol! - 1);
    return {
      range: [startPos, startPos + loc.endCol],
      text: newReduceCall
    };
  }

  private addIssueReportNodeFix(sourceFile: ts.SourceFile, loc: LocationInfo, stmt: Stmt, node: ts.Node,
    secondArgText: string, firstText: string, pureInitialValue: string): void {
    let repleaseText = this.getRedueceText(node);
    stmt.getOriginPositionInfo().getColNo();
    let locs = this.getReduceInfo(this.getRedueceText(node), stmt);
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(loc.line, loc.startCol, loc.endCol, this.metaData.description, severity,
      this.rule.ruleId, loc.filePath, this.metaData.ruleDocPath, true, false, true);
    let fix: RuleFix = this.reduceruleFix(sourceFile, locs, secondArgText, firstText, repleaseText, pureInitialValue);
    this.issues.push(new IssueReport(defect, fix));
    RuleListUtil.push(defect);
  }

  private getRedueceText(node: ts.Node): string {
    if (ts.isCallExpression(node)) {
      const fullText = node.getText();
      // 使用正则匹配 .reduce 或 .reduceRight 及其参数部分
      const match = fullText.match(/\.reduce(?:Right)?\([^]*\)/);
      return match ? match[0] : fullText;
    }
    return node.getText();
  }
}