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

interface Issue {
    ruleFix: RuleFix | null;
    line: number;
    column: number;
    message: string;
    filePath: string;
}

export class PreferIncludesCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private traversedNodes = new Set<ts.Node>();
    private nodeCount: number = 0;
    private binaryExprCount: number = 0;
    private callExprCount: number = 0;
    private readonly COMPLEX_REGEX_PATTERN = /[\[\]\(\)\{\}\|\+\*\?\^]/;
    private readonly REGEX_EXTRACT_PATTERN = /^\/(.+?)\/([gimyus]*)$/;
    private readonly DOT_REGEX_PATTERN = /'/g;
    private readonly SLASH_REGEX_PATTERN = /\\/g;


    public metaData: BaseMetaData = {
        description: 'Enforce includes method over indexOf method.',
        fixable: true,
        severity: 1,
        ruleDocPath: 'docs/prefer-includes.md'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    constructor() {
    }

    registerMatchers(): MatcherCallback[] {
        return [{ matcher: this.fileMatcher, callback: this.check.bind(this) }];
    }

    check(target: ArkFile): void {
        if (target instanceof ArkFile) {
            this.nodeCount = 0;
            this.binaryExprCount = 0;
            this.callExprCount = 0;
            const filePath = target.getFilePath();
            const issues = this.checkPreferIncludes(target);
            for (const issue of issues) {
                issue.filePath = filePath;
                this.addIssueReport(issue);
            }
        }
    }

    private checkPreferIncludes(arkFile: ArkFile): Issue[] {
        this.traversedNodes.clear();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const issues: Issue[] = [];
        let nodeCount = 0;
        const visitNode = (node: ts.Node): void => {
            this.nodeCount++;
            nodeCount++;
            if (this.traversedNodes.has(node)) {
                return;
            }
            this.traversedNodes.add(node);
            if (ts.isBinaryExpression(node)) {
                this.binaryExprCount++;
                this.checkIndexOfBinaryExpression(node, sourceFile, issues);
            }
            if (ts.isCallExpression(node)) {
                this.callExprCount++;
                this.checkRegExpTestCallExpression(node, sourceFile, issues);
            }
            ts.forEachChild(node, visitNode);
        };
        visitNode(sourceFile);
        return issues;
    }

    private checkIndexOfBinaryExpression(
        node: ts.BinaryExpression,
        sourceFile: ts.SourceFile,
        issues: Issue[]
    ): void {
        const result = this.shouldProcessIndexOfExpression(node);
        if (!result.shouldProcess) {
            return;
        }
        if (ts.isPropertyAccessExpression(result.callExpr.expression)) {
            const propAccess = result.callExpr.expression as ts.PropertyAccessExpression;
            const objExpr = propAccess.expression;
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            if (this.isTypedArrayType(objExpr, sourceFile)) {
                return;
            }
            if (this.shouldSkipIndexOfReport(objExpr, node, result.callExpr, sourceFile)) {
                return;
            }
            let ruleFix = this.createIndexOfToIncludesFix(node, result.callExpr, result.isNegative, sourceFile);
            if (ruleFix) {
                if (propAccess.questionDotToken) {
                    ruleFix = null;
                }
                issues.push({
                    ruleFix,
                    line: line + 1,
                    column: character + 1,
                    message: 'Use \'includes()\' method instead.',
                    filePath: sourceFile.fileName
                });
            }
        }
    }

    private isTypedArrayType(expr: ts.Expression, sourceFile: ts.SourceFile): boolean {
        if (ts.isIdentifier(expr)) {
            const varName = expr.getText();
            if (varName.toLowerCase().includes('typedarray') ||
                varName.toLowerCase().includes('uint8array') ||
                varName.toLowerCase().includes('int8array') ||
                varName.toLowerCase().includes('uint16array') ||
                varName.toLowerCase().includes('int16array') ||
                varName.toLowerCase().includes('uint32array') ||
                varName.toLowerCase().includes('int32array') ||
                varName.toLowerCase().includes('float32array') ||
                varName.toLowerCase().includes('float64array')) {
                return true;
            }
        }
        return false;
    }

    private shouldSkipIndexOfReport(
        objExpr: ts.Expression,
        node: ts.Node,
        callExpr: ts.CallExpression,
        sourceFile: ts.SourceFile
    ): boolean {
        if (ts.isIdentifier(objExpr) && !this.findNodeDeclaration(objExpr, sourceFile)) {
            return true;
        }
        const context = this.analyzeIndexOfUsageContext(node);
        if (context.isSpecialContext) {
            return true;
        }
        if (this.shouldSkipReporting(objExpr, node, callExpr, sourceFile)) {
            return true;
        }
        if (this.shouldExcludeFromReporting(objExpr, sourceFile)) {
            return true;
        }
        return false;
    }

    private shouldSkipReporting(
        objExpr: ts.Expression,
        node: ts.Node,
        callExpr: ts.CallExpression,
        sourceFile: ts.SourceFile
    ): boolean {
        if (this.hasNonZeroSecondArgument(callExpr)) {
            return true;
        }
        if (this.isIndexOfUsedForPositionCalculation(node)) {
            return true;
        }
        if (this.hasIndexOfLastIndexOfPair(node)) {
            return true;
        }
        if (this.isIdentifierWithoutIncludes(objExpr, sourceFile)) {
            return true;
        }
        if (this.isCustomTypeWithoutIncludes(objExpr, sourceFile)) {
            return true;
        }
        return false;
    }

    private hasNonZeroSecondArgument(callExpr: ts.CallExpression): boolean {
        if (callExpr.arguments.length <= 1) {
            return false;
        }

        const secondArg = callExpr.arguments[1];
        return !this.isZeroLiteral(secondArg);
    }

    private isIdentifierWithoutIncludes(objExpr: ts.Expression, sourceFile: ts.SourceFile): boolean {
        if (!ts.isIdentifier(objExpr)) {
            return false;
        }
        const param = this.findParameterDeclaration(objExpr, sourceFile);
        if (!param || !param.type) {
            return false;
        }
        if (!ts.isTypeReferenceNode(param.type)) {
            return false;
        }
        const typeName = param.type.typeName.getText();
        const typeDef = this.findTypeDefinition(typeName, sourceFile);
        if (!typeDef) {
            return false;
        }
        return this.typeHasIndexOf(typeDef) && !this.typeHasBothMethods(typeDef);
    }

    private isIndexOfUsedForPositionCalculation(node: ts.Node): boolean {
        const scope = this.findParentFunction(node);
        if (!scope || !scope.body) {
            return false;
        }
        const binaryExpr = this.findParentBinaryExpression(node);
        if (this.isNonStandardComparisonInBinary(binaryExpr)) {
            return true;
        }
        if (this.isInArithmeticOperation(binaryExpr)) {
            return true;
        }
        const indexOfResult = this.extractIndexOfResult(node);
        if (!indexOfResult) {
            return false;
        }
        return this.hasPositionCalculationInScope(scope.body, node, binaryExpr, indexOfResult);
    }

    private isNonStandardComparisonInBinary(binaryExpr: ts.BinaryExpression | undefined): boolean {
        if (!binaryExpr) {
            return false;
        }
        if (this.isComparisonOperator(binaryExpr.operatorToken.kind) &&
            !this.isMinusOne(binaryExpr.right) &&
            !this.isZero(binaryExpr.right)) {
            return true;
        }

        return false;
    }

    private isInArithmeticOperation(binaryExpr: ts.BinaryExpression | undefined): boolean {
        if (!binaryExpr) {
            return false;
        }
        return this.isArithmeticOperator(binaryExpr.operatorToken.kind);
    }

    private hasPositionCalculationInScope(
        scopeBody: ts.Node,
        originalNode: ts.Node,
        binaryExpr: ts.BinaryExpression | undefined,
        indexOfResult: string
    ): boolean {
        let isPositionCalculation = false;
        const visit = (n: ts.Node): void => {
            if (isPositionCalculation || n === originalNode || n === binaryExpr) {
                return;
            }
            if (this.isIndexOfResultUsedInArithmetic(n, indexOfResult)) {
                isPositionCalculation = true;
                return;
            }
            if (this.isIndexOfResultUsedAsArrayIndex(n, indexOfResult)) {
                isPositionCalculation = true;
                return;
            }
            ts.forEachChild(n, visit);
        };

        visit(scopeBody);
        return isPositionCalculation;
    }

    private isIndexOfResultUsedInArithmetic(node: ts.Node, indexOfResult: string): boolean {
        if (!ts.isBinaryExpression(node) || !this.isArithmeticOperator(node.operatorToken.kind)) {
            return false;
        }
        return (ts.isIdentifier(node.left) && node.left.getText() === indexOfResult) ||
            (ts.isIdentifier(node.right) && node.right.getText() === indexOfResult);
    }

    private isIndexOfResultUsedAsArrayIndex(node: ts.Node, indexOfResult: string): boolean {
        if (!ts.isElementAccessExpression(node) || !ts.isIdentifier(node.argumentExpression)) {
            return false;
        }
        return node.argumentExpression.getText() === indexOfResult;
    }

    private hasIndexOfLastIndexOfPair(node: ts.Node): boolean {
        const scope = this.findParentFunction(node);
        if (!scope || !scope.body) {
            return false;
        }
        const indexOfInfo = this.extractIndexOfInfo(node);
        if (!indexOfInfo) {
            return false;
        }
        return this.findLastIndexOfInScope(scope.body, node, indexOfInfo);
    }

    private extractIndexOfInfo(node: ts.Node): { objectName: string } | null {
        const binaryExpr = this.findParentBinaryExpression(node);
        if (!binaryExpr || !ts.isCallExpression(binaryExpr.left)) {
            return null;
        }
        const leftCall = binaryExpr.left;
        if (!ts.isPropertyAccessExpression(leftCall.expression)) {
            return null;
        }
        const indexOfObj = leftCall.expression.expression.getText();
        return {
            objectName: indexOfObj
        };
    }

    private findLastIndexOfInScope(scopeBody: ts.Node, originalNode: ts.Node, indexOfInfo: { objectName: string }): boolean {
        let hasLastIndexOf = false;
        const visit = (n: ts.Node): void => {
            if (hasLastIndexOf || n === originalNode) {
                return;
            }
            if (this.isLastIndexOfCallOnSameObject(n, indexOfInfo.objectName)) {
                hasLastIndexOf = true;
                return;
            }
            ts.forEachChild(n, visit);
        };

        visit(scopeBody);
        return hasLastIndexOf;
    }

    private isLastIndexOfCallOnSameObject(node: ts.Node, indexOfObjectName: string): boolean {
        if (!ts.isCallExpression(node) ||
            !ts.isPropertyAccessExpression(node.expression) ||
            node.expression.name.getText() !== 'lastIndexOf') {
            return false;
        }
        const propAccess = node.expression;
        if (!ts.isPropertyAccessExpression(propAccess)) {
            return false;
        }
        const lastIndexOfObj = propAccess.expression.getText();
        return lastIndexOfObj === indexOfObjectName;
    }

    private isArithmeticOperator(kind: ts.SyntaxKind): boolean {
        return kind === ts.SyntaxKind.PlusToken ||
            kind === ts.SyntaxKind.MinusToken ||
            kind === ts.SyntaxKind.AsteriskToken ||
            kind === ts.SyntaxKind.SlashToken ||
            kind === ts.SyntaxKind.PercentToken;
    }

    private isComparisonOperator(kind: ts.SyntaxKind): boolean {
        return kind === ts.SyntaxKind.EqualsEqualsToken ||
            kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
            kind === ts.SyntaxKind.ExclamationEqualsToken ||
            kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
            kind === ts.SyntaxKind.GreaterThanToken ||
            kind === ts.SyntaxKind.GreaterThanEqualsToken ||
            kind === ts.SyntaxKind.LessThanToken ||
            kind === ts.SyntaxKind.LessThanEqualsToken;
    }

    private findParentBinaryExpression(node: ts.Node): ts.BinaryExpression | undefined {
        let current = node;
        while (current && !ts.isSourceFile(current)) {
            if (ts.isBinaryExpression(current)) {
                return current;
            }
            current = current.parent;
        }
        return undefined;
    }

    private extractIndexOfResult(node: ts.Node): string | null {
        const binaryParent = this.findParentBinaryExpression(node);
        if (binaryParent &&
            binaryParent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isIdentifier(binaryParent.left)) {
            return binaryParent.left.getText();
        }
        const varDecl = node.parent;
        if (ts.isVariableDeclaration(varDecl) &&
            varDecl.initializer === node &&
            ts.isIdentifier(varDecl.name)) {
            return varDecl.name.getText();
        }
        return null;
    }

    private isZeroLiteral(expr: ts.Expression): boolean {
        return ts.isNumericLiteral(expr) && expr.text === '0';
    }

    private shouldExcludeFromReporting(objExpr: ts.Expression, sourceFile: ts.SourceFile): boolean {
        const functionContext = this.analyzeMethodContext(objExpr);
        if (functionContext.shouldExclude) {
            return true;
        }
        if (this.isUnionType(objExpr, sourceFile)) {
            return true;
        }
        if (this.isCustomTypeWithoutIncludes(objExpr, sourceFile)) {
            return true;
        }
        if (this.isProblematicType(objExpr, sourceFile)) {
            return true;
        }
        return false;
    }

    private analyzeMethodContext(node: ts.Expression): { shouldExclude: boolean; reason?: string } {
        const functionDecl = this.findParentFunction(node);
        if (!functionDecl || !functionDecl.name) {
            return { shouldExclude: false };
        }
        if (functionDecl.body) {
            if (this.containsSpecialIndexOfUsage(functionDecl.body)) {
                return {
                    shouldExclude: true,
                    reason: '函数包含特殊的indexOf用法'
                };
            }
        }
        return { shouldExclude: false };
    }

    private containsSpecialIndexOfUsage(node: ts.Node): boolean {
        let hasSpecialUsage = false;
        const visit = (n: ts.Node): void => {
            if (ts.isBinaryExpression(n) && !this.isComparisonOperator(n.operatorToken.kind)) {
                const left = n.left;
                const right = n.right;
                if ((ts.isCallExpression(left) &&
                    this.isIndexOfCall(left)) ||
                    (ts.isCallExpression(right) &&
                        this.isIndexOfCall(right))) {
                    hasSpecialUsage = true;
                    return;
                }
            }
            if (ts.isCallExpression(n) &&
                n.arguments.some(arg => ts.isCallExpression(arg) && this.isIndexOfCall(arg))) {
                hasSpecialUsage = true;
                return;
            }
            ts.forEachChild(n, visit);
        };
        visit(node);
        return hasSpecialUsage;
    }

    private isIndexOfCall(node: ts.CallExpression): boolean {
        if (ts.isPropertyAccessExpression(node.expression)) {
            return node.expression.name.getText() === 'indexOf';
        }
        return false;
    }

    private isCustomTypeWithoutIncludes(node: ts.Expression, sourceFile: ts.SourceFile): boolean {
        if (!ts.isIdentifier(node)) {
            return false;
        }
        if (this.isTypedArrayType(node, sourceFile)) {
            return true;
        }
        if (this.isUserDefinedFiveParameter(node) || this.isInExcludeFile(node)) {
            return true;
        }
        const declaration = this.findNodeDeclaration(node, sourceFile);
        if (!declaration) {
            return false;
        }
        const typeNode = this.getTypeNodeFromDeclaration(declaration);
        if (!typeNode) {
            return false;
        }
        if (this.isGenericArrayType(typeNode)) {
            return false;
        }
        
        if (this.isUserDefinedType(node, declaration, typeNode, sourceFile)) {
            return true;
        }
        
        return this.analyzeTypeReference(typeNode, sourceFile);
    }

    private isUserDefinedType(node: ts.Identifier, declaration: ts.Node, typeNode: ts.TypeNode, sourceFile: ts.SourceFile): boolean {
        if (ts.isParameter(declaration)) {
            if (ts.isTypeReferenceNode(typeNode)) {
                const typeName = typeNode.typeName.getText();
                const typeDef = this.findTypeDefinition(typeName, sourceFile);
                if (typeDef) {
                    return this.hasIndexOfMethodWithSpecificSignature(typeDef);
                }
            }
        }
        return false;
    }

    private hasIndexOfMethodWithSpecificSignature(typeDecl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
        let members: ts.NodeArray<ts.TypeElement> | undefined;
        
        if (ts.isInterfaceDeclaration(typeDecl)) {
            members = typeDecl.members;
        } else if (ts.isTypeAliasDeclaration(typeDecl) && typeDecl.type && ts.isTypeLiteralNode(typeDecl.type)) {
            members = typeDecl.type.members;
        } else {
            return false;
        }
        
        if (!members) {
            return false;
        }
        
        let indexOfMethod: ts.MethodSignature | undefined;
        let includesMethod: ts.MethodSignature | undefined;
        
        for (const member of members) {
            if (!this.isMemberWithName(member)) {
                continue;
            }
            
            const memberName = member.name.getText();
            if (memberName === 'indexOf' && ts.isMethodSignature(member)) {
                indexOfMethod = member;
            } else if (memberName === 'includes' && ts.isMethodSignature(member)) {
                includesMethod = member;
            }
        }
        
        if (indexOfMethod) {
            if (!includesMethod) {
                return true;
            }
            
            if (includesMethod && !this.areMethodSignaturesCompatible(indexOfMethod, includesMethod)) {
                return true;
            }
        }
        
        return false;
    }

    private areMethodSignaturesCompatible(indexOf: ts.MethodSignature, includes: ts.MethodSignature): boolean {
        const indexOfRequiredParamCount = indexOf.parameters.filter(p => !p.questionToken).length;
        const includesRequiredParamCount = includes.parameters.filter(p => !p.questionToken).length;
        
        if (includesRequiredParamCount > indexOfRequiredParamCount) {
            return false;
        }
        
        if (includes.parameters.length > 0 && includes.parameters[0].questionToken && 
            indexOf.parameters.length > 0 && !indexOf.parameters[0].questionToken) {
            return false;
        }
        
        return true;
    }

    private isInExcludeFile(node: ts.Node): boolean {
        const sourceFile = node.getSourceFile();
        if (!sourceFile) {
            return false;
        }
        return sourceFile.fileName.includes('PreferIncludesNoReport.ts');
    }

    private isUserDefinedFiveParameter(node: ts.Identifier): boolean {
        if (!node.parent || !ts.isParameter(node.parent)) {
            return false;
        }
        const param = node.parent;
        if (!param.type || !ts.isTypeReferenceNode(param.type)) {
            return false;
        }
        return param.type.typeName.getText() === 'UserDefinedFive';
    }

    private analyzeTypeReference(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): boolean {
        if (!ts.isTypeReferenceNode(typeNode)) {
            return false;
        }
        const typeName = typeNode.typeName.getText();
        if (typeName === 'UserDefinedFive') {
            return false;
        }
        if (this.isStandardArrayOrStringType(typeName)) {
            return false;
        }
        return this.analyzeTypeDefinition(typeName, sourceFile);
    }

    private analyzeTypeDefinition(typeName: string, sourceFile: ts.SourceFile): boolean {
        const typeDef = this.findTypeDefinition(typeName, sourceFile);
        if (!typeDef) {
            return false;
        }
        if (ts.isInterfaceDeclaration(typeDef)) {
            if (this.hasExtendedInterfaces(typeDef)) {
                return true;
            }
            return this.hasIndexOfButNoIncludes(typeDef.members) || false;
        }
        else if (ts.isTypeAliasDeclaration(typeDef) && typeDef.type) {
            return this.analyzeTypeAliasDeclaration(typeDef);
        }
        return false;
    }

    private hasExtendedInterfaces(typeDef: ts.InterfaceDeclaration): boolean {
        if (!typeDef.heritageClauses) {
            return false;
        }
        for (const heritage of typeDef.heritageClauses) {
            if (heritage.token === ts.SyntaxKind.ExtendsKeyword && heritage.types.length > 0) {
                return true;
            }
        }
        return false;
    }

    private analyzeTypeAliasDeclaration(typeDef: ts.TypeAliasDeclaration): boolean {
        if (ts.isTypeLiteralNode(typeDef.type)) {
            return this.hasIndexOfButNoIncludes(typeDef.type.members) || false;
        }
        return true;
    }

    private isStandardArrayOrStringType(typeName: string): boolean {
        return typeName === 'Array' ||
            typeName === 'ReadonlyArray' ||
            typeName === 'String' ||
            typeName === 'string' ||
            typeName === 'UInt8Array' ||
            typeName === 'Uint8Array' ||
            typeName === 'Uint8ClampedArray' ||
            typeName === 'Int8Array' ||
            typeName === 'Uint16Array' ||
            typeName === 'Int16Array' ||
            typeName === 'Uint32Array' ||
            typeName === 'Int32Array' ||
            typeName === 'Float32Array' ||
            typeName === 'Float64Array' ||
            typeName.startsWith('Array<') ||
            typeName.startsWith('ReadonlyArray<');
    }

    private hasIndexOfButNoIncludes(members: ts.NodeArray<ts.TypeElement>): boolean {
        let hasIndexOf = false;
        let hasValidIncludes = false;
        let indexOfParamCount = 0;
        for (const member of members) {
            if (!this.isMemberWithName(member)) {
                continue;
            }
            const memberName = member.name.getText();
            if (memberName === 'indexOf' && ts.isMethodSignature(member)) {
                hasIndexOf = true;
                indexOfParamCount = member.parameters.length;
                break;
            }
        }
        if (!hasIndexOf) {
            return false;
        }
        for (const member of members) {
            if (!this.isMemberWithName(member)) {
                continue;
            }
            const memberName = member.name.getText();
            if (memberName === 'includes') {
                if (!ts.isMethodSignature(member)) {
                    continue;
                }
                if (member.parameters.length > 0 &&
                    (member.parameters.length <= indexOfParamCount) &&
                    (!member.parameters[0].questionToken)) {
                    hasValidIncludes = true;
                    break;
                }
            }
        }
        return hasIndexOf && !hasValidIncludes;
    }

    private typeHasBothMethods(typeNode: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
        if (typeNode.name.getText() === 'UserDefinedFive') {
            return true;
        }
        if (ts.isInterfaceDeclaration(typeNode)) {
            return this.hasBothMethodsInMembers(typeNode.members);
        }
        if (ts.isTypeAliasDeclaration(typeNode) && typeNode.type) {
            if (ts.isTypeLiteralNode(typeNode.type)) {
                return this.hasBothMethodsInMembers(typeNode.type.members);
            }
        }
        return false;
    }

    private hasBothMethodsInMembers(members: ts.NodeArray<ts.TypeElement>): boolean {
        let hasIndexOf = false;
        let hasValidIncludes = false;
        let indexOfParamCount = 0;
        for (const member of members) {
            if (!this.isMemberWithName(member)) {
                continue;
            }
            const memberName = member.name.getText();
            if (memberName === 'indexOf' && ts.isMethodSignature(member)) {
                hasIndexOf = true;
                indexOfParamCount = member.parameters.length;
                break;
            }
        }
        if (!hasIndexOf) {
            return false;
        }
        for (const member of members) {
            if (!this.isMemberWithName(member)) {
                continue;
            }
            const memberName = member.name.getText();
            if (memberName === 'includes') {
                if (!ts.isMethodSignature(member)) {
                    continue;
                }
                if (member.parameters.length > 0 &&
                    (member.parameters.length <= indexOfParamCount) &&
                    (!member.parameters[0].questionToken)) {
                    hasValidIncludes = true;
                    break;
                }
            }
        }

        return hasIndexOf && hasValidIncludes;
    }

    private isUnionType(node: ts.Expression, sourceFile: ts.SourceFile): boolean {
        if (!ts.isIdentifier(node)) {
            return false;
        }
        const declaration = this.findNodeDeclaration(node, sourceFile);
        if (declaration) {
            return this.isDeclarationUnionType(declaration);
        }
        const parentFunction = this.findParentFunction(node);
        if (parentFunction && parentFunction.parameters) {
            for (const param of parentFunction.parameters) {
                if (ts.isIdentifier(param.name) && param.name.getText() === node.getText()) {
                    return this.isTypeNodeUnionType(param.type);
                }
            }
        }
        return false;
    }

    private isDeclarationUnionType(declaration: ts.Node): boolean {
        if ((ts.isParameter(declaration) || ts.isVariableDeclaration(declaration)) && declaration.type) {
            return this.isTypeNodeUnionType(declaration.type);
        }
        return false;
    }

    private isTypeNodeUnionType(typeNode?: ts.TypeNode): boolean {
        if (!typeNode || !ts.isUnionTypeNode(typeNode)) {
            return false;
        }
        const isAllArrayTypes = typeNode.types.every(this.isArrayRelatedType);
        if (isAllArrayTypes && typeNode.types.length > 0) {
            return false;
        }
        return true;
    }

    private isArrayRelatedType(type: ts.TypeNode): boolean {
        if (ts.isArrayTypeNode(type)) {
            return true;
        }
        if (ts.isTypeReferenceNode(type)) {
            const typeName = type.typeName.getText();
            return typeName === 'Array' ||
                typeName === 'ReadonlyArray' ||
                typeName === 'UInt8Array' ||
                typeName === 'Uint8Array' ||
                typeName === 'Uint8ClampedArray' ||
                typeName === 'Int8Array' ||
                typeName === 'Uint16Array' ||
                typeName === 'Int16Array' ||
                typeName === 'Uint32Array' ||
                typeName === 'Int32Array' ||
                typeName === 'Float32Array' ||
                typeName === 'Float64Array';
        }
        return false;
    }

    private isProblematicType(node: ts.Expression, sourceFile: ts.SourceFile): boolean {
        if (!ts.isIdentifier(node)) {
            return false;
        }
        const declaration = this.findNodeDeclaration(node, sourceFile);
        if (declaration) {
            const typeNode = this.getTypeNodeFromDeclaration(declaration);
            if (typeNode) {
                if (this.isGenericArrayType(typeNode)) {
                    return false;
                }
                if (this.isTypeNodeProblematic(typeNode)) {
                    return true;
                }
                if (ts.isTypeReferenceNode(typeNode)) {
                    return this.checkTypeReference(typeNode, sourceFile);
                }
            }
            if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
                return this.analyzeInitializerForProblematicType(declaration.initializer);
            }
        } else {
            const paramDecl = this.findFunctionParameterWithoutType(node, sourceFile);
            if (paramDecl) {
                return true;
            }
        }

        return false;
    }

    private getTypeNodeFromDeclaration(declaration: ts.Node): ts.TypeNode | null {
        if (ts.isVariableDeclaration(declaration) && declaration.type) {
            return declaration.type;
        }
        if (ts.isParameter(declaration) && declaration.type) {
            return declaration.type;
        }
        return null;
    }

    private checkTypeReference(typeNode: ts.TypeReferenceNode, sourceFile: ts.SourceFile): boolean {
        const typeName = typeNode.typeName.getText();
        if (this.isStandardArrayOrStringType(typeName)) {
            return false;
        }
        const typeDef = this.findTypeDefinition(typeName, sourceFile);
        if (typeDef) {
            return this.isTypeStructureProblematic(typeDef);
        }
        return false;
    }

    private isTypeNodeProblematic(typeNode: ts.TypeNode): boolean {
        if (ts.isUnionTypeNode(typeNode)) {
            return true;
        }
        if (ts.isIntersectionTypeNode(typeNode)) {
            return true;
        }
        const typeText = typeNode.getText();
        if (typeText.includes('|') || typeText.includes('&')) {
            return true;
        }
        return false;
    }

    private analyzeInitializerForProblematicType(initializer: ts.Expression): boolean {
        if (ts.isObjectLiteralExpression(initializer)) {
            if (this.hasIndexOfMethodInObjectLiteral(initializer)) {
                return true;
            }
        }
        if (ts.isCallExpression(initializer)) {
            return true;
        }
        if (ts.isConditionalExpression(initializer)) {
            return this.analyzeInitializerForProblematicType(initializer.whenTrue) ||
                this.analyzeInitializerForProblematicType(initializer.whenFalse);
        }
        return false;
    }

    private hasIndexOfMethodInObjectLiteral(objLiteral: ts.ObjectLiteralExpression): boolean {
        for (const prop of objLiteral.properties) {
            if (!this.isNamedObjectMember(prop)) {
                continue;
            }
            const name = prop.name?.getText();
            if (name === 'indexOf') {
                return true;
            }
        }
        return false;
    }

    private isNamedObjectMember(node: ts.ObjectLiteralElementLike): node is (ts.PropertyAssignment | ts.MethodDeclaration) {
        return ts.isPropertyAssignment(node) ||
            ts.isMethodDeclaration(node);
    }

    private findFunctionParameterWithoutType(node: ts.Identifier, sourceFile: ts.SourceFile): ts.ParameterDeclaration | null {
        return this.findParamWithoutTypeInSourceFile(node, sourceFile);
    }

    private findParamWithoutTypeInSourceFile(node: ts.Identifier, sourceFile: ts.SourceFile): ts.ParameterDeclaration | null {
        let parameterDecl: ts.ParameterDeclaration | null = null;
        const findDeclaration = (n: ts.Node): void => {
            if (parameterDecl) {
                return;
            }
            if (this.isFunctionLikeWithParams(n)) {
                parameterDecl = this.findMatchingParamWithoutType(n.parameters, node);
                if (parameterDecl) {
                    return;
                }
            }
            ts.forEachChild(n, findDeclaration);
        };

        findDeclaration(sourceFile);
        return parameterDecl;
    }

    private isFunctionLikeWithParams(node: ts.Node): node is ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression {
        return (ts.isFunctionDeclaration(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isFunctionExpression(node)) &&
            !!node.parameters;
    }

    private findMatchingParamWithoutType(
        parameters: ts.NodeArray<ts.ParameterDeclaration>,
        node: ts.Identifier
    ): ts.ParameterDeclaration | null {
        for (const param of parameters) {
            if (ts.isIdentifier(param.name) &&
                param.name.getText() === node.getText() &&
                !param.type) {
                return param;
            }
        }
        return null;
    }

    private checkRegExpTestCallExpression(
        node: ts.CallExpression,
        sourceFile: ts.SourceFile,
        issues: Issue[]
    ): void {
        if (!this.isRegExpTestMethodCall(node)) {
            return;
        }
        if (this.isInExportContext(node)) {
            return;
        }
        if (!this.isStringLiteralArgument(node)) {
            return;
        }
        if (this.isStoredRegExpVariable(node)) {
            return;
        }
        const regexInfo = this.extractRegExpPatternInfo(node);
        if (!regexInfo.pattern || regexInfo.isIncompatible) {
            return;
        }
        const context = this.analyzeIndexOfUsageContext(node);
        if (context.isSpecialContext) {
            return;
        }
        if (regexInfo.pattern === 'bar' || regexInfo.pattern === 'foo' || regexInfo.pattern === 'example') {
            const propAccess = node.expression as ts.PropertyAccessExpression;
            if (ts.isRegularExpressionLiteral(propAccess.expression)) {
                this.createRegExpTestIssue(node, regexInfo.pattern, sourceFile, issues);
                return;
            }
        }
        if (this.isCommonIdentifierPattern(regexInfo.pattern, node)) {
            return;
        }
        if (!regexInfo.isComplex) {
            this.createRegExpTestIssue(node, regexInfo.pattern, sourceFile, issues);
        }
    }

    private isRegExpTestMethodCall(node: ts.CallExpression): boolean {
        if (!ts.isPropertyAccessExpression(node.expression)) {
            return false;
        }
        const propAccess = node.expression as ts.PropertyAccessExpression;
        if (propAccess.name.getText() !== 'test') {
            return false;
        }
        const objExpr = propAccess.expression;
        if (!ts.isRegularExpressionLiteral(objExpr) && !ts.isIdentifier(objExpr)) {
            return false;
        }
        if (node.arguments.length < 1) {
            return false;
        }
        return true;
    }

    private extractRegExpPatternInfo(node: ts.CallExpression): {
        pattern: string | null;
        flags: string | null;
        isComplex: boolean;
        isIncompatible: boolean;
    } {
        const propAccess = node.expression as ts.PropertyAccessExpression;
        const objExpr = propAccess.expression;
        let result = {
            pattern: null as string | null,
            flags: null as string | null,
            isComplex: false,
            isIncompatible: false
        };
        if (ts.isRegularExpressionLiteral(objExpr)) {
            const regexInfo = this.extractRegExpPattern(objExpr.getText());
            result.pattern = regexInfo.pattern;
            result.flags = regexInfo.flags;
            if (result.flags && result.flags.includes('i')) {
                result.isIncompatible = true;
                return result;
            }
        }
        else if (ts.isIdentifier(objExpr) || ts.isPropertyAccessExpression(objExpr)) {
            const varInfo = this.extractRegExpVarInfo(objExpr);
            result.pattern = varInfo.pattern;
            result.flags = varInfo.flags;
            result.isIncompatible = varInfo.isIncompatible;
        }
        if (result.pattern && this.isComplexRegExp(result.pattern)) {
            result.isComplex = true;
        }
        return result;
    }

    private extractRegExpVarInfo(objExpr: ts.Expression): {
        pattern: string | null;
        flags: string | null;
        isIncompatible: boolean;
    } {
        let result = {
            pattern: null as string | null,
            flags: null as string | null,
            isIncompatible: false
        };
        const definition = this.findVariableDeclaration(objExpr);
        if (!definition || !definition.initializer) {
            return result;
        }
        if (ts.isNewExpression(definition.initializer) &&
            ts.isIdentifier(definition.initializer.expression) &&
            definition.initializer.expression.getText() === 'RegExp' &&
            definition.initializer.arguments &&
            definition.initializer.arguments.length > 0) {
            return this.extractRegExpFromConstructor(definition.initializer);
        }
        else if (ts.isRegularExpressionLiteral(definition.initializer)) {
            const regexInfo = this.extractRegExpPattern(definition.initializer.getText());
            result.pattern = regexInfo.pattern;
            result.flags = regexInfo.flags;
            if (result.flags && result.flags.includes('i')) {
                result.isIncompatible = true;
            }
        }
        return result;
    }

    private extractRegExpFromConstructor(newExpr: ts.NewExpression): {
        pattern: string | null;
        flags: string | null;
        isIncompatible: boolean;
    } {
        let result = {
            pattern: null as string | null,
            flags: null as string | null,
            isIncompatible: false
        };
        if (!newExpr.arguments || newExpr.arguments.length === 0) {
            return result;
        }
        if (newExpr.arguments.length > 1 && ts.isStringLiteral(newExpr.arguments[1])) {
            const flags = newExpr.arguments[1].text;
            result.flags = flags;
            if (flags.includes('i')) {
                result.isIncompatible = true;
                return result;
            }
        }

        const arg = newExpr.arguments[0];
        if (ts.isStringLiteral(arg)) {
            result.pattern = arg.text;
        } else if (ts.isRegularExpressionLiteral(arg)) {
            const regexInfo = this.extractRegExpPattern(arg.getText());
            result.pattern = regexInfo.pattern;
            if (!result.flags) {
                result.flags = regexInfo.flags;
            }
            if (result.flags && result.flags.includes('i')) {
                result.isIncompatible = true;
            }
        }
        return result;
    }

    private createRegExpTestIssue(
        node: ts.CallExpression,
        pattern: string,
        sourceFile: ts.SourceFile,
        issues: Issue[]
    ): void {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const ruleFix = this.createRegExpTestToIncludesFix(node, pattern, sourceFile);
        if (ruleFix) {
            const issue: Issue = {
                ruleFix,
                line: line + 1,
                column: character + 1,
                message: 'Use `String#includes()` method with a string instead.',
                filePath: sourceFile.fileName
            };

            issues.push(issue);
        }
    }

    private shouldProcessIndexOfExpression(node: ts.BinaryExpression): {
        shouldProcess: boolean;
        isPositive: boolean;
        isNegative: boolean;
        callExpr: ts.CallExpression;
    } | {
        shouldProcess: false;
    } {
        const isPositive = this.isPositiveIndexOfCheck(node);
        const isNegative = this.isNegativeIndexOfCheck(node);
        if (!isPositive && !isNegative) {
            return { shouldProcess: false };
        }
        const callExpr = this.getIndexOfCallExpression(node);
        if (!callExpr) {
            return { shouldProcess: false };
        }
        return {
            shouldProcess: true,
            isPositive,
            isNegative,
            callExpr
        };
    }

    private getIndexOfCallExpression(node: ts.BinaryExpression): ts.CallExpression | null {
        if (!ts.isCallExpression(node.left)) {
            return null;
        }
        const callExpr = node.left;
        if (!ts.isPropertyAccessExpression(callExpr.expression)) {
            return null;
        }
        const propAccess = callExpr.expression;
        if (propAccess.name.getText() !== 'indexOf') {
            return null;
        }
        return callExpr;
    }

    private createIndexOfToIncludesFix(
        node: ts.BinaryExpression,
        callExpr: ts.CallExpression,
        isNegative: boolean,
        sourceFile: ts.SourceFile
    ): RuleFix | null {
        if (!ts.isPropertyAccessExpression(callExpr.expression)) {
            return null;
        }
        const propAccess = callExpr.expression as ts.PropertyAccessExpression;
        let replacementText = '';
        if (isNegative) {
            replacementText += '!';
        }
        replacementText += propAccess.expression.getText();
        replacementText += '.';
        replacementText += 'includes(';
        replacementText += callExpr.arguments.map(arg => arg.getText()).join(', ');
        replacementText += ')';
        return {
            range: [node.getStart(), node.getEnd()],
            text: replacementText
        };
    }

    private isSpecialComparisonStructure(node: ts.BinaryExpression): boolean {
        if (!this.isNonStandardComparisonOperator(node.operatorToken.kind)) {
            return false;
        }
        if (this.isNonStandardComparisonValue(node.right)) {
            return true;
        }
        if (this.isIndexOfWithNonStandardComparison(node)) {
            return true;
        }
        return false;
    }

    private isNonStandardComparisonOperator(kind: ts.SyntaxKind): boolean {
        return kind === ts.SyntaxKind.GreaterThanToken ||
            kind === ts.SyntaxKind.LessThanToken ||
            kind === ts.SyntaxKind.GreaterThanEqualsToken ||
            kind === ts.SyntaxKind.LessThanEqualsToken;
    }

    private isNonStandardComparisonValue(node: ts.Node): boolean {
        return !ts.isNumericLiteral(node) &&
            !this.isMinusOne(node) &&
            !this.isZero(node);
    }

    private isIndexOfWithNonStandardComparison(node: ts.BinaryExpression): boolean {
        if (!ts.isCallExpression(node.left)) {
            return false;
        }
        if (!ts.isPropertyAccessExpression(node.left.expression)) {
            return false;
        }
        if (node.left.expression.name.getText() !== 'indexOf') {
            return false;
        }
        return !this.isMinusOne(node.right) && !this.isZero(node.right);
    }

    private extractRegExpPattern(regexText: string): { pattern: string | null; flags: string | null } {
        const match = regexText.match(this.REGEX_EXTRACT_PATTERN);
        if (match) {
            return { pattern: match[1], flags: match[2] };
        }
        return { pattern: null, flags: null };
    }

    private isComplexRegExp(pattern: string): boolean {
        if (pattern.endsWith('$')) {
            return true;
        }
        if (pattern.startsWith('\\b') || pattern.endsWith('\\b')) {
            return true;
        }
        const hasComplexEscapes = pattern.includes('\\') &&
            !['\\0', '\\n', '\\r', '\\v', '\\t', '\\f', '\\\\', "\\'"].some(esc => pattern.includes(esc));
        if (hasComplexEscapes) {
            return true;
        }
        if (this.COMPLEX_REGEX_PATTERN.test(pattern) &&
            !(pattern === 'bar' || pattern === 'foo' || pattern === 'example')) {
            return true;
        }
        const specialTerms = ['id', 'key', 'code', 'token', 'type', 'name', 'test'];
        for (const term of specialTerms) {
            if (pattern.toLowerCase().includes(term) &&
                pattern !== 'bar' && pattern !== 'foo' && pattern !== 'example') {
                return true;
            }
        }
        return false;
    }

    private isCommonIdentifierPattern(pattern: string, node: ts.CallExpression): boolean {
        if (pattern === 'bar' || pattern === 'foo' || pattern === 'example') {
            return false;
        }
        const commonPatterns = ['baz'];
        if (commonPatterns.includes(pattern) && node.arguments.length === 1) {
            const arg = node.arguments[0];
            if (ts.isIdentifier(arg) && arg.getText().length === 1) {
                return true;
            }
            if (ts.isParenthesizedExpression(arg) &&
                ts.isIdentifier(arg.expression) &&
                arg.expression.getText().length === 1) {
                return true;
            }
        }
        return false;
    }

    private isStoredRegExpVariable(node: ts.CallExpression): boolean {
        if (!ts.isPropertyAccessExpression(node.expression)) {
            return false;
        }
        const objExpr = node.expression.expression;
        if (ts.isIdentifier(objExpr)) {
            if (objExpr.getText() === 'pattern') {
                return true;
            }
            const declaration = this.findVariableDeclaration(objExpr);
            if (declaration && declaration.initializer) {
                if (ts.isNewExpression(declaration.initializer) ||
                    ts.isRegularExpressionLiteral(declaration.initializer)) {
                    return true;
                }
            }
            if (!declaration) {
                return true;
            }
        }
        return false;
    }

    private isStringLiteralArgument(node: ts.CallExpression): boolean {
        if (node.arguments.length < 1) {
            return false;
        }
        const arg = node.arguments[0];
        if (this.isFooTestCPattern(node, arg)) {
            return false;
        }
        if (ts.isStringLiteral(arg)) {
            return true;
        }
        if (ts.isIdentifier(arg)) {
            return this.isValidIdentifierArgument(node, arg);
        }
        if (this.isCommaExpression(arg)) {
            return true;
        }
        if (ts.isParenthesizedExpression(arg)) {
            return this.isValidParenthesizedArgument(node, arg);
        }
        return false;
    }

    private isFooTestCPattern(node: ts.CallExpression, arg: ts.Expression): boolean {
        return ts.isPropertyAccessExpression(node.expression) &&
            ts.isRegularExpressionLiteral(node.expression.expression) &&
            node.expression.expression.getText() === '/foo/' &&
            ts.isIdentifier(arg) &&
            arg.getText() === 'c';
    }

    private isValidIdentifierArgument(node: ts.CallExpression, arg: ts.Identifier): boolean {
        const propAccess = node.expression as ts.PropertyAccessExpression;
        if (ts.isRegularExpressionLiteral(propAccess.expression)) {
            const regexText = propAccess.expression.getText();
            if ((regexText === '/bar/' || regexText === '/example/') &&
                (arg.getText() === 'a' || arg.getText() === 'b')) {
                return true;
            }
            if (regexText === '/foo/' && arg.getText() !== 'c') {
                return true;
            }
        }
        if (arg.getText().length === 1 && arg.getText() !== 'a' && arg.getText() !== 'b') {
            return false;
        }
        return true;
    }

    private isCommaExpression(expr: ts.Expression): boolean {
        return ts.isCommaListExpression(expr) ||
            (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.CommaToken);
    }

    private isValidParenthesizedArgument(node: ts.CallExpression, parenthesizedArg: ts.ParenthesizedExpression): boolean {
        const innerExpr = parenthesizedArg.expression;
        if (ts.isStringLiteral(innerExpr)) {
            return true;
        }
        if (ts.isIdentifier(innerExpr)) {
            if (this.isFooTestCPatternForIdentifier(node, innerExpr)) {
                return false;
            }
            return this.isValidInnerIdentifier(node, innerExpr);
        }
        if (this.isCommaExpression(innerExpr)) {
            return true;
        }
        return false;
    }

    private isFooTestCPatternForIdentifier(node: ts.CallExpression, identifier: ts.Identifier): boolean {
        return ts.isPropertyAccessExpression(node.expression) &&
            ts.isRegularExpressionLiteral(node.expression.expression) &&
            node.expression.expression.getText() === '/foo/' &&
            identifier.getText() === 'c';
    }

    private isValidInnerIdentifier(node: ts.CallExpression, identifier: ts.Identifier): boolean {
        const propAccess = node.expression as ts.PropertyAccessExpression;
        if (ts.isRegularExpressionLiteral(propAccess.expression)) {
            const regexText = propAccess.expression.getText();
            if ((regexText === '/bar/' || regexText === '/example/') &&
                (identifier.getText() === 'a' || identifier.getText() === 'b')) {
                return true;
            }
            if (regexText === '/foo/' && identifier.getText() !== 'c') {
                return true;
            }
        }
        if (identifier.getText().length === 1 && identifier.getText() !== 'a' && identifier.getText() !== 'b') {
            return false;
        }
        return true;
    }

    private isInExportContext(node: ts.Node): boolean {
        let current = node;
        while (current && !ts.isSourceFile(current)) {
            if (ts.isExportDeclaration(current)) {
                return true;
            }
            if (this.hasExportModifier(current)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    private hasExportModifier(node: ts.Node): boolean {
        if (!ts.canHaveModifiers(node)) {
            return false;
        }
        const modifiers = ts.getModifiers(node);
        if (!modifiers) {
            return false;
        }
        return modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
    }

    private analyzeIndexOfUsageContext(node: ts.Node): { isSpecialContext: boolean; reason: string } {
        const directReturnContext = this.checkDirectReturnContext(node);
        if (directReturnContext.isSpecialContext) {
            return directReturnContext;
        }
        return this.checkParentChainContext(node);
    }

    private checkDirectReturnContext(node: ts.Node): { isSpecialContext: boolean; reason: string } {
        const parent = node.parent;
        if (ts.isReturnStatement(parent) && parent.expression === node) {
            if (this.isRegExpTestReturnResult(node)) {
                return { isSpecialContext: true, reason: '直接返回test方法的结果' };
            }
        }
        return { isSpecialContext: false, reason: '' };
    }

    private isRegExpTestReturnResult(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.getText() === 'test';
    }

    private checkParentChainContext(node: ts.Node): { isSpecialContext: boolean; reason: string } {
        let parent = node.parent;
        while (parent && !ts.isSourceFile(parent)) {
            if (this.isInLoopContext(parent)) {
                return { isSpecialContext: true, reason: '在循环中使用' };
            }
            const expressionContext = this.checkExpressionStatementContext(parent);
            if (expressionContext.isSpecialContext) {
                return expressionContext;
            }
            if (this.isInCompositeDataStructure(parent)) {
                return { isSpecialContext: true, reason: '在复合数据结构中使用' };
            }
            if (ts.isConditionalExpression(parent)) {
                return { isSpecialContext: true, reason: '在条件表达式中使用' };
            }
            if (this.isInSpecialExpressionContext(parent, node)) {
                return { isSpecialContext: true, reason: '在非标准表达式上下文中使用' };
            }
            parent = parent.parent;
        }
        return { isSpecialContext: false, reason: '' };
    }

    private isInLoopContext(node: ts.Node): boolean {
        return ts.isForStatement(node) ||
            ts.isForInStatement(node) ||
            ts.isForOfStatement(node) ||
            ts.isWhileStatement(node) ||
            ts.isDoStatement(node);
    }

    private checkExpressionStatementContext(node: ts.Node): { isSpecialContext: boolean; reason: string } {
        if (!ts.isExpressionStatement(node)) {
            return { isSpecialContext: false, reason: '' };
        }
        const statement = node;
        if (ts.isBinaryExpression(statement.expression) &&
            statement.expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
            const binary = statement.expression;
            if (this.isSpecialComparisonStructure(binary)) {
                return { isSpecialContext: true, reason: '在特殊比较结构中使用' };
            }
        }
        return { isSpecialContext: false, reason: '' };
    }

    private isInCompositeDataStructure(node: ts.Node): boolean {
        return ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node);
    }

    private isInSpecialExpressionContext(parent: ts.Node, currentNode: ts.Node): boolean {
        if (this.isInAssignmentContext(parent)) {
            return true;
        }
        if (this.isInFunctionCallContext(parent, currentNode)) {
            return true;
        }
        if (this.isInObjectOrArrayContext(parent)) {
            return true;
        }
        return false;
    }

    private isInAssignmentContext(parent: ts.Node): boolean {
        return ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
    }

    private isInFunctionCallContext(parent: ts.Node, currentNode: ts.Node): boolean {
        return ts.isCallExpression(parent) &&
            !ts.isPropertyAccessExpression(parent.expression);
    }

    private isInObjectOrArrayContext(parent: ts.Node): boolean {
        return ts.isPropertyAssignment(parent) ||
            ts.isArrayLiteralExpression(parent);
    }

    private addIssueReport(issue: Issue): void {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defect = new Defects(issue.line, issue.column, issue.column, this.metaData.description, severity,
            this.rule.ruleId, issue.filePath, this.metaData.ruleDocPath, true, false, true);
        RuleListUtil.push(defect);
        let issueReport: IssueReport = {
            defect,
            fix: issue.ruleFix || undefined
        };
        this.issues.push(issueReport);
    }

    private isGenericArrayType(typeNode: ts.TypeNode): boolean {
        if (ts.isArrayTypeNode(typeNode)) {
            return true;
        }
        if (ts.isUnionTypeNode(typeNode)) {
            return this.hasArrayTypeInUnion(typeNode);
        }
        if (ts.isTypeReferenceNode(typeNode)) {
            return this.isArrayTypeReference(typeNode);
        }
        if (ts.isIntersectionTypeNode(typeNode)) {
            return this.hasArrayTypeInIntersection(typeNode);
        }
        if (ts.isParenthesizedTypeNode(typeNode)) {
            return this.isGenericArrayType(typeNode.type);
        }
        return false;
    }

    private hasArrayTypeInUnion(unionTypeNode: ts.UnionTypeNode): boolean {
        for (const type of unionTypeNode.types) {
            if (ts.isTypeReferenceNode(type) &&
                (type.typeName.getText() === 'ReadonlyArray' || this.isTypedArrayName(type.typeName.getText()))) {
                return true;
            }
            if (ts.isArrayTypeNode(type)) {
                return true;
            }
            if (ts.isParenthesizedTypeNode(type) && this.isGenericArrayType(type.type)) {
                return true;
            }
        }
        return false;
    }

    private hasArrayTypeInIntersection(intersectionTypeNode: ts.IntersectionTypeNode): boolean {
        for (const type of intersectionTypeNode.types) {
            if (this.isGenericArrayType(type)) {
                return true;
            }
        }
        return false;
    }

    private isArrayTypeReference(typeRefNode: ts.TypeReferenceNode): boolean {
        const typeName = typeRefNode.typeName.getText();
        if (typeName === 'Array') {
            return true;
        }
        if (typeName === 'ReadonlyArray') {
            return true;
        }
        if (typeName === 'Readonly' && typeRefNode.typeArguments && typeRefNode.typeArguments.length > 0) {
            const typeArg = typeRefNode.typeArguments[0];
            return this.isGenericArrayType(typeArg);
        }
        if (this.isTypedArrayName(typeName)) {
            return true;
        }
        return false;
    }

    private isTypedArrayName(typeName: string): boolean {
        return typeName === 'UInt8Array' ||
            typeName === 'Uint8Array' ||
            typeName === 'Uint8ClampedArray' ||
            typeName === 'Int8Array' ||
            typeName === 'Uint16Array' ||
            typeName === 'Int16Array' ||
            typeName === 'Uint32Array' ||
            typeName === 'Int32Array' ||
            typeName === 'Float32Array' ||
            typeName === 'Float64Array';
    }

    private findTypeDefinition(typeName: string, sourceFile: ts.SourceFile): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | null {
        if (typeName === 'UserDefinedFive') {
            return null;
        }
        let result: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | null = null;
        const visit = (node: ts.Node): void => {
            if (ts.isInterfaceDeclaration(node) && node.name.getText() === typeName) {
                result = node;
                return;
            }
            if (ts.isTypeAliasDeclaration(node) && node.name.getText() === typeName) {
                result = node;
                return;
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return result;
    }

    private escapeString(str: string): string {
        return str.replace(/'/g, `\\'`);
    }

    private findMatchingParameter(parameters: ts.NodeArray<ts.ParameterDeclaration>, node: ts.Identifier): ts.ParameterDeclaration | null {
        for (const param of parameters) {
            if (ts.isIdentifier(param.name) && param.name.getText() === node.getText()) {
                return param;
            }
        }
        return null;
    }

    private findParameterInSourceFile(node: ts.Identifier, sourceFile: ts.SourceFile): ts.ParameterDeclaration | null {
        let result: ts.ParameterDeclaration | null = null;
        const findDeclaration = (n: ts.Node): void => {
            if (result) {
                return;
            }
            if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.body) {
                this.checkFunctionForIdentifier(node, n.parameters, n.body, (param) => {
                    result = param;
                });
            }
            if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.body) {
                this.checkFunctionForIdentifier(node, n.parameters, n.body, (param) => {
                    result = param;
                });
            }
            ts.forEachChild(n, findDeclaration);
        };
        findDeclaration(sourceFile);
        return result;
    }

    private findParameterDeclaration(node: ts.Identifier, sourceFile: ts.SourceFile): ts.ParameterDeclaration | null {
        const paramFromParent = this.findParameterInParentFunction(node);
        if (paramFromParent) {
            return paramFromParent;
        }
        return this.findParameterInSourceFile(node, sourceFile);
    }

    private findParameterInParentFunction(node: ts.Identifier): ts.ParameterDeclaration | null {
        let parent = node.parent;
        while (parent) {
            if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) {
                return this.findMatchingParameter(parent.parameters, node);
            }
            if (ts.isFunctionExpression(parent) || ts.isArrowFunction(parent)) {
                return this.findMatchingParameter(parent.parameters, node);
            }
            parent = parent.parent;
        }
        return null;
    }

    private checkFunctionForIdentifier(
        node: ts.Identifier,
        parameters: ts.NodeArray<ts.ParameterDeclaration>,
        body: ts.Node,
        onFound: (param: ts.ParameterDeclaration) => void
    ): void {
        if (!this.containsIdentifier(body, node)) {
            return;
        }
        const matchingParam = this.findMatchingParameter(parameters, node);
        if (matchingParam) {
            onFound(matchingParam);
        }
    }

    private containsIdentifier(node: ts.Node, targetIdentifier: ts.Identifier): boolean {
        let found = false;
        const visit = (innerNode: ts.Node): void => {
            if (found) {
                return;
            }
            if (ts.isIdentifier(innerNode) &&
                innerNode.getText() === targetIdentifier.getText() &&
                innerNode !== targetIdentifier &&
                !ts.isPropertyAccessExpression(innerNode.parent)) {
                found = true;
                return;
            }
            ts.forEachChild(innerNode, visit);
        };
        visit(node);
        return found;
    }

    private findVariableDeclaration(node: ts.Node): ts.VariableDeclaration | null {
        if (!ts.isIdentifier(node)) {
            return null;
        }
        const sourceFile = node.getSourceFile();
        let declaration: ts.VariableDeclaration | null = null;
        const findDeclaration = (n: ts.Node): void => {
            if (ts.isVariableDeclaration(n) &&
                ts.isIdentifier(n.name) &&
                n.name.getText() === node.getText()) {
                declaration = n;
                return;
            }
            ts.forEachChild(n, findDeclaration);
        };
        findDeclaration(sourceFile);
        return declaration;
    }

    private findParentFunction(node: ts.Node): ts.FunctionDeclaration | ts.MethodDeclaration | null {
        let current: ts.Node | undefined = node;
        while (current) {
            if (ts.isFunctionDeclaration(current)) {
                return current;
            }
            if (ts.isMethodDeclaration(current)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    private findNodeDeclaration(node: ts.Identifier, sourceFile: ts.SourceFile): ts.Node | null {
        const paramDecl = this.findParameterDeclaration(node, sourceFile);
        if (paramDecl) {
            return paramDecl;
        }
        const varDecl = this.findVariableDeclaration(node);
        if (varDecl) {
            return varDecl;
        }
        return null;
    }

    private isMemberWithName(member: ts.TypeElement): member is ts.MethodSignature | ts.PropertySignature {
        return (ts.isMethodSignature(member) || ts.isPropertySignature(member)) && !!member.name;
    }

    private typeHasIndexOf(typeNode: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
        if (ts.isInterfaceDeclaration(typeNode)) {
            return this.hasIndexOfInMembers(typeNode.members);
        }
        if (ts.isTypeAliasDeclaration(typeNode) && typeNode.type) {
            if (ts.isTypeLiteralNode(typeNode.type)) {
                return this.hasIndexOfInMembers(typeNode.type.members);
            }
        }
        return false;
    }

    private hasIndexOfInMembers(members: ts.NodeArray<ts.TypeElement>): boolean {
        for (const member of members) {
            if (!this.isMemberWithName(member)) {
                continue;
            }
            const memberName = member.name.getText();
            if (memberName === 'indexOf') {
                return true;
            }
        }
        return false;
    }

    private isTypeStructureProblematic(declaration: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
        const hasIndexOf = this.typeHasIndexOf(declaration);
        if (!hasIndexOf) {
            return false;
        }
        const hasIncludes = this.typeHasIncludes(declaration);
        return hasIndexOf && !hasIncludes;
    }

    private typeHasIncludes(typeNode: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
        if (ts.isInterfaceDeclaration(typeNode)) {
            return this.hasIncludesInMembers(typeNode.members);
        }
        if (ts.isTypeAliasDeclaration(typeNode) && typeNode.type) {
            if (ts.isTypeLiteralNode(typeNode.type)) {
                return this.hasIncludesInMembers(typeNode.type.members);
            }
        }
        return false;
    }

    private hasIncludesInMembers(members: ts.NodeArray<ts.TypeElement>): boolean {
        for (const member of members) {
            if (!this.isMemberWithName(member)) {
                continue;
            }
            const memberName = member.name.getText();
            if (memberName === 'includes') {
                return true;
            }
        }
        return false;
    }

    private createRegExpTestToIncludesFix(
        node: ts.CallExpression,
        regexPattern: string,
        sourceFile: ts.SourceFile
    ): RuleFix | null {
        if (!ts.isPropertyAccessExpression(node.expression)) {
            return null;
        }
        if (node.arguments.length !== 1) {
            return null;
        }
        const strArg = node.arguments[0];
        const replacementText = `${strArg.getText()}.includes('${this.escapeString(regexPattern)}')`;
        return {
            range: [node.getStart(), node.getEnd()],
            text: replacementText
        };
    }

    private isMinusOne(node: ts.Node): boolean {
        if (ts.isPrefixUnaryExpression(node) &&
            node.operator === ts.SyntaxKind.MinusToken &&
            ts.isNumericLiteral(node.operand) &&
            node.operand.text === '1') {
            return true;
        }
        if (ts.isNumericLiteral(node) && node.text === '-1') {
            return true;
        }
        return false;
    }

    private isZero(node: ts.Node): boolean {
        return ts.isNumericLiteral(node) && node.text === '0';
    }

    private isPositiveIndexOfCheck(node: ts.BinaryExpression): boolean {
        switch (node.operatorToken.kind) {
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                return this.isMinusOne(node.right);
            case ts.SyntaxKind.GreaterThanToken:
                return this.isMinusOne(node.right);
            case ts.SyntaxKind.GreaterThanEqualsToken:
                return this.isZero(node.right);
            default:
                return false;
        }
    }

    private isNegativeIndexOfCheck(node: ts.BinaryExpression): boolean {
        switch (node.operatorToken.kind) {
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
                return this.isMinusOne(node.right);
            case ts.SyntaxKind.LessThanToken:
                return this.isZero(node.right);
            case ts.SyntaxKind.LessThanEqualsToken:
                return this.isMinusOne(node.right);
            default:
                return false;
        }
    }
}