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

import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'DefaultCaseLastCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: 'docs/default-case-last-check.md',
  description: 'Default clause should be the last clause',
};

export class DefaultCaseLastCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
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

  public getAllComments = (code: string): string[] => {
    const comments: string[] = [];
    const commentRegex = /\/\/(.*)|\/\*([\s\S]*?)\*\//g;

    let match;
    while ((match = commentRegex.exec(code)) !== null) {
      if (match[1]) {
        // Single-line comment
        comments.push(match[1].trim());
      } else if (match[2]) {
        // Multi-line comment
        comments.push(match[2].trim());
      }
    }
    return comments;
  }

  /**
   * 检查 TypeScript 代码中switch代码块中default case是否在所有case中为最后一个，否则返回报错位置
   * @param code 要检查的 TypeScript 代码
   * @returns 包含default case不在最后一个位置的错误位置的对象数组
   */
  public checkDefaultCaseLast(target: ArkFile): { line: number, character: number, sourceCode: string }[] {
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    const defaultCasePositions: { line: number, character: number, sourceCode: string }[] = [];
    function checkNode(node: ts.Node) {
      if (ts.isSwitchStatement(node)) {
        const cases = node.caseBlock.clauses;
        const defaultCaseIndex = cases.findIndex(clause => ts.isDefaultClause(clause));
        if (defaultCaseIndex !== -1 && defaultCaseIndex !== cases.length - 1) {
          const defaultCase = cases[defaultCaseIndex];
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(defaultCase.getStart());
          defaultCasePositions.push({ line: line + 1, character: character + 1, sourceCode: defaultCase.getText() });
        }
      }
      ts.forEachChild(node, checkNode);
    }
    checkNode(sourceFile);
    return defaultCasePositions;
  }

  public check = (target: ArkFile) => {
    // Check for default case in switch statements
    const defaultCasePositions = this.checkDefaultCaseLast(target);
    for (const position of defaultCasePositions) {
      this.addIssueReport(target, position.line, position.character, position.sourceCode);
    }
  }

  public getCharPosition = (code: string, charIndex: number): { line: number, column: number } => {
    const lines = code.split('\n');
    let currentCharIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for the newline character
      if (currentCharIndex + lineLength > charIndex) {
        return { line: i + 1, column: charIndex - currentCharIndex + 1 };
      }
      currentCharIndex += lineLength;
    }
    throw new Error('Character index out of bounds');
  }

  private addIssueReport(arkFile: ArkFile, lineNum: number, startColum: number, code: string) {
    let filePath = arkFile.getFilePath();
    const severity = this.rule.alert ?? this.metaData.severity;
    let endColum = startColum + code.length - 1;
    let defect = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId,
      filePath, this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }
}
