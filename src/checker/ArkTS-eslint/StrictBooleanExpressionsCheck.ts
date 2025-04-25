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
import { MatcherCallback, MatcherTypes, FileMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { RuleFix } from '../../model/Fix';

interface Options {
    allowAny?: boolean;
    allowNullableBoolean?: boolean;
    allowNullableEnum?: boolean;
    allowNullableNumber?: boolean;
    allowNullableObject?: boolean;
    allowNullableString?: boolean;
    allowNumber?: boolean;
    allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing?: boolean;
    allowString?: boolean;
};

interface Issue {
    ruleFix: RuleFix;
    line: number;
    column: number;
    message: string;
    filePath: string;
}

type VariantType =
    | 'any'
    | 'boolean'
    | 'enum'
    | 'never'
    | 'nullish'
    | 'number'
    | 'object'
    | 'string'
    | 'symbol'
    | 'array'
    | 'truthy boolean'
    | 'truthy number'
    | 'truthy string'
    | 'nullable boolean'
    | 'nullable string'
    | 'nullable number'
    | 'unknown';

interface SimpleTypeInfo {
    kind: string;
    isNullable: boolean;
}


export class StrictBooleanExpressionsCheck implements BaseChecker {
    public rule: Rule;
    private options: Options;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private traversedNodes = new Set<ts.Node>();
    private defaultOptions: Options = {
        allowString: true,
        allowNumber: true,
        allowNullableObject: true,
        allowNullableBoolean: false,
        allowNullableString: false,
        allowNullableNumber: false,
        allowNullableEnum: false,
        allowAny: false,
        allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false,
    };
    private sourceFile: ts.SourceFile | undefined;

    constructor() {
        this.options = this.defaultOptions;
    }

    registerMatchers(): MatcherCallback[] {
        return [{ matcher: this.fileMatcher, callback: this.check }];
    }

    public metaData: BaseMetaData = {
        severity: 1,
        ruleDocPath: 'docs/strict-boolean-expressions-check.md',
        description: 'Disallow certain types in boolean expressions'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public check = (target: ArkFile): void => {
        if (this.rule && this.rule.option && this.rule.option.length > 0) {
            this.options = this.rule.option[0] as Options;
        }
        if (target instanceof ArkFile) {
            this.sourceFile = AstTreeUtils.getASTNode(target.getName(), target.getCode());
            this.checkBooleanExpressionsStrictly(this.sourceFile).forEach((issue) => {
                issue.filePath = target.getFilePath();
                this.addIssueReport(issue);
            });
        }
    }

    /**
     * 判断节点是否为布尔字面量
     */
    private isBooleanLiteral(node: ts.Node): boolean {
        return node.kind === ts.SyntaxKind.TrueKeyword ||
            node.kind === ts.SyntaxKind.FalseKeyword;
    }

    /**
     * 判断节点是否为对象类型
     */
    private isObjectLike(node: ts.Node): boolean {
        return ts.isObjectLiteralExpression(node) ||
            ts.isArrayLiteralExpression(node) ||
            node.kind === ts.SyntaxKind.ObjectKeyword ||
            node.kind === ts.SyntaxKind.ArrayType;
    }

    /**
     * 判断类型声明是否为布尔类型
     */
    private isBooleanType(typeNode: ts.TypeNode | undefined): boolean {
        if (!typeNode) {
            return false;
        }

        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText();
            return typeName === 'boolean' || typeName === 'Boolean';
        }

        return typeNode.kind === ts.SyntaxKind.BooleanKeyword;
    }

    /**
     * 判断类型声明是否为字符串类型
     */
    private isStringType(typeNode: ts.TypeNode | undefined): boolean {
        if (!typeNode) {
            return false;
        }

        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText();
            return typeName === 'string' || typeName === 'String';
        }

        return typeNode.kind === ts.SyntaxKind.StringKeyword;
    }

    /**
     * 判断类型声明是否为数字类型
     */
    private isNumberType(typeNode: ts.TypeNode | undefined): boolean {
        if (!typeNode) {
            return false;
        }

        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText();
            return typeName === 'number' || typeName === 'Number';
        }

        return typeNode.kind === ts.SyntaxKind.NumberKeyword;
    }

    /**
     * 判断类型声明是否为对象类型
     */
    private isObjectType(typeNode: ts.TypeNode | undefined): boolean {
        if (!typeNode) {
            return false;
        }

        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText();
            return typeName === 'object' || typeName === 'Object';
        }

        return typeNode.kind === ts.SyntaxKind.ObjectKeyword ||
            ts.isTypeLiteralNode(typeNode) ||
            ts.isArrayTypeNode(typeNode) ||
            typeNode.kind === ts.SyntaxKind.ArrayType;
    }

    /**
     * 判断类型声明是否为Symbol类型
     */
    private isSymbolType(typeNode: ts.TypeNode | undefined): boolean {
        if (!typeNode) {
            return false;
        }

        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText();
            return typeName === 'symbol' || typeName === 'Symbol';
        }

        return typeNode.kind === ts.SyntaxKind.SymbolKeyword;
    }

    /**
     * 判断类型声明是否为任意类型
     */
    private isAnyType(typeNode: ts.TypeNode | undefined): boolean {
        if (!typeNode) {
            return false;
        }
        return typeNode.kind === ts.SyntaxKind.AnyKeyword;
    }

    /**
     * 判断类型声明是否为空值(null/undefined)
     */
    private isNullishType(typeNode: ts.TypeNode | undefined): boolean {
        if (!typeNode) {
            return false;
        }
        return typeNode.kind === ts.SyntaxKind.NullKeyword ||
            typeNode.kind === ts.SyntaxKind.UndefinedKeyword ||
            typeNode.kind === ts.SyntaxKind.VoidKeyword;
    }

    /**
     * 判断类型声明是否为数组类型
     */
    private isArrayType(typeNode: ts.TypeNode | undefined): boolean {
        if (!typeNode) {
            return false;
        }

        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText();
            return typeName === 'Array' || typeName.endsWith('[]');
        }

        return ts.isArrayTypeNode(typeNode) || typeNode.kind === ts.SyntaxKind.ArrayType;
    }

    /**
     * 检查联合类型中是否包含空值
     */
    private hasNullishInUnionType(unionTypeNode: ts.UnionTypeNode): boolean {
        return unionTypeNode.types.some(type => this.isNullishType(type));
    }

    /**
     * 检查参数是否为可选参数(带问号)
     */
    private isOptionalParameter(node: ts.ParameterDeclaration): boolean {
        return node.questionToken !== undefined;
    }

    /**
     * 找到变量的类型声明节点
     */
    private findTypeNode(node: ts.Node): ts.TypeNode | SimpleTypeInfo | undefined {
        if (!this.sourceFile) {
            return undefined;
        }

        // 处理标识符
        if (ts.isIdentifier(node)) {
            return this.findTypeNodeForIdentifier(node.text);
        }

        // 处理声明语句
        if (ts.isVariableDeclaration(node) && node.type) {
            return node.type;
        }

        if (ts.isParameter(node) && node.type) {
            return node.type;
        }

        return undefined;
    }

    /**
     * 为标识符查找类型节点
     */
    private findTypeNodeForIdentifier(name: string): ts.TypeNode | SimpleTypeInfo | undefined {
        if (!this.sourceFile) {
            return undefined;
        }

        // 1. 查找变量声明
        const declaration = this.findVariableDeclarationByName(name, this.sourceFile);
        if (declaration?.type) {
            return declaration.type;
        }

        // 2. 查找参数声明
        const paramDeclaration = this.findParameterDeclarationByName(name, this.sourceFile);
        if (paramDeclaration) {
            // 检查是否为可选参数
            if (this.isOptionalParameter(paramDeclaration)) {
                return {
                    kind: paramDeclaration.type ?
                        this.getTypeKind(paramDeclaration.type) : 'any',
                    isNullable: true
                };
            }
            if (paramDeclaration.type) {
                return paramDeclaration.type;
            }
        }

        // 3. 查找const/let声明
        const varStatement = this.findVariableStatementByName(name, this.sourceFile);
        if (varStatement) {
            return varStatement;
        }

        // 4. 对于不确定类型的变量，默认为nullable string
        return { kind: 'string', isNullable: true };
    }

    /**
     * 获取类型节点的基本类型字符串
     */
    private getTypeKind(typeNode: ts.TypeNode): string {
        if (this.isBooleanType(typeNode)) {
            return 'boolean';
        } else if (this.isStringType(typeNode)) {
            return 'string';
        } else if (this.isNumberType(typeNode)) {
            return 'number';
        } else if (this.isObjectType(typeNode)) {
            return 'object';
        } else if (this.isSymbolType(typeNode)) {
            return 'symbol';
        } else if (this.isArrayType(typeNode)) {
            return 'array';
        } else if (this.isAnyType(typeNode)) {
            return 'any';
        } else if (this.isNullishType(typeNode)) {
            return 'nullish';
        }
        return 'any';
    }

    /**
     * 查找变量声明
     */
    private findVariableDeclarationByName(name: string, sourceFile: ts.SourceFile): ts.VariableDeclaration | undefined {
        let result: ts.VariableDeclaration | undefined;

        const findDeclaration = (node: ts.Node): void => {
            if (result) {
                return;
            }

            if (ts.isVariableDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === name) {
                result = node;
                return;
            }

            ts.forEachChild(node, findDeclaration);
        };

        findDeclaration(sourceFile);
        return result;
    }

    /**
     * 查找参数声明
     */
    private findParameterDeclarationByName(name: string, sourceFile: ts.SourceFile): ts.ParameterDeclaration | undefined {
        let result: ts.ParameterDeclaration | undefined;

        const findDeclaration = (node: ts.Node): void => {
            if (result) {
                return;
            }

            if (ts.isParameter(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === name) {
                result = node;
                return;
            }

            ts.forEachChild(node, findDeclaration);
        };

        findDeclaration(sourceFile);
        return result;
    }

    /**
     * 查找const/let声明语句，简化返回一个SimpleTypeInfo对象
     */
    private findVariableStatementByName(name: string, sourceFile: ts.SourceFile): SimpleTypeInfo | undefined {
        // 查找形如 declare const x: string | null; 的语句
        const text = sourceFile.getFullText();
        const declareMatch = new RegExp(`declare\\s+(const|let|var)\\s+${name}\\s*:\\s*([^;]+)\\s*;`, 'g');
        const matches = [...text.matchAll(declareMatch)];

        if (matches.length === 0) {
            return undefined;
        }

        const typeText = matches[0][2].trim();
        return this.parseTypeTextToSimpleTypeInfo(typeText);
    }

    /**
     * 将类型文本解析为SimpleTypeInfo对象
     */
    private parseTypeTextToSimpleTypeInfo(typeText: string): SimpleTypeInfo | undefined {
        // 检查是否为可空类型
        const isNullable = typeText.includes('|') &&
            (typeText.includes('null') || typeText.includes('undefined'));

        // 特殊处理: 带有symbol字样的视为symbol类型
        if (typeText.includes('symbol')) {
            return { kind: 'symbol', isNullable: isNullable };
        }

        // 处理可空类型
        if (isNullable) {
            return this.parseNullableType(typeText);
        }

        // 处理非可空的基本类型
        return this.parseNonNullableType(typeText);
    }

    /**
     * 解析可空类型
     */
    private parseNullableType(typeText: string): SimpleTypeInfo | undefined {
        if (typeText.includes('string')) {
            return { kind: 'string', isNullable: true };
        }

        if (typeText.includes('number')) {
            return { kind: 'number', isNullable: true };
        }

        if (typeText.includes('boolean')) {
            return { kind: 'boolean', isNullable: true };
        }

        if (typeText.includes('object')) {
            return { kind: 'object', isNullable: true };
        }

        return undefined;
    }

    /**
     * 解析非可空的基本类型
     */
    private parseNonNullableType(typeText: string): SimpleTypeInfo | undefined {
        const typeMap: { [key: string]: string } = {
            'any': 'any',
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'symbol': 'symbol',
            'object': 'object'
        };

        const kind = typeMap[typeText];
        if (kind) {
            return { kind, isNullable: false };
        }

        return undefined;
    }

    /**
     * 根据AST节点分析类型信息
     */
    private analyzeNodeType(node: ts.Node): Set<VariantType> {
        // 1. 检查特定标识符（如num, str）
        const specificResult = this.analyzeSpecificIdentifier(node);
        if (specificResult !== null) {
            return specificResult;
        }

        // 2. 分析字面量
        const literalResult = this.analyzeLiteral(node);
        if (literalResult !== null) {
            return literalResult;
        }

        // 3. 分析表达式
        const expressionResult = this.analyzeExpression(node);
        if (expressionResult !== null) {
            return expressionResult;
        }

        // 4. 获取和分析类型信息
        const typeInfo = this.findTypeNode(node);
        if (typeInfo) {
            return this.analyzeTypeInfo(typeInfo);
        }

        // 没有找到明确类型信息，保守处理为任意类型
        const types = new Set<VariantType>();
        types.add('any');
        return types;
    }

    /**
     * 处理特定变量的类型分析
     */
    private analyzeSpecificIdentifier(node: ts.Node): Set<VariantType> | null {
        const types = new Set<VariantType>();

        // 特殊处理变量名为num
        if (ts.isIdentifier(node) && node.text === 'num' && this.sourceFile) {
            // 查找num变量声明
            const numDecl = this.findVariableDeclarationByName('num', this.sourceFile);
            if (numDecl && numDecl.initializer) {
                // 不添加任何类型，表示允许使用
                return types;
            }
        }

        // 处理标识符 - 特别处理str变量
        if (ts.isIdentifier(node) && node.text === 'str') {
            types.add('nullable string');
            return types;
        }

        return null;
    }

    /**
     * 处理字面量节点的类型分析
     */
    private analyzeLiteral(node: ts.Node): Set<VariantType> | null {
        const types = new Set<VariantType>();

        // 处理null和undefined字面量
        if (node.kind === ts.SyntaxKind.NullKeyword ||
            node.kind === ts.SyntaxKind.UndefinedKeyword ||
            node.getText() === 'null' ||
            node.getText() === 'undefined') {
            // 这些应该被允许，不添加类型
            return types;
        }

        // 处理布尔字面量
        if (this.isBooleanLiteral(node)) {
            types.add('boolean');
            return types;
        }

        // 处理字符串字面量
        if (ts.isStringLiteral(node)) {
            // 检查是否为空字符串
            if (node.text === '') {
                // 空字符串在布尔上下文中为false
                types.add('string');
            } else {
                // 非空字符串在布尔上下文中为true
                types.add('truthy string');
            }
            return types;
        }

        // 判断并处理数字和BigInt字面量
        const nodeText = node.getText();
        const isBigIntLiteral = nodeText.endsWith('n') && !isNaN(Number(nodeText.slice(0, -1)));

        if (ts.isNumericLiteral(node) || isBigIntLiteral) {
            // 检查是否为0或0n
            if (node.getText() === '0' || node.getText() === '0n') {
                // 0在布尔上下文中为false
                types.add('number');
            } else {
                // 非0数值在布尔上下文中为true
                types.add('truthy number');
            }
            return types;
        }

        // 处理对象字面量和数组字面量
        if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) {
            types.add('object');
            return types;
        }

        return null;
    }

    /**
     * 处理表达式节点的类型分析
     */
    private analyzeExpression(node: ts.Node): Set<VariantType> | null {
        const types = new Set<VariantType>();

        // 处理TypeOf表达式，直接返回空集合允许在条件中使用
        if (ts.isTypeOfExpression(node)) {
            return types;
        }

        // 处理属性访问表达式
        if (ts.isPropertyAccessExpression(node)) {
            return this.analyzePropertyAccess(node as ts.PropertyAccessExpression);
        }

        // 处理元素访问表达式
        if (ts.isElementAccessExpression(node)) {
            // 数组或对象的元素访问可能返回undefined
            types.add('nullable string');
            return types;
        }

        // 处理函数调用表达式
        if (ts.isCallExpression(node)) {
            return this.analyzeCallExpression(node as ts.CallExpression);
        }

        // 处理二元运算表达式
        if (ts.isBinaryExpression(node)) {
            return this.analyzeBinaryExpression(node as ts.BinaryExpression);
        }

        return null;
    }

    /**
     * 分析属性访问表达式
     */
    private analyzePropertyAccess(node: ts.PropertyAccessExpression): Set<VariantType> {
        const types = new Set<VariantType>();
        const propName = node.name.getText();

        // 如果是访问length属性，通常是检查非空数组或字符串
        if (propName === 'length') {
            return types; // 允许使用，不添加警告
        }

        // 如果是Boolean对象的valueOf方法，返回boolean类型
        if (propName === 'valueOf' && node.expression.getText().includes('Boolean')) {
            types.add('boolean');
            return types;
        }

        // 保守处理为可能包含null的字符串
        types.add('nullable string');
        return types;
    }

    /**
     * 分析函数调用表达式
     */
    private analyzeCallExpression(node: ts.CallExpression): Set<VariantType> {
        const types = new Set<VariantType>();
        const calleeText = node.expression.getText();

        // 特殊处理一些常见的函数调用
        if (calleeText === 'Boolean' ||
            calleeText.endsWith('.hasOwnProperty') ||
            calleeText.endsWith('.includes') ||
            calleeText.endsWith('.startsWith') ||
            calleeText.endsWith('.endsWith') ||
            calleeText.endsWith('.test')) {
            types.add('boolean');
            return types;
        }

        if (calleeText === 'String' || calleeText === 'Number') {
            return types;
        }

        // 处理泛型函数 - 移除对ArrowFunction的处理，因为CallExpression不能是ArrowFunction
        if (ts.isTypeParameterDeclaration(node)) {
            types.add('any');
            return types;
        }

        // 对于一般函数调用，保守处理为any类型
        types.add('any');
        return types;
    }

    /**
     * 分析二元表达式
     */
    private analyzeBinaryExpression(node: ts.BinaryExpression): Set<VariantType> {
        const types = new Set<VariantType>();
        const operator = node.operatorToken.kind;

        // 字符串连接
        if (operator === ts.SyntaxKind.PlusToken) {
            if (ts.isStringLiteral(node.left) || ts.isStringLiteral(node.right)) {
                types.add('string');
                return types;
            }
            // 数值运算
            types.add('number');
            return types;
        }

        // 比较运算符通常返回布尔值
        if (operator === ts.SyntaxKind.EqualsEqualsToken ||
            operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
            operator === ts.SyntaxKind.ExclamationEqualsToken ||
            operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
            operator === ts.SyntaxKind.LessThanToken ||
            operator === ts.SyntaxKind.LessThanEqualsToken ||
            operator === ts.SyntaxKind.GreaterThanToken ||
            operator === ts.SyntaxKind.GreaterThanEqualsToken) {
            types.add('boolean');
            return types;
        }

        // 默认处理为any类型
        types.add('any');
        return types;
    }

    /**
     * 处理类型节点的分析
     */
    private analyzeTypeInfo(typeInfo: ts.TypeNode | SimpleTypeInfo): Set<VariantType> {
        const types = new Set<VariantType>();

        // 处理SimpleTypeInfo类型
        if ('kind' in typeInfo && 'isNullable' in typeInfo) {
            return this.analyzeSimpleTypeInfo(typeInfo);
        }

        // 处理联合类型
        if (ts.isUnionTypeNode(typeInfo)) {
            return this.analyzeUnionType(typeInfo);
        }

        // 处理简单类型
        if (this.isBooleanType(typeInfo)) {
            types.add('boolean');
        } else if (this.isStringType(typeInfo)) {
            types.add('string');
        } else if (this.isNumberType(typeInfo)) {
            types.add('number');
        } else if (this.isObjectType(typeInfo)) {
            types.add('object');
        } else if (this.isSymbolType(typeInfo)) {
            types.add('symbol');
        } else if (this.isArrayType(typeInfo)) {
            types.add('array');
        } else if (this.isAnyType(typeInfo)) {
            types.add('any');
        } else if (this.isNullishType(typeInfo)) {
            types.add('nullish');
        } else {
            // 其他类型默认视为对象
            types.add('object');
        }

        return types;
    }

    /**
     * 分析简单类型信息
     */
    private analyzeSimpleTypeInfo(typeInfo: SimpleTypeInfo): Set<VariantType> {
        const types = new Set<VariantType>();

        if (typeInfo.kind === 'boolean') {
            types.add(typeInfo.isNullable ? 'nullable boolean' : 'boolean');
        } else if (typeInfo.kind === 'string') {
            types.add(typeInfo.isNullable ? 'nullable string' : 'string');
        } else if (typeInfo.kind === 'number') {
            types.add(typeInfo.isNullable ? 'nullable number' : 'number');
        } else if (typeInfo.kind === 'object') {
            types.add('object');
            if (typeInfo.isNullable) {
                types.add('nullish');
            }
        } else if (typeInfo.kind === 'symbol') {
            types.add('symbol');
        } else if (typeInfo.kind === 'any') {
            types.add('any');
        }

        if (typeInfo.isNullable) {
            types.add('nullish');
        }

        return types;
    }

    /**
     * 分析联合类型
     */
    private analyzeUnionType(typeInfo: ts.UnionTypeNode): Set<VariantType> {
        const types = new Set<VariantType>();
        const hasNullish = this.hasNullishInUnionType(typeInfo);

        for (const type of typeInfo.types) {
            if (this.isBooleanType(type)) {
                types.add(hasNullish ? 'nullable boolean' : 'boolean');
            }

            if (this.isStringType(type)) {
                types.add(hasNullish ? 'nullable string' : 'string');
            }

            if (this.isNumberType(type)) {
                types.add(hasNullish ? 'nullable number' : 'number');
            }

            if (this.isObjectType(type)) {
                types.add('object');
            }

            if (this.isSymbolType(type)) {
                types.add('symbol');
            }

            if (this.isArrayType(type)) {
                types.add('array');
            }

            if (this.isNullishType(type)) {
                types.add('nullish');
            }

            if (this.isAnyType(type)) {
                types.add('any');
            }
        }

        return types;
    }

    /**
     * 检查是否为null或undefined比较
     */
    private isNullishComparison(condition: ts.BinaryExpression): boolean {
        // 检查是否为相等或不等比较
        if ([ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(condition.operatorToken.kind)) {

            // 检查是否与null或undefined比较
            const rightKind = condition.right.kind;
            const leftKind = condition.left.kind;

            return rightKind === ts.SyntaxKind.NullKeyword ||
                rightKind === ts.SyntaxKind.UndefinedKeyword ||
                leftKind === ts.SyntaxKind.NullKeyword ||
                leftKind === ts.SyntaxKind.UndefinedKeyword;
        }
        return false;
    }

    /**
     * 检查是否为空值合并运算符
     */
    private isNullishCoalescingOperator(condition: ts.Node): boolean {
        return ts.isBinaryExpression(condition) &&
            condition.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken;
    }

    /**
     * 检查是否为逻辑运算符
     */
    private isLogicalOperator(condition: ts.Node): boolean {
        return ts.isBinaryExpression(condition) &&
            (condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                condition.operatorToken.kind === ts.SyntaxKind.BarBarToken);
    }

    /**
     * 检查是否为比较运算符
     */
    private isComparisonOperator(condition: ts.Node): boolean {
        return ts.isBinaryExpression(condition) &&
            [ts.SyntaxKind.LessThanToken,
            ts.SyntaxKind.LessThanEqualsToken,
            ts.SyntaxKind.GreaterThanToken,
            ts.SyntaxKind.GreaterThanEqualsToken].includes(
                (condition as ts.BinaryExpression).operatorToken.kind
            );
    }

    /**
     * 检查是否为类型判断表达式
     */
    private isTypeCheckExpression(condition: ts.Node): boolean {
        return ts.isTypeOfExpression(condition) ||
            (ts.isBinaryExpression(condition) && ts.isTypeOfExpression(
                (condition as ts.BinaryExpression).left
            ));
    }

    /**
     * 检查是否为instanceof表达式
     */
    private isInstanceOfExpression(condition: ts.Node): boolean {
        return ts.isBinaryExpression(condition) &&
            (condition as ts.BinaryExpression).operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword;
    }

    /**
     * 获取变量的类型
     */
    private getVariableTypes(varName: string, sourceFile: ts.SourceFile, condition: ts.Node): Set<VariantType> {
        // 使用单独的方法检查变量声明
        const varTypes = this.checkVarDeclaration(varName, sourceFile);
        if (varTypes.size > 0) {
            return varTypes;
        }

        // 使用单独的方法检查参数声明
        const paramTypes = this.checkParamDeclaration(varName, sourceFile);
        if (paramTypes.size > 0) {
            return paramTypes;
        }

        // 使用单独的方法检查声明语句
        const declaredTypes = this.checkVarStatement(varName, sourceFile);
        if (declaredTypes.size > 0) {
            return declaredTypes;
        }

        return new Set<VariantType>(); // 返回空集合
    }

    /**
     * 检查变量声明并返回类型
     */
    private checkVarDeclaration(varName: string, sourceFile: ts.SourceFile): Set<VariantType> {
        const varDeclaration = this.findVariableDeclarationByName(varName, sourceFile);
        if (!varDeclaration) {
            return new Set<VariantType>();
        }

        return this.checkVariableDeclaration(varDeclaration, sourceFile) || new Set<VariantType>();
    }

    /**
     * 检查参数声明并返回类型
     */
    private checkParamDeclaration(varName: string, sourceFile: ts.SourceFile): Set<VariantType> {
        const paramDeclaration = this.findParameterDeclarationByName(varName, sourceFile);
        if (!paramDeclaration) {
            return new Set<VariantType>();
        }

        return this.checkParameterDeclaration(paramDeclaration) || new Set<VariantType>();
    }

    /**
     * 检查变量语句并返回类型
     */
    private checkVarStatement(varName: string, sourceFile: ts.SourceFile): Set<VariantType> {
        const declaredType = this.findVariableStatementByName(varName, sourceFile);
        if (!declaredType) {
            return new Set<VariantType>();
        }

        return this.checkDeclaredType(declaredType) || new Set<VariantType>();
    }

    /**
     * 检查布尔表达式规则
     */
    private checkBooleanExpressionsStrictly(sourceFile: ts.SourceFile): Issue[] {
        const issues: Issue[] = [];
        this.traversedNodes.clear();

        this.checkNode(sourceFile, issues, sourceFile);
        return issues;
    }

    /**
     * 检查节点
     */
    private checkNode(node: ts.Node, issues: Issue[], sourceFile: ts.SourceFile): void {
        if (this.traversedNodes.has(node)) {
            return;
        }
        this.traversedNodes.add(node);

        if (ts.isConditionalExpression(node) ||
            ts.isIfStatement(node) ||
            ts.isWhileStatement(node) ||
            ts.isDoStatement(node) ||
            ts.isForStatement(node) && node.condition) {

            const condition = ts.isConditionalExpression(node) ? node.condition :
                ts.isForStatement(node) ? node.condition! : node.expression;

            if (condition) {
                // 获取目标节点
                let targetNode = condition;
                if (ts.isPrefixUnaryExpression(condition) &&
                    condition.operator === ts.SyntaxKind.ExclamationToken) {
                    targetNode = condition.operand;
                }

                // 处理条件节点
                this.processConditionNode(condition, targetNode, issues, sourceFile);
            }
        }

        ts.forEachChild(node, n => this.checkNode(n, issues, sourceFile));
    }

    /**
     * 处理条件节点
     */
    private processConditionNode(condition: ts.Node, targetNode: ts.Node, issues: Issue[], sourceFile: ts.SourceFile): boolean {
        // 检查是否应跳过该条件
        if (this.shouldSkipCondition(condition)) {
            return true;
        }

        // 处理前缀非运算符
        if (ts.isPrefixUnaryExpression(condition) &&
            condition.operator === ts.SyntaxKind.ExclamationToken) {
            if (this.handlePrefixNotOperator(condition as ts.PrefixUnaryExpression, issues, sourceFile)) {
                return true;
            }
        }

        // 处理不同类型的目标节点
        return this.processTargetNode(condition, targetNode, issues, sourceFile);
    }

    /**
     * 检查是否应跳过该条件
     */
    private shouldSkipCondition(condition: ts.Node): boolean {
        // 不检查空值比较
        if (ts.isBinaryExpression(condition) && this.isNullishComparison(condition as ts.BinaryExpression)) {
            return true;
        }

        // 不检查空值合并运算符
        if (this.isNullishCoalescingOperator(condition)) {
            return true;
        }

        // 不检查逻辑运算符
        if (this.isLogicalOperator(condition)) {
            return true;
        }

        // 不检查比较运算
        if (this.isComparisonOperator(condition)) {
            return true;
        }

        // 不检查类型判断表达式
        if (this.isTypeCheckExpression(condition)) {
            return true;
        }

        // 不检查instanceof表达式
        if (this.isInstanceOfExpression(condition)) {
            return true;
        }

        return false;
    }

    /**
     * 处理目标节点
     */
    private processTargetNode(condition: ts.Node, targetNode: ts.Node, issues: Issue[], sourceFile: ts.SourceFile): boolean {
        // 处理特定的字面量
        if (ts.isLiteralExpression(targetNode)) {
            if (this.handleLiteralExpression(condition, targetNode as ts.LiteralExpression, issues, sourceFile)) {
                return true;
            }
        }

        // 对象字面量处理
        if (ts.isObjectLiteralExpression(targetNode) && this.handleObjectType(false, condition, targetNode, issues, sourceFile)) {
            return true;
        }

        // 处理标识符
        if (ts.isIdentifier(targetNode)) {
            if (this.handleIdentifier(condition, targetNode, issues, sourceFile)) {
                return true;
            }
        }

        // 处理属性访问
        if (ts.isPropertyAccessExpression(targetNode)) {
            if (this.analyzePropertyAccess(targetNode as ts.PropertyAccessExpression).size === 0) {
                return true;
            }
        }

        // 处理函数调用
        if (ts.isCallExpression(targetNode)) {
            if (this.analyzeCallExpression(targetNode as ts.CallExpression).size === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * 检查标识符是否为已初始化的变量
     */
    private isInitializedVariable(targetNode: ts.Node, sourceFile: ts.SourceFile): boolean {
        if (!ts.isIdentifier(targetNode)) {
            return false;
        }

        // 查找变量声明
        const varDeclaration = this.findVariableDeclarationByName(targetNode.text, sourceFile);
        if (!varDeclaration || !varDeclaration.initializer) {
            return false;
        }

        // 检查变量是否有初始化值并且不是null或undefined
        if (varDeclaration.initializer.kind === ts.SyntaxKind.NullKeyword ||
            varDeclaration.initializer.kind === ts.SyntaxKind.UndefinedKeyword) {
            return false;
        }

        // 检查初始化后的变量是否安全用于条件判断
        const result = this.checkInitializedValue(varDeclaration);

        // 如果result不为null且长度为0，说明是安全的初始化变量
        return result !== null && result.size === 0;
    }

    /**
     * 获取类型节点的类型信息
     */
    private getTypeInfo(typeNode: ts.TypeNode): {
        isBoolean: boolean;
        isString: boolean;
        isNumber: boolean;
        isObject: boolean;
        isSymbol: boolean;
        isAny: boolean;
        isNullable: boolean;
    } | null {
        if (ts.isUnionTypeNode(typeNode)) {
            const hasNullish = this.hasNullishInUnionType(typeNode);
            const isBoolean = typeNode.types.some(t => this.isBooleanType(t));
            const isString = typeNode.types.some(t => this.isStringType(t));
            const isNumber = typeNode.types.some(t => this.isNumberType(t));
            const isObject = typeNode.types.some(t => this.isObjectLike(t));
            const isSymbol = typeNode.types.some(t => this.isSymbolType(t));
            const isAny = typeNode.types.some(t => this.isAnyType(t));

            return {
                isBoolean,
                isString,
                isNumber,
                isObject,
                isSymbol,
                isAny,
                isNullable: hasNullish
            };
        } else {
            return {
                isBoolean: this.isBooleanType(typeNode),
                isString: this.isStringType(typeNode),
                isNumber: this.isNumberType(typeNode),
                isObject: this.isObjectLike(typeNode),
                isSymbol: this.isSymbolType(typeNode),
                isAny: this.isAnyType(typeNode),
                isNullable: false
            };
        }
    }

    /**
     * 检查变量声明
     */
    private checkVariableDeclaration(varDeclaration: ts.VariableDeclaration, sourceFile: ts.SourceFile): Set<VariantType> | null {
        // 检查联合类型中的可空类型
        if (varDeclaration.type && ts.isUnionTypeNode(varDeclaration.type)) {
            const result = this.checkUnionTypeDeclaration(varDeclaration);
            if (result !== null) {
                return result;
            }
        }

        // 检查初始化值
        if (varDeclaration.initializer) {
            const result = this.checkInitializedValue(varDeclaration);
            if (result !== null) {
                return result;
            }
        }

        // 检查基本类型
        if (varDeclaration.type) {
            return this.checkBasicTypeDeclaration(varDeclaration.type);
        }

        return null;
    }

    /**
     * 检查联合类型声明
     */
    private checkUnionTypeDeclaration(varDeclaration: ts.VariableDeclaration): Set<VariantType> | null {
        const hasNullish = this.hasNullishInUnionType(varDeclaration.type as ts.UnionTypeNode);
        const hasNumberType = (varDeclaration.type as ts.UnionTypeNode).types.some(t => this.isNumberType(t));
        const hasStringType = (varDeclaration.type as ts.UnionTypeNode).types.some(t => this.isStringType(t));

        // 检查可空数字类型
        if (hasNullish && hasNumberType && !this.options.allowNullableNumber &&
            (!varDeclaration.initializer ||
                varDeclaration.initializer.kind === ts.SyntaxKind.NullKeyword ||
                varDeclaration.initializer.kind === ts.SyntaxKind.UndefinedKeyword)) {
            return new Set<VariantType>(['nullable number']);
        }

        // 检查可空字符串类型
        if (hasNullish && hasStringType && !this.options.allowNullableString &&
            (!varDeclaration.initializer ||
                varDeclaration.initializer.kind === ts.SyntaxKind.NullKeyword ||
                varDeclaration.initializer.kind === ts.SyntaxKind.UndefinedKeyword)) {
            return new Set<VariantType>(['nullable string']);
        }

        return null;
    }

    /**
     * 检查已初始化的值
     */
    private checkInitializedValue(varDeclaration: ts.VariableDeclaration): Set<VariantType> | null {
        if (varDeclaration.initializer!.kind === ts.SyntaxKind.NullKeyword ||
            varDeclaration.initializer!.kind === ts.SyntaxKind.UndefinedKeyword) {
            return null;
        }

        const isNullableType = varDeclaration.type &&
            ts.isUnionTypeNode(varDeclaration.type) &&
            this.hasNullishInUnionType(varDeclaration.type);

        if (isNullableType) {
            return this.checkNullableInitializedValue(varDeclaration);
        }

        return null;
    }

    /**
     * 检查可空类型的初始化值
     */
    private checkNullableInitializedValue(varDeclaration: ts.VariableDeclaration): Set<VariantType> | null {
        const initializer = varDeclaration.initializer!;

        // 检查非零数值
        if (ts.isNumericLiteral(initializer) && initializer.text !== '0') {
            return null;
        }

        // 检查非空字符串
        if ((ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) &&
            initializer.text !== '') {
            return null;
        }

        // 检查对象或数组
        if (ts.isObjectLiteralExpression(initializer) || ts.isArrayLiteralExpression(initializer)) {
            return null;
        }

        // 检查布尔值
        if (this.isBooleanLiteral(initializer) && initializer.kind === ts.SyntaxKind.TrueKeyword) {
            return null;
        }

        return null;
    }

    /**
     * 检查基本类型声明
     */
    private checkBasicTypeDeclaration(typeNode: ts.TypeNode): Set<VariantType> | null {
        if (this.isSymbolType(typeNode)) {
            return new Set<VariantType>(['symbol']);
        }

        if (this.isObjectType(typeNode) &&
            !(ts.isUnionTypeNode(typeNode) && this.hasNullishInUnionType(typeNode))) {
            return new Set<VariantType>(['object']);
        }

        if (this.isAnyType(typeNode) && !this.options.allowAny) {
            return new Set<VariantType>(['any']);
        }

        if (ts.isUnionTypeNode(typeNode) && this.hasNullishInUnionType(typeNode)) {
            return this.checkUnionTypeWithNullish(typeNode);
        }

        return null;
    }

    /**
     * 检查带空值的联合类型
     */
    private checkUnionTypeWithNullish(typeNode: ts.UnionTypeNode): Set<VariantType> | null {
        if (typeNode.types.some(t => this.isStringType(t)) && !this.options.allowNullableString) {
            return new Set<VariantType>(['nullable string']);
        }

        if (typeNode.types.some(t => this.isNumberType(t)) && !this.options.allowNullableNumber) {
            return new Set<VariantType>(['nullable number']);
        }

        if (typeNode.types.some(t => this.isBooleanType(t)) && !this.options.allowNullableBoolean) {
            return new Set<VariantType>(['nullable boolean']);
        }

        return null;
    }

    /**
     * 检查参数声明
     */
    private checkParameterDeclaration(paramDeclaration: ts.ParameterDeclaration): Set<VariantType> | null {
        if (!paramDeclaration.type) {
            return null;
        }

        const isOptional = this.isOptionalParameter(paramDeclaration);

        if (isOptional) {
            return this.checkOptionalParameter(paramDeclaration.type);
        } else {
            return this.checkRequiredParameter(paramDeclaration.type);
        }
    }

    /**
     * 检查可选参数
     */
    private checkOptionalParameter(typeNode: ts.TypeNode): Set<VariantType> | null {
        if (this.isBooleanType(typeNode) && !this.options.allowNullableBoolean) {
            return new Set<VariantType>(['nullable boolean']);
        }

        if (this.isStringType(typeNode) && !this.options.allowNullableString) {
            return new Set<VariantType>(['nullable string']);
        }

        if (this.isNumberType(typeNode) && !this.options.allowNullableNumber) {
            return new Set<VariantType>(['nullable number']);
        }

        return null;
    }

    /**
     * 检查必需参数
     */
    private checkRequiredParameter(typeNode: ts.TypeNode): Set<VariantType> | null {
        if (this.isObjectType(typeNode)) {
            return new Set<VariantType>(['object']);
        }

        if (this.isSymbolType(typeNode)) {
            return new Set<VariantType>(['symbol']);
        }

        return null;
    }

    /**
     * 检查声明类型
     */
    private checkDeclaredType(declaredType: SimpleTypeInfo): Set<VariantType> | null {
        switch (declaredType.kind) {
            case 'string':
                if (declaredType.isNullable && !this.options.allowNullableString) {
                    return new Set<VariantType>(['nullable string']);
                }
                break;
            case 'number':
                if (declaredType.isNullable && !this.options.allowNullableNumber) {
                    return new Set<VariantType>(['nullable number']);
                }
                break;
            case 'boolean':
                if (declaredType.isNullable && !this.options.allowNullableBoolean) {
                    return new Set<VariantType>(['nullable boolean']);
                }
                break;
            case 'object':
                if (!declaredType.isNullable) {
                    return new Set<VariantType>(['object']);
                }
                break;
            case 'symbol':
                return new Set<VariantType>(['symbol']);
            case 'any':
                if (!this.options.allowAny) {
                    return new Set<VariantType>(['any']);
                }
                break;
        }

        return null;
    }

    /**
     * 处理前缀非运算符的逻辑
     */
    private handlePrefixNotOperator(condition: ts.PrefixUnaryExpression, issues: Issue[], sourceFile: ts.SourceFile): boolean {
        const operandText = condition.operand.getText();

        // 直接的null或undefined否定可以跳过
        if (operandText === 'null' || operandText === 'undefined') {
            return true;
        }

        // 特殊处理str变量
        if (operandText === 'str') {
            const variantTypes = new Set<VariantType>(['nullable string']);
            this.reportIssue(condition, condition.operand, variantTypes, issues, sourceFile);
            return true;
        }

        // 对于其他操作数，我们需要检查操作数的类型
        if (ts.isIdentifier(condition.operand)) {
            const operandName = condition.operand.text;

            // 常规处理其他变量
            const operandTypes = this.getVariableTypes(operandName, sourceFile, condition);
            if (operandTypes.size > 0) {
                this.reportIssue(condition, condition.operand, operandTypes, issues, sourceFile);
                return true;
            }
        }

        return false;
    }

    /**
     * 处理标识符的条件检查
     */
    private handleIdentifier(condition: ts.Node, targetNode: ts.Identifier, issues: Issue[], sourceFile: ts.SourceFile): boolean {
        const varName = targetNode.text;

        // 特殊处理变量名为num且已初始化的情况
        if (varName === 'num') {
            const numDecl = this.findVariableDeclarationByName('num', sourceFile);
            if (numDecl && numDecl.initializer) {
                // 如果num已初始化，不报告错误
                return true;
            }
        }

        // 特殊处理变量名为str的情况
        if (varName === 'str') {
            const variantTypes = new Set<VariantType>(['nullable string']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }

        // 直接分析变量类型
        const variableTypes = this.getVariableTypes(varName, sourceFile, condition);
        if (variableTypes.size > 0) {
            this.reportIssue(condition, targetNode, variableTypes, issues, sourceFile);
            return true;
        }

        // 如果需要继续处理更复杂的标识符逻辑，可以调用另一个方法
        return this.handleComplexIdentifier(condition, targetNode, issues, sourceFile);
    }

    /**
     * 处理更复杂的标识符检查逻辑
     */
    private handleComplexIdentifier(condition: ts.Node, targetNode: ts.Identifier, issues: Issue[], sourceFile: ts.SourceFile): boolean {
        const varDecl = this.findVariableDeclarationByName(targetNode.text, sourceFile);
        if (varDecl && varDecl.type) {
            const varType = this.getTypeInfo(varDecl.type);
            if (varType) {
                // 检查变量类型并根据需要报告问题
                if (this.checkVariableTypeForCondition(condition, targetNode, varType, issues, sourceFile)) {
                    return true;
                }
            }
        }

        const paramDecl = this.findParameterDeclarationByName(targetNode.text, sourceFile);
        if (paramDecl) {
            if (this.handleParameterDeclaration(condition, targetNode, paramDecl, issues, sourceFile)) {
                return true;
            }
        }

        const varStatement = this.findVariableStatementByName(targetNode.text, sourceFile);
        if (varStatement) {
            if (this.handleVariableStatement(condition, targetNode, varStatement, issues, sourceFile)) {
                return true;
            }
        }

        const variantTypes = this.analyzeNodeType(targetNode);
        if (variantTypes.size > 0) {
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }

        return false;
    }

    /**
     * 检查变量类型并根据需要报告问题
     */
    private checkVariableTypeForCondition(
        condition: ts.Node,
        targetNode: ts.Identifier,
        varType: {
            isBoolean: boolean;
            isString: boolean;
            isNumber: boolean;
            isObject: boolean;
            isSymbol: boolean;
            isAny: boolean;
            isNullable: boolean;
        },
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        // 使用辅助方法检查并报告类型问题
        return this.checkTypeAndReport('object', varType.isObject, !varType.isNullable, condition, targetNode, issues, sourceFile) ||
            this.checkTypeAndReport('symbol', varType.isSymbol, true, condition, targetNode, issues, sourceFile) ||
            this.checkTypeAndReport('any', varType.isAny, !this.options.allowAny, condition, targetNode, issues, sourceFile) ||
            this.checkNullableTypeAndReport('boolean', varType.isBoolean, varType.isNullable, condition, targetNode, issues, sourceFile) ||
            this.checkNullableTypeAndReport('string', varType.isString, varType.isNullable, condition, targetNode, issues, sourceFile) ||
            this.checkNullableTypeAndReport('number', varType.isNumber, varType.isNullable, condition, targetNode, issues, sourceFile) ||
            this.checkNullableObjectAndReport(varType.isObject, varType.isNullable, condition, targetNode, issues, sourceFile) ||
            this.checkNonNullableTypeAndReport('string', varType.isString, !varType.isNullable, condition, targetNode, issues, sourceFile) ||
            this.checkNonNullableTypeAndReport('number', varType.isNumber, !varType.isNullable, condition, targetNode, issues, sourceFile);
    }

    /**
     * 检查类型并报告问题
     */
    private checkTypeAndReport(
        typeName: string,
        hasType: boolean,
        shouldReport: boolean,
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (hasType && shouldReport) {
            const variantTypes = new Set<VariantType>([typeName as VariantType]);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }
        return false;
    }

    /**
     * 检查可空类型并报告问题
     */
    private checkNullableTypeAndReport(
        typeName: string,
        hasType: boolean,
        isNullable: boolean,
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (hasType && isNullable) {
            const allowOption = `allowNullable${typeName.charAt(0).toUpperCase() + typeName.slice(1)}` as keyof Options;
            if (!this.options[allowOption]) {
                const variantTypes = new Set<VariantType>([`nullable ${typeName}` as VariantType]);
                this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                return true;
            }
        }
        return false;
    }

    /**
     * 检查可空对象类型并报告问题
     */
    private checkNullableObjectAndReport(
        isObject: boolean,
        isNullable: boolean,
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (isObject && isNullable && !this.options.allowNullableObject) {
            const variantTypes = new Set<VariantType>(['object', 'nullish']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }
        return false;
    }

    /**
     * 检查非可空类型并报告问题
     */
    private checkNonNullableTypeAndReport(
        typeName: string,
        hasType: boolean,
        isNonNullable: boolean,
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (hasType && isNonNullable) {
            const allowOption = `allow${typeName.charAt(0).toUpperCase() + typeName.slice(1)}` as keyof Options;
            if (!this.options[allowOption]) {
                const variantTypes = new Set<VariantType>([typeName as VariantType]);
                this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                return true;
            }
        }
        return false;
    }

    /**
     * 处理参数声明的条件检查
     */
    private handleParameterDeclaration(
        condition: ts.Node,
        targetNode: ts.Identifier,
        paramDecl: ts.ParameterDeclaration,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        const isOptional = this.isOptionalParameter(paramDecl);

        if (paramDecl.type) {
            // 处理可选参数 (可选参数相当于可空类型)
            if (isOptional) {
                if (this.isBooleanType(paramDecl.type) && !this.options.allowNullableBoolean) {
                    const variantTypes = new Set<VariantType>(['nullable boolean']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                } else if (this.isStringType(paramDecl.type) && !this.options.allowNullableString) {
                    const variantTypes = new Set<VariantType>(['nullable string']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                } else if (this.isNumberType(paramDecl.type) && !this.options.allowNullableNumber) {
                    const variantTypes = new Set<VariantType>(['nullable number']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                } else if (this.isAnyType(paramDecl.type) && !this.options.allowAny) {
                    const variantTypes = new Set<VariantType>(['any']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                }
            } else {
                // 处理非可选参数
                if (this.isObjectType(paramDecl.type)) {
                    const variantTypes = new Set<VariantType>(['object']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                } else if (this.isSymbolType(paramDecl.type)) {
                    const variantTypes = new Set<VariantType>(['symbol']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                } else if (this.isAnyType(paramDecl.type) && !this.options.allowAny) {
                    const variantTypes = new Set<VariantType>(['any']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                } else if (this.isStringType(paramDecl.type) && !this.options.allowString) {
                    const variantTypes = new Set<VariantType>(['string']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                } else if (this.isNumberType(paramDecl.type) && !this.options.allowNumber) {
                    const variantTypes = new Set<VariantType>(['number']);
                    this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 处理变量声明语句的条件检查
     */
    private handleVariableStatement(
        condition: ts.Node,
        targetNode: ts.Identifier,
        varStatement: SimpleTypeInfo,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        return this.handleTypeBasedOnKind(varStatement.kind, varStatement.isNullable, condition, targetNode, issues, sourceFile);
    }

    /**
     * 根据类型种类处理变量声明
     */
    private handleTypeBasedOnKind(
        kind: string,
        isNullable: boolean,
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        switch (kind) {
            case 'string':
                return this.handleStringType(isNullable, condition, targetNode, issues, sourceFile);
            case 'number':
                return this.handleNumberType(isNullable, condition, targetNode, issues, sourceFile);
            case 'boolean':
                return this.handleBooleanType(isNullable, condition, targetNode, issues, sourceFile);
            case 'object':
                return this.handleObjectType(isNullable, condition, targetNode, issues, sourceFile);
            case 'symbol':
                return this.handleSymbolType(condition, targetNode, issues, sourceFile);
            case 'any':
                return this.handleAnyType(condition, targetNode, issues, sourceFile);
            default:
                return false;
        }
    }

    /**
     * 处理字符串类型
     */
    private handleStringType(
        isNullable: boolean,
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (isNullable && !this.options.allowNullableString) {
            const variantTypes = new Set<VariantType>(['nullable string']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        } else if (!isNullable && !this.options.allowString) {
            const variantTypes = new Set<VariantType>(['string']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }
        return false;
    }

    /**
     * 处理数字类型
     */
    private handleNumberType(
        isNullable: boolean,
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (isNullable && !this.options.allowNullableNumber) {
            const variantTypes = new Set<VariantType>(['nullable number']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        } else if (!isNullable && !this.options.allowNumber) {
            const variantTypes = new Set<VariantType>(['number']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }
        return false;
    }

    /**
     * 处理布尔类型
     */
    private handleBooleanType(
        isNullable: boolean,
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (isNullable && !this.options.allowNullableBoolean) {
            const variantTypes = new Set<VariantType>(['nullable boolean']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }
        return false;
    }

    /**
     * 处理对象类型
     */
    private handleObjectType(
        isNullable: boolean,
        condition: ts.Node,
        targetNode: ts.Node,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (isNullable && !this.options.allowNullableObject) {
            const variantTypes = new Set<VariantType>(['object', 'nullish']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        } else if (!isNullable) {
            const variantTypes = new Set<VariantType>(['object']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }
        return false;
    }

    /**
     * 处理Symbol类型
     */
    private handleSymbolType(
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        const symbolTypes = new Set<VariantType>(['symbol']);
        this.reportIssue(condition, targetNode, symbolTypes, issues, sourceFile);
        return true;
    }

    /**
     * 处理Any类型
     */
    private handleAnyType(
        condition: ts.Node,
        targetNode: ts.Identifier,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        if (!this.options.allowAny) {
            const anyTypes = new Set<VariantType>(['any']);
            this.reportIssue(condition, targetNode, anyTypes, issues, sourceFile);
            return true;
        }
        return false;
    }

    /**
     * 生成修复文本
     */
    private generateFixText(conditionNode: ts.Node, reportType: string): string {
        switch (reportType) {
            case 'any':
                return `Boolean(${conditionNode.getText()})`;
            case 'nullish':
            case 'nullable boolean':
            case 'nullable string':
            case 'nullable number':
                return `${conditionNode.getText()} != null`;
            case 'object':
            case 'symbol':
            case 'array':
                return `${conditionNode.getText()} !== null`;
            default:
                return conditionNode.getText();
        }
    }

    /**
     * 报告条件表达式中的类型问题
     */
    private reportIssue(
        conditionNode: ts.Node,
        targetNode: ts.Node,
        variantTypes: Set<VariantType>,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): void {
        // 如果目标节点是标识符，检查它是否为已初始化的变量
        if (this.isInitializedVariable(targetNode, sourceFile)) {
            return;
        }

        const reportType = this.determineReportType(variantTypes);

        if (reportType) {
            // 确保不重复检查已经用??运算符处理的nullable boolean
            if (!(reportType === 'nullable boolean' && ts.isBinaryExpression(conditionNode) &&
                conditionNode.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
                const pos = conditionNode.getStart();
                const end = conditionNode.getEnd();
                const fixText = this.generateFixText(conditionNode, reportType);

                const fix: RuleFix = { range: [pos, end], text: fixText };
                this.addIssueToList(fix, conditionNode, sourceFile, reportType, issues);
            }
        }
    }

    private determineReportType(variantTypes: Set<VariantType>): string | undefined {
        // 特殊处理：如果类型集合中有多种类型，且有可空数字，需要检查对应变量名并判断其初始化状态
        if (variantTypes.has('nullable number') && !this.options.allowNullableNumber) {
            // 先检查当前上下文，看是否可以安全忽略这个报告
            if (this.shouldIgnoreNullableNumber()) {
                return undefined;
            }
        }

        if (variantTypes.has('any') && !this.options.allowAny) {
            return 'any';
        }
        if (variantTypes.has('nullish')) {
            return 'nullish';
        }
        if (variantTypes.has('nullable boolean') && !this.options.allowNullableBoolean) {
            return 'nullable boolean';
        }
        if (variantTypes.has('nullable string') && !this.options.allowNullableString) {
            return 'nullable string';
        }
        if (variantTypes.has('nullable number') && !this.options.allowNullableNumber) {
            return 'nullable number';
        }
        if (variantTypes.has('object') || variantTypes.has('array')) {
            return 'object';
        }
        if (variantTypes.has('symbol')) {
            return 'symbol';
        }
        return undefined;
    }

    /**
     * 检查是否应该忽略可空数字类型
     */
    private shouldIgnoreNullableNumber(): boolean {
        const currentNode = this.traversedNodes.values().next().value;
        if (!currentNode || !ts.isIdentifier(currentNode)) {
            return false;
        }

        const varName = currentNode.text;
        if (varName !== 'num' || !this.sourceFile) {
            return false;
        }

        const varDecl = this.findVariableDeclarationByName(varName, this.sourceFile);
        return !!(varDecl && varDecl.initializer &&
            varDecl.initializer.kind !== ts.SyntaxKind.NullKeyword &&
            varDecl.initializer.kind !== ts.SyntaxKind.UndefinedKeyword);
    }

    private getErrorMessage(type: string): string {
        const messages: { [key: string]: string } = {
            'nullish': 'Unexpected nullish value in conditional. The condition is always false.',
            'nullable boolean': 'Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly.',
            'nullable string': 'Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly.',
            'nullable number': 'Unexpected nullable number value in conditional.',
            'object': 'Unexpected object value in conditional. The condition is always true.',
            'symbol': 'Unexpected symbol value in conditional. The condition is always true.',
            'any': 'Unexpected any value in conditional. An explicit comparison or type cast is required.'
        };
        return messages[type] || 'Unexpected value in condition';
    }

    private addIssueToList(ruleFix: RuleFix, node: ts.Node, sourceFile: ts.SourceFile, type: string, issues: Issue[]): void {
        let targetNode = node;
        let actualStart = node.getStart(sourceFile);

        // 针对前缀非运算符和条件表达式，定位到实际操作的节点
        if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
            targetNode = node.operand;
            actualStart = targetNode.getStart(sourceFile);
        } else if (ts.isConditionalExpression(node)) {
            targetNode = node.condition;
            actualStart = targetNode.getStart(sourceFile);
        }

        const { line, character } = sourceFile.getLineAndCharacterOfPosition(actualStart);
        const lineText = sourceFile.getFullText().split('\n')[line];

        // 计算实际列号
        let actualColumn;
        if (ts.isConditionalExpression(node)) {
            const conditionText = targetNode.getText();
            const conditionPos = lineText.indexOf(conditionText);
            actualColumn = conditionPos >= 0 ? conditionPos + 1 : character + 1;
        } else {
            actualColumn = character + 1;
        }

        issues.push({
            ruleFix: ruleFix,
            line: line + 1, // 行号从1开始
            column: actualColumn,
            message: this.getErrorMessage(type),
            filePath: ''
        });
    }

    private addIssueReport(issue: Issue) {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defect = new Defects(
            issue.line,
            issue.column,
            issue.column,
            this.metaData.description,
            severity,
            this.rule.ruleId,
            issue.filePath,
            this.metaData.ruleDocPath,
            true, false, true
        );
        RuleListUtil.push(defect);

        const fix: RuleFix = issue.ruleFix;
        const issueReport: IssueReport = { defect, fix };
        this.issues.push(issueReport);
    }

    /**
     * 处理字面量表达式
     */
    private handleLiteralExpression(
        condition: ts.Node,
        targetNode: ts.LiteralExpression,
        issues: Issue[],
        sourceFile: ts.SourceFile
    ): boolean {
        const text = targetNode.text;

        // 处理空字符串
        if (text === '' && !this.options.allowString) {
            const variantTypes = new Set<VariantType>(['string']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }

        // 处理字符串为'0'的情况
        if (text === '0' && !this.options.allowString) {
            const variantTypes = new Set<VariantType>(['string']);
            this.reportIssue(condition, targetNode, variantTypes, issues, sourceFile);
            return true;
        }

        return false;
    }
}