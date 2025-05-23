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

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoRequireImportsCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-require-imports.md',
    description: 'A `require()` style import is forbidden.'
};

export class NoRequireImportsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    private allowDestructuring = true;
    private allowedNames: string[] = [];
    public issues: IssueReport[] = [];
    private requireDefined = false; // require 是否是自定义方法

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
        this.requireDefined = false;

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
            if (ts.isVariableDeclaration(child)) {
                this.checkVariableDeclaration(targetFile, sourceFile, child);
            } else if (ts.isCallExpression(child)) {
                this.checkCallExpression(targetFile, sourceFile, child);
            } else if (ts.isExternalModuleReference(child)) {
                this.checkExternalModuleReference(targetFile, sourceFile, child);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    // 检查require是否是自定义函数
    private checkVariableDeclaration(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        if (this.requireDefined) {
            return;
        }

        const children = aNode.getChildren();
        if (children.length !== 3) {
            return;
        }

        const firstNode = children[0];
        const secondNode = children[1];
        if (firstNode.kind === ts.SyntaxKind.Identifier &&
            firstNode.getText() === 'require' &&
            secondNode.kind === ts.SyntaxKind.EqualsToken)
        {
            this.requireDefined = true;
        }
    }

    private checkCallExpression(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        if (children.length === 0) {
            return;
        }

        const firstNode = children[0];
        if (!ts.isIdentifier(firstNode)) {
            return;
        }

        const name = firstNode.getText();
        if (name !== 'require') {
            return;
        }

        this.reportIssue(targetFile, sourceFile, aNode);
    }

    private checkExternalModuleReference(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        if (children.length === 0) {
            return;
        }

        const firstNode = children[0];
        if (firstNode.kind !== ts.SyntaxKind.RequireKeyword) {
            return;
        }

        this.reportIssue(targetFile, sourceFile, aNode);
    }

    private reportIssue(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const parent = aNode.parent;
        if (!ts.isImportEqualsDeclaration(parent) && this.requireDefined) {
            return;
        }

        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
        const startLine = startPosition.line + 1;
        const startCol = startPosition.character + 1;
        this.addIssueReport(targetFile, startLine, startCol, 0, gMetaData.description);
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