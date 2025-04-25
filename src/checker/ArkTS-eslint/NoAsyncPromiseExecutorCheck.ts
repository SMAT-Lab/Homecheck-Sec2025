/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ArkInstanceInvokeExpr, ArkMethod, Stmt } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { MatcherCallback, MatcherTypes, MethodMatcher, FileMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { CheckerUtils } from '../../Index';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoAsyncPromiseExecutorCheck');

interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
    filePath: string;
}

export class NoAsyncPromiseExecutorCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-async-promise-executor-check.md',
        description: 'Promise executor functions should not be async'
    };
    readonly PROMISE_NAME: string = 'async';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        file: [this.fileMatcher],
    };
    public registerMatchers(): MatcherCallback[] {
        const matchMethodCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check
        }
        return [matchMethodCb];
    }
    public check = (targetMtd: ArkMethod) => {
        if (targetMtd instanceof ArkMethod) {
            const stmts = targetMtd.getBody()?.getCfg().getStmts() ?? [];
            for (const stmt of stmts) {
                const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
                if (!invokeExpr) {
                    continue;
                }
                if (!(stmt.getInvokeExpr() instanceof ArkInstanceInvokeExpr)) {
                    continue;
                }
                if (stmt.toString().includes('Promise.constructor()')) {
                    const code = stmt.getOriginalText() ?? '';
                    if (this.findSpecialStatement(code)) {
                        this.addIssueReport(stmt);
                    }
                }
            }
        }
    }

    private addIssueReport(stmt: Stmt): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt);
        const defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId, warnInfo.filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
        RuleListUtil.push(defects);
    }

    private getLineAndColumn(stmt: Stmt): WarnInfo {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originText = stmt.getOriginalText() ?? '';
            let startCol = originPosition.getColNo();
            const pos = originText.indexOf(this.PROMISE_NAME);
            if (pos !== -1) {
                startCol += pos;
                const endCol = startCol + this.PROMISE_NAME.length - 1;
                const originPath = arkFile.getFilePath();
                return { line, startCol, endCol, filePath: originPath }
            }
        } else {
            logger.debug('arkFile is null');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
    private findSpecialStatement(code: string): boolean {
        if (!code) return false;
        const patterns = [
            /new\s+Promise\s*\(\s*async/g,
            /new\s+Promise\s*\(\s*\(*\s*async/g,
            /new\s+Promise\s*\(\s*.*?\(\s*resolve\s*,\s*reject\s*\)\s*=>\s*{[\s\S]*?setTimeout\s*\(/g,
            /new\s+Promise\s*\(\s*.*?\(\s*resolve\s*,\s*reject\s*\)\s*=>\s*{[\s\S]*?await\s+/g
        ];
        return patterns.some(regex => regex.test(code));
    }
}
