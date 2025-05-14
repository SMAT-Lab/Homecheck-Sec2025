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

import { ArkFile, ArkMethod, Stmt } from 'arkanalyzer';
import { ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MethodMatcher, MatcherCallback, CheckerUtils } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ForeachArgsCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/foreach-args-check.md',
    description: 'For performance purposes, set keyGenerator for ForEach.'
};

export class ForeachArgsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly FOREACH_STR: string = 'ForEach';
    readonly CREAER_STR: string = 'create';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        category: [ClassCategory.STRUCT]
    };
    private buildMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.clsMatcher],
        name: ['build']
    };
    private builderMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        decorators: ['Builder']
    };
    private anonymousMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        isAnonymous: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        };
        const matchBuilderCb: MatcherCallback = {
            matcher: this.builderMatcher,
            callback: this.check
        };
        const matchAnonymousCb: MatcherCallback = {
            matcher: this.anonymousMatcher,
            callback: this.check
        };
        return [matchBuildCb, matchBuilderCb, matchAnonymousCb];
    }

    public check = (targetMtd: ArkMethod): void => {
        const stmts = targetMtd.getBody()?.getCfg().getStmts() ?? [];
        for (const stmt of stmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            const methodSign = invokeExpr.getMethodSignature();
            const className = methodSign.getDeclaringClassSignature().getClassName();
            const methodName = methodSign.getMethodSubSignature().getMethodName();
            const argsNum = invokeExpr.getArgs().length;
            if (className === this.FOREACH_STR && methodName === this.CREAER_STR && argsNum < 3) {
                this.addIssueReport(stmt);
            }
        }
    };

    private addIssueReport(stmt: Stmt): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt);
        let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defects, undefined));
    }

    private getLineAndColumn(stmt: Stmt): {
        line: number;
        startCol: number;
        endCol: number;
        filePath: string;
    } {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originText = stmt.getOriginalText() ?? '';
            let startCol = originPosition.getColNo();
            const pos = originText.indexOf(this.FOREACH_STR);
            if (pos !== -1) {
                startCol += pos;
                const endCol = startCol + this.FOREACH_STR.length - 1;
                const originPath = arkFile.getFilePath();
                return { line, startCol, endCol, filePath: originPath };
            }
        } else {
            logger.debug('ArkFile is null.');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }

    public codeFix(arkFile: ArkFile, fixKey: string): boolean {
        let isFixed = false;
        if (this.issues.length === 0) {
            return isFixed;
        }
        // TODO: 根据fixKey定位到需要修复的代码位置，并修改arkFile
        isFixed = true;
        return isFixed;
    }
}