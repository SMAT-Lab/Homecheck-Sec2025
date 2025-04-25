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

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'MaxLinesPerFunctionCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/max-lines-per-function-check.md",
  description: "Enforce a maximum number of lines of code in a function.",
};

export type MaxLinesOptions = {
  max?: number,
  skipBlankLines?: boolean,
  skipComments?: boolean,
  IIFEs?: boolean
}

export class MaxLinesPerFunctionCheck implements BaseChecker {
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  private defaultOption: MaxLinesOptions = { max: 50, skipBlankLines: false, skipComments: false, IIFEs: false };
  private option: MaxLinesOptions = this.defaultOption;

  public registerMatchers(): MatcherCallback[] {
      const matchFileCb: MatcherCallback = {
          matcher: this.fileMatcher,
          callback: this.check
      }
      return [matchFileCb];
  }
  
  /**
   * 检查 TypeScript 代码中所有方法，返回超过最大行数的方法位置
   * @param sourceFile 要检查的 sourceFile
   * @returns 超过最大行数的方法位置数组，包含错误信息
   */
  public checkMaxLinesPerFunction(sourceFile: ts.SourceFile): { line: number, character: number, message: string }[] {
    const invalidPositions: { line: number, character: number, message: string }[] = [];
    const lines = sourceFile.text.split('\n'); // 提前分割文件内容，避免重复操作
  
    const countLines = (node: ts.Node): number => {
      const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      let lineCount = 0;
  
      for (let i = startLine; i <= endLine; i++) {
        const lineText = lines[i]; // 使用预分割的行数据
        if (this.option.skipBlankLines && /^\s*$/.test(lineText)) continue; // 使用正则判断空行
        if (this.option.skipComments && /^\s*(\/\/|\/\*)/.test(lineText)) continue; // 使用正则判断注释行
        lineCount++;
      }
  
      return lineCount;
    };
  
    const checkNode = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || (this.option.IIFEs && ts.isCallExpression(node))) {
        const lineCount = countLines(node);
        const functionName = (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name
          ? node.name.getText()
          : 'anonymous function';
  
        if (lineCount > (this.option.max ?? 50)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const message = functionName === 'anonymous function'
            ? `Arrow function has too many lines (${lineCount}). Maximum allowed is ${this.option.max ?? 50}`
            : `Function '${functionName}' has too many lines (${lineCount}). Maximum allowed is ${this.option.max ?? 50}`;
          invalidPositions.push({
            line: line + 1,
            character: character + 1,
            message
          });
        }
      }
      ts.forEachChild(node, checkNode); // 避免重复绑定上下文
    };
  
    checkNode(sourceFile);
    return invalidPositions;
  }

  public check = (target: ArkFile) => {
    const severity = this.rule.alert ?? this.metaData.severity;
    if (this.rule && this.rule.option && this.rule.option[0]) {
      const ruleOption = this.rule.option[0] as MaxLinesOptions;
      this.option.max = ruleOption.max ?? this.defaultOption.max;
      this.option.skipBlankLines = ruleOption.skipBlankLines ?? this.defaultOption.skipBlankLines;
      this.option.skipComments = ruleOption.skipComments ?? this.defaultOption.skipComments;
      this.option.IIFEs = ruleOption.IIFEs ?? this.defaultOption.IIFEs;
    }

    const sourceFile: ts.SourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    const myInvalidPositions = this.checkMaxLinesPerFunction(sourceFile);
    myInvalidPositions.forEach(pos => {
        this.addIssueReport(pos, severity, target.getFilePath());
    });
  }
  
  private addIssueReport(pos: { line: number, character: number, message: string }, severity: number, filePath: string) {
    let defects = new Defects(pos.line, pos.character, pos.character, pos.message, severity, this.rule.ruleId,
      filePath, this.metaData.ruleDocPath, true, false, true);
    this.issues.push(new IssueReport(defects, undefined));
    RuleListUtil.push(defects);
  }
}
