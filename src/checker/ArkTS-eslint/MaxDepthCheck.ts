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
    maximum?: number;
    max?: number;
}];

const DEFAULT_MAX_DEPTH = 4;

interface Issue {
    line: number;
    column: number;
    columnEnd: number;
    message: string;
    filePath: string;
};

export class MaxDepthCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/max-depth-check.md',
        description: `Maximum allowed nesting depth is ${DEFAULT_MAX_DEPTH}`
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private defaultOptions: Options = [{ 'max': DEFAULT_MAX_DEPTH, 'maximum': DEFAULT_MAX_DEPTH }];
    private fileMatcher: FileMatcher = { matcherType: MatcherTypes.FILE };
    private functionStack: number[] = []; // 二维数组支持多函数嵌套
    private maxDepth: number = DEFAULT_MAX_DEPTH;
    private arkFile: ArkFile;

    public registerMatchers(): MatcherCallback[] {
        return [{ matcher: this.fileMatcher, callback: this.check }];
    };

    public check = (target: ArkFile): void => {
        this.initializeOptions();
        if (target instanceof ArkFile) {
            this.arkFile = target;
            this.checkDepth(target);
        }
    };

    private initializeOptions(): void {
        let option = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
        if (typeof option === 'number') {
            this.maxDepth = option;
        } else {
            const options = option as Options;
            this.maxDepth = options[0].maximum ?? options[0].max ?? DEFAULT_MAX_DEPTH;
        };
    };

    private checkDepth(arkFile: ArkFile): void {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        this.functionStack = [];
        // AST深度优先遍历
        const visitNode = (node: ts.Node): void => {
            this.handleNodeEntry(node);
            ts.forEachChild(node, visitNode);
            this.handleNodeExit(node);
        };
        visitNode(sourceFile);
    };

    // 进入节点处理
    private handleNodeEntry(node: ts.Node): void {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.SourceFile:
            case ts.SyntaxKind.ClassStaticBlockDeclaration:
                this.functionStack.push(0);
                break;
            case ts.SyntaxKind.IfStatement:
                if (!this.isElseIfClause(node as ts.IfStatement)) {
                    this.incrementDepth(node);
                }
                break;
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.SwitchStatement:
            case ts.SyntaxKind.TryStatement:
            case ts.SyntaxKind.WithStatement:
                this.incrementDepth(node);
                break;
        };
    };

    // 退出节点处理
    private handleNodeExit(node: ts.Node): void {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.SourceFile:
            case ts.SyntaxKind.ClassStaticBlockDeclaration:
                this.functionStack.pop();
                break;
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.SwitchStatement:
            case ts.SyntaxKind.TryStatement:
            case ts.SyntaxKind.WithStatement:
                if (this.functionStack.length > 0) {
                    this.functionStack[this.functionStack.length - 1]--;
                };
                break;
        };
    };

    // 检查是否是else if结构
    private isElseIfClause(node: ts.IfStatement): boolean {
        return ts.isIfStatement(node.parent) && node.parent.elseStatement === node;
    };

    // 增加当前嵌套深度并检查
    private incrementDepth(node: ts.Node): void {
        if (this.functionStack.length === 0) {
            return;
        };
        const currentDepth = ++this.functionStack[this.functionStack.length - 1];
        if (currentDepth > this.maxDepth) {
            this.reportIssue(node, currentDepth);
        };
    };

    // 生成错误报告
    private reportIssue(node: ts.Node, depth: number): void {
        const filePath = this.arkFile.getFilePath() ?? '';
        const sourceFile = node.getSourceFile();
        const start = node.getStart(sourceFile);
        const { line, character: col } = ts.getLineAndCharacterOfPosition(sourceFile, start);
        const end = node.getEnd();
        const { character: endCol } = ts.getLineAndCharacterOfPosition(sourceFile, end);
        const issue: Issue = {
            line: line + 1,
            column: col + 1,
            columnEnd: endCol + 1,
            message: `Blocks are nested too deeply (${depth}). Maximum allowed is ${this.maxDepth}`,
            filePath: filePath
        };
        this.addIssueReport(issue);
    };

    private addIssueReport(issue: Issue): void {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defects = new Defects(
            issue.line,
            issue.column,
            issue.columnEnd,
            this.metaData.description,
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