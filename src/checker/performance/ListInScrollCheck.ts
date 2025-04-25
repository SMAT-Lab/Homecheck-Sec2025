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

import { ArkClass, ClassCategory } from "arkanalyzer/lib/core/model/ArkClass";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { ViewTreeNode, Stmt } from "arkanalyzer";
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from "../../Index";
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from "../../model/Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ListInScrollCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: "docs/list-in-scroll-check.md",
    description: "List needs to set the width and height in Scroll."
};
const viewTreeTool = new ViewTreeTool();

export class ListInScrollCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        category: [ClassCategory.STRUCT]
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClassCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        }
        return [matchClassCb];
    }

    public check = (targetCla: ArkClass) => {
        if (!targetCla.hasViewTree() || viewTreeTool.hasTraverse(targetCla)) {
            return;
        }
        let rootTreeNode = targetCla.getViewTree()?.getRoot();
        if (!rootTreeNode) {
            return;
        }
        this.recursionCheck(rootTreeNode, 0);
    }

    private recursionCheck(viewTreeRoot: ViewTreeNode, count: number) {
        if (viewTreeRoot === undefined || viewTreeTool.hasTraverse(viewTreeRoot)) {
            return;
        }
        let name = viewTreeRoot.name;
        if (name === 'Scroll') {
            count++;
        }
        if (name === 'List' && !this.hasWidthAndHeight(viewTreeRoot) && count > 0) {
            for (let [key, value] of viewTreeRoot.attributes.entries()) {
                if (key !== 'create') {
                    continue;
                }
                this.reportIssue(value[0]);
            }
        }
        for (let child of viewTreeRoot.children) {
            this.recursionCheck(child, count);
        }
        if (name === 'Scroll') {
            count--;
        }
    }

    private hasWidthAndHeight(viewTreeRoot: ViewTreeNode): boolean {
        let hasWidth = false;
        let hasHeight = false;
        for (let name of viewTreeRoot.attributes.keys()) {
            if (name === 'width') {
                hasWidth = true;
            }
            if (name === 'height') {
                hasHeight = true;
            }
        }
        return hasWidth && hasHeight;
    }

    private reportIssue(stmt: Stmt) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const arkFile = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile();
        if (!arkFile) {
            return;
        }
        const filePath = arkFile.getFilePath();
        const originPosition = stmt.getOriginPositionInfo();
        const lineNum = originPosition.getLineNo();
        const originText = stmt.getOriginalText();
        if (!originText || originText.length === 0) {
            return;
        }
        const key = 'List';
        const startColumn = originPosition.getColNo() + originText.indexOf(key);
        const endColunm = startColumn + key.length - 1;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}