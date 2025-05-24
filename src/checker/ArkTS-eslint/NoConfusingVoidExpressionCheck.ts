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
    filePath: string;
    fixCode?: string;
}

interface MessageInfo {
    fixCode?: string;
    messageId: MessageId
}

type Options = [{
    ignoreArrowShorthand?: boolean;
    ignoreVoidOperator?: boolean;
}];

type TypeNode = ts.Node | null | undefined;

type TypeLocalFunc = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration | undefined;

type MessageId =
    | 'invalidVoidExpr'
    | 'invalidVoidExprArrow'
    | 'invalidVoidExprArrowWrapVoid'
    | 'invalidVoidExprReturn'
    | 'invalidVoidExprReturnLast'
    | 'invalidVoidExprReturnWrapVoid'
    | 'invalidVoidExprWrapVoid'
    | 'voidExprWrapVoid';

const messages: { [key in MessageId]: string } = {
    invalidVoidExpr: 'Placing a void expression inside another expression is forbidden. Move it to its own statement instead.',
    invalidVoidExprWrapVoid: 'Void expressions used inside another expression must be marked explicitly with the `void` operator.',
    invalidVoidExprArrow: 'Returning a void expression from an arrow function shorthand is forbidden. Please add braces to the arrow function.',
    invalidVoidExprArrowWrapVoid: 'Void expressions returned from an arrow function shorthand must be marked explicitly with the `void` operator.',
    invalidVoidExprReturn: 'Returning a void expression from a function is forbidden. Please move it before the `return` statement.',
    invalidVoidExprReturnLast: 'Returning a void expression from a function is forbidden. Please remove the `return` statement.',
    invalidVoidExprReturnWrapVoid: 'Void expressions returned from a function must be marked explicitly with the `void` operator.',
    voidExprWrapVoid: 'Mark with an explicit `void` operator.'
};

export class NoConfusingVoidExpressionCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-confusing-void-expression.md',
        description: 'Require expressions of type void to appear in statement position'
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private defaultOptions: Options = [{}];
    private config = {
        ignoreArrowShorthand: false,
        ignoreVoidOperator: false
    };
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };
    // 定义需要检测的高风险函数名（可配置）
    private VOID_FUNCTION_PATTERNS = new Set([
        'console.log', 'console.info', 'console.error', 'alert', 'setTimeout',
        'dispatchEvent', 'history.pushState', 'Array.forEach',
        'Promise.then', 'Array.map', 'console.error', 'forEach', 'super'
    ]);

    private readonly INVALID_ANCESTOR_TYPES = [
        ts.SyntaxKind.ArrowFunction,
        ts.SyntaxKind.ArrayLiteralExpression,
        ts.SyntaxKind.ObjectLiteralExpression,
        ts.SyntaxKind.VariableDeclaration,
        ts.SyntaxKind.PropertyAssignment,
        ts.SyntaxKind.CallExpression,
        ts.SyntaxKind.VoidExpression,
        ts.SyntaxKind.ComputedPropertyName,
        ts.SyntaxKind.HeritageClause
    ];

    private functionDeclarations: Map<string, ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction> = new Map();
    private arrowFunctions: Map<string, ts.ArrowFunction> = new Map();
    private classMethods: Map<string, ts.MethodDeclaration> = new Map();

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    };

    public check = (target: ArkFile): void => {
        this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
        this.config.ignoreArrowShorthand = this.defaultOptions[0].ignoreArrowShorthand ?? false;
        this.config.ignoreVoidOperator = this.defaultOptions[0].ignoreVoidOperator ?? false;
        if (target instanceof ArkFile) {
            this.checkVoidExpressions(target);
        };
    };

    private collectFunctionDefinitions(node: ts.Node): void {
        // 收集函数声明
        if (ts.isFunctionDeclaration(node) && node.name) {
            this.functionDeclarations.set(node.name.text, node);
        };
        // 收集箭头函数（变量声明中的初始化）
        if (ts.isVariableStatement(node)) {
            node.declarationList.declarations.forEach(decl => {
                if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
                    this.arrowFunctions.set(decl.name.getText(), decl.initializer);
                } else if (decl.initializer && (ts.isFunctionExpression(decl.initializer) || ts.isArrowFunction(decl.initializer))) {
                    const key = decl.name.getText();
                    this.functionDeclarations.set(key, decl.initializer);
                };
            });
        };
        // 收集类方法
        if (ts.isClassDeclaration(node) && node.name) {
            const className = node.name.getText();
            node.members.forEach(member => {
                if (ts.isMethodDeclaration(member) && member.name) {
                    const fullMethodName = `${className}.${member.name.getText()}`;
                    this.classMethods.set(fullMethodName, member);
                };
            });
        };
        ts.forEachChild(node, this.collectFunctionDefinitions.bind(this));
    };

    private getFunctionName = (node: ts.CallExpression): string => {
        const expr = node.expression;
        if (ts.isPropertyAccessExpression(expr) && expr.questionDotToken) {
            return ''; // 标记为不匹配任何模式
        };
        if (ts.isPropertyAccessExpression(expr)) {
            const objName = expr.expression.getText();
            const funcName = expr.name.text;
            return `${objName}.${funcName}`;
        };
        return expr.getText(); // 直接函数名
    };

    private checkNewPromise(node: ts.NewExpression, arkFile: ArkFile): void {
        if (ts.isIdentifier(node.expression) && node.expression.text === 'Promise' && node.arguments?.[0]) {
            const executor = node.arguments[0];
            if (ts.isFunctionExpression(executor) || ts.isArrowFunction(executor)) {
                // 递归遍历所有嵌套函数
                this.checkPromiseExecutor(executor, arkFile);
            };
        };
    };

    // 遍历函数体，检查是否存在直接调用resolve或reject的语句
    private checkSyncResolve = (node: ts.Node, arkFile: ArkFile, resolveParamName?: string, rejectParamName?: string,
        isInExecutorDirectScope: boolean = false): void => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
            (node.expression.text === resolveParamName || node.expression.text === rejectParamName)
        ) {
            const args = node.arguments;
            if (args.length > 0 && args[0].kind === ts.SyntaxKind.AwaitExpression) {
                return;
            };
            this.checkInvalidContext(node, arkFile);
        };
        if (ts.isCallExpression(node)) {
            let funcExpr = node.expression;
            while (ts.isParenthesizedExpression(funcExpr)) {
                funcExpr = funcExpr.expression as ts.LeftHandSideExpression;
            };
            // 检查是否是函数表达式调用：如 (function(){}()) 或 (async () => {})()
            if (ts.isFunctionExpression(funcExpr) || ts.isArrowFunction(funcExpr)) {
                // 递归检查IIFE的函数体
                this.checkSyncResolve(funcExpr.body, arkFile, resolveParamName, rejectParamName, false);
            }
        };
        if (ts.isAwaitExpression(node)) {
            ts.forEachChild(node, child =>
                this.checkSyncResolve(child, arkFile, resolveParamName, rejectParamName, false)
            );
            return;
        };
        // 递归遍历所有嵌套函数
        let childScopeFlag = isInExecutorDirectScope;
        if (ts.isFunctionLike(node)) {
            childScopeFlag = false;
            const node1 = node as ts.FunctionLikeDeclaration;
            // 对嵌套的函数体进行递归检查
            if (node1.body) {
                ts.forEachChild(node1.body, child =>
                    this.checkSyncResolve(child, arkFile, resolveParamName, rejectParamName, false)
                );
            };
        } else {
            ts.forEachChild(node, child =>
                this.checkSyncResolve(child, arkFile, resolveParamName, rejectParamName, childScopeFlag)
            );
        };
    };

    private checkPromiseExecutor(executor: ts.FunctionLikeDeclaration, arkFile: ArkFile): void {
        // 获取resolve和reject的参数名（可能是任意名称，如res, rej）
        const resolveParamName = executor.parameters[0]?.name.getText();
        const rejectParamName = executor.parameters[1]?.name.getText();
        if (executor.body) {
            this.checkSyncResolve(executor.body, arkFile, resolveParamName, rejectParamName, true);
        };
    };

    private checkArrowFunction = (node: ts.ArrowFunction, arkFile: ArkFile): void => {
        const body = node.body;
        const isVoidBody = ts.isCallExpression(body)
            ? this.VOID_FUNCTION_PATTERNS.has(this.getFunctionName(body))
            : ts.isVoidExpression(body);
        if (isVoidBody) {
            this.checkInvalidContext(body, arkFile);
        };
    };

    private checkClassDeclaration = (node: ts.ClassDeclaration, arkFile: ArkFile): void => {
        this.checkClassHeritage(node, arkFile);
    };

    private checkVoidExpressions(arkFile: ArkFile): void {
        const methodAst = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        this.collectFunctionDefinitions(methodAst); // 收集所有函数定义
        const checkNode = (node: ts.Node): void => {
            if (ts.isVoidExpression(node)) {
                this.checkInvalidContext(node, arkFile);
            } else if (ts.isCallExpression(node)) {
                checkCallExpression(node);
            } else if (ts.isTaggedTemplateExpression(node)) {
                this.checkTaggedTemplate(node, arkFile);
            } else if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
                this.checkArrowFunction(node, arkFile);
            } else if (ts.isClassDeclaration(node)) {
                this.checkClassDeclaration(node, arkFile);
            } else if (ts.isNewExpression(node)) {
                this.checkNewPromise(node, arkFile);
            }
            ts.forEachChild(node, checkNode);
        };
        const checkCallExpression = (node: ts.CallExpression): void => {
            const funcName = this.getFunctionName(node);
            let isVoidFunction = this.VOID_FUNCTION_PATTERNS.has(funcName);
            const isInsideReturn = this.isInsideReturnStatement(node);// 检查是否在return语句中
            isVoidFunction = this.processLocalFunc(funcName, node) ? true : isVoidFunction;
            if (isVoidFunction && (isInsideReturn || this.isInsideExpression(node))) {
                this.checkInvalidContext(node, arkFile);
            };
            if (isVoidFunction || (funcName.includes('.forEach') && this.isParentVoidOrReturn(node))) {
                this.checkInvalidContext(node, arkFile);
                checkArguments(node);
            };
            this.checkIifeWithCall(node, arkFile);
        };
        const checkArguments = (node: ts.CallExpression): void => {
            node.arguments.forEach(arg => {
                if (ts.isFunctionLike(arg)) {
                    ts.forEachChild(arg, checkNode);
                };
            });
        };
        checkNode(methodAst);
    };

    private processLocalFunc(funcName: string, node: ts.CallExpression): boolean | undefined {
        const localFunc: TypeLocalFunc = this.functionDeclarations.get(funcName) || this.arrowFunctions.get(funcName) || this.classMethods.get(funcName);
        return (localFunc && this.isFunctionReturningVoid(localFunc) && node.expression.getText() !== 'RegExp') ||
            (ts.isPropertyAccessExpression(node.expression) && node.expression.questionDotToken && !this.isDotChainDepthnMoreDepth(node.expression));
    };

    private isDotChainDepthnMoreDepth(node: ts.PropertyAccessExpression): boolean {
        let dotChainDepth = 0;
        let currentExpr: ts.Expression = node;
        // 遍历整个属性访问链统计可选链数量
        while (ts.isPropertyAccessExpression(currentExpr)) {
            dotChainDepth++;
            currentExpr = currentExpr.expression;
        };
        if (dotChainDepth >= 2) {
            return true;
        };
        return false;
    };

    private isParentVoidOrReturn(node: ts.CallExpression): boolean {
        return ts.isReturnStatement(node.parent) || ts.isVoidExpression(node.parent);
    };

    private checkTaggedTemplate(node: ts.TaggedTemplateExpression, arkFile: ArkFile): void {
        const func = node.tag;
        // 判断标签函数是否返回void
        if (ts.isFunctionExpression(func) && this.isFunctionReturningVoid(func)) {
            // 检查是否处于非法上下文中
            this.checkInvalidContext(node, arkFile);
        };
    };

    // 辅助方法：检查是否在表达式上下文中
    private isInsideExpression(node: ts.Node): boolean {
        const invalidAncestors = [
            ts.SyntaxKind.BinaryExpression,
            ts.SyntaxKind.ConditionalExpression,
            ts.SyntaxKind.ArrayLiteralExpression,
            ts.SyntaxKind.ObjectLiteralExpression,
            ts.SyntaxKind.PropertyAccessExpression,
            ts.SyntaxKind.CallExpression,
            ts.SyntaxKind.ElementAccessExpression
        ];
        let parent = node.parent;
        while (parent) {
            if (invalidAncestors.includes(parent.kind)) {
                return true;
            };
            if (ts.isCallExpression(parent) && parent.questionDotToken) {
                return true;
            };
            parent = parent.parent;
        };
        return false;
    };

    // 检查是否在return语句内部
    private isInsideReturnStatement(node: ts.Node): boolean {
        let parent = node.parent;
        while (parent) {
            if (ts.isReturnStatement(parent)) {
                return true;
            };
            parent = parent.parent;
        };
        return false;
    };

    private isFunctionReturningVoid(funcNode: ts.FunctionLikeDeclaration): boolean {
        // 显式返回类型为void
        if (funcNode.type?.kind === ts.SyntaxKind.VoidKeyword) {
            return true;
        };
        if (!funcNode.body) {
            return true;
        };
        // 函数体无return或所有return无值
        let hasReturnWithValue = false;
        const checkReturnStatements = (node: ts.Node): void => {
            if (ts.isReturnStatement(node)) {
                hasReturnWithValue = node.expression !== undefined;
            };
            ts.forEachChild(node, checkReturnStatements);
        };
        if (funcNode.body) {
            if (ts.isBlock(funcNode.body)) {
                funcNode.body.statements.forEach(checkReturnStatements);
            } else {
                // 箭头函数简写：() => expression
                hasReturnWithValue = !this.isVoidTypeExpression(funcNode.body);
            };
        };
        const checkReturns = (n: ts.Node): void => {
            if (ts.isReturnStatement(n)) {
                // 排除 void 0 和 undefined 的返回
                if (n.expression &&
                    !ts.isVoidExpression(n.expression) &&
                    !(ts.isIdentifier(n.expression) && n.expression.text === 'undefined')
                ) {
                    hasReturnWithValue = true;
                };
            };
            ts.forEachChild(n, checkReturns);
        };
        ts.forEachChild(funcNode.body, checkReturns);
        return !hasReturnWithValue;
    }

    private checkIifeWithCall(node: ts.CallExpression, arkFile: ArkFile): void {
        // 检测是否是 .call() 调用
        if (!ts.isPropertyAccessExpression(node.expression) ||
            node.expression.name.text !== 'call') {
            return;
        };
        // 检测第一个参数是否是 this
        if (node.arguments.length === 0) {
            return;
        };
        const firstArg = node.arguments[0];
        const isThisArg =
            firstArg.kind === ts.SyntaxKind.ThisKeyword || // 处理直接使用 this 关键字
            (ts.isIdentifier(firstArg) && firstArg.text === 'this'); // 处理变量名为 this 的情况
        if (!isThisArg) {
            return;
        };
        // 确认调用主体是函数表达式
        const funcExpr = node.expression.expression;
        if (!ts.isFunctionExpression(funcExpr) &&
            !ts.isArrowFunction(funcExpr)) {
            return;
        };
        // 判断函数体是否无返回值
        if (!this.functionHasReturnValue(funcExpr)) {
            this.markVoidExpression(node, arkFile);
        };
    };

    private functionHasReturnValue(func: ts.FunctionExpression | ts.ArrowFunction): boolean {
        if (ts.isBlock(func.body)) {
            let hasReturnWithValue = false;
            func.body.statements.forEach(stmt => {
                if (ts.isReturnStatement(stmt) && stmt.expression) {
                    hasReturnWithValue = true;
                }
            });
            return hasReturnWithValue;
        } else {
            // 处理箭头函数简写：() => expression
            return !this.isVoidTypeExpression(func.body);
        };
    };

    private isVoidTypeExpression(expr: ts.Expression): boolean {
        return ts.isVoidExpression(expr) ||
            ts.isCallExpression(expr) &&
            !this.hasOptionalChain(expr) &&
            this.VOID_FUNCTION_PATTERNS.has(this.getFunctionName(expr));
    };

    private hasOptionalChain(node: ts.CallExpression): boolean {
        let expr = node.expression;
        while (ts.isPropertyAccessExpression(expr)) {
            if (expr.questionDotToken) {
                return true;
            };
            expr = expr.expression;
        };
        return false;
    };

    // 检查上下文是否非法
    private checkInvalidContext = (node: ts.Node, arkFile: ArkFile): void => {
        if (ts.isVoidExpression(node) && this.isAllowedVoidContext(node)) {
            return;
        };
        // 跳过 void 0 的特殊处理
        if (ts.isVoidExpression(node) &&
            ts.isNumericLiteral(node.expression) &&
            node.expression.text === '0') {
            return;
        }
        if (ts.isVoidExpression(node.parent)) {
            if (this.config.ignoreVoidOperator) {
                return;
            };
        };
        if (ts.isVoidExpression(node) && ts.isCallExpression(node.expression)) {
            const funcName = this.getFunctionName(node.expression);
            if (this.VOID_FUNCTION_PATTERNS.has(funcName) && this.config.ignoreVoidOperator) {
                return;
            };
        };
        const invalidAncestor = this.findInvalidAncestor(node);
        if (!invalidAncestor) {
            return;
        };
        // 当配置忽略箭头简写且祖先为箭头函数时跳过检测
        if (ts.isArrowFunction(invalidAncestor) && this.config.ignoreArrowShorthand) {
            return;
        };
        if (ts.isArrowFunction(invalidAncestor) && this.config.ignoreVoidOperator) {
            if (this.config.ignoreVoidOperator) {
                return;
            };
        };
        // 过滤特殊表达式
        if (this.specialExpression(invalidAncestor, node)) {
            return;
        };
        this.createIssue(node, invalidAncestor, arkFile);
    };

    private specialExpression(invalidAncestor: ts.Node, node: ts.Node): boolean {
        const invalidAncestorText = invalidAncestor.getText();
        const nodeText = node.getText();
        if (invalidAncestorText === `-${nodeText}`) {
            return true;
        };
        if (!ts.isCallExpression(invalidAncestor)) {
            return false;
        };
        const args = invalidAncestor.arguments ?? [];
        if (args.length > 0 && ts.isFunctionExpression(args[0])) {
            return true;
        };
        return false;
    };

    private isLastStatementInFunction(node: ts.ReturnStatement): boolean {
        let funcBody = node.parent;
        if (ts.isBlock(funcBody) && ts.isIfStatement(funcBody.parent)) {
            funcBody = funcBody.parent.parent;
        };
        return ts.isBlock(funcBody) &&
            funcBody.statements[funcBody.statements.length - 1] === node;
    }

    private generateFixCode(node: ts.Node, invalidAncestor: ts.Node, nodeText: string): MessageInfo {
        let fixCode: string | undefined;
        let messageId: MessageId = 'invalidVoidExpr';
        if (ts.isArrowFunction(invalidAncestor)) {
            const frontText = invalidAncestor.getText().replace(/=>.*$/, '');
            const bodyText = invalidAncestor.body.getText();
            const exist = bodyText.endsWith(';');
            if (this.config.ignoreVoidOperator) {
                messageId = 'invalidVoidExprArrowWrapVoid';
                fixCode = `${frontText}=> void ${bodyText}${exist ? '' : ';'}`;
            } else {
                messageId = 'invalidVoidExprArrow';
                fixCode = `${frontText}=> { ${bodyText}${exist ? '' : ';'} }`;
            };
        } else if (ts.isReturnStatement(invalidAncestor)) {
            messageId = this.returnStatementFixCode(invalidAncestor, nodeText, messageId, fixCode).messageId;
            fixCode = this.returnStatementFixCode(invalidAncestor, nodeText, messageId, fixCode).fixCode;
        } else if (ts.isBinaryExpression(invalidAncestor)) {
            messageId = this.config.ignoreVoidOperator
                ? 'invalidVoidExprWrapVoid'
                : 'invalidVoidExpr';
            fixCode = this.config.ignoreVoidOperator
                ? `void ${nodeText}`
                : `${nodeText};`;
        };
        return { fixCode: fixCode ? `${fixCode}` : undefined, messageId };
    };

    private returnStatementFixCode(invalidAncestor: ts.ReturnStatement, nodeText: string, messageId: MessageId, fixCode: string | undefined): MessageInfo {
        const isLastStatement = this.isLastStatementInFunction(invalidAncestor);
        messageId = isLastStatement ? 'invalidVoidExprReturnLast' : 'invalidVoidExprReturn';
        if (invalidAncestor.expression && ts.isConditionalExpression(invalidAncestor.expression)) {
            const { condition, whenTrue, whenFalse } = invalidAncestor.expression;
            const conditionVar = this.getConditionVariable(condition);
            const isUndefinedVar = conditionVar ? this.isVariableUndefined(conditionVar) : false;
            if (isUndefinedVar) {
                const isLastStatement = this.isLastStatementInFunction(invalidAncestor);
                messageId = isLastStatement ? 'invalidVoidExprReturnLast' : 'invalidVoidExprReturn';
                fixCode = this.config.ignoreVoidOperator
                    ? `void ${whenTrue.getText()}`
                    : `${whenTrue.getText()}; return ${whenFalse.getText()}`;
            } else {
                return { fixCode: undefined, messageId: 'invalidVoidExprReturn' };
            }
        } else if (invalidAncestor.expression && ts.isBinaryExpression(invalidAncestor.expression) &&
            invalidAncestor.expression?.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            fixCode = undefined;
        } else {
            const result = ts.isIfStatement(invalidAncestor.parent) && !invalidAncestor.getText().includes('{');
            fixCode = isLastStatement ? nodeText : (result ? `{ ${nodeText}; return; }` : `${nodeText}; return;`);
        };
        return { fixCode: fixCode ? `${fixCode}` : undefined, messageId };
    };

    private getConditionVariable(condition: ts.Expression): ts.Identifier | undefined {
        // 处理简单标识符条件（如：myVar）
        if (ts.isIdentifier(condition)) {
            return condition;
        }
        // 处理二元表达式（如：myVar != null）
        if (ts.isBinaryExpression(condition)) {
            return this.getIdentifierFromBinaryExpression(condition);
        }
        return undefined;
    }

    private getIdentifierFromBinaryExpression(expr: ts.BinaryExpression): ts.Identifier | undefined {
        // 递归查找左侧或右侧的标识符
        if (ts.isIdentifier(expr.left)) {
            return expr.left;
        };
        if (ts.isBinaryExpression(expr.left)) {
            return this.getIdentifierFromBinaryExpression(expr.left);
        };
        if (ts.isIdentifier(expr.right)) {
            return expr.right;
        };
        if (ts.isBinaryExpression(expr.right)) {
            return this.getIdentifierFromBinaryExpression(expr.right);
        };
        return undefined;
    }

    private isVariableUndefined(varNode: ts.Identifier): boolean {
        const declaration = this.findVariableDeclaration(varNode);
        if (!declaration) {
            return false;
        };
        if (declaration.initializer &&
            (declaration.initializer.kind === ts.SyntaxKind.UndefinedKeyword ||
                declaration.initializer.kind === ts.SyntaxKind.VoidExpression)) {
            return true;
        };
        if (declaration.initializer && declaration.initializer.kind === ts.SyntaxKind.Identifier &&
            declaration.initializer.getText() === 'undefined') {
            return true;
        };
        // 检查类型注解是否为undefined
        if (declaration.type?.kind === ts.SyntaxKind.UndefinedKeyword) {
            return true;
        };
        return false;
    }

    private findVariableDeclaration(varNode: ts.Identifier): ts.VariableDeclaration | undefined {
        const targetName = varNode.text;
        let current: ts.Node = varNode;
        // 定位到最近的作用域边界（Function/Block）
        while (current.parent && !ts.isBlock(current) && !ts.isFunctionLike(current.parent)) {
            current = current.parent;
        };
        // 递归搜索作用域内的变量声明
        const searchScope = (node: ts.Node): ts.VariableDeclaration | undefined => {
            if (ts.isVariableDeclaration(node) && this.checkDeclarationName(node.name, targetName)) {
                return node;
            }
            let found: ts.VariableDeclaration | undefined;
            ts.forEachChild(node, child => {
                const result = searchScope(child);
                if (result) {
                    found = result;
                };
            });
            return found;
        };
        return searchScope(current);
    };

    private checkDeclarationName(nameNode: ts.BindingName, targetName: string): boolean {
        if (ts.isIdentifier(nameNode)) {
            return nameNode.text === targetName;
        };
        const elements = ts.isObjectBindingPattern(nameNode)
            ? nameNode.elements
            : (nameNode as ts.ArrayBindingPattern).elements;
        return elements.some(element => {
            if (ts.isBindingElement(element)) {
                return element.name.getText() === targetName;
            }
            return false;
        });
    }

    private selectMessageId(invalidAncestor: ts.Node): MessageId {
        if (ts.isArrowFunction(invalidAncestor)) {
            return this.config.ignoreVoidOperator
                ? 'invalidVoidExprArrowWrapVoid'
                : 'invalidVoidExprArrow';
        }
        if (ts.isReturnStatement(invalidAncestor)) {
            return this.config.ignoreVoidOperator
                ? 'invalidVoidExprReturnWrapVoid'
                : 'invalidVoidExprReturn';
        }
        return this.config.ignoreVoidOperator
            ? 'invalidVoidExprWrapVoid'
            : 'invalidVoidExpr';
    };

    private checkClassHeritage(node: ts.ClassDeclaration, arkFile: ArkFile): void {
        const checkClause = (clause: ts.HeritageClause): void => {
            clause.types.forEach(type => {
                if (ts.isExpressionWithTypeArguments(type) &&
                    ts.isCallExpression(type.expression)) {
                    this.checkSuperCall(type.expression, arkFile);
                }
            });
        };
        // 检测 extends 继承表达式
        if (node.heritageClauses) {
            node.heritageClauses.forEach(clause => {
                checkClause(clause);
            });
        };
        // 检测计算属性名中的 super()
        node.members.forEach(member => {
            if (ts.isPropertyDeclaration(member) &&
                member.name &&
                ts.isComputedPropertyName(member.name)) {
                this.checkComputedProperty(member.name.expression, arkFile);
            }
        });
    };

    private checkSuperCall(node: ts.CallExpression, arkFile: ArkFile): void {
        if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
            this.markVoidExpression(node, arkFile);
        };
    };

    private checkComputedProperty(expr: ts.Expression, arkFile: ArkFile): void {
        if (ts.isPropertyAccessExpression(expr) &&
            ts.isCallExpression(expr.expression) &&
            expr.expression?.expression?.kind === ts.SyntaxKind.SuperKeyword) {
            this.markVoidExpression(expr.expression, arkFile);
        };
    };

    private markVoidExpression(node: ts.Node, arkFile: ArkFile): void {
        const sourceFile = node.getSourceFile();
        const start = node.getStart();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
        let messageId: MessageId = 'invalidVoidExpr';
        const resultIssue: Issue = {
            line: line + 1,
            column: character + 1,
            columnEnd: character + node.getWidth() + 1,
            message: messages[messageId],
            filePath: arkFile.getFilePath() ?? ''
        };
        this.addIssueReport(resultIssue);
    };

    private createIssue(node: ts.Node, invalidAncestor: ts.Node, arkFile: ArkFile): void {
        const sourceFile = node.getSourceFile();
        const start = node.getStart();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
        const nodeText = sourceFile.text.substring(start, node.getEnd());
        const { fixCode, messageId } = this.generateFixCode(node, invalidAncestor, node.getText());
        const resultIssue: Issue = {
            line: line + 1,
            column: character + 1,
            columnEnd: character + nodeText.length + 1,
            message: messages[messageId],
            filePath: arkFile.getFilePath() ?? '',
            fixCode: fixCode
        };
        let ruleFix;
        if (ts.isArrowFunction(invalidAncestor) || ts.isReturnStatement(invalidAncestor)) {
            ruleFix = fixCode ? this.createFix(invalidAncestor.getStart(), invalidAncestor.getEnd(), fixCode) : undefined;
        };
        this.addIssueReport(resultIssue, ruleFix);
    };

    private createFix(line: number, column: number, code: string): RuleFix {
        return { range: [line, column], text: code };
    };

    private addIssueReport(issue: Issue, ruleFix?: RuleFix): void {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defects = new Defects(issue.line, issue.column, issue.columnEnd, this.metaData.description, severity, this.rule.ruleId, issue.filePath,
            this.metaData.ruleDocPath, true, false, (ruleFix !== undefined ? true : false));
        this.issues.push(new IssueReport(defects, ruleFix));
        RuleListUtil.push(defects);
    };

    private handleLogical(
        parent: ts.Node,
        node: ts.Node,
        isExplicitVoid: (n: ts.Node) => boolean
    ): ts.Node | null | undefined {
        const binaryParent = parent as ts.BinaryExpression;
        // 完全复制原始代码逻辑
        if (this.config.ignoreVoidOperator) {
            if (this.isWrappedByVoid(binaryParent)) {
                return null;
            };
            if (binaryParent.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
                binaryParent.right === node &&
                !ts.isVoidExpression(node)) {
                return binaryParent;
            };
            return isExplicitVoid(node) ? null : binaryParent;
        };
        // 严格保留原始嵌套检查逻辑
        let isNested = false;
        let ancestor = binaryParent.parent;
        while (ancestor) {
            if (ts.isBinaryExpression(ancestor) && this.isLogicalOperator(ancestor)) {
                isNested = true;
                break;
            };
            ancestor = ancestor.parent;
        };
        if (isNested || !ts.isExpressionStatement(binaryParent.parent)) {
            let currentParent: ts.Node | null = binaryParent.parent;
            while (currentParent) {
                if (this.INVALID_ANCESTOR_TYPES.includes(currentParent.kind)) {
                    return currentParent;
                };
                currentParent = currentParent.parent;
            };
            return binaryParent;
        };
        return !ts.isExpressionStatement(binaryParent.parent)
            ? binaryParent
            : undefined;
    };

    private isLogicalOperator(node: ts.BinaryExpression): boolean {
        return node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken;
    };

    private checkReturnStatement(parent: ts.Node, node: ts.Node, isExplicitVoid: (n: ts.Node) => boolean): ts.Node | null | undefined {
        if (!ts.isReturnStatement(parent)) {
            return undefined;
        };
        const returnExpr = parent.expression;
        if (returnExpr && ts.isBinaryExpression(returnExpr) && returnExpr.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            let current: ts.Node = node;
            while (current.parent !== returnExpr) {
                current = current.parent!;
            };
            if (current === returnExpr.left) {
                return null;
            };
        };
        return this.config.ignoreVoidOperator
            ? (isExplicitVoid(node) ? null : parent)
            : parent;
    };

    private isWrappedByVoid(n: ts.Node): boolean {
        let current: ts.Node | null = n;
        while (current) {
            if (ts.isVoidExpression(current)) {
                return true;
            };
            current = current.parent;
        };
        return false;
    };

    private isWrappedByExplicitVoid = (n: ts.Node): boolean => ts.isVoidExpression(n);
    // 检查节点是否被显式 void 包裹（自身或任何祖先）
    private isExplicitVoid = (n: ts.Node): boolean => {
        let current: ts.Node | null = n;
        while (current) {
            if (ts.isVoidExpression(current)) {
                return true;
            };
            current = current.parent;
        };
        return false;
    };

    private shouldSkipFunctionCheck(node: ts.CallExpression): boolean {
        if (node.arguments.length === 0) {
            return false;
        };
        if (!ts.isArrowFunction(node.arguments[0])) {
            return false;
        };
        const node1 = node.arguments[0] as ts.ArrowFunction;
        const asyncAPIs = ['setTimeout', 'setInterval', 'requestAnimationFrame'];
        // 检查函数体是否包含目标模式
        if (ts.isBlock(node1.body)) {
            return node1.body.statements.some(statement => {
                return ts.isExpressionStatement(statement) &&
                    ts.isCallExpression(statement.expression) &&
                    asyncAPIs.includes(node.expression.getText());
            });
        };
        return false;
    };

    // 查找非法祖先节点（与之前逻辑类似，但不再依赖类型）
    private findInvalidAncestor(node: ts.Node): ts.Node | null {
        if (this.skipSpecificPatterns(node) || this.checkVoidZero(node)) {
            return null;
        };
        let parent = node.parent;
        while (parent) {
            if (this.isVoidExpressionWithZero(node, parent)) {
                return null;
            };
            if (ts.isReturnStatement(parent)) {
                const result = this.checkReturnStatement(parent, node, this.isExplicitVoid);
                if (result !== undefined) {
                    return result;
                };
            };
            if (this.isCoalesceExpression(parent, node)) {
                return parent;
            };
            if (this.isLogicalExpression(parent, node)) {
                const result = this.handleLogical(parent, node, this.isExplicitVoid);
                if (result !== undefined) {
                    return result;
                };
            };
            if (ts.isComputedPropertyName(parent) || ts.isHeritageClause(parent)) {
                if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword) {
                    return parent;
                };
            };
            const conditionalResult = this.handleConditionalExpression(parent, node);
            if (conditionalResult !== undefined) {
                return conditionalResult;
            }
            if (ts.isParenthesizedExpression(parent)) {
                parent = parent.parent;
                continue;
            };
            if (ts.isPrefixUnaryExpression(parent)) {
                return this.handlePrefixUnaryExpression(parent, node);
            };
            if (ts.isExpressionStatement(parent) && !parent.getText().includes('await')) {
                return null;
            };
            if (this.isInvalidAncestorType(parent)) {
                return this.handleInvalidAncestorType(parent);
            };
            parent = parent.parent;
        };
        return null;
    };

    private handleConditionalExpression(parent: ts.Node, node: ts.Node): TypeNode {
        if (!ts.isConditionalExpression(parent)) {
            return undefined;
        }
        if (this.config.ignoreVoidOperator) {
            const bothVoid = ts.isVoidExpression(parent.whenTrue) && ts.isVoidExpression(parent.whenFalse);
            return bothVoid ? null : (this.isExplicitVoid(parent) ? null : parent);
        }
        return parent.condition === node ? parent : undefined;
    }

    // 提取初始条件判断
    private skipSpecificPatterns(node: ts.Node): boolean {
        return (ts.isCallExpression(node) && this.shouldSkipFunctionCheck(node)) ||
            (ts.isCallExpression(node) && ts.isBinaryExpression(node.parent) &&
                ts.isParenthesizedExpression(node.parent.parent) &&
                ts.isAwaitExpression(node.parent.parent.parent));
    };

    // 提取 void 0 检测
    private checkVoidZero(node: ts.Node): boolean {
        return ts.isVoidExpression(node) &&
            ts.isNumericLiteral(node.expression) &&
            node.expression.text === '0';
    };

    private isAllowedVoidContext(node: ts.VoidExpression): boolean {
        const parent = node.parent;
        if (ts.isPrefixUnaryExpression(parent) &&
            parent.operator === ts.SyntaxKind.ExclamationToken) { // !
            return true;
        };
        // 允许数组字面量中的 void 表达式
        if (ts.isArrayLiteralExpression(parent)) {
            return true;
        };
        // 允许变量声明初始化中的 void
        if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
            return true;
        };
        // 允许类型注释为 undefined 的变量声明
        if (ts.isVariableDeclaration(parent)) {
            const typeNode = parent.type;
            if (typeNode && typeNode.getText() === 'undefined') {
                return true;
            };
        };
        // 允许导出声明中的 void
        if (ts.isExportAssignment(parent) || (ts.isVariableDeclarationList(parent.parent) &&
            ts.isVariableStatement(parent.parent.parent) &&
            parent.parent.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
            return true;
        };
        return false;
    }

    private isVoidExpressionWithZero(node: ts.Node, parent: ts.Node): boolean {
        return ts.isVoidExpression(node) && node.expression.getText() === '0' && ts.isVariableDeclaration(parent);
    };

    private isCoalesceExpression(parent: ts.Node, node: ts.Node): boolean {
        return ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
            this.config.ignoreVoidOperator && parent.right === node && !this.isExplicitVoid(node) && !this.isWrappedByExplicitVoid(parent);
    };

    private isLogicalExpression(parent: ts.Node, node: ts.Node): boolean {
        return ts.isBinaryExpression(parent) && this.isLogicalOperator(parent);
    };

    private handlePrefixUnaryExpression(parent: ts.Node, node: ts.Node): ts.Node | null {
        const unaryParent = parent as ts.PrefixUnaryExpression;
        // 特殊处理逻辑非操作符
        if (unaryParent.operator === ts.SyntaxKind.ExclamationToken &&
            ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
            ts.isPropertyAccessExpression(node.expression.expression)
        ) {
            return null; // 标记为合法上下文
        };
        if (this.config.ignoreVoidOperator) {
            return this.isExplicitVoid(node) ? null : parent;
        };
        return parent;
    };

    private isInvalidAncestorType(parent: ts.Node): boolean {
        return this.INVALID_ANCESTOR_TYPES.includes(parent.kind);
    };

    private handleInvalidAncestorType(parent: ts.Node): ts.Node | null {
        if (this.config.ignoreVoidOperator && ts.isVariableDeclaration(parent)) {
            return null;
        };
        return parent;
    };
}
