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

import { AbstractInvokeExpr, ArkAssignStmt, ArkClass, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkMethod, FieldSignature, Local, Stmt } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, ClassMatcher, MatcherCallback, MatcherTypes, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Defects, IssueReport } from '../../model/Defects';
import { UndefinedConstant } from 'arkanalyzer/lib/core/base/Constant';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AvoidMemoryLeakInAnimator');
const stmtMap: Map<FieldSignature, Stmt> = new Map();
const CreateSignatures: string[] = [
    '@ohosSdk/api/@ohos.animator.d.ts: Animator.[static]create(@ohosSdk/api/@ohos.animator.d.ts: AnimatorOptions)',
    '@ohosSdk/api/@ohos.arkui.UIContext.d.ts: UIContext.createAnimator(@ohosSdk/api/@ohos.animator.d.ts: AnimatorOptions)',
];
const Signatures: string[] = [
    '@ohosSdk/api/@ohos.animator.d.ts: AnimatorResult.finish()',
    '@ohosSdk/api/@ohos.animator.d.ts: AnimatorResult.cancel()',
];
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/avoid-memory-leak-in-animator.md',
    description: 'First finish/cancel, then empty it.'
};

export class AvoidMemoryLeakInAnimator implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClassCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        };
        return [matchClassCb];
    }

    public check = (target: ArkClass): void => {
        stmtMap.clear();
        const methods = target.getMethods();
        this.getCreateStmt(methods);
        for (let [key, value] of stmtMap) {
            const hasFinishOrCancelStmt = this.getFinishOrCancelStmt(methods, key.toString());
            const hasEmptyStmt = this.getEmptyStmt(methods, key.toString());
            const name = target.getField(key)?.getName();
            if (name === undefined) {
                continue;
            }
            if (hasFinishOrCancelStmt && hasEmptyStmt) {
                continue;
            }
            this.reportIssue(value, name);
        }
    };

    private getCreateStmt(methods: ArkMethod[]): void {
        for (let mtd of methods) {
            const stmts = mtd.getBody()?.getCfg().getStmts() ?? [];
            for (let stmt of stmts) {
                if (!(stmt instanceof ArkAssignStmt)) {
                    continue;
                }
                const rightOp = stmt.getRightOp();
                if (!(rightOp instanceof AbstractInvokeExpr)) {
                    continue;
                }
                const methodSignatureStr = rightOp.getMethodSignature().toString();
                if (!CreateSignatures.includes(methodSignatureStr)) {
                    continue;
                }
                const leftOp = stmt.getLeftOp();
                if (!(leftOp instanceof Local)) {
                    continue;
                }
                const usedStmt = leftOp.getUsedStmts()[0];
                if (!(usedStmt instanceof ArkAssignStmt)) {
                    continue;
                }
                const leftOp2 = usedStmt.getLeftOp();
                if (!(leftOp2 instanceof ArkInstanceFieldRef)) {
                    continue;
                }
                const fieldSignature = leftOp2.getFieldSignature();
                stmtMap.set(fieldSignature, stmt);
            }
        }
    }

    private getFinishOrCancelStmt(methods: ArkMethod[], signature: string): boolean {
        for (let mtd of methods) {
            const stmts = mtd.getBody()?.getCfg().getStmts() ?? [];
            for (let stmt of stmts) {
                const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
                if (!invokeExpr) {
                    continue;
                }
                if (!(invokeExpr instanceof ArkInstanceInvokeExpr)) {
                    continue;
                }
                const methodSignatureStr = invokeExpr.getMethodSignature().toString();
                if (!Signatures.includes(methodSignatureStr)) {
                    continue;
                }
                const base = invokeExpr.getBase();
                if (!(base instanceof Local)) {
                    continue;
                }
                const declaringStmt = base.getDeclaringStmt();
                if (!(declaringStmt instanceof ArkAssignStmt)) {
                    continue;
                }
                const rightOp = declaringStmt.getRightOp();
                if (!(rightOp instanceof ArkInstanceFieldRef)) {
                    continue;
                }
                const fieldSignature = rightOp.getFieldSignature().toString();
                if (fieldSignature !== signature) {
                    continue;
                }
                return true;
            }
        }
        return false;
    }

    private getEmptyStmt(methods: ArkMethod[], signature: string): boolean {
        for (let mtd of methods) {
            const stmts = mtd.getBody()?.getCfg().getStmts() ?? [];
            for (let stmt of stmts) {
                if (!(stmt instanceof ArkAssignStmt)) {
                    continue;
                }
                const rightOp = stmt.getRightOp();
                if (!(rightOp instanceof UndefinedConstant)) {
                    continue;
                }
                const leftOp = stmt.getLeftOp();
                if (!(leftOp instanceof ArkInstanceFieldRef)) {
                    continue;
                }
                const fieldSignature = leftOp.getFieldSignature().toString();
                if (fieldSignature !== signature) {
                    continue;
                }
                return true;
            }
        }
        return false;
    }

    private reportIssue(stmt: Stmt, name: string): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.debug('Stmt text is empty.');
            return;
        }
        const index = text.indexOf(name);
        if (index === -1) {
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const startColum = originalPosition.getColNo() + index;
        const endColum = startColum + name.length - 1;
        const filePath = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile().getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}