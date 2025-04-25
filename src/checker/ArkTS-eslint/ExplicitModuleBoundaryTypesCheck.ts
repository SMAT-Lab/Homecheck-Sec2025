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

import { ArkFile, ts, AstTreeUtils } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ExplicitModuleBoundaryTypesCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/explicit-module-boundary-types-check.md",
    description: "Require explicit return and argument types on exported functions' and classes' public class methods",
};
const defaultOptions: Options = {
    allowArgumentsExplicitlyTypedAsAny: false,
    allowDirectConstAssertionInArrowFunctions: true,
    allowedNames: [],
    allowHigherOrderFunctions: true,
    allowTypedFunctionExpressions: true,
}
interface Options {
    allowArgumentsExplicitlyTypedAsAny?: boolean;
    allowDirectConstAssertionInArrowFunctions?: boolean;
    allowHigherOrderFunctions?: boolean;
    allowTypedFunctionExpressions?: boolean;
    allowedNames?: string[];
}

// 定义一个接口，用于存储函数或方法的行列信息
interface LocationInfo {
    fileName: string;
    line: number;
    character: number;
    description: string;
}

export class ExplicitModuleBoundaryTypesCheck implements BaseChecker {

    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private symbolTable: Map<string, ts.Node> = new Map();
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatcherCb];
    }

    public check = (target: ArkFile) => {
        const targetName = target.getName();
        if (targetName && this.getFileExtension(targetName) === '.ets') {
            return;
        }
        if (target instanceof ArkFile) {
            const code = target.getCode();
            if (!code) {
                return;
            }
            const filePath = target.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
            // 构建符号表
            this.buildSymbolTable(sourceFile);
            const missingReturnTypes = this.checkExplicitBoundaryType(sourceFile);
            missingReturnTypes.forEach(info => {
                this.addIssueReportNode(info, filePath);
            });
        }
    }
    private getFileExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }
        return filePath.substring(lastDotIndex);
    }

    public checkExplicitBoundaryType(sourceFile: ts.SourceFile): LocationInfo[] {
        const result: LocationInfo[] = [];
        const Options: Options = this.rule && this.rule.option[0] ? this.rule.option[0] as Options : defaultOptions;

        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            // 特殊情况处理
            if (Options.allowDirectConstAssertionInArrowFunctions && ts.isArrowFunction(node) && ts.isDeleteExpression(node)) {
                return;
            }
            if (Options.allowTypedFunctionExpressions && ts.isTypeOfExpression(node)) {
                return;
            }
            if (Options.allowedNames && Options.allowedNames.length !== 0 && this.checkMethodNameNode(node, Options.allowedNames)) {
                return;
            }
            // 检查类声明
            if (ts.isClassDeclaration(node)) {
                this.checkClassDeclaration(node, sourceFile, Options, result);
            }
            // 检查函数声明
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                this.checkFunctionDeclaration(node, sourceFile, Options, result);
            }
            if (ts.isVariableDeclaration(node)) {
                this.checkVariableDeclaration(node, sourceFile, Options, result);
            }
            if (ts.isConstructorDeclaration(node)) {
                this.checkConstructorDeclaration(node, sourceFile, Options, result);
            }
            if (ts.isExportAssignment(node) && node.expression) {
                this.checkExportAssignment(node.expression, sourceFile, Options, result);
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return result;
    }

    private checkExportAssignment(
        expression: ts.Expression,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        if ((ts.isArrowFunction(expression) || ts.isFunctionExpression(expression))) {
            // 检查是否是高阶函数（返回另一个函数）
            if (this.isHigherOrderFunction(expression) && Options.allowHigherOrderFunctions) {
                return; // 如果是高阶函数且配置允许，则跳过检查
            }

            // 检查返回类型
            if (!expression.type) {
                // 获取开始位置，对于箭头函数使用箭头符号位置
                let startPos = expression.getStart();
                if (ts.isArrowFunction(expression) && expression.equalsGreaterThanToken) {
                    startPos = expression.equalsGreaterThanToken.getStart();
                }
                this.addIssue(result, sourceFile, startPos, 'Missing return type on function.');
            }

            // 检查参数类型
            for (const param of expression.parameters) {
                if (!param.type) {
                    this.addIssue(result, sourceFile, param.getStart(),
                        this.checkArgument(param.name.getText()));
                }
            }
        }
    }

    // 检查函数是否是高阶函数（返回另一个函数）
    private isHigherOrderFunction(node: ts.FunctionExpression | ts.ArrowFunction): boolean {
        // 检查函数体是否是块
        if (ts.isBlock(node.body)) {
            // 查找 return 语句
            return this.isHigherOrderFunctionStatement(node.body);
        } else {
            // 如果函数体是表达式（箭头函数的简写形式）
            const bodyExpr = node.body;
            // 检查表达式是否是函数
            if ((ts.isFunctionExpression(bodyExpr) || ts.isArrowFunction(bodyExpr))) {
                // 检查函数是否有明确的返回类型
                return bodyExpr.type !== undefined;
            }
        }
        return false;
    }

    private isHigherOrderFunctionStatement(node: ts.Block): boolean {
        for (const statement of node.statements) {
            if (ts.isReturnStatement(statement) && statement.expression) {
                const returnExpr = statement.expression;
                // 检查返回值是否是函数
                if ((ts.isFunctionExpression(returnExpr) || ts.isArrowFunction(returnExpr))) {
                    // 检查返回的函数是否有明确的返回类型
                    return returnExpr.type !== undefined;
                }
            }
        }
        return false;
    }

    private checkMethodNameNode(
        node: ts.Node,
        allowedNames: string[],
    ): boolean {
        // 检查 node 是否是 MethodDeclaration 或 PropertyDeclaration 类型
        if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) ||
            ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) {
            const methodName = node.name?.getText(); // 安全访问 name 属性
            if (methodName && allowedNames.includes(methodName)) {
                return true; // 如果方法名在允许列表中，则跳过检查
            }
        }
        return false;
    }


    private hasModifiers(node: ts.Node): node is ts.HasModifiers {
        return 'modifiers' in node;
    }

    private isExported(node: ts.Node): boolean {
        if (this.hasModifiers(node)) {
            if (ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
                return true;
            }
        }
        if (ts.isClassDeclaration(node)) {
            const className = node.name?.getText();
            if (className && this.symbolTable.has(className)) {
                return true;
            }
        }
        // 检查是否是函数声明
        if (ts.isFunctionDeclaration(node)) {
            const functionName = node.name?.getText();
            if (functionName && this.symbolTable.has(functionName)) {
                return true;
            }
        }
        return this.isExportedOther(node);
    }

    private isExportedOther(node: ts.Node): boolean {
        // 检查是否是变量声明（包括箭头函数和函数表达式）
        if (ts.isVariableDeclaration(node)) {
            const initializer = node.initializer;
            if (!initializer) {
                return false;
            }
            if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
                const functionName = node.name.getText();
                if (functionName && this.symbolTable.has(functionName)) {
                    return true;
                }
            }
        }
        if (ts.isCallExpression(node)) {
            const expression = node.expression;
            // 检查是否是箭头函数或函数表达式
            if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
                // 获取函数名
                const functionName = this.getFunctionName(expression);
                // 如果函数名存在且在符号表中，检查该函数是否被导出
                if (functionName && this.symbolTable.has(functionName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private getFunctionName(node: ts.Node): string | undefined {
        // 如果是箭头函数，尝试从父节点获取名称
        if (ts.isArrowFunction(node)) {
            const parent = node.parent;
            if (ts.isVariableDeclaration(parent)) {
                return parent.name.getText();
            }
        }

        // 如果是函数表达式，尝试从父节点获取名称
        if (ts.isFunctionExpression(node)) {
            const parent = node.parent;
            if (ts.isVariableDeclaration(parent)) {
                return parent.name.getText();
            }
        }

        // 如果是函数声明，直接获取名称
        if (ts.isFunctionDeclaration(node)) {
            return node.name?.getText();
        }

        return undefined;
    }

    private isPrivateOrProtected(node: ts.Node): boolean {
        if (this.hasModifiers(node)) {
            const isPrivate = !!ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword);
            const isProtected = !!ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword);
            return isPrivate || isProtected; // 跳过私有和保护方法的检查
        }
        return false;
    }

    private isParentExported(node: ts.Node): boolean {
        if (this.isExported(node)) {
            return true;
        }
        if (node.parent) {
            return this.isParentExported(node.parent);
        }
        return false;
    }

    // 辅助函数：判断函数是否有显式的返回类型注解
    private hasExplicitReturnType(node: ts.FunctionDeclaration | ts.MethodDeclaration): boolean {
        // 如果函数有返回类型注解，或者函数体中返回的是一个有明确类型的函数，则返回 true
        if (node.type) {
            return true; // 显式返回类型注解
        }

        // 如果函数体中返回的是一个函数表达式或箭头函数，检查其是否有类型注解
        if (!node.body) {
            return false;
        }
        for (const statement of node.body.statements) {
            if (ts.isReturnStatement(statement) && statement.expression) {
                if (ts.isFunctionExpression(statement.expression) || ts.isArrowFunction(statement.expression)) {
                    return !!statement.expression.type; // 返回的函数有类型注解
                }
            }
        }
        return false;
    }

    private hasAsExpression(node: ts.FunctionDeclaration | ts.MethodDeclaration
        | ts.FunctionExpression | ts.ArrowFunction): boolean {
        if (!node.body) {
            return false;
        }
        // 检查函数体是否是一个块（Block）
        if (ts.isBlock(node.body)) {
            for (const statement of node.body.statements) {
                // 检查是否是 return 语句
                if (ts.isReturnStatement(statement) && statement.expression && ts.isAsExpression(statement.expression)) {
                    // 检查返回值是否是一个 AsExpression
                    return true;
                }
            }
        }

        // 检查函数体是否是一个表达式（例如箭头函数的简写形式）
        if (!ts.isBlock(node.body)) {
            // 直接检查表达式是否是一个 AsExpression
            if (ts.isAsExpression(node.body)) {
                return true;
            }
        }

        return false;
    }


    private checkConstructorDeclaration(
        node: ts.ConstructorDeclaration,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        const isSelfExported = this.isExported(node);
        for (const param of node.parameters) {
            if (!param.type && isSelfExported) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(param.name.getStart());
                result.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    character: character + 1,
                    description: this.checkArgument(param.name.getText())
                });
            }
        }
    }

    /**
   * 检查类声明中的方法和属性是否符合显式类型要求。
   */
    private checkClassDeclaration(
        node: ts.ClassDeclaration,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        // 检查类是否被导出
        const isDefaultExport = !!sourceFile.statements.find(stmt =>
            ts.isExportAssignment(stmt) &&
            stmt.expression &&
            (ts.isIdentifier(stmt.expression) &&
                node.name &&
                stmt.expression.text === node.name.text)
        );

        // 检查类是否有export关键字或是否是默认导出
        const isClassExported = this.isExported(node) || isDefaultExport;

        if (!isClassExported) {
            return; // 如果类没有被导出，直接返回，不检查其成员
        }

        // 遍历类成员
        for (const member of node.members) {
            // 特殊情况处理
            if (Options.allowDirectConstAssertionInArrowFunctions && ts.isArrowFunction(member) && ts.isDeleteExpression(member)) {
                continue;
            }
            if (Options.allowTypedFunctionExpressions && ts.isTypeOfExpression(member)) {
                continue;
            }
            if (Options.allowedNames && Options.allowedNames.length !== 0 && this.checkMethodName(member, Options.allowedNames)) {
                continue;
            }
            if (this.isPrivateOrProtected(member)) {
                continue;
            }
            if (member.name && ts.isPrivateIdentifier(member.name)) {
                continue;
            }

            this.checkClassAccessorDeclaration(member, sourceFile, Options, result);
            // 方法
            if (ts.isMethodDeclaration(member) && this.hasModifiers(member)) {
                this.checkClassMethodDeclaration(member, sourceFile, Options, result);
            }
            if (ts.isVariableDeclaration(member)) {
                this.checkClassVariableDeclaration(member, sourceFile, Options, result);
            }
            if (ts.isPropertyDeclaration(member)) {
                this.checkClassPropertyDeclaration(member, sourceFile, Options, result);
            }
            if (ts.isConstructorDeclaration(member)) {
                this.checkClassConstructorDeclaration(member, sourceFile, Options, result);
            }
        }
    }

    private buildSymbolTable(sourceFile: ts.SourceFile): void {
        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            if (ts.isExportSpecifier(node)) {
                // 处理 export { test, fn, arrowFn, Test }
                const name = node.name.getText();
                this.symbolTable.set(name, node);
            } else if (ts.isExportDeclaration(node)) {
                // 处理 export { test, fn }
                this.buildSymbolTableExportClause(node);
            } else if (ts.isExportAssignment(node)) {
                // 处理 export default xxx
                this.buildSymbolTabletExportAssignment(node);
            }

            // 递归遍历子节点
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    }

    private buildSymbolTableExportClause(node: ts.ExportDeclaration): void {
        if (node.exportClause) {
            if (ts.isNamedExports(node.exportClause)) {
                node.exportClause.elements.forEach((specifier) => {
                    const name = specifier.name.getText();
                    this.symbolTable.set(name, specifier);
                });
            }
        }
    }

    private buildSymbolTabletExportAssignment(node: ts.ExportAssignment): void {
        if (node.expression) {
            // 处理 export default { bar }
            if (ts.isObjectLiteralExpression(node.expression)) {
                this.buildSymbolTabletObjectLiteralExpression(node.expression);
            }
            // 处理 export default [foo]
            else if (ts.isArrayLiteralExpression(node.expression)) {
                this.buildSymbolTabletArrayLiteralExpression(node.expression);
            }
            // 处理 export default ClassName
            else if (ts.isIdentifier(node.expression)) {
                const name = node.expression.text;
                this.symbolTable.set(name, node);
            }
        }
    }

    private buildSymbolTabletObjectLiteralExpression(expression: ts.ObjectLiteralExpression): void {
        for (const property of expression.properties) {
            if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
                const name = property.name.text;
                this.symbolTable.set(name, property);
            } else if (ts.isShorthandPropertyAssignment(property)) {
                const name = property.name.text;
                this.symbolTable.set(name, property);
            }
        }
    }

    private buildSymbolTabletArrayLiteralExpression(expression: ts.ArrayLiteralExpression): void {
        for (const element of expression.elements) {
            if (ts.isIdentifier(element)) {
                const name = element.text;
                this.symbolTable.set(name, element);
            } else if (ts.isObjectLiteralExpression(element)) {
                this.buildSymbolTabletObjectLiteralExpression(element);
            }
        }
    }

    private checkMethodName(
        member: ts.ClassElement,
        allowedNames: string[],
    ): boolean {
        // 检查 node 是否是 MethodDeclaration 或 PropertyDeclaration 类型
        if (ts.isFunctionDeclaration(member) || ts.isArrowFunction(member) || ts.isFunctionExpression(member) ||
            ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
            const methodName = member.name?.getText(); // 安全访问 name 属性
            if (methodName && allowedNames.includes(methodName)) {
                return true; // 如果方法名在允许列表中，则跳过检查
            }
        }
        return false;
    }
    private checkClassMethodDeclaration(
        member: ts.MethodDeclaration,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        // 检查是否是私有或保护方法，如果是则跳过检查
        if (this.isPrivateOrProtected(member)) {
            return; // 跳过私有和保护方法的检查
        }

        // 检查返回类型
        if (!member.type) {
            this.addIssue(result, sourceFile, member.getStart(), 'Missing return type on function.');
        }

        // 检查参数类型
        for (const param of member.parameters) {
            if (!param.type) {
                this.addIssue(result, sourceFile, param.getStart(),
                    this.checkArgument(param.name.getText()));
            }
        }
    }
    private checkClassConstructorDeclaration(
        member: ts.ConstructorDeclaration,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        // 检查构造函数的参数类型注解
        for (const param of member.parameters) {
            // 检查是否缺少类型注解
            if (!param.type) {
                let startNumber = param.name.getStart();
                if (param.dotDotDotToken) {
                    startNumber = param.getStart();
                    this.addIssue(result, sourceFile, startNumber,
                        this.checkDotArgument(param.name.getText()));
                } else {
                    this.addIssue(result, sourceFile, startNumber,
                        this.checkArgument(param.name.getText()));
                }
            }
        }
    }

    private checkClassPropertyDeclaration(
        member: ts.PropertyDeclaration,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        // 检查类属性中的函数表达式 
        if (member.initializer &&
            (ts.isArrowFunction(member.initializer) || ts.isFunctionExpression(member.initializer))) {
            const func = member.initializer;

            // 检查返回类型注解
            if (!func.type) {
                this.addIssue(result, sourceFile, member.getStart(),
                    'Missing return type on function.');
            }

            // 检查参数类型注解
            for (const param of func.parameters) {
                if (!param.type) {
                    this.addIssue(result, sourceFile, param.getStart(),
                        this.checkArgument(param.name.getText()));
                }
            }
        }
    }

    private checkClassAccessorDeclaration(
        member: ts.ClassElement,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        // 检查 getter 方法
        if (ts.isGetAccessorDeclaration(member)) {
            if (!member.type) {
                this.addIssue(result, sourceFile, member.getStart(),
                    'Missing return type on function.');
            }
        }

        // 检查 setter 方法
        if (ts.isSetAccessorDeclaration(member)) {
            const param = member.parameters[0];
            if (!param.type) {
                this.addIssue(result, sourceFile, param.getStart(),
                    this.checkArgument(param.name.getText()));
            }
        }
    }

    /**
 * 检查类声明中的方法和属性是否符合显式类型要求。
 */
    private checkClassVariableDeclaration(
        member: ts.ClassElement & ts.VariableDeclaration,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        const initializer = member.initializer;
        if (initializer && ts.isArrowFunction(initializer)) {
            for (const param of initializer.parameters) {
                if (!param.type) {
                    this.addIssue(result, sourceFile, param.getStart(),
                        this.checkArgument(param.name.getText()));
                }
                if (param.type &&
                    param.type.kind === ts.SyntaxKind.AnyKeyword &&
                    !Options.allowArgumentsExplicitlyTypedAsAny) {
                    this.addIssue(result, sourceFile, param.getStart(),
                        this.checkNonAnyArgument(param.name.getText()));
                }
            }
            if (!initializer.type) {
                if (Options.allowDirectConstAssertionInArrowFunctions && this.hasAsExpression(initializer)) {
                    return;
                }
                this.addIssue(result, sourceFile, initializer.equalsGreaterThanToken?.getStart() || initializer.getStart(),
                    'Missing return type on function.');
            }
        }
    }

    /**
   * 检查函数声明是否符合显式类型要求。
   */
    private checkFunctionDeclaration(node: ts.FunctionDeclaration | ts.MethodDeclaration, sourceFile: ts.SourceFile,
        Options: Options, result: LocationInfo[]): void {
        // 如果是方法声明，检查是否是私有方法或在非导出类中
        if (ts.isMethodDeclaration(node)) {
            // 检查是否是私有或保护方法
            const isPrivate = !!ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword);
            const isProtected = !!ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword);

            if (isPrivate || isProtected) {
                return; // 跳过私有和保护方法的检查
            }

            let parent = node.parent;
            if (ts.isClassDeclaration(parent)) {
                // 检查类是否被导出
                const isClassExported = this.isExported(parent);

                if (!isClassExported) {
                    return; // 如果类没有被导出，跳过对其方法的检查
                }
            }
        }

        // 检查函数是否被导出
        const isFunctionExported = this.isExported(node);
        if (node.body && this.hasAsExpression(node) && Options.allowDirectConstAssertionInArrowFunctions) {
            return;
        }
        if (!isFunctionExported) {
            return;
        }
        this.checkFunctionDeclarationNode(node, sourceFile, Options, result, isFunctionExported);
    }

    private checkFunctionDeclarationNode(node: ts.FunctionDeclaration | ts.MethodDeclaration, sourceFile: ts.SourceFile,
        Options: Options, result: LocationInfo[], isFunctionExported: boolean): void {
        // 检查返回类型注解
        if (!node.type) {
            // 如果函数返回的是另一个函数，且返回的函数有明确的类型注解，则不报错
            if (!node.body || !this.hasExplicitReturnType(node)) {
                this.checkFunctionDeclarationNodeBody(node, sourceFile, result);
            }
        }

        // 检查参数类型注解
        for (const param of node.parameters) {
            if (!param.type && !param.initializer) {
                let startNumber = param.name.getStart();
                if (param.dotDotDotToken) {
                    startNumber = param.getStart();
                    this.addIssue(result, sourceFile, startNumber,
                        this.checkDotArgument(param.name.getText()));
                } else {
                    this.addIssue(result, sourceFile, startNumber,
                        this.checkArgument(param.name.getText()));
                }
            }
            if (param.type && isFunctionExported && param.type.kind === ts.SyntaxKind.AnyKeyword &&
                !Options.allowArgumentsExplicitlyTypedAsAny) {
                if (param.dotDotDotToken) {
                    this.addIssue(result, sourceFile, param.name.getStart() - 3,
                        this.checkDotAnyArgument(param.name.getText()));
                } else {
                    this.addIssue(result, sourceFile, param.name.getStart(),
                        this.checkNonAnyArgument(param.name.getText()));
                }
            }
        }
    }

    private checkFunctionDeclarationNodeBody(node: ts.FunctionDeclaration | ts.MethodDeclaration, sourceFile: ts.SourceFile,
        result: LocationInfo[]): void {
        if (node.modifiers) {
            // 检查是否包含 export 修饰符
            const exportModifier = node.modifiers.find(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
            const asyncModifier = node.modifiers.find(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword);
            // 如果是 export async function，则错误位置在 export 和 async 之间
            if (exportModifier && asyncModifier) {
                const pos = exportModifier.end + 1;
                this.addIssue(result, sourceFile, pos, 'Missing return type on function.');
                return;
            }
            // 如果只有 export 修饰符
            if (exportModifier) {
                this.addIssue(result, sourceFile, node.modifiers.end + 1, 'Missing return type on function.');
            } else {
                this.addIssue(result, sourceFile, node.getStart(), 'Missing return type on function.');
            }
        } else {
            this.addIssue(result, sourceFile, node.getStart(), 'Missing return type on function.');
        }
    }

    private checkVariableDeclaration(
        node: ts.VariableDeclaration,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        const initializer = node.initializer;
        const isSelfExported = this.isParentExported(node);
        if (!isSelfExported) {
            return;
        }
        if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {

            for (const param of initializer.parameters) {
                if (!param.type) {
                    this.addIssue(result, sourceFile, param.getStart(),
                        this.checkArgument(param.name.getText()));
                }
                if (param.type && param.type.kind === ts.SyntaxKind.AnyKeyword &&
                    !Options.allowArgumentsExplicitlyTypedAsAny) {
                    this.addIssue(result, sourceFile, param.name.getStart(),
                        this.checkNonAnyArgument(param.name.getText()));
                }
            }
            if (!initializer.type) {
                if (Options.allowDirectConstAssertionInArrowFunctions && this.hasAsExpression(initializer)) {
                    return;
                }
                let startNumber = initializer.getStart();
                if (ts.isArrowFunction(initializer)) {
                    startNumber = initializer.equalsGreaterThanToken?.getStart();
                }
                this.addIssue(result, sourceFile, startNumber,
                    'Missing return type on function.');
            }
        } else if (initializer && ts.isObjectLiteralExpression(initializer)) {
            // 检查对象字面量
            this.checkObjectLiteralExpression(initializer, sourceFile, Options, result);
        }
    }

    private checkObjectLiteralExpression(
        initializer: ts.ObjectLiteralExpression,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        // 遍历对象字面量的属性
        for (const property of initializer.properties) {
            if (ts.isPropertyAssignment(property)) {
                this.checkObjectLiteralExpressionProperty(property, sourceFile, Options, result);
            } else if (ts.isMethodDeclaration(property)) {
                // 检查简写方法声明，如 { func2() { return 0; } }
                this.checkObjectLiteralMethodDeclaration(property, sourceFile, Options, result);
            }
        }
    }

    // 检查对象字面量中的简写方法
    private checkObjectLiteralMethodDeclaration(
        method: ts.MethodDeclaration,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        // 检查方法是否有返回类型
        if (!method.type) {
            this.addIssue(result, sourceFile, method.name.getStart(),
                'Missing return type on function.');
        }

        // 检查参数类型
        for (const param of method.parameters) {
            if (!param.type) {
                this.addIssue(result, sourceFile, param.getStart(),
                    this.checkArgument(param.name.getText()));
            }
        }
    }

    private checkObjectLiteralExpressionProperty(
        property: ts.PropertyAssignment,
        sourceFile: ts.SourceFile,
        Options: Options,
        result: LocationInfo[]
    ): void {
        const name = property.name;
        const value = property.initializer || property;
        // 检查属性值是否为函数表达式或箭头函数
        if (value && (ts.isFunctionExpression(value) || ts.isArrowFunction(value))) {
            const func = value as ts.FunctionExpression | ts.ArrowFunction;

            // 检查函数表达式的返回类型注解
            if (!func.type && !Options.allowTypedFunctionExpressions) {
                this.addIssue(result, sourceFile, func.parent.getStart(),
                    'Missing return type on function.');
            }

            // 检查函数参数的类型注解
            for (const param of func.parameters) {
                if (!param.type) {
                    this.addIssue(result, sourceFile, param.getStart(),
                        this.checkArgument(param.name.getText()));
                }
            }
        }
    }

    private checkDotAnyArgument(arg: string): string {
        // 去除首尾空格
        const trimmedArg = arg.trim();

        // 检查是否是对象模式（以 '{' 开头，以 '}' 结尾）
        if (trimmedArg.startsWith('{') && trimmedArg.endsWith('}')) {
            return 'Rest argument should be typed with a non-any type.';
        }

        // 检查是否是数组模式（以 '[' 开头，以 ']' 结尾）
        if (trimmedArg.startsWith('[') && trimmedArg.endsWith(']')) {
            return 'Rest argument should be typed with a non-any type.';
        }

        // 其他情况（普通变量）
        return `Argument '${trimmedArg}' should be typed with a non-any type.`;
    }

    private checkDotArgument(arg: string): string {
        // 去除首尾空格
        const trimmedArg = arg.trim();

        // 检查是否是对象模式（以 '{' 开头，以 '}' 结尾）
        if (trimmedArg.startsWith('{') && trimmedArg.endsWith('}')) {
            return 'Rest argument should be typed.';
        }

        // 检查是否是数组模式（以 '[' 开头，以 ']' 结尾）
        if (trimmedArg.startsWith('[') && trimmedArg.endsWith(']')) {
            return 'Rest argument should be typed.';
        }

        // 其他情况（普通变量）
        return `Argument '${trimmedArg}' should be typed.`;
    }

    private checkNonAnyArgument(arg: string): string {
        // 去除首尾空格
        const trimmedArg = arg.trim();

        // 检查是否是对象模式（以 '{' 开头，以 '}' 结尾）
        if (trimmedArg.startsWith('{') && trimmedArg.endsWith('}')) {
            return 'Object pattern argument should be typed with a non-any type.';
        }

        // 检查是否是数组模式（以 '[' 开头，以 ']' 结尾）
        if (trimmedArg.startsWith('[') && trimmedArg.endsWith(']')) {
            return 'Array pattern argument should be typed with a non-any type.';
        }

        // 其他情况（普通变量）
        return `Argument '${trimmedArg}' should be typed with a non-any type.`;
    }

    private checkArgument(arg: string): string {
        // 去除首尾空格
        const trimmedArg = arg.trim();

        // 检查是否是对象模式（以 '{' 开头，以 '}' 结尾）
        if (trimmedArg.startsWith('{') && trimmedArg.endsWith('}')) {
            return 'Object pattern argument should be typed.';
        }

        // 检查是否是数组模式（以 '[' 开头，以 ']' 结尾）
        if (trimmedArg.startsWith('[') && trimmedArg.endsWith(']')) {
            return 'Array pattern argument should be typed.';
        }

        // 其他情况（普通变量）
        return `Argument '${trimmedArg}' should be typed.`;
    }

    /**
    * 添加问题报告。
    */
    private addIssue(
        result: LocationInfo[],
        sourceFile: ts.SourceFile,
        pos: number,
        description: string
    ): void {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        result.push({
            fileName: sourceFile.fileName,
            line: line + 1,
            character: character + 1,
            description: description,
        });
    }

    private addIssueReportNode(loc: LocationInfo, filePath: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        if (loc.description) {
            this.metaData.description = loc.description;
        }
        let defect = new Defects(loc.line, loc.character, loc.character, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}
