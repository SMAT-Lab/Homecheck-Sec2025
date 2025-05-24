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

import { ArkClass, Stmt } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, ClassMatcher, Defects, MatcherCallback, MatcherTypes, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AvoidCallsInUIAbilityLifecycleCheck');
const classSignatureStr = '@ohosSdk/api/@ohos.app.ability.UIAbility.d.ts: UIAbility';
const NAMES: string[] = ['onCreate', 'onWindowStageCreate', 'onWindowStageDestroy', 'onWindowStageWillDestroy', 'onForeground', 'onBackground', 'onNewWant', 'onDestroy'];
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/avoid-calls-in-uiability-lifecycle-check.md',
    description: 'It is not recommended to call @ohos.measure and @ohos.font during the lifecycle of UIAbility. '
};

export class AvoidCallsInUIAbilityLifecycleCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClazzCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        };
        return [matchClazzCb];
    }

    public check = (target: ArkClass): void => {
        const heritageClasses = target.getAllHeritageClasses();
        if (heritageClasses.length === 0) {
            return;
        }
        if (classSignatureStr !== heritageClasses[0].getSignature().toString()) {
            return;
        }
        for (let method of target.getMethods()) {
            const methodName = method.getSignature().getMethodSubSignature().getMethodName();
            if (!NAMES.includes(methodName)) {
                continue;
            }
            const stmts = method.getBody()?.getCfg().getStmts() ?? [];
            stmts.forEach((stmt) => {
                let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
                if (invoker === null) {
                    return;
                }
                const signatureStr = invoker.getMethodSignature().toString();
                const name = invoker.getMethodSignature().getMethodSubSignature().getMethodName();
                if (!(signatureStr.includes('@ohos.measure') || signatureStr.includes('@ohos.font'))) {
                    return;
                }
                this.reportIssue(target, stmt, name);
            });
        }
    };

    private reportIssue(method: ArkClass, stmt: Stmt, methodName: string): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.debug('Stmt text is empty.');
            return;
        }
        const index = text.indexOf(methodName);
        if (index === -1) {
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