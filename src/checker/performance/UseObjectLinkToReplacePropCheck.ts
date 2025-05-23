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

import { AbstractFieldRef, ArkAssignStmt, ArkField, ArkFile, ClassSignature, ClassType, Local, PrimitiveType, Stmt } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkClass, ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback, CheckerUtils } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UseObjectLinkToReplacePropCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/use-object-link-to-replace-prop-check.md',
    description: 'It is recommended to use @ObjectLink instead @Prop reduce unnecessary deep copies.'
};
const viewTreeTool = new ViewTreeTool();

export class UseObjectLinkToReplacePropCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        category: [ClassCategory.STRUCT],
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClassCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        };
        return [matchClassCb];
    }

    public check = (targetCla: ArkClass): void => {
        if (viewTreeTool.hasTraverse(targetCla)) {
            return;
        }
        let rootTreeNode = targetCla.getViewTree()?.getRoot();
        if (!rootTreeNode) {
            return;
        }
        for (let arkField of targetCla.getFields()) {
            if (!arkField.hasDecorator('Prop')) {
                continue;
            }
            if (this.isPrimitiveType(arkField)) {
                continue;
            }
            if (!this.isObservedType(targetCla.getDeclaringArkFile(), arkField)) {
                continue;
            }
            if (!this.isModifiedByCurrentClass(targetCla, arkField)) {
                this.reportIssue(targetCla.getDeclaringArkFile(), arkField);
            }
        }
    };

    private isPrimitiveType(arkField: ArkField): boolean {
        let type = arkField.getType();
        if (type instanceof PrimitiveType) {
            return true;
        }
        return false;
    }

    private isObservedType(arkFile: ArkFile, arkField: ArkField): boolean {
        let type = arkField.getType();
        if (!(type instanceof ClassType)) {
            return false;
        }
        let dataClass = arkFile.getClass(type.getClassSignature());
        if (!dataClass) {
            return false;
        }
        if (dataClass.hasDecorator('Observed')) {
            return true;
        }
        return false;
    }

    private isModifiedByCurrentClass(arkClass: ArkClass, arkField: ArkField): boolean {
        let fieldType = arkField.getType();
        if (!(fieldType instanceof ClassType)) {
            return false;
        }
        let fieldClassName = fieldType.getClassSignature().getClassName();
        for (let method of arkClass.getMethods()) {
            let stmts = method.getCfg()?.getStmts();
            if (!stmts) {
                continue;
            }
            return this.traverseStmts(stmts, fieldClassName);
        }
        return false;
    }

    private traverseStmts(stmts: Stmt[], fieldClassName: string): boolean {
        for (let stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                let leftOp = stmt.getLeftOp();
                if (!(leftOp instanceof AbstractFieldRef)) {
                    continue;
                }
                let declaringSignature = leftOp.getFieldSignature().getDeclaringSignature();
                if (!(declaringSignature instanceof ClassSignature)) {
                    continue;
                }
                let leftFieldClassName = declaringSignature.getClassName();
                if (leftFieldClassName === fieldClassName) {
                    return true;
                }
            }
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invoker) {
                continue;
            }
            let invokerClassName = invoker.getMethodSignature().getDeclaringClassSignature().getClassName();
            if (invokerClassName === fieldClassName) {
                return true;
            }
            let args = invoker.getArgs();
            for (let arg of args) {
                if (!(arg instanceof Local)) {
                    continue;
                }
                let argType = arg.getType();
                if (!(argType instanceof ClassType)) {
                    continue;
                }
                if (argType.getClassSignature().getClassName() === fieldClassName) {
                    return true;
                }
            }
        }
        return false;
    }

    private reportIssue(arkFile: ArkFile, arkField: ArkField): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const positionInfo = arkField.getOriginPosition();
        const lineNum = positionInfo.getLineNo();
        const fieldName = arkField.getName();
        const lineCode = arkField.getCode();
        const startColumn = positionInfo.getColNo() + lineCode.indexOf(fieldName);
        const endColunm = startColumn + fieldName.length;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}