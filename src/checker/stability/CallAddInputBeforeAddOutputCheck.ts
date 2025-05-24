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

import { ArkMethod, Stmt } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, Defects, MatcherCallback, MatcherTypes, MethodMatcher, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CallAddInputBeforeAddOutputCheck');
const keyword = 'addOutput';
const INPUTSIGNATURE = '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.Session.addInput(@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraInput)';
const OUTPUTSIGNATURE = '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.Session.addOutput(@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraOutput)';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/call-addInput-before-addOutput-check.md',
    description: 'In the CameraSession, you need to add an input first before adding an output.'
};

export class CallAddInputBeforeAddOutputCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public issues: IssueReport[] = [];

    private mtdMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchMethodCb: MatcherCallback = {
            matcher: this.mtdMatcher,
            callback: this.check
        };
        return [matchMethodCb];
    }

    public check = (target: ArkMethod): void => {
        let stmts = target.getCfg()?.getStmts() ?? [];
        for (const stmt of stmts) {
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (invoker === null) {
                continue;
            }
            const methodSignature = invoker.getMethodSignature();
            const methodSignatureStr = methodSignature.toString();
            if (methodSignatureStr === INPUTSIGNATURE) {
                return;
            }
            if (methodSignatureStr === OUTPUTSIGNATURE) {
                this.reportIssue(stmt);
            }
        }
    };

    private reportIssue(stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.debug('Stmt text is empty.');
            return;
        }
        const index = text.indexOf(keyword);
        if (index === -1) {
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const startColum = originalPosition.getColNo() + index;
        const endColum = startColum + keyword.length - 1;
        const filePath = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile().getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}