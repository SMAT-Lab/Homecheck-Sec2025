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
import { Rule } from '../../model/Rule';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import { Defects, FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { RuleFix } from '../../model/Fix';

type RuleOptions = [{
    allowComparingNullableBooleansToTrue?: boolean;
    allowComparingNullableBooleansToFalse?: boolean;
}];

export class NoUnnecessaryBooleanLiteralCompareCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-unnecessary-boolean-literal-compare-check.md',
        description: 'Disallow unnecessary equality comparisons against boolean literals'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };
    private defaultOptions: RuleOptions = [{}];
    public registerMatchers(): MatcherCallback[] {
        return [{
            matcher: this.fileMatcher,
            callback: this.check
        }];
    };

    public check = (target: ArkFile): void => {
        this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as RuleOptions : this.defaultOptions;
        const filePath = target.getFilePath();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
        this.checkBooleanComparisons(sourceFile, filePath);
    };

    private checkBooleanComparisons(
        sourceFile: ts.SourceFile,
        filePath: string
    ): Defects[] {
        const defects: Defects[] = [];
        const traverse = (node: ts.Node): void => {
            // 先处理逻辑表达式中的比较
            if (ts.isBinaryExpression(node) &&
                (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                    node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
                // 递归检查左右操作数
                traverse(node.left);
                traverse(node.right);
                return;
            }
            if (ts.isBinaryExpression(node)) {
                this.checkBinaryExpression(node, defects, sourceFile, filePath);
            }
            ts.forEachChild(node, traverse);
        };
        traverse(sourceFile);
        return defects;
    };

    private checkBinaryExpression(node: ts.BinaryExpression, defects: Defects[], sourceFile: ts.SourceFile, filePath: string): void {
        // 检查 === 和 !== 以及 == 和 != 运算符
        if (!this.isComparisonOperator(node.operatorToken.kind)) {
            return;
        }
        // 检查布尔字面量比较
        const booleanLiteral = this.findBooleanLiteral(node);
        if (booleanLiteral === null) {
            return;
        }
        // 获取另一个操作数
        const otherOperand = node.left === booleanLiteral ? node.right : node.left;
        // 检查布尔字面量与布尔字面量的比较
        this.booleanBooleanLiteral(otherOperand, node, defects, sourceFile, filePath, booleanLiteral);
        // 检查 instanceof 表达式
        this.instanceOfBooleanLiteral(otherOperand, node, defects, sourceFile, filePath, booleanLiteral);
        // 检查其他表达式
        this.otherExpression(otherOperand, node, defects, sourceFile, filePath, booleanLiteral);
        if (ts.isIdentifier(otherOperand)) {
            // 检查是否为可空布尔类型
            this.isnullBoolean(otherOperand, node, defects, sourceFile, filePath, booleanLiteral);
            if (this.isInGenericContext(node)) {
                return;
            }
            const declaration = this.findSymbolDeclaration(otherOperand);
            if (declaration) {
                // 检查是否为纯布尔类型、字面量类型或类型别名
                this.declareBooleanType(otherOperand, node, defects, sourceFile, filePath, booleanLiteral, declaration);
            }
        }

    };

    // 是否和true比较
    private isTrue(kind: ts.SyntaxKind): boolean {
        const isComparingWithTrue = kind === ts.SyntaxKind.TrueKeyword;
        return isComparingWithTrue;
    };

    private booleanBooleanLiteral(
        otherOperand: ts.Expression,
        node: ts.BinaryExpression,
        defects: Defects[],
        sourceFile: ts.SourceFile,
        filePath: string,
        booleanLiteral: ts.Expression
    ): void {
        if (this.isBooleanLiteralLike(otherOperand)) {
            if (this.isInGenericContext(otherOperand)) {
                return;
            }
            const message = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
                ? `This expression unnecessarily compares a boolean value to a boolean instead of using it directly.`
                : `This expression unnecessarily compares a boolean value to a boolean instead of negating it.`;

            this.addDefect(defects, sourceFile, filePath, node, message); // 传递缺陷信息
            // 操作符
            const parentBinaryExpression = otherOperand.parent as ts.BinaryExpression;
            const operatorToken = parentBinaryExpression.operatorToken.kind;
            let fixD: string | undefined;
            if (this.isTrue(booleanLiteral.kind)) {
                // 和 true 比较
                if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                    fixD = `${this.getText(otherOperand)}`; // booleanVar === true
                } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                    fixD = `!${this.getText(otherOperand)}`; // booleanVar !== true
                }
            } else {
                // 和 false 比较
                if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                    fixD = `!${this.getText(otherOperand)}`; // booleanVar === false
                } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                    fixD = `${this.getText(otherOperand)}`; // booleanVar !== false
                }
            }
            if (fixD) {
                const ruleFix = this.createFix(node, fixD); // 创建修复对象
                this.issues.push(new IssueReport(defects[defects.length - 1], ruleFix)); // 将修复对象添加到 IssueReport 中
            }
            return;
        }
    };

    private instanceOfBooleanLiteral(
        otherOperand: ts.Expression,
        node: ts.BinaryExpression,
        defects: Defects[],
        sourceFile: ts.SourceFile,
        filePath: string,
        booleanLiteral: ts.Expression): void {
        if (ts.isBinaryExpression(otherOperand) &&
            otherOperand.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
            const message = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
                ? `This expression unnecessarily compares a boolean value to a boolean instead of using it directly.`
                : `This expression unnecessarily compares a boolean value to a boolean instead of negating it.`;

            this.addDefect(defects, sourceFile, filePath, node, message); // 传递缺陷信息
            // 获取左值、右值和操作符
            const parentBinaryExpression = otherOperand.parent as ts.BinaryExpression;
            const operatorToken = parentBinaryExpression.operatorToken.kind;
            // 生成修复建议
            let fix: string | undefined;
            if (this.isTrue(booleanLiteral.kind)) {
                // 和 true 比较
                if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                    fix = `${this.getText(otherOperand)}`; // booleanVar === true
                } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                    fix = `!(${this.getText(otherOperand)})`; // booleanVar !== true
                }
            } else {
                // 和 false 比较
                if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                    fix = `!(${this.getText(otherOperand)})`; // booleanVar === false
                } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                    fix = `${this.getText(otherOperand)}`; // booleanVar !== false
                }
            }
            if (fix) {
                const ruleFix = this.createFix(node, fix); // 创建修复对象
                this.issues.push(new IssueReport(defects[defects.length - 1], ruleFix)); // 将修复对象添加到 IssueReport 中
            }
            return;
        }

    };

    private otherExpression(
        otherOperand: ts.Expression,
        node: ts.BinaryExpression,
        defects: Defects[],
        sourceFile: ts.SourceFile,
        filePath: string,
        booleanLiteral: ts.Expression): void {
        if (ts.isBinaryExpression(otherOperand) ||
            ts.isTypeOfExpression(otherOperand)) {
            const message = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
                ? `This expression unnecessarily compares a boolean value to a boolean instead of using it directly.`
                : `This expression unnecessarily compares a boolean value to a boolean instead of negating it.`;
            this.addDefect(defects, sourceFile, filePath, node, message);
            // 获取左值、右值和操作符
            const parentBinaryExpression = otherOperand.parent as ts.BinaryExpression;
            const operatorToken = parentBinaryExpression.operatorToken.kind;
            let fixD: string | undefined;
            if (this.isTrue(booleanLiteral.kind)) {
                // 和 true 比较
                if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                    fixD = `${this.getText(otherOperand)}`; // booleanVar === true
                } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                    fixD = `!(${this.getText(otherOperand)})`; // booleanVar !== true
                }
            } else {
                // 和 false 比较
                if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                    fixD = `!(${this.getText(otherOperand)})`; // booleanVar === false
                } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                    fixD = `${this.getText(otherOperand)}`; // booleanVar !== false
                }
            }

            if (fixD) {
                const ruleFix = this.createFix(node, fixD); // 创建修复对象
                this.issues.push(new IssueReport(defects[defects.length - 1], ruleFix)); // 将修复对象添加到 IssueReport 中
            }
            return;
        }
    };

    private isnullBoolean(
        otherOperand: ts.Expression,
        node: ts.BinaryExpression,
        defects: Defects[],
        sourceFile: ts.SourceFile,
        filePath: string,
        booleanLiteral: ts.Expression): void {
        if (this.isNullableBooleanType(otherOperand)) {
            const isComparingWithTrue = this.isTrue(booleanLiteral.kind);
            if (isComparingWithTrue) {
                // 明确设置为 false 才报告，否则默认允许
                const shouldReport = this.defaultOptions[0].allowComparingNullableBooleansToTrue === false;
                if (shouldReport) {
                    this.isNullableBooleanFix(otherOperand, node, defects, sourceFile, filePath, booleanLiteral);
                }
            } else {
                // 使用配置项的值，若未配置则根据默认值
                const shouldReport = this.defaultOptions[0].allowComparingNullableBooleansToFalse === false;
                if (shouldReport) {
                    this.isNullableBooleanFix(otherOperand, node, defects, sourceFile, filePath, booleanLiteral);
                }
            }
        }
    };

    private isNullableBooleanFix(
        otherOperand: ts.Expression,
        node: ts.BinaryExpression,
        defects: Defects[],
        sourceFile: ts.SourceFile,
        filePath: string,
        booleanLiteral: ts.Expression): void {
        let message = '';
        if (this.defaultOptions[0].allowComparingNullableBooleansToTrue === false) {
            message = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
                ? `This expression unnecessarily compares a nullable boolean value to true instead of using it directly.`
                : `This expression unnecessarily compares a nullable boolean value to true instead of negating it.`;
        } else if (this.defaultOptions[0].allowComparingNullableBooleansToFalse === false) {
            message = `This expression unnecessarily compares a nullable boolean value to false instead of using the ?? operator to provide a default.`;
        }
        this.addDefect(defects, sourceFile, filePath, node, message); // 传递缺陷信息
        // 获取左值、右值和操作符
        const parentBinaryExpression = otherOperand.parent as ts.BinaryExpression;
        const operatorToken = parentBinaryExpression.operatorToken.kind;
        // 生成修复建议
        let fix: string | undefined;
        if (this.isTrue(booleanLiteral.kind)) {
            // 和 true 比较
            if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                fix = `${this.getText(otherOperand)}`; // booleanVar === true
            } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                fix = `!${this.getText(otherOperand)}`; // booleanVar !== true
            }
        } else {
            // 和 false 比较
            if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                fix = `!(${this.getText(otherOperand)} ?? true)`; // booleanVar === false
            } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                fix = `(${this.getText(otherOperand)} ?? true)`; // booleanVar !== false
            }
        }
        if (fix) {
            const ruleFix = this.createFix(node, fix); // 创建修复对象
            this.issues.push(new IssueReport(defects[defects.length - 1], ruleFix)); // 将修复对象添加到 IssueReport 中
        }
        return;
    };

    private declareBooleanType(
        otherOperand: ts.Expression,
        node: ts.BinaryExpression,
        defects: Defects[],
        sourceFile: ts.SourceFile,
        filePath: string,
        booleanLiteral: ts.Expression,
        declaration: ts.VariableDeclaration | ts.ParameterDeclaration): void {
        if (!declaration.type) {
            return;
        }
        const typeNode = declaration.type;
        if (typeNode.kind === ts.SyntaxKind.BooleanKeyword ||
            typeNode.kind === ts.SyntaxKind.TrueKeyword ||
            typeNode.kind === ts.SyntaxKind.FalseKeyword ||
            (ts.isLiteralTypeNode(typeNode) &&
                (typeNode.literal.kind === ts.SyntaxKind.TrueKeyword ||
                    typeNode.literal.kind === ts.SyntaxKind.FalseKeyword)) ||
            (ts.isTypeReferenceNode(typeNode) &&
                ts.isIdentifier(typeNode.typeName) &&
                (typeNode.typeName.text === 'true' ||
                    typeNode.typeName.text === 'false'))) {

            if (!this.hasGenericAncestor(declaration)) {
                this.declareBooleanTypeFix(node, defects, sourceFile, filePath, booleanLiteral, otherOperand);

            }
        }
    };

    private declareBooleanTypeFix(
        node: ts.BinaryExpression,
        defects: Defects[],
        sourceFile: ts.SourceFile,
        filePath: string,
        booleanLiteral: ts.Expression,
        otherOperand: ts.Expression): void {
        const message = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
            node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
            ? `This expression unnecessarily compares a boolean value to a boolean instead of using it directly.`
            : `This expression unnecessarily compares a boolean value to a boolean instead of negating it.`;
        this.addDefect(defects, sourceFile, filePath, node, message);
        const parentBinaryExpression = otherOperand.parent as ts.BinaryExpression;
        const operatorToken = parentBinaryExpression.operatorToken.kind;
        let fixD: string | undefined;
        if (this.isTrue(booleanLiteral.kind)) {
            // 和 true 比较
            if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                fixD = `${this.getText(otherOperand)}`; // booleanVar === true
            } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                fixD = `!${this.getText(otherOperand)}`; // booleanVar !== true
            }
        } else {
            // 和 false 比较
            if (operatorToken === ts.SyntaxKind.EqualsEqualsToken || operatorToken === ts.SyntaxKind.EqualsEqualsEqualsToken) {
                fixD = `!${this.getText(otherOperand)}`; // booleanVar === false
            } else if (operatorToken === ts.SyntaxKind.ExclamationEqualsToken || operatorToken === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                fixD = `${this.getText(otherOperand)}`; // booleanVar !== false
            }
        }
        if (fixD) {
            const ruleFix = this.createFix(node, fixD); // 创建修复对象
            this.issues.push(new IssueReport(defects[defects.length - 1], ruleFix)); // 将修复对象添加到 IssueReport 中
        }
    };

    private isComparisonOperator(kind: ts.SyntaxKind): boolean {
        return kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
            kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
            kind === ts.SyntaxKind.EqualsEqualsToken ||
            kind === ts.SyntaxKind.ExclamationEqualsToken;
    };

    private getText(node: ts.Node): string {
        return node.getText();
    };

    private findBooleanLiteral(node: ts.BinaryExpression): ts.Expression | null {
        //检查嵌套表达式
        const checkOperand = (operand: ts.Expression): ts.Expression | null => {
            if (operand.kind === ts.SyntaxKind.TrueKeyword || operand.kind === ts.SyntaxKind.FalseKeyword) {
                return operand;
            }
            if (ts.isParenthesizedExpression(operand)) {
                return checkOperand(operand.expression);
            }
            if (ts.isBinaryExpression(operand)) {
                return this.findBooleanLiteral(operand);
            }
            return null;
        };
        const leftLiteral = checkOperand(node.left);
        if (leftLiteral) {
            return leftLiteral;
        };
        const rightLiteral = checkOperand(node.right);
        if (rightLiteral) {
            return rightLiteral;
        };
        return null;
    };

    private findSymbolDeclaration(identifier: ts.Identifier): ts.VariableDeclaration | ts.ParameterDeclaration | undefined {
        let current: ts.Node | undefined = identifier;
        const sourceFile = identifier.getSourceFile();
        const declaration = this.findInSourceFileStatements(identifier, sourceFile);
        if (declaration) {
            return declaration;
        }
        while (current) {
            if (ts.isVariableDeclaration(current)) {
                if (ts.isIdentifier(current.name) && current.name.text === identifier.text) {
                    return current;
                }
            }
            current = current.parent;
        }
        return undefined;
    };

    private findInSourceFileStatements(identifier: ts.Identifier, sourceFile: ts.SourceFile): ts.VariableDeclaration | undefined {
        return this.findVariableDeclarationInStatements(sourceFile.statements, identifier);
    };

    private findVariableDeclarationInStatements(statements: ts.NodeArray<ts.Statement>, identifier: ts.Identifier): ts.VariableDeclaration | undefined {
        for (const statement of statements) {
            const declaration = this.findVariableDeclarationInStatement(statement, identifier);
            if (declaration) {
                return declaration;
            }
        }
        return undefined;
    };

    private findVariableDeclarationInStatement(statement: ts.Statement, identifier: ts.Identifier): ts.VariableDeclaration | undefined {
        if (ts.isVariableStatement(statement)) {
            return this.findVariableDeclarationInDeclarationList(statement.declarationList, identifier);
        }
        return undefined;
    };

    private findVariableDeclarationInDeclarationList(
        declarationList:
            ts.VariableDeclarationList,
        identifier: ts.Identifier): ts.VariableDeclaration | undefined {
        for (const decl of declarationList.declarations) {
            if (this.isMatchingVariableDeclaration(decl, identifier)) {
                return decl;
            }
        }
        return undefined;
    };

    private isMatchingVariableDeclaration(decl: ts.VariableDeclaration, identifier: ts.Identifier): boolean {
        return ts.isIdentifier(decl.name) && decl.name.text === identifier.text;
    };

    private addDefect(defects: Defects[], sourceFile: ts.SourceFile, filePath: string,
        node: ts.Node, message: string): void {
        const start = node.getStart();
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
        const lineNumber = lineAndChar.line + 1;
        const column = lineAndChar.character + 1;
        const defect = new Defects(
            lineNumber,
            column,
            end.character + 1,
            message,
            this.metaData.severity,
            this.rule.ruleId,
            `${filePath}%${lineNumber}%${column}%${this.rule.ruleId}`,
            this.metaData.ruleDocPath,
            true,
            false,
            true,
        );
        defects.push(defect);
        RuleListUtil.push(defect);
    };

    private isInGenericContext(node: ts.Node): boolean {
        let current: ts.Node | undefined = node;
        while (current) {
            if (this.isInArrowFunctionContext(current)) {
                return true;
            }
            if (ts.isTypeParameterDeclaration(current)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    };

    private isInArrowFunctionContext(node: ts.Node): boolean {
        if (!ts.isArrowFunction(node)) {
            return false;
        }
        const parent = node.parent;
        if (!ts.isVariableDeclaration(parent)) {
            return false;
        }
        return this.hasGenericType(parent.type);
    };

    private hasGenericType(type: ts.TypeNode | undefined): boolean {
        if (!type) {
            return false;
        }
        if (ts.isFunctionTypeNode(type) && type.typeParameters && type.typeParameters.length > 0) {
            return true;
        }
        if (ts.isUnionTypeNode(type)) {
            return true;
        }
        return false;
    };

    private hasGenericAncestor(node: ts.Node): boolean {
        let current: ts.Node | undefined = node;
        while (current) {
            if (ts.isTypeParameterDeclaration(current) ||
                (ts.isFunctionTypeNode(current) && current.typeParameters && current.typeParameters.length > 0)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    };

    private isBooleanLiteralLike(node: ts.Expression): boolean {
        // 处理基本布尔字面量
        if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
            return true;
        }
        // 处理括号表达式
        if (ts.isParenthesizedExpression(node)) {
            return this.isBooleanLiteralLike(node.expression);
        }
        // 处理二元表达式
        if (ts.isBinaryExpression(node)) {
            // 处理 instanceof 表达式
            if (node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
                return true;
            }
            // 处理逻辑运算符
            if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
                return this.isBooleanLiteralLike(node.right);
            }
        }
        // 处理空值合并运算符
        if (ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
            // 检查是否在泛型上下文中
            let current: ts.Node | undefined = node;
            while (current) {
                if (ts.isTypeParameterDeclaration(current) ||
                    (ts.isFunctionTypeNode(current) && current.typeParameters && current.typeParameters.length > 0)) {
                    return false;
                }
                current = current.parent;
            }
            return this.isBooleanLiteralLike(node.right);
        }
        // 处理前缀一元运算符（比如 !）
        if (ts.isPrefixUnaryExpression(node) &&
            node.operator === ts.SyntaxKind.ExclamationToken) {
            return true;
        }
        return false;
    };

    private isNullableBooleanType(node: ts.Node): boolean {
        if (!ts.isIdentifier(node)) {
            return false;
        };
        const declaration = this.findSymbolDeclaration(node);
        if (!declaration || !declaration.type) {
            return false;
        };
        // 检查是否为联合类型
        if (ts.isUnionTypeNode(declaration.type)) {
            const types = declaration.type.types;
            // 首先检查是否包含 null 或 undefined
            const hasNullOrUndefined = types.some(t =>
                (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword) ||
                t.kind === ts.SyntaxKind.UndefinedKeyword ||
                t.kind === ts.SyntaxKind.NullKeyword);
            // 检查每个类型是否都是布尔相关类型或 null/undefined
            const isOnlyBooleanAndNullable = types.every(t =>
                // 布尔类型
                t.kind === ts.SyntaxKind.BooleanKeyword ||
                t.kind === ts.SyntaxKind.TrueKeyword ||
                t.kind === ts.SyntaxKind.FalseKeyword ||
                // null/undefined
                t.kind === ts.SyntaxKind.NullKeyword ||
                t.kind === ts.SyntaxKind.UndefinedKeyword ||
                // 布尔字面量类型
                (ts.isLiteralTypeNode(t) && (
                    t.literal.kind === ts.SyntaxKind.TrueKeyword ||
                    t.literal.kind === ts.SyntaxKind.FalseKeyword ||
                    t.literal.kind === ts.SyntaxKind.NullKeyword
                ))
            );
            if (hasNullOrUndefined) {
                // 检查是否包含完整的布尔类型或布尔字面量
                const hasBoolean = types.some(t =>
                    t.kind === ts.SyntaxKind.BooleanKeyword ||
                    t.kind === ts.SyntaxKind.TrueKeyword ||
                    t.kind === ts.SyntaxKind.FalseKeyword ||
                    (ts.isLiteralTypeNode(t) &&
                        (t.literal.kind === ts.SyntaxKind.TrueKeyword ||
                            t.literal.kind === ts.SyntaxKind.FalseKeyword)));
                return hasBoolean && isOnlyBooleanAndNullable;
            }
        }
        return false;
    };

    private createFix(node: ts.Node, replacement: string): RuleFix {
        return { range: [node.getStart(), node.getEnd()], text: replacement };
    };
}

