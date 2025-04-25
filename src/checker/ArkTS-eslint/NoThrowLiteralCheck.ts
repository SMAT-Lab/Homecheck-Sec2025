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

import {ArkFile, AstTreeUtils, ts} from "arkanalyzer";
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData, FileMatcher, MatcherCallback, MatcherTypes} from '../../Index';
import {Defects} from "../../model/Defects";
import {Rule} from "../../model/Rule";
import {RuleListUtil} from "../../utils/common/DefectsList";
import {IssueReport} from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoThrowLiteralCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/no-throw-literal-check.md",
    description: "Expected an error object to be thrown.",
};

type Options = [{
    allowThrowingAny: boolean,
    allowThrowingUnknown: boolean
}]

interface PositionInfo {
    startPosition: ts.LineAndCharacter;
    endPosition: ts.LineAndCharacter;
}

export class NoThrowLiteralCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private allowThrowingAny = false;
    private allowThrowingUnknown = false;
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatcherCb];
    }

    public check = (arkFile: ArkFile): void => {
        if (this.rule && this.rule.option) {
            const option = this.rule.option as Options;
            if (option.length > 0) {
                this.allowThrowingAny = option[0].allowThrowingAny;
                this.allowThrowingUnknown = option[0].allowThrowingUnknown;
            }
        }
        const asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const sourceFileObject = ts.getParseTreeNode(asRoot);
        if (sourceFileObject == undefined) {
            return;
        }

        this.loopNode(arkFile, asRoot, sourceFileObject);
    }

    private loopNode(targetFile: ArkFile, sourceFile: ts.SourceFile, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isThrowStatement(child)) {
                this.processThrowAST(child, sourceFile, targetFile);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private processThrowAST(child: ts.ThrowStatement, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let positionInfo = this.getPositionInfo(child.expression, sourceFile);
        if (child.expression && ts.isPropertyAccessExpression(child.expression)) {
            this.handlePropertyAccessExpression(child.expression, sourceFile, arkFile, positionInfo);
        }
        if (child.expression && ts.isCallExpression(child.expression)) {
            this.handleCallExpression(child.expression, sourceFile, arkFile, positionInfo);
        }
        if (child.expression && ts.isIdentifier(child.expression)) {
            this.handleIdentifier(child.expression, sourceFile, arkFile, positionInfo);
            this.handleThrowStatementInBlock(child, arkFile, positionInfo);
        }
        if (child.expression && ts.isNewExpression(child.expression)) {
            this.handleNewExpression(child.expression, sourceFile, arkFile, positionInfo);
        }
        if (child.expression && (ts.isAsExpression(child.expression) ||
            ts.isTypeAssertionExpression(child.expression) || ts.isSatisfiesExpression(child.expression))) {
            const typeNode = child.expression.type;
            if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName) && typeNode.typeName.getText() !== 'Error') {
                this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.metaData.description);
            }
        }
        if (child.expression && ts.isPrefixUnaryExpression(child.expression)) {
            if (ts.isNumericLiteral(child.expression.operand)) {
                this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.metaData.description);
            }
        }
        this.handleOtherExpressions(child.expression, sourceFile, arkFile, positionInfo);
    }

    private handleThrowStatementInBlock(child: ts.ThrowStatement, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (ts.isBlock(child.parent) && child.expression.getText() !== 'e') {
            if (ts.isIfStatement(child.parent.parent)) {
                this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.metaData.description);
            }
            this.checkCatchClauseThrowExpression(child, arkFile, positionInfo);
        }
    }

    private checkCatchClauseThrowExpression(child: ts.ThrowStatement, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (ts.isCatchClause(child.parent.parent)) {
            const identifier = child.expression.getText();
            const variableDeclaration = child.parent.parent.variableDeclaration;
            if (variableDeclaration && ts.isVariableDeclaration(variableDeclaration) && ts.isIdentifier(variableDeclaration.name)) {
                if (variableDeclaration.name.getText() !== identifier) {
                    this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                }
            }
        }
    }

    private handlePropertyAccessExpression(expression: ts.PropertyAccessExpression,
                                           sourceFile: ts.SourceFile, arkFile: ArkFile, positionInfo: PositionInfo): void {
        const name = expression.name.getText();
        const className = this.getClassNameFromExpression(expression.expression);
        if (!className) {
            return;
        }
        const variableDeclaration = this.findVariableDeclaration(sourceFile, className);
        if (!variableDeclaration) {
            return;
        }
        const initializer = variableDeclaration.initializer;
        if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
            return;
        }
        for (const property of initializer.properties) {
            if (ts.isPropertyAssignment(property) && property.name.getText() === name) {
                if (this.isCommonKind(property.initializer.kind)) {
                    this.addIssueReport(arkFile, positionInfo.startPosition.line + 1,
                        positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                    break;
                }
            }
        }
    }

    private getClassNameFromExpression(expression: ts.Expression): string {
        if (ts.isIdentifier(expression)) {
            return expression.getText();
        }
        return '';
    }

    private findVariableDeclaration(sourceFile: ts.SourceFile, className: string): ts.VariableDeclaration | undefined {
        for (const node of sourceFile.statements) {
            if (ts.isVariableStatement(node)) {
                const declaration = node.declarationList.declarations
                    .find(decl => decl.name.getText() === className);
                if (declaration) {
                    return declaration;
                }
            }
        }
        return undefined;
    }

    private handleCallExpression(expression: ts.CallExpression, sourceFile: ts.SourceFile,
                                 arkFile: ArkFile, positionInfo: PositionInfo): void {
        const name = expression.expression.getText();
        const functionDeclaration = this.findFunctionDeclaration(sourceFile, name);
        if (!functionDeclaration) {
            return;
        }

        for (const childNode of functionDeclaration.body!.statements) {
            if (ts.isReturnStatement(childNode) && childNode.expression) {
                if (this.isCommonKind(childNode.expression.kind)) {
                    this.addIssueReport(arkFile, positionInfo.startPosition.line + 1,
                        positionInfo.startPosition.character + 1, positionInfo.endPosition.character + 1, this.metaData.description);
                    break;
                }
            }
        }
    }

    private findFunctionDeclaration(sourceFile: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined {
        for (const node of sourceFile.statements) {
            if (ts.isFunctionDeclaration(node) && node.name?.getText() === name) {
                return node;
            }
        }
        return undefined;
    }

    private handleIdentifier(expression: ts.Identifier, sourceFile: ts.SourceFile, arkFile: ArkFile, positionInfo: PositionInfo): void {
        let name = expression.getText();
        this.checkVariableDeclarations(name, sourceFile, arkFile, positionInfo);
        this.checkFunctionParameters(name, expression, arkFile, positionInfo);
        this.checkUndefined(name, arkFile, positionInfo);
    }

    private checkVariableDeclarations(name: string, sourceFile: ts.SourceFile, arkFile: ArkFile, positionInfo: PositionInfo): void {
        for (const node of sourceFile.statements) {
            if (ts.isVariableStatement(node)) {
                this.processVariableDeclarationByName(node, name, arkFile, positionInfo);
            }
        }
    }

    private processVariableDeclarationByName(node: ts.VariableStatement, name: string, arkFile: ArkFile, positionInfo: PositionInfo): void {
        for (let declaration of node.declarationList.declarations) {
            const nameText = declaration.name.getText();
            if (nameText === name) {
                this.checkDeclarationInitializer(declaration, arkFile, positionInfo);
                this.checkDeclarationType(declaration, arkFile, positionInfo);
                this.checkNewExpression(declaration, arkFile, positionInfo);
                break;
            }
        }
    }

    private checkDeclarationInitializer(declaration: ts.VariableDeclaration, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (declaration.initializer && this.isCommonKind(declaration.initializer.kind)) {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description);
        }
        if (declaration.initializer && ts.isAsExpression(declaration.initializer)) {
            this.checkAsExpression(declaration.initializer, arkFile, positionInfo);
        }
    }

    private checkAsExpression(asExpression: ts.AsExpression, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (asExpression.type.kind === ts.SyntaxKind.AnyKeyword && !this.allowThrowingAny) {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description);
        } else if (asExpression.type.kind === ts.SyntaxKind.UnknownKeyword && !this.allowThrowingUnknown) {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description);
        }
    }

    private checkDeclarationType(declaration: ts.VariableDeclaration, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (declaration.type) {
            if (declaration.type.kind === ts.SyntaxKind.NullKeyword) {
                this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.metaData.description);
            } else if (declaration.type.kind === ts.SyntaxKind.UnknownKeyword && !this.allowThrowingUnknown) {
                this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.metaData.description);
            }
        }
    }

    private checkNewExpression(declaration: ts.VariableDeclaration, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (declaration.initializer && ts.isNewExpression(declaration.initializer)) {
            let name = declaration.initializer.expression.getText();
            if (!name.includes('Error')) {
                this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.metaData.description);
            }
        }
    }

    private checkFunctionParameters(name: string, expression: ts.Identifier, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (expression.parent && expression.parent.parent && ts.isFunctionDeclaration(expression.parent.parent)) {
            expression.parent.parent.parameters.forEach((param) => {
                if (param.name.getText() === name) {
                    this.checkParameterType(param, arkFile, positionInfo);
                }
            });
        }
    }

    private checkParameterType(param: ts.ParameterDeclaration, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (param.type!.kind === ts.SyntaxKind.AnyKeyword && !this.allowThrowingAny) {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description);
        } else if (param.type!.kind === ts.SyntaxKind.UnknownKeyword && !this.allowThrowingUnknown) {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description);
        }
    }

    private checkUndefined(name: string, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (name === 'undefined') {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, 'Do not throw undefined.');
        }
    }

    private handleNewExpression(expression: ts.NewExpression, sourceFile: ts.SourceFile, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (expression.expression && ts.isIdentifier(expression.expression)) {
            let name = expression.expression.getText();
            for (const node of sourceFile.statements) {
                if (ts.isClassDeclaration(node)) {
                    this.checkClassDeclaration(node, name, arkFile, positionInfo);
                }
            }
        }
    }

    private checkClassDeclaration(node: ts.ClassDeclaration, name: string, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (node.name?.getText() !== name) {
            return;
        }
        if (!node.heritageClauses) {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description);
            return;
        }
        for (const heritageClause of node.heritageClauses) {
            if (!ts.isHeritageClause(heritageClause)) {
                continue;
            }
            for (const type of heritageClause.types) {
                if (ts.isExpressionWithTypeArguments(type) && !type.expression.getText().includes('Error')) {
                    this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                    return;
                }
            }
        }
    }

    private handleOtherExpressions(expression: ts.Expression, sourceFile: ts.SourceFile, arkFile: ArkFile, positionInfo: PositionInfo): void {
        if (expression.kind === ts.SyntaxKind.NullKeyword ||
            expression.kind === ts.SyntaxKind.FalseKeyword ||
            expression.kind === ts.SyntaxKind.TrueKeyword) {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description);
        }
        if (ts.isTemplateExpression(expression) ||
            ts.isBinaryExpression(expression) ||
            ts.isNumericLiteral(expression) ||
            ts.isStringLiteral(expression) ||
            ts.isObjectLiteralExpression(expression)) {
            this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, this.metaData.description);
        }
        if (ts.isParenthesizedExpression(expression)) {
            if (ts.isBinaryExpression(expression.expression)) {
                if (ts.isStringLiteral(expression.expression.right)) {
                    this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                }
            }
        }
        if (ts.isAsExpression(expression)) {
            if (expression.type) {
                if (expression.type.kind === ts.SyntaxKind.AnyKeyword && !this.allowThrowingAny) {
                    this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                } else if (expression.type.kind === ts.SyntaxKind.UnknownKeyword && !this.allowThrowingUnknown) {
                    this.addIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                }
            }
        }
    }


    private isCommonKind(kind?: ts.SyntaxKind): boolean {
        const excludedKinds = [
            ts.SyntaxKind.StringLiteral,
            ts.SyntaxKind.FalseKeyword,
            ts.SyntaxKind.TrueKeyword,
            ts.SyntaxKind.NumericLiteral,
            ts.SyntaxKind.BigIntLiteral
        ];
        return kind === undefined ? false : (excludedKinds.includes(kind));
    }

    private getPositionInfo(expression: ts.Expression, sourceFile: ts.SourceFileLike): PositionInfo {
        const start = expression.getStart();
        const end = expression.getEnd();
        const startPositionInfo = sourceFile.getLineAndCharacterOfPosition(start);
        const endPositionInfo = sourceFile.getLineAndCharacterOfPosition(end);
        return {
            startPosition: startPositionInfo,
            endPosition: endPositionInfo
        };
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.defects.push(defect);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}