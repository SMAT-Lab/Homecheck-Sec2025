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

import { ArkField } from "arkanalyzer/lib";
import { ArkClass } from "arkanalyzer/lib/core/model/ArkClass";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from "../../Index";
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from "../../model/Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'RemoveRedundantStateVarCheck');
let viewTreeTool: ViewTreeTool = new ViewTreeTool();
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/remove-redundant-state-var-check.md",
    description: "You are advised to remove the status variable settings that are not associated with UI components."
};

export class RemoveRedundantStateVarCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClazzCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        }
        return [matchClazzCb];
    }

    public check = (target: ArkClass) => {
        if (viewTreeTool.hasTraverse(target)) {
            return;
        }
        for (let arkField of target.getFields()) {
            if (!arkField.hasDecorator('State')) {
                continue;
            }
            let isAssociated = this.isStateAssociated(target, arkField);
            if (!isAssociated) {
                this.addIssueReport(target, arkField);
            }
        }
    }

    private isStateAssociated(clazz: ArkClass, arkField: ArkField): boolean {
        let viewTree = clazz.getViewTree();
        if (!viewTree) {
            return false;
        }
        let values = viewTree.getStateValues();
        for (let [key] of values.entries()) {
            if (key.getSignature() === arkField.getSignature()) {
                return true;
            }
        }
        return false;
    }

    private addIssueReport(target: ArkClass, arkField: ArkField) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(target, arkField);
        if (warnInfo) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(target: ArkClass, arkField: ArkField) {
        const originPosition = arkField.getOriginPosition();
        const lineNum = originPosition.getLineNo();
        const arkFile = target.getDeclaringArkFile();
        if (arkFile) {
            const filedName = arkField.getName();
            const lineCode = arkField.getCode();
            const startCol = originPosition.getColNo() + lineCode.indexOf(filedName);
            const endCol = startCol + filedName.length - 1;
            const originPath = arkFile.getFilePath();
            return { lineNum, startCol, endCol, filePath: originPath };
        } else {
            logger.debug('ArkFile is null.');
        }
        return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}