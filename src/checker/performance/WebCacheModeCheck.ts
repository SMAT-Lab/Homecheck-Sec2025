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

import { AbstractFieldRef, ArkAssignStmt, ArkClass, ArkStaticFieldRef, Local, Stmt, Value, ViewTreeNode } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback, CheckerUtils } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'WebCacheModeCheck');
let viewTreeTool: ViewTreeTool = new ViewTreeTool();
const WEB: string = 'Web';
const CACHEMODE: string = 'cacheMode';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/web-cache-mode-check.md',
    description: 'Avoid setting the Web component\'s cacheMode attribute to Online.'
};
const cachemodeSignature = '@ohosSdk/component/web.d.ts: CacheMode.[static]Online';

export class WebCacheModeCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private buildMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    }

    public check = (arkClass: ArkClass) => {
        if (viewTreeTool.hasTraverse(arkClass)) {
            return;
        }
        const viewtreeRoot = arkClass.getViewTree()?.getRoot();
        if (!viewtreeRoot) {
            return;
        }
        this.traverseViewTree(viewtreeRoot, arkClass);
    }

    private traverseViewTree(viewtreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        if (viewtreeRoot === undefined) {
            return;
        }
        let name = viewtreeRoot.name;
        if (name === WEB) {
            this.cacheModeOnlineCheck(viewtreeRoot, arkClass);
        }
        if (viewtreeRoot.children.length > 0) {
            for (let child of viewtreeRoot.children) {
                let classSignature = child.signature;
                if (classSignature && child.isCustomComponent()) {
                    continue;
                }
                this.traverseViewTree(child, arkClass);
            }
        }
    }

    private cacheModeOnlineCheck(viewtreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        let vals = viewtreeRoot.attributes.get(CACHEMODE);
        if (!vals) {
            return;
        }
        let stmt = vals[0];
        let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invokeExpr) {
            return;
        }
        let arg = invokeExpr.getArg(0);
        if (!(arg instanceof Local)) {
            return;
        }
        let declaringStmt = arg.getDeclaringStmt();
        if (!(declaringStmt instanceof ArkAssignStmt)) {
            return;
        }
        let rightOp = declaringStmt.getRightOp();
        if (this.traverseField(rightOp, arkClass)) {
            this.reportIssue(stmt, arg);
        }
    }

    private traverseField(rightOp: Value, arkClass: ArkClass): boolean {
        if (!(rightOp instanceof AbstractFieldRef)) {
            return false;
        }
        let fieldSignature = rightOp.getFieldSignature();
        if (rightOp instanceof ArkStaticFieldRef) {
            let fieldSignatureStr = fieldSignature.toString();
            if (fieldSignatureStr === cachemodeSignature) {
                return true;
            }
        } else {
            let field = arkClass.getField(fieldSignature);
            if (!field) {
                return false;
            }
            let initializerStmts = field.getInitializer();
            for (let initializerStmt of initializerStmts) {
                if (!(initializerStmt instanceof ArkAssignStmt)) {
                    continue;
                }
                let rightOpStmt = initializerStmt.getRightOp();
                return this.traverseField(rightOpStmt, arkClass);
            }
        }
        return false;
    }

    private reportIssue(stmt: Stmt, arg: Local): void {
        const filePath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
        let fullPosition = stmt.getOperandOriginalPosition(arg);
        if (!fullPosition) {
            return;
        }
        let lineNum = fullPosition.getFirstLine();
        let startColumn = fullPosition.getFirstCol();
        let endColumn = fullPosition.getLastCol() - 1;
        if (lineNum === -1 || startColumn === -1 || endColumn === -1) {
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}