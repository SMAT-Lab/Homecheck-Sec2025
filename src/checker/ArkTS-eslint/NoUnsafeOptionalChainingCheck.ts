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
import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { Defects, IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnsafeOptionalChainingCheck');

interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
};

interface MessageInfo {
    unsafeOptionalChain: string;
    unsafeArithmetic: string;
};

type Options = [{
    disallowArithmeticOperators: boolean
}];

const UNSAFE_ARITHMETIC_OPERATORS = new Set(['+', '-', '/', '*', '%', '**']);
const UNSAFE_ASSIGNMENT_OPERATORS = new Set(['+=', '-=', '/=', '*=', '%=', '**=']);
const UNSAFE_RELATIONAL_OPERATORS = new Set(['in', 'instanceof']);

export class NoUnsafeOptionalChainingCheck implements BaseChecker {
    public rule: Rule;
    private defaultOptions: Options = [{ disallowArithmeticOperators: false }];
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-unsafe-optional-chaining.md',
        description: 'Disallow use of optional chaining in contexts where the undefined value is not allowed',
    };
    public messages: MessageInfo = {
        unsafeOptionalChain: `Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError`,
        unsafeArithmetic: 'Unsafe arithmetic operation on optional chaining. It can result in NaN'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    private filePath: string = '';
    private message: string = '';

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };

        return [fileMatcherCb];
    };

    public check = (target: ArkFile): void => {
        try {
            this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
            this.filePath = target.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);

            this.visitNode(sourceFile, sourceFile);
        } catch (error) {
            logger.error(`Error occurred while checking file: ${target.getFilePath()}, Error: ${error}`);
        };
    };

    private visitNode(node: ts.Node, sourceFile: ts.SourceFile) {
        // 检查是否是可选链表达式
        if (ts.isOptionalChain(node)) {
            const isUnsafe = this.isUnsafeOptionalChain(node);
            const isUnsafeArithmetic = this.isUnsafeArithmeticOperation(node, node.parent);

            if (isUnsafe || isUnsafeArithmetic) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                this.message = this.getMessage(isUnsafeArithmetic);

                const warnInfo: WarnInfo = {
                    line: line + 1,
                    startCol: character + 1,
                    endCol: character + 1 + node.getText().length,
                };
                const defect = this.addIssueReport(warnInfo);
                const issueReport = new IssueReport(defect, undefined);
                this.issues.push(issueReport);
                RuleListUtil.push(defect);
                this.message = '';
            };
        };
        ts.forEachChild(node, child => this.visitNode(child, sourceFile));
    };

    private getMessage(isUnsafeArithmetic: boolean): string {
        if (this.message) {
            return this.message;
        };
        return isUnsafeArithmetic ? this.messages.unsafeArithmetic : this.messages.unsafeOptionalChain;
    };

    // 检查是否是可选链表达式
    private isUnsafeOptionalChain(node: ts.Node): boolean {
        if (!ts.isOptionalChain(node)) {
            return false;
        };

        let current: ts.Node = node;
        let parent: ts.Node = node.parent;

        // 向上遍历 AST，检查父节点
        while (parent && ts.isParenthesizedExpression(parent)) {
            current = parent;
            parent = parent.parent;
        };

        if (!parent) {
            return false;
        };

        // 检查 for...of 循环
        if (ts.isForOfStatement(parent)) {
            return true;
        };

        // 检查 await 表达式
        if (ts.isAwaitExpression(parent)) {
            return this.isUnsafeAwaitExpression(parent) || this.checkBinaryExpressionUnsafe(parent);
        };

        // 检查不安全的条件表达式
        if (ts.isConditionalExpression(parent) && (parent.whenTrue === current || parent.whenFalse === current)) {
            return this.isUnsafeConditionalExpression(parent);
        };

        // 检查解构赋值
        if (this.isInDestructuring(node)) {
            return true;
        };

        // 检查不安全的使用场景
        return this.isUnsafeGeneralCase(parent, current);
    }

    // 用于检查节点作为二元表达式一部分时的不安全性
    private checkBinaryExpressionUnsafe(node: ts.Node): boolean {
        let current = node;
        let parent = node.parent;

        // 处理括号表达式
        while (parent && ts.isParenthesizedExpression(parent)) {
            current = parent;
            parent = parent.parent;
        };

        if (!parent) {
            return false;
        };

        // 检查三元表达式
        if (ts.isConditionalExpression(parent)) {
            if (parent.whenTrue === current || parent.whenFalse === current) {
                return this.isUnsafeConditionalExpression(parent);
            };
        };

        // 检查二元表达式
        if (ts.isBinaryExpression(parent)) {
            const kind = parent.operatorToken.kind;

            // 如果是 ?? 运算符，只检查右侧的可选链
            if (kind === ts.SyntaxKind.QuestionQuestionToken) {
                // 如果当前节点在左侧，是安全的
                return this.checkQuestionQuestionToken(current, node, parent);
            };

            // 处理其他逻辑运算符
            if (this.isLogicalOperator(parent.operatorToken.kind)) {
                return this.checkParentChainForUnsafeUsage(parent, current);
            };
        };

        return false;
    };

    private checkQuestionQuestionToken(current: ts.Node, node: ts.Node, parent: ts.BinaryExpression): boolean {
        // 如果当前节点在左侧，是安全的
        if (current === parent.left || this.isDescendantOf(node, parent.left)) {
            return false;
        };
        // 如果当前节点在右侧，需要继续检查
        if (current === parent.right || this.isDescendantOf(node, parent.right)) {
            let expressionParent = parent.parent;
            while (expressionParent && ts.isParenthesizedExpression(expressionParent)) {
                expressionParent = expressionParent.parent;
            };
            if ((ts.isCallExpression(expressionParent) && expressionParent.expression === parent.parent &&
                !(expressionParent.flags & ts.NodeFlags.OptionalChain)) ||
                (ts.isPropertyAccessExpression(expressionParent) && expressionParent.expression === parent.parent &&
                    !(expressionParent.flags & ts.NodeFlags.OptionalChain))) {
                return true;
            };
        };
        return false;
    };

    // 递归检查父节点链上的不安全使用
    private checkParentChainForUnsafeUsage(parent: ts.Node, node: ts.Node): boolean {
        let current = parent;
        let parentExpression = parent.parent;

        while (parentExpression) {
            // 处理括号表达式
            while (parentExpression && ts.isParenthesizedExpression(parentExpression)) {
                current = parentExpression;
                parentExpression = parentExpression.parent;
            };

            if (!parentExpression) {
                break;
            };

            // 检查await表达式
            if (ts.isAwaitExpression(parentExpression)) {
                current = parentExpression;
                parentExpression = parentExpression.parent;
                continue;
            };

            // 如果是函数调用
            if (ts.isCallExpression(parentExpression) && parentExpression.expression === current &&
                !(parentExpression.flags & ts.NodeFlags.OptionalChain)) {
                if (ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) {
                    return false;
                };
                if (ts.isParenthesizedExpression(current) && current.expression !== parent && !ts.isAwaitExpression(current.expression)) {
                    current = parentExpression;
                    parentExpression = parentExpression.parent;
                    continue;
                };
            };

            // new 表达式: new (expr)()
            if (ts.isNewExpression(parentExpression) && parentExpression.expression === current) {
                return this.checkNewAndBinaryExpression(parent, node);
            };

            // 检查不安全的使用场景
            if (
                // 函数调用: (expr)()
                (ts.isCallExpression(parentExpression) && parentExpression.expression === current &&
                    !(parentExpression.flags & ts.NodeFlags.OptionalChain)) ||
                // 属性访问: (expr).prop
                (ts.isPropertyAccessExpression(parentExpression) && parentExpression.expression === current &&
                    !(parentExpression.flags & ts.NodeFlags.OptionalChain)) ||
                // 元素访问: (expr)[index]
                (ts.isElementAccessExpression(parentExpression) && parentExpression.expression === current &&
                    !(parentExpression.flags & ts.NodeFlags.OptionalChain)) ||
                // 模板字面量: (expr)`template`
                (ts.isTaggedTemplateExpression(parentExpression) && parentExpression.tag === current) ||
                // 检查变量声明中的解构赋值
                (ts.isVariableDeclaration(parentExpression) &&
                    (ts.isBinaryExpression(parent) && node === parent.right) &&
                    (ts.isArrayBindingPattern(parentExpression.name) || ts.isObjectBindingPattern(parentExpression.name)))
            ) {
                return true;
            };

            // 继续向上检查
            current = parentExpression;
            parentExpression = parentExpression.parent;
        };

        return false;
    };

    private checkNewAndBinaryExpression(parent: ts.Node, node: ts.Node): boolean {
        if (ts.isBinaryExpression(parent)) {
            if (parent.right === node) {
                return true;
            } else {
                return false;
            };
        } else {
            return true;
        };
    };

    // 检查是否在解构赋值中
    private isInDestructuring(node: ts.Node): boolean {
        let current: ts.Node = node;
        let parent: ts.Node = node.parent;

        while (parent && ts.isParenthesizedExpression(parent)) {
            current = parent;
            parent = parent.parent;
        };

        if (!parent) {
            return false;
        };

        // 检查数组解构赋值模式
        if (ts.isArrayLiteralExpression(parent)) {
            // 检查是否在数组解构赋值中
            return this.checkArrayLiteralExpression(parent);
        };

        // 检查对象解构赋值
        if (ts.isPropertyAssignment(parent)) {
            let objParent: ts.Node = parent.parent;
            while (objParent) {
                if (this.checkObjectLiteralExpression(objParent)) {
                    return true;
                };
                objParent = objParent.parent;
            };
        };

        // 检查嵌套的解构赋值
        if (ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            (ts.isArrayLiteralExpression(parent.left) ||
                ts.isObjectLiteralExpression(parent.left))) {
            return true;
        };

        // 检查变量声明中的解构
        if (ts.isVariableDeclaration(parent) && parent.initializer === current) {
            if ((ts.isArrayBindingPattern(parent.name) || ts.isObjectBindingPattern(parent.name)) &&
                ts.isOptionalChain(current)) {
                return true;
            };
        };

        return false;
    };

    private checkArrayLiteralExpression(parent: ts.Node): boolean {
        // 检查是否在数组解构赋值中
        let arrayParent = parent.parent;
        while (arrayParent && ts.isParenthesizedExpression(arrayParent)) {
            arrayParent = arrayParent.parent;
        };
        if (arrayParent && ts.isBinaryExpression(arrayParent) &&
            arrayParent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            return true;
        };
        return false;
    };

    private checkObjectLiteralExpression(objParent: ts.Node): boolean {
        if (ts.isObjectLiteralExpression(objParent)) {
            let assignParent = objParent.parent;
            while (assignParent && ts.isParenthesizedExpression(assignParent)) {
                assignParent = assignParent.parent;
            };
            if (assignParent &&
                (ts.isBinaryExpression(assignParent) &&
                    assignParent.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
                    ts.isVariableDeclaration(assignParent))) {
                return true;
            };
        };
        return false;
    };

    // 检查 in 或 instanceof 操作符
    private isUnsafeInOrInstanceOfOperation(parent: ts.Node, current: ts.Node): boolean {
        // 检查 in 操作符
        if (ts.isBinaryExpression(parent) &&
            (parent.operatorToken.kind === ts.SyntaxKind.InKeyword ||
                parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword)) {
            // 只有当可选链在右侧时才不安全
            return parent.right === current;
        };
        return false;
    };

    // 检查不安全的三元条件表达式
    private isUnsafeConditionalExpression(parent: ts.ConditionalExpression): boolean {
        let expressionParent = parent.parent;
        // 处理逻辑表达式外层可能的括号
        while (expressionParent && ts.isParenthesizedExpression(expressionParent)) {
            expressionParent = expressionParent.parent;
        };
        if (!expressionParent) {
            return false;
        };
        return this.isUnsafeExpressionParent(expressionParent, parent);
    };

    // 检查不安全的表达式父节点
    private isUnsafeExpressionParent(expressionParent: ts.Node | undefined, parent: ts.Node): boolean {
        return !!(expressionParent && (
            (ts.isCallExpression(expressionParent) && expressionParent.expression === parent.parent &&
                !(expressionParent.flags & ts.NodeFlags.OptionalChain)) ||
            (ts.isPropertyAccessExpression(expressionParent) && expressionParent.expression === parent.parent &&
                !(expressionParent.flags & ts.NodeFlags.OptionalChain)) ||
            (ts.isElementAccessExpression(expressionParent) && expressionParent.expression === parent.parent &&
                !(expressionParent.flags & ts.NodeFlags.OptionalChain)) ||
            this.checkParentChainForUnsafeUsage(expressionParent, parent)
        ));
    };

    // 检查不安全的通用情况
    private isUnsafeGeneralCase(parent: ts.Node, current: ts.Node): boolean {
        return (
            // 检查各种直接的不安全使用场景
            this.isDirectUnsafeUsage(parent, current) ||
            // 检查各种条件表达式
            this.checkBinaryExpressionUnsafe(current) ||
            // 检查类继承
            this.isUnsafeHeritageExpression(parent) ||
            // // 递归检查表达式链
            this.checkExpressionChainForUnsafeUsage(current)
        );
    };

    // 递归检查表达式链上的不安全使用
    private checkExpressionChainForUnsafeUsage(node: ts.Node): boolean {
        let current = node;
        let parent = node.parent;

        while (parent) {
            // 处理括号表达式
            while (parent && ts.isParenthesizedExpression(parent)) {
                current = parent;
                parent = parent.parent;
            };

            if (!parent) {
                break;
            };

            // 检查逗号表达式
            if (ts.isBinaryExpression(parent) &&
                parent.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                // 如果当前节点是右操作数，继续向上检查
                if (parent.right === current) {
                    current = parent;
                    parent = parent.parent;
                    continue;
                };
            };

            if (ts.isElementAccessExpression(parent)) {
                return parent.expression === current &&
                    !(parent.flags & ts.NodeFlags.OptionalChain);
            };

            current = parent;
            parent = parent.parent;
        };

        return false;
    }

    // 检查直接的不安全使用场景
    private isDirectUnsafeUsage(parent: ts.Node, current: ts.Node): boolean {
        return (
            // 函数调用: (obj?.foo)()
            (ts.isCallExpression(parent) && parent.expression === current &&
                !(parent.flags & ts.NodeFlags.OptionalChain)) ||
            // 属性访问: (obj?.foo).bar
            (ts.isPropertyAccessExpression(parent) && parent.expression === current &&
                !(parent.flags & ts.NodeFlags.OptionalChain)) ||
            // 元素访问: (obj?.foo)[1]
            (ts.isElementAccessExpression(parent) && parent.expression === current &&
                !(parent.flags & ts.NodeFlags.OptionalChain)) ||
            // 模板字面量: (obj?.foo)`template`
            (ts.isTaggedTemplateExpression(parent) && parent.tag === current) ||
            // new 表达式: new (obj?.foo)()
            (ts.isNewExpression(parent) && parent.expression === current) ||
            // 展开运算符: [...obj?.foo]
            ts.isSpreadElement(parent) ||
            // 解构赋值的各种情况
            ts.isBindingElement(parent) ||
            // ts.isVariableDeclaration(parent) ||
            (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isBindingElement(parent.left)) ||
            // in 运算符: 1 in obj?.foo
            this.isUnsafeRelationalOperation(parent, current)
        );
    };

    // 检查不安全的类继承
    private isUnsafeHeritageExpression(parent: ts.Node): boolean {
        let current: ts.Node = parent;
        let heritageParent: ts.Node | undefined = parent.parent;

        // 递归检查父节点，处理可能的括号表达式和await表达式
        while (heritageParent) {
            if (ts.isHeritageClause(heritageParent) &&
                heritageParent.token === ts.SyntaxKind.ExtendsKeyword) {
                return true;
            };

            // 处理括号表达式
            if (ts.isParenthesizedExpression(heritageParent)) {
                current = heritageParent;
                heritageParent = heritageParent.parent;
                continue;
            };

            // 处理await表达式
            if (ts.isAwaitExpression(heritageParent)) {
                current = heritageParent;
                heritageParent = heritageParent.parent;
                continue;
            };

            // 处理类表达式
            if (ts.isClassExpression(heritageParent)) {
                current = heritageParent;
                heritageParent = heritageParent.parent;
                continue;
            };

            break;
        };

        return false;
    }

    // 检查不安全的 await 表达式
    private isUnsafeAwaitExpression(parent: ts.AwaitExpression): boolean {
        // 检查 await 表达式
        let current: ts.Node = parent;
        let awaitParent: ts.Node | undefined = parent.parent;

        // 处理括号表达式，同时更新 current
        while (awaitParent && ts.isParenthesizedExpression(awaitParent)) {
            current = awaitParent;
            awaitParent = awaitParent.parent;
        };
        if (!awaitParent) {
            return false;
        };
        // 检查 await 表达式是否参与算术运算
        if (this.defaultOptions[0].disallowArithmeticOperators &&
            (this.isInvolvedInArithmeticOperation(awaitParent, parent) ||
                this.isInArithmeticAssignment(parent))) {
            this.message = this.messages.unsafeArithmetic;
            return true;
        };

        // 检查类继承
        if (this.isUnsafeHeritageExpression(awaitParent)) {
            return true;
        };

        // 检查 for...of 循环
        if (ts.isForOfStatement(awaitParent)) {
            return true;
        };

        // await 表达式后的不安全操作
        if ((ts.isCallExpression(awaitParent) && awaitParent.expression === parent.parent &&
            !(awaitParent.flags & ts.NodeFlags.OptionalChain)) ||
            (ts.isPropertyAccessExpression(awaitParent) && awaitParent.expression === parent.parent &&
                !(awaitParent.flags & ts.NodeFlags.OptionalChain)) ||
            (ts.isElementAccessExpression(awaitParent) && awaitParent.expression === parent.parent &&
                !(awaitParent.flags & ts.NodeFlags.OptionalChain)) ||
            ts.isVariableDeclaration(awaitParent) ||
            ts.isBindingElement(awaitParent) ||
            (ts.isBinaryExpression(awaitParent) &&
                awaitParent.operatorToken.kind === ts.SyntaxKind.EqualsToken)) {
            return true;
        };

        // 检查二元表达式（比如 ||、&&）
        if (ts.isBinaryExpression(awaitParent)) {
            return this.checkBinaryExpressionUnsafeForAwait(current, awaitParent);
        };

        // 检查 await 表达式的父节点是否是 in 操作符的右侧
        return this.isUnsafeInOrInstanceOfOperation(awaitParent, parent);
    };

    // 专门处理 await 表达式在二元表达式中的情况
    private checkBinaryExpressionUnsafeForAwait(current: ts.Node, parent: ts.BinaryExpression): boolean {
        let currentNode: ts.Node = current;
        let parentNode: ts.Node = parent;

        while (parentNode) {
            // 处理括号表达式
            if (ts.isParenthesizedExpression(parentNode)) {
                currentNode = parentNode;
                parentNode = parentNode.parent;
                continue;
            };
            if (!parentNode) {
                return false;
            };

            // 检查二元表达式
            if (ts.isBinaryExpression(parentNode)) {
                return this.checkBinaryExpression(currentNode, parentNode, current);
            };

            // 继续向上检查其他父节点
            currentNode = parentNode;
            parentNode = parentNode.parent;
        };

        return false;
    }

    private checkBinaryExpression(currentNode: ts.Node, parentNode: ts.BinaryExpression, current: ts.Node): boolean {
        // 检查 in 或 instanceof 操作符
        if ((parentNode.operatorToken.kind === ts.SyntaxKind.InKeyword ||
            parentNode.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) &&
            currentNode === parentNode.right || this.isDescendantOf(current, parentNode.right)) {
            // 只有当可选链在右侧时才不安全
            return true;
        };

        // 如果是逻辑运算符，且当前节点在右侧，继续向上检查
        if (this.isLogicalOperator(parentNode.operatorToken.kind) &&
            currentNode === parentNode.right || this.isDescendantOf(current, parentNode.right)) {
            if (ts.isParenthesizedExpression(parentNode.parent) && ts.isBinaryExpression(parentNode.parent.parent) &&
                !this.defaultOptions[0].disallowArithmeticOperators) {
                return false;
            };
            return true;
        };
        return false;
    };

    private isInArithmeticAssignment(node: ts.Node): boolean {
        let current = node;
        let parent = node.parent;

        // 处理括号表达式
        while (parent && ts.isParenthesizedExpression(parent)) {
            parent = parent.parent;
        };
        if (!parent) {
            return false;
        };

        while (parent) {
            if (ts.isBinaryExpression(parent) &&
                this.isArithmeticCompoundAssignment(parent.operatorToken.kind)) {
                // 如果可选节点的父节点是括号运算符，并且在祖先节点运算表达式的左侧
                if (ts.isParenthesizedExpression(node.parent) && ts.isBinaryExpression(node.parent.parent) &&
                    node.parent === node.parent.parent.left) {
                    return false;
                };
                return true;
            };
            current = parent;
            parent = parent.parent;
            // 继续处理外层的括号表达式
            while (parent && ts.isParenthesizedExpression(parent)) {
                parent = parent.parent;
            };
        };
        return false;
    };

    // 检查是否参与算术运算
    private isInvolvedInArithmeticOperation(parent: ts.Node | undefined, node: ts.Node): boolean {
        if (!parent) {
            return false;
        };

        // 检查一元运算符
        if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) {
            const operatorKind = ts.isPrefixUnaryExpression(parent) ?
                parent.operator : parent.operator;
            return this.isArithmeticUnaryOperator(operatorKind);
        };

        // 检查复合赋值运算符
        if (ts.isBinaryExpression(parent) && this.isArithmeticCompoundAssignment(parent.operatorToken.kind)) {
            return true;
        };

        // 检查二元运算符
        if (ts.isBinaryExpression(parent)) {
            if (ts.isBinaryExpression(node.parent) && node === node.parent.left && node.parent !== parent) {
                return false;
            } else if (ts.isAwaitExpression(node.parent) && node === node.parent.expression &&
                (ts.isBinaryExpression(node.parent.parent) && node.parent === node.parent.parent.left)) {
                return false;
            };
            return this.isArithmeticBinaryOperator(parent.operatorToken.kind);
        };

        return false;
    };

    private isArithmeticUnaryOperator(kind: ts.SyntaxKind): boolean {
        return kind === ts.SyntaxKind.PlusToken ||
            kind === ts.SyntaxKind.MinusToken ||
            kind === ts.SyntaxKind.PlusPlusToken ||
            kind === ts.SyntaxKind.MinusMinusToken;
    };

    private isArithmeticBinaryOperator(kind: ts.SyntaxKind): boolean {
        return kind === ts.SyntaxKind.PlusToken ||
            kind === ts.SyntaxKind.MinusToken ||
            kind === ts.SyntaxKind.AsteriskToken ||
            kind === ts.SyntaxKind.SlashToken ||
            kind === ts.SyntaxKind.PercentToken ||
            kind === ts.SyntaxKind.AsteriskAsteriskToken;
    };

    private isArithmeticCompoundAssignment(kind: ts.SyntaxKind): boolean {
        return kind === ts.SyntaxKind.PlusEqualsToken ||
            kind === ts.SyntaxKind.MinusEqualsToken ||
            kind === ts.SyntaxKind.AsteriskEqualsToken ||
            kind === ts.SyntaxKind.SlashEqualsToken ||
            kind === ts.SyntaxKind.PercentEqualsToken ||
            kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken;
    };

    // 辅助方法：检查一个节点是否是另一个节点的后代
    private isDescendantOf(node: ts.Node, possibleAncestor: ts.Node): boolean {
        let current = node.parent;
        while (current) {
            if (current === possibleAncestor) {
                return true;
            };
            current = current.parent;
        };
        return false;
    };

    // 检查是否是逻辑运算符
    private isLogicalOperator(kind: ts.SyntaxKind): boolean {
        return kind === ts.SyntaxKind.QuestionQuestionToken ||  // ??
            kind === ts.SyntaxKind.BarBarToken ||           // ||
            kind === ts.SyntaxKind.AmpersandAmpersandToken || // &&
            kind === ts.SyntaxKind.CommaToken;  // ,操作符
    };

    // 检查是否是不安全的算术运算
    private isUnsafeArithmeticOperation(node: ts.Node, parent: ts.Node): boolean {
        if (!this.defaultOptions[0].disallowArithmeticOperators) {
            return false;
        };
        // 检查节点是否被空值合并操作符保护
        if (this.isProtectedByNullishCoalescing(node)) {
            return false;
        };

        // 检查是否是二元表达式
        if (ts.isBinaryExpression(parent)) {
            const operator = parent.operatorToken.getText();
            if (UNSAFE_ARITHMETIC_OPERATORS.has(operator) ||
                UNSAFE_ASSIGNMENT_OPERATORS.has(operator)) {
                return true;
            };
        };

        // 检查是否是前缀一元表达式
        if (ts.isPrefixUnaryExpression(parent)) {
            const operator = parent.operator;
            return operator === ts.SyntaxKind.PlusToken ||
                operator === ts.SyntaxKind.MinusToken;
        };

        return this.checkParentUnsafeUsage(parent, node);
    };

    private checkParentUnsafeUsage(parent: ts.Node, node: ts.Node): boolean {
        let current = parent;
        let parentExpression = parent.parent;

        while (parentExpression) {
            // 处理括号表达式
            while (parentExpression && ts.isParenthesizedExpression(parentExpression)) {
                current = parentExpression;
                parentExpression = parentExpression.parent;
            };

            if (!parentExpression) {
                break;
            };
            // 检查是否参与了计算
            if (this.isInvolvedInArithmeticOperation(parentExpression, node)) {
                return true;
            };

            // 继续向上检查
            current = parentExpression;
            parentExpression = parentExpression.parent;
        };

        return false;
    };

    private isProtectedByNullishCoalescing(node: ts.Node): boolean {
        let current = node;
        let parent = node.parent;
        if (!parent) {
            return false;
        };

        while (parent) {
            // 检查括号表达式
            if (ts.isParenthesizedExpression(parent)) {
                current = parent;
                parent = parent.parent;
                continue;
            };

            // 检查 await 表达式
            if (ts.isAwaitExpression(parent)) {
                current = parent;
                parent = parent.parent;
                continue;
            };

            // 检查二元表达式
            if (ts.isBinaryExpression(parent)) {
                // 如果是空值合并操作符，且当前节点在左侧，则是安全的
                if (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
                    (current === parent.left || this.isDescendantOf(node, parent.left))) {
                    return true;
                };

                // 如果是逻辑运算符，且当前节点在右侧，继续向上检查
                if (this.isLogicalOperator(parent.operatorToken.kind) &&
                    (current === parent.right || this.isDescendantOf(node, parent.right))) {
                    current = parent;
                    parent = parent.parent;
                    continue;
                };
            };

            return false;
        };

        return false;
    };

    // 检查是否是不安全的比较运算
    private isUnsafeRelationalOperation(parent: ts.Node, node: ts.Node): boolean {
        if (ts.isBinaryExpression(parent)) {
            const operator = parent.operatorToken.getText();
            // 检查 in 操作符
            if (UNSAFE_RELATIONAL_OPERATORS.has(operator)) {
                return this.isUnsafeInOrInstanceOfOperation(parent, node);
            };
        };
        return false;
    };

    private addIssueReport(warnInfo: WarnInfo): Defects {
        this.metaData.description = this.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity,
            this.rule.ruleId, this.filePath, this.metaData.ruleDocPath, true, false, false);
        return defect;
    };
}