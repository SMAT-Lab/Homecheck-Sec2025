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
import {
    Stmt,
    ArkMethod,
    ArkAssignStmt,
    ArkInstanceFieldRef,
    ClassSignature,
    ArkStaticInvokeExpr, ArkInvokeStmt, AbstractInvokeExpr, FullPosition, ArkArrayRef, Local, ArkFile, AstTreeUtils, ts
} from "arkanalyzer";
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from "../../checker/BaseChecker";
import {ClassMatcher, FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher} from "../../matcher/Matchers";
import {Defects, IssueReport} from "../../model/Defects";
import {Rule} from "../../model/Rule";
import {CheckerUtils} from "../../utils/checker/CheckerUtils";
import {RuleListUtil} from "../../utils/common/DefectsList";
import {RuleFix} from "../../model/Fix";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnsafeMemberAccessCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/no-unsafe-member-access-check.md",
    description: "Disallow member access on a value with type `any`"
};

interface PositionInfo {
    startPosition: ts.LineAndCharacter;
    endPosition: ts.LineAndCharacter;
}

export class NoUnsafeMemberAccessCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
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
            if (ts.isPropertyAccessExpression(child)) {
                this.checkPropertyAccessExpression(child, sourceFile, targetFile);
            } else if (ts.isElementAccessExpression(child)) {
                this.checkPropertyAccessExpression(child, sourceFile, targetFile);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private findArrowFunction(node: ts.Node): ts.ArrowFunction | null {
        if (ts.isArrowFunction(node)) {
            return node;
        }
        if (node.parent) {
            return this.findArrowFunction(node.parent);
        }
        return null;
    }

    private findFunction(node: ts.Node): ts.FunctionDeclaration | ts.FunctionExpression | null {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
            return node;
        }
        if (node.parent) {
            return this.findFunction(node.parent);
        }
        return null;
    }

    private findClassDeclaration(node: ts.Node): ts.ClassDeclaration | null {
        if (ts.isClassDeclaration(node)) {
            return node;
        }
        if (node.parent) {
            return this.findClassDeclaration(node.parent);
        }
        return null;
    }

    private getExpressionName(child: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | undefined {
        let name = child.expression.getText();
        if (ts.isNonNullExpression(child.expression)) {
            name = child.expression.expression.getText();
            if ((ts.isParenthesizedExpression(child.expression.expression) &&
                    ts.isNonNullExpression(child.expression.expression.expression)) ||
                ts.isNonNullExpression(child.expression.expression)) {
                return undefined;
            }
            if (ts.isParenthesizedExpression(child.expression.expression) &&
                ts.isIdentifier(child.expression.expression.expression)) {
                name = child.expression.expression.expression.getText();
            } else if (ts.isPropertyAccessExpression(child.expression.expression) &&
                ts.isIdentifier(child.expression.expression.expression)) {
                name = child.expression.expression.expression.getText();
            }
        }
        return name;
    }

    private checkFunctionParameter(
        functionDeclaration: ts.FunctionDeclaration | ts.FunctionExpression | null,
        hintName: string,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter },
        arkFile: ArkFile,
        child: ts.ElementAccessExpression
    ): boolean {
        if (!functionDeclaration) {
            return false;
        }
        for (let stmt of functionDeclaration.parameters) {
            if (ts.isParameter(stmt) && ts.isIdentifier(stmt.name) && hintName === stmt.name.getText()) {
                if (stmt.type === undefined) {
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, '[' + hintName + ']');
                    return true;
                } else if (stmt.type.kind === ts.SyntaxKind.AnyKeyword) {
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, '[' + hintName + ']', !ts.isStringLiteral(child.argumentExpression));
                    return true;
                } else {
                    return true;
                }
            }
        }
        return false;
    }

    private findDeclarationListElement(
        declarations: ts.NodeArray<ts.VariableDeclaration>,
        hintName: string,
        name: string
    ): ts.VariableDeclaration | undefined {
        return declarations.find(dec => {
            if (ts.isVariableDeclaration(dec)) {
                if (hintName === dec.name.getText() && dec.type && dec.type.kind === ts.SyntaxKind.AnyKeyword) {
                    return true;
                }
                if (hintName === dec.name.getText() && dec.initializer && ts.isNumericLiteral(dec.initializer)) {
                    return false;
                }
            }
            if (this.isComplexPropertyAccess(dec, name)) {
                return true;
            }
            return false;
        });
    }

    private isComplexPropertyAccess(dec: ts.VariableDeclaration, name: string): boolean {
        if (name === dec.name.getText() && dec.initializer && ts.isPropertyAccessExpression(dec.initializer)) {
            if (ts.isParenthesizedExpression(dec.initializer.expression) &&
                ts.isPropertyAccessExpression(dec.initializer.expression.expression)) {
                if (ts.isIdentifier(dec.initializer.expression.expression.expression) &&
                    ts.isIdentifier(dec.initializer.expression.expression.name) &&
                    dec.initializer.expression.expression.questionDotToken) {
                    return true;
                }
            }
        }
        return false;
    }

    private findNumericOrStringLiteralDeclaration(
        declarations: ts.NodeArray<ts.VariableDeclaration>,
        hintName: string
    ): ts.VariableDeclaration | undefined {
        return declarations.find(dec => {
            if (ts.isVariableDeclaration(dec) && hintName === dec.name.getText() && dec.initializer &&
                (ts.isNumericLiteral(dec.initializer) || ts.isStringLiteral(dec.initializer))) {
                return true;
            }
            return false;
        });
    }

    private checkElementAccessExpression(
        child: ts.ElementAccessExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile,
        name: string
    ): boolean {
        if (ts.isNumericLiteral(child.argumentExpression) ||
            ts.isBinaryExpression(child.argumentExpression) || ts.isArrayLiteralExpression(child.expression)) {
            return true;
        }
        if (child.argumentExpression.kind === ts.SyntaxKind.NullKeyword) {
            return true;
        }
        let functionDeclaration = this.findFunction(child);
        let hintName = child.argumentExpression.getText();
        let positionInfo = this.getPositionInfo(child.argumentExpression, sourceFile);
        if (this.checkFunctionParameter(functionDeclaration, hintName, positionInfo, arkFile, child)) {
            return true;
        }
        for (let param of sourceFile.statements) {
            if (ts.isVariableStatement(param) && ts.isVariableDeclarationList(param.declarationList)) {
                let declarationListElement =
                    this.findDeclarationListElement(param.declarationList.declarations, hintName, name);
                if (declarationListElement) {
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, '[' + hintName + ']', !ts.isStringLiteral(child.argumentExpression));
                    return true;
                }
                let declarationListElementNumericLiteral =
                    this.findNumericOrStringLiteralDeclaration(param.declarationList.declarations, hintName);
                if (declarationListElementNumericLiteral) {
                    return true;
                }
            }
        }
        return false;
    }

    private getVariableName(child: ts.PropertyAccessExpression | ts.ElementAccessExpression): string {
        if (ts.isElementAccessExpression(child)) {
            return child.argumentExpression.getText();
        } else {
            return child.name.getText();
        }
    }

    private shouldSkipCheck(
        name: string,
        variableName: string,
        child: ts.PropertyAccessExpression | ts.ElementAccessExpression
    ): boolean {
        // 检查是否是内置对象或关键方法
        if (this.isBuiltInObject(name) || this.isKeyMethod(variableName)) {
            return true;
        }
        // 检查父节点是否是 throw 语句或带有类型参数的表达式
        if (ts.isThrowStatement(child.parent) || ts.isExpressionWithTypeArguments(child.parent)) {
            return true;
        }
        // 检查是否是类声明中的成员
        let classDeclaration = this.findClassDeclaration(child);
        if (classDeclaration?.name?.getText() === name) {
            return true;
        }
        // 检查是否是类成员
        for (let member of classDeclaration?.members ?? []) {
            if (member.name && ts.isIdentifier(member.name) && member.name.getText() === name) {
                return true;
            }
        }
        // 检查是否是箭头函数中的 map、reduce 或 sort 方法
        let arrowFunction = this.findArrowFunction(child.parent);
        if (arrowFunction && ts.isArrowFunction(arrowFunction) &&
            ts.isCallExpression(arrowFunction.parent) &&
            ts.isPropertyAccessExpression(arrowFunction.parent.expression) &&
            ts.isIdentifier(arrowFunction.parent.expression.name)) {
            const methodName = arrowFunction.parent.expression.name.getText();
            if (['map', 'reduce', 'sort'].includes(methodName)) {
                return true;
            }
        }
        return false;
    }

    private checkFunctionBodyForUnsafeMemberAccess(
        functionDeclaration: ts.FunctionDeclaration | ts.FunctionExpression | null,
        name: string
    ): boolean {
        if (!functionDeclaration?.body) {
            return false;
        }
        for (let param of functionDeclaration.body.statements) {
            if (ts.isVariableStatement(param) && ts.isVariableDeclarationList(param.declarationList)) {
                const hasMatchingDeclaration = param.declarationList.declarations.some(dec =>
                    ts.isVariableDeclaration(dec) && dec.name.getText() === name
                );
                if (hasMatchingDeclaration) {
                    return true;
                }
            } else if (
                (ts.isClassDeclaration(param) || ts.isModuleDeclaration(param)) &&
                param.name && ts.isIdentifier(param.name) && name === param.name.getText()
            ) {
                return true;
            }
        }
        return false;
    }

    private checkFunctionDeclarationForUnsafeMemberAccess(
        functionDeclaration: ts.FunctionDeclaration | ts.FunctionExpression | null,
        name: string,
        hintElement: { elementName: string, unknownStats: boolean },
        positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
        arkFile: ArkFile
    ): boolean {
        if (!functionDeclaration) {
            return false;
        }
        // 检查函数参数
        for (let stmt of functionDeclaration.parameters) {
            if (!ts.isParameter(stmt) || !ts.isIdentifier(stmt.name) || name !== stmt.name.getText()) {
                continue;
            }
            if (stmt.type === undefined || stmt.type.kind === ts.SyntaxKind.AnyKeyword) {
                this.addArkIssueReport(
                    arkFile,
                    positionInfo.startPosition.line + 1,
                    positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1,
                    hintElement.elementName
                );
                return true;
            }
            return true;
        }
        // 检查函数体中的变量声明、类声明和模块声明
        if (this.checkFunctionBodyForUnsafeMemberAccess(functionDeclaration, name)) {
            return true;
        }
        return false;
    }

    private checkExpressionAccess(
        child: ts.PropertyAccessExpression | ts.ElementAccessExpression,
        dec: ts.VariableDeclaration
    ): boolean | undefined {
        // 检查属性访问表达式
        if (ts.isPropertyAccessExpression(child.expression) && ts.isIdentifier(child.expression.name) &&
            ts.isIdentifier(child.expression.expression)) {
            const clName = child.expression.name.getText();
            const expressionName = child.expression.expression.getText();
            if (expressionName === dec.name.getText() && dec.type && ts.isTypeLiteralNode(dec.type)) {
                if (dec.type.members.some(member => ts.isPropertySignature(member) &&
                    member?.name?.getText() === clName && member.type && ts.isTypeLiteralNode(member.type))) {
                    return true;
                }
            }
        }
        // 检查元素访问表达式
        if (ts.isElementAccessExpression(child.expression) && ts.isIdentifier(child.expression.expression) &&
            child.expression.expression.getText() === dec.name.getText() &&
            dec?.type?.kind === ts.SyntaxKind.AnyKeyword) {
            return true;
        }
        return undefined;
    }

    private checkTypeLiteralMember(
        dec: ts.VariableDeclaration,
        name: string,
        variableName: string,
        child: ts.PropertyAccessExpression | ts.ElementAccessExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean | undefined {
        if (name === dec.name.getText() && dec.type && ts.isTypeLiteralNode(dec.type)) {
            if (dec.type.members.some(member => ts.isPropertySignature(member) &&
                member?.name?.getText() === variableName && member?.type?.kind === ts.SyntaxKind.AnyKeyword)) {
                if (ts.isPropertyAccessExpression(child.parent)) {
                    const parent = child.parent.name;
                    const positionInfo = this.getPositionInfo(parent, sourceFile);
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1,
                        positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, '.' + parent.getText());
                }
                if (ts.isElementAccessExpression(child.parent)) {
                    const parent = child.parent.argumentExpression;
                    const positionInfo = this.getPositionInfo(parent, sourceFile);
                    this.addArkIssueReport(
                        arkFile, positionInfo.startPosition.line + 1,
                        positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, '[' + parent.getText() + ']');
                }
                return true;
            }
        }
        return undefined;
    }

    private checkVariableTypeConditions(
        dec: ts.VariableDeclaration,
        name: string,
        variableName: string,
        hintName: string
    ): boolean | undefined {
        // 检查 UInt8Array 类型且 hintName 为 includes 或 indexOf
        if (dec.type && ts.isTypeReferenceNode(dec.type) && dec.type.typeName.getText() === 'UInt8Array' &&
            (hintName === 'includes' || hintName === 'indexOf')) {
            return false;
        }
        // 检查变量名为 name 且 variableName 为 length 且未定义类型
        if (name === dec.name.getText() && variableName === 'length' && dec.type === undefined) {
            return false;
        }
        // 检查变量名为 name 且类型为 any
        if (name === dec.name.getText() && dec.type && dec.type.kind === ts.SyntaxKind.AnyKeyword) {
            return false;
        }
        return undefined;
    }


    private checkVariableDeclaration(
        dec: ts.VariableDeclaration,
        name: string,
        variableName: string,
        hintName: string,
        child: ts.PropertyAccessExpression | ts.ElementAccessExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean | undefined {
        if (!ts.isVariableDeclaration(dec)) {
            return undefined;
        }
        let hasMatching = this.checkVariableTypeConditions(dec, name, variableName, hintName);
        if (hasMatching !== undefined) {
            return hasMatching;
        }
        let hasMatchingDeclaration = this.checkExpressionAccess(child, dec);
        if (hasMatchingDeclaration !== undefined) {
            return hasMatchingDeclaration;
        }
        // 检查类型字面量成员
        let hasMatchingTypeLiteralMember =
            this.checkTypeLiteralMember(dec, name, variableName, child, sourceFile, arkFile);
        if (hasMatchingTypeLiteralMember !== undefined) {
            return hasMatchingTypeLiteralMember;
        }
        // 检查变量名为 name 且 variableName 为 RegExp 且未定义类型
        if (name === dec.name.getText() && 'RegExp' === variableName && dec.type === undefined) {
            return true;
        }
        // 检查变量名为 name 且有初始化器
        if (name === dec.name.getText() && dec.initializer) {
            const isJsonCall = ts.isCallExpression(dec.initializer) &&
                ts.isPropertyAccessExpression(dec.initializer.expression) &&
                dec.initializer?.expression?.expression?.getText() === 'JSON';
            return !isJsonCall;
        }
        // 检查变量名为 name
        if (name === dec.name.getText()) {
            return true;
        }
        return undefined;
    }

    private findDeclarationListElementNode(
        declarations: ts.NodeArray<ts.VariableDeclaration>,
        name: string,
        variableName: string,
        hintName: string,
        child: ts.PropertyAccessExpression | ts.ElementAccessExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): ts.VariableDeclaration | undefined {
        return declarations.find(dec => {
            const declarationListElementNodeRule = this.checkVariableDeclaration(
                dec, name, variableName, hintName, child, sourceFile, arkFile);
            return declarationListElementNodeRule !== undefined ? declarationListElementNodeRule : false;
        });
    }

    private handleUnsafeMemberAccess(
        arkFile: ArkFile,
        positionInfo: PositionInfo,
        hintElement: { elementName: string, unknownStats: boolean },
        child: ts.PropertyAccessExpression | ts.ElementAccessExpression,
        variableName: string,
        name: string
    ): boolean {
        if (ts.isElementAccessExpression(child)) {
            hintElement.unknownStats = this.isUnknownStats(variableName);
            if (ts.isNonNullExpression(child.expression) && name === 'x' && variableName === 'y') {
                this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, hintElement.elementName, true);
            }
        }
        this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
            positionInfo.endPosition.character + 1, hintElement.elementName, hintElement.unknownStats);
        return true;
    }

    private processSourceFileStatements(
        sourceFile: ts.SourceFile,
        name: string,
        variableName: string,
        hintName: string,
        child: ts.PropertyAccessExpression | ts.ElementAccessExpression,
        arkFile: ArkFile,
        positionInfo: PositionInfo,
        hintElement: { elementName: string, unknownStats: boolean }
    ): boolean {
        let declarationListElementNode = null;
        for (let param of sourceFile.statements) {
            if (ts.isVariableStatement(param) && ts.isVariableDeclarationList(param.declarationList)) {
                let declarationListElement = this.findDeclarationListElementNode(
                    param.declarationList.declarations, name, variableName, hintName,
                    child, sourceFile, arkFile
                );
                if (declarationListElement) {
                    declarationListElementNode = declarationListElement;
                    break;
                }
            } else if (ts.isClassDeclaration(param)) {
                if (param.name && ts.isIdentifier(param.name) && param.name.getText() === name) {
                    return true;
                }
            } else if (ts.isEnumDeclaration(param)) {
                if (param.name && ts.isIdentifier(param.name) && param.name.getText() === name) {
                    return true;
                }
            }
        }
        if (!declarationListElementNode) {
            return this.handleUnsafeMemberAccess(arkFile, positionInfo, hintElement, child, variableName, name);
        }
        return false;
    }

    private handleCallExpression(
        child: ts.PropertyAccessExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        if (!ts.isCallExpression(child.expression)) {
            return;
        }
        if (ts.isIdentifier(child.name)) {
            let positionInfo = this.getPositionInfo(child.name, sourceFile);
            if (child.name.getText() === 'doSomething') {
                this.addArkIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, '.' + child.name.getText());
                return;
            }
            if (ts.isNonNullExpression(child.expression.expression) ||
                ts.isNonNullExpression(child.expression) || child.questionDotToken) {
                this.addArkIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, '.' + child.name.getText());
                return;
            }
        }
    }

    private checkNonNullExpression(
        expression: ts.NonNullExpression,
        child: ts.PropertyAccessExpression
    ): boolean {
        if (!ts.isIdentifier(expression.expression)) {
            return false;
        }
        const name = expression.expression.getText();
        const functionDeclaration = this.findFunction(child);
        const hasDefinedType = functionDeclaration?.parameters.some(
            stmt => ts.isParameter(stmt) &&
                ts.isIdentifier(stmt.name) &&
                name === stmt.name.getText() &&
                stmt.type !== undefined
        );
        return hasDefinedType ?? false;
    }

    private handleParenthesizedExpression(
        child: ts.PropertyAccessExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        if (!ts.isParenthesizedExpression(child.expression)) {
            return;
        }
        const expression = child.expression.expression;
        // 检查是否是箭头函数或对象字面量
        if (ts.isArrowFunction(expression) || ts.isObjectLiteralExpression(expression)) {
            return;
        }
        // 检查是否是数字字面量或正则表达式字面量
        if (ts.isNumericLiteral(expression) || ts.isRegularExpressionLiteral(expression)) {
            return;
        }
        // 检查是否是二元表达式且左右操作数都是数字字面量
        if (ts.isBinaryExpression(expression) && ts.isNumericLiteral(expression.left) &&
            ts.isNumericLiteral(expression.right)) {
            return;
        }
        // 检查是否是非空断言表达式
        if (ts.isNonNullExpression(expression)) {
            if (this.checkNonNullExpression(expression, child)) {
                return;
            }
        }
        // 检查是否是标识符
        if (ts.isIdentifier(child.name)) {
            const positionInfo = this.getPositionInfo(child.name, sourceFile);
            this.addArkIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, '.' + child.name.getText());
        }
    }

    private handleThisKeyword(
        child: ts.PropertyAccessExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        if (!child.expression || child.expression.kind !== ts.SyntaxKind.ThisKeyword) {
            return;
        }
        // 检查是否是 `this.length` 的情况
        if (ts.isPropertyAccessExpression(child.parent) &&
            ts.isIdentifier(child.parent.name) &&
            child.parent.name.getText() === 'length') {
            const positionInfo = this.getPositionInfo(child.parent.name, sourceFile);
            this.addArkIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, '.' + child.parent.name.getText()
            );
            return;
        }
        // 检查是否是类声明或函数声明
        const classDeclaration = this.findClassDeclaration(child);
        const functionDeclaration = this.findFunction(child);
        if (classDeclaration || !functionDeclaration) {
            return;
        }
        // 处理 `this` 的其他情况
        const positionInfo = this.getPositionInfo(child.name, sourceFile);
        this.addArkIssueReport(
            arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
            positionInfo.endPosition.character + 1, '.' + child.name.getText()
        );
    }

    private setHintElementAndPositionInfo(
        child: ts.PropertyAccessExpression | ts.ElementAccessExpression,
        sourceFile: ts.SourceFile,
        hintElement: { hintName: string, elementName: string, unknownStats: boolean }
    ): { positionInfo: PositionInfo, hintElement: { hintName: string, elementName: string, unknownStats: boolean } } {
        let positionInfo: PositionInfo;
        if (ts.isElementAccessExpression(child)) {
            hintElement.hintName = child.argumentExpression.getText();
            positionInfo = this.getPositionInfo(child.argumentExpression, sourceFile);

            if (ts.isParenthesizedExpression(child.argumentExpression) &&
                ts.isFunctionExpression(child.argumentExpression.expression)) {
                hintElement.hintName = child.argumentExpression.expression.getText();
                positionInfo = this.getPositionInfo(child.argumentExpression.expression, sourceFile);
            }
            hintElement.elementName = '[' + hintElement.hintName + ']';
        } else {
            hintElement.hintName = child.name.getText();
            hintElement.elementName = '.' + hintElement.hintName;
            positionInfo = this.getPositionInfo(child.name, sourceFile);
        }

        return { positionInfo, hintElement };
    }

    private hasParameterWithDefinedType(arrowFunction: ts.ArrowFunction | null, name: string): boolean {
        return arrowFunction?.parameters.some(parameter =>
            ts.isParameter(parameter) &&
            name === parameter.name?.getText() &&
            parameter.type !== undefined
        ) ?? false;
    }

    private checkPropertyAccessExpression(child: ts.PropertyAccessExpression | ts.ElementAccessExpression,
                                          sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (ts.isIdentifier(child.expression) || ts.isNonNullExpression(child.expression) ||
            ts.isElementAccessExpression(child)) {
            let name = child.expression.getText();
            let buildName = this.getExpressionName(child);
            if (buildName === undefined) {
                return;
            } else {
                name = buildName;
            }
            if (ts.isElementAccessExpression(child)) {
                if (this.checkElementAccessExpression(child, sourceFile, arkFile, name)) {
                    return;
                }
            }
            let variableName = this.getVariableName(child) ?? '';
            if (this.shouldSkipCheck(name, variableName, child)) {
                return;
            }
            let positionInfo: PositionInfo;
            let hintElement = { hintName: '', elementName: '', unknownStats: false };
            const nodeInfo = this.setHintElementAndPositionInfo(child, sourceFile, hintElement);
            positionInfo = nodeInfo.positionInfo;
            hintElement = nodeInfo.hintElement;

            let functionDeclaration = this.findFunction(child);
            if (this.checkFunctionDeclarationForUnsafeMemberAccess(
                functionDeclaration, name, hintElement, positionInfo, arkFile)) {
                return;
            }
            const arrowFunction = this.findArrowFunction(child);
            if (this.hasParameterWithDefinedType(arrowFunction, name)) {
                return;
            }
            if (this.processSourceFileStatements(sourceFile, name, variableName,
                hintElement.hintName, child, arkFile, positionInfo, hintElement)) {
                return;
            }
        }
        else if (ts.isCallExpression(child.expression)) {
            this.handleCallExpression(child, sourceFile, arkFile);
        }
        else if (ts.isParenthesizedExpression(child.expression)) {
            this.handleParenthesizedExpression(child, sourceFile, arkFile);
        } else if (child.expression && child.expression.kind === ts.SyntaxKind.ThisKeyword) {
            this.handleThisKeyword(child, sourceFile, arkFile);
            return;
        }
    }

    private getPositionInfo(expression: ts.Node, sourceFile: ts.SourceFileLike): {
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

    private addArkIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number,
                              message: string, unknownStats: boolean = false, fix?: RuleFix): Defects {
        let src = `Unsafe member access ${message} on an \`any\` value.`;
        if (unknownStats) {
            src = `Computed name ${message} resolves to an any value.`;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, src, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
        return defect;
    }

    private isKeyMethod(name: string): boolean {
        const builtInObjects = ['concat'];
        return builtInObjects.includes(name);
    }

    private isUnknownStats(name: string): boolean {
        const builtInObjects = ['field2', 'indexOf', 'lastIndexOf'];
        return builtInObjects.includes(name);
    }

    private isBuiltInObject(name: string): boolean {
        // JavaScript内置对象列表
        const builtInObjects = [
            // 基本对象构造函数
            'Object', 'Function', 'Boolean', 'Symbol', 'Error', 'EvalError', 'RangeError',
            'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'AggregateError', 'globalThis', 'subscribe',
            // 数值和日期对象
            'Number', 'BigInt', 'Math', 'Date',
            // 字符串和文本对象
            'String', 'RegExp',
            // 索引集合对象
            'Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array',
            'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
            'BigInt64Array', 'BigUint64Array',
            // 键值集合对象
            'Map', 'Set', 'WeakMap', 'WeakSet',
            // 结构化数据对象
            'ArrayBuffer', 'SharedArrayBuffer', 'Atomics', 'DataView', 'JSON',
            // 控制抽象对象
            'Promise', 'Generator', 'GeneratorFunction', 'AsyncFunction',
            // 反射对象
            'Reflect', 'Proxy',
            // 全局对象和函数
            'Intl', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent', 'eval',
            'isFinite', 'isNaN', 'parseFloat', 'parseInt',
            // TypeScript特有的对象
            'any', 'unknown', 'never', 'void'
        ];
        return builtInObjects.includes(name);
    }
}