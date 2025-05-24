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

import {
    Stmt,
    ArkMethod,
    ArkReturnStmt, ClassType, UnionType, ts, AstTreeUtils, ArkFile
} from "arkanalyzer";
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {ClassMatcher, FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher} from "../../matcher/Matchers";
import {Defects, IssueReport} from "../../model/Defects";
import {Rule} from "../../model/Rule";
import {BaseChecker, BaseMetaData} from "../../checker/BaseChecker";
import {RuleListUtil} from "../../utils/common/DefectsList";
import {RuleFix} from "../../model/Fix";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnsafeReturnCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/no-unsafe-return.md",
    description: "Unsafe return of an `any` typed value."
};

export class NoUnsafeReturnCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private regex = /unknown\s*\{/;

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS
    };

    private buildMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.clsMatcher],
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildTs: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        }
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.checkArk
        };
        return [fileMatcherCb, matchBuildTs];
    }

    public checkArk = (arkFile: ArkFile): void => {
        if (!arkFile.getFilePath().endsWith('.ts')) {
            return;
        }
        const asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const sourceFileObject = ts.getParseTreeNode(asRoot);
        if (sourceFileObject === undefined) {
            return;
        }
        this.loopNode(arkFile, asRoot, sourceFileObject);
    };

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFile, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isReturnStatement(child)) {
                this.checkArkReturnStatement(child, sourceFile, targetFile);
            } else if (ts.isArrowFunction(child)) {
                this.checkArkArrowFunction(child, sourceFile, targetFile);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private shouldSkipArrowFunctionCheck(child: ts.ArrowFunction): boolean {
        if (ts.isCallExpression(child.parent)) {
            if (ts.isPropertyAccessExpression(child.parent.expression)) {
                const methodName = child.parent.expression.name.getText();
                const allowedMethods = ['map', 'reduce', 'sort', 'filter'];
                return allowedMethods.includes(methodName);
            }
        }
        return false;
    }

    private shouldSkipArrowFunctionCheckForArrayMethods(child: ts.ArrowFunction): boolean {
        if (ts.isCallExpression(child.parent)) {
            if (ts.isPropertyAccessExpression(child.parent.expression)) {
                const methodName = child.parent.expression.name.getText();
                const allowedMethods = ['map', 'reduce', 'sort', 'toSorted'];
                if (allowedMethods.includes(methodName)) {
                    return true;
                }
            } else if (ts.isElementAccessExpression(child.parent.expression)) {
                if (
                    ts.isStringLiteral(child.parent.expression.argumentExpression) &&
                    child.parent.expression.argumentExpression.getText() === '\'reduce\'' &&
                    ts.isArrayLiteralExpression(child.parent.expression.expression)
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkArkArrowFunction(child: ts.ArrowFunction, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let positionInfo = this.getPositionInfo(child.body, sourceFile);
        let nameSave = {paramName: ''};
        if (ts.isIdentifier(child.body)) {
            nameSave.paramName = child.body?.getText();
            if (this.shouldSkipArrowFunctionCheck(child)) {
                return;
            }
        }
        if (this.checkArrowFunctionBodyType(child, arkFile, positionInfo, nameSave)) {
            return;
        }
        if (ts.isNewExpression(child.body)) {
            if (ts.isIdentifier(child.body?.expression)) {
                nameSave.paramName = child.body?.expression.getText();
                if (nameSave.paramName === 'Bluebird') {
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                    return;
                }
            }
        }
        if (nameSave.paramName === '') {
            return;
        }
        const parameters = child.parameters;
        const matchingParam = parameters.find(param => param.name.getText() === nameSave.paramName && param.type === undefined);
        if (matchingParam) {
            let des = this.metaData.description;
            this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, des);
        }
    }

    private checkArrowFunctionBodyType(
        child: ts.ArrowFunction,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        nameSave: { paramName: string }
    ): boolean {
        if (child.body.kind === ts.SyntaxKind.ThisKeyword) {
            if (this.checkThisKeywordInConstructor(child, arkFile, positionInfo)) {
                return true;
            }
        } else if (ts.isBinaryExpression(child.body)) {
            if (this.checkArrowFunctionBody(child, arkFile, positionInfo, nameSave)) {
                return true;
            }
        } else if (ts.isPropertyAccessExpression(child.body)) {
            if (ts.isIdentifier(child.body?.expression) && ts.isPrivateIdentifier(child.body?.name)) {
                nameSave.paramName = child.body?.expression.getText();
            }
        } else if (ts.isAsExpression(child.body) || ts.isAwaitExpression(child.body)) {
            if (ts.isIdentifier(child.body?.expression)) {
                nameSave.paramName = child.body?.expression.getText();
            }
        }
        return false;
    }

    private checkThisKeywordInConstructor(
        child: ts.ArrowFunction,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (
            ts.isCallExpression(child.parent) &&
            ts.isExpressionStatement(child.parent.parent) &&
            ts.isBlock(child.parent.parent.parent) &&
            child.parent.parent.parent?.parent?.kind === ts.SyntaxKind.Constructor
        ) {
            return true;
        }
        this.addArkIssueReport(
            arkFile,
            positionInfo.startPosition.line + 1,
            positionInfo.startPosition.character + 1,
            positionInfo.endPosition.character + 1,
            this.metaData.description
        );
        return true;
    }

    private checkArrowFunctionBody(
        child: ts.ArrowFunction,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        nameSave: { paramName: string}
    ): boolean {
        if (this.shouldSkipArrowFunctionCheckForArrayMethods(child)) {
            return true;
        }
        if (ts.isBinaryExpression(child.body)) {
            if (ts.isAsteriskToken(child.body?.operatorToken)) {
                return true;
            } else if (ts.isIdentifier(child.body?.left)) {
                nameSave.paramName = child.body?.left.getText();
                const parameters = child.parameters;
                const matchingParam = parameters.find(param =>
                    param.name.getText() === nameSave.paramName && param.type &&
                    param.type.kind === ts.SyntaxKind.AnyKeyword
                );
                if (matchingParam) {
                    this.addArkIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description
                    );
                    return true;
                }
            }
        }
        if (
            ts.isPropertyAssignment(child.parent) &&
            ts.isIdentifier(child.parent.name) &&
            child.parent.name.getText() === 'map'
        ) {
            return true;
        }

        return false;
    }

    private findClassDeclarationParentRecursive(node: ts.Node): ts.ClassDeclaration | null {
        if (ts.isClassDeclaration(node)) {
            return node;
        }
        if (!node.parent) {
            return null;
        }
        return this.findClassDeclarationParentRecursive(node.parent);
    }

    private checkPropertyAccessExpressionWithThisKeyword(
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): void {
        if (
            child.expression &&
            ts.isPropertyAccessExpression(child.expression) &&
            child.expression.expression.kind === ts.SyntaxKind.ThisKeyword
        ) {
            let name = '';
            if (ts.isIdentifier(child.expression.name)) {
                name = child.expression.name.getText();
            }
            const classDeclaration = this.findClassDeclarationParentRecursive(child);
            if (classDeclaration) {
                const hasPropertyOrConstructor = classDeclaration.members.some(member =>
                    (ts.isPropertyDeclaration(member) && member.name.getText() === name) ||
                    member.kind === ts.SyntaxKind.Constructor
                );
                if (hasPropertyOrConstructor) {
                    return;
                }
            }
            this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description
            );
            return;
        }
    }

    private checkIdentifierReturnStatement(
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        name: string
    ): boolean {
        if (!ts.isFunctionDeclaration(child?.parent?.parent)) {
            return false;
        }
        const parameters = child.parent.parent.parameters;
        const matchingParam = parameters.find(param => {
            if (ts.isArrayBindingPattern(param.name)) {
                return param.name.elements.some(element =>
                    ts.isBindingElement(element) &&
                    ts.isIdentifier(element.name) &&
                    element.name.getText() === name
                );
            } else if (ts.isParameter(param)) {
                if (param.name.getText() === name && param.type === undefined && param.initializer && ts.isIdentifier(param.initializer)) {
                    name = '';
                    return true;
                }
            }
            return false;
        });
        if (name === '') {
            return true;
        }
        if (matchingParam && name !== '') {
            this.addArkIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description
            );
            return true;
        }
        return false;
    }

    private checkIdentifierExpression(
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        name: string
    ): boolean {
        if (!ts.isFunctionDeclaration(child?.parent?.parent)) {
            return false;
        }
        const parameters = child.parent.parent.parameters;
        const matchingParam = parameters.find(param => param.name.getText() === name && param.type === undefined);
        if (matchingParam && name !== '') {
            this.addArkIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description
            );
            return true;
        }
        return false;
    }

    private checkArrayTypeNode(
        matchingParam: ts.ParameterDeclaration,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (matchingParam?.type && ts.isArrayTypeNode(matchingParam.type)) {
            if (ts.isTypeReferenceNode(matchingParam.type.elementType)) {
                if (matchingParam.type.elementType.typeName.getText() === 'T') {
                    this.addArkIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description
                    );
                    return true;
                }
            }
        }
        return false;
    }

    private checkElementAccessExpressionForArrayType(
        identifier: ts.Node,
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (!ts.isIdentifier(identifier)) {
            return false;
        }
        const name = identifier.getText();
        const parentFunction = child?.parent?.parent?.parent?.parent;
        if (!ts.isFunctionDeclaration(parentFunction)) {
            return false;
        }
        const parameters = parentFunction.parameters;
        const matchingParam = parameters.find(param =>
            param.name.getText() === name &&
            param.type?.kind === ts.SyntaxKind.ArrayType
        );
        if (matchingParam && this.checkArrayTypeNode(matchingParam, arkFile, positionInfo)) {
            return true;
        }
        return false;
    }

    private checkElementAccessExpressionForUndefinedType(
        methodName: ts.Node,
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (!child.expression || !ts.isCallExpression(child.expression)) {
            return false;
        }
        if (!ts.isIdentifier(methodName) || !child.expression.arguments?.length) {
            return false;
        }
        const argumentName = child.expression.arguments[0].getText();
        const parentFunction = child?.parent?.parent;
        if (!ts.isFunctionExpression(parentFunction)) {
            return false;
        }
        const parameters = parentFunction.parameters;
        const matchingParam = parameters.find(param =>
            param.name.getText() === argumentName &&
            param.type === undefined
        );
        if (matchingParam) {
            this.addArkIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description
            );
            return true;
        }
        return false;
    }

    private checkElementAccessExpression(
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (!child.expression || !ts.isCallExpression(child.expression)) {
            return false;
        }
        const expression = child.expression.expression;
        if (!ts.isPropertyAccessExpression(expression)) {
            return false;
        }
        const elementAccessExpression = expression.expression;
        if (ts.isElementAccessExpression(elementAccessExpression)) {
            const identifier = elementAccessExpression.expression;
            if (this.checkElementAccessExpressionForArrayType(identifier, child, arkFile, positionInfo)) {
                return true;
            }
        } else if (elementAccessExpression.kind === ts.SyntaxKind.ThisKeyword) {
            const methodName = expression.name;
            if (this.checkElementAccessExpressionForUndefinedType(methodName, child, arkFile, positionInfo)) {
                return true;
            }
        }
        return false;
    }

    private checkIdentifierExpressionForTypeLiteral(
        expression: ts.Expression,
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (!ts.isIdentifier(expression)) {
            return false;
        }
        const name = expression.getText();
        const parentFunction = child?.parent?.parent;
        if (!ts.isFunctionDeclaration(parentFunction)) {
            return false;
        }
        const parameters = parentFunction.parameters;
        const matchingParam = parameters.find(param =>
            param.name.getText() === name &&
            param.type &&
            ts.isTypeLiteralNode(param.type)
        );
        if (matchingParam && name !== '') {
            this.addArkIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                this.metaData.description
            );
            return true;
        }
        return false;
    }

    private checkNonNullExpressionForTypeLiteral(
        expression: ts.Expression,
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (child.expression && !ts.isCallExpression(child.expression)) {
            return false;
        }
        if (!ts.isNonNullExpression(expression) || child.expression?.questionDotToken?.kind !== ts.SyntaxKind.QuestionDotToken) {
            return false;
        }
        const innerExpression = expression.expression;
        if (!ts.isIdentifier(innerExpression)) {
            return false;
        }
        const name = innerExpression.getText();
        const parentFunction = child?.parent?.parent;
        if (!ts.isFunctionDeclaration(parentFunction)) {
            return false;
        }
        const parameters = parentFunction.parameters;
        const matchingParam = parameters.find(param =>
            param.name.getText() === name &&
            param.type &&
            ts.isTypeLiteralNode(param.type)
        );
        if (matchingParam && name !== '') {
            this.addArkIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description
            );
            return true;
        }

        return false;
    }

    private checkElementAccessExpressionForIdentifier(
        argumentExpression: ts.Expression,
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (child.expression && !ts.isElementAccessExpression(child.expression)) {
            return false;
        }
        if (!ts.isIdentifier(argumentExpression)) {
            return false;
        }
        const name = child.expression?.expression.getText();
        const parentFunction = child?.parent?.parent;
        if (!ts.isFunctionDeclaration(parentFunction)) {
            return false;
        }
        const parameters = parentFunction.parameters;
        const matchingParam = parameters.find(param => param.name.getText() === name && param.type !== undefined);
        if (!matchingParam && name !== '') {
            this.addArkIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                this.metaData.description
            );
            return true;
        }
        return false;
    }

    private checkArkReturnStatement(child: ts.ReturnStatement, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let positionInfo = this.getPositionInfo(child, sourceFile);
        if (child.expression === undefined || ts.isNumericLiteral(child.expression) || ts.isLiteralExpression(child.expression) ||
            child.expression.kind === ts.SyntaxKind.TrueKeyword || child.expression.kind === ts.SyntaxKind.FalseKeyword) {
            return;
        }
        if (ts.isPrefixUnaryExpression(child.expression) && ts.isPrefixUnaryExpression(child.expression.operand)) {
            return;
        }
        this.checkPropertyAccessExpressionWithThisKeyword(child, arkFile, positionInfo);
        let nameSave = {paramName: ''};
        if (ts.isIdentifier(child.expression)) {
            nameSave.paramName = child.expression?.getText();
            let name = child.expression?.getText();
            let isCheck = this.checkIdentifierReturnStatement(child, arkFile, positionInfo, name);
            if (isCheck) {
                return;
            }
        }
        if (this.checkReturnExpression(child, arkFile, positionInfo, nameSave)) {
            return;
        }
        this.checkBlockAndFunction(child, arkFile, positionInfo, nameSave.paramName);
    }

    private checkReturnExpression(
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        nameSave: {paramName: string}
    ): boolean {
        if (!child.expression) {
            return false;
        }
        if (ts.isBinaryExpression(child.expression)) {
            if (ts.isAsteriskToken(child.expression?.operatorToken) || child.expression?.operatorToken.kind === ts.SyntaxKind.SlashToken) {
                return true;
            }
            if (ts.isIdentifier(child.expression?.left)) {
                nameSave.paramName = child.expression?.left.getText();
            }
        } else if (ts.isNewExpression(child.expression)) {
            if (ts.isIdentifier(child.expression?.expression)) {
                const name = child.expression?.expression.getText();
                if (this.checkIdentifierExpression(child, arkFile, positionInfo, name)) {
                    return true;
                }
            }
        }
        if (this.checkCallAndElementAccessExpression(child, arkFile, positionInfo, nameSave.paramName)) {
            return true;
        }
        return false;
    }

    private checkCallAndElementAccessExpression(
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        paramName: string
    ): boolean {
        if (!child.expression) {
            return false;
        }
        if (ts.isCallExpression(child.expression)) {
            if (this.checkCallExpression(child, arkFile, positionInfo, paramName)) {
                return true;
            }
        } else if (ts.isElementAccessExpression(child.expression)) {
            if (
                ts.isIdentifier(child.expression.expression) &&
                child.expression?.questionDotToken?.kind === ts.SyntaxKind.QuestionDotToken &&
                ts.isNonNullExpression(child.expression.argumentExpression)
            ) {
                const argumentExpression = child.expression.argumentExpression.expression;
                if (this.checkElementAccessExpressionForIdentifier(argumentExpression, child, arkFile, positionInfo)) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkCallExpression(
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        paramName: string
    ): boolean {
        if (child.expression && !ts.isCallExpression(child.expression)) {
            return false;
        }
        if (!child.expression) {
            return false;
        }
        const expression = child.expression.expression;
        if (ts.isPropertyAccessExpression(expression)) {
            if (this.checkElementAccessExpression(child, arkFile, positionInfo)) {
                return true;
            }
        } else if (ts.isIdentifier(expression)) {
            paramName = expression.getText();
            if (paramName === 'String') {
                return true;
            }
        } else if (expression.kind === ts.SyntaxKind.ThisKeyword) {
            this.addArkIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                this.metaData.description
            );
            return true;
        } else if (ts.isNonNullExpression(expression) && child.expression?.questionDotToken?.kind === ts.SyntaxKind.QuestionDotToken) {
            const innerExpression = expression.expression;
            if (this.checkIdentifierExpressionForTypeLiteral(innerExpression, child, arkFile, positionInfo)) {
                return true;
            }
        } else if (ts.isParenthesizedExpression(expression)) {
            const innerExpression = expression.expression;
            if (this.checkNonNullExpressionForTypeLiteral(innerExpression, child, arkFile, positionInfo)) {
                return true;
            }
        }
        return false;
    }

    private checkBlockAndFunction(
        child: ts.ReturnStatement,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        paramName: string
    ): void {
        if (!ts.isBlock(child.parent)) {
            return;
        }
        const parentParent = child.parent.parent;
        if (
            !ts.isFunctionDeclaration(parentParent) &&
            !ts.isFunctionExpression(parentParent) &&
            !ts.isMethodDeclaration(parentParent) &&
            !ts.isArrowFunction(parentParent)
        ) {
            return;
        }
        const parentParentParent = parentParent.parent;
        const parentParentParentParent = parentParentParent.parent;
        if (this.checkParentCallExpression(parentParentParent, parentParentParentParent, arkFile, positionInfo)) {
            return;
        }
        let isNumeric = false;
        const numeric = this.checkStatementsForParamName(child.parent.statements, paramName);
        if (numeric) {
            isNumeric = numeric;
        }
        const parameters = parentParent.parameters;
        const matchingParam = parameters.find(param =>
            param.name.getText() === paramName && param.type === undefined);
        if (isNumeric) {
            return;
        }
        if (matchingParam && paramName !== '') {
            this.addArkIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description
            );
        }
    }

    private checkParentCallExpression(
        parentParentParent: ts.Node,
        parentParentParentParent: ts.Node,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if ((ts.isParenthesizedExpression(parentParentParent)) && parentParentParentParent.kind === ts.SyntaxKind.CallExpression) {
            if (ts.isCallExpression(parentParentParentParent)) {
                if (parentParentParentParent.arguments.length > 0) {
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                    return true;
                }
            }
            return true;
        }
        return false;
    }

    private checkStatementsForParamName(statements: ts.NodeArray<ts.Statement>, paramName: string): boolean {
        return statements.some(param => {
            if (ts.isVariableStatement(param) && ts.isVariableDeclarationList(param.declarationList)) {
                return param.declarationList.declarations.some(dec => dec.name.getText() === paramName);
            } else if (ts.isFunctionDeclaration(param)) {
                return param.name && ts.isIdentifier(param.name) && param.name.getText() === paramName;
            }
            return false;
        });
    }

    public check = (targetMethod: ArkMethod): void => {
        const stmts = targetMethod.getBody()?.getCfg().getStmts() ?? [];
        if (!this.getFileExtension(targetMethod.getDeclaringArkClass().getDeclaringArkFile().getName(), 'ts')) {
            return;
        }
        for (const stmt of stmts) {
            if (stmt instanceof ArkReturnStmt) {
                if (this.checkReturnStatementBlock(stmt, targetMethod)) {
                    return;
                }
            }
        }
    }

    private checkReturnStatementBlock(stmt: ArkReturnStmt, targetMethod: ArkMethod): boolean {
        if (stmt.getOp()) {
            const type = stmt.getOp().getType();
            if (type instanceof ClassType && !this.isAllowedClassType(type)) {
                return true;
            }
            if (this.isUnionType(type)) {
                return true;
            }
        }
        if (this.analyzeReturnStmt(stmt)) {
            return true;
        }
        this.checkReturnType(stmt, targetMethod.getCode() ?? '');
        return false;
    }

    private isAllowedClassType(type: ClassType): boolean {
        const className = type.getClassSignature().getClassName();
        return className === 'Map' || className === 'Set';
    }

    private isUnionType(type: any): boolean {
        return type instanceof UnionType;
    }

    private checkReturnStatement(node: ts.Node, foundAnyKeyword: { value: boolean }): void {
        if (!ts.isReturnStatement(node)) {
            return;
        }
        const expr = node.expression;
        if (!expr || !ts.isAsExpression(expr)) {
            return;
        }
        const typeRef = expr.type;
        if (!ts.isTypeReferenceNode(typeRef)) {
            return;
        }
        if (typeRef.typeArguments?.some(typeArg =>
            ts.isArrayTypeNode(typeArg) && typeArg.elementType.kind === ts.SyntaxKind.AnyKeyword
        )) {
            return;
        }
        if (typeRef.typeArguments?.some(typeArg => typeArg.kind !== ts.SyntaxKind.AnyKeyword)) {
            foundAnyKeyword.value = true;
        }
    }

    private checkExpressionStatement(node: ts.Node, foundAnyKeyword: { value: boolean }): void {
        if (ts.isExpressionStatement(node) || ts.isReturnStatement(node)) {
            if (node.expression && ts.isArrayLiteralExpression(node.expression)) {
                if (node.expression.elements.length === 0) {
                    foundAnyKeyword.value = true;
                }
            } else if (node.expression && ts.isNewExpression(node.expression)) {
                if (ts.isIdentifier(node.expression.expression) && node.expression.expression.getText() === 'Array' &&
                    node.expression.arguments?.length === 0) {
                    foundAnyKeyword.value = true;
                }
            }
        }
    }

    private analyzeReturnStmt(stmt: ArkReturnStmt): boolean {
        const code = stmt.getOriginalText() || '';
        const asRoot = AstTreeUtils.getASTNode('example.ts', code);
        const foundAnyKeyword = {value: false};
        ts.forEachChild(asRoot, node => {
            this.checkReturnStatement(node, foundAnyKeyword);
            this.checkExpressionStatement(node, foundAnyKeyword);
        });
        return foundAnyKeyword.value;
    }

    private checkReturnType(stmt: ArkReturnStmt, methodCode: string): void {
        if (stmt.getOp().getType().getTypeString().includes('any')) {
            if (!this.checkUnknownBeforeBrace(methodCode)) {
                const code = stmt.getOriginalText() || '';
                const asRoot = AstTreeUtils.getASTNode('example.ts', code);
                let des = this.metaData.description;
                ts.forEachChild(asRoot, node => {
                    des = this.checkReturnOrExpressionStatement(node, des);
                });
                this.addIssueReport(stmt, des);
            }
        }
    }

    private checkReturnOrExpressionStatement(
        node: ts.Node,
        des: string
    ): string {
        if (ts.isReturnStatement(node) || ts.isExpressionStatement(node)) {
            if (node.expression && ts.isAsExpression(node.expression)) {
                if (ts.isArrayLiteralExpression(node.expression.expression) && node.expression?.type?.getText() === 'any[]') {
                    des = 'Unsafe return of an `any[]` typed value.';
                }
                if (node.expression?.type?.getText() === 'readonly any[]') {
                    des = 'Unsafe return of an `any[]` typed value.';
                }
                if (ts.isTypeReferenceNode(node.expression.type) && node.expression.type.typeName.getText() === 'Array') {
                    des = 'Unsafe return of an `any[]` typed value.';
                }
            } else if (node.expression && ts.isNewExpression(node.expression)) {
                if (ts.isIdentifier(node.expression.expression) && node.expression.expression.getText() === 'Set') {
                    des = 'Unsafe return of type `Set<any>` from function with return type `Set<string>`.';
                }
                if (ts.isIdentifier(node.expression.expression) && node.expression.expression.getText() === 'Array') {
                    des = 'Unsafe return of an `any[]` typed value.';
                }
            }
        }
        return des;
    }

    private checkUnknownBeforeBrace(code: string): boolean {
        return this.regex.test(code);
    }

    private getFileExtension(filePath: string, filetype: string): boolean {
        const match = filePath.match(/\.([0-9a-zA-Z]+)$/);
        if (match) {
            const extension = match[1];
            return extension === filetype;
        }
        return false;
    }

    private addIssueReport(stmt: Stmt, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt);
        const defect = new Defects(warnInfo.line!, warnInfo.startCol, warnInfo.endCol, message, severity,
            this.rule.ruleId, warnInfo.filePath, this.metaData.ruleDocPath, true, false, false)
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private getPositionInfo(expression: ts.ReturnStatement | ts.Node, sourceFile: ts.SourceFileLike): {
        startPosition: ts.LineAndCharacter;
        endPosition: ts.LineAndCharacter
    } {
        const start = expression.getStart();
        const end = expression.getEnd();
        const startPositionInfo = sourceFile.getLineAndCharacterOfPosition(start);
        const endPositionInfo = sourceFile.getLineAndCharacterOfPosition(end);
        return {
            startPosition: startPositionInfo,
            endPosition: endPositionInfo
        };
    }

    private addArkIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string, fix?: RuleFix): Defects {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
        return defect;
    }

    private getLineAndColumn(stmt: Stmt): { line: number, startCol: number, endCol: number, filePath: string } {
        const originalPositions = stmt.getOriginPositionInfo();
        if (originalPositions) {
            const line = originalPositions.getLineNo();
            const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
            if (arkFile) {
                let startCol = originalPositions.getColNo();
                const endCol = originalPositions.getColNo();
                const filePath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
                return {line, startCol, endCol, filePath: filePath}
            } else {
                logger.debug('originStmt or arkFile is null');
            }
        }
        return {line: -1, startCol: -1, endCol: -1, filePath: ''};
    }
}