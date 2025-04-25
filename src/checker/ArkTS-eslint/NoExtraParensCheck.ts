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


import { ts, ArkFile, AstTreeUtils } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects, IssueReport } from '../../model/Defects';
import { ClassMatcher, FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher } from "../../matcher/Matchers";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { RuleFix } from "../../model/Fix";

interface OptionObject {
    conditionalAssign?: boolean,
    returnAssign?: boolean,
    nestedBinaryExpressions?: boolean,
    ternaryOperandBinaryExpressions?: boolean,
    ignoreJSX?: 'none' | 'all' | 'multi-line' | 'single-line',
    enforceForArrowConditionals?: boolean,
    enforceForSequenceExpressions?: boolean,
    enforceForNewInMemberExpressions?: boolean,
    enforceForFunctionPrototypeMethods?: boolean,
    allowParensAfterCommentPattern?: 'any-string-pattern' | '@type'
};

type OptionKey = 'all' | 'functions';

type OptionsTuple = [OptionKey?, OptionObject?];

const defaultOptions: OptionsTuple = [
    'all',
    {
        conditionalAssign: true,
        returnAssign: true,
        nestedBinaryExpressions: true,
        ternaryOperandBinaryExpressions: true,
        ignoreJSX: 'none',
        enforceForArrowConditionals: true,
        enforceForSequenceExpressions: true,
        enforceForNewInMemberExpressions: true,
        enforceForFunctionPrototypeMethods: true,
        allowParensAfterCommentPattern: 'any-string-pattern'
    }
];

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoExtraParensCheck');

const gmetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-extra-parens-check.md", // TODO: support url
    description: "Unnecessary parentheses around expression."
};

type ExtraParensInfo = {
    line: number;
    col: number;
    type: string;
};

const precedenceMap: { [key in ts.SyntaxKind]?: number } = {
    [56]: 3, // ||
    [55]: 4, // &&
    [51]: 5, // |
    [52]: 6, // ^
    [50]: 7, // &
    [34]: 8, // ==
    [35]: 8, // !=
    [36]: 8, // ===
    [37]: 8, // !==
    [29]: 9, // <
    [31]: 9, // >
    [32]: 9, // <=
    [33]: 9, // >=
    [103]: 9, // instanceof
    [102]: 9, // in
    [47]: 10, // <<
    [48]: 10, // >>
    [49]: 10, // >>>
    [39]: 11, // +
    [40]: 11, // -
    [41]: 12, // *
    [43]: 12, // /
    [44]: 12, // %
    [42]: 13, // **
};

const leftAssociative = new Set<ts.SyntaxKind>([
    56,
    55,
    51,
    52,
    50,
    34,
    35,
    36,
    37,
    29,
    31,
    32,
    33,
    103,
    102,
    47,
    48,
    49,
    39,
    40,
    41,
    43,
    44,
]);

// 新增：判断是否为赋值运算符的辅助函数
const assignmentOperators = new Set<ts.SyntaxKind>([
    63,
    64,
    65,
    66,
    67,
    68,
    69,
    70,
    71,
    72,
    73,
    74,
    78
]);


export class NoExtraParensCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gmetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public sourceFile: ts.SourceFile;
    public filePath: string;
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private classMatcher: ClassMatcher = {
        file: [this.fileMatcher],
        matcherType: MatcherTypes.CLASS
    };
    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.classMatcher]
    };
    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    }
    public check = (file: ArkFile) => {
        let options: OptionsTuple;
        if (this.rule && this.rule.option.length > 0) {
            options = this.rule.option as OptionsTuple;
        } else {
            options = defaultOptions;
        }
        this.sourceFile = AstTreeUtils.getSourceFileFromArkFile(file);
        this.filePath = file.getFilePath();
        this.checkUnnecessaryParentheses(this.sourceFile);
    }


    private getPrecedence(kind: ts.SyntaxKind): number {
        return precedenceMap[kind] || 0;
    }

    private isLeftAssociative(kind: ts.SyntaxKind): boolean {
        return leftAssociative.has(kind);
    }

    private checkUnnecessaryParentheses(sourceFile: ts.SourceFile): void {
        this.visit(sourceFile);
    }

    private visit(node: ts.Node): void {
        if (ts.isParenthesizedExpression(node)) {
            const type = this.detectExtraParensType(node, this.sourceFile);
            if (type) {
                const start = node.getStart(this.sourceFile);
                const end = node.getEnd();
                const fixText = node.expression.getText();
                const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
                const diagnostic: ExtraParensInfo = {
                    line: line + 1,
                    col: character + 1,
                    type: type,
                };
                this.addIssueReport(diagnostic, start, end, fixText);
            }
        }
        ts.forEachChild(node, child =>
            this.visit(child)
        );
    }

    private detectExtraParensType(node: ts.ParenthesizedExpression, sourceFile: ts.SourceFile): string | undefined {
        if (this.isConditionalAssign(node)) {
            return 'conditionalAssign';
        }
        if (this.isReturnAssign(node)) {
            return 'returnAssign';
        }
        if (this.isNestedBinaryExpressions(node, sourceFile)) {
            return 'nestedBinaryExpressions';
        }
        if (this.isTernaryOperandBinaryExpressions(node)) {
            return 'ternaryOperandBinaryExpressions';
        }
        if (this.isJSXMultiLine(node, sourceFile)) {
            return 'ignoreJSX-multi-line';
        }
        if (this.isJSXSingleLine(node, sourceFile)) {
            return 'ignoreJSX-single-line';
        }
        if (this.isEnforceForArrowConditionals(node)) {
            return 'enforceForArrowConditionals';
        }
        if (this.isEnforceForSequenceExpressions(node)) {
            return 'enforceForSequenceExpressions';
        }
        if (this.isEnforceForNewInMemberExpressions(node)) {
            return 'enforceForNewInMemberExpressions';
        }
        if (this.isEnforceForFunctionPrototypeMethods(node)) {
            return 'enforceForFunctionPrototypeMethods';
        }
        if (this.isAllowParensAfterCommentPattern(node, sourceFile)) {
            return 'allowParensAfterCommentPattern';
        }
        if (this.isRedundantIIFEWrapping(node)) {
            return 'function';
        }
        return undefined;
    }

    private isRedundantIIFEWrapping(node: ts.ParenthesizedExpression): boolean {
        return this.checkDoubleWrappedCall(node) ||
            this.checkTripleWrappedFunction(node);
    }

    // 检测双重包裹的调用表达式 ((...))
    private checkDoubleWrappedCall(node: ts.ParenthesizedExpression): boolean {
        if (!ts.isCallExpression(node.parent)) {
            return false;
        }

        const expr = node.expression;
        return ts.isCallExpression(expr) &&
            this.isWrappedFunction(expr.expression);
    }


    // 检测三层包裹的函数表达式 (((...)))
    private checkTripleWrappedFunction(node: ts.ParenthesizedExpression): boolean {
        const expr = node.expression;
        const parent = node.parent;
        const parentText = parent.getText();
        const nodeText = node.getText();
        const expressionText = expr.getText();
        const split = parentText.split(nodeText);
        if (this.checkTripleWrappedFunction1(parent, node, parentText, nodeText, expressionText)) {
            return true;
        }
        if (ts.isClassExpression(expr) && ts.isNewExpression(parent)) {
            return true;
        }
        if (this.checkTripleWrappedFunction2(expr, parent)) {
            return true;
        }
        if (this.checkTripleWrappedFunction3(expr, parent, parentText, nodeText)) {
            return true;
        }
        if (this.checkTripleWrappedFunction4(expr, parent, split)) {
            return true;
        }
        if (this.checkTripleWrappedFunction5(expr, parent, split)) {
            return true;
        }
        if (ts.isArrowFunction(expr) && ts.isParenthesizedExpression(node) && ts.isConditionalExpression(parent)) {
            if (parent.whenTrue === node || parent.whenFalse === node) {
                return true;
            }
            return false;
        }
        if (this.checkTripleWrappedFunction6(expr, node, parent, split)) {
            return true;
        }
        if (this.checkTripleWrappedFunction7(node, parent, expr)) {
            return true;
        }
        if (!ts.isParenthesizedExpression(expr)) {
            return false;
        }
        const innerExpr = expr.expression;
        return ts.isCallExpression(innerExpr) &&
            this.isWrappedFunction(innerExpr.expression);
    }

    private checkTripleWrappedFunction7(node: ts.ParenthesizedExpression, parent: ts.Node, expr: ts.Expression): boolean {
        return ts.isParenthesizedExpression(node) && ts.isNewExpression(parent) && ts.isFunctionExpression(expr);
    }

    private checkTripleWrappedFunction6(expr: ts.Expression, node: ts.ParenthesizedExpression, parent: ts.Node, split: string[]): boolean {
        return ts.isArrowFunction(expr) && ts.isParenthesizedExpression(node) &&
            ts.isCallExpression(parent) && split[0].trim().endsWith('(') && split[1].trim().startsWith(')');
    }

    private checkTripleWrappedFunction5(expr: ts.Expression, parent: ts.Node, split: string[]): boolean {
        return ts.isFunctionExpression(expr) && ts.isCallExpression(parent) && split[0].trim().endsWith('(') && split[1].trim().startsWith(')');
    }

    private checkTripleWrappedFunction4(expr: ts.Expression, parent: ts.Node, split: string[]): boolean {
        return ts.isFunctionExpression(expr) && ts.isElementAccessExpression(parent) &&
            split[0].trim().endsWith('[') && split[1].trim().startsWith(']');
    }

    private checkTripleWrappedFunction3(expr: ts.Expression, parent: ts.Node, parentText: string, nodeText: string): boolean {
        return ts.isFunctionExpression(expr) && ts.isVariableDeclaration(parent) &&
            parentText.endsWith(nodeText) && parentText.substring(0, parentText.length - nodeText.length).trim().endsWith('=');
    }

    private checkTripleWrappedFunction2(expr: ts.Expression, parent: ts.Node): boolean {
        return ts.isAwaitExpression(expr) && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken;
    }

    private checkTripleWrappedFunction1(parent: ts.Node,
        node: ts.ParenthesizedExpression, parentText: string, nodeText: string, expressionText: string): boolean {
        return ts.isExpressionStatement(parent) && ts.isParenthesizedExpression(node) &&
            parentText.startsWith(nodeText) && parentText.substring(nodeText.length).trim() === ';' &&
            !expressionText.startsWith('function') && !expressionText.startsWith('{');
    }

    private isWrappedFunction(expr: ts.Expression): boolean {
        return ts.isParenthesizedExpression(expr) &&
            (ts.isArrowFunction(expr.expression) ||
                ts.isFunctionExpression(expr.expression));
    }


    private isAssignmentExpression(node: ts.Node): node is ts.BinaryExpression {
        return ts.isBinaryExpression(node) &&
            assignmentOperators.has(node.operatorToken.kind);
    }

    private isConditionExpression(node: ts.Node): node is ts.BinaryExpression {
        return ts.isConditionalExpression(node) && ts.isParenthesizedExpression(node.parent);
    }

    // 修改后的条件判断函数
    private isConditionalAssign(node: ts.ParenthesizedExpression): boolean {
        const parent = node.parent;
        const expression = node.expression;
        const parentText = parent.getText();
        const nodeText = node.getText();
        const expressionText = expression.getText();
        const split = parentText.split(nodeText);
        const isCondition = ts.isIfStatement(parent) ||
            ts.isWhileStatement(parent) ||
            ts.isDoStatement(parent) ||
            (ts.isForStatement(parent) && parent.condition === node);
        if (this.isConditionalAssign1(isCondition, expression, node, split)) {
            return true;
        }

        if (this.isConditionalAssign2(parent, expression, split)) {
            return true;
        }

        if (ts.isCaseClause(parent) && ts.isPropertyAccessExpression(expression)) {
            return true;
        }

        // 替换为新的判断方式
        return isCondition && (this.isAssignmentExpression(node.expression) || this.isConditionExpression(node.expression));
    }

    private isConditionalAssign2(parent: ts.Node, expression: ts.Expression, split: string[]): boolean {
        return (ts.isIfStatement(parent) || ts.isWhileStatement(parent)) &&
            ts.isBinaryExpression(expression) && split[0].trim().endsWith('(') && split[1].trim().startsWith(')');
    }

    private isConditionalAssign1(isCondition: boolean, expression: ts.Expression, node: ts.ParenthesizedExpression, split: string[]): boolean {
        return isCondition && ts.isBinaryExpression(expression) &&
            ts.isParenthesizedExpression(node) &&
            ts.SyntaxKind.QuestionQuestionToken === expression.operatorToken.kind &&
            split[0].trim().endsWith('(') && split[1].trim().startsWith(')');
    }

    private isReturnAssign(node: ts.ParenthesizedExpression): boolean {
        const parent = node.parent;
        return (ts.isReturnStatement(parent) || ts.isArrowFunction(parent)) &&
            this.isAssignmentExpression(node.expression);
    }

    private isNestedBinaryExpressions(node: ts.ParenthesizedExpression, sourceFile: ts.SourceFile): boolean {
        const parent = node.parent;
        const expression = node.expression;
        const parentText = parent.getText();
        const nodeText = node.getText();
        const split = parentText.split(nodeText);
        const str = parentText.substring(nodeText.length).trim();
        if (this.isNestedBinaryExpressions1(parent, expression, split) ||
            this.isNestedBinaryExpressions2(expression, parent) ||
            this.isNestedBinaryExpressions3(node, expression, parent, parentText, nodeText) ||
            this.isNestedBinaryExpressions4(parent, node, expression, parentText, nodeText) ||
            this.isNestedBinaryExpressions5(parent, node, expression, parentText, nodeText) ||
            this.isNestedBinaryExpressions6(parent, node, expression) ||
            (ts.isBinaryExpression(expression) &&
                this.isNestedBinaryExpressions12(expression, node, parent) &&
                (this.isNestedBinaryExpressions9(parentText, nodeText, expression) || this.isNestedBinaryExpressions10(parentText, nodeText, expression)))) {
            return true;
        }
        if (this.isNestedBinaryExpressions7(expression, node, parent)) {
            return !(this.isNestedBinaryExpressions8(parentText, nodeText) || (ts.isNumericLiteral(expression) && ts.isPropertyAccessExpression(parent)));
        }
        if (this.isNestedBinaryExpressions11(expression, node, parent, parentText, nodeText, str)) {
            return false;
        }
        if (!ts.isBinaryExpression(parent)) {
            return false;
        }
        if (!ts.isBinaryExpression(expression)) {
            return false;
        }
        const parentPrecedence = this.getPrecedence(parent.operatorToken.kind);
        const innerPrecedence = this.getPrecedence(expression.operatorToken.kind);
        if (innerPrecedence > parentPrecedence) {
            return true;
        }
        if (innerPrecedence === parentPrecedence && this.isLeftAssociative(parent.operatorToken.kind) && parent.left === node) {
            return true;
        }
        return false;
    }

    private isNestedBinaryExpressions12(expression: ts.Expression, node: ts.ParenthesizedExpression, parent: ts.Node): boolean {
        return ts.isBinaryExpression(expression) && ts.isParenthesizedExpression(node) &&
            (ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent));
    }

    private isNestedBinaryExpressions11(expression: ts.Expression, node: ts.ParenthesizedExpression,
        parent: ts.Node, parentText: string, nodeText: string, str: string): boolean {
        return ts.isBinaryExpression(expression) && ts.isParenthesizedExpression(node) &&
            ts.isBinaryExpression(parent) && parentText.startsWith(nodeText) && str.startsWith('=') && !str.startsWith('==');
    }

    private isNestedBinaryExpressions10(parentText: string, nodeText: string, expression: ts.BinaryExpression): boolean {
        return parentText.endsWith(nodeText + ';') &&
            parentText.substring(0, parentText.length - nodeText.length - 1).trim().endsWith('=') &&
            (expression.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
                expression.operatorToken.kind === ts.SyntaxKind.AsteriskToken ||
                expression.operatorToken.kind === ts.SyntaxKind.PlusToken);
    }

    private isNestedBinaryExpressions9(parentText: string, nodeText: string, expression: ts.BinaryExpression): boolean {
        return parentText.endsWith(nodeText) &&
            parentText.substring(0, parentText.length - nodeText.length).trim().endsWith('=') &&
            (expression.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
                expression.operatorToken.kind === ts.SyntaxKind.AsteriskToken ||
                expression.operatorToken.kind === ts.SyntaxKind.PlusToken);
    }

    private isNestedBinaryExpressions8(parentText: string, nodeText: string): boolean {
        return parentText.startsWith(nodeText) && parentText.substring(nodeText.length).trim().startsWith('!');
    }

    private isNestedBinaryExpressions7(expression: ts.Expression, node: ts.ParenthesizedExpression, parent: ts.Node): boolean {
        return (ts.isNumericLiteral(expression) || ts.isIdentifier(expression)) &&
            ts.isParenthesizedExpression(node) && !ts.isTaggedTemplateExpression(parent);
    }

    private isNestedBinaryExpressions6(parent: ts.Node, node: ts.ParenthesizedExpression, expression: ts.Expression): boolean {
        return ts.isParenthesizedExpression(parent) && ts.isParenthesizedExpression(node) && ts.isArrowFunction(expression);
    }

    private isNestedBinaryExpressions5(parent: ts.Node, node: ts.ParenthesizedExpression,
        expression: ts.Expression, parentText: string, nodeText: string): boolean {
        return ts.isBinaryExpression(parent) && ts.isParenthesizedExpression(node) &&
            ts.isAwaitExpression(expression) && parentText.startsWith(nodeText) && parentText.substring(nodeText.length).trim().startsWith('??');
    }

    private isNestedBinaryExpressions4(parent: ts.Node, node: ts.ParenthesizedExpression,
        expression: ts.Expression, parentText: string, nodeText: string): boolean {
        return ts.isBinaryExpression(parent) && ts.isParenthesizedExpression(node) &&
            ts.isBinaryExpression(expression) && parentText.endsWith(nodeText) && parentText.substring(0, parentText.length - nodeText.length).trim().endsWith('=');
    }

    private isNestedBinaryExpressions3(node: ts.ParenthesizedExpression,
        expression: ts.Expression, parent: ts.Node, parentText: string, nodeText: string): boolean {
        return ts.isParenthesizedExpression(node) && ts.isPropertyAccessExpression(expression) &&
            ts.isCallExpression(parent) && parentText.startsWith(nodeText) && parentText.substring(nodeText.length).trim().startsWith('?');
    }

    private isNestedBinaryExpressions2(expression: ts.Expression, parent: ts.Node): boolean {
        return ts.isBinaryExpression(expression) && ts.isBinaryExpression(parent) &&
            expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            parent.operatorToken.kind === ts.SyntaxKind.CommaToken;
    }

    private isNestedBinaryExpressions1(parent: ts.Node, expression: ts.Expression, split: string[]): boolean {
        return ts.isParenthesizedExpression(parent) && !ts.isParenthesizedExpression(expression) &&
            split[0].trim().endsWith('(') && split[1].trim().startsWith(')');
    }

    private isTernaryOperandBinaryExpressions(node: ts.ParenthesizedExpression): boolean {
        const parent = node.parent;
        const expr = node.expression;
        if (ts.isAwaitExpression(expr) && ts.isParenthesizedExpression(node) &&
            ts.isConditionalExpression(parent) && parent.condition === node) {
            return true;
        }
        return ts.isConditionalExpression(parent) &&
            (parent.condition === node || parent.whenTrue === node || parent.whenFalse === node) &&
            ts.isBinaryExpression(node.expression);
    }

    private isJSXMultiLine(node: ts.ParenthesizedExpression, sourceFile: ts.SourceFile): boolean {
        const inner = node.expression;
        if (!ts.isJsxElement(inner) && !ts.isJsxFragment(inner)) {
            return false;
        }
        const start = ts.getLineAndCharacterOfPosition(sourceFile, inner.getStart());
        const end = ts.getLineAndCharacterOfPosition(sourceFile, inner.getEnd());
        return start.line === end.line;
    }

    private isJSXSingleLine(node: ts.ParenthesizedExpression, sourceFile: ts.SourceFile): boolean {
        const inner = node.expression;
        if (!ts.isJsxElement(inner) && !ts.isJsxFragment(inner)) {
            return false;
        }
        const start = ts.getLineAndCharacterOfPosition(sourceFile, inner.getStart());
        const end = ts.getLineAndCharacterOfPosition(sourceFile, inner.getEnd());
        return start.line !== end.line;
    }

    private isEnforceForArrowConditionals(node: ts.ParenthesizedExpression): boolean {
        const parent = node.parent;
        return ts.isArrowFunction(parent) && parent.body === node &&
            ts.isConditionalExpression(node.expression);
    }

    private isEnforceForSequenceExpressions(node: ts.ParenthesizedExpression): boolean {
        if (ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.CommaToken &&
            ts.isForOfStatement(node.parent)) {
            return false;
        }
        return this.isCommaExpression(node.expression);
    }

    private isCommaExpression(expr: ts.Expression): boolean {
        if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            if (ts.isParenthesizedExpression(expr.parent) && (ts.isPropertyAccessExpression(expr.parent.parent) ||
                ts.isVariableDeclaration(expr.parent.parent))) {
                return false;
            }
            return true;
        }
        if (ts.isParenthesizedExpression(expr)) {
            return this.isCommaExpression(expr.expression);
        }
        return false;
    }

    private isEnforceForNewInMemberExpressions(node: ts.ParenthesizedExpression): boolean {
        const parent = node.parent;
        return (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
            ts.isNewExpression(node.expression);
    }

    private isEnforceForFunctionPrototypeMethods(node: ts.ParenthesizedExpression): boolean {
        const parent = node.parent;
        return (ts.isPropertyAccessExpression(parent) && (parent.name.text === 'call' || parent.name.text === 'apply')) &&
            (ts.isFunctionExpression(node.expression) || ts.isArrowFunction(node.expression));
    }

    private isAllowParensAfterCommentPattern(node: ts.ParenthesizedExpression, sourceFile: ts.SourceFile): boolean {
        const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
        if (!commentRanges) {
            return false;
        }
        const pattern = /@type\s+\{.*?\}/;
        return commentRanges.some(range =>
            pattern.test(sourceFile.text.substring(range.pos, range.end)));
    }

    private addIssueReport(pos: ExtraParensInfo, start: number, end: number, fixText: string): void {
        const description = `Unnecessary parentheses around expression.`;
        const ruleFix: RuleFix = { range: [start, end], text: fixText };
        const defect = new Defects(
            pos.line,
            pos.col,
            pos.line,
            description,
            this.rule.alert ?? this.metaData.severity,
            this.rule.ruleId,
            this.filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            true
        );
        this.issues.push(new IssueReport(defect, ruleFix));
        RuleListUtil.push(defect);
    }


}