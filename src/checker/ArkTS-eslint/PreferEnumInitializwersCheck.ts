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

import { ArkField } from 'arkanalyzer/lib';
import { ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import {
  ClassMatcher,
  MatcherCallback,
  MatcherTypes,
  FieldMatcher,
} from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'PreferEnumInitializwersCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/prefer-enum-initializers.md', // TODO: support url
  description: `The value of the member 'propertyName' should be explicitly defined.`,
};
//推荐显式初始化每个枚举成员值。
export class PreferEnumInitializwersCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private clsMatcher: ClassMatcher = {
    matcherType: MatcherTypes.CLASS,
    category: [ClassCategory.ENUM],
  };
  private buildMatcher: FieldMatcher = {
    matcherType: MatcherTypes.FIELD,
    class: [this.clsMatcher],
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildCb: MatcherCallback = {
      matcher: this.buildMatcher,
      callback: this.check,
    };
    return [matchBuildCb];
  }

  public check = (targetField: ArkField) => {
    const severity = this.rule.alert ?? this.metaData.severity;
    //通过是否innit判断是否赋值（初始化）
    const stmts = targetField.getInitializer() ?? [];
    if (!(stmts.length > 0)) {
      let fieldName = targetField?.getName() ?? '';
      const fieldCode = targetField?.getCode() ?? '';
      const isString = fieldCode !== fieldName; 
      fieldName = isString ? `'${fieldName}'` : fieldName;
      this.addIssueReport(targetField, severity, fieldName);
    }
  };

  private addIssueReport(targetField: ArkField, severity: number, fieldName: string): void {
    const warnInfo = this.getLineAndColumn(targetField);
    let defect = new Defects(
      warnInfo.line,
      warnInfo.startCol,
      warnInfo.endCol,
      `The value of the member '${fieldName}' should be explicitly defined.`,
      severity,
      this.rule.ruleId,
      warnInfo.filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }

  private getLineAndColumn(targetField: ArkField): {
    line: number;
    startCol: number;
    endCol: number;
    filePath: string;
  } {
    const originPosition = targetField.getOriginPosition();
    const line = originPosition.getLineNo();
    const arkFile = targetField.getDeclaringArkClass().getDeclaringArkFile();
    if (arkFile) {
      const originText = targetField.getCode() ?? '';
      let startCol = originPosition.getColNo();
      const endCol = startCol + originText.length - 1;
      const originPath = arkFile.getFilePath();
      return { line, startCol, endCol, filePath: originPath };
    } else {
      logger.debug('originStmt or arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }
}
