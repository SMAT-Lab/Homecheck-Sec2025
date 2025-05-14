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
    Local, FunctionType, ArkFile, AstTreeUtils, ts,
} from "arkanalyzer";
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from "../BaseChecker";
import {ClassMatcher, FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher} from "../../matcher/Matchers";
import {Defects, IssueReport} from "../../model/Defects";
import {CheckerUtils} from "../../utils/checker/CheckerUtils";
import {Rule} from "../../model/Rule";
import {RuleListUtil} from "../../utils/common/DefectsList";
import {RuleFix} from "../../model/Fix";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnsafeArgumentCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/no-unsafe-argument.md",
    description: "Unsafe argument of type `any` assigned to a parameter of type `string`."
};

export class NoUnsafeArgumentCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

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
            if (ts.isCallExpression(child)) {
                this.checkArkCallExpression(child, sourceFile, targetFile);
            } else if (ts.isNewExpression(child)) {
                this.checkNewExpression(child, sourceFile, targetFile);
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

    private findFunctionDeclaration(node: ts.Node): ts.FunctionDeclaration | null {
        if (ts.isFunctionDeclaration(node)) {
            return node;
        }
        if (node.parent) {
            return this.findFunctionDeclaration(node.parent);
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

    private checkArgumentType(arg: ts.Node, child: ts.NewExpression, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (!ts.isIdentifier(arg)) {
            return;
        }
        let functionDeclaration = this.findFunctionDeclaration(child);
        if (functionDeclaration) {
            for (let param of functionDeclaration.parameters) {
                if (param.type?.kind === ts.SyntaxKind.StringKeyword && arg.getText() === param.name.getText()) {
                    return;
                } else if (arg.getText() === 'undefined') {
                    return;
                }
            }
        }
        let positionInfo = this.getPositionInfo(arg, sourceFile);
        this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
            positionInfo.endPosition.character + 1, 'Unsafe argument of type `any` assigned to a parameter of type `string | undefined`.');
    }

    private checkNewExpression(child: ts.NewExpression, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (ts.isIdentifier(child.expression)) {
            let name = child.expression.getText();
            if (name === 'RegExp') {
                child.arguments?.forEach((arg) => {
                    this.checkArgumentType(arg, child, sourceFile, arkFile);
                });
            }
        }
    }

    private checkArrowFunctionParameters(arg: ts.Node, positionInfo: {
        startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter
    }, arkFile: ArkFile): boolean {
        let arrowFunction = this.findArrowFunction(arg);
        if (!arrowFunction) {
            return false;
        }
        for (const param of arrowFunction.parameters) {
            if (ts.isIdentifier(param.name)) {
                if (param?.type?.kind === ts.SyntaxKind.NumberKeyword) {
                    return true;
                }
                let paramName = param.name.getText();
                if (paramName === arg.getText()) {
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                        positionInfo.endPosition.character + 1, this.metaData.description);
                    return true;
                }
            }
        }
        return false;
    }

    private checkThisKeywordPropertyAccess(
        arg: ts.PropertyAccessExpression,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): boolean {
        if (!ts.isIdentifier(arg.name) || arg.expression.kind !== ts.SyntaxKind.ThisKeyword) {
            return false;
        }
        const classDeclaration = this.findClassDeclaration(arg);
        if (classDeclaration) {
            const member = classDeclaration.members.find(member =>
                ts.isPropertyDeclaration(member) && member?.name?.getText() === arg?.name?.getText()
            );
            if (member) {
                return true;
            }
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

    private checkCallExpressionArguments(
        child: ts.CallExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean {
        for (const arg of child.arguments) {
            let positionInfo = this.getPositionInfo(arg, sourceFile);
            if (ts.isIdentifier(arg)) {
                if (this.checkArrowFunctionParameters(arg, positionInfo, arkFile)) {
                    return true;
                }
            } else if (ts.isPropertyAccessExpression(arg)) {
                if (this.checkThisKeywordPropertyAccess(arg, arkFile, positionInfo)) {
                    return true;
                }
            } else if (arg.kind === ts.SyntaxKind.ThisKeyword) {
                let classDeclaration = this.findClassDeclaration(arg);
                if (classDeclaration) {
                    return true;
                }
                this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.metaData.description);
                return true;
            } else if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
                this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1, positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1, this.metaData.description);
                return true;
            }
        }
        return false;
    }

    private checkVariableStatementsForArguments(
        sourceFile: ts.SourceFile,
        child: ts.CallExpression,
        arkFile: ArkFile,
        name: string
    ): void {
        if (!sourceFile) {
            return;
        }
        for (const param of sourceFile.statements) {
            if (!ts.isVariableStatement(param) || !ts.isVariableDeclarationList(param.declarationList)) {
                continue;
            }
            if (this.checkVariableDeclarationsForArguments(param.declarationList.declarations, name, child, sourceFile, arkFile)) {
                return;
            }
        }
    }

    private checkVariableDeclarationsForArguments(
        declarations: ts.NodeArray<ts.VariableDeclaration>,
        name: string,
        child: ts.CallExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): boolean {
        for (const dec of declarations) {
            if (!ts.isVariableDeclaration(dec) || dec.name.getText() !== name) {
                continue;
            }
            for (const arg of child.arguments) {
                if (this.checkFunctionDeclarationParameters(arg, sourceFile, child, arkFile)) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkFunctionDeclarationParameters(
        arg: ts.Node,
        sourceFile: ts.SourceFile,
        child: ts.CallExpression,
        arkFile: ArkFile
    ): boolean {
        if (!ts.isIdentifier(arg)) {
            return false;
        }
        const positionInfo = this.getPositionInfo(arg, sourceFile);
        const functionDeclaration = this.findFunctionDeclaration(child);
        if (functionDeclaration) {
            for (const param of functionDeclaration.parameters) {
                if (param.type === undefined) {
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

    private checkFunctionDeclarationParametersForArrayTypes(
        functionDeclaration: ts.FunctionDeclaration, child: ts.CallExpression,
        sourceFile: ts.SourceFile, arkFile: ArkFile, name: string
    ): void {
        const arrayTypes = ['Uint8Array', 'Uint16Array', 'Uint32Array',
            'Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array', 'U'];
        functionDeclaration.parameters.forEach(param => {
            if (!ts.isParameter(param) || !ts.isIdentifier(param.name) || !param.type || param.name.getText() !== name) {
                return;
            }
            const foundArg = child.arguments.find(arg => ts.isIdentifier(arg));
            if (!foundArg) {
                return;
            }
            const positionInfo = this.getPositionInfo(foundArg, sourceFile);
            if (param.type?.kind === ts.SyntaxKind.StringKeyword) {
                this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1,
                    positionInfo.startPosition.character + 1, positionInfo.endPosition.character + 1, this.metaData.description
                );
            }
            if (ts.isTypeReferenceNode(param.type) && ts.isIdentifier(param.type.typeName)) {
                const typeName = param.type.typeName.getText();
                const type = arrayTypes.find(type => type === typeName);
                if (typeName === 'U') {
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1,
                        positionInfo.startPosition.character + 1, positionInfo.endPosition.character + 1,
                        'Unsafe argument of type `any` assigned to a parameter of type `number & T`.'
                    );
                }
                if (type) {
                    this.addArkIssueReport(arkFile, positionInfo.startPosition.line + 1,
                        positionInfo.startPosition.character + 1, positionInfo.endPosition.character + 1,
                        'Unsafe argument of type `any` assigned to a parameter of type `number`.'
                    );
                }
            } else if (ts.isUnionTypeNode(param.type)) {
                param.type.types.forEach(type => {
                    this.checkUnionTypeNodeForArrayType(type, arkFile, positionInfo);
                });
            }
        });
    }

    private checkUnionTypeNodeForArrayType(
        type: ts.TypeNode,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): void {
        if (ts.isArrayTypeNode(type) && ts.isTypeReferenceNode(type.elementType) && ts.isIdentifier(type.elementType.typeName)) {
            if (type.elementType.typeName.getText() === 'T') {
                this.addArkIssueReport(
                    arkFile,
                    positionInfo.startPosition.line + 1,
                    positionInfo.startPosition.character + 1,
                    positionInfo.endPosition.character + 1,
                    'Unsafe argument of type `any` assigned to a parameter of type `T`.'
                );
            }
        }
    }

    private checkVariableStatementsForIncludesOrIndexOf(
        sourceFile: ts.SourceFile,
        child: ts.CallExpression,
        arkFile: ArkFile,
        name: string
    ): void {
        if (!sourceFile) {
            return;
        }
        sourceFile.statements.forEach(param => {
            if (!ts.isVariableStatement(param) || !ts.isVariableDeclarationList(param.declarationList)) {
                return;
            }
            param.declarationList.declarations.forEach(dec => {
                if (!ts.isVariableDeclaration(dec) || dec.name.getText() !== name) {
                    return;
                }
                if (!this.isValidVariableDeclarationType(dec)) {
                    return;
                }
                if (dec.type && ts.isArrayTypeNode(dec.type) && dec.type.elementType?.getText() !== 'string') {
                    return;
                }
                this.checkArgumentsForIssueReport(child, sourceFile, arkFile);
            });
        });
    }

    private isValidVariableDeclarationType(dec: ts.VariableDeclaration): boolean {
        return dec.type?.kind === ts.SyntaxKind.StringKeyword ||
            dec.type?.kind === ts.SyntaxKind.ArrayType ||
            dec.type?.kind === ts.SyntaxKind.TypeOperator;
    }

    private checkArgumentsForIssueReport(
        child: ts.CallExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        child.arguments.forEach(arg => {
            if (!ts.isIdentifier(arg)) {
                return;
            }
            const positionInfo = this.getPositionInfo(arg, sourceFile);
            this.addArkIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                this.metaData.description
            );
        });
    }

    private checkTestMethodArguments(
        child: ts.CallExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        child.arguments.forEach(arg => {
            if (!ts.isIdentifier(arg)) {
                return;
            }
            const positionInfo = this.getPositionInfo(arg, sourceFile);
            if (this.isArgumentDefinedInVariableStatements(arg, sourceFile)) {
                return;
            }
            this.addArkIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                this.metaData.description
            );
        });
    }

    private isArgumentDefinedInVariableStatements(
        arg: ts.Identifier,
        sourceFile: ts.SourceFile
    ): boolean {
        for (const param of sourceFile.statements) {
            if (!ts.isVariableStatement(param) || !ts.isVariableDeclarationList(param.declarationList)) {
                continue;
            }
            for (const declarationListElement of param.declarationList.declarations) {
                if (ts.isVariableDeclaration(declarationListElement) &&
                    declarationListElement.name.getText() === arg.getText()) {
                    return true;
                }
            }
        }
        return false;
    }

    private handlePropertyAccessExpression(
        child: ts.CallExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile,
        name: string
    ): void {
        if (!ts.isPropertyAccessExpression(child.expression)) {
            return;
        }
        if (!ts.isIdentifier(child.expression.name)) {
            return;
        }
        if (ts.isIdentifier(child.expression.name)) {
            let methodName = child.expression.name.getText();
            if (methodName === 'log' && name === 'console') {
                if (this.checkCallExpressionArguments(child, sourceFile, arkFile)) {
                    return;
                }
            }
            if (methodName === 'test') {
                this.checkVariableStatementsForArguments(sourceFile, child, arkFile, name);
            }
            if (methodName === 'indexOf') {
                let functionDeclaration = this.findFunctionDeclaration(child);
                if (functionDeclaration) {
                    this.checkFunctionDeclarationParametersForArrayTypes(functionDeclaration, child, sourceFile, arkFile, name);
                }
            }
            if (methodName === 'includes' || methodName === 'indexOf') {
                if (sourceFile) {
                    this.checkVariableStatementsForIncludesOrIndexOf(sourceFile, child, arkFile, name);
                }
            }
        }
    }

    private checkArkCallExpression(child: ts.CallExpression, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (ts.isPropertyAccessExpression(child.expression)) {
            if (ts.isIdentifier(child.expression.expression)) {
                let name = child.expression.expression.getText();
                this.handlePropertyAccessExpression(child, sourceFile, arkFile, name);
            } else if (ts.isParenthesizedExpression(child.expression.expression)) {
                let methodName = child.expression.name.getText();
                if (methodName === 'test') {
                    this.checkTestMethodArguments(child, sourceFile, arkFile);
                }
            }
        } else if (ts.isIdentifier(child.expression)) {
            let name = child.expression.getText();
            if (name === 'RegExp') {
                this.checkRegExpArguments(child, sourceFile, arkFile);
            }
        }
    }

    private checkRegExpArguments(
        child: ts.CallExpression,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        child.arguments.forEach(arg => {
            if (!ts.isIdentifier(arg)) {
                return;
            }
            const positionInfo = this.getPositionInfo(arg, sourceFile);
            this.addArkIssueReport(
                arkFile,
                positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1,
                positionInfo.endPosition.character + 1,
                'Unsafe argument of type `any` assigned to a parameter of type `string | undefined`.'
            );
        });
    }

    public check = (targetMethod: ArkMethod): void => {
        const severity = this.rule.alert ?? this.metaData.severity;
        const stmts = targetMethod.getBody()?.getCfg().getStmts() ?? [];
        if (!this.getFileExtension(targetMethod.getDeclaringArkClass().getDeclaringArkFile().getName(), 'ts')) {
            return;
        }
        for (const stmt of stmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            this.checkInvokeArguments(stmt, invokeExpr, severity, targetMethod);
        }
    }

    private checkInvokeArguments(stmt: Stmt, invokeExpr: any, severity: number, targetMethod: ArkMethod): void {
        for (let idx in invokeExpr.getArgs()) {
            let local = invokeExpr.getArgs()[idx];
            if (local.getType() instanceof FunctionType) {
                break;
            }
            let localType = local.getType().getTypeString();
            if ((local as Local).getName) {
                localType = this.handleExtendedParameter(local as Local, targetMethod);
            }
            this.checkLocalTypeForAny(stmt, invokeExpr, idx, localType, severity);
        }
    }

    private checkLocalTypeForAny(stmt: Stmt, invokeExpr: any, idx: string, localType: string, severity: number): void {
        if (localType.includes('any')) {
            const parameterType = invokeExpr.getMethodSignature().getMethodSubSignature().getParameterTypes()[idx];
            if (parameterType && parameterType.getTypeString() !== localType) {
                let message = 'Unsafe spread of an `any` type.';
                if (localType === 'any[]') {
                    message = 'Unsafe spread of an `any` array type.';
                } else if (localType.includes('Set<any>')) {
                    message = 'Unsafe argument of type `Set<any>` assigned to a parameter of type `Set<string>`.';
                } else if (localType.includes('Map<any,string>')) {
                    message = 'Unsafe argument of type `Map<any, string>` assigned to a parameter of type `Map<string, string>`.';
                }
                this.addIssueReport(stmt, message, Number(idx) + 1, severity);
            }
        }
    }

    private handleExtendedParameter(local: Local, targetMethod: ArkMethod): string {
        let name = local.getName() || '';
        let isExtend: boolean = name.startsWith('...');
        if (isExtend) {
            name = name.slice(3);
            let method: ArkMethod = targetMethod.getDeclaringArkClass().getDeclaringArkFile().getClasses()[0].getMethods()[0];
            let bodyLocal = method.getBody()?.getLocals().get(name);
            if (bodyLocal?.getType().getTypeString().includes('any')) {
                return bodyLocal.getType().getTypeString();
            }
        }
        return local.getType().getTypeString();
    }

    private getFileExtension(filePath: string, filetype: string): boolean {
        const match = filePath.match(/\.([0-9a-zA-Z]+)$/);
        if (match) {
            const extension = match[1];
            return extension === filetype;
        }
        return false;
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

    private addArkIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string, fix?: RuleFix): Defects {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
        return defect;
    }

    private addIssueReport(stmt: Stmt, message: string, index: number, severity: number): void {
        const warnInfo = this.getLineAndColumn(stmt, index);
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, message, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private getLineAndColumn(stmt: Stmt, index: number): {
        line: number,
        startCol: number,
        endCol: number,
        filePath: string
    } {
        const originalPositions = stmt.getOperandOriginalPositions();
        if (originalPositions![index]) {
            const line = originalPositions![index].getFirstLine();
            const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
            if (arkFile) {
                let startCol = originalPositions![index].getFirstCol();
                const endCol = originalPositions![index].getLastCol();
                const filePath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
                return {line, startCol, endCol, filePath: filePath}
            } else {
                logger.debug('originStmt or arkFile is null');
            }
        }
        return {line: -1, startCol: -1, endCol: -1, filePath: ''};
    }
}