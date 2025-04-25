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

import { ArkAssignStmt, ArkClass, ArkFile, ArkInstanceInvokeExpr, ArkMethod, ArkStaticInvokeExpr, Constant, DEFAULT_ARK_CLASS_NAME, Local, Stmt } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback, CheckerUtils } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'TimezoneInterfaceCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/timezone-interface-check.md',
    description: 'Use I18n APIs correctly to obtain or set the time zone.'
};
const setTimeZoneSignature = '@ohosSdk/api/@ohos.i18n.d.ts: i18n.Calendar.setTimeZone(string)';
const thirdPartySignature: string[] = [
    '@thirdParty/@hview/moment/index.d.ts: moment.Moment.utcOffset()',
    '@thirdParty/@hview/moment/index.d.ts: moment.Moment.utcOffset(number|string, boolean)',
    '@ohosSdk/api/@ohos.systemDateTime.d.ts: systemDateTime.' + DEFAULT_ARK_CLASS_NAME + '.setTimezone()'];

export class TimezoneInterfaceCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private buildMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    }

    public check = (arkMethod: ArkMethod) => {
        const stmts = arkMethod.getBody()?.getCfg()?.getStmts();
        if (!stmts) {
            return;
        }
        for (let stmt of stmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            const invokeSignature = invokeExpr.getMethodSignature();
            let invokeSignatureStr = invokeSignature.toString();
            let clazz = arkMethod.getDeclaringArkClass();
            if (invokeSignatureStr === setTimeZoneSignature) {
                this.setTimeCheck(stmt, clazz);
            } else if (thirdPartySignature.includes(invokeSignatureStr)) {
                let invokeMethodName = invokeSignature.getMethodSubSignature().getMethodName();
                this.reportIssue(clazz.getDeclaringArkFile(), stmt, invokeMethodName);
            }
        }
    }

    public setTimeCheck(stmt: Stmt, clazz: ArkClass): void {
        if (this.isDefaultParameter(stmt)) {
            return;
        }
        const fieldNameZone = 'zone_offset';
        let zoneStmt = this.getFieldStmt(stmt, fieldNameZone);
        if (!zoneStmt) {
            return;
        }
        const fieldNameDst = 'dst_offset';
        if (!this.getFieldStmt(stmt, fieldNameDst)) {
            this.reportIssue(clazz.getDeclaringArkFile(), zoneStmt, fieldNameZone);
        }
    }

    public isDefaultParameter(stmt: Stmt): boolean {
        let arg = CheckerUtils.getInvokeExprFromStmt(stmt)?.getArg(0);
        if (!arg || !(arg instanceof Local)) {
            return false;
        }
        let declaringStmt = (arg as Local).getDeclaringStmt();
        if ((!declaringStmt) || !(declaringStmt instanceof ArkAssignStmt)) {
            return false;
        }
        let rightOp = declaringStmt.getRightOp();
        if (!(rightOp instanceof ArkInstanceInvokeExpr)) {
            return false;
        }
        let methodName = rightOp.getMethodSignature().getMethodSubSignature().getMethodName();
        const methodNameGetId = 'getID';
        if (methodName !== methodNameGetId) {
            return false;
        }
        let base = rightOp.getBase();
        if (!(base instanceof Local)) {
            return false;
        }
        let declaringStmtBase = base.getDeclaringStmt();
        if (!declaringStmtBase || !(declaringStmtBase instanceof ArkAssignStmt)) {
            return false;
        }
        let baseRightOp = declaringStmtBase.getRightOp();
        if (!(baseRightOp instanceof ArkStaticInvokeExpr)) {
            return false;
        }
        const baseTimeZone = 'getTimeZone';
        let baseMethodSignature = baseRightOp.getMethodSignature();
        let baseMethodName = baseMethodSignature.getMethodSubSignature().getMethodName();
        if (baseMethodName !== baseTimeZone) {
            return false;
        }
        const fileNameSdk = 'api\\@ohos.i18n.d.ts';
        let fileName = baseMethodSignature.getDeclaringClassSignature().getDeclaringFileSignature().getFileName();
        if (fileName !== fileNameSdk) {
            return false;
        }
        return true;
    }

    public getFieldStmt(stmt: Stmt, fieldName: string): Stmt | undefined {
        let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!(invokeExpr instanceof ArkInstanceInvokeExpr)) {
            return undefined;
        }
        let base = invokeExpr.getBase();
        if (!(base instanceof Local)) {
            return undefined;
        }
        let stmts = base.getUsedStmts();
        for (let usedStmt of stmts) {
            const methodNameGet = 'get';
            let usedInvokeExpr = CheckerUtils.getInvokeExprFromStmt(usedStmt);
            if (!(usedInvokeExpr instanceof ArkInstanceInvokeExpr)) {
                continue;
            }
            let methodName = usedInvokeExpr.getMethodSignature().getMethodSubSignature().getMethodName();
            if (methodName !== methodNameGet) {
                continue;
            }
            let arg = usedInvokeExpr.getArg(0);
            if (!(arg instanceof Constant)) {
                continue
            }
            if (arg.getValue() === fieldName) {
                return usedStmt;
            }
        }
        return undefined;
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt, keyword: string): void {
        let filePath = arkFile.getFilePath();
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let orgStmt = stmt.getOriginalText();
        let startColumn = -1;
        let endColumn = -1;
        if (orgStmt !== undefined) {
            let orgStmtStr = orgStmt.toString();
            startColumn = originalPosition.getColNo() + orgStmtStr.indexOf(keyword);
            endColumn = startColumn + keyword.length - 1;
        }
        if (startColumn === -1) {
            return;
        }
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, this.metaData.gSeverity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}