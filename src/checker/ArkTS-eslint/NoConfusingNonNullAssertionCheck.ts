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

import { RuleListUtil } from "../../utils/common/DefectsList";
import { ArkFile, ts } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects } from "../../model/Defects";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { AstTreeUtils } from "arkanalyzer";
import { Rule } from "../../model/Rule";
import { IssueReport } from '../../model/Defects';
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoConfusingNonNullAssertionCheck');

interface RuleResult {
  line: number;
  character: number;
  endCol: number;
  message: string;
}

export class NoConfusingNonNullAssertionCheck implements BaseChecker {
  public metaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-confusing-non-null-assertion.md',
    description: 'Confusing combinations of non-null assertion and equal test like "a! == b", which looks very similar to not equal "a !== b',
  };
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  public registerMatchers(): MatcherCallback[] {
    const fileMatcher: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    }
    return [fileMatcher];
  }

  public check = (targetField: ArkFile) => {
    const filePath = targetField.getFilePath();
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
    this.checkConfusingNonNullAssertion(sourceFile).forEach((item) => {
      this.addIssueReport(item.line, item.character, item.endCol, filePath, item.message);
    });
  }
  private checkConfusingNonNullAssertion(sourceFile: ts.SourceFile): RuleResult[] {
    const results: RuleResult[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isBinaryExpression(node)) {
        this.handleBinaryExpression(node, sourceFile, results);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return results;
  }

  private getNextToken(token: ts.Node | undefined, sourceFile: ts.SourceFile): ts.Node | undefined {
    if (!token) {
      return undefined;
    }
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, sourceFile.text);
    scanner.setTextPos(token.end);
    while (true) {
      const tokenSyntaxKind = scanner.scan();
      if (tokenSyntaxKind === ts.SyntaxKind.EndOfFileToken) {
        break;
      }
      const nextTokenStart = scanner.getTokenPos();
      const nextTokenEnd = scanner.getTextPos();
      const nextTokenText = sourceFile.text.substring(nextTokenStart, nextTokenEnd);
      if (!/\s/.test(nextTokenText) && !this.isComment(nextTokenText)) {
        return this.findNodeAtPosition(sourceFile, nextTokenStart, nextTokenEnd);
      }
    }
    return undefined;
  }

  private findNodeAtPosition(sourceFile: ts.SourceFile, start: number, end: number): ts.Node | undefined {
    let result: ts.Node | undefined = undefined;
    ts.forEachChild(sourceFile, node => {
      if (node.pos <= start && node.end >= end) {
        result = node;
      }
    });
    return result;
  }

  private isComment(text: string): boolean {
    return /\/\*[\s\S]*?\*\/|\/\/.*/.test(text);
  }
  private handleBinaryExpression(node: ts.BinaryExpression, sourceFile: ts.SourceFile, results: RuleResult[]): void {
    const operator = node.operatorToken.getText();
    if (!this.isTargetOperator(operator)) {
      return;
    }

    const isAssign = operator === '=';
    const leftHandFinalToken = node.left.getLastToken();
    const tokenAfterLeft = this.getNextToken(leftHandFinalToken, sourceFile);

    if (this.hasConfusingExclamation(leftHandFinalToken, tokenAfterLeft)) {
      this.processExpression(node, sourceFile, results, isAssign);
    }
  }

  private isTargetOperator(operator: string): boolean {
    return ['==', '===', '='].includes(operator);
  }

  private hasConfusingExclamation(leftHandFinalToken?: ts.Node, tokenAfterLeft?: ts.Node): boolean {
    return leftHandFinalToken?.kind === ts.SyntaxKind.ExclamationToken &&
      tokenAfterLeft?.kind !== ts.SyntaxKind.CloseParenToken;
  }

  private processExpression(node: ts.BinaryExpression, sourceFile: ts.SourceFile, results: RuleResult[], isAssign: boolean): void {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { character: endChar } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    // 修改检测逻辑：检查左侧表达式是否包含非空断言
    const result = this.containsNonNullAssertion(node.left)
      ? this.createPrimaryExpressionResult(line, character, endChar, isAssign)
      : this.createFallbackResult(line, character, endChar);

    results.push(result);
  }

  // 新增辅助方法：递归检查表达式中的非空断言
  private containsNonNullAssertion(node: ts.Node): boolean {
    if (ts.isNonNullExpression(node)) {
      return true;
    }
    return node.getChildren().some(child => this.containsNonNullAssertion(child));
  }

  private createPrimaryExpressionResult(line: number, char: number, endChar: number, isAssign: boolean): RuleResult {
    return {
      line: line + 1,
      character: char + 1,
      endCol: endChar + 1,
      message: this.getPrimaryExpressionMessage(isAssign)
    };
  }

  private createFallbackResult(line: number, char: number, endChar: number): RuleResult {
    return {
      line: line + 1,
      character: char + 1,
      endCol: endChar + 1,
      message: 'Wrap up left hand to avoid putting non-null assertion "!" and "=" together.'
    };
  }

  private getPrimaryExpressionMessage(isAssign: boolean): string {
    return isAssign
      ? 'Confusing combinations of non-null assertion and equal test like "a! = b", which looks very similar to not equal "a != b".'
      : 'Confusing combinations of non-null assertion and equal test like "a! == b", which looks very similar to not equal "a !== b".';
  }
  private async addIssueReport(line: number, startCol: number, endCol: number, filePath: string, description: string) {
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(line, startCol, endCol, description, severity,
      this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defect, undefined))
    RuleListUtil.push(defect);
  }
}
