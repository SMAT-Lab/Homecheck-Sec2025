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

import { ArkAssignStmt, ArkInstanceFieldRef, Constant, MethodSignature, Stmt, ViewTreeNode } from 'arkanalyzer/lib';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'LimitRefreshScopeCheck');
const viewTreeTool: ViewTreeTool = new ViewTreeTool();
const cachedCountControls: string[] = ['Badge', 'Column', 'ColumnSplit', 'Counter', 'Flex', 'FlowItem', 'GridCol', 'GridRow',
    'Grid', 'GridItem', 'List', 'ListItem', 'ListItemGroup', 'Navigator', 'Panel', 'Refresh', 'RelativeContainer', 'Row', 'RowSplit',
    'Scroll', 'SideBarContainer', 'Stack', 'Swiper', 'Tabs', 'TabContent', 'WaterFlow'];
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/limit-refresh-scope-check.md',
    description: 'Add a container to the if statement to reduce the refresh range.'
};

export class LimitRefreshScopeCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly IF: string = 'If';
    readonly CREATE: string = 'create';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClazzCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        };
        return [matchClazzCb];
    }

    public check = (target: ArkClass): void => {
        if (!viewTreeTool.hasTraverse(target)) {
            let viewTreeRoot = target.getViewTree()?.getRoot();
            if (!viewTreeRoot) {
                return;
            }
            this.traverseViewTree(viewTreeRoot);
        }
    };

    private traverseViewTree(viewTreeRoot: ViewTreeNode): void {
        if (viewTreeTool.hasTraverse(viewTreeRoot)) {
            return;
        }
        let name = viewTreeRoot.name;
        if (name === this.IF) {
            if (this.checkParentNode(viewTreeRoot.parent)) {
                return;
            }
            for (let [key, vals] of viewTreeRoot.attributes) {
                if (key !== this.CREATE) {
                    continue;
                }
                let stmt = this.getWarnInfoByVals(vals);
                if (!stmt) {
                    continue;
                }
                this.addIssueReport(name, stmt);
                break;
            }
        }
        if (viewTreeRoot.children.length > 0) {
            for (let child of viewTreeRoot.children) {
                this.traverseViewTree(child);
            }
        }
    }

    private checkParentNode(node: ViewTreeNode | null): boolean {
        if (!node) {
            return false;
        }
        let children = node.children;
        if (children.length !== 1) {
            return false;
        }
        let parentName = node.name;
        if (cachedCountControls.includes(parentName)) {
            return true;
        } else {
            return this.checkParentNode(node.parent);
        }
    }

    private getWarnInfoByVals(vals: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]]): Stmt | null {
        let stmt: Stmt | null = null;
        for (let val of vals) {
            if (val instanceof ArkAssignStmt) {
                stmt = val;
            }
        }
        return stmt;
    }

    private addIssueReport(name: string, stmt: Stmt): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(name, stmt);
        if (warnInfo) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(name: string, stmt: Stmt): {
        lineNum: number;
        startCol: number;
        endCol: number;
        filePath: string;
    } {
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originPosition = stmt.getOriginPositionInfo();
            const lineNum = originPosition.getLineNo();
            const startCol = originPosition.getColNo();
            const endCol = startCol + name.length - 1;
            const originPath = arkFile.getFilePath();
            return { lineNum, startCol, endCol, filePath: originPath };
        } else {
            logger.debug('ArkFile is null.');
        }
        return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}