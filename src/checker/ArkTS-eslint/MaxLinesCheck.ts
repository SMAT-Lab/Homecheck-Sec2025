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

import { ArkFile } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'MaxLinesCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: 'docs/max-lines.md',
  description: 'File has too many lines (${actual}). Maximum allowed is ${max}',
};

class Option {
  max: number;
  skipBlankLines: boolean;
  skipComments: boolean;
}

export class MaxLinesCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private defalutOptions = [{ max: 300, skipBlankLines: true, skipComments: true }];
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
  private getOption = () => {
    let option: Option = this.defalutOptions[0];
    if (this.rule && this.rule.option[0]) {
      option = this.rule.option[0] as Option;
    }
    return option;
  }

  public check = (target: ArkFile) => {
    let sourceCodelines = target.getCode()?.split('\n') ?? [];
    let opt = this.getOption();
    let lines = sourceCodelines.map((text: string, i: number) => ({
      lineNUmber: i + 1,
      text
    }));

    /*
     * If file ends with a linebreak, `sourceCodelines` will have one extra empty line at the end.
     * That isn't a real line, so we shouldn't count it.
     */
    if (lines.length > 1 && lines[lines.length - 1].text === '') {
      lines.pop();
    }

    // 忽略空格
    if (opt.skipBlankLines) {
      lines = lines.filter((l: { text: string; }) => l.text.trim() !== '');
    }
    // 忽略注释
    if (opt.skipComments) {
      let comments: { lineNUmber: number, text: string }[] = [];
      let commentLines: number[] = [];
      let manyComments = false;
      for (let index = 0; index < lines.length; index++) {
        let l = lines[index];
        if (l.text.trim().startsWith('//')) {
          comments.push(l);
          commentLines.push(l.lineNUmber);
        }
        if (l.text.trim().startsWith('/*')) {
          manyComments = true;
          comments.push(l);
          commentLines.push(l.lineNUmber);
          if (l.text.trim().endsWith('*/')) {
            manyComments = false;
          } else {
            continue;
          }
        }
        if (l.text.trim().includes('/*')) {
          manyComments = true;
          if (l.text.trim().endsWith('*/')) {
            manyComments = false;
          } else {
            continue;
          }
        }
        if (manyComments) {
          if (l.text.trim().endsWith('*/')) {
            manyComments = false;
          }
          comments.push(l);
          commentLines.push(l.lineNUmber);
        }
      }
      lines = lines.filter(
        (l: { lineNUmber: number; }) => !commentLines.includes(l.lineNUmber)
      );
    }

    if (lines.length > opt.max) {
      const loc = {
        start: {
          line: lines[opt.max].lineNUmber,
          column: 0
        },
        end: {
          line: sourceCodelines.length,
          column: sourceCodelines[sourceCodelines.length - 1].length
        }
      };
      this.addIssueReport(target, loc.start.line, loc.end.column, opt.max, lines.length)
    }
  }

  private addIssueReport(arkFile: ArkFile, lineNum: number, column: number, max: number, actual: number) {
    const severity = this.rule.alert ?? this.metaData.severity;
    let filePath = arkFile.getFilePath();
    let description = `File has too many lines (${actual}). Maximum allowed is ${max}`;
    let defect = new Defects(lineNum, 1, column, description, severity, this.rule.ruleId,
      filePath, this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }
}
