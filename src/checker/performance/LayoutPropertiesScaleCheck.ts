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

import { ArkAssignStmt, ArkFile, ArkInstanceFieldRef, ArkInvokeStmt, ArkMethod, Constant, FunctionType, MethodSignature, Stmt, ViewTreeNode } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkClass, ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MethodMatcher, MatcherCallback } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'LayoutPropertiesScaleCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/layout-properties-scale-check.md',
    description: 'Use the property animation scale of graphic transformation when the component layout is changed.'
};
const viewTreeTool = new ViewTreeTool();
let layoutSet: Set<string> = new Set<string>(['width', 'height', 'layoutWeight', 'size']);

export class LayoutPropertiesScaleCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        category: [ClassCategory.STRUCT],
        hasViewTree: true
    };

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.clsMatcher]
    };

    public registerMatchers(): MatcherCallback[] {
        const matchMethodCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check
        };
        return [matchMethodCb];
    }

    public check = (targetMethod: ArkMethod): void => {
        const stmts = targetMethod.getBody()?.getCfg().getStmts() ?? [];
        for (let stmt of stmts) {
            if (!(stmt instanceof ArkInvokeStmt)) {
                continue;
            }
            const methodSignature = stmt.getInvokeExpr().getMethodSignature();
            const invokeMethodName = methodSignature.getMethodSubSignature().getMethodName();
            if (invokeMethodName === 'animateTo') {
                this.parameterComper(stmt, targetMethod.getDeclaringArkClass());
            }
        }
    };

    private parameterComper(stmt: ArkInvokeStmt, arkClass: ArkClass): void {
        let args = stmt.getInvokeExpr().getArgs();
        for (let arg of args) {
            let type = arg.getType();
            if (type instanceof FunctionType) {
                let arkMethod = arkClass.getDeclaringArkFile().getScene().getMethod(type.getMethodSignature());
                if (!arkMethod) {
                    continue;
                }
                let arkStmts = arkMethod.getBody()?.getCfg().getStmts() ?? [];
                this.stmtComper(arkStmts, arkClass);
            }
        }
    }

    private stmtComper(stmts: Stmt[], arkClass: ArkClass): void {
        for (let stmt of stmts) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let leftOp = stmt.getLeftOp();
            if (leftOp instanceof ArkInstanceFieldRef) {
                let fieldName = leftOp.getFieldName();
                if (this.isInViewTree(fieldName, arkClass) && this.isStateVariable(fieldName, arkClass)) {
                    this.reportIssue(arkClass.getDeclaringArkFile(), stmt, fieldName);
                }
            }
        }
    }

    private isInViewTree(fieldName: string, arkClass: ArkClass): boolean {
        const viewTreeRoot = arkClass.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return false;
        }
        for (let child of viewTreeRoot.children) {
            if (this.checkChildren(child, fieldName)) {
                return true;
            }
        }
        return false;
    }

    private checkChildren(child: ViewTreeNode, fieldName: string): boolean {
        for (let [key, value] of child.attributes.entries()) {
            if (!layoutSet.has(key)) {
                continue;
            }
            for (let val of value) {
                if (val instanceof Array && this.checkVal(val, fieldName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkVal(val: (MethodSignature | ArkInstanceFieldRef | Constant)[], fieldName: string): boolean {
        for (let instanFileRef of val) {
            if (!(instanFileRef instanceof ArkInstanceFieldRef)) {
                continue;
            }
            let name = instanFileRef.getFieldName();
            if (name === fieldName) {
                return true;
            }
        }
        return false;
    }

    private isStateVariable(fieldName: string, arkClass: ArkClass): boolean {
        if (!arkClass.getFields()) {
            return false;
        }
        for (let arkField of arkClass.getFields()) {
            if (arkField.getName() === fieldName) {
                return arkField.hasDecorator(new Set(['State', 'Link', 'Prop', 'Provide', 'Consume', 'Observed', 'ObjectLink']));
            }
        }
        return false;
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt, keyword: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        let startColumn = -1;
        let endColunm = -1;
        const orgStmtStr = stmt.getOriginalText();
        if (orgStmtStr && orgStmtStr.length !== 0) {
            startColumn = originalPosition.getColNo() + orgStmtStr.indexOf(keyword);
            endColunm = startColumn + keyword.length - 1;
        }
        if (startColumn === -1) {
            return;
        }
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}