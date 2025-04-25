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

import { ArkAssignStmt, ArkField, ArkFile, ArkInstanceFieldRef, ArkStaticInvokeExpr, ClassSignature, Constant, Local, Stmt, StringType, ViewTreeNode } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'WebResourceForImageComponentCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/web-resource-for-image-component-check.md',
    description: 'Avoid online images. Use local images whenever possible.'
};
const viewTreeTool = new ViewTreeTool();

export class WebResourceForImageComponentCheck implements BaseChecker {
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

    public check = (arkClass: ArkClass): void => {
        if (arkClass.hasViewTree() && !viewTreeTool.hasTraverse(arkClass)) {
            let rootTreeNode = arkClass.getViewTree()?.getRoot();
            if (!rootTreeNode) {
                return;
            }
            this.traverseViewTree(arkClass.getDeclaringArkFile(), rootTreeNode);
        }
    };

    private traverseViewTree(arkFile: ArkFile, treeNode: ViewTreeNode): void {
        if (treeNode === undefined || treeNode === null) {
            return;
        }
        if (treeNode.children.length === 0) {
            return;
        }
        for (let children of treeNode.children) {
            if (children.isCustomComponent()) {
                continue;
            }
            // 容器组件则继续遍历
            if (children.children.length !== 0) {
                this.traverseViewTree(arkFile, children);
            }
            // 如果是Image组件，则检测其资源类型
            if (children.name !== 'Image') {
                continue;
            }
            let stmts = children.attributes;
            let createStmt = stmts.get('create');
            if (!createStmt) {
                continue;
            }
            let stmt = createStmt[0];
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            this.checkImageUri(arkFile, stmt);
        }
    }

    private checkImageUri(arkFile: ArkFile, stmt: ArkAssignStmt): void {
        let rightOp = stmt.getRightOp();
        if (!(rightOp instanceof ArkStaticInvokeExpr)) {
            return;
        }
        let arg = rightOp.getArg(0);
        // Image组件Uri信息为字符串，则arg为Constant
        if (arg instanceof Constant) {
            let uri = arg.getValue();
            let uriLowerCase = uri.toLowerCase();
            if (uriLowerCase.includes('http:') || uriLowerCase.includes('https:') || uriLowerCase.includes('ftp:')) {
                this.reportIssue(arkFile, stmt, uri);
            }
        } else if (arg instanceof Local) {
            if (!(arg.getType() instanceof StringType)) {
                return;
            }
            // 只检测string类型
            let declaringStmt = arg.getDeclaringStmt();
            if (!declaringStmt || !(declaringStmt instanceof ArkAssignStmt)) {
                return;
            }
            let rightOp = declaringStmt.getRightOp();
            if (!(rightOp instanceof ArkInstanceFieldRef)) {
                return;
            }
            let baseName = rightOp.getBase().getName();
            if (baseName !== 'this') {
                return;
            }
            let baseSigNature = rightOp.getFieldSignature().getDeclaringSignature();
            if (!(baseSigNature instanceof ClassSignature)) {
                return;
            }
            let className = baseSigNature.getClassName();
            let arkClass = arkFile.getClassWithName(className);
            if (!arkClass) {
                return;
            }
            let fieldName = rightOp.getFieldName();
            let arkField = arkClass.getFieldWithName(fieldName);
            if (!arkField) {
                return;
            }
            this.checkImageInArkField(arkFile, arkField);
        }
    }

    private checkImageInArkField(arkFile: ArkFile, arkField: ArkField): void {
        let stmts = arkField.getInitializer();
        if (stmts.length === 0) {
            return;
        }
        let stmt = stmts[0];
        if (!(stmt instanceof ArkAssignStmt)) {
            return;
        }
        let initValue = stmt.getRightOp();
        if (!(initValue instanceof Constant)) {
            return;
        }
        let uri = initValue.getValue();
        let uriLowerCase = uri.toLowerCase();
        if (uriLowerCase.includes('http:') || uriLowerCase.includes('https:') || uriLowerCase.includes('ftp:')) {
            this.reportIssue(arkFile, arkField, uri);
        }
    }

    public reportIssue(arkFile: ArkFile, stmtLike: Stmt | ArkField, uri: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        let lineNum = -1;
        let startColumn = -1;
        let endColunm = -1;
        if (stmtLike instanceof ArkField) {
            let lineCode = stmtLike.getCode();
            lineNum = stmtLike.getOriginPosition().getLineNo();
            startColumn = stmtLike.getOriginPosition().getColNo() + lineCode.indexOf(uri);
            endColunm = startColumn + uri.length - 1;
        } else if (stmtLike instanceof Stmt) {
            const text = stmtLike.getOriginalText();
            if (!text || text.length === 0) {
                return;
            }
            let originalPosition = stmtLike.getOriginPositionInfo();
            lineNum = originalPosition.getLineNo();
            startColumn = originalPosition.getColNo() + text.indexOf(uri);
            endColunm = startColumn + uri.length - 1;
        }
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}