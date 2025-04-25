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

import { ArkAssignStmt, ArkField, ArkFile, ArkInstanceFieldRef, ArkMethod, ClassSignature, Scene, Stmt, ViewTreeNode } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UseAttributeUpdaterControlRefreshScopeCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/use-attribute-updater-control-refresh-scope-check.md',
    description: 'Use attributeUpdater to accurately control the update of component attributes to avoid unnecessary update of component attributes.'
};
const containerComponent: string[] = ['List', 'Grid', 'WaterFlow', 'Swiper'];
const containerItem: string[] = ['ListItem', 'GridItem', 'FlowItem'];
const aboutToReuseSignature = 'aboutToReuse(Record<string,@ES2015/BuiltinClass: Object>)';
const attributesSizeMax = 6;
const viewTreeTool = new ViewTreeTool();

export class UseAttributeUpdaterControlRefreshScopeCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
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
        const parentNodes: ViewTreeNode[] = [];
        this.traverseViewTree(targetCla.getDeclaringArkFile(), rootTreeNode, parentNodes);
    };

    private traverseViewTree(arkFile: ArkFile, treeNode: ViewTreeNode, parentNodes: ViewTreeNode[]): void {
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
                this.reportReuseComponentAndContinueTraverse(arkFile, treeNode, parentNodes, arkFile.getScene());
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
            this.reportReuseComponentAndContinueTraverse(arkFile, treeNode, parentNodes, arkFile.getScene());
            parentNodes.pop();
            return;
        }
        // 跳过自定义控件处理，hp可以解析出自定义控件里面嵌套的组件
        if (treeNode.isCustomComponent()) {
            parentNodes.pop();
            return;
        }
        for (let children of treeNode.children) {
            if (children.isCustomComponent()) {
                continue;
            }
            if (children.children.length === 0) {
                continue;
            }
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

    private reportReuseComponentAndContinueTraverse(arkFile: ArkFile, treeNode: ViewTreeNode, parentNodes: ViewTreeNode[], scene: Scene): void {
        // 将treeNode节点下面的所有组件进行上报
        for (let children of treeNode.children) {
            if (children.isCustomComponent() && this.isReuseableComponent(arkFile, children)) {
                // 复用组件
                let classSignature = children.classSignature;
                if (!(classSignature instanceof ClassSignature)) {
                    continue;
                }
                let clazz = scene.getClass(classSignature);
                if (!clazz) {
                    continue;
                }
                this.classProcess(clazz);
            }
            if (children.isCustomComponent()) {
                continue;
            }
            this.traverseViewTree(arkFile, children, parentNodes);
        }
    }

    private classProcess(clazz: ArkClass): void {
        let method = this.aboutToReuseMethod(clazz);
        if (!method) {
            return;
        }
        for (let arkField of clazz.getFields()) {
            if (!arkField.hasDecorator('State')) {
                continue;
            }
            if (!this.isInAboutToReuse(method, arkField)) {
                continue;
            }
            if (!this.isHasViewtree(clazz, arkField)) {
                continue;
            }
            // 满足3个条件，判断组件属性是否大于5个
            this.attributeCheck(clazz, arkField);
        }
    }

    private attributeCheck(clazz: ArkClass, arkField: ArkField): boolean {
        if (!clazz.hasViewTree()) {
            return false;
        }
        let viewTreeNode = clazz.getViewTree()?.getRoot();
        if (!viewTreeNode) {
            return false;
        }
        let arkFile = clazz.getDeclaringArkFile();
        this.viewTreeProcess(viewTreeNode, arkField, arkFile);
        return false;
    }

    private viewTreeProcess(viewTreeNode: ViewTreeNode, arkField: ArkField, arkFile: ArkFile): void {
        if (!viewTreeNode) {
            return;
        }
        for (let field of viewTreeNode.stateValues) {
            if (field.getSignature() !== arkField.getSignature()) {
                continue;
            }
            // 找到字段，开始判断属性
            let attributes = viewTreeNode.attributes;
            if (attributes.size > attributesSizeMax) {
                //需要告警
                this.setIssueReport(viewTreeNode, arkFile);
            }
        }
        if (viewTreeNode.children.length > 0) {
            for (let child of viewTreeNode.children) {
                let classSignature = child.signature;
                // 如果是Component，如果在子节点遍历一遍，入口获取arkClass.getViewTree()的时候还会来一次，会重复
                if (classSignature && child.isCustomComponent()) {
                    continue;
                }
                // 如果找到逐层推出递归，如果没找到继续往子节点深度查找
                this.viewTreeProcess(child, arkField, arkFile);
            }
        }
    }

    private setIssueReport(viewTreeNode: ViewTreeNode, arkFile: ArkFile): void {
        let createStmt = viewTreeNode.attributes.get('create')?.[0];
        if (!createStmt) {
            return;
        }
        let keyWord = viewTreeNode.name;
        this.reportIssue(arkFile, createStmt, keyWord);
    }

    private aboutToReuseMethod(clazz: ArkClass): ArkMethod | null {
        for (let method of clazz.getMethods()) {
            let methodSignature = method.getSignature().getMethodSubSignature().toString();
            if (methodSignature === aboutToReuseSignature) {
                return method;
            }
        }
        return null;
    }

    private isInAboutToReuse(method: ArkMethod, arkField: ArkField): boolean {
        let stmts = method.getCfg()?.getStmts();
        if (!stmts) {
            return false;
        }
        for (let stmt of stmts) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let leftOp = stmt.getLeftOp();
            if (!(leftOp instanceof ArkInstanceFieldRef)) {
                continue;
            }
            if (leftOp.getFieldSignature().toString() === arkField.getSignature().toString()) {
                return true;
            }
        }
        return false;
    }

    private isHasViewtree(clazz: ArkClass, arkField: ArkField): boolean {
        if (!clazz.hasViewTree()) {
            return false;
        }
        if (viewTreeTool.hasTraverse(clazz)) {
            return false;
        }
        let viewTree = clazz.getViewTree();
        if (!viewTree) {
            return false;
        }
        let stateValues = viewTree.getStateValues();
        for (let [key, values] of stateValues.entries()) {
            if (!(key instanceof ArkField)) {
                continue;
            }
            if (key.getSignature() === arkField.getSignature()) {
                return true;
            }
        }
        return false;
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

    private reportIssue(arkFile: ArkFile, stmt: Stmt, keyWord: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        if (!stmt) {
            return;
        }
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const startColumn = originalPosition.getColNo() + text.indexOf(keyWord);
        const endColunm = startColumn + keyWord.length - 1;
        if (startColumn === -1) {
            return;
        }
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}