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

import { ArkFile, ts, AstTreeUtils, ArkClass, ArkMethod, Stmt, ArkAssignStmt, ClassType, AbstractInvokeExpr } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AwaitThenableCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/await-thenable.md",
    description: 'Unexpected `await` of a non-Promise (non-"Thenable") value.',
};
// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
    fileName: string;
    line: number;
    character: number;
}
export class AwaitThenableCheck implements BaseChecker {
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

    public check = (arkFile: ArkFile) => {
        if (arkFile instanceof ArkFile) {
            const code = arkFile.getCode();
            if (!code) {
                return;
            }
            const filePath = arkFile.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
            // 构建符号表
            this.buildSymbolTable(sourceFile);
            arkFile.getClasses().forEach(cls => this.checkClass(cls));

            const issues = this.checkAwaitThenable(sourceFile);
            // 输出结果
            issues.forEach(info => {
                this.addIssueReportNode(info.line, info.character, filePath!);
            });
        }
    }

    private checkClass(arkClass: ArkClass): void {
        const methods = arkClass.getMethods(true);
        methods.forEach(method => {
            this.checkMethod(method);
        });
    }

    private checkMethod(arkMethod: ArkMethod): void {
        const stmts = arkMethod.getBody()?.getCfg().getStmts();
        stmts?.forEach(stmt => {
            this.checkStmt(stmt);
        });
    }

    private checkStmt(stmt: Stmt): void {
        let originCode = stmt.getOriginalText();
        if (!originCode) {
            return;
        }
        if (!originCode.includes('await')) {
            return;
        }
        if (stmt instanceof ArkAssignStmt) {
            const rightOp = stmt.getRightOp();
            if (rightOp instanceof AbstractInvokeExpr) {
                const methodSignature = rightOp.getMethodSignature();
                let returnType = methodSignature.getMethodSubSignature().getReturnType();
                let methodName = methodSignature.getMethodSubSignature().getMethodName();
                if (returnType instanceof ClassType && returnType.getClassSignature().getClassName() === 'Promise') {
                    // 创建一个表示 Promise 节点
                    const promiseNode = AstTreeUtils.getASTNode('temp', 'Promise');
                    this.symbolTable.set(methodName, promiseNode);
                }
            }
        }
    }


    private checkAwaitThenable(sourceFile: ts.SourceFile): LocationInfo[] {
        const result: LocationInfo[] = [];
        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            // 检查是否为 AwaitExpression
            this.isAwaitExpression(node, sourceFile, result);
            // 递归遍历子节点
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return result;
    }

    private isAwaitExpression(node: ts.Node, sourceFile: ts.SourceFile, result: LocationInfo[]): void {
        if (ts.isAwaitExpression(node)) {
            let operand = node.expression;
            // 检查是否为 Promise 或 thenable 或 async 对象
            if (this.isPossiblePromiseOrThenable(operand, sourceFile) != null &&
                !this.isPossiblePromiseOrThenable(operand, sourceFile)) {
                // 获取行列信息
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                result.push({
                    fileName: sourceFile.fileName,
                    line: line + 1, // 行号从1开始
                    character: character + 1, // 列号从1开始
                });
            }
        }
    }

    private isPossiblePromiseOrThenable(operand: ts.Node, sourceFile: ts.SourceFile): boolean | null {
        // 检查是否为 Promise 构造函数的调用
        if (this.isPromiseConstructorCall(operand)) {
            return true;
        }
        // 检查是否为 async 函数的调用
        if (this.isAsyncFunctionCall(operand)) {
            return true;
        }
        // 检查是否具有 .then 方法
        if (this.hasThenMethod(operand)) {
            return true;
        }
        // 检查括号表达式
        if (ts.isParenthesizedExpression(operand)) {
            let operandExpression = operand.expression;
            return this.isPossiblePromiseOrThenable(operandExpression, sourceFile);
        }
        // 检查逻辑表达式（如 && 或 ||）
        if (ts.isBinaryExpression(operand) &&
            (operand.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                operand.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
            // 分别检查逻辑表达式的两个分支
            const leftBranch = operand.left;
            const rightBranch = operand.right;
            // 递归检查两个分支是否都可能是 Promise 或 Thenable
            return (
                this.isPossiblePromiseOrThenable(leftBranch, sourceFile) ||
                this.isPossiblePromiseOrThenable(rightBranch, sourceFile)
            );
        }
        // 检查是否为可选链调用
        if (ts.isOptionalChain(operand)) {
            return this.checkOptionalChain(operand);
        }
        // 检查操作数是否是变量引用
        if (ts.isIdentifier(operand)) {
            return this.checkIdentifier(operand, sourceFile);
        }
        // 检查函数调用的返回值是否是 Promise 或 thenable
        if (ts.isCallExpression(operand)) {
            return this.checkCallExpression(operand);
        }
        // 检查操作数是否为基本类型（布尔值、数字、字符串等）
        if (ts.isLiteralExpression(operand)) {
            const literalKind = operand.kind;
            if (
                literalKind === ts.SyntaxKind.TrueKeyword ||
                literalKind === ts.SyntaxKind.FalseKeyword ||
                literalKind === ts.SyntaxKind.NumericLiteral ||
                literalKind === ts.SyntaxKind.StringLiteral
            ) {
                return false; // 基本类型不是 Promise 或 Thenable
            }
        }
        // 检查对象字面量
        if (ts.isObjectLiteralExpression(operand)) {
            return false; // 对象字面量不是 Promise 或 Thenable
        }
        return null;
    }

    private checkParameterTypeNode(parameterDeclaration: ts.ParameterDeclaration): boolean {
        const typeNode = parameterDeclaration.type;
        if (!typeNode) {
            return true;
        }
        if (typeNode.kind === ts.SyntaxKind.AnyKeyword || typeNode.kind === ts.SyntaxKind.UndefinedKeyword) {
            return true;
        }
        // 检查是否是函数类型且返回 Promise
        if (ts.isFunctionTypeNode(typeNode)) {
            const returnType = typeNode.type;
            if (ts.isTypeReferenceNode(returnType)) {
                const typeName = returnType.typeName;
                if (ts.isIdentifier(typeName) && typeName.text === 'Promise') {
                    return true;
                }
            }
        }
        return false;
    }

    private checkOptionalChain(operand: ts.PropertyAccessChain | ts.ElementAccessChain | ts.CallChain | ts.NonNullChain): boolean | null {
        // 检查可选链操作符的调用是否可能返回一个 Promise 或 Thenable
        const callee = operand.expression;
        if (ts.isIdentifier(callee)) {
            const calleeDefinition = this.symbolTable.get(callee.text);
            if (!calleeDefinition) {
                return true;
            }
            if (ts.isParameter(calleeDefinition)) {
                if (this.checkParameterTypeNode(calleeDefinition)) {
                    return true;
                }
            }
            if (calleeDefinition && ts.isArrowFunction(calleeDefinition)) {
                // 检查函数是否被标记为 async
                if (calleeDefinition.modifiers && calleeDefinition.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
                    return true; // 如果是 async 函数，返回 true
                }

                // 检查函数的返回类型是否是 Promise 或 thenable
                const returnType = calleeDefinition.type;
                if (returnType && this.isPromiseVariableDeclaration(returnType)) {
                    return true;
                }
            }
            if (calleeDefinition && ts.isFunctionDeclaration(calleeDefinition)) {
                // 检查函数是否被标记为 async
                if (calleeDefinition.modifiers && calleeDefinition.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
                    return true; // 如果是 async 函数，返回 true
                }

                // 检查函数的返回类型是否是 Promise 或 thenable
                const returnType = calleeDefinition.type;
                if (returnType && this.isPromiseVariableDeclaration(returnType)) {
                    return true;
                }
                // 如果没有明确的返回类型注解，分析函数的实现
                if (!returnType) {
                    return this.analyzeFunctionBodyForPromise(calleeDefinition);
                }
            }
        } else {
            return true;
        }
        return false;
    }

    private checkIdentifier(operand: ts.Identifier, sourceFile: ts.SourceFile): boolean | null {
        const definition = this.symbolTable.get(operand.text);
        if (!definition) {
            return false;
        }
        // 检查是否是参数且类型为 any
        if (ts.isParameter(definition)) {
            if (this.checkParameterTypeNode(definition)) {
                return true;
            }
        }
        // 如果变量的定义没有明确的类型注解，假设它可能是 Promise 或 thenable 对象
        if (ts.isVariableDeclaration(definition) && !definition.type) {
            // 检查变量的初始值
            if (definition.initializer) {
                if (ts.isLiteralExpression(definition.initializer) || ts.isNumericLiteral(definition.initializer) ||
                    ts.isStringLiteral(definition.initializer) ||
                    definition.initializer.kind === ts.SyntaxKind.TrueKeyword || definition.initializer.kind === ts.SyntaxKind.FalseKeyword) {
                    return false; // 基本类型不是 Promise 或 Thenable
                }
                // 递归检查变量的初始值是否可能是 Promise 或 Thenable
                return this.isPossiblePromiseOrThenable(definition.initializer, sourceFile);
            }
            // 如果没有初始值，返回 false
            return false;
        }

        // 如果变量的定义有类型注解，检查类型注解是否为 any 或 unknown
        if (ts.isVariableDeclaration(definition) && definition.type) {
            const typeAnnotation = definition.type;
            return this.isPromiseVariableDeclaration(typeAnnotation);
        }
        return false;
    }

    private checkCallExpression(operand: ts.CallExpression): boolean | null {
        const callee = operand.expression;
        if (this.isPromiseCallExpression(callee)) {
            return true;
        }

        if (ts.isParenthesizedExpression(callee)) {
            const innerExpression = callee.expression;
            if (ts.isFunctionExpression(innerExpression) || ts.isArrowFunction(innerExpression)) {
                // 检查函数表达式或箭头函数是否被标记为 async
                if (innerExpression.modifiers && innerExpression.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
                    return true; // 如果是 async 函数表达式或箭头函数，返回 true
                }
            }
        }
        if (ts.isPropertyAccessExpression(callee)) {
            const name = callee.name.text;
            const definition = this.symbolTable.get(name);
            if (definition) {
                const definitionText = definition.getText();
                if (definitionText === 'Promise') {
                    return true;
                }
            }
            if (name === 'reject' && ts.isIdentifier(callee.expression) && callee.expression.text === 'Promise') {
                return true; // Promise.reject 返回一个 Promise
            }
            if (name === 'all' && ts.isIdentifier(callee.expression) && callee.expression.text === 'Promise') {
                return true; // Promise.all 返回一个 Promise
            }
            if (name === 'finally' || name === 'then') {
                return true; // 链式调用返回一个 Promise
            }
        }
        if (ts.isIdentifier(callee)) {
            return this.checkCallExpressionIdentifier(callee);
        }
        return false;
    }

    private checkCallExpressionIdentifier(callee: ts.Identifier): boolean | null {
        const calleeDefinition = this.symbolTable.get(callee.text);
        if (!calleeDefinition) {
            return false;
        }
        if (calleeDefinition) {
            const definitionText = calleeDefinition.getText();
            if (definitionText === 'Promise') {
                return true;
            }
        }
        if (ts.isArrowFunction(calleeDefinition)) {
            // 检查函数是否被标记为 async
            if (calleeDefinition.modifiers && calleeDefinition.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
                return true; // 如果是 async 函数，返回 true
            }

            // 检查函数的返回类型是否是 Promise 或 thenable
            const returnType = calleeDefinition.type;
            if (returnType && this.isPromiseVariableDeclaration(returnType)) {
                return true;
            }
            return false;
        }
        if (ts.isFunctionDeclaration(calleeDefinition)) {
            // 检查函数是否被标记为 async
            if (calleeDefinition.modifiers && calleeDefinition.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
                return true; // 如果是 async 函数，返回 true
            }

            // 检查函数的返回类型是否是 Promise 或 thenable
            const returnType = calleeDefinition.type;
            if (returnType && this.isPromiseVariableDeclaration(returnType)) {
                return true;
            }
            // 如果没有明确的返回类型注解，分析函数的实现
            if (!returnType) {
                return this.analyzeFunctionBodyForPromise(calleeDefinition);
            }
            return false;
        }
        return false;
    }

    private analyzeFunctionBodyForPromise(func: ts.FunctionDeclaration): boolean {
        if (!func.body) {
            return false;
        }
        // 分析函数体，检查是否返回 Promise 或 thenable
        for (const statement of func.body.statements) {
            // 检查是否有 return 语句
            if (ts.isReturnStatement(statement)) {
                const returnValue = statement.expression;
                if (!returnValue) {
                    continue;
                }
                // 检查返回值是否是 Promise 构造函数的调用
                if (this.isPromiseConstructorCall(returnValue)) {
                    return true;
                }

                // 检查返回值是否具有 .then 方法
                if (this.hasThenMethod(returnValue)) {
                    return true;
                }

                // 检查返回值是否是 async 函数的调用
                if (this.isAsyncFunctionCall(returnValue)) {
                    return true;
                }
            }
        }

        return false;
    }
    private isPromiseVariableDeclaration(typeAnnotation: ts.TypeNode): boolean {
        if (typeAnnotation.kind === ts.SyntaxKind.AnyKeyword ||
            typeAnnotation.kind === ts.SyntaxKind.UndefinedKeyword ||
            typeAnnotation.kind === ts.SyntaxKind.UnknownKeyword) {
            return true;
        }
        if (ts.isTypeReferenceNode(typeAnnotation)) {
            const typeName = typeAnnotation.typeName;
            if (this.isPromiseTypeReferenceNode(typeName)) {
                return true;
            }
        }
        // 检查类型交叉的情况
        if (ts.isIntersectionTypeNode(typeAnnotation)) {
            for (const type of typeAnnotation.types) {
                if (this.isPromiseIntersectionTypeNode(type)) {
                    return true;
                }
            }
        }
        return false;
    }

    private isPromiseIntersectionTypeNode(type: ts.TypeNode): boolean {
        if (ts.isTypeReferenceNode(type)) {
            const typeName = type.typeName;
            if (ts.isIdentifier(typeName) && typeName.text === 'Promise') {
                return true;
            }
        }
        return false;
    }


    private isPromiseTypeReferenceNode(typeName: ts.Node): boolean {

        if (ts.isIdentifier(typeName) && (typeName.text === 'Promise' || typeName.text === 'Bluebird')) {
            return true;
        }
        if (ts.isIdentifier(typeName)) {
            const className = typeName.text;
            const classDefinition = this.symbolTable.get(className);
            if (classDefinition && ts.isClassDeclaration(classDefinition)) {
                if (this.isPromiseOrSubclass(classDefinition)) {
                    return true;
                }
            }
        }
        return false;
    }

    private isPromiseConstructorCall(node: ts.Node): boolean {
        if (ts.isNewExpression(node)) {
            const expression = node.expression;
            if (ts.isIdentifier(expression) && expression.text === 'Promise') {
                return true;
            }
        }
        if (ts.isCallExpression(node)) {
            const expression = node.expression;
            if (this.isPromiseCallExpression(expression)) {
                return true;
            }
        }
        // 如果是对象字面量，且包含 then 属性，可能是 thenable 对象
        if (ts.isObjectLiteralExpression(node)) {
            for (const prop of node.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'then') {
                    return true;
                }
            }
        }
        return false;
    }
    private isPromiseCallExpression(expression: ts.Node): boolean {
        if (ts.isPropertyAccessExpression(expression)) {
            const name = expression.name;
            if (ts.isIdentifier(name) && (name.text === 'resolve' || name.text === 'reject')) {
                const object = expression.expression;
                if (ts.isIdentifier(object) && object.text === 'Promise') {
                    return true;
                }
            }
        }
        return false;
    }

    private isPromiseOrSubclass(classDeclaration: ts.ClassDeclaration): boolean {
        // 检查类是否继承自 Promise
        const heritageClause = classDeclaration.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword);
        if (!heritageClause) {
            return false;
        }
        const baseType = heritageClause.types[0];
        if (ts.isExpressionWithTypeArguments(baseType)) {
            const baseTypeName = baseType.expression;
            return this.isPromiseExpressionWithTypeArguments(baseTypeName);

        }
        return false;
    }
    private isPromiseExpressionWithTypeArguments(baseTypeName: ts.Node): boolean {
        if (ts.isIdentifier(baseTypeName) && baseTypeName.text === 'Promise') {
            return true;
        } else if (ts.isIdentifier(baseTypeName)) {
            const baseClassDefinition = this.symbolTable.get(baseTypeName.text);
            if (baseClassDefinition && ts.isClassDeclaration(baseClassDefinition)) {
                return this.isPromiseOrSubclass(baseClassDefinition);
            }
        }
        return false;
    }


    private isAsyncFunctionCall(node: ts.Node): boolean {
        // 检查是否为 async 函数的调用
        if (!ts.isCallExpression(node)) {
            return false;
        }
        const expression = node.expression;
        if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
            // 检查函数是否是 async
            if (expression.modifiers && expression.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
                return true;
            }
        } else if (ts.isParenthesizedExpression(expression)) {
            // 处理括号表达式，如 (async () => true)
            const innerExpression = expression.expression;
            if (ts.isArrowFunction(innerExpression) || ts.isFunctionExpression(innerExpression)) {
                // 检查函数是否是 async
                if (innerExpression.modifiers && innerExpression.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
                    return true;
                }
            }
        } else if (ts.isIdentifier(expression)) {
            // 处理变量引用，如 createValue
            const definition = this.symbolTable.get(expression.text);
            if (definition) {
                // 检查变量的定义是否是 async 函数
                if (ts.isArrowFunction(definition) || ts.isFunctionExpression(definition)) {
                    // 确保 modifiers 存在后再调用 some 方法
                    return definition.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
                }
            }
        }
        return false;
    }

    private buildSymbolTable(sourceFile: ts.SourceFile): void {
        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            if (ts.isVariableDeclaration(node)) {
                const name = node.name.getText();
                // 存储变量声明本身，而不仅仅是初始化器
                this.symbolTable.set(name, node);
            } else if (ts.isFunctionDeclaration(node)) {
                const name = node.name?.getText();
                if (name) {
                    this.symbolTable.set(name, node);
                }
                // 处理函数参数
                if (node.parameters) {
                    this.buildSymbolTableAddParam(node.parameters);
                }
            } else if (ts.isClassDeclaration(node)) {
                const name = node.name?.getText();
                if (name) {
                    this.symbolTable.set(name, node);
                }
            } else if (ts.isArrowFunction(node)) {
                const parent = node.parent;
                if (ts.isVariableDeclaration(parent)) {
                    const name = parent.name.getText();
                    this.symbolTable.set(name, node);
                }
                // 处理箭头函数参数
                if (node.parameters) {
                    this.buildSymbolTableAddParam(node.parameters);
                }
            }

            // 递归遍历子节点
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    }

    private buildSymbolTableAddParam(parameters: ts.NodeArray<ts.ParameterDeclaration>): void {
        for (const param of parameters) {
            if (ts.isParameter(param) && ts.isIdentifier(param.name)) {
                this.symbolTable.set(param.name.text, param);
            }
        }
    }


    private hasThenMethod(node: ts.Node): boolean {
        if (ts.isPropertyAccessExpression(node)) {
            const name = node.name;
            if (ts.isIdentifier(name) && name.text === 'then') {
                return true;
            }
        }
        return false;
    }

    private addIssueReportNode(line: number, startCol: number, filePath: string) {
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(line, startCol, startCol, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}