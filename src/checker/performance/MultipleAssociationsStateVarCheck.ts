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
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { ArkFile } from 'arkanalyzer/lib/core/model/ArkFile';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import { ArkField } from 'arkanalyzer/lib/core/model/ArkField';
import { ViewTreeNode } from 'arkanalyzer/lib/core/graph/ViewTree';
import { ArkInstanceFieldRef } from 'arkanalyzer/lib/core/base/Ref';
import { Rule, Defects, FileMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'MultipleAssociationsStateVarCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/multiple-associations-state-var-check.md',
    description: 'This data is associated with multiple components, you are advised to use the @Watch decorator to add update conditions to avoid unnecessary component update.'
};
const viewTreeTool = new ViewTreeTool();
const listComponent: string[] = ['ForEach', 'LazyForEach', 'Repeat'];

export class MultipleAssociationsStateVarCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchFileCb];
    }

    public check = (arkFile: ArkFile): void => {
        for (let clazz of arkFile.getClasses()) {
            if (clazz.hasViewTree() && !viewTreeTool.hasTraverse(clazz)) {
                this.processViewTreeClass(clazz);
            }
        }
        for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
            for (let clazz of namespace.getClasses()) {
                if (clazz.hasViewTree() && !viewTreeTool.hasTraverse(clazz)) {
                    this.processViewTreeClass(clazz);
                }
            }
        }
    };

    private processViewTreeClass(clazz: ArkClass): void {
        let stateVarList: ArkField[] = [];
        for (let arkField of clazz.getFields()) {
            if (!arkField.hasDecorator('State')) {
                continue;
            }
            let associateViewCount = this.getAssociateViewCount(clazz, arkField);
            if (associateViewCount >= 2) {
                stateVarList.push(arkField);
            }
        }
        let viewRoot = clazz.getViewTree()?.getRoot();
        if (!viewRoot) {
            return;
        }
        this.traverseViewTree(viewRoot, stateVarList);
    }

    private traverseViewTree(treeNode: ViewTreeNode, stateVarList: ArkField[]): void {
        if (treeNode === undefined || treeNode === null) {
            return;
        }
        if (treeNode.isCustomComponent()) {
            let valuesTransferMap = treeNode.stateValuesTransfer;
            if (!valuesTransferMap) {
                return;
            }
            for (let [key, value] of valuesTransferMap) {
                if (!(value instanceof ArkField)) {
                    continue;
                }
                if (!stateVarList.includes(value)) {
                    continue;
                }
                if (key.hasDecorator('Watch')) {
                    continue;
                }
                let declaringArkFile = key.getDeclaringArkClass().getDeclaringArkFile();
                let positionInfo = key.getOriginPosition();
                let lineNum = positionInfo.getLineNo();
                let fieldName = key.getName();
                let lineCode = key.getCode();
                let startColumn = positionInfo.getColNo() + lineCode.indexOf(fieldName);
                let endColumn = startColumn + fieldName.length - 1;
                if (startColumn !== -1) {
                    this.reportIssue(declaringArkFile, lineNum, startColumn, endColumn);
                }
            }
        } else {
            for (let children of treeNode.children) {
                this.traverseViewTree(children, stateVarList);
            }
        }
    }

    private getAssociateViewCount(clazz: ArkClass, arkField: ArkField): number {
        let viewTree = clazz.getViewTree();
        if (!viewTree) {
            return 0;
        }
        let count = 0;
        let values = viewTree.getStateValues();
        for (let [key, value] of values.entries()) {
            let signature = key.getSignature();
            if (signature !== arkField.getSignature()) {
                continue;
            }
            let tempSet = new Set(value);
            count = this.getRealAttachViewCount(key, tempSet);
            if (count === 1 && this.isParentIsListComponent(tempSet)) {
                count += 2;
            }
            break;
        }
        return count;
    }

    private getRealAttachViewCount(field: ArkField, viewNodes: Set<ViewTreeNode>): number {
        if (viewNodes.size === 0) {
            return 0;
        }
        let size = viewNodes.size;
        for (let attachNode of viewNodes) {
            if (!this.isNodeRealAttach(field, attachNode)) {
                size--;
                viewNodes.delete(attachNode);
            }
        }
        return size;
    }

    private isNodeRealAttach(field: ArkField, attachNode: ViewTreeNode): boolean {
        let statesValuesTransfer = attachNode.stateValuesTransfer;
        if (attachNode.isCustomComponent() && statesValuesTransfer) {
            for (let [key, value] of statesValuesTransfer) {
                if (value.getSignature() === field.getSignature()) {
                    return true;
                }
            }
        }
        let attributes = attachNode.attributes;
        for (let [key, stmt2Value] of attributes) {
            if (key.startsWith('on') || key === 'pop') {
                continue;
            }
            let values = stmt2Value[1];
            for (let value of values) {
                if (value instanceof ArkInstanceFieldRef && value.getFieldSignature() === field.getSignature()) {
                    return true;
                }
            }
        }
        return false;
    }

    private isParentIsListComponent(viewNodes: Set<ViewTreeNode>): boolean {
        if (viewNodes.size === 0) {
            return false;
        }
        for (let treeNode of viewNodes) {
            let treeNodeParent = treeNode.parent;
            while (treeNodeParent) {
                if (listComponent.includes(treeNodeParent.name)) {
                    return true;
                }
                treeNodeParent = treeNodeParent.parent;
            }
        }
        return false;
    }

    private reportIssue(issueArkFile: ArkFile, lineNum: number, startColumn: number, endColumn: number): void {
        let filePath = issueArkFile.getFilePath();
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}