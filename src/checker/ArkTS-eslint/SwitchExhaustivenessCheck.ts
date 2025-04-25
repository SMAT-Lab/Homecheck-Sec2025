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

type Options = [{
    allowDefaultCaseForExhaustiveSwitch?: boolean;
    requireDefaultForNonUnion?: boolean;
}];

interface SwitchMetadata {
    missingCases: string[];
    hasDefaultCase: boolean;
    isUnionType: boolean;
    isEnumType: boolean;
    isNumericLiteralType: boolean;
    coveredValues: Set<string>;
    possibleValues: string[];
    discriminantName: string;
}

export class SwitchExhaustivenessCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/switch-exhaustiveness-check.md',
        description: 'Enforce exhaustive checks in switch statements'
    };

    private defaultOptions: Options = [{
        allowDefaultCaseForExhaustiveSwitch: true,
        requireDefaultForNonUnion: false
    }];

    public rule!: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    public registerMatchers(): MatcherCallback[] {
        return [{
            matcher: { matcherType: MatcherTypes.FILE },
            callback: this.check
        }];
    }

    public check = (target: ArkFile): void => {
        if (!(target instanceof ArkFile)) {
            return;
        };
        const ast = AstTreeUtils.getSourceFileFromArkFile(target);
        if (!ast) {
            return;
        }
        this.traverseAST(ast, target);
    };

    private traverseAST(node: ts.Node, arkFile: ArkFile): void {
        if (ts.isSwitchStatement(node)) {
            const metadata = this.analyzeSwitch(node, arkFile);
            this.validateSwitch(node, metadata, arkFile);
        };
        ts.forEachChild(node, child => this.traverseAST(child, arkFile));
    };

    private analyzeSwitch(node: ts.SwitchStatement, arkFile: ArkFile): SwitchMetadata {
        const discriminant = node.expression;
        const discriminantName = this.getDiscriminantName(discriminant);
        const possibleValues = this.getPossibleValues(discriminant, arkFile);
        const coveredValues = this.getCoveredValues(node);
        const isUnionType = this.isUnionTypeOrEnum(discriminant, arkFile);
        const isEnumType = this.isEnumType(discriminant, arkFile);
        const isNumericLiteralType = this.isVariableOfNumericLiteralType(discriminant, arkFile);
        // 添加被切换的变量的实际值
        const actualValue = this.getActualValue(discriminant, arkFile);
        if (actualValue && !possibleValues.includes(actualValue)) {
            possibleValues.push(actualValue);
        };
        // 通过比较可能的值和已覆盖的值来查找缺失的情况
        const missingCases = possibleValues.filter(value => !coveredValues.has(value));
        return {
            missingCases,
            hasDefaultCase: this.hasDefaultCase(node),
            isUnionType,
            isEnumType,
            isNumericLiteralType,
            coveredValues,
            possibleValues,
            discriminantName
        };
    };

    private isVariableOfNumericLiteralType(
        expr: ts.Expression,
        arkFile: ArkFile
    ): boolean {
        if (!ts.isIdentifier(expr)) {
            return false;
        };
        // 1. 查找变量声明
        const declaration = this.findDeclaration(expr.text, arkFile);
        if (!declaration) {
            return false;
        };
        // 2. 获取类型注解节点
        const typeNode = this.getTypeNodeFromDeclaration(declaration);
        if (!typeNode) {
            return false;
        };
        // 3. 递归检查类型节点
        return this.checkIsNumericLiteralType(typeNode, arkFile);
    };

    private checkIsNumericLiteralType(
        typeNode: ts.TypeNode,
        arkFile: ArkFile
    ): boolean {
        // 情况1：直接是数字字面量类型（如 : 1）
        if (ts.isLiteralTypeNode(typeNode)) {
            return ts.isNumericLiteral(typeNode.literal);
        };
        // 情况2：类型引用（如 type MyNum = 1）
        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText();
            const typeAlias = this.findTypeAliasDeclaration(typeName, arkFile);
            return typeAlias ? this.checkIsNumericLiteralType(typeAlias.type, arkFile) : false;
        };
        // 情况3：联合类型中的字面量（如 : 1 | 2）
        if (ts.isUnionTypeNode(typeNode)) {
            return typeNode.types.some(t => this.checkIsNumericLiteralType(t, arkFile));
        };
        return false;
    };

    private getDiscriminantName(expr: ts.Expression): string {
        if (ts.isIdentifier(expr)) {
            return expr.text;
        };
        return '';
    };

    private isEnumType(expr: ts.Expression, arkFile: ArkFile): boolean {
        if (!ts.isIdentifier(expr)) {
            return false;
        };
        // 1. 找到变量/参数声明
        const varDeclaration = this.findDeclaration(expr.text, arkFile);
        if (!varDeclaration) {
            return false;
        };
        // 2. 提取声明的类型注解
        const typeNode = this.getTypeNodeFromDeclaration(varDeclaration);
        if (!typeNode) {
            return false;
        };
        // 3. 深度检查类型节点
        return this.checkTypeIsEnum(typeNode, arkFile);
    };

    private checkTypeIsEnum(typeNode: ts.TypeNode, arkFile: ArkFile): boolean {
        // 情况1：直接是枚举引用（如 Fruit）
        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText();
            const enumDecl = this.findEnumDeclaration(typeName, arkFile);
            if (enumDecl) {
                return true;
            };
            // 处理类型别名（如 type MyFruit = Fruit）
            const typeAlias = this.findTypeAliasDeclaration(typeName, arkFile);
            return typeAlias ? this.checkTypeIsEnum(typeAlias.type, arkFile) : false;
        };
        // 情况2：类型别名或复杂类型
        if (ts.isTypeAliasDeclaration(typeNode)) {
            return this.checkTypeIsEnum(typeNode.type, arkFile);
        };
        return false;
    };

    private getPossibleValues(expr: ts.Expression, arkFile: ArkFile): string[] {
        // 首先，尝试处理枚举
        if (ts.isIdentifier(expr)) {
            // 检查直接枚举引用（例如，switch(fruit) 中的 fruit）
            const enumDecl = this.findEnumDeclaration(expr.text, arkFile);
            if (enumDecl) {
                return this.getEnumValues(enumDecl);
            };
            // 检查带有字符串字面量联合的类型别名
            const typeValues = this.getTypeReferenceValues(expr.text, arkFile);
            if (typeValues.length > 0) {
                return typeValues;
            };
            // 检查带有类型注解的变量声明
            const declaration = this.findDeclaration(expr.text, arkFile);
            if (declaration) {
                if (this.getDeclarationTypeNodeValues(declaration, arkFile) !== undefined) {
                    return this.getDeclarationTypeNodeValues(declaration, arkFile) as string[];
                };
            };
        };
        return [];
    }

    private getDeclarationTypeNodeValues(declaration: ts.Declaration, arkFile: ArkFile): string[] | undefined {
        const typeNode = this.getTypeNodeFromDeclaration(declaration);
        if (typeNode) {
            if (ts.isUnionTypeNode(typeNode)) {
                return this.getUnionTypeValues(typeNode);
            };
            if (ts.isTypeReferenceNode(typeNode)) {
                const typeName = typeNode.typeName.getText();
                return this.getTypeReferenceValues(typeName, arkFile);
            };
        };
        return undefined;
    };

    private getTypeReferenceValues(typeName: string, arkFile: ArkFile): string[] {
        // 查找类型别名声明
        const typeAlias = this.findTypeAliasDeclaration(typeName, arkFile);
        if (typeAlias) {
            if (ts.isUnionTypeNode(typeAlias.type)) {
                return this.getUnionTypeValues(typeAlias.type);
            };
        };
        // 检查是否引用了一个枚举
        const enumDecl = this.findEnumDeclaration(typeName, arkFile);
        if (enumDecl) {
            return this.getEnumValues(enumDecl);
        };
        return [];
    };

    private getTypeNodeFromDeclaration(declaration: ts.Declaration): ts.TypeNode | undefined {
        if (ts.isVariableDeclaration(declaration)) {
            // CASE 1：显式类型注解（如 const a: 1 = 0）
            if (declaration.type) {
                return declaration.type;
            }
            // CASE 2：无类型注解时，通过初始值推断
            else if (declaration.initializer) {
                return this.inferTypeFromInitializer(declaration.initializer);
            };
        };
        if (ts.isParameter(declaration) && declaration.type) {
            return declaration.type;
        };
        if (ts.isTypeAliasDeclaration(declaration)) {
            return declaration.type;
        };
        return undefined;
    }

    private inferTypeFromInitializer(initializer: ts.Expression): ts.TypeNode | undefined {
        // 处理数字字面量（如 const a = 0）
        if (ts.isNumericLiteral(initializer)) {
            return ts.factory.createLiteralTypeNode(
                ts.factory.createNumericLiteral(initializer.text)
            );
        };
        // 处理字符串字面量（如 const b = "hello"）
        if (ts.isStringLiteral(initializer)) {
            return ts.factory.createLiteralTypeNode(
                ts.factory.createStringLiteral(initializer.text)
            );
        };
        // 处理布尔字面量（如 const c = true）
        if (initializer.kind === ts.SyntaxKind.TrueKeyword) {
            return ts.factory.createLiteralTypeNode(
                ts.factory.createToken(ts.SyntaxKind.TrueKeyword)
            );
        };
        if (initializer.kind === ts.SyntaxKind.FalseKeyword) {
            return ts.factory.createLiteralTypeNode(
                ts.factory.createToken(ts.SyntaxKind.FalseKeyword)
            );
        };
        // 其他复杂情况（如对象、函数等）暂不处理
        return undefined;
    }

    private getUnionTypeValues(unionNode: ts.UnionTypeNode): string[] {
        const values: string[] = [];
        for (const typeNode of unionNode.types) {
            if (ts.isLiteralTypeNode(typeNode)) {
                const literal = typeNode.literal;
                if (ts.isStringLiteral(literal)) {
                    values.push(`'${literal.text}'`);
                } else if (ts.isNumericLiteral(literal)) {
                    values.push(literal.text);
                } else if (
                    literal.kind === ts.SyntaxKind.TrueKeyword ||
                    literal.kind === ts.SyntaxKind.FalseKeyword
                ) {
                    values.push(literal.kind === ts.SyntaxKind.TrueKeyword ? 'true' : 'false');
                };
            };
        };
        return values;
    };

    private visitDeclarationList = (name: string, node: ts.VariableStatement): ts.Declaration | undefined => {
        let result: ts.Declaration | undefined;
        const hasDeclareModifier = node.modifiers?.some(
            mod => mod.kind === ts.SyntaxKind.DeclareKeyword
        );
        if (hasDeclareModifier) {
            for (const decl of node.declarationList.declarations) {
                if (ts.isIdentifier(decl.name) && decl.name.text === name) {
                    result = decl;
                    return result;
                };
            };
        };
        return result;
    };

    private findDeclaration(name: string, arkFile: ArkFile): ts.Declaration | undefined {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        let result: ts.Declaration | undefined;
        const visit = (node: ts.Node): void => {
            if (result) {
                return;
            }
            // 变量声明
            if (ts.isVariableDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === name) {
                result = node;
                return;
            }
            // 参数声明
            if (ts.isParameter(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === name) {
                result = node;
                return;
            }
            // 寻找 'declare const' 语句
            if (ts.isVariableStatement(node)) {
                result = this.visitDeclarationList(name, node);
            };
            ts.forEachChild(node, visit);
        };
        if (sourceFile) {
            ts.forEachChild(sourceFile, visit);
        };
        return result;
    };

    private findTypeAliasDeclaration(name: string, arkFile: ArkFile): ts.TypeAliasDeclaration | undefined {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        let result: ts.TypeAliasDeclaration | undefined;
        const visit = (node: ts.Node): void => {
            if (result) {
                return;
            };
            if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
                result = node;
                return;
            };
            ts.forEachChild(node, visit);
        };
        if (sourceFile) {
            ts.forEachChild(sourceFile, visit);
        };
        return result;
    };

    private findEnumDeclaration(name: string, arkFile: ArkFile): ts.EnumDeclaration | undefined {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        let result: ts.EnumDeclaration | undefined;
        const visit = (node: ts.Node): void => {
            if (result) {
                return;
            }
            if (ts.isEnumDeclaration(node) && node.name.text === name) {
                result = node;
                return;
            };
            ts.forEachChild(node, visit);
        };
        if (sourceFile) {
            ts.forEachChild(sourceFile, visit);
        };
        return result;
    };

    private getEnumValues(enumDecl: ts.EnumDeclaration): string[] {
        const enumName = enumDecl.name.text;
        const values: string[] = [];
        // 同时存储枚举.成员和原始值格式
        for (const member of enumDecl.members) {
            const memberName = ts.isIdentifier(member.name)
                ? member.name.text
                : ts.isStringLiteral(member.name)
                    ? member.name.text
                    : '';
            if (memberName) {
                // 添加枚举.成员格式
                values.push(`${enumName}.${memberName}`);
                // 如果是字符串或数字字面量，也添加原始值
                if (member.initializer && ts.isStringLiteral(member.initializer)) {
                    values.push(`'${member.initializer.text}'`);
                } else if (member.initializer && ts.isNumericLiteral(member.initializer)) {
                    values.push(member.initializer.text);
                } else if (!member.initializer) {
                    // 如果没有初始化器，对于数字枚举，使用索引作为值
                    // 例如 enum Fruit { Apple, Banana, Cherry }
                    const index = enumDecl.members.indexOf(member);
                    values.push(index.toString());
                };
            };
        };
        return values;
    };

    private getCoveredValues(node: ts.SwitchStatement): Set<string> {
        const values = new Set<string>();
        for (const clause of node.caseBlock.clauses) {
            if (!ts.isCaseClause(clause)) {
                continue;
            };
            const caseValue = this.extractCaseValue(clause.expression);
            if (caseValue) {
                values.add(caseValue);
            };
        };
        return values;
    };

    private extractCaseValue(expr: ts.Expression): string | null {
        // 处理属性访问表达式（例如，Enum.Member）
        if (ts.isPropertyAccessExpression(expr)) {
            return expr.getText();
        };
        // 处理字符串字面量
        if (ts.isStringLiteral(expr)) {
            return `'${expr.text}'`;
        };
        // 处理数字字面量
        if (ts.isNumericLiteral(expr)) {
            return expr.text;
        };
        // 处理标识符
        if (ts.isIdentifier(expr)) {
            return expr.text;
        };
        // 处理 true/false/null 字面量
        if (expr.kind === ts.SyntaxKind.TrueKeyword) {
            return 'true';
        };
        if (expr.kind === ts.SyntaxKind.FalseKeyword) {
            return 'false';
        };
        if (expr.kind === ts.SyntaxKind.NullKeyword) {
            return 'null';
        };
        return null;
    };

    private isUnionTypeOrEnum(expr: ts.Expression, arkFile: ArkFile): boolean {
        // 检查是否为枚举引用
        if (ts.isIdentifier(expr)) {
            const enumDecl = this.findEnumDeclaration(expr.text, arkFile);
            if (enumDecl) {
                return true;
            };
            // 检查联合类型
            const declaration = this.findDeclaration(expr.text, arkFile);
            if (declaration) {
                if (this.checkTypeNodeFromDeclaration(declaration, arkFile) !== undefined) {
                    return this.checkTypeNodeFromDeclaration(declaration, arkFile) as boolean;
                };
            };
            // 检查带有联合类型的类型别名
            const typeAlias = this.findTypeAliasDeclaration(expr.text, arkFile);
            if (typeAlias && ts.isUnionTypeNode(typeAlias.type)) {
                return true;
            };
        };
        return false;
    };

    private checkTypeNodeFromDeclaration(declaration: ts.Declaration, arkFile: ArkFile): boolean | undefined {
        const typeNode = this.getTypeNodeFromDeclaration(declaration);
        if (typeNode) {
            if (ts.isUnionTypeNode(typeNode)) {
                return true;
            };
            if (ts.isTypeReferenceNode(typeNode)) {
                const typeName = typeNode.typeName.getText();
                const typeAlias = this.findTypeAliasDeclaration(typeName, arkFile);
                return typeAlias ? ts.isUnionTypeNode(typeAlias.type) : false;
            };
        };
        return undefined;
    };

    private hasDefaultCase(node: ts.SwitchStatement): boolean {
        return node.caseBlock.clauses.some(clause => ts.isDefaultClause(clause));
    };

    private validateSwitch(node: ts.SwitchStatement, metadata: SwitchMetadata, arkFile: ArkFile): void {
        const options = this.getCurrentOptions();
        // 组合检查：非穷尽性 switch 和无效的 case 值
        if (metadata.missingCases.length > 0 && !metadata.hasDefaultCase) {
            if (metadata.missingCases.length === metadata.coveredValues.size &&
                (metadata.missingCases.length + metadata.coveredValues.size === metadata.possibleValues.length)) {
                return;
            };
            // 报告非穷尽性错误
            let des = '';
            if (metadata.isEnumType) {
                const enumMembers = metadata.possibleValues.filter(value => value.includes('.'));
                des = enumMembers.join(' | ');
            } else {
                des = metadata.missingCases.join(' | ');
            };
            this.reportIssue(node.expression, `Switch is not exhaustive. Cases not matched: ${des}`, arkFile);
            return;
        } else if (metadata.missingCases.length > 0 && metadata.hasDefaultCase && metadata.isNumericLiteralType) {
            return;
        } else if (metadata.possibleValues.length > 0) {
            // 只有在有可能的值可以检查时才检查无效的 case 值
            const invalidCases = this.parseInvalidCases(metadata);
            if (invalidCases.length > 0) {
                this.reportIssue(node.expression, `Switch is not exhaustive. Cases not matched: ${invalidCases.join(' | ')}`, arkFile);
                return;
            };
        };
        // 检查 2：不必要的默认情况
        if (!options.allowDefaultCaseForExhaustiveSwitch && metadata.missingCases.length === 0 && metadata.hasDefaultCase &&
            metadata.isUnionType) {
            const defaultClause = node.caseBlock.clauses.find(ts.isDefaultClause);
            if (defaultClause) {
                this.reportIssue(node.expression, 'The switch statement is exhaustive, so the default case is unnecessary.', arkFile);
            };
        };
        // 检查 3：非联合类型需要默认情况
        this.processNoNonUnion(node, options, metadata, arkFile);
    };

    private processNoNonUnion(node: ts.SwitchStatement, options: NonNullable<Options[0]>, metadata: SwitchMetadata, arkFile: ArkFile): void {
        if (options.requireDefaultForNonUnion && !metadata.isUnionType && !metadata.hasDefaultCase &&
            !(metadata.missingCases.length === 0 && metadata.possibleValues.length === 0 &&
                metadata.coveredValues.size === 1 && metadata.coveredValues.has('true'))) {
            this.reportIssue(node.expression, 'Switch is not exhaustive. Cases not matched: default', arkFile);
        };
    };

    private parseInvalidCases(metadata: SwitchMetadata): string[] {
        const invalidCases: string[] = [];
        for (const value of metadata.coveredValues) {
            if (!metadata.possibleValues.includes(value) && !value.includes('.')) {
                invalidCases.push(value);
            };
        };
        return invalidCases;
    };

    private getCurrentOptions(): NonNullable<Options[0]> {
        return this.rule?.option?.[0] || this.defaultOptions[0];
    };

    private reportIssue(node: ts.Node, message: string, arkFile: ArkFile): void {
        const sourceFile = node.getSourceFile();
        const start = node.getStart();
        const end = node.getEnd();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
        const endPos = sourceFile.getLineAndCharacterOfPosition(end);
        const defect = new Defects(
            line + 1,
            character + 1,
            endPos.character + 1,
            message,
            this.rule?.alert ?? this.metaData.severity,
            this.rule.ruleId,
            arkFile.getFilePath() ?? '',
            this.metaData.ruleDocPath,
            true,
            false,
            false
        );
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private getActualValue(expr: ts.Expression, arkFile: ArkFile): string | null {
        // 处理数字字面量
        if (ts.isNumericLiteral(expr)) {
            return expr.text;
        };
        // 处理字符串字面量
        if (ts.isStringLiteral(expr)) {
            return `'${expr.text}'`;
        };
        // 处理标识符（变量）
        if (ts.isIdentifier(expr)) {
            const declaration = this.findDeclaration(expr.text, arkFile);
            // 检查带有初始化器的变量
            if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
                if (ts.isNumericLiteral(declaration.initializer)) {
                    return declaration.initializer.text;
                } else if (ts.isStringLiteral(declaration.initializer)) {
                    return `'${declaration.initializer.text}'`;
                };
            };
        };
        return null;
    };
}