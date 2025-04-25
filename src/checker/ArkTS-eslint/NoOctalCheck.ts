/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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


import { ArkAssignStmt, ArkMethod, ArkNormalBinopExpr, Stmt } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher } from "../../matcher/Matchers";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { NumberConstant } from "arkanalyzer/lib/core/base/Constant";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoOctalCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/no-octal-check.md",
    description: "Disallow octal literals."
};

export class NoOctalCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly FOREACH_STR: string = "ForEach";
    readonly CREAER_STR: string = "create";
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    private buildMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        file: [this.fileMatcher],
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        }
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    };

    public check = (targetMtd: ArkMethod) => {
        const stmts = targetMtd.getBody()?.getCfg().getStmts() ?? [];
        for (const stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                let rightOp = stmt.getRightOp()
                if (rightOp instanceof ArkNormalBinopExpr || rightOp instanceof NumberConstant) {
                    if (rightOp.getType().getTypeString() === "number") {
                        let message = "Octal literals should not be used."
                        this.addIssueReport(stmt, message);
                    }
                }
            }
        }
    };

    private addIssueReport(stmt: Stmt, message?: string) {
        let currentDescription = message ? message : this.metaData.description;
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt,);
        if (warnInfo.line === -1) {
            return;
        }
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, currentDescription, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };

    private getLineAndColumn(stmt: Stmt) {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originText = stmt.getOriginalText() ?? '';
            let startCol = originPosition.getColNo();
            let results = this.checkCode(originText)
            for (const result of results) {
                if (result) {
                    const pos = originText.indexOf(result);
                    if (pos !== -1) {
                        startCol += pos;
                        const endCol = startCol + originText.length - 1;
                        const filePath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
                        return { line, startCol, endCol, filePath: filePath }
                    }
                }
            };
        } else {
            logger.debug('originStmt or arkFile is null');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    };

    private checkCode(code: string): string[] {
        const octalPattern = /\b0[0-7]+\b/g;
        const octalMatches = code.match(octalPattern);
        return octalMatches ? octalMatches : [];
    };
}