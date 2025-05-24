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
import { RuleFix } from '../../model/Fix';

interface Issue {
    line: number;
    column: number;
    columnEnd: number;
    message: string;
    filePath: string,
    fixCode: string;
}

export class NoExtraSemiCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-extra-semi.md',
        description: 'Disallow unnecessary semicolons.'
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };
    public static readonly allowedParentTypes: ts.SyntaxKind[] = [
        ts.SyntaxKind.ForStatement,
        ts.SyntaxKind.ForInStatement,
        ts.SyntaxKind.ForOfStatement,
        ts.SyntaxKind.WhileStatement,
        ts.SyntaxKind.DoStatement,
        ts.SyntaxKind.IfStatement,
        ts.SyntaxKind.LabeledStatement,
        ts.SyntaxKind.WithStatement,
    ];
    private methodAst: ts.SourceFile;
    private arkFile: ArkFile;
    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    };
    public check = (target: ArkFile) => {
        if (target instanceof ArkFile) {
            this.checkNoExtraSemi(target);
        }
    };

    private checkNoExtraSemi(arkFile: ArkFile): void {
        this.methodAst = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        this.arkFile = arkFile;
        // 从根节点开始遍历
        this.checkNode(this.methodAst);
    };

    private checkNode = (node: ts.Node): void => {
        // 检查空语句
        if (node.kind === ts.SyntaxKind.EmptyStatement) {
            const parent = node.parent;
            if (!NoExtraSemiCheck.allowedParentTypes.includes(parent.kind)) {
                const start = node.getStart(this.methodAst);
                const { line, character } = this.methodAst.getLineAndCharacterOfPosition(start);
                // 保存修复内容到 Issue 对象
                const resultIssue: Issue = {
                    line: line + 1,
                    column: character + 1,
                    columnEnd: character + 2,
                    message: 'Unnecessary semicolon.',
                    filePath: this.arkFile.getFilePath() ?? '',
                    fixCode: ''
                };
                const ruleFix = this.createFix(start, start + 1, resultIssue.fixCode);
                this.addIssueReport(resultIssue, ruleFix);
            };
        };
        // 检查类声明
        if (ts.isClassDeclaration(node)) {
            this.checkClassDeclaration(node as ts.ClassDeclaration, this.methodAst, this.arkFile);
        };
        ts.forEachChild(node, this.checkNode);
    };

    private checkClassDeclaration(node: ts.ClassDeclaration, methodAst: ts.SourceFile, arkFile: ArkFile): void {
        // 遍历类的成员
        for (const member of node.members) {
            this.checkMember(member, methodAst, arkFile);
        };
    };

    private checkMember(member: ts.ClassElement, methodAst: ts.SourceFile, arkFile: ArkFile): void {
        // 检查分号
        if (member.kind === ts.SyntaxKind.SemicolonClassElement) {
            const lastChild = member.getChildAt(member.getChildCount() - 1);
            if (lastChild && lastChild?.kind === ts.SyntaxKind.SemicolonToken) {
                const start = lastChild.getStart(methodAst);
                const { line, character } = methodAst.getLineAndCharacterOfPosition(start);
                const resultIssue: Issue = {
                    line: line + 1,
                    column: character + 1,
                    columnEnd: character + 2,
                    message: 'Unnecessary semicolon.',
                    filePath: arkFile.getFilePath() ?? '',
                    fixCode: ''
                };
                const ruleFix = this.createFix(start, start + 1, resultIssue.fixCode);
                this.addIssueReport(resultIssue, ruleFix);
            }
        }
    };

    private createFix(start: number, end: number, code: string): RuleFix {
        return { range: [start, end], text: code };
    };

    private addIssueReport(issue: Issue, ruleFix?: RuleFix): void {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defects = new Defects(issue.line, issue.column, issue.columnEnd, this.metaData.description, severity, this.rule.ruleId, issue.filePath,
            this.metaData.ruleDocPath, true, false, (ruleFix != undefined ? true : false));
        this.issues.push(new IssueReport(defects, ruleFix));
        RuleListUtil.push(defects);
    };
}
