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

import { AbstractInvokeExpr, ArkClass, ArkInstanceFieldRef, ArkInstanceInvokeExpr, Constant, FunctionType, MethodSignature, Scene, Stmt, ViewTreeNode } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback, CheckerUtils } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AvoidEmptyCallbackCheck');
const STMTSLENGTH = 2;
let viewTreeTool: ViewTreeTool = new ViewTreeTool();
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/avoid-empty-callback-check.md',
    description: 'Do not set empty system callback listeners.'
};
const eventSet: Set<string> = new Set<string>(['onTouch', 'onItemDragMove', 'onDragMove', 'onMouse',
    'onVisibleAreaChange', 'onAreaChange', 'onDidScroll', 'onActionUpdate', 'onClick']);

export class AvoidEmptyCallbackCheck implements BaseChecker {
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
        };
        return [matchBuildCb];
    }

    public check = (arkClass: ArkClass): void => {
        if (viewTreeTool.hasTraverse(arkClass)) {
            return;
        }
        const viewtreeRoot = arkClass.getViewTree()?.getRoot();
        if (!viewtreeRoot) {
            return;
        }
        this.traverseViewTree(viewtreeRoot, arkClass);
    };

    private traverseViewTree(viewtreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        if (viewtreeRoot === undefined) {
            return;
        }
        this.onClickOperation(viewtreeRoot, arkClass);
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

    private onClickOperation(viewtreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        for (let [key, vals] of viewtreeRoot.attributes) {
            if (eventSet.has(key)) {
                this.onClickCheck(key, vals, arkClass);
            }
        }
    }

    private onClickCheck(key: string, stmts: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]],
        arkClass: ArkClass): void {
        let stmt = stmts[0];
        const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invokeExpr || !this.isReport(invokeExpr, arkClass.getDeclaringArkFile().getScene())) {
            return;
        }
        this.reportIssue(stmt, key, invokeExpr);
        return;
    }

    private isReport(invokeExpr: AbstractInvokeExpr, scene: Scene): boolean {
        let arg = invokeExpr.getArg(0);
        let type = arg.getType();
        if (!(type instanceof FunctionType)) {
            return false;
        }
        let methodSignature = type.getMethodSignature();
        let method = scene.getMethod(methodSignature);
        if (method === null) {
            return false;
        }
        let methodStmts = method.getBody()?.getCfg()?.getStmts();
        if (!methodStmts || methodStmts.length !== STMTSLENGTH) {
            return false;
        }
        return true;
    }

    private reportIssue(stmt: Stmt, keyword: string, invokeExpr: AbstractInvokeExpr): void {
        if (!(invokeExpr instanceof ArkInstanceInvokeExpr)) {
            return;
        }
        const filePath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
        let originalPosition = stmt.getOriginPositionInfo();
        let startColumn = -1;
        let endColumn = -1;
        let orgStmtStr = stmt.getOriginalText();
        if (!orgStmtStr || orgStmtStr.length === 0) {
            return;
        }
        let originalTexts = orgStmtStr.split('\n');
        let position = stmt.getOperandOriginalPosition(invokeExpr.getBase());
        if (!position) {
            return;
        }
        let baseLastLine = position.getLastLine();
        let diffNum = baseLastLine - position.getFirstLine();
        let originalTextsSlice = originalTexts.slice(diffNum);
        let lineCount = -1;
        for (let [index, originalText] of originalTextsSlice.entries()) {
            lineCount++;
            if (!originalText.includes(keyword)) {
                continue;
            }
            if (index === 0) {
                startColumn = originalText.indexOf(keyword) + originalPosition.getColNo();
            } else {
                startColumn = originalText.indexOf(keyword) + 1;
            }
            break;
        }
        endColumn = startColumn + keyword.length - 1;
        if (startColumn === -1) {
            return;
        }
        let lineNum = baseLastLine + lineCount;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}