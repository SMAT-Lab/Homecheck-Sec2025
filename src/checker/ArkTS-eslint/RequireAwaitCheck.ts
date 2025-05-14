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

import { ts, ArkFile, } from "arkanalyzer/lib";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects, IssueReport } from "../../model/Defects";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { AstTreeUtils } from "arkanalyzer";

const gmetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/require-await.md",
    description: "Disallow async functions which have no `await` expression."
};

interface ScopeInfo {
    upper: ScopeInfo | null;
    hasAwait: boolean;
    hasAsync: boolean;
    isGen: boolean;
    isAsyncYield: boolean;
};

export class RequireAwaitCheck implements BaseChecker {
    private symbolTable: Map<string, ts.Node> = new Map();
    readonly metaData: BaseMetaData = gmetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check.bind(this)
        };
        return [matchFileCb];
    };

    public check = (arkFile: ArkFile) => {
        const filePath = arkFile.getFilePath();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        // 构建符号表
        this.buildSymbolTable(sourceFile);
        this.checkNode(sourceFile, filePath, arkFile);
    };

    private checkNode(node: ts.Node, filePath: string, arkFile: ArkFile): void {
        // 检查当前节点是否为异步函数
        if (this.isAsyncFunction(node)) {
            this.processAsyncFunction(node, filePath, arkFile);
        };
        ts.forEachChild(node, child => this.checkNode(child, filePath, arkFile));
    };

    /**
     * 处理异步函数
     */
    private processAsyncFunction(node: ts.Node, filePath: string, arkFile: ArkFile): void {
        const scopeInfo = {
            upper: null,
            hasAwait: false,
            hasAsync: true,
            isGen: this.isGeneratorFunction(node),
            isAsyncYield: false
        };
        // 检查是否需要报告缺少await的问题
        if (this.shouldReportMissingAwait(node, scopeInfo, arkFile)) {
            this.reportDefect(filePath, node);
        };
    };

    /**
     * 检查是否应该报告缺少await的问题
     */
    private shouldReportMissingAwait(node: ts.Node, scopeInfo: ScopeInfo, arkFile: ArkFile): boolean {
        const returnsPromise = this.checkFunctionReturnsPromise(node, arkFile);
        if (returnsPromise) {
            return false;
        };
        const hasAwait = this.hasAwaitExpression(node);
        if (hasAwait) {
            return false;
        };
        if (this.isEmptyFunction(node)) {
            return false;
        };
        if (scopeInfo.isGen && scopeInfo.isAsyncYield) {
            return false;
        };
        // 处理异步生成器特殊情况
        if (scopeInfo.isGen && this.isAsyncFunction(node)) {
            if (this.hasSpecialYieldExpressions(node, arkFile)) {
                return false;
            };
        };
        return true;
    };

    /**
     * 检查异步生成器函数中是否有特殊的yield表达式
     * 包括：yield* source, yield Promise, yield asyncFunction
     */
    private hasSpecialYieldExpressions(node: ts.Node, arkFile: ArkFile): boolean {
        const body = this.getFunctionBody(node);
        if (!body || !ts.isBlock(body)) {
            return false;
        }
        for (const statement of body.statements) {
            if (ts.isExpressionStatement(statement)) {
                const expression = statement.expression;
                if (this.hasYieldPromise(expression, arkFile)) {
                    return true;
                };
                if (this.hasYieldStarSource(expression, node, arkFile)) {
                    return true;
                };
            };
        };
        return false;
    };

    private hasYieldPromise(expression: ts.Expression, arkFile: ArkFile): boolean {
        if (ts.isYieldExpression(expression) && expression.expression) {
            const yieldExpr = expression.expression;
            if (this.isPromiseExpression(yieldExpr)) {
                return true;
            };
            if (ts.isCallExpression(yieldExpr)) {
                return this.isPromiseCall(yieldExpr, arkFile);
            };
        };
        return false;
    };

    private hasYieldStarSource(expression: ts.Expression, node: ts.Node, arkFile: ArkFile): boolean {
        if (ts.isYieldExpression(expression) && expression.asteriskToken) {
            const source = expression.expression;
            if (source) {
                if (this.isPromiseExpression(source)) {
                    return true;
                };
                if (ts.isCallExpression(source)) {
                    return this.isPromiseCall(source, arkFile);
                };
                if (ts.isIdentifier(source)) {
                    return this.isValidSourceIdentifier(source, node);
                };
            };
        };
        return false;
    };

    private isPromiseCall(callExpr: ts.CallExpression, arkFile: ArkFile): boolean {
        const funcName = callExpr.expression.getText();
        const definition = this.symbolTable.get(funcName);
        if (definition) {
            if (ts.isVariableDeclaration(definition)) {
                if (this.hasPromiseInVarDecl(definition, arkFile)) {
                    return true;
                };
            };
            if (this.isAsyncFunction(definition) || this.returnsPromiseType(definition)) {
                return true;
            };
        };
        return false;
    };

    private hasPromiseInVarDecl(definition: ts.VariableDeclaration, arkFile: ArkFile): boolean {
        if (definition.initializer) {
            const funcBody = this.getFunctionBody(definition.initializer);
            if (funcBody && ts.isBlock(funcBody)) {
                return this.containsExplicitPromiseReturn(funcBody, arkFile);
            };
        } else if (definition.type) {
            const typeText = definition.type.getText();
            return typeText.includes('Promise') || typeText.includes('Thenable');
        };
        return false;
    };

    private isValidSourceIdentifier(source: ts.Identifier, node: ts.Node): boolean {
        const param = this.findParameter(node, source.text);
        if (param && (this.isAsyncIterableParameter(param) || this.isCustomTypeParameter(param))) {
            return true;
        };
        const varDecl = this.symbolTable.get(source.text);
        if (varDecl && ts.isVariableDeclaration(varDecl) && varDecl.type) {
            const typeText = varDecl.type.getText();
            return typeText.includes('Omit') && typeText.includes('Symbol.asyncIterator');
        };
        return false;
    };

    /**
     * 检查参数是否为自定义类型
     */
    private isCustomTypeParameter(param: ts.ParameterDeclaration): boolean {
        if (!param.type) {
            return false;
        };
        const typeText = param.type.getText();
        return !typeText.includes('AsyncIterable') && !typeText.includes('Promise');
    };

    /**
     * 查找函数参数
     */
    private findParameter(node: ts.Node, paramName: string): ts.ParameterDeclaration | undefined {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
            return node.parameters.find(param =>
                ts.isIdentifier(param.name) && param.name.text === paramName
            );
        };
        return undefined;
    };

    /**
     * 检查参数类型是否为AsyncIterable
     */
    private isAsyncIterableParameter(param: ts.ParameterDeclaration): boolean {
        if (!param.type) {
            return false;
        };
        const typeText = param.type.getText();
        return typeText.includes('AsyncIterable');
    };

    /**
     * 检查是否为异步函数
     */
    private isAsyncFunction(node: ts.Node): boolean {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
            return node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
        };
        return false;
    };

    /**
     * 检查是否为生成器函数
     */
    private isGeneratorFunction(node: ts.Node): boolean {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
            ts.isMethodDeclaration(node)) {
            return node.asteriskToken !== undefined;
        };
        return false;
    };

    private getFunctionBody(node: ts.Node): ts.Node | undefined {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
            ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
            return node.body;
        };
        return undefined;
    };

    private isEmptyFunction(node: ts.Node): boolean {
        const body = this.getFunctionBody(node);
        if (body && ts.isBlock(body)) {
            return body.statements.length === 0;
        };
        return false;
    };

    /**
     * 检查函数体中是否包含await表达式
     */
    private hasAwaitExpression(node: ts.Node): boolean {
        const body = this.getFunctionBody(node);
        if (!body) {
            return true; // 如果没有函数体，不需要await
        };
        return this.containsAwait(body);
    };

    /**
     * 检查表达式是否是Promise相关表达式
     */
    private isPromiseExpression(node: ts.Node): boolean {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const objName = node.expression.expression.getText();
            return objName === 'Promise';
        };
        if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
            return node.expression.text === 'Promise';
        };
        const nodeText = node.getText();
        return nodeText.includes('Promise');
    };

    /**
     * 检查函数返回类型是否为Promise
     */
    private returnsPromiseType(node: ts.Node): boolean {
        const isValidNode = ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node);
        if (isValidNode && node.type) {
            const typeText = node.type.getText();
            return typeText.includes('Promise') || typeText.includes('Thenable');
        };
        return false;
    };

    /**
     * 递归检查节点中是否包含await表达式
     */
    private containsAwait(node: ts.Node): boolean {
        if (ts.isAwaitExpression(node)) {
            return true;
        };
        if (this.isFunction(node)) {
            return false;
        };
        let hasAwait = false;
        node.forEachChild(child => {
            if (this.containsAwait(child)) {
                hasAwait = true;
            };
        });
        return hasAwait;
    };

    /**
     * 检查节点是否为函数
     */
    private isFunction(node: ts.Node): boolean {
        return ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node) ||
            ts.isMethodDeclaration(node);
    };

    /**
     * 检查函数是否返回Promise
     */
    private checkFunctionReturnsPromise(node: ts.Node, arkFile: ArkFile): boolean {
        const body = this.getFunctionBody(node);
        if (!body) {
            return false;
        };
        if (ts.isCallExpression(body)) {
            const experience = body.expression.getText();
            const definition = this.symbolTable.get(experience);
            if (definition && ts.isVariableDeclaration(definition) && definition.initializer) {
                const funcBody = this.getFunctionBody(definition.initializer);
                if (funcBody && ts.isBlock(funcBody)) {
                    return this.containsExplicitPromiseReturn(funcBody, arkFile);
                }
            };
        };
        if (ts.isArrowFunction(node) && !ts.isBlock(body)) {
            return this.isPromiseExpression(body);
        };
        if (ts.isBlock(body)) {
            return this.containsExplicitPromiseReturn(body, arkFile);
        };
        return false;
    };

    /**
     * 检查块中是否包含返回Promise的语句
     */
    private containsExplicitPromiseReturn(block: ts.Block, arkFile: ArkFile): boolean {
        let hasPromiseReturn = false;
        const visitNode = (node: ts.Node): void => {
            if (!this.isReturnWithPromise(node, arkFile)) {
                ts.forEachChild(node, visitNode);
                return;
            };
            hasPromiseReturn = true;
        };
        visitNode(block);
        return hasPromiseReturn;
    };

    /**
     * 检查Return语句是否返回Promise
     */
    private isReturnWithPromise(node: ts.Node, arkFile: ArkFile): boolean {
        if (!ts.isReturnStatement(node) || !node.expression) {
            return false;
        };
        if (ts.isCallExpression(node.expression)) {
            const funcName = node.expression.expression.getText();
            const definition = this.symbolTable.get(funcName);
            if (definition && ts.isVariableDeclaration(definition) && definition.initializer) {
                const funcBody = this.getFunctionBody(definition.initializer);
                if (funcBody && ts.isBlock(funcBody)) {
                    return this.containsExplicitPromiseReturn(funcBody, arkFile);
                }
            };
        };
        if (this.isPromiseExpression(node.expression)) {
            return true;
        };
        return this.isPromiseFunctionCall(node.expression);
    };

    /**
     * 检查函数调用是否返回Promise
     */
    private isPromiseFunctionCall(expression: ts.Expression): boolean {
        if (!ts.isCallExpression(expression)) {
            return false;
        };
        if (ts.isIdentifier(expression.expression)) {
            const funcName = expression.expression.text;
            const definition = this.symbolTable.get(funcName);
            if (definition) {
                return this.isAsyncFunction(definition) || this.returnsPromiseType(definition);
            };
        };
        return true;
    };

    private buildSymbolTable(sourceFile: ts.SourceFile): void {
        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            if (ts.isVariableDeclaration(node)) {
                const name = node.name.getText();
                this.symbolTable.set(name, node);
            } else if (ts.isFunctionDeclaration(node)) {
                const name = node.name?.getText();
                if (name) {
                    this.symbolTable.set(name, node);
                };
            } else if (ts.isClassDeclaration(node)) {
                const name = node.name?.getText();
                if (name) {
                    this.symbolTable.set(name, node);
                };
            } else if (ts.isArrowFunction(node)) {
                const parent = node.parent;
                if (ts.isVariableDeclaration(parent)) {
                    const name = parent.name.getText();
                    this.symbolTable.set(name, node);
                };
            };
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    };

    private getFunctionPosition(node: ts.Node): { startLine: number, startColumn: number, endColumn: number } {
        const pos = node.getStart();
        const sourceFile = node.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        let startLine = line + 1;
        let startColumn = character + 1;
        let endColumn = startColumn + 5; // "async"关键字的长度
        if (this.isAsyncFunction(node)) {
            const text = node.getText();
            const asyncIndex = text.indexOf('async');
            if (asyncIndex > -1) {
                startColumn = startColumn + asyncIndex;
                endColumn = startColumn + 5;
            };
        };
        if (ts.isArrowFunction(node)) {
            const arrowIndex = node.getText().indexOf('=>');
            if (arrowIndex > 0) {
                startColumn = startColumn + arrowIndex;
            };
        };
        return { startLine, startColumn, endColumn };
    };
    private getFunctionName(node: ts.Node): string {
        if (ts.isFunctionDeclaration(node) && node.name) {
            return node.name.text;
        };
        if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
            return node.name.text;
        };
        // 箭头函数或函数表达式
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            const parent = node.parent;
            if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
                return parent.name.text;
            };
        };
        return '';
    };

    private generateErrorMessage(node: ts.Node): string {
        const functionName = this.getFunctionName(node);
        const isArrowFunction = ts.isArrowFunction(node);
        const isFunctionExpression = ts.isFunctionExpression(node);
        const isGenerator = this.isGeneratorFunction(node);
        // 根据函数类型和名称选择消息
        if (isGenerator) {
            return functionName ?
                `Async generator function '${functionName}' has no 'await' expression.` :
                "Async generator function has no 'await' expression.";
        };
        if (isArrowFunction) {
            return functionName ?
                `Async arrow function '${functionName}' has no 'await' expression.` :
                "Async arrow function has no 'await' expression.";
        };
        if (isFunctionExpression) {
            return functionName ?
                `Async function '${functionName}' has no 'await' expression.` :
                "Async function has no 'await' expression.";
        };
        return functionName ?
            `Async function '${functionName}' has no 'await' expression.` :
            "Async function has no 'await' expression.";
    };

    private reportDefect(filePath: string, node: ts.Node): void {
        const { startLine, startColumn, endColumn } = this.getFunctionPosition(node);
        const message = this.generateErrorMessage(node);
        const severity = this.rule.alert ?? this.metaData.severity;
        const defect = new Defects(startLine, startColumn, endColumn,
            message, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };
};