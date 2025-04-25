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

import { ArkMethod, FunctionType, MethodSignature, Stmt } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, Defects, MatcherCallback, MatcherTypes, MethodMatcher, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'BanCallbackOperationsCheck');
const SIGNATURE: string[] = [
    `@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraManager.on('cameraStatus', @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraStatusInfo,void>)`,
    `@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraManager.off('cameraStatus', @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraStatusInfo,void>)`,
];
const SIGNATURE2: string[] = [
    `@ohosSdk/api/@ohos.multimedia.camera.d.ts: camera.CameraManager`,
];
const keyword = 'on';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/ban-callback-operations-check.md',
    description: 'In the callback on() interface, it is prohibited to add (by calling the on method) or remove (by calling the off method) callback operations.'
};

export class BanCallbackOperationsCheck implements BaseChecker {
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
        const busyMethods: Set<MethodSignature> = new Set();
        const methodSignature = target.getSignature();
        busyMethods.add(methodSignature);
        const stmts = target.getBody()?.getCfg()?.getStmts() ?? [];
        stmts.forEach((stmt) => {
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (invoker === null) {
                return;
            }
            const methodSignature = invoker.getMethodSignature();
            if (busyMethods.has(methodSignature)) {
                return;
            }
            if (!SIGNATURE.includes(methodSignature.toString())) {
                return;
            }
            const classSignature = methodSignature.getDeclaringClassSignature();
            if (!SIGNATURE2.includes(classSignature.toString())) {
                return;
            }
            const args = invoker.getArgs();
            if (args.length < 2) {
                return;
            }
            const type = args[1].getType();
            if (!(type instanceof FunctionType)) {
                return;
            }
            const callbackSignature = type.getMethodSignature();
            const callbackMethod = target.getDeclaringArkFile().getScene().getMethod(callbackSignature);
            if (callbackMethod === null) {
                return;
            }
            const hasReportStmt = this.processStmts(busyMethods, callbackMethod);
            if (!hasReportStmt) {
                return;
            }
            this.reportIssue(target, stmt);
        });
    };

    private processStmts(busyMethods: Set<MethodSignature>, callbackMethod: ArkMethod): boolean {
        const methodSignature = callbackMethod.getSignature();
        busyMethods.add(methodSignature);
        const stmts = callbackMethod.getBody()?.getCfg()?.getStmts() ?? [];
        for (let stmt of stmts) {
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (invoker === null) {
                continue;
            }
            const methodSignature = invoker.getMethodSignature();
            if (busyMethods.has(methodSignature)) {
                continue;
            }
            busyMethods.add(methodSignature);
            if (!SIGNATURE.includes(methodSignature.toString())) {
                continue;
            }
            const classSignature = methodSignature.getDeclaringClassSignature();
            if (!SIGNATURE2.includes(classSignature.toString())) {
                continue;
            }
            return true;
        }
        return false;
    }

    private reportIssue(method: ArkMethod, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.debug('Stmt text is empty.');
            return;
        }
        const index = text.indexOf(keyword);
        if (index === -1) {
            logger.debug(`Can not find ${keyword} in ${text}.`);
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const startColum = originalPosition.getColNo() + index;
        const endColum = startColum + keyword.length - 1;
        const filePath = method.getDeclaringArkFile().getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}