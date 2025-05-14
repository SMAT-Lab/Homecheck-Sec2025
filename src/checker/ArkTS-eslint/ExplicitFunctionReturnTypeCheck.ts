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

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ExplicitFunctionReturnTypeCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/explicit-function-return-type.md",
    description: "Require explicit return types on functions and class methods",
};
const defaultOptions: Options = {
    allowExpressions: false,
    allowTypedFunctionExpressions: true,
    allowHigherOrderFunctions: true,
    allowDirectConstAssertionInArrowFunctions: true,
    allowConciseArrowFunctionExpressionsStartingWithVoid: false,
    allowFunctionsWithoutTypeParameters: false,
    allowedNames: [],
    allowIIFEs: false,
}
interface Options {
    allowConciseArrowFunctionExpressionsStartingWithVoid?: boolean;
    allowDirectConstAssertionInArrowFunctions?: boolean;
    allowExpressions?: boolean;
    allowFunctionsWithoutTypeParameters?: boolean;
    allowHigherOrderFunctions?: boolean;
    allowIIFEs?: boolean;
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

export class ExplicitFunctionReturnTypeCheck implements BaseChecker {

    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private options: Options = defaultOptions;

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatcherCb];
    }

    public check = (target: ArkFile) => {
        if (target instanceof ArkFile) {
            const targetName = target.getName();
            if (targetName && this.getFileExtension(targetName) === '.ets') {
                return;
            }
            const code = target.getCode();
            if (!code) {
                return;
            }
            const filePath = target.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
            this.options = this.rule && this.rule.option && this.rule.option[0] ? this.rule.option[0] as Options : defaultOptions;
            const missingReturnTypes = this.checkExplicitReturnType(sourceFile);
            missingReturnTypes.forEach(info => {
                this.addIssueReportNode(info, filePath);
            });
        }
    }

    public checkExplicitReturnType(sourceFile: ts.SourceFile): LocationInfo[] {
        const result: LocationInfo[] = [];

        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            // 特殊情况处理
            if (this.specialTreatment(node)) {
                return;
            }

            // 检查变量声明中的箭头函数或对象属性中的箭头函数
            if (ts.isArrowFunction(node)) {
                if (this.checkArrowFunction(node, sourceFile, result)) {
                    return;
                }
            }

            // 检查类方法声明
            if (ts.isMethodDeclaration(node)) {
                if (this.checkMethodDeclaration(node, sourceFile, result)) {
                    return;
                }
            }

            if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
                // 特殊函数
                if (ts.isFunctionExpression(node) && this.specialTreatmentFunctionExpression(node, sourceFile, result)) {
                    return;
                }
                // 如果是抽象函数声明，不需要检查返回类型
                if (ts.isFunctionDeclaration(node) && this.isAbstractMethod(node)) {
                    return;
                }

                // 如果是函数声明且没有函数体（只有签名声明），不需要检查返回类型
                if (ts.isFunctionDeclaration(node) && this.isFunctionDeclarationWithoutBody(node)) {
                    return;
                }

                // 如果函数有泛型参数，不需要检查返回类型
                if (this.options.allowFunctionsWithoutTypeParameters && this.hasFunctionTypeParameters(node)) {
                    return;
                }
                if (!node.type) {
                    this.addIssue(node, sourceFile, result);
                }
            }

            // 处理 getter 方法
            if (ts.isGetAccessorDeclaration(node)) {
                if (this.checkGetAccessorDeclaration(node, sourceFile, result)) {
                    return;
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return result;
    }


    private checkGetAccessorDeclaration(node: ts.GetAccessorDeclaration, sourceFile: ts.SourceFile, result: LocationInfo[]): boolean {
        // 检查是否是抽象的getter方法
        const isAbstract = node.modifiers && node.modifiers.some(
            modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword
        );

        // 检查是否有函数体
        const hasBody = node.body !== undefined;

        // 检查是否有返回类型
        const hasReturnType = node.type !== undefined;

        // 非抽象getter必须有函数体
        if (!isAbstract && !hasBody) {
            // 这种情况是getter声明，不报错
            return true;
        }

        // 有函数体的getter必须有返回类型
        if (hasBody && !hasReturnType) {
            const position = this.getGetAccessorNamePosition(node);
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
            result.push({
                fileName: sourceFile.fileName,
                line: line + 1,
                character: character + 1,
                description: 'Missing return type on function.',
            });
        }
        return false;
    }

    private specialTreatmentFunctionExpression(node: ts.FunctionExpression, sourceFile: ts.SourceFile, result: LocationInfo[]): boolean {
        // 检查是否是异步函数
        const isAsync = node.modifiers && node.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword);

        // 检查是否是立即执行的函数表达式
        const isIIFE = this.isImmediatelyInvokedFunctionExpression(node);

        // 检查是否在 Promise 构造函数中
        const isInPromiseContext = this.isInPromiseContext(node);

        // 检查是否是匿名函数
        const isAnonymous = !node.name;

        // 如果是在Promise上下文中的异步匿名IIFE，且没有返回类型，应该报错
        if (isAsync && isAnonymous && isIIFE && isInPromiseContext && !node.type) {
            const pos = this.getFunctionKeywordPosition(node, sourceFile);
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
            result.push({
                fileName: sourceFile.fileName,
                line: line + 1,
                character: character + 1,
                description: 'Missing return type on function.'
            });
            return true;
        }
        return false;
    }
    private specialTreatment(node: ts.Node): boolean {
        if (this.options.allowDirectConstAssertionInArrowFunctions && ts.isArrowFunction(node) && ts.isDeleteExpression(node)) {
            return true;
        }
        
        // 添加对箭头函数中as const断言的检测
        if (this.options.allowDirectConstAssertionInArrowFunctions && this.hasConstAssertion(node)) {
            return true;
        }
        
        if (this.options.allowExpressions && ts.isArrowFunction(node)) {
            return true;
        }
        // 检查是否在函数调用的对象参数中
        if ((ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && this.isInObjectArgument(node)) {
            return true;
        }
        if (this.options.allowConciseArrowFunctionExpressionsStartingWithVoid && ts.isVoidExpression(node)) {
            return true;
        }
        if (this.options.allowIIFEs && ts.isArrowFunction(node) && ts.isPrefixUnaryExpression(node) && ts.isPostfixUnaryExpression(node)) {
            return true;
        }
        if (this.specialTreatmentExpression(node)) {
            return true;
        }

        return false;
    }

    private specialTreatmentExpression(node: ts.Node): boolean {
        if (ts.isClassDeclaration(node) && node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DeclareKeyword)) {
            // 允许declare类定义，但检查declare abstract类中的方法
            const hasAbstract = node.modifiers.some(mod => mod.kind === ts.SyntaxKind.AbstractKeyword);
            if (!hasAbstract) {
                return true; // 只有普通的declare类，跳过检查
            }
        }

        // 检查高阶函数
        if (this.options.allowHigherOrderFunctions && this.isHigherOrderFunction(node)) {
            return true;
        }
        // 检查是否是函数表达式
        if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
            // 如果函数是类型断言的一部分，则不报告问题
            if (this.isPartOfTypeAssertion(node)) {
                return true;
            }

            if (this.options.allowTypedFunctionExpressions && this.isTypedFunctionExpression(node)) {
                return true;
            }

            // 检查祖先是否有返回类型
            if (this.options.allowTypedFunctionExpressions && this.ancestorHasReturnType(node)) {
                return true;
            }

            // 允许有泛型参数的函数不需要返回类型
            if (this.options.allowFunctionsWithoutTypeParameters && this.hasFunctionTypeParameters(node)) {
                return true;
            }
        }
        return false;
    }


    private getFileExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }
        return filePath.substring(lastDotIndex);
    }


    /**
     * 检查节点是否在函数调用的对象参数中
     */
    private isInObjectArgument(node: ts.Node): boolean {
        // 检查父节点链，查找是否是在对象字面量中作为属性值
        let current: ts.Node | undefined = node;
        let isProperty = false;

        while (current) {
            // 如果当前节点是属性赋值的一部分
            if (ts.isPropertyAssignment(current)) {
                isProperty = true;
                // 继续检查是否在对象字面量中
                current = current.parent;
                continue;
            }

            // 如果我们已经发现是属性，现在检查是否在对象字面量中
            if (isProperty && ts.isObjectLiteralExpression(current)) {
                if (this.isInObjectLiteralExpression(current)) {
                    return true;
                }
            }

            current = current.parent;
        }

        return false;
    }

    private isInObjectLiteralExpression(current: ts.Node): boolean {
        // 检查对象字面量是否作为函数调用的参数
        const parent = current.parent;
        if (parent && ts.isCallExpression(parent)) {
            // 检查对象字面量是否是调用表达式的参数
            if (parent.arguments.includes(current as ts.Expression)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查类方法是否应该有返回类型
     */
    private shouldMethodHaveReturnType(node: ts.MethodDeclaration): boolean {
        // 构造函数不需要返回类型
        if (node.name && ts.isIdentifier(node.name) && node.name.text === 'constructor') {
            return false;
        }

        const parent = node.parent;
        if (parent && ts.isClassDeclaration(parent)) {
            const isDeclare = parent.modifiers && parent.modifiers.some(
                modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword
            );
            if (isDeclare) {
                return false;
            }
        }

        // 返回类型为空的情况
        if (node.type) {
            return false;
        }

        // 所有其他方法都应有返回类型
        return true;
    }

    /**
     * 检查变量声明中的箭头函数是否应该有返回类型
     */
    private shouldVariableArrowFunctionHaveType(node: ts.ArrowFunction): boolean {
        const parent = node.parent;

        // 检查是否是变量声明中的箭头函数
        if (parent && ts.isVariableDeclaration(parent)) {
            // 如果变量声明没有类型注解，则箭头函数应该有返回类型
            if (!parent.type) {
                // 除非允许表达式函数
                if (this.options.allowExpressions) {
                    return false;
                }
                return true;
            }
        }

        return false;
    }

    /**
     * 获取箭头函数的起始位置
     * 这个函数用于确保问题点定位在箭头函数的正确位置
     */
    private getArrowFunctionStartPosition(node: ts.ArrowFunction, sourceFile: ts.SourceFile): number {
        if (node.parent && ts.isPropertyAssignment(node.parent)) {
            // 返回属性名的位置，而不是箭头函数的位置
            return node.parent.name.getStart(sourceFile);
        }

        // 尝试定位箭头符号
        const arrowToken = node.getChildren(sourceFile).find(child => child.kind === ts.SyntaxKind.EqualsGreaterThanToken);
        if (arrowToken) {
            // 找到箭头位置，返回箭头位置
            return arrowToken.getStart(sourceFile);
        }

        // 如果找不到箭头符号，回退到整个函数的起始位置
        return node.getStart(sourceFile);
    }

    /**
     * 获取函数声明的起始位置
     * 对于异步函数，返回async关键字的位置而不是function关键字
     */
    private getFunctionKeywordPosition(node: ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration, sourceFile: ts.SourceFile): number {
        // 检查是否是异步函数
        const isAsync = node.modifiers && node.modifiers.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword);

        if (isAsync) {
            // 对于异步函数，尝试定位async关键字
            const asyncKeyword = node.modifiers.find(mod => mod.kind === ts.SyntaxKind.AsyncKeyword);
            if (asyncKeyword) {
                return asyncKeyword.getStart(sourceFile);
            }
        }

        // 对于非异步函数或找不到async关键字的情况，尝试定位function关键字
        const functionKeyword = node.getChildren(sourceFile).find(child => child.kind === ts.SyntaxKind.FunctionKeyword);
        if (functionKeyword) {
            return functionKeyword.getStart(sourceFile);
        }

        // 如果找不到关键字，回退到整个函数的起始位置
        return node.getStart(sourceFile);
    }

    /**
     * 获取方法名的位置
     * 这个函数用于确保问题点定位在方法名位置，而不是整个方法声明的起始位置
     */
    private getMethodNamePosition(node: ts.MethodDeclaration, sourceFile: ts.SourceFile): number {
        // 尝试获取方法名
        if (node.name) {
            // 返回方法名的起始位置
            return node.name.getStart(sourceFile);
        }

        // 如果找不到方法名，回退到整个方法声明的起始位置
        return node.getStart(sourceFile);
    }

    private isInTypedObjectLiteral(objectLiteral: ts.ObjectLiteralExpression): boolean {
        // 获取对象字面量的父节点
        const objectParent = objectLiteral.parent;
        if (this.isInTypedObjectParent(objectLiteral, objectParent)) {
            return true; // 不需要报错
        }


        // 情况4: 对象字面量是数组元素 - 检查数组是否有类型
        if (objectParent && ts.isArrayLiteralExpression(objectParent)) {
            // 获取数组的父节点
            const arrayParent = objectParent.parent;

            // 如果数组是变量声明的一部分且有类型注解
            if (arrayParent && ts.isVariableDeclaration(arrayParent) && arrayParent.type) {
                return true; // 不需要报错
            }

            // 检查数组是否在导出语句中
            if (arrayParent && this.isInTypedObjectVariableDeclaration(arrayParent)) {
                return true; // 不需要报错
            }
        }

        // 检查导出语句
        if (objectParent && ts.isVariableStatement(objectParent) &&
            objectParent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            // 检查导出语句中是否有类型注解
            const declarationList = objectParent.declarationList;
            if (declarationList && declarationList.declarations.length > 0) {
                const hasTypeAnnotation = declarationList.declarations.some(d => d.type !== undefined);
                if (hasTypeAnnotation) {
                    return true; // 不需要报错
                }
            }
        }
        // 递归检查父对象是否有类型上下文
        return this.isInTypedObject(objectLiteral);
    }

    private isInTypedObjectParent(objectLiteral: ts.ObjectLiteralExpression, objectParent: ts.Node): boolean {
        // 情况1: 对象字面量是类型断言的一部分
        if (objectParent && (ts.isAsExpression(objectParent) || ts.isTypeAssertionExpression(objectParent))) {
            return true; // 不需要报错
        }

        // 情况2: 对象字面量是一个有类型注解的变量声明的初始化表达式 
        if (objectParent && ts.isVariableDeclaration(objectParent) && objectParent.type) {
            return true; // 不需要报错
        }

        // 情况3: 对象字面量是函数调用的参数
        if (objectParent && ts.isCallExpression(objectParent) &&
            objectParent.arguments.includes(objectLiteral)) {
            return true; // 不需要报错
        }
        return false;
    }

    private isInTypedObjectVariableDeclaration(arrayParent: ts.Node): boolean {
        let current = arrayParent;
        while (current) {
            // 如果是变量声明且有类型
            if (ts.isVariableDeclaration(current) && current.type) {
                return true; // 不需要报错
            }
            if (this.isInTypedObjectVariableStatement(current)) {
                return true; // 不需要报错
            }
            current = current.parent;
        }
        return false;
    }

    private isInTypedObjectVariableStatement(current: ts.Node): boolean {
        // 如果是导出声明
        if (ts.isVariableStatement(current) &&
            current.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            // 检查导出语句中是否有类型注解
            const declarationList = current.declarationList;
            if (declarationList && declarationList.declarations.length > 0) {
                const hasTypeAnnotation = declarationList.declarations.some(d => d.type !== undefined);
                if (hasTypeAnnotation) {
                    return true; // 不需要报错
                }
            }
        }
        return false;
    }

    private isInTypedObject(node: ts.ArrowFunction | ts.PropertyAssignment | ts.ObjectLiteralExpression): boolean {
        let parent = node.parent;

        // 处理属性赋值
        if (parent && ts.isPropertyAssignment(parent)) {
            // 获取对象字面量
            const objectLiteral = parent.parent;
            if (objectLiteral && ts.isObjectLiteralExpression(objectLiteral)) {
                if (this.isInTypedObjectLiteral(objectLiteral)) {
                    return true;
                }
            }
        }

        // 如果当前节点是对象字面量，检查其父节点
        if (parent && ts.isObjectLiteralExpression(parent)) {
            // 检查对象字面量的父节点
            const grandParent = parent.parent;

            // 如果对象字面量是属性赋值的值部分
            if (grandParent && ts.isPropertyAssignment(grandParent)) {
                // 递归检查包含该属性的对象
                return this.isInTypedObject(grandParent);
            }

            // 如果对象字面量是类型断言的一部分
            if (grandParent && (ts.isAsExpression(grandParent) || ts.isTypeAssertionExpression(grandParent))) {
                return true;
            }

            // 如果对象字面量是变量声明的一部分
            if (grandParent && ts.isVariableDeclaration(grandParent) && grandParent.type) {
                return true;
            }

            // 如果对象字面量是导出语句的一部分
            if (this.isInTypedObjectGrandParent(grandParent)) {
                return true; // 不需要报错
            }
        }
        return false;
    }

    private isInTypedObjectGrandParent(grandParent: ts.Node): boolean {
        if (grandParent && ts.isVariableStatement(grandParent) &&
            grandParent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            // 检查导出语句中是否有类型注解
            const declarationList = grandParent.declarationList;
            if (declarationList && declarationList.declarations.length > 0) {
                const hasTypeAnnotation = declarationList.declarations.some(d => d.type !== undefined);
                if (hasTypeAnnotation) {
                    return true; // 不需要报错
                }
            }
        }
        return false;
    }

    /**
     * 检查对象属性中的箭头函数
     * 只有当箭头函数在有类型的对象中时，才不需要报错
     */
    private isObjectPropertyArrowFunction(node: ts.ArrowFunction): boolean {
        // 首先检查是否在属性赋值中
        if (node.parent && ts.isPropertyAssignment(node.parent)) {
            return this.isInTypedObject(node);
        }

        // 处理更复杂的对象属性情况
        let parent = node.parent;
        while (parent) {
            // 处理可能的中间层级节点
            if (ts.isPropertyAssignment(parent)) {
                return this.isInTypedObject(parent);
            }

            // 处理方法中的箭头函数
            if (ts.isMethodDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isFunctionDeclaration(parent)) {
                return true; // 在方法或函数内部，不报错
            }

            parent = parent.parent;
        }

        return false;
    }

    /**
     * 检查方法是否为抽象方法
     */
    private isAbstractMethod(node: ts.MethodDeclaration | ts.FunctionDeclaration): boolean {
        // 检查方法是否有abstract修饰符
        if (node.modifiers) {
            return node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword);
        }
        return false;
    }

    /**
       * 检查父类是否是declare abstract class
       */
    private isParentDeclarativeAbstractClass(node: ts.MethodDeclaration): boolean {
        const parent = node.parent;
        if (parent && ts.isClassDeclaration(parent)) {
            // 检查类是否同时有declare和abstract修饰符
            if (parent.modifiers) {
                const hasDeclare = parent.modifiers.some(
                    modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword
                );
                const hasAbstract = parent.modifiers.some(
                    modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword
                );
                return hasDeclare && hasAbstract;
            }
        }
        return false;
    }

    /**
     * 检查函数声明是否只有声明而没有函数体
     */
    private isFunctionDeclarationWithoutBody(node: ts.FunctionDeclaration): boolean {
        // 检查是否有分号结尾的函数声明（无函数体）
        return !node.body;
    }

    /**
     * 检查函数是否有泛型参数且应该忽略返回类型检查
     * 类方法的泛型参数不应该忽略返回类型检查
     */
    private hasFunctionTypeParameters(node: ts.Node): boolean {
        // 检查是否是方法声明
        if (ts.isMethodDeclaration(node)) {
            // 类方法即使有泛型参数也应该有返回类型
            // 检查父节点是否是类声明或类表达式
            if (node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent))) {
                return false; // 类方法需要返回类型，不管是否有泛型参数
            }
        }

        // 对于其他函数（非类方法）
        if (ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node) ||
            ts.isMethodDeclaration(node)) {

            // 检查函数是否有类型参数（泛型参数）
            return node.typeParameters !== undefined && node.typeParameters.length > 0;
        }

        return false;
    }

    /**
     * 检查节点是否在 Promise 构造函数中
     */
    private isInPromiseContext(node: ts.Node): boolean {
        let current: ts.Node | undefined = node;

        while (current) {
            // 检查是否是 new Promise(...) 调用
            if (ts.isNewExpression(current)) {
                const expression = current.expression;
                if (ts.isIdentifier(expression) && expression.text === 'Promise') {
                    return true;
                }
            }

            // 访问父节点
            current = current.parent;
        }

        return false;
    }

    /**
     * 检查是否是立即执行的函数表达式 (IIFE)
     */
    private isImmediatelyInvokedFunctionExpression(node: ts.FunctionExpression): boolean {
        const parent = node.parent;

        // 如果函数被立即调用
        if (parent && ts.isCallExpression(parent) && parent.expression === node) {
            return true;
        }

        // 如果函数被括号包裹并立即调用
        if (parent && ts.isParenthesizedExpression(parent)) {
            const grandParent = parent.parent;
            if (grandParent && ts.isCallExpression(grandParent) && grandParent.expression === parent) {
                return true;
            }
        }

        return false;
    }

    private checkArrowFunctionCurrentNode(currentNode: ts.Node): boolean {
        let isInTypedExport = false;
        if (ts.isVariableStatement(currentNode)) {
            if (currentNode.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                // 检查导出变量是否有类型注解
                const declarationList = currentNode.declarationList;
                if (declarationList && declarationList.declarations.length > 0) {
                    isInTypedExport = declarationList.declarations.some(d =>
                        d.type !== undefined ||
                        (d.initializer &&
                            (ts.isAsExpression(d.initializer) || ts.isTypeAssertionExpression(d.initializer)))
                    );
                }
            }
        }
        return isInTypedExport;
    }


    private checkArrowFunction(node: ts.ArrowFunction, sourceFile: ts.SourceFile, result: LocationInfo[]): boolean {
        // 检查对象属性中的箭头函数
        if (node.parent && ts.isPropertyAssignment(node.parent)) {
            // 只有当不在有类型的上下文中时才需要报错
            if (this.isObjectPropertyArrowFunction(node)) {
                return false;
            }
            // 检查是否在导出语句中
            let currentNode: ts.Node = node.parent;
            let isInTypedExport = false;

            while (currentNode && !isInTypedExport) {
                isInTypedExport = this.checkArrowFunctionCurrentNode(currentNode);

                currentNode = currentNode.parent;
            }

            if (isInTypedExport) {
                return true; // 在有类型的导出语句中，不报错
            }

            // 获取箭头函数的箭头位置
            const pos = this.getArrowFunctionStartPosition(node, sourceFile);
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
            result.push({
                fileName: sourceFile.fileName,
                line: line + 1,
                character: character + 1,
                description: 'Missing return type on function.',
            });
            return true; // 如果是对象属性箭头函数且已经处理，则直接返回
        }

        // 检查是否在对象属性中
        if (this.isObjectPropertyArrowFunction(node)) {
            return true;
        }

        if (this.shouldVariableArrowFunctionHaveType(node)) {
            // 如果是变量声明中的箭头函数，且变量没有类型注解，且函数本身也没有返回类型
            if (!node.type) {
                // 获取箭头函数的箭头位置
                const pos = this.getArrowFunctionStartPosition(node, sourceFile);
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
                result.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    character: character + 1,
                    description: 'Missing return type on function.',
                });
                return true;
            }
        }
        return false;
    }

    private checkMethodDeclaration(node: ts.MethodDeclaration, sourceFile: ts.SourceFile, result: LocationInfo[]): boolean {
        // 如果是抽象方法，不需要检查返回类型
        if (this.isAbstractMethod(node)) {
            return true;
        }

        // 检查方法是否在declare abstract class中
        const parent = node.parent;
        if (parent && ts.isClassDeclaration(parent)) {
            // 检查类是否有declare修饰符
            const isDeclare = parent.modifiers && parent.modifiers.some(
                modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword
            );
            // 如果是declare class中的方法，不需要报错
            if (isDeclare) {
                return true;
            }
        }

        // 只有当方法不在对象字面量中时才检查返回类型
        if (parent && (ts.isClassDeclaration(parent) || ts.isClassExpression(parent))) {
            if (this.checkNonAbstractMethod(node, sourceFile, result)) {
                return true;
            }
        } else if (parent && ts.isObjectLiteralExpression(parent)) {
            if (this.checkMethodDeclarationObjectLiteralExpression(node, parent, sourceFile, result)) {
                return true;
            }
        }
        // 如果是对象字面量中的方法
        if (parent && ts.isObjectLiteralExpression(parent)) {
            const grandParent = parent.parent;
            // 如果对象字面量是函数调用的参数
            if (grandParent && ts.isCallExpression(grandParent)) {
                return true;
            }
        }
        return false;
    }

    private checkNonAbstractMethod(node: ts.MethodDeclaration, sourceFile: ts.SourceFile, result: LocationInfo[]): boolean {
        // 检查方法是否有返回类型注解 (除构造函数外)
        if (this.shouldMethodHaveReturnType(node)) {
            // 如果方法没有函数体(仅声明)，不需要报错
            if (!node.body) {
                return true;
            }

            // 方法有泛型参数但没有返回类型，除非启用了allowFunctionsWithoutTypeParameters选项且方法有泛型参数，否则报错
            if (!(this.options.allowFunctionsWithoutTypeParameters && this.hasFunctionTypeParameters(node))) {

                // 获取方法名的位置
                const pos = this.getFunctionKeywordPosition(node, sourceFile);
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
                result.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    character: character + 1,
                    description: 'Missing return type on function.',
                });
            }
        }
        return false;
    }

    private checkMethodDeclarationObjectLiteralExpression(node: ts.MethodDeclaration, parent: ts.ObjectLiteralExpression,
        sourceFile: ts.SourceFile, result: LocationInfo[]): boolean {
        // 对于对象字面量中的方法，只有在没有作为函数参数时才检查
        const grandParent = parent.parent;
        if (!(grandParent && ts.isCallExpression(grandParent))) {
            if (this.shouldMethodHaveReturnType(node)) {
                // 如果方法没有函数体(仅声明)，不需要报错
                if (!node.body) {
                    return true;
                }

                // 获取方法名的位置
                const pos = this.getFunctionKeywordPosition(node, sourceFile);
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
                result.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    character: character + 1,
                    description: 'Missing return type on function.',
                });
            }
        }
        return true;
    }

    private isPartOfTypeAssertion(node: ts.Node): boolean {
        // 检查函数是否在作为类型断言的一部分，
        // 检查当前节点
        if (!node.parent) {
            return false;
        }

        // 直接是类型断言的表达式
        if (ts.isAsExpression(node.parent) || ts.isTypeAssertionExpression(node.parent)) {
            return true;
        }

        // 括号表达式内的函数
        if (ts.isParenthesizedExpression(node.parent)) {
            let current = node.parent;
            // 跟随括号表达式链
            while (current.parent && ts.isParenthesizedExpression(current.parent)) {
                current = current.parent;
            }

            // 检查最外层括号是否是类型断言的一部分
            return current.parent !== undefined &&
                (ts.isAsExpression(current.parent) || ts.isTypeAssertionExpression(current.parent));
        }

        return false;
    }

    /**
     * 添加问题报告。
     */
    private addIssue(node: ts.Node, sourceFile: ts.SourceFile, result: LocationInfo[]): void {
        let pos = node.getStart(sourceFile);

        // 对于箭头函数，使用箭头的位置
        if (ts.isArrowFunction(node)) {
            pos = this.getArrowFunctionStartPosition(node, sourceFile);
        }
        // 对于函数声明或表达式，使用function关键字的位置
        else if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
            pos = this.getFunctionKeywordPosition(node, sourceFile);
        }

        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        result.push({
            fileName: sourceFile.fileName,
            line: line + 1,
            character: character + 1,
            description: 'Missing return type on function.',
        });
    }


    private isHigherReturnsFunction(node: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration): boolean {
        // 检查函数体
        const body = node.body;
        if (!body) {
            return false;
        }
        let innerFunction: ts.FunctionExpression | ts.ArrowFunction | undefined;

        // 获取内层函数
        if (ts.isArrowFunction(node) && !ts.isBlock(body)) {
            if (ts.isFunctionExpression(body) || ts.isArrowFunction(body)) {
                innerFunction = body as ts.FunctionExpression | ts.ArrowFunction;
            }
        } else if (ts.isBlock(body) && body.statements.length === 1) {
            const statement = body.statements[0];
            if (ts.isReturnStatement(statement) && statement.expression &&
                (ts.isFunctionExpression(statement.expression) || ts.isArrowFunction(statement.expression))) {
                innerFunction = statement.expression as ts.FunctionExpression | ts.ArrowFunction;
            }
        }

        // 如果内层函数没有返回类型，且不是泛型函数，需要报错
        if (innerFunction && !innerFunction.type) {
            // 如果内层函数有泛型参数且设置了allowFunctionsWithoutTypeParameters选项，则不报错
            if (this.options.allowFunctionsWithoutTypeParameters &&
                innerFunction.typeParameters &&
                innerFunction.typeParameters.length > 0) {
                return true;
            }

            // 如果外层函数有函数类型的返回类型，内层函数不需要显式返回类型
            if (node.type) {
                return true;
            }
            return false; // 内层函数没有返回类型，需要报错
        }
        return true; // 内层函数有返回类型或是泛型函数，不需要报错
    }
    /**
     * 检查节点是否是高阶函数（立即返回另一个函数表达式的函数）
     */
    private isHigherOrderFunction(node: ts.Node): boolean {
        if (!(ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))) {
            return false;
        }

        // 如果是高阶函数，那么即使外层函数是泛型函数，内层函数仍然需要检查返回类型
        if (this.returnsFunction(node)) {
            return this.isHigherReturnsFunction(node);
        }

        return false; // 不是高阶函数
    }

    private returnsFunction(node: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration): boolean {
        const body = node.body;
        if (!body) {
            return false;
        }
        // 检查函数是否只是返回另一个函数
        if (ts.isArrowFunction(node) && !ts.isBlock(body)) {
            return ts.isFunctionExpression(body) || ts.isArrowFunction(body);
        }

        // 如果是代码块，检查是否只有一个return语句
        if (ts.isBlock(body) && body.statements.length === 1) {
            const statement = body.statements[0];
            if (ts.isReturnStatement(statement) && statement.expression) {
                return ts.isFunctionExpression(statement.expression) ||
                    ts.isArrowFunction(statement.expression);
            }
        }

        return false;
    }

    /**
     * 检查函数是否通过bind、call或apply绑定了this
     */
    private isThisBindingFunction(node: ts.Node): boolean {
        // 检查父节点是否是调用表达式，且调用的是bind、call或apply方法
        if (node.parent && ts.isCallExpression(node.parent)) {
            if (ts.isPropertyAccessExpression(node.parent.expression)) {
                const methodName = node.parent.expression.name.text;
                // 检查是否是通过bind、call或apply绑定this
                if (methodName === 'bind' || methodName === 'call' || methodName === 'apply') {
                    // 确保属性访问的左侧是当前函数
                    return node.parent.expression.expression === node;
                }
            }
        }
        return false;
    }

    /**
     * 检查函数表达式是否有类型注解或是否在不需要类型注解的上下文中
     */
    private isTypedFunctionExpression(node: ts.FunctionExpression | ts.ArrowFunction): boolean {
        // 检查函数是否通过bind、call或apply绑定了this
        if (this.isThisBindingFunction(node)) {
            return true;
        }

        // 检查父节点
        const parent = node.parent;
        if (!parent) {
            return false;
        }

        // 对于变量声明，必须有类型注解
        if (ts.isVariableDeclaration(parent)) {
            // 只有当变量声明本身有类型注解时才认为函数是有类型的
            return parent.type !== undefined;
        }

        // 检查类型断言表达式
        if (ts.isAsExpression(parent) || ts.isTypeAssertionExpression(parent)) {
            return true;
        }

        // 检查属性赋值 - 特别处理作为对象属性的函数
        if (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) {
            if (this.checkProperty(parent)) {
                return true;
            }
        }

        // 检查函数参数 - 支持作为函数调用的参数
        if (ts.isCallExpression(parent) && parent.arguments && parent.arguments.includes(node as ts.Expression)) {
            return true;
        }

        // 检查构造函数参数 - 支持作为构造函数的参数
        if (ts.isNewExpression(parent) && parent.arguments && parent.arguments.includes(node as ts.Expression)) {
            return true;
        }

        // 检查变量声明中的初始化表达式是否在类型断言中
        if (ts.isParenthesizedExpression(parent)) {
            if (this.checkParenthesized(parent)) {
                return true;
            }
        }

        // 检查函数是否直接作为构造函数表达式
        if (parent && ts.isNewExpression(parent) && parent.expression === node) {
            return true;
        }

        return false;
    }

    private checkProperty(parent: ts.PropertyAssignment | ts.PropertyDeclaration): boolean {
        // 检查是否是作为对象字面量属性传递给函数调用的情况
        if (ts.isPropertyAssignment(parent)) {
            let objectLiteral = parent.parent;
            if (objectLiteral && ts.isObjectLiteralExpression(objectLiteral)) {
                // 检查对象字面量是否作为参数传递给函数
                const objectParent = objectLiteral.parent;
                if (objectParent && ts.isCallExpression(objectParent)) {
                    return true;
                }
            }
        }

        // 检查对象字面量是否有类型
        let objectLiteral: ts.Node | undefined = parent.parent;
        while (objectLiteral) {
            if (ts.isObjectLiteralExpression(objectLiteral)) {
                const objectParent = objectLiteral.parent;
                if (objectParent && ts.isVariableDeclaration(objectParent) && objectParent.type) {
                    return true;
                }
                if (objectParent && (ts.isAsExpression(objectParent) || ts.isTypeAssertionExpression(objectParent))) {
                    return true;
                }
            }
            objectLiteral = objectLiteral.parent;
        }
        return false;
    }

    private checkParenthesized(parent: ts.ParenthesizedExpression): boolean {
        let current = parent;
        // 跟随括号表达式链
        while (current.parent && ts.isParenthesizedExpression(current.parent)) {
            current = current.parent;
        }

        // 检查最外层括号是否是类型断言的一部分
        if (current.parent && (ts.isAsExpression(current.parent) || ts.isTypeAssertionExpression(current.parent))) {
            return true;
        }

        // 检查最外层括号是否作为函数调用的参数
        if (current.parent && ts.isCallExpression(current.parent) &&
            current.parent.arguments && current.parent.arguments.includes(current as ts.Expression)) {
            return true;
        }

        // 检查最外层括号是否作为构造函数的参数
        if (current.parent && ts.isNewExpression(current.parent) &&
            current.parent.arguments && current.parent.arguments.includes(current as ts.Expression)) {
            return true;
        }

        // 检查最外层括号是否是构造函数表达式本身
        if (current.parent && ts.isNewExpression(current.parent) &&
            current.parent.expression === current) {
            return true;
        }
        return false;
    }

    /**
     * 检查祖先节点是否有返回类型
     */
    private ancestorHasReturnType(node: ts.Node): boolean {
        let ancestor = node.parent;

        // 如果函数在return语句中，查找外层函数的返回类型
        if (ancestor && ts.isReturnStatement(ancestor)) {
            if (this.ancestorReturnStatement(ancestor)) {
                return true;
            }
        }

        // 检查变量声明
        if (ancestor && ts.isVariableDeclaration(ancestor)) {
            return ancestor.type !== undefined;
        }

        return false;
    }

    private ancestorReturnStatement(ancestor: ts.Node): boolean {
        let functionAncestor = ancestor.parent;
        while (functionAncestor) {
            if (ts.isBlock(functionAncestor)) {
                functionAncestor = functionAncestor.parent;
            } else if (ts.isFunctionDeclaration(functionAncestor) ||
                ts.isFunctionExpression(functionAncestor) ||
                ts.isArrowFunction(functionAncestor)) {
                // 检查外层函数是否有返回类型
                return functionAncestor.type !== undefined;
            } else {
                break;
            }
        }
        return false;
    }

    /**
     * 获取 getter 方法名称的位置
     */
    private getGetAccessorNamePosition(node: ts.GetAccessorDeclaration): number {
        return node.getStart();
    }

    
    /**
     * 检查节点是否使用了as const断言
     */
    private hasConstAssertion(node: ts.Node): boolean {
        if (!ts.isArrowFunction(node)) {
            return false;
        }
        const body = node.body;
        // 直接的类型断言
        if (ts.isAsExpression(body)) {
            const typeNode = body.type;
            if (typeNode && ts.isTypeReferenceNode(typeNode)) {
                const typeName = typeNode.typeName;
                if (ts.isIdentifier(typeName) && typeName.text === 'const') {
                    return true;
                }
            }
        }
        return false;
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

