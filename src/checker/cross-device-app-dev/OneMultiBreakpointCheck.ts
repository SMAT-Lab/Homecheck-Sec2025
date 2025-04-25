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

import { ArkAssignStmt, ArkConditionExpr, ArkInstanceFieldRef, ArkMethod, ArkNormalBinopExpr, ArkStaticFieldRef, ArkStaticInvokeExpr, DEFAULT_ARK_CLASS_NAME, Local, Stmt, Value } from 'arkanalyzer';
import { ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MethodMatcher, MatcherCallback, CheckerUtils } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { StringConstant } from 'arkanalyzer/lib/core/base/Constant';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'OneMultiBreakpointCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/one-multi-breakpoint-check.md',
    description: 'Use breakpoints, rather than device type, screen orientation, or foldability, as the basis for responsive layouts for one-time development for multi-device deployment.'
};
const deviceTypeSignature = `@ohosSdk/api/@ohos.deviceInfo.d.ts: deviceInfo.[static]deviceType`;
const displaySignature: string[] = [
    `@ohosSdk/api/@ohos.display.d.ts: display.Display.orientation`,
    `@ohosSdk/api/@ohos.display.d.ts: display.${DEFAULT_ARK_CLASS_NAME}.isFoldable()`
];
const foldStatusSignature = `@ohosSdk/api/@ohos.display.d.ts: display.${DEFAULT_ARK_CLASS_NAME}.getFoldStatus()`;
const foldDirectionSignature = `@ohosSdk/api/@ohos.display.d.ts: display.FoldStatus.[static]FOLD_STATUS_HALF_FOLDED`;

export class OneMultiBreakpointCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        category: [ClassCategory.STRUCT],
        hasViewTree: true
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

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        };
        const matchBuilderCb: MatcherCallback = {
            matcher: this.builderMatcher,
            callback: this.check
        };
        return [matchBuildCb, matchBuilderCb];
    }

    public check = (targetMtd: ArkMethod): void => {
        let stmts = targetMtd.getCfg()?.getStmts();
        if (!stmts) {
            return;
        }
        this.processStmt(stmts);
    };

    private processStmt(stmts: Stmt[]): void {
        for (let stmt of stmts) {
            let rightOp = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!rightOp) {
                continue;
            }
            if (rightOp.getMethodSignature().getDeclaringClassSignature().getClassName() !== 'If') {
                continue;
            }
            let arg = rightOp.getArg(0);
            this.processArg(arg);
        }
    }

    private processArg(arg: Value): void {
        if (!(arg instanceof Local)) {
            return;
        }
        let decStmt = arg.getDeclaringStmt();
        if (decStmt instanceof ArkConditionExpr) {
            if (this.processConditionExpr(decStmt)) {
                this.reportIssue(decStmt);
            }
        } else if (decStmt instanceof ArkAssignStmt) {
            let defRightOp = decStmt.getRightOp();
            if (defRightOp instanceof ArkConditionExpr) {
                if (this.processConditionExpr(defRightOp)) {
                    this.reportIssue(decStmt);
                }
            } else if (defRightOp instanceof ArkNormalBinopExpr) {
                this.processArg(defRightOp.getOp1());
            }
        }
    }

    private processConditionExpr(expr: ArkConditionExpr): boolean {
        let op1 = expr.getOp1();
        let op2 = expr.getOp2();
        let operator = expr.getOperator().toString();
        let fieldSignature = this.getStaticFieldSignature(op1);
        if (!fieldSignature) {
            return false;
        }
        if (fieldSignature === deviceTypeSignature && this.isOp2Valid(op2) && operator === '!==') {
            return true;
        }
        if ((fieldSignature === deviceTypeSignature && !this.isOp2Valid(op2)) ||
            displaySignature.includes(fieldSignature) ||
            (fieldSignature === foldStatusSignature && !this.isOp2Valid(op2))) {
            return true;
        }
        return false;
    }

    private getStaticFieldSignature(op1: Value): string | null {
        if (!(op1 instanceof Local)) {
            return null;
        }
        let opDecStmt = op1.getDeclaringStmt();
        if (!(opDecStmt instanceof ArkAssignStmt)) {
            return null;
        }
        let rightOp = opDecStmt.getRightOp();
        if (rightOp instanceof ArkStaticFieldRef || rightOp instanceof ArkInstanceFieldRef) {
            return rightOp.getFieldSignature().toString();
        } else if (rightOp instanceof ArkStaticInvokeExpr) {
            return rightOp.getMethodSignature().toString();
        } else if (rightOp instanceof ArkNormalBinopExpr) {
            this.processArg(rightOp.getOp1());
        }
        return null;
    }

    private isOp2Valid(op2: Value): boolean {
        if (op2 instanceof Local) {
            let op2Signature = this.getStaticFieldSignature(op2);
            if (op2Signature === foldDirectionSignature) {
                return true;
            }
        }
        if (op2 instanceof StringConstant) {
            if (op2.getValue() === '2in1') {
                return true;
            }
        }
        return false;
    }

    private reportIssue(stmt: Stmt): void {
        const filePath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
        if (!filePath) {
            return;
        }
        let text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        let originPosition = stmt.getOriginPositionInfo();
        let lineNum = originPosition.getLineNo();
        let startColum = originPosition.getColNo();
        let endColumn = startColum + 2;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColum, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}