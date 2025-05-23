/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { MatcherCallback, MatcherTypes, FileMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

type Options = [{
    max: number;
    ignoreExpressions: boolean;
}];

interface Issue {
    line: number;
    column: number;
    columnEnd: number;
    message: string;
    filePath: string;
};

const MAX_DEPTH = 1;

export class MaxClassesPerFileCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/max-classes-per-file.md',
        description: 'Enforce a maximum number of classes per file'
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private defaultOptions: Options = [{ 'max': MAX_DEPTH, 'ignoreExpressions': false }];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    public registerMatchers(): MatcherCallback[] {
        return [{
            matcher: this.fileMatcher,
            callback: this.check,
        }];
    };

    public check = (target: ArkFile) => {
        this.parseOptions();
        if (target instanceof ArkFile) {
            this.validateClassCount(target);
        };
    };

    private parseOptions(): void {
        this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
    };

    private validateClassCount(arkFile: ArkFile): void {
        const ast = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const { max, ignoreExpressions } = this.defaultOptions[0];
        let classCount = 0;
        const checkNode = (node: ts.Node): void => {
            if (ts.isClassDeclaration(node)) {
                classCount++;
            } else if (!ignoreExpressions && ts.isClassExpression(node)) {
                classCount++;
            }
            ts.forEachChild(node, checkNode);
        };
        checkNode(ast);
        if (classCount > max) {
            this.createFileIssue(arkFile, classCount, max, ast);
        };
    };

    private getFirstCodePosition(sourceFile: ts.SourceFile): number {
        // 查找第一个实际代码节点（忽略import/注释）
        let firstPos = sourceFile.getStart();
        const visit = (node: ts.Node): void => {
            if (
                !ts.isImportDeclaration(node) && 
                !ts.isDecorator(node) &&
                node.getStart() < firstPos
            ) {
                firstPos = node.getStart();
            };
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(sourceFile, visit);
        return firstPos;
    };

    private createFileIssue(arkFile: ArkFile, count: number, max: number, ast: ts.SourceFile): void {
        const firstCodePos = this.getFirstCodePosition(ast);
        const { line, character } = ast.getLineAndCharacterOfPosition(firstCodePos);
        const issue: Issue = {
            line: line + 1,
            column: character + 1,
            columnEnd: character + 1,
            message: `File has too many classes (${count}). Maximum allowed is ${max}`,
            filePath: arkFile.getFilePath() ?? ''
        };
        this.addIssueReport(issue);
    };

    private addIssueReport(issue: Issue): void {
        const severity = this.rule?.alert ?? this.metaData.severity;
        const defects = new Defects(
            issue.line,
            issue.column,
            issue.columnEnd,
            issue.message,
            severity,
            this.rule.ruleId,
            issue.filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            false
        );
        this.issues.push(new IssueReport(defects, undefined));
        RuleListUtil.push(defects);
    };
}