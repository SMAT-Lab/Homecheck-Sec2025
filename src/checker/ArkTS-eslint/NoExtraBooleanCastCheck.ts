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
};

interface FixInfo {
    text: string;
    needsParens: boolean;
};

type Options = [{
    enforceForLogicalOperands: boolean
}];

export class NoExtraBooleanCastCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-extra-boolean-cast.md',
        description: 'Redundant Boolean call'
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private defaultOptions: Options = [{ 'enforceForLogicalOperands': false }];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };
    private sourceFile: ts.SourceFile;
    private arkFile: ArkFile;
    private enforceForLogicalOperands: boolean;
    public static readonly binaryExpressionTypes: ts.SyntaxKind[] = [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken
    ];
    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    };
    public check = (target: ArkFile): void => {
        this.defaultOptions = (this.rule && this.rule.option[0]) ? (this.rule.option as Options) : this.defaultOptions;
        if (target instanceof ArkFile) {
            this.checkExtraBooleanCast(target, this.defaultOptions[0].enforceForLogicalOperands);
        };
    };

    private getUnwrappedExpression = (node: ts.Node): ts.Node => {
        while (node.kind === ts.SyntaxKind.ParenthesizedExpression) {
            node = (node as ts.ParenthesizedExpression).expression;
        };
        return node;
    };

    // 检查是否存在多余的布尔转换
    private hasRedundantBooleanCast = (node: ts.Node): boolean => {
        const unwrapped = this.getUnwrappedExpression(node);
        if (ts.isBinaryExpression(unwrapped) && unwrapped.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            // 递归检查逗号表达式的右操作数（即最后一个表达式）
            return this.hasRedundantBooleanCast(unwrapped.right);
        };
        if (node.kind === ts.SyntaxKind.PrefixUnaryExpression) {
            return this.hasCheckPrefixUnaryExp(node as ts.PrefixUnaryExpression);
        } else if (node.kind === ts.SyntaxKind.CallExpression) {
            const callExpr = node as ts.CallExpression;
            if (
                callExpr.expression.kind === ts.SyntaxKind.Identifier &&
                (callExpr.expression as ts.Identifier).text === 'Boolean'
            ) {
                const arg = callExpr.arguments[0];
                const unwrappedArg = this.getUnwrappedExpression(arg);
                if (
                    unwrappedArg.kind === ts.SyntaxKind.PrefixUnaryExpression ||
                    unwrappedArg.kind === ts.SyntaxKind.CallExpression
                ) {
                    return this.hasRedundantBooleanCast(unwrappedArg);
                }
            };
        };
        return false;
    };

    private hasCheckPrefixUnaryExp(unaryExpr: ts.PrefixUnaryExpression): boolean {
        if (unaryExpr.operator === ts.SyntaxKind.ExclamationToken) {
            const operand = this.getUnwrappedExpression(unaryExpr.operand);
            if (operand.kind === ts.SyntaxKind.PrefixUnaryExpression) {
                const innerUnaryExpr = operand as ts.PrefixUnaryExpression;
                if (innerUnaryExpr.operator === ts.SyntaxKind.ExclamationToken) {
                    return true;
                };
            } else if (operand.kind === ts.SyntaxKind.CallExpression) {
                const callExpr = operand as ts.CallExpression;
                if (
                    callExpr.expression.kind === ts.SyntaxKind.Identifier &&
                    (callExpr.expression as ts.Identifier).text === 'Boolean'
                ) {
                    return true;
                };
            };
        };
        return false;
    };

    //Node是否处于布尔上下文中。布尔上下文是指那些期望表达式返回布尔值的语法结构，例如条件语句、逻辑运算符、布尔转换函数等
    private isInBooleanContext = (node: ts.Node, enforceForLogicalOperands: boolean): boolean => {
        let current: ts.Node | undefined = node.parent;
        let currentNode = node;
        while (current) {
            if (current.kind === ts.SyntaxKind.IfStatement) {
                return (current as ts.IfStatement).expression === currentNode;
            } else if (current.kind === ts.SyntaxKind.WhileStatement) {
                return (current as ts.WhileStatement).expression === currentNode;
            } else if (current.kind === ts.SyntaxKind.DoStatement) {
                return (current as ts.DoStatement).expression === currentNode;
            } else if (current.kind === ts.SyntaxKind.ConditionalExpression) {
                return (current as ts.ConditionalExpression).condition === currentNode;
            } else if (current.kind === ts.SyntaxKind.ForStatement) {
                return (current as ts.ForStatement).condition === currentNode;
            } else if (
                current.kind === ts.SyntaxKind.PrefixUnaryExpression &&
                (current as ts.PrefixUnaryExpression).operator === ts.SyntaxKind.ExclamationToken
            ) {
                return true;
            } else if (current.kind === ts.SyntaxKind.BinaryExpression &&
                NoExtraBooleanCastCheck.binaryExpressionTypes.includes((current as ts.BinaryExpression).operatorToken.kind)) {
                return enforceForLogicalOperands;
            } else if (
                current.kind === ts.SyntaxKind.CallExpression &&
                (current as ts.CallExpression).expression.kind === ts.SyntaxKind.Identifier &&
                ((current as ts.CallExpression).expression as ts.Identifier).text === 'Boolean'
            ) {
                return true;
            };
            currentNode = current;
            current = current.parent;
        };
        return false;
    };

    //判断node的父节点是否是一个逻辑表达式(如 && || ??)
    private isParentLogicalExpression = (node: ts.Node): boolean => {
        const parent = node.parent;
        return parent?.kind === ts.SyntaxKind.BinaryExpression && [
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken
        ].includes((parent as ts.BinaryExpression).operatorToken.kind);
    };

    private addIssue = (node: ts.Node, message: string, fix: string | undefined, methodAst: ts.SourceFile, arkFile: ArkFile): void => {
        const { line, character } = ts.getLineAndCharacterOfPosition(methodAst, node.getStart());
        const issue: Issue = {
            line: line + 1,
            column: character + 1,
            columnEnd: character + 1 + (node.getText()?.length ?? 0),
            message,
            filePath: arkFile.getFilePath() ?? '',
        };
        let fixInfo: FixInfo | undefined;
        if (fix && this.canSafeFix(node)) {
            const needsParens = this.needsParentheses(node, fix);
            fixInfo = {
                text: needsParens ? `(${fix})` : fix,
                needsParens
            };
        };
        const ruleFix = fixInfo ? this.createFix(node.getStart(), node.getEnd(), fixInfo.text) : undefined;
        this.addIssueReport(issue, ruleFix);
    };

    // 获取最内层非布尔转换的参数
    private getInnermostNonBooleanArg = (node: ts.Node): ts.Node => {
        if (node.kind === ts.SyntaxKind.PrefixUnaryExpression) {
            const unaryExpr = node as ts.PrefixUnaryExpression;
            if (unaryExpr.operator === ts.SyntaxKind.ExclamationToken) {
                const operand = this.getUnwrappedExpression(unaryExpr.operand);
                return this.getInnermostNonBooleanArg(operand);
            };
        } else if (node.kind === ts.SyntaxKind.CallExpression) {
            const callExpr = node as ts.CallExpression;
            if (
                callExpr.expression.kind === ts.SyntaxKind.Identifier &&
                (callExpr.expression as ts.Identifier).text === 'Boolean'
            ) {
                const arg = callExpr.arguments[0];
                const unwrappedArg = this.getUnwrappedExpression(arg);
                return this.getInnermostNonBooleanArg(unwrappedArg);
            };
        };
        return node;
    };

    private checkNode = (node: ts.Node): void => {
        if (node.kind === ts.SyntaxKind.CallExpression) {
            const callExpr = node as ts.CallExpression;
            if (this.checkCallExpressionOneArguments(callExpr)) {
                return;
            }
            if (callExpr.expression?.kind === ts.SyntaxKind.Identifier && (callExpr.expression as ts.Identifier).text === 'Boolean') {
                const result = this.checkCallExpressionNoOneArguments(callExpr, this.sourceFile, this.arkFile, this.enforceForLogicalOperands);
                if (result) {
                    return;
                }
                const arg = callExpr.arguments[0];
                const result1 = this.isInBooleanContext(callExpr, this.defaultOptions[0].enforceForLogicalOperands) ||
                (this.enforceForLogicalOperands && this.isParentLogicalExpression(callExpr));
                if (result1) {
                    const unwrappedArg = this.getUnwrappedExpression(arg);
                    this.addIssue(callExpr, 'Redundant Boolean call', unwrappedArg.getText(), this.sourceFile, this.arkFile);
                };
                this.checkNode(arg);
            }
        } else if (node.kind === ts.SyntaxKind.NewExpression) {
            const newExpr = node as ts.NewExpression;
            if (newExpr.expression.kind === ts.SyntaxKind.Identifier && (newExpr.expression as ts.Identifier).text === 'Boolean') {
                const result = this.checkNewCallExpression(newExpr, this.sourceFile, this.arkFile, this.enforceForLogicalOperands);
                if (result || !newExpr.arguments) {
                    return;
                }
                const arg = newExpr.arguments[0];
                this.checkNode(arg);
            }
        } else if (node.kind === ts.SyntaxKind.PrefixUnaryExpression) {
            const unaryExpr = node as ts.PrefixUnaryExpression;
            if (unaryExpr.operator === ts.SyntaxKind.ExclamationToken) {
                const operand = this.getUnwrappedExpression(unaryExpr.operand);
                if (operand.kind === ts.SyntaxKind.CallExpression &&
                    (operand as ts.CallExpression).expression.kind === ts.SyntaxKind.Identifier &&
                    ((operand as ts.CallExpression).expression as ts.Identifier).text === 'Boolean') {
                    this.checkNode(operand);
                    return;
                } else if (operand.kind === ts.SyntaxKind.PrefixUnaryExpression &&
                    (operand as ts.PrefixUnaryExpression).operator === ts.SyntaxKind.ExclamationToken) {
                    this.checkPrefixUnaryExpression(unaryExpr, this.enforceForLogicalOperands, operand, this.sourceFile, this.arkFile);
                };
            }
        };
        ts.forEachChild(node, this.checkNode);
    };

    private checkExtraBooleanCast(arkFile: ArkFile, enforceForLogicalOperands: boolean): void {
        const methodAst = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        this.sourceFile = methodAst;
        this.arkFile = arkFile;
        this.enforceForLogicalOperands = enforceForLogicalOperands;
        this.checkNode(methodAst);
    };

    private checkPrefixUnaryExpression(unaryExpr: ts.PrefixUnaryExpression, enforceForLogicalOperands: boolean,
        operand: ts.Node, methodAst: ts.SourceFile, arkFile: ArkFile): void {
        const innerOperand = this.getUnwrappedExpression((operand as ts.PrefixUnaryExpression).operand);
        if ((!enforceForLogicalOperands && this.isInBooleanContext(unaryExpr, enforceForLogicalOperands)) ||
            (enforceForLogicalOperands && (this.isParentLogicalExpression(unaryExpr)) || this.isInBooleanContext(unaryExpr, enforceForLogicalOperands))) {
            this.addIssue(unaryExpr, 'Redundant double negation', innerOperand.getText(), methodAst, arkFile);
        };
    };

    private checkNewCallExpression(newExpr: ts.NewExpression, methodAst: ts.SourceFile, arkFile: ArkFile,
        enforceForLogicalOperands: boolean): boolean {
        if (!newExpr.arguments) {
            return false;
        }
        if (newExpr.arguments?.length !== 1) {
            const message = 'Redundant Boolean constructor call';
            this.addIssue(newExpr, message, 'false', methodAst, arkFile);
            return true;
        };
        const arg = newExpr.arguments[0];
        const unwrappedArg = this.getUnwrappedExpression(arg);
        const isRedundant = this.hasRedundantBooleanCast(unwrappedArg);
        if (isRedundant) {
            const innermostArg = this.getInnermostNonBooleanArg(unwrappedArg);
            this.addIssue(unwrappedArg, 'Redundant double negation', innermostArg.getText(), methodAst, arkFile);
        };
        return false;
    };

    private checkCallExpressionOneArguments(callExpr: ts.CallExpression): boolean {
        if (callExpr.expression.getText() !== 'Boolean') {
            return false;
        };
        if (callExpr.arguments.length === 1) {
            const arg = callExpr.arguments[0];
            if (ts.isBinaryExpression(arg) &&
                arg.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
                ts.isCallExpression(arg.right) && arg.right.arguments.length === 1
            ) {
                return true;
            };
        };
        if (callExpr.arguments.length === 2 &&
            callExpr.arguments[0]?.kind !== ts.SyntaxKind.PrefixUnaryExpression &&
            callExpr.arguments[1]?.kind === ts.SyntaxKind.PrefixUnaryExpression &&
            (callExpr.arguments[1] as ts.ParenthesizedExpression).expression?.kind === ts.SyntaxKind.PrefixUnaryExpression) {
            return true;
        };
        return false;
    };

    private checkCallExpressionNoOneArguments(callExpr: ts.CallExpression, methodAst: ts.SourceFile,
        arkFile: ArkFile, enforceForLogicalOperands: boolean): boolean {
        if (callExpr.arguments.length !== 1) {
            if (callExpr.arguments.length > 0) {
                const arg = callExpr.arguments[0];
                if (!(arg.kind === ts.SyntaxKind.PrefixUnaryExpression &&
                    (arg as ts.PrefixUnaryExpression).operator === ts.SyntaxKind.ExclamationToken &&
                    (arg as ts.PrefixUnaryExpression).operand.kind === ts.SyntaxKind.PrefixUnaryExpression &&
                    ((arg as ts.PrefixUnaryExpression).operand as ts.PrefixUnaryExpression).operator === ts.SyntaxKind.ExclamationToken
                ) && !enforceForLogicalOperands) {
                    return true;
                };
            };
            if (callExpr.arguments.length === 0) {
                const message = 'Redundant Boolean call';
                this.addIssue(callExpr, message, 'false', methodAst, arkFile);
                return true;
            };
        };
        const arg = callExpr.arguments[0];
        if (this.isBooleanTypeExpression(arg)) {
            return true; // 不报告问题
        };
        return false;
    };

    private isBooleanTypeExpression(node: ts.Node): boolean {
        const unwrapped = this.getUnwrappedExpression(node);
        if (ts.isBinaryExpression(unwrapped) &&
            !ts.isConditionalExpression(unwrapped.parent.parent) &&
            !ts.isPrefixUnaryExpression(unwrapped.parent.parent)) {
            const operator = unwrapped.operatorToken.kind;
            const comparisonOps = [
                ts.SyntaxKind.LessThanToken,
                ts.SyntaxKind.GreaterThanToken,
            ];
            return comparisonOps.includes(operator);
        };
        return false;
    };

    private canSafeFix(node: ts.Node): boolean {
        // 类型校验次之   参数安全   优先级校验最后
        return this.isValidBooleanCall(node) && this.checkArgumentSafety(node) && this.checkPrecedenceSafety(node);
    };

    private isValidBooleanCall(node: ts.Node): boolean {
        // 处理双重否定表达式（!!exp → Boolean(exp)）
        if (ts.isPrefixUnaryExpression(node) &&
            node.operator === ts.SyntaxKind.ExclamationToken &&
            ts.isPrefixUnaryExpression(node.operand) &&
            node.operand.operator === ts.SyntaxKind.ExclamationToken
        ) {
            return true; // 识别为 Boolean 转换
        };
        if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) {
            return true; // 允许双重否定修复
        };
        // Boolean()必须只有一个参数且不是展开语法
        return node.arguments?.length === 1 &&
            !ts.isSpreadElement(node.arguments[0]);
    };

    private checkArgumentSafety(node: ts.Node): boolean {
        if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
            const args = node.arguments;
            // 1: Boolean()
            if (args?.length === 0) {
                return false;
            };
            // 2: Boolean(...args)
            if (args?.some(arg => ts.isSpreadElement(arg))) {
                return false;
            };
            // 3: Boolean(a, b)
            if ((args?.length ?? 0) > 1) {
                return false;
            };
        };
        return true;
    };

    private hasComments(node: ts.Node): boolean {
        if (!this.sourceFile?.text) {
            return false;
        };
        // ESLint注释检测等效实现
        const commentRanges = [
            ...ts.getLeadingCommentRanges(this.sourceFile.text, node.getFullStart()) || [],
            ...ts.getTrailingCommentRanges(this.sourceFile.text, node.getEnd()) || []
        ];
        return commentRanges.length > 0;
    }

    private checkPrecedenceSafety(node: ts.Node): boolean {
        // ESLint优先级安全策略
        const parent = node.parent;
        if (!ts.isBinaryExpression(parent)) {
            return true;
        };
        const nodePrecedence = this.getPrecedence(node);
        const parentPrecedence = this.getPrecedence(parent);
        return nodePrecedence >= parentPrecedence;
    }

    // 新增括号需求判断方法
    private needsParentheses(originalNode: ts.Node, replacement: string): boolean {
        // 新增快速检测运算符：三元、逗号、!=、!==、** 
        const forceParensRegex = /(\?|,|!\==?|\*\*)/;
        if (forceParensRegex.test(replacement)) {
            return true; // 强制添加括号
        };
        const parent = originalNode.parent;
        if (ts.isParenthesizedExpression(parent)) {
            return false;
        };
        const replacementAST = AstTreeUtils.getASTNode('temp.ts', replacement);
        const replacementExpr = (replacementAST.statements[0] as ts.ExpressionStatement)?.expression;
        if (!replacementExpr) {
            return false;
        };
        const replacementPrecedence = this.getPrecedence(replacementExpr);
        const contextPrecedence = this.getContextualPrecedence(originalNode);
        return replacementPrecedence < contextPrecedence;
    }

    private getPrecedence(node: ts.Node): number {
        if (ts.isConditionalExpression(node)) {
            return 4; // 三元运算符优先级设为 4（与 ESLint 一致）
        };
        // ESLint优先级映射表转换
        if (ts.isBinaryExpression(node)) {
            switch (node.operatorToken.kind) {
                case ts.SyntaxKind.EqualsToken:
                case ts.SyntaxKind.PlusEqualsToken:
                case ts.SyntaxKind.MinusEqualsToken:
                    return 1;
                case ts.SyntaxKind.BarBarToken:
                    return 2;
                case ts.SyntaxKind.AmpersandAmpersandToken:
                    return 3;
                case ts.SyntaxKind.EqualsEqualsToken:
                case ts.SyntaxKind.ExclamationEqualsToken:
                case ts.SyntaxKind.EqualsEqualsEqualsToken:
                case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                    return 7;
                case ts.SyntaxKind.LessThanToken:
                case ts.SyntaxKind.GreaterThanToken:
                case ts.SyntaxKind.LessThanEqualsToken:
                case ts.SyntaxKind.GreaterThanEqualsToken:
                    return 8;
                case ts.SyntaxKind.PlusToken:
                case ts.SyntaxKind.MinusToken:
                    return 10;
                case ts.SyntaxKind.AsteriskToken:
                    return 11;
                case ts.SyntaxKind.AsteriskAsteriskToken:
                    return 14; // 幂运算符优先级最高之一
            };
        };
        if (ts.isPrefixUnaryExpression(node)) {
            return 15;
        };
        return 20; // 最高优先级
    };

    // 上下文优先级判断
    private getContextualPrecedence(node: ts.Node): number {
        let parent = node.parent;
        while (parent && ts.isParenthesizedExpression(parent)) {
            parent = parent.parent;
        };
        if (!parent) {
            return 0;
        };
        if (ts.isBinaryExpression(parent)) {
            return this.getPrecedence(parent);
        };
        if (ts.isPrefixUnaryExpression(parent)) {
            return this.getPrecedence(parent);
        };
        if (ts.isConditionalExpression(parent)) {
            return 4; // 条件运算符的优先级
        };
        return 0;
    };

    private createFix(start: number, end: number, code: string): RuleFix {
        return { range: [start, end], text: code };
    };

    private addIssueReport(issue: Issue, ruleFix?: RuleFix): void {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defects = new Defects(issue.line, issue.column, issue.columnEnd, this.metaData.description, severity, this.rule.ruleId, issue.filePath,
            this.metaData.ruleDocPath, true, false, (ruleFix !== undefined ? true : false));
        this.issues.push(new IssueReport(defects, ruleFix));
        RuleListUtil.push(defects);
    };
}