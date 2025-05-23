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

import { ArkFile, Stmt, ViewTreeNode } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkClass, ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'EffectkitBlurCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/effectkit-blur-check.md',
    description: 'We recommend that you use effectKit.createEffect to achieve the blur effect.'
};
const blurStr = 'blur';
const imageStr = 'Image';
const backdropBlurStr = 'backdropBlur';
const viewTreeTool = new ViewTreeTool();

export class EffectkitBlurCheck implements BaseChecker {
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
        };
        return [matchClassCb];
    }

    public check = (targetCla: ArkClass): void => {
        if (!targetCla.hasViewTree() || viewTreeTool.hasTraverse(targetCla)) {
            return;
        }
        let rootTreeNode = targetCla.getViewTree()?.getRoot();
        if (!rootTreeNode) {
            return;
        }
        this.traverseViewTree(rootTreeNode, targetCla);
    };

    public traverseViewTree(viewTreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        if (viewTreeRoot === null) {
            return;
        }
        for (let [key, vals] of viewTreeRoot.attributes) {
            if (key === blurStr && viewTreeRoot.name === imageStr) {
                this.reportIssue(arkClass.getDeclaringArkFile(), vals[0], key);
            } else if (key === backdropBlurStr) {
                this.reportIssue(arkClass.getDeclaringArkFile(), vals[0], key);
            }
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

    public reportIssue(arkFile: ArkFile, stmt: Stmt, keyword: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        if (!stmt) {
            return;
        }
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNo = originalPosition.getLineNo();
        const orgStmtStr = stmt.getOriginalText();
        let startColumn = -1;
        let endColunm = -1;
        if (!orgStmtStr || orgStmtStr.length === 0) {
            return;
        }
        let originalTexts = orgStmtStr.split('\n');
        let lineCount = -1;
        for (let [index, originalText] of originalTexts.entries()) {
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
        endColunm = startColumn + keyword.length - 1;
        if (startColumn === -1) {
            return;
        }
        let lineNum = lineNo + lineCount;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}