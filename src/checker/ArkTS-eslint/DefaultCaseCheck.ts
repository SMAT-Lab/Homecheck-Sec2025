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

type Options = {
  commentPattern: string,
}

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'DefaultCaseCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: 'docs/default-case.md',
  description: 'Expected a default case',
};

export class DefaultCaseCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  private defalutOptions = [{ commentPattern: '' }];
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

  /**
   * 检查 TypeScript 代码中switch代码块中是否缺少default case，返回报错位置
   * @param code 要检查的 TypeScript 代码
   * @param options 包含commentPattern的选项对象
   * @returns 包含缺少default case错误位置的对象数组
   */
  public checkMissingDefaultCase(target: ArkFile, options: { commentPattern?: string } = {}): { line: number, character: number, code: string }[] {
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    const missingDefaultPositions: { line: number, character: number, code: string }[] = [];
    const commentPattern = options.commentPattern ? new RegExp(options.commentPattern, 'i') : null;

    this.checkNode(sourceFile, target.getCode(), commentPattern, missingDefaultPositions);
    return missingDefaultPositions;
  }

  private checkNode(
    node: ts.Node,
    code: string,
    commentPattern: RegExp | null,
    missingDefaultPositions: { line: number, character: number, code: string }[]
  ): void {
    if (ts.isSwitchStatement(node)) {
      if (node.caseBlock.clauses.length === 0) {
        return;
      }
      const hasDefaultCase = node.caseBlock.clauses.some(clause => ts.isDefaultClause(clause));
      const switchStart = node.getStart();
      const switchEnd = node.getEnd();
      const switchText = code.substring(switchStart, switchEnd);
      // 检查注释内容
      const noDefaultRegex = /\s*no\s*default/i;
      const comments = getAllComments(switchText);
      const lastComment = comments[comments.length - 1];
      const hasNoDefaultComment = lastComment ? commentPattern != null ? commentPattern?.test(lastComment) : noDefaultRegex.test(lastComment) : false;
      // 检查switch代码块的最后一行
      const switchLines = switchText.split('\n');
      const lastLine = switchLines[switchLines.length - 1].trim();
      const isLastLineComment = /^\s*\/\/.*$/.test(lastLine) && (noDefaultRegex.test(lastLine) || (commentPattern && commentPattern.test(lastLine)));
      if (!hasDefaultCase && !hasNoDefaultComment && !isLastLineComment) {
        const { line, character } = node.getSourceFile().getLineAndCharacterOfPosition(switchStart);
        missingDefaultPositions.push({ line: line + 1, character: character + 1, code: switchText });
      }
    }
    ts.forEachChild(node, (child) => this.checkNode(child, code, commentPattern, missingDefaultPositions));
  }

  private getOption = (rule: Rule) => {
    let option: Options = this.defalutOptions[0] as Options;
    if (rule && rule.option[0]) {
      option = rule.option[0] as Options;
    }
    return option;
  }

  public check = (target: ArkFile) => {
    let options = this.getOption(this.rule);
    let missingDefaultPositions = this.checkMissingDefaultCase(target, options);
    for (const position of missingDefaultPositions) {
      this.addIssueReport(target, position.line, position.character, position.code);
    }
  }

  private addIssueReport(arkFile: ArkFile, lineNum: number, startColum: number, code: string) {
    let filePath = arkFile.getFilePath();
    let endColum = startColum + code.length - 1;
    const severity = this.rule.alert ?? this.metaData.severity;
    let defect = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
      this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }
}

function getAllComments(code: string): string[] {
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

