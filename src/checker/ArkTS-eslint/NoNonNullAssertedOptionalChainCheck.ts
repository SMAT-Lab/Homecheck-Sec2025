/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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
import {ArkFile, AstTreeUtils, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../BaseChecker';
import {Defects} from '../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../Index';
import {Rule} from '../../Index';
import {RuleListUtil} from '../../utils/common/DefectsList';
import {IssueReport} from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoNonNullAssertedOptionalChainCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-non-null-asserted-optional-chain.md',
    description: 'Disallow non-null assertions after an optional chain expression.'
};

type NodeMember = {
    node: ts.Node,
    count: number
};

export class NoNonNullAssertedOptionalChainCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject === undefined) {
            return;
        }

        this.loopNode(targetFile, sourceFile, sourceFileObject);
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isNonNullExpression(child)) {
                this.checkNonNullExpression(targetFile, sourceFile, child);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkNonNullExpression(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        if (children.length !== 2) {
            return;
        }
        const originFirstChild = children[0];
        const handleChild = this.removeParen(originFirstChild, 0);
        const firstChild = handleChild.node;
        let foundQuestionDotToken = false;
        for (const child of firstChild.getChildren()) {
            if (child.kind === ts.SyntaxKind.QuestionDotToken) {
                foundQuestionDotToken = true;
                break;
            }
            if (!ts.isPropertyAccessExpression(child)) {
                continue;
            }
            for (const chd of child.getChildren()) {
                if (chd.kind === ts.SyntaxKind.QuestionDotToken) {
                    foundQuestionDotToken = true;
                    break;
                }
            }
        }
        if (!foundQuestionDotToken) {
            return;
        }
        let reportIssue = false;
        const parentNode = aNode.parent;
        if (parentNode) {
            const nodeList = parentNode.getChildren();
            let currentIndex = nodeList.indexOf(aNode);
            if (currentIndex === -1) {
                currentIndex = this.handleCurrentIndex(nodeList, aNode, currentIndex);
            }
            if (currentIndex === -1) {
                return;
            }
            reportIssue = this.handleReportIssue(nodeList, currentIndex, reportIssue, originFirstChild);
        } else {
            reportIssue = true;
        }
        if (reportIssue) {
            const message = 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.';
            const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
            const startLine = startPosition.line + 1;
            const startCol = startPosition.character + 1 + handleChild.count;
            this.addIssueReport(targetFile, startLine, startCol, 0, message);
        }
    }

    private handleCurrentIndex(nodeList: ts.Node[], aNode: ts.Node, currentIndex: number): number {
        for (const node of nodeList) {
            let foundNode = false;
            for (const nodeElement of node.getChildren()) {
                if (nodeElement === aNode) {
                    foundNode = true;
                    break;
                }
            }
            if (foundNode) {
                currentIndex = nodeList.indexOf(node);
                break;
            }
        }
        return currentIndex;
    }

    private handleReportIssue(nodeList: ts.Node[], currentIndex: number, reportIssue: boolean, originFirstChild: ts.Node): boolean {
        const nextIndex = currentIndex + 1;
        if (nextIndex < nodeList.length) {
            const nextNode = nodeList[nextIndex];
            if (nextNode.kind === ts.SyntaxKind.CloseParenToken ||
                nextNode.kind === ts.SyntaxKind.SemicolonToken ||
                nextNode.kind === ts.SyntaxKind.TemplateTail) {
                reportIssue = true;
            } else { // 感叹号前必须是反圆括号
                const aNodeChildList = originFirstChild.getChildren();
                const last = aNodeChildList[aNodeChildList.length - 1];
                if (last.kind === ts.SyntaxKind.CloseParenToken) {
                    reportIssue = true;
                }
            }
        } else {
            reportIssue = true;
        }
        return reportIssue;
    }

    private removeParen(aNode: ts.Node, removeCount: number): NodeMember {
        const children = aNode.getChildren();
        if (children.length === 3) {
            if (children[0].kind === ts.SyntaxKind.OpenParenToken && children[children.length - 1].kind === ts.SyntaxKind.CloseParenToken) {
                removeCount++;
                return this.removeParen(children[1], removeCount);
            }
        }

        return {node: aNode, count: removeCount};
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}