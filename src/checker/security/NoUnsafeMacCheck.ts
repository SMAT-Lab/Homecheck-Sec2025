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

import { ArkFile, DEFAULT_ARK_CLASS_NAME, Stmt } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback, CheckerUtils } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { VarInfo } from '../../model/VarInfo';
import { StmtExt } from '../../model/StmtExt';
import { StringUtils } from '../../utils/checker/StringUtils';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnsafeMacCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/no-unsafe-mac-check.md',
    description: 'DO not use insecure hash algorithms, such as SHA1, in MAC message authentication algorithms.'
};

const createMacSignature = `@ohosSdk/api/@ohos.security.cryptoFramework.d.ts: cryptoFramework.${DEFAULT_ARK_CLASS_NAME}.createMac(string)`;

export class NoUnsafeMacCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClassCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        };
        return [matchClassCb];
    }

    public check = (arkClass: ArkClass): void => {
        for (let method of arkClass.getMethods()) {
            let stmts = method.getBody()?.getCfg().getStmts();
            if (!stmts) {
                return;
            }
            this.processStmt(stmts, arkClass);
        }
    };

    private processStmt(stmts: Stmt[], arkClass: ArkClass): void {
        for (let stmt of stmts) {
            let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            let signatureStr = invokeExpr.getMethodSignature().toString();
            if (signatureStr !== createMacSignature) {
                continue;
            }
            let methodName = invokeExpr.getMethodSignature().getMethodSubSignature().getMethodName();
            let arg = invokeExpr.getArg(0);
            let right = CheckerUtils.getArgRight(arg, arkClass);
            if (right !== null) {
                arg = right;
            }
            let varInfo = new VarInfo(stmt, (stmt as StmtExt).scope);
            let parseStr = StringUtils.getStringByScope(arkClass.getDeclaringArkFile(), varInfo, arg);
            if (parseStr.includes('SHA1')) {
                this.reportIssue(arkClass.getDeclaringArkFile(), stmt, methodName);
            }
        }
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt, methodName: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        const lineNum = originPositionInfo.getLineNo();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const startColumn = originPositionInfo.getColNo() + text.lastIndexOf(methodName);
        const endColunm = startColumn + methodName.length;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}