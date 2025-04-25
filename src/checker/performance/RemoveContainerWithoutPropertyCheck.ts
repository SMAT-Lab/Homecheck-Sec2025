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

import { ArkClass, ArkFile, Stmt, ViewTreeNode } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { ClassMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'RemoveContainerWithoutPropertyCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/remove-container-without-property-check.md',
    description: 'view depth should be reduced.'
};
const containerWidgets: string[] = ['Row', 'Column', 'Flex', 'Stack', 'Scroll', 'WaterFlow', 'Grid'];
const viewTreeTool = new ViewTreeTool();

export class RemoveContainerWithoutPropertyCheck implements BaseChecker {
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
        if (arkClass.hasViewTree() && !viewTreeTool.hasTraverse(arkClass)) {
            let viewRoot = arkClass.getViewTree()?.getRoot();
            if (!viewRoot) {
                return;
            }
            this.traverseViewTree(arkClass.getDeclaringArkFile(), viewRoot);
        }
    };

    private traverseViewTree(arkFile: ArkFile, treeNode: ViewTreeNode): void {
        if (treeNode === undefined || treeNode === null) {
            return;
        }
        if (!containerWidgets.includes(treeNode.name)) {
            return;
        }
        let stmts = treeNode.attributes;
        let childrens = treeNode.children;
        if (childrens.length === 1 && stmts.size <= 2) {
            let createStmt = stmts.get('create');
            if (createStmt) {
                let stmt = createStmt[0];
                let fileSignature = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile().getFileSignature();
                // 只上报同文件，跨文件不上报
                if (fileSignature && fileSignature === arkFile.getFileSignature()) {
                    this.reportIssue(arkFile, stmt, treeNode);
                }
            }
        }
        for (let children of childrens) {
            this.traverseViewTree(arkFile, children);
        }
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt, viewRoot: ViewTreeNode): void {
        let arkFilePath = arkFile.getFilePath();
        let originPosition = stmt.getOriginPositionInfo();
        let lineNum = originPosition.getLineNo();
        let orgStmtStr = stmt.getOriginalText();
        if (!orgStmtStr || orgStmtStr.length === 0) {
            return;
        }
        let viewIndex = orgStmtStr.indexOf(viewRoot.name);
        if (viewIndex === -1) {
            return;
        }
        let startColumn = originPosition.getColNo() + viewIndex;
        let endColumn = startColumn + viewRoot.name.length - 1;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity, this.rule.ruleId,
            arkFilePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defects, undefined));
    }
}