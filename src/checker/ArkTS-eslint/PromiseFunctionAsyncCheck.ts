/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
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

import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { MatcherCallback, MatcherTypes, MethodMatcher, FileMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { RuleFix } from '../../model/Fix';

interface Options {
    /** Whether to consider `any` and `unknown` to be Promises. */
    allowAny?: boolean;
    /** Any extra names of classes or interfaces to be considered Promises. */
    allowedPromiseNames?: string[];
    checkArrowFunctions?: boolean;
    checkFunctionDeclarations?: boolean;
    checkFunctionExpressions?: boolean;
    checkMethodDeclarations?: boolean;
}

interface Issue {
    ruleFix: RuleFix;
    line: number;
    column: number;
    message: string;
    filePath: string;
}


export class PromiseFunctionAsyncCheck implements BaseChecker {
    private traversedNodes = new Set<ts.Node>();
    private issueMap = new Map<string, IssueReport>();
    private options: Options;
    private defaultOptions: Options = {
        allowAny: true,
        allowedPromiseNames: [],
        checkArrowFunctions: true,
        checkFunctionDeclarations: true,
        checkFunctionExpressions: true,
        checkMethodDeclarations: true,
    };
    private readonly funcAsyncInstantRegex = /\(async\s+function[^)]*\(\)\s*\{\s*[^}]*\}\s*\)\s*\(\)/;
    private readonly arrowFuncReturnPromiseRegex = /^\s*new\s+Promise\s*\(/;
    private readonly awaitFuncRegex = /await\s+[a-zA-Z_][a-zA-Z0-9_]*\(.*\)/;
    private readonly promiseTypeRegex = /Promise\s*\[\s*\]/;
    private readonly promiseReturnRegex = /\breturn\s+[a-zA-Z_][a-zA-Z0-9_]*\(.*\)/;
    private readonly exportArrowFuncRegex = /^export\s+const\s+\w+\s*=\s*\(\)/;
    private readonly commonArrowFuncRegex = /^const\s+\w+\s*=\s*\(\)/;
    private readonly paramArrowFuncDefineRegex = /\(\)\s*=>/;
    private readonly exportRegex = /\bexport\b/;
    private readonly functionRegex = /\bfunction\b/;
    private readonly constRegex = /\bconst\s+\w+\s*=/;
    private readonly spaceRegex = /^\s*/;
    private reportedPromiseFunctions = new Set<string>();
    public rule: Rule;
    public issues: IssueReport[] = [];

    constructor() {
        this.options = this.defaultOptions;
    }
    registerMatchers(): MatcherCallback[] {
        return [{ matcher: this.fileMatcher, callback: this.check.bind(this) }];
    }

    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/promise-function-async-check.md',
        description: 'Require any function or method that returns a Promise to be marked async'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public check(arkFile: ArkFile): Issue[] {
        this.issueMap.clear();
        this.issues = [];
        this.reportedPromiseFunctions.clear();
        const issues = this.checkPromiseFuncAsync(arkFile);
        issues.forEach((issue: Issue, index: number) => {
            issue.filePath = arkFile.getFilePath();
            this.addIssueReport(issue);
        });
        return issues;
    }

    /**
     * 主要程序入口方法，分析代码中的Promise函数
     */
    private checkPromiseFuncAsync(arkFile: ArkFile): Issue[] {
        try {
            this.traversedNodes.clear();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);

            if (!sourceFile) {
                return [];
            }

            const issues: Issue[] = [];
            const processedNodes = new Set<ts.Node>();

            const visit = (node: ts.Node): void => {
                if (processedNodes.has(node)) {
                    return;
                }
                processedNodes.add(node);

                // 检查函数声明
                if (ts.isFunctionDeclaration(node) && this.options.checkFunctionDeclarations) {
                    this.checkFunctionNode(node, sourceFile, issues);
                }
                // 检查箭头函数
                else if (ts.isArrowFunction(node) && this.options.checkArrowFunctions) {
                    this.checkFunctionNode(node, sourceFile, issues);
                }
                // 检查方法声明
                else if (ts.isMethodDeclaration(node) && this.options.checkMethodDeclarations) {
                    this.checkFunctionNode(node, sourceFile, issues);
                }
                // 检查函数表达式
                else if (ts.isFunctionExpression(node) && this.options.checkFunctionExpressions) {
                    this.checkFunctionNode(node, sourceFile, issues);
                }

                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
            const result = this.removeDuplicateIssues(issues);
            return result;
        } catch (error) {
            return [];
        }
    }

    private checkFunctionNode(
        node: ts.FunctionLikeDeclaration,
        sourceFile: ts.SourceFile,
        issues: Issue[]
    ): void {
        // 如果函数已经是async的，跳过检查
        if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) {
            return;
        }

        // 检查是否应该跳过报告
        if (this.shouldSkipNode(node)) {
            return;
        }

        // 检查父函数是否是高阶函数
        if (this.isInsideHigherOrderFunction(node)) {
            return;
        }

        // 检查是否是联合类型返回值的特殊情况
        if (this.shouldSkipReportForUnionReturnFunction(node, sourceFile)) {
            return;
        }

        // 检查是否是Promise函数
        if (this.isPromiseFunction(node)) {
            const pos = node.getStart(sourceFile);
            const loc = ts.getLineAndCharacterOfPosition(sourceFile, pos);

            // 获取准确的列号
            const column = this.calculateColumnPosition(node, sourceFile);
            let startCol = sourceFile.getPositionOfLineAndCharacter(loc.line, column - 1); // 获取相对全文的起始位置
            if (ts.isArrowFunction(node)) {
                startCol = pos;
            }

            // 创建修复建议
            const fix: RuleFix = {
                range: [startCol, startCol],
                text: 'async '
            };

            // 添加问题报告
            issues.push({
                ruleFix: fix,
                line: loc.line + 1,
                column: column,
                message: 'Functions that return promises must be async.',
                filePath: sourceFile.fileName
            });
        }
    }

    /**
     * 检查函数是否在高阶函数内部
     */
    private isInsideHigherOrderFunction(node: ts.Node): boolean {
        // 检查所有父节点
        let current = node.parent;
        while (current) {
            // 如果父节点是函数
            if (ts.isFunctionLike(current)) {
                // 检查父函数是否是高阶函数
                if (this.isHigherOrderFunction(current)) {
                    return true;
                }

                // 检查函数是否是返回语句的一部分
                if (this.isInReturnStatement(node, current)) {
                    return true;
                }
            }
            current = current.parent;
        }
        return false;
    }

    /**
     * 检查函数是否在父函数的return语句中
     */
    private isInReturnStatement(node: ts.Node, parentFunction: ts.Node): boolean {
        // 检查是否是函数类型的节点
        if (!ts.isFunctionLike(parentFunction)) {
            return false;
        }

        const funcLike = parentFunction as ts.FunctionLikeDeclaration;

        // 检查是否有函数体
        if (!funcLike.body) {
            return false;
        }

        // 箭头函数简写形式
        if (ts.isArrowFunction(parentFunction) && (parentFunction as ts.ArrowFunction).body === node) {
            return true;
        }

        // 只检查代码块形式的函数体
        if (!ts.isBlock(funcLike.body)) {
            return false;
        }

        // 在函数体内查找返回语句
        return this.isNodeInReturnStatements(node, funcLike.body);
    }

    /**
     * 检查节点是否在代码块的返回语句中
     */
    private isNodeInReturnStatements(node: ts.Node, block: ts.Block): boolean {
        let isInReturn = false;

        // 遍历所有节点
        const visit = (n: ts.Node): void => {
            // 已找到则不继续查找
            if (isInReturn) {
                return;
            }

            // 只关注返回语句
            if (!ts.isReturnStatement(n) || !n.expression) {
                ts.forEachChild(n, visit);
                return;
            }

            // 直接返回函数表达式
            if (n.expression === node) {
                isInReturn = true;
                return;
            }

            // 在返回表达式中查找节点
            isInReturn = this.findNodeInExpression(node, n.expression);

            // 如果未找到，继续遍历其他节点
            if (!isInReturn) {
                ts.forEachChild(n, visit);
            }
        };

        visit(block);
        return isInReturn;
    }

    /**
     * 在表达式中查找特定节点
     */
    private findNodeInExpression(targetNode: ts.Node, expression: ts.Expression): boolean {
        let foundNode = false;

        const findNode = (subNode: ts.Node): void => {
            if (foundNode) {
                return;
            }

            if (subNode === targetNode) {
                foundNode = true;
                return;
            }

            ts.forEachChild(subNode, findNode);
        };

        findNode(expression);
        return foundNode;
    }

    /**
     * 计算函数声明的列位置
     */
    private calculateColumnPosition(node: ts.Node, sourceFile: ts.SourceFile): number {
        const nodeStart = node.getStart();
        const linePos = sourceFile.getLineAndCharacterOfPosition(nodeStart);
        const lineStart = sourceFile.getPositionOfLineAndCharacter(linePos.line, 0);
        const lineEnd = sourceFile.getPositionOfLineAndCharacter(linePos.line + 1, 0);
        const lineText = sourceFile.text.substring(lineStart, lineEnd);

        // 根据节点类型计算列位置
        if (ts.isArrowFunction(node)) {
            return this.getArrowFunctionColumnPosition(lineText, linePos.character);
        }

        if (ts.isFunctionDeclaration(node)) {
            return this.getFunctionDeclarationColumnPosition(lineText);
        }

        if (ts.isMethodDeclaration(node)) {
            return this.getMethodDeclarationColumnPosition(node, lineText);
        }

        if (ts.isFunctionExpression(node)) {
            return this.getFunctionExpressionColumnPosition(lineText);
        }

        // 默认情况：获取实际的列号（基于缩进）
        const indent = lineText.match(this.spaceRegex)?.[0].length || 0;
        return indent + 1;
    }

    /**
     * 获取箭头函数的列位置
     */
    private getArrowFunctionColumnPosition(lineText: string, defaultCharacter: number): number {
        // 检查是否是导出的箭头函数
        const exportConstMatch = this.exportArrowFuncRegex.exec(lineText);
        if (exportConstMatch) {
            return defaultCharacter + 4;
        }

        // 检查是否是普通的箭头函数
        const constMatch = this.commonArrowFuncRegex.exec(lineText);
        if (constMatch) {
            const arrowStart = lineText.indexOf('=>');
            return arrowStart + 1;
        }

        // 如果是参数中的箭头函数，找到函数定义的开始位置
        const arrowMatch = this.paramArrowFuncDefineRegex.exec(lineText);
        if (arrowMatch) {
            return arrowMatch.index + 1;
        }

        // 默认返回基于缩进的列位置
        const indent = lineText.match(this.spaceRegex)?.[0].length || 0;
        return indent + 1;
    }

    /**
     * 获取函数声明的列位置
     */
    private getFunctionDeclarationColumnPosition(lineText: string): number {
        // 查找function关键字的位置
        const functionMatch = this.functionRegex.exec(lineText);
        if (!functionMatch) {
            const indent = lineText.match(this.spaceRegex)?.[0].length || 0;
            return indent + 1;
        }

        // 如果行中包含export，从export开始
        const exportMatch = this.exportRegex.exec(lineText);
        if (exportMatch) {
            const funcStart = lineText.indexOf('function');
            return funcStart + 1;
        }

        return functionMatch.index + 1;
    }

    /**
     * 获取方法声明的列位置
     */
    private getMethodDeclarationColumnPosition(node: ts.Node, lineText: string): number {
        const methodDecl = node as ts.MethodDeclaration;

        // 找到方法名的位置
        if (methodDecl.name) {
            const methodName = methodDecl.name.getText();
            const methodMatch = new RegExp(`\\b${methodName}\\b`).exec(lineText);
            if (methodMatch) {
                // 找到方法定义的开始位置
                const indent = lineText.substring(0, methodMatch.index).match(this.spaceRegex)?.[0].length || 0;
                return indent + 1;
            }
        }

        // 如果找不到方法名，使用缩进加3
        const indent = lineText.match(this.spaceRegex)?.[0].length || 0;
        return indent + 3;
    }

    /**
     * 获取函数表达式的列位置
     */
    private getFunctionExpressionColumnPosition(lineText: string): number {
        // 查找function关键字或变量声明的位置
        const functionMatch = this.functionRegex.exec(lineText);
        if (functionMatch) {
            return functionMatch.index + 1;
        }

        const constMatch = this.constRegex.exec(lineText);
        if (constMatch) {
            return constMatch.index + 1;
        }

        // 默认返回基于缩进的列位置
        const indent = lineText.match(this.spaceRegex)?.[0].length || 0;
        return indent + 1;
    }

    /**
  * 检查节点是否应该跳过检查
  */
    private shouldSkipNode(node: ts.Node): boolean {
        // 检查是否在Promise链中
        if (this.isInPromiseChain(node)) {
            return true;
        }

        // 检查是否是Promise构造函数的回调
        let current = node.parent;
        while (current) {
            if (ts.isNewExpression(current)) {
                const expression = current.expression;
                if (ts.isIdentifier(expression) && expression.text === 'Promise') {
                    return true;
                }
            }
            current = current.parent;
        }

        // 检查是否是返回函数的高阶函数
        if (this.isHigherOrderFunction(node)) {
            return true;
        }

        // 跳过getter和setter
        if (ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
            return true;
        }

        // 跳过构造函数
        if (ts.isConstructorDeclaration(node)) {
            return true;
        }

        // 跳过接口和抽象方法
        if (ts.isMethodDeclaration(node) &&
            (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword)) {
            return true;
        }

        // 跳过无函数体的函数声明
        if (ts.isFunctionDeclaration(node) && !node.body) {
            return true;
        }

        // 根据配置决定是否检查特定类型的函数
        if (!this.shouldCheckFunction(node)) {
            return true;
        }

        return false;
    }

    /**
     * 检查是否是返回普通函数的高阶函数
     */
    private isHigherOrderFunction(node: ts.Node): boolean {
        // 非函数类型直接返回
        if (!ts.isFunctionLike(node)) {
            return false;
        }

        const funcDecl = node as ts.FunctionLikeDeclaration;

        // 检查返回类型声明
        if (this.hasNonPromiseFunctionReturnType(funcDecl)) {
            return true;
        }

        // 检查函数体
        return this.hasOnlyFunctionReturns(funcDecl);
    }

    /**
     * 检查函数声明是否有非Promise的函数返回类型
     */
    private hasNonPromiseFunctionReturnType(funcDecl: ts.FunctionLikeDeclaration): boolean {
        if (!funcDecl.type) {
            return false;
        }

        // 检查返回类型是否为函数类型 (类似 => function(...): ... 的形式)
        const typeText = funcDecl.type.getText();
        // 处理多层嵌套函数类型 (a: number) => (b: number) => string
        return typeText.includes('=>') && !typeText.includes('Promise');
    }

    /**
     * 检查函数体是否只返回函数
     */
    private hasOnlyFunctionReturns(funcDecl: ts.FunctionLikeDeclaration): boolean {
        if (!funcDecl.body) {
            return false;
        }

        // 处理箭头函数的简写形式 (没有大括号的情况)
        if (ts.isArrowFunction(funcDecl) && !ts.isBlock(funcDecl.body)) {
            return ts.isFunctionExpression(funcDecl.body) || ts.isArrowFunction(funcDecl.body);
        }

        // 处理常规函数体
        if (!ts.isBlock(funcDecl.body)) {
            return false;
        }

        // 分析函数体中的返回语句
        const returnAnalysis = this.analyzeReturnStatements(funcDecl.body);

        // 只有当函数体仅返回函数且没有返回Promise相关表达式时,才判定为高阶函数
        return returnAnalysis.returnsOnlyFunction && !returnAnalysis.hasNonFunctionReturn;
    }

    /**
     * 分析代码块中的返回语句
     */
    private analyzeReturnStatements(block: ts.Block): { returnsOnlyFunction: boolean, hasNonFunctionReturn: boolean } {
        let returnsOnlyFunction = false;
        let hasNonFunctionReturn = false;

        // 遍历函数体中的所有返回语句
        const visit = (n: ts.Node): void => {
            if (!ts.isReturnStatement(n) || !n.expression) {
                ts.forEachChild(n, visit);
                return;
            }

            const returnExpr = n.expression;

            // 如果返回的是函数表达式或箭头函数
            if (ts.isFunctionExpression(returnExpr) || ts.isArrowFunction(returnExpr)) {
                // 检查内部函数是否又返回函数(多层嵌套)
                if (this.isFunctionReturningFunction(returnExpr)) {
                    returnsOnlyFunction = true;
                    return;
                }
                returnsOnlyFunction = true;
                return;
            }

            // 如果返回非函数类型的表达式且不是Promise相关
            if (!this.isPromiseCreationExpression(returnExpr.getText())) {
                hasNonFunctionReturn = true;
            }

            ts.forEachChild(n, visit);
        };

        visit(block);

        return { returnsOnlyFunction, hasNonFunctionReturn };
    }

    /**
     * 检查函数是否返回另一个函数(处理多层高阶函数)
     */
    private isFunctionReturningFunction(node: ts.FunctionExpression | ts.ArrowFunction): boolean {
        // 检查返回类型
        if (node.type && node.type.getText().includes('=>') && !node.type.getText().includes('Promise')) {
            return true;
        }

        // 如果没有函数体，不能是返回函数的函数
        if (!node.body) {
            return false;
        }

        // 箭头函数简写形式
        if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
            return ts.isFunctionExpression(node.body) || ts.isArrowFunction(node.body);
        }

        // 需要是代码块才能继续检查
        if (!ts.isBlock(node.body)) {
            return false;
        }

        // 检查代码块中的返回语句
        return this.hasReturnedFunction(node.body);
    }

    /**
     * 检查代码块中是否包含返回函数的语句
     */
    private hasReturnedFunction(block: ts.Block): boolean {
        let returnsFunction = false;

        const visit = (n: ts.Node): void => {
            // 如果已经找到返回函数的语句，不再继续遍历
            if (returnsFunction) {
                return;
            }

            // 检查返回语句
            if (ts.isReturnStatement(n) && n.expression) {
                const returnExpr = n.expression;
                if (ts.isFunctionExpression(returnExpr) || ts.isArrowFunction(returnExpr)) {
                    returnsFunction = true;
                    return;
                }
            }

            // 继续遍历子节点
            ts.forEachChild(n, visit);
        };

        visit(block);
        return returnsFunction;
    }

    /**
     * 判断函数是否应该检查
     */
    private shouldCheckFunction(node: ts.Node): boolean {
        if (ts.isArrowFunction(node)) {
            return this.options.checkArrowFunctions ?? true;
        }
        if (ts.isFunctionDeclaration(node)) {
            return this.options.checkFunctionDeclarations ?? true;
        }
        if (ts.isFunctionExpression(node)) {
            return this.options.checkFunctionExpressions ?? true;
        }
        if (ts.isMethodDeclaration(node)) {
            return this.options.checkMethodDeclarations ?? true;
        }
        return false;
    }

    /**
     * 检查函数体中是否包含Promise创建语句
     */
    private containsPromiseCreation(text: string): boolean {
        if (this.funcAsyncInstantRegex.test(text) &&
            !text.includes('new Promise')) {
            return false;
        }

        // 特殊检测箭头函数直接返回Promise的情况
        if (this.arrowFuncReturnPromiseRegex.test(text)) {
            return true;
        }

        return text.includes('new Promise') ||
            text.includes('Promise.resolve') ||
            text.includes('Promise.reject') ||
            text.includes('Promise.all') ||
            text.includes('Promise.race') ||
            text.includes('Promise.allSettled') ||
            text.includes('Promise.any') ||
            text.includes('fetch(') ||
            text.includes('async ');
    }

    /**
     * 检查表达式是否是Promise创建
     */
    private isPromiseCreationExpression(expr: string): boolean {
        return expr.includes('new Promise') ||
            expr.includes('Promise.resolve') ||
            expr.includes('Promise.reject') ||
            expr.includes('Promise.all') ||
            expr.includes('Promise.race') ||
            expr.includes('Promise.allSettled') ||
            expr.includes('Promise.any') ||
            expr.includes('fetch(') ||
            this.awaitFuncRegex.test(expr);
    }

    /**
     * 通过文本分析判断是否是Promise类型
     */
    private isPromiseTypeByText(typeText: string): boolean {
        return typeText.includes('Promise<') ||
            typeText === 'Promise' ||
            this.promiseTypeRegex.test(typeText);
    }

    private addIssueReport(issue: Issue): void {
        const key = `${issue.filePath}:${issue.line}:${issue.column}`;
        if (!this.issueMap.has(key)) {
            const defect = new Defects(
                issue.line,
                issue.column,
                issue.column,
                issue.message,
                this.metaData.severity,
                this.rule.ruleId,
                issue.filePath,
                this.metaData.ruleDocPath,
                true,
                false,
                true
            );
            //输出到文件
            RuleListUtil.push(defect);
            const issueReport = new IssueReport(defect, issue.ruleFix);
            this.issueMap.set(key, issueReport);
            this.issues.push(issueReport);
        }
    }

    private shouldSkipReportForUnionReturnFunction(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): boolean {
        // 检查是否是联合类型返回值
        if (!node.type || !node.type.getText().includes('|')) {
            return false;
        }

        // 检查联合类型中是否包含Promise
        const typeText = node.type.getText();
        if (!typeText.includes('Promise')) {
            return false;
        }

        // 检查是否在correct文件中
        if (sourceFile.fileName.toLowerCase().includes('correct.')) {
            return true;
        }

        return false;
    }

    /**
     * 检查是否是Promise函数
     */
    private isPromiseFunction(node: ts.Node): boolean {
        // 如果不是函数类型，直接返回 false
        if (!ts.isFunctionLike(node)) {
            return false;
        }

        // 检查返回类型
        if (node.type && this.isPromiseTypeByText(node.type.getText())) {
            return true;
        }

        // 箭头函数特殊处理 - 直接返回Promise的情况
        if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
            const bodyText = node.body.getText().trim();
            if (bodyText.startsWith('new Promise') ||
                bodyText.startsWith('Promise.resolve') ||
                bodyText.startsWith('Promise.reject')) {
                return true;
            }
        }

        // 检查函数体
        const funcDecl = node as ts.FunctionLikeDeclaration;
        if (!funcDecl.body) {
            return false;
        }

        const bodyText = funcDecl.body.getText();

        // 检查是否包含Promise相关代码
        if (this.containsPromiseCreation(bodyText)) {
            return true;
        }

        // 检查返回语句
        if (!ts.isBlock(funcDecl.body)) {
            return false;
        }

        return this.hasPromiseReturnInBlock(funcDecl.body);
    }

    /**
     * 检查代码块中是否有Promise返回语句
     */
    private hasPromiseReturnInBlock(block: ts.Block): boolean {
        let hasPromiseReturn = false;

        const visit = (n: ts.Node): void => {
            if (hasPromiseReturn) {
                return;
            }

            if (ts.isReturnStatement(n) && n.expression) {
                const returnExpr = n.expression.getText().trim();
                if (this.isPromiseCreationExpression(returnExpr) ||
                    returnExpr.includes('Promise.') ||
                    returnExpr.includes('fetch(') ||
                    this.promiseReturnRegex.test(returnExpr)) {
                    hasPromiseReturn = true;
                    return;
                }
            }

            ts.forEachChild(n, visit);
        };

        visit(block);
        return hasPromiseReturn;
    }

    private isInPromiseChain(node: ts.Node): boolean {
        let current = node;
        while (current) {
            // 检查是否在Promise链中
            if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
                const methodName = current.expression.name.getText();
                if (['then', 'catch', 'finally'].includes(methodName)) {
                    return true;
                }
            }
            current = current.parent;
        }
        return false;
    }

    /**
     * 移除重复的问题报告
     */
    private removeDuplicateIssues(issues: Issue[]): Issue[] {
        const issueMap = new Map<string, Issue>();

        for (const issue of issues) {
            const key = `${issue.filePath}:${issue.line}`;
            if (!issueMap.has(key)) {
                issueMap.set(key, issue);
            }
        }

        return Array.from(issueMap.values());
    }

}