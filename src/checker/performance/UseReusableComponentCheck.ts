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

import { ArkFile, ClassSignature, ViewTreeNode } from "arkanalyzer/lib";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { ArkClass } from "arkanalyzer/lib/core/model/ArkClass";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from "../../Index";
import { IssueReport } from "../../model/Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UseReusableComponentCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: "docs/use-reusable-component-check.md",
    description: "Use reusable components to define complex components whenever possible."
};
const containerComponent: string[] = ['List', 'Grid', 'WaterFlow', 'Swiper'];
const containerItem: string[] = ['ListItem', 'GridItem', 'FlowItem'];

export class UseReusableComponentCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClassCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        }
        return [matchClassCb];
    }

    public check = (targetCla: ArkClass) => {
        if (!targetCla.hasViewTree()) {
            return;
        }
        let rootTreeNode = targetCla.getViewTree()?.getRoot();
        if (!rootTreeNode) {
            return;
        }
        const parentNodes: ViewTreeNode[] = [];
        this.traverseViewTree(targetCla.getDeclaringArkFile(), rootTreeNode, parentNodes);
    }

    private traverseViewTree(arkFile: ArkFile, treeNode: ViewTreeNode, parentNodes: ViewTreeNode[]) {
        if (!treeNode) {
            return;
        }
        // 防止自定义组件互相嵌套导致max call
        if (treeNode.isCustomComponent() && this.isCustomNodeInParentNodes(treeNode, parentNodes)) {
            return;
        }
        // 记录parent节点
        parentNodes.push(treeNode);
        // 跳过非容器组件
        if (treeNode.children.length === 0) {
            parentNodes.pop();
            return;
        }
        // 当前节点是LazyForEach
        if (treeNode.name === 'LazyForEach') {
            let pNodeName = this.getNearParentName(parentNodes);
            // 如果LazyForEach未找到四大组件类型的父节点，则不会产生复用场景，直接跳过
            if (pNodeName === '') {
                parentNodes.pop();
                return;
            } else if (pNodeName === 'Swiper') {
                // Swiper组件LazyForEach下面第一级子组件都要报，还要继续遍历
                this.reportReuseComponentAndContinueTraverse(arkFile, treeNode, parentNodes);
            } else {
                // 遍历List,Grid,WaterFlow三种组件的*Item
                for (let children of treeNode.children) {
                    this.traverseViewTree(arkFile, children, parentNodes);
                }
            }
            parentNodes.pop();
            return;
        }
        // 当前节点是*Item
        if (containerItem.includes(treeNode.name)) {
            // 遍历List,Grid,WaterFlow三种组件的*Item
            this.reportReuseComponentAndContinueTraverse(arkFile, treeNode, parentNodes);
            parentNodes.pop();
            return;
        }
        for (let children of treeNode.children) {
            this.traverseViewTree(arkFile, children, parentNodes);
        }
        parentNodes.pop();
    }

    private isCustomNodeInParentNodes(customNode: ViewTreeNode, parentNodes: ViewTreeNode[]): boolean {
        for (let pNode of parentNodes) {
            if (pNode.isCustomComponent() && pNode.signature === customNode.signature) {
                return true;
            }
        }
        return false;
    }

    private getNearParentName(parentNodes: ViewTreeNode[]): string {
        for (let i = parentNodes.length - 2; i >= 0; i--) {
            let pNode = parentNodes[i];
            if (pNode.name === 'LazyForEach') {
                return '';
            }
            if (containerComponent.includes(pNode.name)) {
                return pNode.name;
            }
        }
        return '';
    }

    private reportReuseComponentAndContinueTraverse(arkFile: ArkFile, treeNode: ViewTreeNode, parentNodes: ViewTreeNode[]) {
        // 将treeNode节点下面的所有组件进行上报
        for (let children of treeNode.children) {
            if (children.isCustomComponent()) {
                // 自定义组件，且实现复用功能则不上报
                if (!this.isReuseableComponent(arkFile, children)) {
                    this.reportIssue(arkFile, children)
                }
            } else {
                this.reportIssue(arkFile, children);
            }
            this.traverseViewTree(arkFile, children, parentNodes);
        }
    }

    private isReuseableComponent(arkFile: ArkFile, customNode: ViewTreeNode): boolean {
        let nodeSignature = customNode.signature;
        if (!nodeSignature) {
            return false;
        }
        if (!(nodeSignature instanceof ClassSignature)) {
            return false;
        }
        let customNodeClass = arkFile.getScene().getClass(nodeSignature);
        if (!customNodeClass) {
            return false;
        }
        // 自定义组件有@Reusable注解
        let hasReusable = customNodeClass.hasDecorator('Reusable');
        // 自定义组件实现了aboutToReuse方法
        let aboutToReuseMethod = customNodeClass.getMethodWithName('aboutToReuse');
        return hasReusable && aboutToReuseMethod !== null;
    }


    public reportIssue(arkFile: ArkFile, reportNode: ViewTreeNode) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const createStmts = reportNode.attributes.get('create');
        if (!createStmts) {
            return;
        }
        let componentName = reportNode.name;
        if (reportNode.isCustomComponent()) {
            let nodeSignature = reportNode.signature;
            if (nodeSignature instanceof ClassSignature) {
                componentName = nodeSignature.getClassName();
            }
        }
        const text = createStmts[0].getOriginalText() ?? '';
        let nodeIndex = text.indexOf(componentName);
        if (nodeIndex === -1) {
            return;
        }
        const originalPosition = createStmts[0].getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const startColumn = originalPosition.getColNo() + nodeIndex;
        const endColunm = startColumn + componentName.length - 1;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}