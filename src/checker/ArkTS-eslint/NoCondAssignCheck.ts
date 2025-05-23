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

import { ArkFile, AstTreeUtils, ts } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { RuleListUtil } from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoCondAssignCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/no-cond-assign.md",
  description: "Disallow assignment operators in conditional expressions.",
};

export class NoCondAssignCheck implements BaseChecker {
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;

  private defualtOption: string = "except-parens";
  private option: string = this.defualtOption;

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
   * 判断 TypeScript 代码中条件表达式的合法性，并返回不合法的行列号和错误信息
   * @param sourceFile 要检查的 TypeScript 代码
   * @param mode 检查模式，"always" 表示任何赋值都是错误的，其他模式表示仅当赋值括在括号中时才允许
   * @returns 包含不合法条件表达式位置和错误信息的对象数组
   */
  private checkConditionValidity(sourceFile: ts.SourceFile, mode: string): { line: number, startCol: number, endCol: number, message: string }[] {
    const invalidPositions: { line: number, startCol: number, endCol: number, message: string }[] = [];
    this.traverseNodes(sourceFile, mode, invalidPositions);
    return invalidPositions;
  }

  private traverseNodes(
      sourceFile: ts.SourceFile,
      mode: string,
      invalidPositions: { line: number, startCol: number, endCol: number, message: string }[]
  ): void {
      const checkNode = (node: ts.Node): void => {
          if (this.isConditionalStatement(node)) {
              const condition = this.getCondition(node);
              if (!condition) {
                return;
              }

              if (mode === 'always' && this.containsEqualsSign(condition)) {
                  const containsEqualsSignNode = this.findContainsEqualsSignNode(condition);
                  this.addInvalidPosition(
                      sourceFile,
                      containsEqualsSignNode,
                      invalidPositions,
                      `Unexpected assignment within a '${this.getConditionalType(node)}' statement`
                  );
              } else if (this.isInvalidAssignment(condition)) {
                  const containsEqualsSignNode = this.findContainsEqualsSignNode(condition);
                  this.addInvalidPosition(
                      sourceFile,
                      containsEqualsSignNode,
                      invalidPositions,
                      'Expected a conditional expression and instead saw an assignment'
                  );
              }
          }
          ts.forEachChild(node, checkNode);
      };

      checkNode(sourceFile);
  }

  private findContainsEqualsSignNode(node: ts.Node): ts.Node {
    if (ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.SlashEqualsToken
      )) {
      return node;
    }

    let cNode = node;
    const findNode = (node: ts.Node): void => {
      if (
        ts.isBinaryExpression(node) &&
        ( node.operatorToken.kind === ts.SyntaxKind.EqualsToken || 
          node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken ||
          node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken ||
          node.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken ||
          node.operatorToken.kind === ts.SyntaxKind.SlashEqualsToken
        )
      ) {
        cNode = node;
        return;
      }
      ts.forEachChild(node, findNode);
    };
    ts.forEachChild(cNode, findNode);
    return cNode;
  }

  private isConditionalStatement(node: ts.Node): boolean {
      return ts.isIfStatement(node) ||
       ts.isForStatement(node) || 
       ts.isWhileStatement(node) || 
       ts.isConditionalExpression(node) ||
       ts.isDoStatement(node);
  }

  private getCondition(node: ts.Node): ts.Expression | undefined {
      if (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
          return node.expression;
      } else if (ts.isForStatement(node) || ts.isConditionalExpression(node)) {
          return node.condition;
      }
      return undefined;
  }

  private containsEqualsSign(condition: ts.Node): boolean {
      const conditionText = condition.getText();
      const equalsRegex = /(?<![=!])=(?!=)/;
      return equalsRegex.test(conditionText);
  }

  private isInvalidAssignment(condition: ts.Expression): boolean {
      if (ts.isConditionalExpression(condition.parent) && ts.isParenthesizedExpression(condition)) {
          const realCondition = condition.expression;
          return (
            ts.isBinaryExpression(realCondition) &&
            ( realCondition.operatorToken.kind === ts.SyntaxKind.EqualsToken || 
              realCondition.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken ||
              realCondition.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken ||
              realCondition.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken ||
              realCondition.operatorToken.kind === ts.SyntaxKind.SlashEqualsToken
            )
          );
      }
      return (
          ts.isBinaryExpression(condition) &&
          ( condition.operatorToken.kind === ts.SyntaxKind.EqualsToken || 
            condition.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken ||
            condition.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken ||
            condition.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken ||
            condition.operatorToken.kind === ts.SyntaxKind.SlashEqualsToken
          ) &&
          !ts.isParenthesizedExpression(condition.parent)
      );
  }

  private addInvalidPosition(
      sourceFile: ts.SourceFile,
      node: ts.Node,
      invalidPositions: { line: number, startCol: number, endCol: number, message: string }[],
      message: string
  ): void {
      const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      invalidPositions.push({
          line: startLine + 1,
          startCol: startCol + 1,
          endCol: endCol + 1,
          message,
      });
  }

  private getConditionalType(node: ts.Node): string {
      if (ts.isIfStatement(node)) {
        return 'if';
      }
      if (ts.isForStatement(node)) {
        return 'for';
      }
      if (ts.isWhileStatement(node)) {
        return 'while';
      }
      if (ts.isDoStatement(node)) {
        return 'do...while';
      }
      return 'unknown';
  }

  public check = (target: ArkFile) => {
    const severity = this.rule.alert ?? this.metaData.severity;
    if (this.rule.option && this.rule.option && this.rule.option[0]) {
      this.option = this.rule.option[0] as string;
    }
    const sourceFile: ts.SourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    const myInvalidPositions = this.checkConditionValidity(sourceFile, this.option);
    myInvalidPositions.forEach(pos => {
      this.addIssueReport(pos, severity, target.getFilePath());
    });
  }
    
  private addIssueReport(pos: { line: number, startCol: number, endCol: number, message: string }, severity: number, filePath: string): void {
    let defects = new Defects(pos.line, pos.startCol, pos.endCol, pos.message, severity, this.rule.ruleId,
      filePath, this.metaData.ruleDocPath, true, false, true);
    this.issues.push(new IssueReport(defects, undefined));
    RuleListUtil.push(defects);
  }
}
