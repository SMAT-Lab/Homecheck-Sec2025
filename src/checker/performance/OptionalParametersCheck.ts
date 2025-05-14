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

import { ArkFile, ArkMethod } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { MethodParameter } from 'arkanalyzer/lib/core/model/builder/ArkMethodBuilder';
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'OptionalParametersCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/optional-parameters-check.md',
    description: 'Declare function parameters as mandatory parameters.'
};

export class OptionalParametersCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD
    };

    public registerMatchers(): MatcherCallback[] {
        const matchMethodCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check
        };
        return [matchMethodCb];
    }

    public check = (targetMethod: ArkMethod): void => {
        let parameters = targetMethod.getParameters();
        if (!parameters) {
            return;
        }
        for (let [index, parameter] of parameters.entries()) {
            let isOptional = parameter.isOptional();
            if (!isOptional) {
                continue;
            }
            const startColumn = this.getStartColumn(targetMethod, parameter, index);
            const lineNum = targetMethod.getLine() ?? (targetMethod.getDeclareLines() ?? [-1])[0];
            if (startColumn === -1 || lineNum === -1) {
                continue;
            }
            let name = parameter.getName();
            let endColunm = startColumn + name.length - 1;
            this.reportIssue(targetMethod.getDeclaringArkClass().getDeclaringArkFile(), lineNum, startColumn, endColunm);
        }
    };

    private getStartColumn(method: ArkMethod, parameter: MethodParameter, index: number): number {
        let code = method.getCode();
        if (!code || code.length === 0) {
            return -1;
        }
        let lineCode = code.split('\n')[0];
        let parameterStr = lineCode.split(',')[index];
        let name = parameter.getName();
        let pos = parameterStr?.indexOf(name) ?? -1;
        if (pos === -1) {
            return -1;
        }
        let indexOfParameterStr = lineCode?.indexOf(parameterStr) ?? -1;
        if (indexOfParameterStr === -1) {
            return -1;
        }
        const mtdCol = method.getColumn() ?? (method.getDeclareColumns() ?? [-1])[0];
        return (mtdCol !== -1) ? mtdCol + indexOfParameterStr + pos : -1;
    }

    private reportIssue(arkFile: ArkFile, lineNum: number, startColumn: number, endColunm: number): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}