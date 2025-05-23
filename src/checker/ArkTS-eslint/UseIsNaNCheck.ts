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


import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UseIsNaNCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: 'docs/use-isnan.md',
  description: 'Require calls to `isNaN()` when checking for `NaN`',
};

function isSpecificId(node: ts.Node, name: string): boolean {
  return ts.isIdentifier(node) && node.text === name;
}

function isSpecificMemberAccess(node: ts.Node, objectName: string, propertyName: string): boolean {
  return (ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) && node.expression.text === objectName &&
    ts.isIdentifier(node.name) && node.name.text === propertyName) ||
    (ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) && node.expression.text === objectName &&
      ts.isStringLiteral(node.argumentExpression) && node.argumentExpression.text === propertyName);
}

function isNaNIdentifier(node: ts.Node): boolean {
  if (ts.isParenthesizedExpression(node)) {
    let express = node.expression;
    if (ts.isBinaryExpression(express)) {
      return isNaNIdentifier(express.right);
    }
    return isNaNIdentifier(express);
  }

  return isSpecificId(node, 'NaN') || isSpecificMemberAccess(node, 'Number', 'NaN');
}

function containsNaN(node: ts.Node): boolean {
  if (isNaNIdentifier(node)) {
    return true;
  }
  if (ts.isParenthesizedExpression(node)) {
    return containsNaN(node.expression);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
    return containsNaN(node.right);
  }
  if (ts.isCommaListExpression(node)) {
    return node.elements.some(element => containsNaN(element));
  }
  return false;
}

class ReportBean {
  line: number;
  character: number;
  message: string;
  sourceCode: string;
}
const operator = /^(?:[<>]|[!=]=)=?$/u;
export class UseIsNaNCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private defalutOptions = [{ enforceForSwitchCase: true, enforceForIndexOf: false }];
  private options: { enforceForSwitchCase: boolean, enforceForIndexOf: boolean };
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  public registerMatchers(): MatcherCallback[] {
    const matchFileCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    }
    return [matchFileCb];
  }

  /**
   * 检查 TypeScript 代码中是否正确使用 isNaN 或 Number.isNaN 来检查 NaN
   * @param code 要检查的 TypeScript 代码
   * @returns 包含错误位置的对象数组
   */
  public checkUseIsNaN(sourceFile: ts.SourceFile): ReportBean[] {
    const errorPositions: ReportBean[] = [];
    this.checkNode(sourceFile, sourceFile, errorPositions);
    return errorPositions;
  }

  private checkNode(node: ts.Node, sourceFile: ts.SourceFile, errorPositions: ReportBean[]): void {
    const enforceForIndexOf = this.options.enforceForIndexOf ?? false;
    const enforceForSwitchCase = this.options.enforceForSwitchCase ?? true;

    if (ts.isBinaryExpression(node)) {
      const left = node.left;
      const right = node.right;
      if ((isNaNIdentifier(left) || isNaNIdentifier(right)) && operator.test(node.operatorToken.getText())) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        errorPositions.push({
          line: line + 1, character: character + 1,
          message: 'Use the isNaN function to compare with NaN', sourceCode: node.getText()
        });
      }
    }

    if (enforceForSwitchCase && ts.isSwitchStatement(node)) {
      this.checkSwitchCase(node, sourceFile, errorPositions);
    }

    if (enforceForIndexOf && ts.isCallExpression(node)) {
      this.checkEnforceForIndexOf(node, sourceFile, errorPositions);
    }
    ts.forEachChild(node, (node) => this.checkNode(node, sourceFile, errorPositions));
  }

  private checkSwitchCase(node: ts.SwitchStatement, sourceFile: ts.SourceFile, errorPositions:
    ReportBean[]): void {
    if (isNaNIdentifier(node.expression)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      errorPositions.push({
        line: line + 1, character: character + 1,
        message: "'switch(NaN)' can never match a case clause. Use Number.isNaN instead of the switch", sourceCode: node.getText()
      });
    }

    for (const switchCase of node.caseBlock.clauses) {
      if ((switchCase as ts.CaseClause).expression && isNaNIdentifier((switchCase as ts.CaseClause).expression)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(switchCase.getStart());
        errorPositions.push({
          line: line + 1, character: character + 1,
          message: "'case NaN' can never match. Use Number.isNaN before the switch", sourceCode: node.getText()
        });
      }
    }
  }

  private checkEnforceForIndexOf(node: ts.CallExpression, sourceFile: ts.SourceFile, errorPositions:
    ReportBean[]): void {
    const expression = node.expression;
    const callee = ts.isParenthesizedExpression(expression) ? expression.expression : expression;
    if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
      const methodName = ts.isPropertyAccessExpression(callee) ? callee.name.text :
        ts.isElementAccessExpression(callee) && ts.isStringLiteral(callee.argumentExpression) ?
          callee.argumentExpression.text : null;
      if (methodName) {
        this.checkIndexOf(methodName, node, sourceFile, errorPositions);
      }
    }
  }

  private checkIndexOf(methodName: string, node: ts.CallExpression,
    sourceFile: ts.SourceFile, errorPositions: ReportBean[]): void {
    if (['indexOf', 'lastIndexOf'].includes(methodName) &&
      (node.arguments.length > 0 && node.arguments.length <= 2 && isNaNIdentifier(node.arguments[0]))) {
      this.checkIndexOfTraversal(methodName, node, sourceFile, errorPositions);
    }
  }

  private checkIndexOfTraversal(methodName: string, node: ts.CallExpression,
    sourceFile: ts.SourceFile, errorPositions: ReportBean[]): void {
    for (const arg of node.arguments) {
      if (containsNaN(arg)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        errorPositions.push({
          line: line + 1, character: character + 1,
          message: `Array prototype method '${methodName}' cannot find NaN.`, sourceCode: node.getText()
        });
        break;
      }
    }
  }

  private getOption = (rule: Rule) => {
    let option = this.defalutOptions[0] as { enforceForSwitchCase: boolean, enforceForIndexOf: boolean };
    if (rule && rule.option[0]) {
      option = rule.option[0] as { enforceForSwitchCase: boolean, enforceForIndexOf: boolean };
    }
    return option;
  }

  public check = (target: ArkFile) => {
    // Assuming getCode() returns the code as a string
    // 检查整个文件中是否使用了 isNaN 或 Number.isNaN
    this.options = this.getOption(this.rule);
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    const errorPositions = this.checkUseIsNaN(sourceFile);
    for (const position of errorPositions) {
      this.addIssueReport(target, position.line, position.character, position.sourceCode, position.message);
    }
  }

  private addIssueReport(arkFile: ArkFile, lineNum: number, startColum: number, code: string, message: string) {
    let filePath = arkFile.getFilePath();
    let endColum = startColum + code.length - 1;
    const severity = this.rule.alert ?? this.metaData.severity;
    let defect = new Defects(
      lineNum,
      startColum,
      endColum,
      message,
      severity,
      this.rule.ruleId,
      filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }
}

