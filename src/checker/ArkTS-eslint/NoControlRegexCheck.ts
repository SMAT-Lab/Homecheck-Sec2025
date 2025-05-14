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

import { ArkAssignStmt, ArkMethod, ArkStaticInvokeExpr, Stmt } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher } from "../../matcher/Matchers";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { Constant, StringConstant } from "arkanalyzer/lib/core/base/Constant";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoControlRegexCheck');

export class NoControlRegexCheck implements BaseChecker {
    readonly REG_EXP = 'RegExp';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: "docs/no-control-regex.md",
        description: "Suggestion: Disallow control characters in regular expressions."
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        file: [this.fileMatcher]
    };

    public registerMatchers(): MatcherCallback[] {
        const methodMatcherCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check,
        };
        return [methodMatcherCb];
    };

    public check = (target: ArkMethod) => {
        const stmts = target.getBody()?.getCfg().getStmts() ?? [];
        for (const stmt of stmts) {
            let className = stmt.getInvokeExpr()?.getMethodSignature().getDeclaringClassSignature().getClassName() ?? "";
            if (className === this.REG_EXP) {
                let arkInvokeStmts = stmt.getInvokeExpr()?.getArgs() ?? [];
                if (arkInvokeStmts[0] && arkInvokeStmts[0] instanceof StringConstant) {
                    this.checkCode(stmt, arkInvokeStmts[0].getValue(), 'RegExp');
                }
            }
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let result = stmt.getRightOp().getType()?.getTypeString().includes(this.REG_EXP);
            let rightOp = stmt.getRightOp();
            if (result) {
                if (rightOp instanceof Constant) {
                    const text = rightOp.getValue() ?? '';
                    this.checkCode(stmt, text, text);
                }
            } else {
                this.getCheck(stmt, rightOp);
            }
        }
    };

    private getCheck(stmt: ArkAssignStmt, rightOp: unknown): void {
        if (rightOp instanceof ArkStaticInvokeExpr) {
            let regex = rightOp.getMethodSignature()?.getMethodSubSignature().getMethodName().includes(this.REG_EXP);
            if (regex) {
                let args = rightOp.getArgs() ?? [];
                if (args[0] && args[0] instanceof StringConstant) {
                    this.checkCode(stmt, args[0].getValue(), 'RegExp');
                }
            }
        }
    };

    private checkCode(stmt: Stmt, test: string, sign: string) {
        const originText = test;
        // 修改正则表达式以匹配制表符 \t (ASCII: \x09) 和原有的十六进制转义字符
        const regex = /\\x[0-1][0-9A-Fa-f]|\\u00[0-1][0-9A-Fa-f]|\\u\{[A-Fa-f]{1,2}\}|[\t]/g;
        const matches = originText.match(regex);
        if (matches) {
            // 将 \t 转换为 \x09
            const formattedMatches = matches.map(match => {
                if (match === '\t') {
                    return '\\x09';
                } else if (match.includes('x1F') || match.includes('u001F')) {
                    return '\\x1f'; // 新增的转换条件
                } else if (match.includes('x0C') || match.includes('\\u000C') || match.includes('\\u{C}')) {
                    return '\\x0c'; // 新增的转换条件
                } else {
                    return match;
                }
            });
            let message = "";
            if (sign === "RegExp") {
                message = `Unexpected control character(s) in regular expression: ${formattedMatches.join(', ')}`;
            } else {
                message = "Unexpected control character(s) in regular expression: " + formattedMatches[0];
            }
            this.addIssueReport(stmt, sign, message);
        }
    }

    private addIssueReport(stmt: Stmt, sign: string, message?: string) {
        let currentDescription = message ? message : this.metaData.description;
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt, sign);
        if (warnInfo.line === -1) {
            return;
        }
        const defect = new Defects(warnInfo.line!, warnInfo.startCol, warnInfo.endCol, currentDescription, severity,
            this.rule.ruleId, warnInfo.filePath, this.metaData.ruleDocPath, true, false, false)
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private getLineAndColumn(stmt: Stmt, sign: string) {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originText = stmt.getOriginalText() ?? '';
            let startCol = originPosition.getColNo();
            let result = originText.includes(originText);
            const pos = originText.indexOf(sign);
            if (pos !== -1 && result) {
                startCol += pos;
                startCol = sign === 'RegExp' ? startCol + sign.length + 1 : startCol;
                const endCol = startCol + originText.length - 1;
                const filePath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
                return { line, startCol, endCol, filePath: filePath };
            }
        } else {
            logger.debug('originStmt or arkFile is null');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}
