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

import { AbstractInvokeExpr, ArkAssignStmt, ArkClass, ArkField, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkInvokeStmt, ArkMethod, DEFAULT_ARK_CLASS_NAME, FieldSignature, Local, Stmt } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, MatcherTypes, MatcherCallback, CheckerUtils, ClassMatcher } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { UndefinedConstant } from 'arkanalyzer/lib/core/base/Constant';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AvoidMemoryLeakInDisplaysync');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/avoid-memory-leak-in-displaysync.md',
    description: 'The DisplaySync needs to be stopped and set to null to avoid memory leaks.'
};
const createSignature = `@ohosSdk/api/@ohos.graphics.displaySync.d.ts: displaySync.${DEFAULT_ARK_CLASS_NAME}.create()`;
const startSignature = `@ohosSdk/api/@ohos.graphics.displaySync.d.ts: displaySync.DisplaySync.start()`;
const stopSignature = `@ohosSdk/api/@ohos.graphics.displaySync.d.ts: displaySync.DisplaySync.stop()`;
let displaySyncMap = new Map<string, Stmt[]>();

export class AvoidMemoryLeakInDisplaysync implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private classMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClassCb: MatcherCallback = {
            matcher: this.classMatcher,
            callback: this.check
        };
        return [matchClassCb];
    }

    public check = (arkClass: ArkClass): void => {
        for (const method of arkClass.getMethods()) {
            let fieldSignature = this.getCreateFieldSignature(method);
            if (!fieldSignature) {
                continue;
            }
            let fieldUsedInStartMethod = this.isFieldUsedInStartMethod(arkClass, fieldSignature.toString());
            if (!fieldUsedInStartMethod) {
                continue;
            }
            let field = arkClass.getField(fieldSignature);
            if (!field) {
                continue;
            }
            let disappearMethod = arkClass.getMethodWithName('aboutToDisappear');
            if (!disappearMethod) {
                return;
            }
            let stmts = disappearMethod.getCfg()?.getStmts();
            if (!stmts) {
                return;
            }
            this.getStopSigna(stmts, field);
            if (displaySyncMap.get(field.getName())?.length !== 2) {
                this.reportIssue(field);
            }
            displaySyncMap.clear();
        }
    };

    private getCreateFieldSignature(method: ArkMethod): FieldSignature | null {
        for (const stmt of method.getCfg()?.getStmts() ?? []) {
            let invoke = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invoke) {
                continue;
            }
            if (invoke.getMethodSignature().toString() !== createSignature) {
                continue;
            }
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let leftOp = stmt.getLeftOp();
            if (!(leftOp instanceof Local)) {
                continue;
            }
            let usedStmt = leftOp.getUsedStmts()[0];
            if (!(usedStmt instanceof ArkAssignStmt)) {
                continue;
            }
            let useLeftOp = usedStmt.getLeftOp();
            if (useLeftOp instanceof ArkInstanceFieldRef) {
                return useLeftOp.getFieldSignature();
            }
        }
        return null;
    }

    private isFieldUsedInStartMethod(clazz: ArkClass, fieldSignature: string): boolean {
        for (let method of clazz.getMethods()) {
            for (const stmt of method.getCfg()?.getStmts() ?? []) {
                let invoke = CheckerUtils.getInvokeExprFromStmt(stmt);
                if (!invoke) {
                    continue;
                }
                let signa = invoke.getMethodSignature().toString();
                if (signa !== startSignature) {
                    continue;
                }
                let startFieldSigna = this.getDisplaysyncFieldSignature(invoke);
                if (startFieldSigna && fieldSignature.toString() === startFieldSigna) {
                    return true;
                }
            }
        }
        return false;
    }

    private getDisplaysyncFieldSignature(invoke: AbstractInvokeExpr): string | null {
        if (!(invoke instanceof ArkInstanceInvokeExpr)) {
            return null;
        }
        let base = invoke.getBase();
        let decStmt = base.getDeclaringStmt();
        if (decStmt instanceof ArkAssignStmt) {
            let rightOp = decStmt.getRightOp();
            if (rightOp instanceof ArkInstanceFieldRef) {
                return rightOp.getFieldSignature().toString();
            }
        }
        return null;
    }

    private getStopSigna(stmts: Stmt[], field: ArkField): void {
        let fieldStmt: Stmt[] = [];
        for (const stmt of stmts) {
            if (fieldStmt.length === 0) {
                if (!(stmt instanceof ArkInvokeStmt)) {
                    continue;
                }
                this.handleArkInvokeStmt(stmt, field, fieldStmt);
            }
            if (stmt instanceof ArkAssignStmt) {
                this.handleArkAssignStmt(stmt, field, fieldStmt);
            }
        }
        if (displaySyncMap.get(field.getName())?.length !== 2) {
            displaySyncMap.set(field.getName(), fieldStmt);
        }
    }

    private handleArkInvokeStmt(stmt: ArkInvokeStmt, field: ArkField, fieldStmt: Stmt[]): void {
        let invoker = stmt.getInvokeExpr();
        if (invoker.getMethodSignature().toString() === stopSignature) {
            if (this.getDisplaysyncFieldSignature(invoker) === field.getSignature().toString()) {
                fieldStmt.push(stmt);
            }
            return;
        } else {
            let subMethod = stmt.getCfg().getDeclaringMethod().getDeclaringArkClass().getMethod(invoker.getMethodSignature());
            if (!subMethod) {
                return;
            }
            this.getStopSigna(subMethod.getCfg()?.getStmts() ?? [], field);
        }
    }

    private handleArkAssignStmt(stmt: ArkAssignStmt, field: ArkField, fieldStmt: Stmt[]): void {
        let leftOp = stmt.getLeftOp();
        let rightOp = stmt.getRightOp();
        if (!(leftOp instanceof ArkInstanceFieldRef)) {
            return;
        }
        if (!(rightOp instanceof UndefinedConstant)) {
            return;
        }
        if (leftOp.getFieldSignature().toString() === field.getSignature().toString() && rightOp.getValue() === 'undefined') {
            fieldStmt.push(stmt);
        }
    }

    private reportIssue(field: ArkField): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = field.getDeclaringArkClass().getDeclaringArkFile().getFilePath();
        const positionInfo = field.getOriginPosition();
        const lineNum = positionInfo.getLineNo();
        const fieldName = field.getName();
        const lineCode = field.getCode();
        const startColumn = positionInfo.getColNo() + lineCode.indexOf(fieldName);
        const endColunm = startColumn + fieldName.length;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}