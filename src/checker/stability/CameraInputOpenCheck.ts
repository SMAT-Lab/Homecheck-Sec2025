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

import { ArkMethod, Local, Stmt } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MatcherTypes, MethodMatcher, MatcherCallback, CheckerUtils } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CameraInputOpenCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/camera-input-open-check.md',
    description: 'In the CameraSession, the input parameter of the addInput interface must be a CameraInput that has already called the open method.'
};
const addInputSiganture = '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.Session.addInput(@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraInput)';
const openSiganture: string[] = [
    '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraInput.open()',
    '@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraInput.open(@ohosSdk/api/@ohos.base.d.ts: AsyncCallback<void,void>)'
];

export class CameraInputOpenCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private mtdMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD
    };

    public registerMatchers(): MatcherCallback[] {
        const matchMethodCb: MatcherCallback = {
            matcher: this.mtdMatcher,
            callback: this.check
        };
        return [matchMethodCb];
    }

    public check = (arkMethod: ArkMethod): void => {
        let blocks = arkMethod.getCfg()?.getBlocks();
        if (!blocks) {
            return;
        }
        for (let block of blocks) {
            this.processStmt(block.getStmts());
        }
    };

    private processStmt(stmts: Stmt[]): void {
        for (const stmt of stmts) {
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invoker) {
                continue;
            }
            if (invoker.getMethodSignature().toString() === addInputSiganture) {
                let arg = invoker.getArg(0);
                if (!(arg instanceof Local)) {
                    continue;
                }
                if (!this.processUsedStmt(arg.getUsedStmts(), stmt.getOriginPositionInfo().getLineNo(), 0)) {
                    this.reportIssue(stmt, arg.getName());
                }
            }
        }
    }

    private processUsedStmt(usedStmts: Stmt[], line: number, defStmtNum: number): boolean {
        for (const stmt of usedStmts) {
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invoker) {
                continue;
            }
            if (defStmtNum === 0) {
                defStmtNum = stmt.getOriginPositionInfo().getLineNo();
            }
            if (!openSiganture.includes(invoker.getMethodSignature().toString())) {
                let method = stmt
                    .getCfg()
                    .getDeclaringMethod()
                    .getDeclaringArkFile()
                    .getScene()
                    .getMethod(invoker.getMethodSignature());
                return this.processUsedStmt(method?.getCfg()?.getStmts() ?? [], line, defStmtNum);
            }
            if (defStmtNum < line) {
                return true;
            }
        }
        return false;
    }

    public reportIssue(stmt: Stmt, keyword: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        let filePath = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile().getFilePath();
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const orgStmtStr = stmt.getOriginalText();
        if (!orgStmtStr || orgStmtStr.length === 0) {
            return;
        }
        let startColumn = originalPosition.getColNo() + orgStmtStr.indexOf(keyword);
        let endColunm = startColumn + keyword.length;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}