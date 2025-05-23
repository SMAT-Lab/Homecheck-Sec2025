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

import { ArkAssignStmt, ArkFile, ArkInstanceFieldRef, ArkNewArrayExpr, ArkStaticInvokeExpr, Constant, FieldSignature, Local, Scene, Stmt, Value, ViewTreeNode } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkClass, ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import { ClassMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { CheckerUtils } from '../../utils/checker/CheckerUtils';
import { Defects } from '../../model/Defects';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule } from '../../model/Rule';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'LoadOnDemandCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/load-on-demand-check.md',
    description: 'Load as needed LazyForEach.'
};
const viewTreeTool = new ViewTreeTool();
const FOREACH_STR = 'ForEach';

export class LoadOnDemandCheck implements BaseChecker {
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
        let viewTreeRoot = targetCla.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return;
        }
        this.lookingForEach(targetCla, viewTreeRoot, targetCla.getDeclaringArkFile().getScene());
    };

    private lookingForEach(targetCla: ArkClass, viewTreeRoot: ViewTreeNode, scene: Scene): void {
        if (viewTreeRoot === undefined || viewTreeRoot === null) {
            return;
        }
        if (viewTreeRoot.children.length === 0) {
            return;
        }
        if (viewTreeTool.hasTraverse(viewTreeRoot)) {
            return;
        }
        let childrens = viewTreeRoot.children;
        if (childrens[0].name === FOREACH_STR) {
            let stmts = childrens[0].attributes.get('create');
            if (!stmts) {
                return;
            }
            for (let stmt of stmts) {
                if (!(stmt instanceof Stmt)) {
                    continue;
                }
                let invokerExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
                if (!invokerExpr) {
                    continue;
                }
                let methodName = invokerExpr.getMethodSignature().getMethodSubSignature().getMethodName();
                if (methodName !== 'create') {
                    continue;
                }
                let observedSize = invokerExpr.getArg(0);
                let size = this.getForeachInitSize(targetCla, observedSize);
                if (size >= 20) {
                    this.reportIssue(targetCla.getDeclaringArkFile(), stmt, FOREACH_STR);
                }
            }
        } else {
            for (let children of childrens) {
                this.lookingForEach(targetCla, children, scene);
            }
        }
    }

    private getForeachInitSize(arkClass: ArkClass, observedSize: Value): number {
        if (!(observedSize instanceof Local)) {
            return 0;
        }
        let observedDeclaringStmt = observedSize.getDeclaringStmt();
        if (!observedDeclaringStmt || !(observedDeclaringStmt instanceof ArkAssignStmt)) {
            return 0;
        }
        let arrRightOp = observedDeclaringStmt.getRightOp();
        if (arrRightOp instanceof ArkInstanceFieldRef) {
            let fieldSignature = arrRightOp.getFieldSignature();
            return this.getSizeFromArkField(arkClass, fieldSignature);
        }
        return 0;
    }

    private getSizeFromArkField(arkClass: ArkClass, fieldSignature: FieldSignature): number {
        let arkField = arkClass.getField(fieldSignature);
        if (!arkField) {
            return 0;
        }
        let stmts = arkField.getInitializer();
        if (stmts.length === 0) {
            return 0;
        }
        let stmt = stmts[0];
        if (!(stmt instanceof ArkAssignStmt)) {
            return 0;
        }
        let value = stmt.getRightOp();
        if (value instanceof ArkNewArrayExpr) {
            let size = value.getSize();
            if (size instanceof Constant) {
                return Number(size.getValue());
            }
        } else if (value instanceof ArkStaticInvokeExpr) {
            let argSize = value.getArg(0);
            if (argSize instanceof Constant) {
                return Number(argSize.getValue());
            }
        }
        return 0;
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt, targetName: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originPosition = stmt.getOriginPositionInfo();
        const lineNum = originPosition.getLineNo();
        const originText = stmt.getOriginalText();
        if (!originText || originText.length === 0) {
            return;
        }
        const startColumn = originPosition.getColNo() + originText.indexOf(targetName);
        const endColunm = startColumn + targetName.length - 1;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}