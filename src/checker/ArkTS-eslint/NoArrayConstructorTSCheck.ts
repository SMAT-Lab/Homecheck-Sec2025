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
}
export class NoArrayConstructorTSCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-array-constructor-ts.md',
        description: 'The array literal notation [] is preferable.'
    };
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public rule: Rule;
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };
    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    };
    public check = (target: ArkFile) => {
        if (target instanceof ArkFile) {
            this.checkArray(target);
        }
    };

    private checkArray(arkFile: ArkFile): void {
        const methodAst = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const visitNode = (node: ts.Node) => {
            if (ts.isArrowFunction(node) || ts.isFunctionDeclaration(node)) {
                const hasArrayParam = node.parameters.some(param => {
                    return ts.isIdentifier(param.name) && param.name.text === 'Array';
                });
                if (hasArrayParam) { 
                    return; 
                };
            }
            if (ts.isNewExpression(node) || ts.isCallExpression(node)) {
                this.checkNewAndCallExpression(node, methodAst, arkFile);
            };
            ts.forEachChild(node, visitNode);
        };
        ts.forEachChild(methodAst, visitNode);
    };

    private checkNewAndCallExpression(node: ts.NewExpression | ts.CallExpression, methodAst: ts.SourceFile, arkFile: ArkFile): void {
        const callee = node.expression;
        // 跳过 new Array<Foo>() 或 Array<Foo>()
        if (
            (ts.isNewExpression(node) || ts.isCallExpression(node)) &&
            node.typeArguments && // 检测泛型参数
            ts.isIdentifier(callee) &&
            callee.text === 'Array'
        ) {
            return;
        };
        if (
            ts.isCallExpression(node) &&
            node.questionDotToken &&
            (ts.isIdentifier(callee) || ts.isPropertyAccessExpression(callee))
        ) {
            if (node.arguments.length > 1) {
                return;
            };
        };
        if (ts.isParenthesizedExpression(callee)) {
            const innerExpression = callee.expression;
            if (ts.isIdentifier(innerExpression) && innerExpression.text === 'Array') {
                this.createIssue(node, methodAst, arkFile, true);
            };
        } else if (ts.isIdentifier(callee) && callee.text === 'Array') {
            this.checkGlobalArray(node, methodAst, arkFile);
        };
    };

    private checkGlobalArray(node: ts.NewExpression | ts.CallExpression, methodAst: ts.SourceFile, arkFile: ArkFile): void {
        const callee = node.expression;
        const isGlobalArray = !this.isInLocalScope(callee);
        if (isGlobalArray) {
            if (!node.arguments || node.arguments.length === 0) {
                if (ts.isArrowFunction(node) || ts.isFunctionDeclaration(node)) {
                    return;
                };
                this.createIssue(node, methodAst, arkFile);
            } else if (node.arguments.length === 1) {
                const arg = node.arguments[0]; // Array(x) 或 new Array(x)，单个参数
                if ((ts.isSpreadElement(arg) && arg.getText().includes('...'))) {// 参数不是数字字面量，触发规则
                    this.createIssue(node, methodAst, arkFile);
                };
            } else {
                this.createIssue(node, methodAst, arkFile);
            }
        };
    };

    private createIssue(node: ts.CallExpression | ts.NewExpression, methodAst: ts.SourceFile, arkFile: ArkFile, fix: boolean = true): void {
        const start = node.getStart(methodAst);
        const { line, character } = methodAst.getLineAndCharacterOfPosition(start);
        const argsText = node.arguments?.map(arg => arg.getText()).join(', ') || '';
        const fixText = argsText ? `[${argsText}]` : '[]';
        const resultIssue: Issue = {
            line: line + 1,
            column: character + 1,
            columnEnd: character + 1,
            message: this.metaData.description,
            filePath: arkFile.getFilePath() ?? ''
        };
        let ruleFix;
        if (fix) {
            ruleFix = this.createFix(start, node.getEnd(), fixText);
        };
        this.addIssueReport(resultIssue, ruleFix);
    };

    private isInLocalScope(node: ts.Node): boolean {
        let current = node.parent;
        while (current) {
            if (ts.isNewExpression(current)) {
                if (current.expression.getText() === 'Array' && current.arguments === undefined) {
                    return false;
                };
            };
            if (ts.isVariableDeclaration(current) && current.name === node) {
                return true;
            }
            if (ts.isFunctionDeclaration(current) || ts.isModuleDeclaration(current)) {
                break;
            }
            current = current.parent;
        };
        return false;
    };

    private createFix(start: number, end: number, code: string): RuleFix {
        return { range: [start, end], text: code };
    };

    private addIssueReport(issue: Issue, ruleFix?: RuleFix) {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defects = new Defects(issue.line, issue.column, issue.columnEnd, this.metaData.description, severity, this.rule.ruleId, issue.filePath,
            this.metaData.ruleDocPath, true, false, (ruleFix !== undefined ? true : false));
        this.issues.push(new IssueReport(defects, ruleFix));
        RuleListUtil.push(defects);
    };
}