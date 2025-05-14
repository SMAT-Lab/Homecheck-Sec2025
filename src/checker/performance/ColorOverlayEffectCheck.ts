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

import { ArkFile, ArkInstanceFieldRef, Constant, MethodSignature, Stmt, ViewTreeNode } from 'arkanalyzer/lib';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ColorOverlayEffectCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/color-overlay-effect-check.md',
    description: 'It is recommended that you use the API for color calculation.'
};

export class ColorOverlayEffectCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly gFilePath: string = '';
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
        let viewTreeRoot = target.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return;
        }
        this.traverseViewTree(viewTreeRoot, target);
    };

    private traverseViewTree(viewTreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        if (viewTreeRoot === undefined) {
            return;
        }
        if (viewTreeRoot.name === 'Stack') {
            this.stackOperation(viewTreeRoot, arkClass);
        }
        if (viewTreeRoot.children.length > 0) {
            for (let child of viewTreeRoot.children) {
                let classSignature = child.signature;
                if (classSignature && child.isCustomComponent()) {
                    continue;
                }
                this.traverseViewTree(child, arkClass);
            }
        }
    }

    private stackOperation(viewTreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        let children = viewTreeRoot.children;
        if (children.length < 2) {
            return;
        }
        for (let i = 0; i < children.length - 1; i++) {
            let childName = children[i].name;
            for (let j = i + 1; j < children.length; j++) {
                if (childName === children[j].name) {
                    this.childrenCheck(children[i], children[j], arkClass);
                }
            }
        }
    }

    private childrenCheck(child: ViewTreeNode, children: ViewTreeNode, arkClass: ArkClass): void {
        let childAttributes = child.attributes;
        let childrenAttributes = children.attributes;
        if (childAttributes.size !== childrenAttributes.size) {
            return;
        }
        let isChildHasColor = false;
        let isAttributeSame = true;
        for (let childAttribute of childAttributes) {
            let name = childAttribute[0];
            if (name === 'backgroundColor') {
                isChildHasColor = true;
            }
            if (name === 'create' || name === 'pop') {
                continue;
            }
            let childValues = childAttribute[1];
            if (!(childValues instanceof Array)) {
                continue;
            }
            let childStmt = childValues[0];
            let childOrgStmtStr = childStmt.getOriginalText();
            if (!childOrgStmtStr || childOrgStmtStr.length === 0) {
                continue;
            }
            let orgStr = this.getOrgStr(childOrgStmtStr, name);
            if (!this.attributeCheck(name, orgStr, childrenAttributes)) {
                isAttributeSame = false;
                break;
            }
        }
        if (isChildHasColor && isAttributeSame) {
            this.setReportIssue(arkClass, child);
            this.setReportIssue(arkClass, children);
        }
    }

    private getOrgStr(childOrgStmtStr: string | undefined, name: string): string | undefined {
        if (!childOrgStmtStr) {
            return undefined;
        }
        let attributeName = '.' + name;
        let originalTexts = childOrgStmtStr.split('\n');
        for (let originalText of originalTexts) {
            if (originalText.includes(attributeName)) {
                return originalText;
            }
        }
        return undefined;
    }

    private attributeCheck(name: string, childOrgStmtStr: string | undefined,
        childrenAttributes: Map<string, [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]]>): boolean {
        for (let childrenAttribute of childrenAttributes) {
            if (name !== childrenAttribute[0]) {
                continue;
            }
            if (name === 'backgroundColor') {
                return true;
            }
            let childrenValues = childrenAttribute[1];
            let childrenStmt = childrenValues[0];
            let method = childrenStmt.getCfg().getDeclaringMethod();
            if (!method) {
                continue;
            }
            let childrenOrgStmtStr = childrenStmt.getOriginalText();
            if (!childrenOrgStmtStr || childrenOrgStmtStr.length === 0) {
                continue;
            }
            let orgStr = this.getOrgStr(childrenOrgStmtStr, name);
            if (orgStr === childOrgStmtStr) {
                return true;
            }
        }
        return false;
    }

    private setReportIssue(arkClass: ArkClass, viewTreeRoot: ViewTreeNode): void {
        let arkFile = arkClass.getDeclaringArkFile();
        for (let [key, vals] of viewTreeRoot.attributes) {
            if (key !== 'create') {
                continue;
            }
            let stmt = vals[0];
            this.addIssueReport(arkFile, stmt, viewTreeRoot.name);
        }
    }

    private addIssueReport(arkFile: ArkFile, stmt: Stmt, keyword: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(arkFile, stmt, keyword);
        if (warnInfo) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(arkFile: ArkFile, stmt: Stmt, keyword: string): {
        lineNum: number;
        startCol: number;
        endCol: number;
        filePath: string;
    } | undefined {
        if (arkFile) {
            const originPosition = stmt.getOriginPositionInfo();
            const lineNum = originPosition.getLineNo();
            const text = stmt.getOriginalText();
            let startCol = -1;
            let endCol = -1;
            if (text && text?.length !== 0) {
                startCol = text.indexOf(keyword) + originPosition.getColNo();
                endCol = startCol + keyword.length - 1;
            }
            if (startCol === -1) {
                return undefined;
            }
            const originPath = arkFile.getFilePath();
            return { lineNum, startCol, endCol, filePath: originPath };
        } else {
            logger.debug('ArkFile is null.');
        }
        return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}