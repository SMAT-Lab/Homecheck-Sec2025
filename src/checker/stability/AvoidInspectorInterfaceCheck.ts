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

import { ArkMethod, DEFAULT_ARK_CLASS_NAME, Stmt } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, Defects, MatcherCallback, MatcherTypes, MethodMatcher, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AvoidInspectorInterfaceCheck');
const SIGNATURE: string[] = [
    `@ohosSdk/api/arkui/FrameNode.d.ts: FrameNode.getInspectorInfo()`,
    `@ohosSdk/api/@internal/full/global.d.ts: ${DEFAULT_ARK_CLASS_NAME}.getInspectorTree()`,
    `@ohosSdk/api/@internal/full/global.d.ts: ${DEFAULT_ARK_CLASS_NAME}.getInspectorByKey(string)`,
    `@ohosSdk/api/@ohos.arkui.UIContext.d.ts: UIContext.getFilteredInspectorTree(string[])`,
    `@ohosSdk/api/@ohos.arkui.UIContext.d.ts: UIContext.getFilteredInspectorTreeById(string, number, string[])`,
];
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/avoid-inspector-interface-check.md',
    description: 'Do not use the Inspector for information query.'
};

export class AvoidInspectorInterfaceCheck implements BaseChecker {
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
        const stmts = target.getBody()?.getCfg()?.getStmts() ?? [];
        stmts.forEach((stmt) => {
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (invoker === null) {
                return;
            }
            const methodSignature = invoker.getMethodSignature();
            const methodName = methodSignature.getMethodSubSignature().getMethodName();
            if (!SIGNATURE.includes(methodSignature.toString())) {
                return;
            }
            this.reportIssue(target, stmt, methodName);
        });
    };

    private reportIssue(method: ArkMethod, stmt: Stmt, methodName: string): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.debug('Stmt text is empty.');
            return;
        }
        const index = text.indexOf(methodName);
        if (index === -1) {
            logger.debug(`Can not find ${methodName} in ${text}.`);
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const startColum = originalPosition.getColNo() + index;
        const endColum = startColum + methodName.length - 1;
        const filePath = method.getDeclaringArkFile().getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}