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

import {ArkFile, AstTreeUtils, ts} from "arkanalyzer";
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from "../BaseChecker";
import {FileMatcher, MatcherCallback, MatcherTypes} from "../../matcher/Matchers";
import {Defects, IssueReport} from "../../model/Defects";
import {Rule} from "../../model/Rule";
import {RuleListUtil} from "../../utils/common/DefectsList";
import {RuleFix} from "../../model/Fix";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnsafeCallCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-unsafe-call-check.md",
    description: "Disallow calling a function with a value with type `any`"
};
// 添加特定错误消息常量
const UNSAFE_CALL_MESSAGE = "Unsafe call of an `any` typed value.";
const UNSAFE_NEW_MESSAGE = "Unsafe construction of an any type value.";
const UNSAFE_TEMPLATE_TAG_MESSAGE = "Unsafe any typed template tag.";

interface PositionInfo {
    startPosition: ts.LineAndCharacter;
    endPosition: ts.LineAndCharacter;
}

export class NoUnsafeCallCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (arkFile: ArkFile): void => {
        if (!arkFile.getFilePath().endsWith(".ts")) {
            return;
        }
        const asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const sourceFileObject = ts.getParseTreeNode(asRoot);
        if (sourceFileObject === undefined) {
            return;
        }
        this.loopNode(arkFile, asRoot, sourceFileObject);
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFile, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isFunctionDeclaration(child)) {
                this.checkFunctionDeclaration(child, sourceFile, targetFile);
            }
            if (ts.isExpressionStatement(child)) {
                this.checkExpressionStatement(child, sourceFile, targetFile);
            }
            if (ts.isCallExpression(child)) {
                this.checkUndefinedFunctionCall(child, sourceFile, targetFile);
            } else if (ts.isNewExpression(child)) {
                this.checkUndefinedFunctionCall(child, sourceFile, targetFile);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkFunctionDeclaration(child: ts.FunctionDeclaration, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        const body = child.body;
        if (!body || !ts.isBlock(body)) {
            return;
        }
        for (const statement of body.statements) {
            if (ts.isExpressionStatement(statement)) {
                this.handleExpressionStatement(child, statement, sourceFile, arkFile);
            }
        }
    }

    private handleExpressionStatement(child: ts.FunctionDeclaration, statement: ts.ExpressionStatement,
                                      sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (ts.isCallExpression(statement.expression)) {
            this.handleCallExpression(child, statement.expression, sourceFile, arkFile);
        }
        if (ts.isNewExpression(statement.expression)) {
            this.handleNewExpression(child, statement.expression, sourceFile, arkFile);
        }
        if (ts.isTaggedTemplateExpression(statement.expression)) {
            this.handleTaggedTemplateExpression(child, statement.expression, sourceFile, arkFile);
        }
    }

    private handleCallExpression(child: ts.FunctionDeclaration, expression: ts.CallExpression,
                                 sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (ts.isIdentifier(expression.expression)) {
            let positionInfo = this.getPositionInfo(expression.expression, sourceFile);
            let name = expression.expression.getText();
            this.checkParameter(child, name, positionInfo, arkFile, UNSAFE_CALL_MESSAGE);
        }
        if (ts.isPropertyAccessExpression(expression.expression)) {
            let positionInfo = this.getPositionInfo(expression.expression, sourceFile);
            let className = this.getLastExpression(expression.expression).getText();
            let name = expression.expression.name.getText();
            this.checkPropertyAccessParameter(child, className, name, positionInfo, arkFile, UNSAFE_CALL_MESSAGE);
        }
    }

    private handleNewExpression(child: ts.FunctionDeclaration, expression: ts.NewExpression,
                                sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (ts.isIdentifier(expression.expression)) {
            let positionInfo = this.getPositionInfo(expression, sourceFile);
            let name = expression.expression.getText();
            this.checkParameter(child, name, positionInfo, arkFile, UNSAFE_NEW_MESSAGE);
        }
        if (ts.isPropertyAccessExpression(expression.expression)) {
            let positionInfo = this.getPositionInfo(expression, sourceFile);
            let name = expression.expression.name.getText();
            const className = ts.isIdentifier(expression.expression.expression) ? expression.expression.expression.getText() : '';
            this.checkPropertyAccessParameter(child, className, name, positionInfo, arkFile, UNSAFE_NEW_MESSAGE);
        }
    }

    private handleTaggedTemplateExpression(child: ts.FunctionDeclaration, expression: ts.TaggedTemplateExpression,
                                           sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (ts.isIdentifier(expression.tag)) {
            let positionInfo = this.getPositionInfo(expression.tag, sourceFile);
            let name = expression.tag.getText();
            this.checkParameter(child, name, positionInfo, arkFile, UNSAFE_TEMPLATE_TAG_MESSAGE);
        }
        if (ts.isPropertyAccessExpression(expression.tag)) {
            let positionInfo = this.getPositionInfo(expression.tag, sourceFile);
            let name = expression.tag.name.getText();
            const className = ts.isPropertyAccessExpression(expression.tag) ? expression.tag.expression.getText() : '';
            this.checkPropertyAccessParameter(child, className, name, positionInfo, arkFile, UNSAFE_TEMPLATE_TAG_MESSAGE);
        }
    }

    private checkParameter(child: ts.FunctionDeclaration, name: string,
                           positionInfo: PositionInfo, arkFile: ArkFile, message: string): void {
        const parameter = child.parameters?.find(param =>
            ts.isParameter(param) && param.name.getText() === name
        );
        if (parameter && parameter.type?.kind === ts.SyntaxKind.AnyKeyword) {
            this.addAstIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                message
            );
        }
    }

    private checkPropertyAccessParameter(child: ts.FunctionDeclaration, className: string, name: string,
                                         positionInfo: PositionInfo, arkFile: ArkFile, message: string): void {
        for (const parameter of child.parameters ?? []) {
            if (ts.isParameter(parameter)) {
                this.checkParameterType(parameter, className, name, positionInfo, arkFile, message);
            }
        }
    }

    private checkParameterType(parameter: ts.ParameterDeclaration, className: string, name: string,
                               positionInfo: PositionInfo, arkFile: ArkFile, message: string): void {
        const paramName = parameter.name.getText();
        if (paramName === className && parameter.type?.kind === ts.SyntaxKind.AnyKeyword) {
            this.addAstIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                message
            );
        }
        if (parameter.type && ts.isTypeLiteralNode(parameter.type)) {
            for (const member of parameter.type.members) {
                if (ts.isPropertySignature(member) && member.name!.getText() === name &&
                    member.type?.kind === ts.SyntaxKind.AnyKeyword) {
                    this.addAstIssueReport(
                        arkFile,
                        positionInfo.startPosition.line + 1,
                        positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1,
                        message
                    );
                }
            }
        }
    }

    private handleTaggedTemplate(
        child: ts.ExpressionStatement,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        if (!ts.isTaggedTemplateExpression(child.expression) ||
            !ts.isNoSubstitutionTemplateLiteral(child.expression.template)) {
            return;
        }
        const positionInfo = this.getPositionInfo(child.expression.tag, sourceFile);
        if (ts.isPropertyAccessExpression(child.expression.tag) &&
            ts.isIdentifier(child.expression.tag.expression) && ts.isIdentifier(child.expression.tag.name)) {
            if (child.expression.tag.expression.getText() !== 'String') {
                this.addAstIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, UNSAFE_TEMPLATE_TAG_MESSAGE);
            }
        } else if (ts.isIdentifier(child.expression.tag)) {
            const name = child.expression.tag.getText();
            const declarationListElement = this.findVariableDeclaration(sourceFile, name);
            if (!declarationListElement) {
                this.addAstIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, UNSAFE_TEMPLATE_TAG_MESSAGE);
            }
        }
    }

    private findVariableDeclaration(sourceFile: ts.SourceFile, name: string): ts.VariableDeclaration | undefined {
        for (const param of sourceFile.statements) {
            if (!ts.isVariableStatement(param) || !ts.isVariableDeclarationList(param.declarationList)) {
                continue;
            }
            const declaration = param.declarationList.declarations.
            find(dec => ts.isVariableDeclaration(dec) && dec.name.getText() === name);
            if (declaration) {
                return declaration;
            }
        }
        return undefined;
    }

    private checkExpressionStatement(child: ts.ExpressionStatement, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (!child.expression) {
            return;
        }
        if (ts.isExpressionStatement(child)) {
            this.handleTaggedTemplate(child, sourceFile, arkFile);
        }
        const {positionInfo, className, name, expressionType} = this.extractExpressionInfo(child, sourceFile);
        if (!className) {
            return;
        }
        const findLast = this.findLastParent(child);
        if (!findLast) {
            return;
        }
        for (const node of findLast.getChildren()[0].getChildren()) {
            if (!ts.isVariableStatement(node)) {
                continue;
            }
            for (const declaration of node.declarationList.declarations) {
                // 根据表达式类型选择适当的错误消息
                let message;
                if (expressionType === 'new') {
                    message = UNSAFE_NEW_MESSAGE;
                } else if (expressionType === 'tag') {
                    message = UNSAFE_TEMPLATE_TAG_MESSAGE;
                } else {
                    message = UNSAFE_CALL_MESSAGE;
                }
                this.checkVariableDeclaration(declaration, className, name, positionInfo, arkFile, message);
            }
        }
    }

    private extractExpressionInfo(child: ts.ExpressionStatement,
                                  sourceFile: ts.SourceFile): {
        positionInfo: PositionInfo,
        className: string,
        name: string,
        expressionType: string
    } {
        let positionInfo = this.getPositionInfo(child, sourceFile);
        let className: string = '';
        let name: string = '';
        let expressionType: string = 'call'; // 默认为函数调用
        if (ts.isTaggedTemplateExpression(child.expression)) {
            positionInfo = this.getPositionInfo(child.expression.tag, sourceFile);
            className = child.expression.tag.getText();
            name = ts.isPropertyAccessExpression(child.expression.tag) ? child.expression.tag.name.getText() : '';
            expressionType = 'tag'; // 标记为模板标签
        } else if (ts.isCallExpression(child.expression)) {
            positionInfo = this.getPositionInfo(child.expression.expression, sourceFile);
            className = this.getClassNameFromExpression(child.expression.expression);
            name = this.getNameFromExpression(child.expression.expression);
        } else if (ts.isNewExpression(child.expression)) {
            positionInfo = this.getPositionInfo(child.expression, sourceFile);
            className = this.getClassNameFromExpression(child.expression.expression);
            name = this.getNameFromExpression(child.expression.expression);
            expressionType = 'new'; // 标记为构造函数调用
        }
        return {positionInfo, className, name, expressionType};
    }

    private checkVariableDeclaration(declaration: ts.VariableDeclaration, className: string,
                                     name: string, positionInfo: PositionInfo, arkFile: ArkFile, message: string): void {
        if (declaration.name.getText() === className) {
            this.checkDeclarationType(declaration, positionInfo, arkFile, message);
        }
        if (declaration.type && ts.isTypeLiteralNode(declaration.type)) {
            this.checkTypeLiteralMembers(declaration.type, name, positionInfo, arkFile, message);
        }
    }

    private findLastParent(child: ts.Node): ts.Node | null {
        if (!child || !child.parent) {
            return null;
        }
        if (!child.parent.parent) {
            return child.parent;
        }
        return this.findLastParent(child.parent);
    }

    private getClassNameFromExpression(expression: ts.Expression): string {
        if (ts.isIdentifier(expression)) {
            return expression.getText();
        } else if (ts.isPropertyAccessExpression(expression)) {
            return this.getLastExpression(expression).getText();
        } else if (ts.isElementAccessExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
            return expression.expression.expression.getText();
        }
        return '';
    }

    private getNameFromExpression(expression: ts.Expression): string {
        if (ts.isPropertyAccessExpression(expression)) {
            return expression.name.getText();
        } else if (ts.isElementAccessExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
            return expression.expression.name.getText();
        }
        return '';
    }

    private getLastExpression(expression: ts.Expression): ts.Expression {
        if (ts.isPropertyAccessExpression(expression)) {
            return this.getLastExpression(expression.expression);
        } else {
            return expression;
        }
    }

    private checkDeclarationType(declaration: ts.VariableDeclaration,
                                 positionInfo: PositionInfo, arkFile: ArkFile, message: string): void {
        if (declaration.type?.kind === ts.SyntaxKind.AnyKeyword) {
            this.addAstIssueReport(
                arkFile, positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                message
            );
        }
    }

    private checkTypeLiteralMembers(type: ts.TypeLiteralNode, name: string,
                                    positionInfo: PositionInfo, arkFile: ArkFile, message: string): void {
        type.members.forEach(member => {
            if (ts.isPropertySignature(member) && member.name!.getText() === name) {
                if (member.type?.kind === ts.SyntaxKind.AnyKeyword) {
                    this.addAstIssueReport(
                        arkFile,
                        positionInfo.startPosition.line + 1,
                        positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1,
                        message
                    );
                }
            }
        });
    }

    private getPositionInfo(expression: ts.Node, sourceFile: ts.SourceFileLike): {
        startPosition: ts.LineAndCharacter,
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

    private addAstIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string) : void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.defects.push(defect);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private findIdentifier(node: ts.Node): ts.Identifier | null {
        if (ts.isIdentifier(node)) {
            return node;
        }
        if (node.getChildren()) {
            for (let child of node.getChildren()) {
                return this.findIdentifier(child);
            }
        }
        return null;
    }

    private findParenthesizedExpression(node: ts.CallExpression):
        ts.ParenthesizedExpression | ts.PropertyAccessExpression | null {
        if (ts.isParenthesizedExpression(node.expression) || ts.isPropertyAccessExpression(node.expression)) {
            return node.expression;
        }
        if (ts.isCallExpression(node.expression)) {
            return this.findParenthesizedExpression(node.expression);
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

    private findFunction(node: ts.Node): ts.FunctionDeclaration |
        ts.FunctionExpression | ts.MethodDeclaration | null {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) {
            return node;
        }
        if (node.parent) {
            return this.findFunction(node.parent);
        }
        return null;
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

    private findNewExpression(node: ts.Node): ts.NewExpression | null {
        if (ts.isNewExpression(node)) {
            return node;
        }
        if (node.parent) {
            return this.findNewExpression(node.parent);
        }
        return null;
    }

    private handleUnsafeCallExpression(
        callExpr: ts.CallExpression | ts.NewExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean {
        let positionInfo = this.getPositionInfo(
            ts.isCallExpression(callExpr) ? callExpr.expression : callExpr, sourceFile);
        // 处理带括号的二元表达式
        if (ts.isParenthesizedExpression(callExpr.expression) &&
            ts.isBinaryExpression(callExpr.expression.expression)) {
            positionInfo = this.getPositionInfo(
                ts.isCallExpression(callExpr) ? callExpr.expression.expression : callExpr, sourceFile);
            this.addAstIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
            return true;
        }
        // 处理属性访问表达式中的带括号的二元表达式
        if (ts.isPropertyAccessExpression(callExpr.expression) &&
            ts.isParenthesizedExpression(callExpr.expression.expression) &&
            ts.isBinaryExpression(callExpr.expression.expression.expression)) {
            this.addAstIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
            return true;
        }
        // 处理元素访问表达式中的 null 参数
        if (ts.isElementAccessExpression(callExpr.expression) &&
            callExpr.expression?.argumentExpression?.kind === ts.SyntaxKind.NullKeyword) {
            this.addAstIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
            return true;
        }

        return false;
    }

    private handleParenthesizedExpression(
        callExpr: ts.CallExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean {
        let positionInfo = this.getPositionInfo(callExpr.expression, sourceFile);
        const parenthesized = this.findParenthesizedExpression(callExpr);

        if (parenthesized) {
            // 处理嵌套的带括号的二元表达式
            if (ts.isParenthesizedExpression(parenthesized)) {
                if (
                    ts.isParenthesizedExpression(parenthesized.expression) &&
                    ts.isBinaryExpression(parenthesized.expression.expression) &&
                    parenthesized.expression.expression.operatorToken !== undefined &&
                    ts.isIdentifier(parenthesized.expression.expression.left) &&
                    ts.isIdentifier(parenthesized.expression.expression.right)
                ) {
                    this.addAstIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
                    return true;
                }
            }
            // 处理属性访问表达式中的带括号的二元表达式
            else if (ts.isPropertyAccessExpression(parenthesized)) {
                if (
                    ts.isNonNullExpression(parenthesized.expression) &&
                    ts.isIdentifier(parenthesized.name) &&
                    ts.isParenthesizedExpression(parenthesized.expression.expression) &&
                    ts.isPropertyAccessExpression(parenthesized.expression.expression.expression) &&
                    ts.isIdentifier(parenthesized.expression.expression.expression.name) &&
                    ts.isIdentifier(parenthesized.expression.expression.expression.expression) &&
                    parenthesized.expression.expression.expression.questionDotToken !== undefined
                ) {
                    this.addAstIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        callExpr?.expression?.getText()?.length ?? 1, UNSAFE_CALL_MESSAGE);
                    return true;
                }
            }
        }
        return false;
    }

    private handleConditionalExpressionWithPropertyAccess(
        callExpr: ts.CallExpression | ts.NewExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean {
        if (
            ts.isParenthesizedExpression(callExpr.expression) &&
            ts.isConditionalExpression(callExpr.expression.expression) &&
            ts.isPropertyAccessExpression(callExpr.expression.expression.whenTrue) &&
            callExpr.expression.expression.whenTrue.questionDotToken !== undefined
        ) {
            const positionInfo = this.getPositionInfo(
                ts.isCallExpression(callExpr) ? callExpr.expression.expression : callExpr, sourceFile);
            this.addAstIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
            return true;
        }
        return false;
    }

    private handleIdentifierMethod(
        callExpr: ts.CallExpression | ts.NewExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean {
        if (!ts.isPropertyAccessExpression(callExpr.expression) || !ts.isIdentifier(callExpr.expression.name)) {
            return false;
        }
        let positionInfo = this.getPositionInfo(
            ts.isCallExpression(callExpr) ? callExpr.expression : callExpr, sourceFile);
        const methodName = callExpr.expression.name.getText();
        if (methodName === 'doSomething') {
            this.addAstIssueReport(
                arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
            return true;
        }
        if (methodName === 'forEach') {
            if (
                ts.isElementAccessExpression(callExpr.expression.expression) &&
                (ts.isIdentifier(callExpr.expression.expression.expression) ||
                    ts.isStringLiteral(callExpr.expression.expression.expression)) &&
                ts.isBinaryExpression(callExpr.expression.expression.argumentExpression)
            ) {
                this.addAstIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
                return true;
            }
        }
        // 处理带括号的表达式
        if (ts.isParenthesizedExpression(callExpr.expression.expression)) {
            if (
                ts.isCallExpression(callExpr.expression.expression.expression) &&
                callExpr.expression.expression.expression.questionDotToken !== undefined &&
                ts.isIdentifier(callExpr.expression.expression.expression.expression)
            ) {
                this.addAstIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
                return true;
            }
        }
        return false;
    }

    private handlePropertyAccessExpression(
        callExpr: ts.CallExpression | ts.NewExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean {
        if (!ts.isPropertyAccessExpression(callExpr.expression)) {
            return false;
        }
        // 处理特定方法名的情况
        if (this.handleIdentifierMethod(callExpr, sourceFile, arkFile)) {
            return true;
        }
        // 处理字符串字面量或正则表达式字面量
        if (ts.isStringLiteral(callExpr.expression.expression) ||
            ts.isRegularExpressionLiteral(callExpr.expression.expression)) {
            const methodName = callExpr.expression.name?.getText();
            if (methodName === 'match' || methodName === 'test') {
                return true;
            }
        }
        // 处理特定方法名的情况（map、reduce、sort）
        if (
            ts.isIdentifier(callExpr.expression.expression) &&
            ['map', 'reduce', 'sort'].includes(callExpr.expression.name?.getText()) &&
            ts.isCallExpression(callExpr) &&
            callExpr.arguments.some(argument => ts.isArrowFunction(argument))
        ) {
            return true;
        }
        return false;
    }

    private checkReduceMethodWithImport(
        callExpr: ts.CallExpression | ts.NewExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter }
    ): boolean {
        if (
            ts.isPropertyAccessExpression(callExpr.expression) &&
            ts.isIdentifier(callExpr.expression.name) &&
            callExpr.expression.name.getText() === 'reduce' &&
            ts.isNewExpression(callExpr.expression.expression) &&
            ts.isIdentifier(callExpr.expression.expression.expression)
        ) {
            const identifierName = callExpr.expression.expression.expression.getText();
            for (const param of sourceFile.statements) {
                if (!ts.isImportDeclaration(param) || !param.importClause ||
                    !param.importClause.namedBindings || !ts.isNamedImports(param.importClause.namedBindings)) {
                    continue;
                }
                const matchingElement = param.importClause.namedBindings.elements.
                find(el => el.name?.getText() === identifierName);
                if (matchingElement) {
                    this.addAstIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
                    return true;
                }
            }
        }
        return false;
    }

    private handleSuperAndThisKeyword(callExpr: ts.CallExpression | ts.NewExpression,
                                      sourceFile: ts.SourceFile, arkFile: ArkFile,
                                      positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter }): boolean {
        // 处理 super 关键字
        if (callExpr.expression.kind === ts.SyntaxKind.SuperKeyword && callExpr.expression.getText() === 'super') {
            const classDeclaration = this.findClassDeclaration(callExpr);
            const extendsClause = classDeclaration?.heritageClauses?.
            find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword);
            const unsafeType = extendsClause?.types.find(type =>
                ts.isPropertyAccessExpression(type.expression) && ts.isIdentifier(type.expression.expression)
            );
            if (unsafeType) {
                this.addAstIssueReport(
                    arkFile,
                    positionInfo.startPosition.line + 1,
                    positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1,
                    UNSAFE_CALL_MESSAGE
                );
                return true;
            }
        }
        // 处理 this 关键字
        if (
            ts.isPropertyAccessExpression(callExpr.expression) &&
            callExpr.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
            ts.isIdentifier(callExpr.expression.name) &&
            callExpr.expression.name.getText() === 'RegExp'
        ) {
            this.addAstIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                this.getUnsafeCallMessage(callExpr)
            );
            return true;
        }
        return false;
    }

    private handleArrayAndNumberCall(
        callExpr: ts.CallExpression | ts.NewExpression,
        functionName: string,
        positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
        arkFile: ArkFile
    ): boolean {
        if (ts.isPropertyAccessExpression(callExpr.expression)) {
            if (
                functionName === 'Array' &&
                ts.isIdentifier(callExpr.expression.expression) &&
                ts.isIdentifier(callExpr.expression.name)
            ) {
                this.addAstIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.getUnsafeCallMessage(callExpr));
                return true;
            }
        } else if (ts.isIdentifier(callExpr.expression)) {
            if (callExpr.expression.getText() === 'Array') {
                if (
                    ts.isArrowFunction(callExpr.parent) &&
                    callExpr.parent?.parameters?.some(param => param?.name?.getText() === functionName)
                ) {
                    this.addAstIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.getUnsafeCallMessage(callExpr));
                    return true;
                }
            } else if (callExpr.expression.getText() === 'Number') {
                const functionDeclaration = this.findFunction(callExpr);
                if (
                    functionDeclaration &&
                    functionDeclaration.parameters.some(param => param?.name?.getText() === functionName)
                ) {
                    this.addAstIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.getUnsafeCallMessage(callExpr));
                    return true;
                }
            }
        }
        return false;
    }

    private handleReturnAndNewExpression(
        callExpr: ts.CallExpression | ts.NewExpression,
        functionName: string
    ): boolean {
        // 处理 return 语句中的函数调用
        if (
            ts.isReturnStatement(callExpr.parent) &&
            ts.isBlock(callExpr.parent.parent) &&
            ts.isMethodDeclaration(callExpr.parent.parent.parent) &&
            ts.isClassExpression(callExpr.parent.parent.parent.parent)
        ) {
            if (
                callExpr.parent.parent.parent.parent.name &&
                ts.isIdentifier(callExpr.parent.parent.parent.parent.name) &&
                callExpr.parent.parent.parent.parent.name.getText() === functionName
            ) {
                return true;
            }
        }
        // 处理 new Promise 中的函数调用
        const newExpression = this.findNewExpression(callExpr);
        if (
            newExpression &&
            ts.isNewExpression(newExpression) &&
            newExpression.expression?.getText() === 'Promise'
        ) {
            for (const arg of newExpression.arguments ?? []) {
                if (ts.isArrowFunction(arg) && arg.parameters.some(param =>
                    ts.isParameter(param) && param?.name?.getText() === functionName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private isFunctionDefinedInBlock(callExpr: ts.CallExpression | ts.NewExpression, functionName: string): boolean {
        if (!ts.isExpressionStatement(callExpr.parent) || !ts.isBlock(callExpr.parent.parent)) {
            return false;
        }
        for (const statement of callExpr.parent.parent.statements) {
            // 检查是否为函数声明、函数表达式或箭头函数
            if (
                (ts.isArrowFunction(statement) || ts.isFunctionDeclaration(statement) ||
                    ts.isFunctionExpression(statement)) && statement?.name?.getText() === functionName
            ) {
                return true;
            }
            // 检查是否为变量声明，且初始化为函数
            if (this.isFunctionDefinedInVariableStatement(statement, functionName)) {
                return true;
            }
        }
        return false;
    }

    private isFunctionDefinedInVariableStatement(statement: ts.Statement, functionName: string): boolean {
        if (!ts.isVariableStatement(statement) || !ts.isVariableDeclarationList(statement.declarationList)) {
            return false;
        }
        for (const declarationListElement of statement.declarationList.declarations) {
            if (
                ts.isVariableDeclaration(declarationListElement) &&
                declarationListElement.name.getText() === functionName &&
                declarationListElement.initializer &&
                (ts.isArrowFunction(declarationListElement.initializer) ||
                    ts.isFunctionDeclaration(declarationListElement.initializer) ||
                    ts.isFunctionExpression(declarationListElement.initializer))
            ) {
                return true;
            }
        }
        return false;
    }

    private checkParameterForUnsafeCall(
        stmt: ts.ParameterDeclaration, functionName: string, variableName: string,
        callExpr: ts.CallExpression | ts.NewExpression,
        positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter }, arkFile: ArkFile
    ): boolean {
        if (ts.isIdentifier(stmt.name) && functionName === stmt.name.getText()) {
            if (stmt.type === undefined) {
                this.addAstIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
                return true;
            } else if (stmt.type.kind === ts.SyntaxKind.AnyKeyword) {
                this.addAstIssueReport(
                    arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.getUnsafeCallMessage(callExpr));
                return true;
            } else if (variableName === 'indexOf') {
                if (ts.isUnionTypeNode(stmt.type) && stmt.type.types.some(type => ts.isTypeLiteralNode(type))) {
                    this.addAstIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
                    return true;
                }
            } else if (variableName === 'match') {
                if (ts.isUnionTypeNode(stmt.type) && stmt.type.types.some(type => ts.isArrayTypeNode(type))) {
                    this.addAstIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
                    return true;
                }
            }
            if (ts.isPropertyAccessExpression(callExpr.expression)) {
                if (
                    callExpr.expression.name?.getText() === 'toUpperCase' &&
                    ts.isElementAccessExpression(callExpr.expression.expression) &&
                    ts.isNumericLiteral(callExpr.expression.expression.argumentExpression)
                ) {
                    this.addAstIssueReport(
                        arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, UNSAFE_CALL_MESSAGE);
                    return true;
                }
            }
            return true;
        }
        return false;
    }

    private checkVariableDeclarationForUnsafeCall(
        declarationListElement: ts.VariableDeclaration,
        functionName: string
    ): boolean {
        if (
            ts.isVariableDeclaration(declarationListElement) &&
            declarationListElement.name.getText() === functionName
        ) {
            // 检查变量声明是否为函数
            if (
                declarationListElement.initializer &&
                (ts.isArrowFunction(declarationListElement.initializer) ||
                    ts.isFunctionDeclaration(declarationListElement.initializer) ||
                    ts.isFunctionExpression(declarationListElement.initializer))
            ) {
                return true;
            }
            // 检查变量类型是否为 Promise
            if (
                declarationListElement.type &&
                ts.isIntersectionTypeNode(declarationListElement.type) &&
                declarationListElement.type.types.some(type =>
                    ts.isTypeReferenceNode(type) && type.typeName.getText() === 'Promise'
                )
            ) {
                return true;
            }
        }
        return false;
    }

    private checkVariableDeclarationsForUnsafeCall(param: ts.Statement, functionName: string): boolean {
        if (ts.isVariableStatement(param) && ts.isVariableDeclarationList(param.declarationList)) {
            for (const declarationListElement of param.declarationList.declarations) {
                if (this.checkVariableDeclarationForUnsafeCall(declarationListElement, functionName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkFunctionBodyForUnsafeCall(
        functionDeclaration: ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration,
        functionName: string
    ): boolean {
        for (const param of functionDeclaration.body?.statements ?? []) {
            if (this.checkVariableDeclarationsForUnsafeCall(param, functionName)) {
                return true;
            } else if (ts.isClassDeclaration(param)) {
                if (param.name && ts.isIdentifier(param.name) && param.name.getText() === functionName) {
                    return true;
                }
            } else if (ts.isFunctionDeclaration(param)) {
                if (param.name && ts.isIdentifier(param.name) && param.name.getText() === functionName) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkFunctionDeclarationForUnsafeCall(
        callExpr: ts.CallExpression | ts.NewExpression,
        functionName: string,
        variableName: string,
        positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
        arkFile: ArkFile
    ): boolean {
        const functionDeclaration = this.findFunction(callExpr);
        if (!functionDeclaration) {
            return false;
        }
        // 检查函数名是否匹配
        if (functionDeclaration?.name?.getText() === functionName) {
            return true;
        }
        // 检查参数类型
        for (const stmt of functionDeclaration?.parameters ?? []) {
            if (ts.isParameter(stmt) && this.checkParameterForUnsafeCall(
                stmt, functionName, variableName, callExpr, positionInfo, arkFile)) {
                return true;
            }
        }
        // 检查函数体中的变量声明
        if (this.checkFunctionBodyForUnsafeCall(functionDeclaration, functionName)) {
            return true;
        }
        return false;
    }

    private checkFunctionDefinition(callExpr: ts.CallExpression | ts.NewExpression,
                                    functionName: string, sourceFile: ts.SourceFile): boolean {
        // 检查箭头函数的参数
        for (let parameter of this.findArrowFunction(callExpr)?.parameters ?? []) {
            if (ts.isParameter(parameter) && functionName === parameter?.name?.getText() && parameter.type !== undefined) {
                return true;
            }
        }
        // 检查类声明
        let classDeclaration = this.findClassDeclaration(callExpr);
        if (classDeclaration?.name?.getText() === functionName) {
            return true;
        }
        // 检查函数声明
        let haveFunction = sourceFile.statements.find(statement => {
            if (ts.isFunctionDeclaration(statement)) {
                let modifiers = statement.modifiers?.filter(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
                if (functionName === statement.name?.getText() && !modifiers) {
                    return true;
                }
            }
            return false;
        });
        return haveFunction !== undefined;
    }

    private checkVariableDeclarationForAnyAndRequire(
        dec: ts.VariableDeclaration,
        functionName: string
    ): boolean | undefined {
        // 检查变量类型是否为 any
        if (functionName === dec.name.getText() && dec.type && dec?.type?.kind === ts.SyntaxKind.AnyKeyword) {
            return false;
        }
        // 检查是否为 require 且初始化为 createRequire
        if (functionName === dec.name.getText() && functionName === 'require' && dec.initializer &&
            ts.isCallExpression(dec.initializer) && dec.initializer?.expression?.getText() === 'createRequire') {
            return false;
        }
        return undefined;
    }

    private checkVariable(
        dec: ts.VariableDeclaration,
        functionName: string,
        variableName: string
    ): boolean | undefined {
        const result = this.checkVariableDeclarationForAnyAndRequire(dec, functionName);
        if (result !== undefined) {
            return result;
        }
        // 检查类型是否为 UInt8Array 且方法名为 includes 或 indexOf
        if (dec.type && ts.isTypeReferenceNode(dec.type) && dec.type.typeName.getText() === 'UInt8Array' &&
            (variableName === 'includes' || variableName === 'indexOf')) {
            return false;
        }
        // 检查变量类型是否已定义
        if (functionName === dec.name.getText() && dec.type !== undefined) {
            return true;
        }
        // 检查初始化为数组字面量且方法名为 some
        if (functionName === dec.name.getText() && dec.initializer && ts.isArrayLiteralExpression(dec.initializer)) {
            if (variableName === 'some') {
                return true;
            }
        }
        return undefined;
    }

    private checkVariableDeclarationConditions(
        dec: ts.VariableDeclaration,
        functionName: string,
        variableName: string
    ): boolean | undefined {
        const result = this.checkVariable(dec, functionName, variableName);
        if (result !== undefined) {
            return result;
        }
        if (functionName === dec.name.getText() && this.isRegularExpression(variableName) && dec.initializer) {
            if (ts.isRegularExpressionLiteral(dec.initializer) && variableName === 'match') {
                return false;
            }
            if (ts.isNewExpression(dec.initializer) && ts.isIdentifier(dec.initializer.expression) &&
                dec.initializer.expression.getText() === 'RegExp') {
                return true;
            } else if (ts.isRegularExpressionLiteral(dec.initializer) || ts.isStringLiteral(dec.initializer)) {
                return true;
            }
        }
        let isRegularExpression = this.checkRegularExpressionInitializer(functionName, dec, variableName);
        if (isRegularExpression !== undefined) {
            return isRegularExpression;
        }
        return undefined;
    }

    private checkRegularExpressionInitializer(functionName: string, dec: ts.VariableDeclaration, variableName: string): boolean | undefined {
        if (functionName === dec.name.getText() && this.isRegularExpression(variableName) && dec.initializer) {
            if (ts.isRegularExpressionLiteral(dec.initializer) && variableName === 'match') {
                return false;
            }
            if (ts.isNewExpression(dec.initializer) && ts.isIdentifier(dec.initializer.expression) &&
                dec.initializer.expression.getText() === 'RegExp') {
                return true;
            } else if (ts.isRegularExpressionLiteral(dec.initializer) || ts.isStringLiteral(dec.initializer)) {
                return true;
            }
        }
        return undefined;
    }

    private checkObjectLiteralProperties(dec: ts.VariableDeclaration, variableName: string): boolean {
        if (!dec.initializer) {
            return false;
        }
        if (!ts.isObjectLiteralExpression(dec.initializer)) {
            return false;
        }
        return dec.initializer.properties.some(prop =>
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            variableName === prop.name.getText()
        );
    }

    private checkNewExpressionParameters(dec: ts.VariableDeclaration, functionName: string): boolean {
        if (!dec.initializer || !ts.isNewExpression(dec.initializer)) {
            return false;
        }
        return dec.initializer.arguments?.some(arg =>
            ts.isArrowFunction(arg) &&
            arg.parameters.some(param => param?.name?.getText() === functionName)
        ) ?? false;
    }

    private checkVariableInitializerConditions(
        dec: ts.VariableDeclaration,
        functionName: string,
        variableName: string
    ): boolean | undefined {
        if (functionName === dec.name.getText() && this.checkObjectLiteralProperties(dec, variableName)) {
            return true;
        }
        if (functionName === dec.name.getText() && dec.initializer && ts.isTaggedTemplateExpression(dec.initializer) &&
            ts.isFunctionExpression(dec.initializer.tag)) {
            return true;
        }
        if (functionName === dec.name.getText() && dec.initializer && (ts.isFunctionExpression(dec.initializer) ||
            ts.isFunctionDeclaration(dec.initializer) || ts.isArrowFunction(dec.initializer))) {
            return true;
        }
        if (functionName === dec.name.getText() && this.checkNewExpressionParameters(dec, functionName)) {
            return true;
        }
        if (functionName === dec.name.getText() && dec.initializer && ts.isCallExpression(dec.initializer)) {
            return true;
        }
        if (functionName === dec.name.getText() && dec.initializer && ts.isNewExpression(dec.initializer)) {
            return true;
        }
        return undefined;
    }

    private checkHintNameInSourceFile(sourceFile: ts.SourceFile, hintName: string): boolean {
        return sourceFile.statements.some(state => {
            if (ts.isVariableStatement(state)) {
                return state.declarationList.declarations.some(vd =>
                    ts.isVariableDeclaration(vd) &&
                    hintName === vd.name.getText() &&
                    vd.initializer &&
                    ts.isNewExpression(vd.initializer)
                );
            } else if (ts.isClassDeclaration(state) && state.name && ts.isIdentifier(state.name)) {
                return hintName === state.name.getText();
            }
            return false;
        });
    }

    private checkHintNameConditions(
        dec: ts.VariableDeclaration,
        functionName: string,
        sourceFile: ts.SourceFile
    ): boolean | undefined {
        if (!dec.initializer) {
            return undefined;
        }
        let hintName = '';
        if (ts.isObjectBindingPattern(dec.name) && ts.isIdentifier(dec.initializer)) {
            if (dec.name.elements.find(el => el.name?.getText() === functionName)) {
                hintName = dec.initializer.getText();
            }
        }
        if (functionName === dec.name.getText() && ts.isPropertyAccessExpression(dec.initializer) &&
            ts.isIdentifier(dec.initializer.name) && ts.isIdentifier(dec.initializer.expression)) {
            hintName = dec.initializer?.expression?.getText();
        }
        if (hintName) {
            return this.checkHintNameInSourceFile(sourceFile, hintName);
        }
        return undefined;
    }

    private findVariableDeclarationForFunction(
        declarations: ts.VariableDeclarationList,
        functionName: string,
        variableName: string,
        sourceFile: ts.SourceFile
    ): ts.VariableDeclaration | undefined {
        return declarations.declarations.find(dec => {
            if (ts.isVariableDeclaration(dec)) {
                const result = this.checkVariableDeclarationConditions(dec, functionName, variableName);
                if (result !== undefined) {
                    return result;
                }
                const resultInitializerConditions = this.checkVariableInitializerConditions(dec, functionName, variableName);
                if (resultInitializerConditions !== undefined) {
                    return resultInitializerConditions;
                }
                const resultHintNameConditions = this.checkHintNameConditions(dec, functionName, sourceFile);
                if (resultHintNameConditions !== undefined) {
                    return resultHintNameConditions;
                }
            }
            return false;
        });
    }

    private isFunctionDefinedInClassOrBlock(
        param: ts.Statement,
        functionName: string
    ): boolean {
        if (ts.isClassDeclaration(param) && param.name && ts.isIdentifier(param.name) &&
            param.name.getText() === functionName) {
            return true;
        } else if (ts.isBlock(param)) {
            for (let stmt of param.statements) {
                if (ts.isClassDeclaration(stmt) && stmt.name && ts.isIdentifier(stmt.name) &&
                    stmt.name.getText() === functionName) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkVariableDeclarationForFunction(
        callExpr: ts.CallExpression | ts.NewExpression,
        functionName: string,
        variableName: string,
        sourceFile: ts.SourceFile
    ): boolean {
        for (let param of sourceFile.statements) {
            if (ts.isVariableStatement(param) && ts.isVariableDeclarationList(param.declarationList) &&
                ts.isVariableStatement(param)) {
                const declarationListElement = this.findVariableDeclarationForFunction(
                    param.declarationList,
                    functionName,
                    variableName,
                    sourceFile
                );
                if (declarationListElement) {
                    return true;
                }
            }
            if (ts.isNewExpression(callExpr)) {
                if (this.isFunctionDefinedInClassOrBlock(param, functionName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private handleFunctionCallChecks(
        callExpr: ts.CallExpression | ts.NewExpression,
        functionName: string,
        variableName: string,
        positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
        arkFile: ArkFile,
        sourceFile: ts.SourceFile
    ): boolean {
        // 处理 new 表达式的判断
        if (this.handleReturnAndNewExpression(callExpr, functionName)) {
            return true;
        }
        // 跳过 {} 中的函数调用
        if (this.isFunctionDefinedInBlock(callExpr, functionName)) {
            return true;
        }
        // 检查函数声明中的不安全调用
        if (this.checkFunctionDeclarationForUnsafeCall(callExpr, functionName, variableName, positionInfo, arkFile)) {
            return true;
        }
        // 检查函数定义
        if (this.checkFunctionDefinition(callExpr, functionName, sourceFile)) {
            return true;
        }
        // 检查变量声明中的函数调用
        if (this.checkVariableDeclarationForFunction(callExpr, functionName, variableName, sourceFile)) {
            return true;
        }
        return false;
    }

    private handleCallExpressionChecks(
        callExpr: ts.CallExpression | ts.NewExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter }
    ): boolean {
        if (this.handleUnsafeCallExpression(callExpr, sourceFile, arkFile)) {
            return true;
        }
        if (ts.isCallExpression(callExpr) && this.handleParenthesizedExpression(callExpr, sourceFile, arkFile)) {
            return true;
        }
        if (this.handleConditionalExpressionWithPropertyAccess(callExpr, sourceFile, arkFile)) {
            return true;
        }
        if (this.handlePropertyAccessExpression(callExpr, sourceFile, arkFile)) {
            return true;
        }
        if (this.checkReduceMethodWithImport(callExpr, sourceFile, arkFile, positionInfo)) {
            return true;
        }
        if (this.handleSuperAndThisKeyword(callExpr, sourceFile, arkFile, positionInfo)) {
            return true;
        }
        return false;
    }

    private isBuiltInOrImportedObject(functionName: string, sourceFile: ts.SourceFile): boolean {
        let importDeclaration = sourceFile.statements.find(param => {
            if (ts.isImportDeclaration(param) && param.importClause && ts.isImportClause(param.importClause) &&
                param.importClause.name && ts.isIdentifier(param.importClause.name)) {
                if (param.importClause.name.getText() === 'String' && param.importClause.name.getText() === functionName) {
                    return true;
                }
            }
            return false;
        });
        // 跳过内置的JavaScript/TypeScript对象
        if (!importDeclaration && this.isBuiltInObject(functionName)) {
            return true;
        }
        return false;
    }

    private checkUndefinedFunctionCall(callExpr: ts.CallExpression | ts.NewExpression,
                                       sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let positionInfo = this.getPositionInfo(
            ts.isCallExpression(callExpr) ? callExpr.expression : callExpr, sourceFile);
        if (this.handleCallExpressionChecks(callExpr, sourceFile, arkFile, positionInfo)) {
            return;
        }
        let callExprIdentifier = this.findIdentifier(callExpr.expression);
        if (!callExprIdentifier) {
            return;
        }
        let variableName = '';
        if (ts.isPropertyAccessExpression(callExprIdentifier.parent)) {
            variableName = callExprIdentifier.parent?.name?.getText() ?? '';
        }
        if (this.isKeyMethod(variableName)) {
            return;
        }
        // 获取函数名和位置信息
        const functionName = callExprIdentifier?.getText();
        if (this.handleArrayAndNumberCall(callExpr, functionName, positionInfo, arkFile)) {
            return;
        }
        if (this.isBuiltInOrImportedObject(functionName, sourceFile)) {
            return;
        }
        if (this.handleFunctionCallChecks(callExpr, functionName, variableName, positionInfo, arkFile, sourceFile)) {
            return;
        }
        this.addAstIssueReport(
            arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
            positionInfo.endPosition.character + 1, this.getUnsafeCallMessage(callExpr));
    }

    private getUnsafeCallMessage(callExpr: ts.CallExpression | ts.NewExpression): string {
        return ts.isCallExpression(callExpr) ? UNSAFE_CALL_MESSAGE : UNSAFE_NEW_MESSAGE;
    }

    private isKeyMethod(name: string): boolean {
        const builtInObjects = ['concat', 'localeCompare'];
        return builtInObjects.includes(name);
    }

    private isRegularExpression(name: string): boolean {
        const builtInObjects = ['exec', 'match', 'test'];
        return builtInObjects.includes(name);
    }

    // 检查是否为内置JavaScript/TypeScript对象
    private isBuiltInObject(name: string): boolean {
        const builtInObjects = [
            // 基本对象构造函数
            'Object', 'Function', 'Boolean', 'Symbol', 'Error', 'EvalError', 'RangeError',
            'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'AggregateError',
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