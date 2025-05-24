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

import { ArkInvokeStmt, ArkMethod, Stmt } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AwaitTimeSequenceNormalCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/await-time-sequence-normal-check.md',
    description: 'In an asynchronous function, call an asynchronous function that returns a Promise, and use await to ensure the normal sequence of execution.'
};
const signaTure: string[] = [
    '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.Session.start()',
    '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.Session.stop()',
    '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.Session.release()',
    '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraInput.open()',
    '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraInput.close()'
];

export class AwaitTimeSequenceNormalCheck implements BaseChecker {
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

    public check = (arkMethod: ArkMethod): void => {
        if (arkMethod.getModifiers() !== 64) {
            return;
        }
        let stmts = arkMethod.getCfg()?.getStmts();
        if (!stmts) {
            return;
        }
        this.processStmt(stmts);
    };

    private processStmt(stmts: Stmt[]): void {
        for (const stmt of stmts) {
            if (!(stmt instanceof ArkInvokeStmt)) {
                continue;
            }
            let invoker = stmt.getInvokeExpr();
            if (signaTure.includes(invoker.getMethodSignature().toString())) {
                this.reportIssue(stmt, invoker.getMethodSignature().getMethodSubSignature().getMethodName());
            }
        }
    }

    private reportIssue(stmt: Stmt, methodName: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile().getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        const lineNum = originPositionInfo.getLineNo();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const startColumn = originPositionInfo.getColNo() + text.lastIndexOf(methodName);
        const endColunm = startColumn + methodName.length - 1;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}