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

import { ClassSignature, ViewTreeNode } from "arkanalyzer/lib";
import { ArkClass } from "arkanalyzer/lib/core/model/ArkClass";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from "../../Index";
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from "../../model/Defects";


const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UseGridLayoutOptionsCheck');
const viewTreeTool: ViewTreeTool = new ViewTreeTool();
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/use-grid-layout-options-check.md",
    description: "Use GridLayoutOptions when specifying the position in girds."
};

export class UseGridLayoutOptionsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly GRID_COMPONENT: string = 'Grid';
    readonly FOREACH_COMPONENT: string = 'ForEach';
    readonly GRID_ITEM: string = 'GridItem';
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
        }
        return [matchClazzCb];
    }

    public check = (target: ArkClass) => {
        if (viewTreeTool.hasTraverse(target)) {
            return;
        }
        let viewTreeRoot = target.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return;
        }
        const parentNodes: ViewTreeNode[] = [];
        this.traverseViewTree(target, viewTreeRoot, parentNodes);
    }

    private traverseViewTree(target: ArkClass, viewTreeRoot: ViewTreeNode, parentNodes: ViewTreeNode[]) {
        if (viewTreeRoot.isCustomComponent() && this.isCustomNodeInParentNodes(viewTreeRoot, parentNodes)) {
            return;
        }
        parentNodes.push(viewTreeRoot);
        if (viewTreeRoot.children.length === 0) {
            parentNodes.pop();
            return;
        }
        if (viewTreeRoot.isCustomComponent()) {
            parentNodes.pop();
            return;
        }
        if (viewTreeRoot.name === this.GRID_ITEM) {
            if (this.hasGridItemChange(viewTreeRoot)) {
                let nearParentNode = this.getNearParentNode(parentNodes);
                if (!nearParentNode) {
                    parentNodes.pop();
                    return;
                }
                if (!this.hasGridSetLayoutOptions(nearParentNode)) {
                    this.addIssueReport(target, nearParentNode);
                }
            }
        }
        for (let children of viewTreeRoot.children) {
            if (children.isCustomComponent()) {
                continue;
            }
            this.traverseViewTree(target, children, parentNodes);
        }
        parentNodes.pop();
    }

    private isCustomNodeInParentNodes(viewTreeRoot: ViewTreeNode, parentNodes: ViewTreeNode[]): boolean {
        for (let parentNode of parentNodes) {
            if (parentNode.isCustomComponent() && parentNode.signature === viewTreeRoot.signature) {
                return true;
            }
        }
        return false;
    }

    private hasGridItemChange(viewTreeRoot: ViewTreeNode): boolean {
        return viewTreeRoot.attributes.has('columnStart') || viewTreeRoot.attributes.has('columnEnd') ||
            viewTreeRoot.attributes.has('rowStart') || viewTreeRoot.attributes.has('rowEnd');
    }

    private getNearParentNode(parentNodes: ViewTreeNode[]): ViewTreeNode | null {
        for (let i = parentNodes.length - 2; i >= 0; i--) {
            let parentNode = parentNodes[i];
            if (parentNode.name === this.FOREACH_COMPONENT) {
                return null;
            }
            if (parentNode.name === this.GRID_COMPONENT) {
                return parentNode;
            }
        }
        return null;
    }

    private hasGridSetLayoutOptions(nearParentNode: ViewTreeNode): boolean {
        let stmts = nearParentNode.attributes.get('create');
        if (!stmts) {
            return false;
        }
        if (stmts.length < 2) {
            return false;
        }
        if (stmts[1].length < 2) {
            return false;
        }
        return true;
    }

    private addIssueReport(target: ArkClass, nearParentNode: ViewTreeNode) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(target, nearParentNode);
        if (warnInfo) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(target: ArkClass, nearParentNode: ViewTreeNode) {
        const arkFile = target.getDeclaringArkFile();
        if (arkFile) {
            let stmts = nearParentNode.attributes.get('create');
            if (!stmts) {
                return;
            }
            let name = nearParentNode.name;
            if (nearParentNode.isCustomComponent()) {
                let nodeSignature = nearParentNode.signature;
                if (nodeSignature instanceof ClassSignature) {
                    name = nodeSignature.getClassName();
                }
            }
            const text = stmts[0].getOriginalText() ?? '';
            const nodeIndex = text.indexOf(name);
            if (nodeIndex === -1) {
                return;
            }
            const originalPosition = stmts[0].getOriginPositionInfo();
            const lineNum = originalPosition.getLineNo();
            const startCol = originalPosition.getColNo() + nodeIndex;
            const endCol = startCol + name.length - 1;
            const originPath = arkFile.getFilePath();
            return { lineNum, startCol, endCol, filePath: originPath };
        } else {
            logger.debug('ArkFile is null.');
        }
        return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}