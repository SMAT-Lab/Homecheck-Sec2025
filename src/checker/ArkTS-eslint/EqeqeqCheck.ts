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
    filePath: string;
    fixCode: string;
}

type stringOpt = 'always' | 'smart' | 'allow-null';
type stringOpt1 = 'always' | 'never' | 'ignore';
type Options = [
    stringOpt,
    {
        null: stringOpt1
    }
]

interface EqeqeqOptions {
    mode?: 'always' | 'smart' | 'allow-null';
    null?: 'always' | 'never' | 'ignore';
}

type InferredType =
    'string' | 'number' | 'boolean' | 'object' | 'Object' |
    'null' | 'undefined' | 'regexp' | 'typeof' | 'unknown' | 'let-uninit';

// 根据 ESLint 的 JavaScript 实现：
// mode: 默认值为 'always'。
// null: 当 mode 是 'always' 时，默认值为 'always'。
// 当 mode 是 'smart' 时，null 的值被忽略（因为 'smart' 模式下会自动处理 null）。
export class EqeqeqCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/eqeqeq.md',
        description: 'Require the use of === and !==.'
    };
    //默认
    private defaultOptions: Options = [
        'always', // 默认值
        {
            null: 'always', // 默认值
        }
    ];
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private letDeclarations: ts.VariableDeclaration[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };
    private config: EqeqeqOptions = {
        mode: 'always', // 默认值
        null: 'always' // 默认值
    };
    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    }

    public check = (target: ArkFile) => {
        this.parseConfig();
        if (target instanceof ArkFile) {
            let code = target.getCode();
            this.checkEqeqeq(code, target);
        }
    }

    private parseConfig(): void {
        this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
        this.config.mode = this.defaultOptions[0];
        this.config.null = this.defaultOptions[1]?.null;
        if (this.config.mode === 'allow-null') {
            this.config.mode = 'always';
            this.config.null = 'ignore';
            return;
        }
        // 确保 null 的默认值与 ESLint 一致
        if (this.config.mode === 'always' &&
            this.config.null === undefined) {
            this.config.null = 'always';
        }
    }

    private isBooleanLiteral = (node: ts.Node): boolean => {
        return node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
    };

    private getLiteralValue = (node: ts.Node): string | number | boolean | null => {
        switch (node.kind) {
            case ts.SyntaxKind.StringLiteral:
                return (node as ts.StringLiteral).text; // 确保访问的是 StringLiteral 类型
            case ts.SyntaxKind.NumericLiteral:
                return parseFloat((node as ts.NumericLiteral).text); // 确保访问的是 NumericLiteral 类型
            case ts.SyntaxKind.TrueKeyword:
                return true; // 布尔字面量 true
            case ts.SyntaxKind.FalseKeyword:
                return false; // 布尔字面量 false
            case ts.SyntaxKind.NullKeyword:
                return null; // null 字面量
            default:
                return null; // null 字面量;
        }
    };

    private isTypeOfBinary = (node: ts.BinaryExpression): boolean => {
        const isTypeOf = (node: ts.Node): boolean => {
            return ts.isTypeOfExpression(node);
        };
        return isTypeOf(node.left) || isTypeOf(node.right);
    };

    private isNullCheck = (node: ts.BinaryExpression): boolean => {
        const isNullUndefined = (n: ts.Node): boolean => {
            return n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.UndefinedKeyword;
        };
        return isNullUndefined(node.left) || isNullUndefined(node.right);
    };

    private areLiteralsAndSameType = (node: ts.BinaryExpression): boolean => {
        const isLeftLiteral = ts.isLiteralExpression(node.left) || this.isBooleanLiteral(node.left);
        const isRightLiteral = ts.isLiteralExpression(node.right) || this.isBooleanLiteral(node.right);
        if (!isLeftLiteral || !isRightLiteral) {
            return false; // 不是字面量，直接返回 false
        }
        // 获取字面量的值
        const leftValue = this.getLiteralValue(node.left);
        const rightValue = this.getLiteralValue(node.right);
        // 检查是否为相同类型的字面量
        return typeof leftValue === typeof rightValue;
    };

    private inferType = (node: ts.Node): InferredType => {
        // 新增处理括号表达式
        if (ts.isParenthesizedExpression(node)) {
            return this.inferType(node.expression);
        };
        if (ts.isTypeOfExpression(node)) {
            return 'typeof';
        };
        if (ts.isStringLiteral(node)) {
            return 'string';
        };
        if (ts.isIdentifier(node) && node.getText() === 'Object') {
            return 'Object';
        };
        if (ts.isIdentifier(node) && (this.isUninitializedLetVariable(node) || this.isUninitializedLetVariable(node))) {
            return 'let-uninit';
        };
        if (ts.isNumericLiteral(node)) {
            return 'number';
        };
        if (node.kind === ts.SyntaxKind.TrueKeyword ||
            node.kind === ts.SyntaxKind.FalseKeyword) {
            return 'boolean';
        };
        if (node.kind === ts.SyntaxKind.NullKeyword) {
            return 'null';
        };
        if (ts.isIdentifier(node) && node.text === 'undefined' ||
            (ts.isVoidExpression(node) && node.expression.kind === ts.SyntaxKind.NumericLiteral)) {
            return 'undefined';
        };
        return 'unknown';
    };
    private isSameType = (left: ts.Node, right: ts.Node): boolean => {
        const leftType = this.inferType(left);
        const rightType = this.inferType(right);
        // 处理 null 和 undefined 的互斥情况
        if ((leftType === 'null' && rightType === 'undefined') ||
            (leftType === 'undefined' && rightType === 'null')) {
            return false;
        };
        if ((leftType === 'typeof' && (rightType === 'string' || rightType === 'let-uninit' || rightType === 'Object' || rightType === 'number')) ||
            (rightType === 'typeof' && (leftType === 'string' || leftType === 'let-uninit'))
        ) {
            return true;
        };
        if (leftType === 'undefined' && rightType === 'typeof') {
            return true;
        };
        return leftType === rightType && leftType !== 'unknown';
    };

    private getOperatorRange = (node: ts.BinaryExpression, sourceFile: ts.SourceFile): [number, number] => {
        const operatorPos = node.operatorToken.getStart(sourceFile);
        return [
            operatorPos,
            operatorPos + (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ? 2 : 2),
        ];
    };

    private isPropertyAccessWithNullUndefined(node: ts.BinaryExpression): boolean {
        // 递归检查左侧是否包含属性访问
        const checkLeft = (n: ts.Node): boolean => {
            if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
                return true;
            }
            if (ts.isParenthesizedExpression(n)) {
                return checkLeft(n.expression);
            }
            if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
                return checkLeft(n.right);
            }
            return false;
        };
        const hasPropertyAccess = checkLeft(node.left);
        const isRightNullUndefined =
            node.right.kind === ts.SyntaxKind.NullKeyword ||
            this.isUndefinedIdentifier(node.right);
        return hasPropertyAccess && isRightNullUndefined;
    };

    private isUndefinedIdentifier(node: ts.Node): boolean {
        // 处理标识符形式的 undefined
        if (ts.isIdentifier(node) && node.text === 'undefined') {
            return true;
        };
        // 处理 void 0 形式的 undefined
        if (ts.isVoidExpression(node) && node.expression.kind === ts.SyntaxKind.NumericLiteral &&
            (node.expression as ts.NumericLiteral).text === '0') {
            return true;
        };
        return false;
    };

    private isComplexPropertyAccessCheck(node: ts.BinaryExpression): boolean {
        const isNullOrUndefined = (n: ts.Node): boolean => {
            return n.kind === ts.SyntaxKind.NullKeyword ||
                n.kind === ts.SyntaxKind.UndefinedKeyword ||
                this.isUndefinedIdentifier(n);
        };
        // 检查是否为属性访问表达式
        const isPropertyAccess = (n: ts.Node): boolean => {
            if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
                return true;
            };
            // 处理括号表达式
            if (ts.isParenthesizedExpression(n)) {
                return isPropertyAccess(n.expression);
            };
            return false;
        };
        // 检查是否为链式属性访问与 null/undefined 比较
        return (isPropertyAccess(node.left) && isNullOrUndefined(node.right)) ||
            (isPropertyAccess(node.right) && isNullOrUndefined(node.left));
    };

    // 优先处理属性访问的特殊情况
    private checkSpecialCases = (node: ts.Node, code: string, arkFile: ArkFile, methodAst: ts.SourceFile): boolean => {
        if (ts.isBinaryExpression(node)) {
            // 处理链式与运算中的相等性检查
            if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
                // 递归检查左右两侧的表达式
                return this.checkSpecialCases(node.left, code, arkFile, methodAst) || this.checkSpecialCases(node.right, code, arkFile, methodAst);
            };
            // 检查是否为相等性检查操作符
            const isEqualityOperator =
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
            if (isEqualityOperator) {
                // 检查是否为属性访问与 null/undefined 的比较
                if (this.checkPropertyAccessWithNullUndefined(node, code, arkFile, methodAst)) {
                    return true;
                }
                // 检查是否为复杂的链式属性访问
                return this.checkComplexPropertyAccess(node, code, arkFile, methodAst);
            };
        };
        return false;
    };

    private checkPropertyAccessWithNullUndefined(node: ts.BinaryExpression, code: string, arkFile: ArkFile, methodAst: ts.SourceFile): boolean {
        if (this.isPropertyAccessWithNullUndefined(node)) {
            const operator = node.operatorToken.kind;
            const expected = this.config.null === 'always' ? '!==' : '!=';
            // 根据配置判断
            if (
                (this.config.null === 'always' && operator !== ts.SyntaxKind.ExclamationEqualsEqualsToken) ||
                (this.config.null === 'never' && operator !== ts.SyntaxKind.ExclamationEqualsToken)
            ) {
                this.createIssue(code, expected, node, methodAst, arkFile);
            }
            return true;
        };
        return false;
    };

    private checkComplexPropertyAccess(node: ts.BinaryExpression, code: string, arkFile: ArkFile, methodAst: ts.SourceFile): boolean {
        const isComplexPropertyAccess = this.isComplexPropertyAccessCheck(node);
        if (isComplexPropertyAccess) {
            const operator = node.operatorToken.kind;
            const expected = this.config.null === 'always' ?
                (operator === ts.SyntaxKind.EqualsEqualsToken ? '===' : '!==') :
                (operator === ts.SyntaxKind.EqualsEqualsToken ? '==' : '!=');
            if ((this.config.null === 'always' &&
                (operator === ts.SyntaxKind.EqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsToken)) ||
                (this.config.null === 'never' &&
                    (operator === ts.SyntaxKind.EqualsEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsEqualsToken))) {
                this.createIssue(code, expected, node, methodAst, arkFile);
            };
            return true;
        };
        return false;
    };

    private shouldSkipCheck = (
        isEqualityCheck: boolean,
        isNull: boolean,
        enforceInverseRuleForNull: boolean,
        operator: ts.SyntaxKind
    ): boolean => {
        return (
            (!isEqualityCheck && !enforceInverseRuleForNull) ||
            (isNull && enforceInverseRuleForNull && isEqualityCheck) ||
            (!isNull && enforceInverseRuleForNull && operator === ts.SyntaxKind.EqualsEqualsEqualsToken)
        );
    };

    private isSmartMode = (node: ts.BinaryExpression, isNull: boolean): boolean => {
        return (
            this.config.mode === 'smart' &&
            (this.isTypeOfBinary(node) || this.areLiteralsAndSameType(node) || isNull)
        );
    };

    private shouldHandleNullCase = (
        isNull: boolean,
        enforceInverseRuleForNull: boolean,
    ): boolean => {
        return enforceInverseRuleForNull && isNull;
    };

    private isEqualityCheck = (operator: ts.SyntaxKind): boolean => {
        return (
            operator === ts.SyntaxKind.EqualsEqualsToken ||
            operator === ts.SyntaxKind.ExclamationEqualsToken
        );
    };

    private getExpectedOperator = (operator: ts.SyntaxKind): string => {
        return operator === ts.SyntaxKind.EqualsEqualsToken ? '===' : '!==';
    };

    private getAllLetDeclarations(methodAst: ts.SourceFile): ts.VariableDeclaration[] {
        const letDeclarations: ts.VariableDeclaration[] = [];
        const visitNode = (node: ts.Node): void => {
            if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.Let)) {
                node.declarations.forEach(declaration => {
                    letDeclarations.push(declaration);
                });
            };
            ts.forEachChild(node, visitNode);
        };
        visitNode(methodAst);
        return letDeclarations;
    };

    private checkEqeqeq(code: string, arkFile: ArkFile): void {
        const methodAst = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        this.letDeclarations = this.getAllLetDeclarations(methodAst);
        const checkNode = (node: ts.Node): void => {
            const result = this.checkSpecialCases(node, code, arkFile, methodAst);
            if (ts.isBinaryExpression(node) && !result) {
                const operator = node.operatorToken.kind;
                const isEqualityCheck = this.isEqualityCheck(operator);
                const isNull = this.isNullCheck(node);
                const enforceRuleForNull = this.config.null === 'always';
                const enforceInverseRuleForNull = this.config.null === 'never';
                if (this.shouldSkipCheck(isEqualityCheck, isNull, enforceInverseRuleForNull, operator)) {
                    return;
                };
                const expectedOperator = this.getExpectedOperator(operator);
                if (this.isSmartMode(node, isNull)) {
                    return;
                };
                if (this.shouldHandleNullCase(isNull, enforceInverseRuleForNull)) {
                    const isTripleEqual = operator === ts.SyntaxKind.EqualsEqualsEqualsToken;
                    const expectedOperator1 = isTripleEqual ? '==' : '!=';
                    this.createIssue(code, expectedOperator1, node, methodAst, arkFile);
                    return;
                };
                if (!enforceRuleForNull && isNull) {
                    return;
                };
                this.createIssue(code, expectedOperator, node, methodAst, arkFile);
            }
            ts.forEachChild(node, checkNode);
        };
        checkNode(methodAst);
    };

    private createIssue(code: string, expectedOperator: string, node: ts.BinaryExpression, methodAst: ts.SourceFile, arkFile: ArkFile): void {
        const operatorStart = node.operatorToken.getStart(methodAst);
        const operatorLine = methodAst.getLineAndCharacterOfPosition(operatorStart).line;
        const operatorColumn = methodAst.getLineAndCharacterOfPosition(operatorStart).character;
        const [startRange, endRange] = this.getOperatorRange(node, methodAst);
        const fix = code.substring(0, startRange) + expectedOperator + code.substring(endRange);
        const resultIssue: Issue = {
            line: operatorLine + 1,
            column: operatorColumn + 1,
            columnEnd: operatorColumn + 1 + node.operatorToken.getText().length,
            message: `Expected '${expectedOperator}' and instead saw '${node.operatorToken.getText()}'.`,
            filePath: arkFile.getFilePath() ?? '',
            fixCode: expectedOperator
        };
        let ruleFix;
        if (this.isSameType(node.left, node.right)) {
            ruleFix = this.createFix(startRange, endRange, expectedOperator);
        }
        this.addIssueReport(resultIssue, ruleFix);
    };

    private getDeclarationForIdentifier(node: ts.Identifier, letDeclarations: ts.VariableDeclaration[]): ts.VariableDeclaration | null {
        for (const declaration of letDeclarations) {
            if (ts.isIdentifier(declaration.name) && declaration.name.text === node.text) {
                return declaration;
            }
        }
        return null;
    }

    private isUninitializedLetVariable(node: ts.Node): boolean {
        if (ts.isIdentifier(node)) {
            const declaration = this.getDeclarationForIdentifier(node, this.letDeclarations);
            if (declaration) {
                return (
                    ts.isVariableDeclarationList(declaration.parent) &&
                    (declaration.parent.flags & ts.NodeFlags.Let) !== 0 &&
                    declaration.initializer === undefined
                );
            }
        }
        return false;
    }

    private findVariableDeclaration(node: ts.Identifier): ts.VariableDeclaration | null {
        let current: ts.Node | undefined = node;
        while (current) {
            if (ts.isVariableDeclaration(current)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    private createFix(start: number, end: number, code: string): RuleFix {
        return { range: [start, end], text: code };
    };

    private addIssueReport(issue: Issue, ruleFix?: RuleFix) {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defects = new Defects(issue.line, issue.column, issue.columnEnd, this.metaData.description, severity, this.rule.ruleId, issue.filePath,
            this.metaData.ruleDocPath, true, false, (ruleFix != undefined ? true : false));
        this.issues.push(new IssueReport(defects, ruleFix));
        RuleListUtil.push(defects);
    };
}