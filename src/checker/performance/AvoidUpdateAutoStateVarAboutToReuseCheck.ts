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

import { ArkAssignStmt, ArkField, ArkFile, ArkInstanceFieldRef, ArkInvokeStmt, ArkMethod } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AvoidUpdateAutoStateVarAboutToReuseCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/avoid-update-auto-state-var-in-aboutToReuse-check.md',
    description: 'Avoid updating state variables that automatically update values in aboutToReuse.'
};
const variableSet = new Set(['Link', 'StorageLink', 'ObjectLink', 'Consume']);

export class AvoidUpdateAutoStateVarAboutToReuseCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly COMPONENT_DEC: string = 'Component';
    readonly ABOUTTOREUSE_MET: string = 'aboutToReuse';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClassCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        };
        return [matchClassCb];
    }

    public check = (targetCla: ArkClass): void => {
        if (!targetCla.hasDecorator(this.COMPONENT_DEC)) {
            return;
        }
        let method = targetCla.getMethodWithName(this.ABOUTTOREUSE_MET);
        if (method === null) {
            return;
        }
        let stateFields: ArkField[] = this.saveStateField(targetCla);
        this.invokestmt(stateFields, method, targetCla.getDeclaringArkFile());
    };

    public saveStateField(arkClass: ArkClass): ArkField[] {
        let stateFields: ArkField[] = [];
        for (let field of arkClass.getFields()) {
            if (field.hasDecorator(variableSet)) {
                stateFields.push(field);
            }
        }
        return stateFields;
    }

    public invokestmt(stateFields: ArkField[], method: ArkMethod, arkFile: ArkFile): void {
        for (let stmt of method.getBody()?.getCfg().getStmts() ?? []) {
            if (stmt instanceof ArkInvokeStmt) {
                let invmethod = arkFile.getScene().getMethod(stmt.getInvokeExpr().getMethodSignature());
                if (invmethod === null) {
                    continue;
                }
                this.invokestmt(stateFields, invmethod, arkFile);
            } else if (stmt instanceof ArkAssignStmt) {
                let leftOp = stmt.getLeftOp();
                if (!(leftOp instanceof ArkInstanceFieldRef)) {
                    continue;
                }
                let arkField = this.stateValueUpdate(stateFields, leftOp);
                if (arkField !== null) {
                    this.reportIssue(arkFile, arkField);
                }
            }
        }
    }

    public stateValueUpdate(stateFields: ArkField[], leftOp: ArkInstanceFieldRef): ArkField | null {
        for (let stateField of stateFields) {
            if (leftOp.getFieldSignature().toString() === stateField.getSignature().toString()) {
                return stateField;
            }
        }
        return null;
    }

    public reportIssue(arkFile: ArkFile, arkField: ArkField): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const positionInfo = arkField.getOriginPosition();
        const lineNum = positionInfo.getLineNo();
        const fieldName = arkField.getName();
        const lineCode = arkField.getCode();
        const startColumn = positionInfo.getColNo() + lineCode.indexOf(fieldName);
        const endColunm = startColumn + fieldName.length;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}