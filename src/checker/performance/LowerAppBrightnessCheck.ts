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

import { AbstractFieldRef, ArkAssignStmt, ArkConditionExpr, ArkIfStmt, ArkInstanceInvokeExpr, ArkInvokeStmt, ArkMethod, ArkStaticFieldRef, ArkStaticInvokeExpr, BasicBlock, ClassType, Local, NAME_PREFIX, Stmt, UNKNOWN_NAME, Value } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MatcherTypes, MatcherCallback, MethodMatcher } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'LowerAppBrightnessCheck');
const SIGNATURES: string[] = [
    '@ohosSdk/api/@ohos.power.d.ts: power.DevicePowerMode.[static]MODE_POWER_SAVE',
    '@ohosSdk/api/@ohos.app.ability.ConfigurationConstant.d.ts: ConfigurationConstant.ColorMode.[static]COLOR_MODE_DARK'

];
const signatureStrs: string[] = [
    'setWindowBrightness(number, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<void,void>)',
    'setWindowBrightness(number)'
];
const keyword = 'if';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/lower-app-brightness-check.md',
    description: 'Add the function of actively reducing the brightness of the application in night mode.'
};

export class LowerAppBrightnessCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private mtdMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClazzCb: MatcherCallback = {
            matcher: this.mtdMatcher,
            callback: this.check
        };
        return [matchClazzCb];
    }

    public check = (target: ArkMethod): void => {
        const stmts = target.getBody()?.getCfg()?.getStmts() ?? [];
        for (let i = 0; i < stmts.length; i++) {
            const stmt = stmts[i];
            if (!(stmt instanceof ArkIfStmt)) {
                continue;
            }
            if (!this.processIfStmt(target, stmt)) {
                continue;
            }
            let myArray = stmts.slice(i + 1);
            if (!this.processMyArray(myArray)) {
                this.addIssueReport(stmt);
            }
        }
    };

    private processIfStmt(target: ArkMethod, stmt: ArkIfStmt): boolean {
        const conditionExpr = stmt.getConditionExpr();
        if (!(conditionExpr instanceof ArkConditionExpr)) {
            return false;
        }
        const op1 = conditionExpr.getOp1();
        const op2 = conditionExpr.getOp2();
        const operator = conditionExpr.getOperator().toString();
        if ((this.isItExpected(target, op1) || this.isItExpected(target, op2)) && (operator === '===' || operator === '==')) {
            return true;
        }
        return false;
    }

    private isItExpected(method: ArkMethod, op: Value): boolean {
        if (!(op instanceof Local)) {
            return false;
        }
        const stmt = op.getDeclaringStmt();
        if (!stmt) {
            return this.isStmtUndefined(method, op);
        } else {
            if (!(stmt instanceof ArkAssignStmt)) {
                return false;
            }
            const rightOp = stmt.getRightOp();
            if (!(rightOp instanceof AbstractFieldRef)) {
                return false;
            }
            return this.isAbstractFieldRef(method, rightOp);
        }
    }

    private isAbstractFieldRef(method: ArkMethod, rightOp: AbstractFieldRef): boolean {
        const fieldSignatureStr = rightOp.getFieldSignature().toString();
        if (SIGNATURES.includes(fieldSignatureStr)) {
            return true;
        }
        const field = method.getDeclaringArkClass().getField(rightOp.getFieldSignature());
        const initializers = field?.getInitializer() ?? [];
        const initializer = initializers[initializers.length - 1];
        if (!(initializer instanceof ArkAssignStmt)) {
            return false;
        }
        const rightOp2 = initializer.getRightOp();
        return this.isItExpected(method, rightOp2);
    }

    private isStmtUndefined(method: ArkMethod, op: Local): boolean {
        const arkFile = method.getDeclaringArkFile();
        const defaultClass = arkFile.getDefaultClass();
        const mtd = defaultClass.getMethods()[0];
        const locals = mtd.getBody()?.getLocals();
        if (locals === undefined) {
            return false;
        }
        for (let [key, value] of locals) {
            if (key !== op.getName()) {
                continue;
            }
            if (!this.isItExpected(method, value)) {
                continue;
            }
            return true;
        }
        return false;
    }

    private processMyArray(stmts: Stmt[]): boolean {
        for (let stmt of stmts) {
            if (!(stmt instanceof ArkInvokeStmt)) {
                continue;
            }
            const invokeExpr = stmt.getInvokeExpr();
            if (invokeExpr instanceof ArkInstanceInvokeExpr) {
                if (!this.processArkInstanceInvokeExpr(stmt, invokeExpr)) {
                    continue;
                }
                return true;
            }
            if (invokeExpr instanceof ArkStaticInvokeExpr) {
                const method = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile().getScene().getMethod(invokeExpr.getMethodSignature());
                const newStmts = method?.getBody()?.getCfg().getStmts() ?? [];
                return this.processMyArray(newStmts);
            }
        }
        return false;
    }

    private processArkInstanceInvokeExpr(stmt: Stmt, invokeExpr: ArkInstanceInvokeExpr): boolean {
        const base = invokeExpr.getBase();
        const methodSignatureStr = invokeExpr.getMethodSignature().getMethodSubSignature().toString();
        if (signatureStrs.includes(methodSignatureStr)) {
            return true;
        } else {
            if (base.getName().includes('%')) {
                const declaringStmt = base.getDeclaringStmt();
                if (!(declaringStmt instanceof ArkAssignStmt)) {
                    return false;
                }
                const rightOp = declaringStmt.getRightOp();
                if (rightOp instanceof ArkInstanceInvokeExpr) {
                    return this.processArkInstanceInvokeExpr(declaringStmt, rightOp);
                }
            } else {
                const method = stmt.getCfg().getDeclaringMethod().getDeclaringArkClass().getMethod(invokeExpr.getMethodSignature());
                const stmts = method?.getBody()?.getCfg().getStmts() ?? [];
                return this.processMyArray(stmts);
            }
        }
        return false;
    }

    private addIssueReport(stmt: Stmt): void {
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        const severity = this.rule.alert ?? this.metaData.severity;
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const startCol = originalPosition.getColNo() + text.indexOf(keyword);
        const endCol = startCol + keyword.length - 1;
        const filePath = arkFile.getFilePath();
        let defects = new Defects(lineNum, startCol, endCol, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}