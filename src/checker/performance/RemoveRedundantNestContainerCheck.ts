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

import { ArkClass, Stmt, ViewTreeNode } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ClassMatcher, Defects, MatcherCallback, MatcherTypes, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from '../../model/Defects';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'RemoveRedundantNestContainerCheck');
const viewTreeTool = new ViewTreeTool();
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/remove-redundant-nest-container-check.md',
    description: 'Found view nesting too deep.'
};

export class RemoveRedundantNestContainerCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
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
        let viewRoot = target.getViewTree()?.getRoot();
        if (!viewRoot) {
            return;
        }
        let depth = this.getViewTreeDepth(viewRoot);
        if (depth <= 30) {
            return;
        }
        let stmts = viewRoot.attributes.get('create');
        if (!stmts) {
            return;
        }
        let stmt = stmts[0];
        this.reportIssue(target, viewRoot, stmt);
    };

    private getViewTreeDepth(treeNode: ViewTreeNode): number {
        if (treeNode === undefined) {
            return 0;
        }
        if (!treeNode.children || treeNode.children.length === 0) {
            return 1;
        }
        if (viewTreeTool.hasTraverse(treeNode)) {
            return 1;
        }
        let depth = 1;
        for (let childNode of treeNode.children) {
            depth = Math.max(depth, (this.getViewTreeDepth(childNode) + 1));
            if (depth > 31) {
                break;
            }
        }
        return depth;
    }

    private reportIssue(target: ArkClass, viewRoot: ViewTreeNode, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.debug('Stmt text is empty.');
            return;
        }
        const index = text.indexOf(viewRoot.name);
        if (index === -1) {
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        const originalPosition = stmt.getOriginPositionInfo();
        const lineNum = originalPosition.getLineNo();
        const startColum = originalPosition.getColNo() + index;
        const endColum = startColum + viewRoot.name.length - 1;
        const filePath = target.getDeclaringArkFile().getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}