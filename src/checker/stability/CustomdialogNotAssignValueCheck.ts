/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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

import { ArkClass, ArkField } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, MatcherTypes, MatcherCallback, ClassMatcher } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CustomdialogNotAssignValueCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/customdialog-not-assign-value-check.md',
    description: 'The CustomdialogController does not allow dynamic assignment within methods.'
};
const customDialogControllerSignature: string[] = [
    'CustomDialogController',
    'CustomDialogController|null',
    'CustomDialogController|undefined',
    '@ohosSdk/component/custom_dialog_controller.d.ts: CustomDialogController',
    '@ohosSdk/component/custom_dialog_controller.d.ts: CustomDialogController|null',
    '@ohosSdk/component/custom_dialog_controller.d.ts: CustomDialogController|undefined'
];

export class CustomdialogNotAssignValueCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private classMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClassCb: MatcherCallback = {
            matcher: this.classMatcher,
            callback: this.check
        };
        return [matchClassCb];
    }

    public check = (arkClass: ArkClass): void => {
        if (arkClass.hasDecorator('Component')) {
            return;
        }
        for (const field of arkClass.getFields()) {
            if (!customDialogControllerSignature.includes(field.getType().getTypeString())) {
                continue;
            }
            if (field.getInitializer().length !== 0) {
                this.reportIssue(field, field.getName());
            }
        }
    };

    private reportIssue(field: ArkField, name: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = field.getDeclaringArkClass().getDeclaringArkFile().getFilePath();
        let lineNum = field.getOriginPosition().getLineNo();
        let startColum = field.getOriginPosition().getColNo();
        let endColumn = startColum + name.length - 1;
        let defects = new Defects(lineNum, startColum, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}