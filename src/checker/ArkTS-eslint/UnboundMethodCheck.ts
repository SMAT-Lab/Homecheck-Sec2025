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
    ArkFile,
    AstTreeUtils,
    ts,
} from 'arkanalyzer';
import { Rule } from '../../Index';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects } from '../../Index';
import {
    FileMatcher,
    MatcherCallback,
    MatcherTypes,
} from '../../Index';
import { IssueReport } from '../../model/Defects';
import { RuleListUtil } from '../../utils/common/DefectsList';
type Options = [
    {
        ignoreStatic: boolean;
    }
];
interface ErrorReport {
    line: number;
    character: number;
    endCol: number;
    message: string;
}
export class UnboundMethodCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public sourceFile: ts.SourceFile;
    private currentClassName: string | null = null; // 新增：记录当前遍历的类名
    private promiseTemArray: Array<string> = ['all', 'resolve', 'reject', 'race', 'allSettled', 'any'];
    private defaultOptions: Options = [
        {
            ignoreStatic: false,
        }
    ];
    private messageStr = 'Avoid referencing unbound methods which may cause unintentional scoping of `this`.\nIf your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead.';
    private shortMessageStr = 'Avoid referencing unbound methods which may cause unintentional scoping of `this`.';
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/unbound-method.md',
        description:
            'Avoid referencing unbound methods which may cause unintentional scoping of `this`.\nIf your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead.',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchFileCb];
    }

    public check = (targetField: ArkFile): void => {
        this.defaultOptions = this.rule && this.rule.option && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = targetField.getFilePath();
        const myInvalidPositions = this.checkUnboundMethod(targetField, this.defaultOptions[0]);
        myInvalidPositions.forEach(pos => {
            this.addIssueReport(filePath, pos, severity);
        });
    };

    private addIssueReport(filePath: string, pos: ErrorReport, severity: number): void {
        const defect = new Defects(
            pos.line,
            pos.character,
            pos.endCol,
            pos.message,
            severity,
            this.rule.ruleId,
            filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            false
        );
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    // 对错误位置进行排序并去重
    private sortMyInvalidPositions(myInvalidPositions: ErrorReport[]): ErrorReport[] {
        // 1. 先进行排序
        myInvalidPositions.sort((a, b) => a.line - b.line || a.character - b.character);
        // 2. 使用 reduce 进行去重
        const uniqueArrays = myInvalidPositions.reduce((acc, current) => {
            const lastItem = acc[acc.length - 1];
            // 检查是否与最后一个元素的三要素相同
            if (!lastItem ||
                lastItem.line !== current.line ||
                lastItem.character !== current.character ||
                lastItem.message !== current.message) {
                acc.push(current);
            }
            return acc;
        }, [] as typeof myInvalidPositions);

        return uniqueArrays;
    }

    private checkUnboundMethod(targetField: ArkFile, options: Options[0]): ErrorReport[] {
        this.sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        const errors: ErrorReport[] = [];
        // 1. 收集代码中的各种信息
        const variableToClassName = this.collectVariableToClassMapping(this.sourceFile);
        const objectMethodInfo = this.collectObjectMethodInfo(this.sourceFile);
        const classMethodInfo = this.collectClassMethodInfo(this.sourceFile);
        // 2. 检查未绑定方法使用
        this.findUnboundMethodReferences(
            this.sourceFile,
            variableToClassName,
            classMethodInfo,
            objectMethodInfo,
            options,
            errors
        );
        return errors;
    }

    // 收集变量名到类名的映射关系
    private collectVariableToClassMapping(sourceFile: ts.SourceFile): Map<string, string> {
        const variableToClassName = new Map<string, string>();
        const visitor = (node: ts.Node): void => {
            if (ts.isVariableDeclaration(node) && node.initializer && ts.isNewExpression(node.initializer)) {
                const className = node.initializer.expression.getText(this.sourceFile);
                const varName = node.name.getText();
                variableToClassName.set(varName, className);
            }
            ts.forEachChild(node, visitor);
        };
        ts.forEachChild(sourceFile, visitor);
        return variableToClassName;
    }

    // 收集对象字面量中的方法信息
    private collectObjectMethodInfo(sourceFile: ts.SourceFile): Map<string, { usesThis: boolean; hasThisVoid: boolean }> {
        const objectMethodInfo = new Map<string, { usesThis: boolean; hasThisVoid: boolean }>();
        const visitor = (node: ts.Node): void => {
            if (ts.isVariableDeclaration(node) &&
                node.initializer &&
                ts.isObjectLiteralExpression(node.initializer)) {

                const varName = node.name.getText();
                this.processObjectProperties(node.initializer.properties, varName, objectMethodInfo);
            }
            ts.forEachChild(node, visitor);
        };
        ts.forEachChild(sourceFile, visitor);
        return objectMethodInfo;
    }

    // 处理对象字面量中的属性
    private processObjectProperties(
        properties: ts.NodeArray<ts.ObjectLiteralElementLike>,
        varName: string,
        objectMethodInfo: Map<string, { usesThis: boolean; hasThisVoid: boolean }>
    ): void {
        properties.forEach(prop => {
            if (!this.isMethodLikeProperty(prop)) {
                return;
            }
            const methodName = prop.name?.getText(this.sourceFile);
            if (!methodName) {
                return;
            }
            const key = `${varName}.${methodName}`;
            const usesThis = this.isMethodDeclarationLike(prop) ? this.checkThisUsage(prop as ts.MethodDeclaration) : false;
            const hasThisVoid = this.isMethodDeclarationLike(prop) ? this.checkThisVoidAnnotation(prop as ts.MethodDeclaration) : false;
            objectMethodInfo.set(key, { usesThis, hasThisVoid });
        });
    }

    // 判断属性是否是方法或函数表达式
    private isMethodLikeProperty(prop: ts.ObjectLiteralElementLike): boolean {
        return ts.isMethodDeclaration(prop) ||
            (ts.isPropertyAssignment(prop) &&
                prop.initializer &&
                ts.isFunctionExpression(prop.initializer));
    }

    // 判断属性是否是方法声明或类似节点
    private isMethodDeclarationLike(prop: ts.ObjectLiteralElementLike): boolean {
        return ts.isMethodDeclaration(prop) || ts.isPropertyDeclaration(prop);
    }

    // 收集类方法信息
    private collectClassMethodInfo(sourceFile: ts.SourceFile): Map<string, {
        isStatic: boolean;
        usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean
    }> {
        const classMethodInfo = new Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>();
        const visitor = (node: ts.Node): void => {
            if (ts.isClassDeclaration(node) && node.name) {
                const className = node.name.getText();
                this.processClassMembers(node, classMethodInfo);
                // 为每个类的prototype也添加相同的方法信息
                node.members.forEach(member => {
                    if (!ts.isMethodDeclaration(member) && !ts.isPropertyDeclaration(member)) {
                        return;
                    }
                    const methodName = member.name?.getText(this.sourceFile);
                    if (!methodName) {
                        return;
                    }
                    const isStatic = !!member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
                    const usesThis = this.checkThisUsage(member);
                    const hasThisVoid = this.checkThisVoidAnnotation(member);
                    // 计算isArrowFunc
                    const isArrowFunc = ts.isPropertyDeclaration(member) &&
                        !!member.initializer &&
                        ts.isArrowFunction(member.initializer);
                    // 为prototype添加方法信息
                    const prototypeKey = `${className}.prototype.${methodName}`;
                    classMethodInfo.set(prototypeKey, { isStatic, usesThis, hasThisVoid, isArrowFunc });
                });
            }
            ts.forEachChild(node, visitor);
        };
        ts.forEachChild(sourceFile, visitor);
        return classMethodInfo;
    }

    // 修改processClassMembers方法
    private processClassMembers(
        classNode: ts.ClassDeclaration,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>
    ): void {
        const className = classNode.name?.getText() || '';
        classNode.members.forEach(member => {
            // 只处理方法声明或箭头函数属性
            if (ts.isMethodDeclaration(member)) {
                // 处理方法
                const methodName = member.name.getText(this.sourceFile);
                const isStatic = !!member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
                const usesThis = this.checkThisUsage(member);
                const hasThisVoid = this.checkThisVoidAnnotation(member);
                const key = `${className}.${methodName}`;
                classMethodInfo.set(key, { isStatic, usesThis, hasThisVoid, isArrowFunc: false });
            } else if (ts.isPropertyDeclaration(member)) {
                // 处理属性
                const methodName = member.name.getText(this.sourceFile);
                const isStatic = !!member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
                
                // 检查是否是箭头函数属性
                const isArrowFunc = member.initializer && ts.isArrowFunction(member.initializer);
                
                // 检查是否是传统函数表达式属性
                const isFunctionExpr = member.initializer && ts.isFunctionExpression(member.initializer);
                
                // 处理箭头函数和传统函数表达式
                if (isArrowFunc || isFunctionExpr) {
                    const usesThis = this.checkThisUsage(member);
                    const hasThisVoid = this.checkThisVoidAnnotation(member);
                    const key = `${className}.${methodName}`;
                    classMethodInfo.set(key, { 
                        isStatic, 
                        usesThis, 
                        hasThisVoid, 
                        isArrowFunc: !!isArrowFunc // 确保是布尔值类型
                    });
                }
            }
        });
    }

    // 查找未绑定的方法引用
    private findUnboundMethodReferences(
        sourceFile: ts.SourceFile,
        variableToClassName: Map<string, string>,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>,
        objectMethodInfo: Map<string, { usesThis: boolean; hasThisVoid: boolean }>,
        options: Options[0],
        errors: ErrorReport[]
    ): void {
        // 1. 收集所有定义的类名
        const definedClasses = this.collectDefinedClasses(sourceFile);
        // 2. 遍历AST查找未绑定方法引用
        const visitor = (node: ts.Node): void => {
            // 进入类声明时记录类名
            if (ts.isClassDeclaration(node) && node.name) {
                const prevClassName = this.currentClassName;
                this.currentClassName = node.name.getText(); // 设置当前类名
                ts.forEachChild(node, visitor);
                this.currentClassName = prevClassName; // 恢复上一层类名
                return;
            }
            this.processNode(node, definedClasses, variableToClassName, classMethodInfo, objectMethodInfo, options, errors);
            ts.forEachChild(node, visitor);
        };
        ts.forEachChild(sourceFile, visitor);
    }

    // 收集定义的类名
    private collectDefinedClasses(sourceFile: ts.SourceFile): Set<string> {
        const definedClasses = new Set<string>();
        const visitor = (node: ts.Node): void => {
            if (ts.isClassDeclaration(node) && node.name) {
                definedClasses.add(node.name.getText());
            }
            ts.forEachChild(node, visitor);
        };
        ts.forEachChild(sourceFile, visitor);
        return definedClasses;
    }

    // 处理单个节点
    private processNode(
        node: ts.Node,
        definedClasses: Set<string>,
        variableToClassName: Map<string, string>,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>,
        objectMethodInfo: Map<string, { usesThis: boolean; hasThisVoid: boolean }>,
        options: Options[0],
        errors: ErrorReport[]
    ): void {
        // 检查属性访问 (instance.method)
        if (ts.isPropertyAccessExpression(node)) {
            this.processPropertyAccessExpression(
                node, definedClasses, variableToClassName, classMethodInfo, options, errors
            );
        }
        // 检查对象解构 (const {method} = instance)
        else if (ts.isObjectBindingPattern(node)) {
            this.checkObjectDestructuring(node, objectMethodInfo, classMethodInfo, errors);
        }
        // 检查赋值表达式 ({ method } = instance)
        else if (ts.isParenthesizedExpression(node)) {
            this.checkAssignmentExpression(node, objectMethodInfo, classMethodInfo, errors);
        }
    }

    // 处理属性访问表达式
    private processPropertyAccessExpression(
        node: ts.PropertyAccessExpression,
        definedClasses: Set<string>,
        variableToClassName: Map<string, string>,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>,
        options: Options[0],
        errors: ErrorReport[]
    ): void {
        // 新增：检查是否包含可选链或括号表达式
        if (this.containsOptionalChainOrParenthesized(node)) {
            return; // 直接跳过包含可选链或复杂括号表达式的情况
        }
        const expressionText = node.expression.getText();
        const methodName = node.name.getText();
        // 新增：检查是否是嵌套属性访问
        if (this.isNestedPropertyAccess(node)) {
            // 只处理显式声明为方法的嵌套属性访问
            // 例如，对于 obj.prop.subprop，只有当 subprop 确实是方法时才处理
            if (!this.isExplicitlyDeclaredAsMethod(node)) {
                return;
            }
        }
        // 情况1: 类的静态方法访问 (Class.method)
        if (this.isClassStaticMethodAccess(node, expressionText, definedClasses)) {
            this.handleStaticMethodAccess(node, expressionText, methodName, options, errors);
        }
        // 情况2: 类实例方法访问 (new Class().method)
        else if (this.isNewInstanceMethodAccess(node, expressionText, definedClasses)) {
            this.handleInstanceMethodAccess(node, errors);
        }
        // 情况3: 普通实例方法访问 (instance.method)
        else {
            this.checkPropertyAccess(node, variableToClassName, classMethodInfo, options, errors);
        }
    }

    // 检查是否是嵌套属性访问 (a.b.c)
    private isNestedPropertyAccess(node: ts.PropertyAccessExpression): boolean {
        return ts.isPropertyAccessExpression(node.expression);
    }

    // 检查属性是否显式声明为方法
    private isExplicitlyDeclaredAsMethod(node: ts.PropertyAccessExpression): boolean {
        // 获取最深层级的属性名
        const propertyName = node.name.getText();
        // 检查是否有类型声明信息
        if (node.parent && ts.isVariableDeclaration(node.parent)) {
            // 获取代码的文本内容
            const sourceCode = this.sourceFile.getFullText();
            // 查找是否有类型声明包含该属性为函数或方法
            // 例如: declare const obj: { prop: { method: () => void } };
            const methodTypePattern = new RegExp(`${propertyName}\\s*:\\s*\\(.*\\)\\s*=>`);
            const functionTypePattern = new RegExp(`${propertyName}\\s*:\\s*function`);
            if (methodTypePattern.test(sourceCode) || functionTypePattern.test(sourceCode)) {
                return true; // 显式声明为方法
            }
            // 检查对应声明中是否包含这个属性名作为方法
            // 尝试查找"method: function" 或 "method() {" 模式
            const methodPattern1 = new RegExp(`${propertyName}\\s*:\\s*function`);
            const methodPattern2 = new RegExp(`${propertyName}\\s*\\(`);
            if (methodPattern1.test(sourceCode) || methodPattern2.test(sourceCode)) {
                return true; // 可能是方法声明
            }
        }
        // 检查直接使用模式
        const directCallPattern = new RegExp(`\\.${propertyName}\\(`);
        if (directCallPattern.test(this.sourceFile.getFullText())) {
            // 如果在代码中有直接调用，如 obj.method()，则认为是方法
            return true;
        }
        // 默认情况下，在多级属性访问中，假设这不是方法引用
        return false;
    }

    // 判断是否是类的静态方法访问
    private isClassStaticMethodAccess(
        node: ts.PropertyAccessExpression,
        expressionText: string,
        definedClasses: Set<string>
    ): boolean {
        return ts.isIdentifier(node.expression) && definedClasses.has(expressionText);
    }

    // 处理静态方法访问
    private handleStaticMethodAccess(
        node: ts.PropertyAccessExpression,
        expressionText: string,
        methodName: string,
        options: Options[0],
        errors: ErrorReport[]
    ): void {
        // 检查是否是静态方法访问
        const isStaticMethodAccess = this.isStaticMethodAccess(node, expressionText, methodName);
        if (isStaticMethodAccess && !options.ignoreStatic) {
            const sourcePos = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
            errors.push({
                line: sourcePos.line + 1,
                character: sourcePos.character + 1,
                endCol: sourcePos.character + node.getText().length + 1,
                message: this.messageStr
            });
        }
    }

    // 判断是否是new实例的方法访问
    private isNewInstanceMethodAccess(
        node: ts.PropertyAccessExpression,
        expressionText: string,
        definedClasses: Set<string>
    ): boolean {
        if (!expressionText.startsWith('new ') || !expressionText.includes('(')) {
            return false;
        }
        const match = /new\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(expressionText);
        return !!(match && match[1] && definedClasses.has(match[1]));
    }

    // 处理实例方法访问
    private handleInstanceMethodAccess(
        node: ts.PropertyAccessExpression,
        errors: ErrorReport[]
    ): void {
        // 检查是否直接在实例上调用方法，这种情况不应报错
        if (this.isDirectMethodCall(node)) {
            return;
        }
        const sourcePos = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        // 判断是否是函数表达式属性
        const isFunctionExpression = this.isPropertyAccessToFunctionExpression(node);
        errors.push({
            line: sourcePos.line + 1,
            character: sourcePos.character + 1,
            endCol: sourcePos.character + node.getText().length + 1,
            message: isFunctionExpression ? this.shortMessageStr : this.messageStr
        });
    }

    // 检查是否是直接在实例上调用的方法
    private isDirectMethodCall(node: ts.PropertyAccessExpression): boolean {
        // 检查父节点是否是函数调用表达式，并且当前节点是被调用函数
        if (ts.isCallExpression(node.parent) && node.parent.expression === node) {
            return true; // 例如: new MineB().reduce(...) 或 obj.method()
        }
        return false;
    }

    // 判断是否是静态方法访问
    private isStaticMethodAccess(
        node: ts.PropertyAccessExpression,
        className: string,
        methodName: string
    ): boolean {
        // 以下情况不视为静态方法访问，直接返回false
        if (
            // 访问prototype属性
            methodName === 'prototype' ||
            // 计算属性名中使用的静态方法
            this.isInComputedPropertyName(node) ||
            // 静态箭头函数属性
            this.isStaticArrowFunctionProperty(className, methodName) ||
            // Promise继承的静态方法
            this.isInheritedStaticMethod(node, className, methodName) ||
            // 在extends子句中
            this.isInExtendsClause(node) ||
            // 静态方法内部访问静态属性
            this.isStaticPropertyInStaticMethod(node) ||
            // 静态方法内部调用其他静态方法
            this.isStaticMethodCallInStaticMethod(node) ||
            // 对象字面量或解构赋值中
            this.isInObjectLiteralOrDestructuring(node.parent) ||
            // 在prototype访问链中
            this.isInPrototypeChain(node)
        ) {
            return false;
        }

        return true;
    }

    // 检查是否在extends子句中
    private isInExtendsClause(node: ts.Node): boolean {
        let currentNode: ts.Node = node;
        while (currentNode && currentNode.parent) {
            if (currentNode.parent.kind === ts.SyntaxKind.HeritageClause &&
                (currentNode.parent as ts.HeritageClause).token === ts.SyntaxKind.ExtendsKeyword) {
                return true;
            }
            currentNode = currentNode.parent;
        }
        return false;
    }

    // 检查是否是静态方法内部访问静态属性
    private isStaticPropertyInStaticMethod(node: ts.PropertyAccessExpression): boolean {
        if (!ts.isIdentifier(node.expression)) {
            return false;
        }

        // 检查是否在静态方法内部
        let isInStaticMethod = false;
        let currentMethod: ts.Node = node;
        while (currentMethod && currentMethod.parent) {
            if (ts.isMethodDeclaration(currentMethod) &&
                currentMethod.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)) {
                isInStaticMethod = true;
                break;
            }
            currentMethod = currentMethod.parent;
        }

        if (!isInStaticMethod) {
            return false;
        }

        // 检查是否是方法调用表达式
        if (ts.isCallExpression(node.parent) && node.parent.expression === node) {
            // 在静态方法内部对其他静态方法的调用，应返回true表示这不是未绑定方法
            return true;
        }

        // 检查父节点不是调用表达式或调用表达式但当前节点不是callee
        const notMethodCall = !ts.isCallExpression(node.parent) ||
            (ts.isCallExpression(node.parent) && node.parent.expression !== node);

        return notMethodCall;
    }

    // 检查是否是静态方法内部调用其他静态方法
    private isStaticMethodCallInStaticMethod(node: ts.PropertyAccessExpression): boolean {
        // 检查是否是方法调用表达式
        if (!ts.isCallExpression(node.parent) || node.parent.expression !== node) {
            return false;
        }

        // 检查是否在静态方法内部
        let isInStaticMethod = false;
        let currentMethod: ts.Node = node;
        while (currentMethod && currentMethod.parent) {
            if (ts.isMethodDeclaration(currentMethod) &&
                currentMethod.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)) {
                isInStaticMethod = true;
                break;
            }
            currentMethod = currentMethod.parent;
        }

        // 如果在静态方法内部，且是调用另一个静态方法，则视为合法使用
        return isInStaticMethod;
    }

    // 检查是否在对象字面量或解构赋值中
    private isInObjectLiteralOrDestructuring(parent: ts.Node): boolean {
        return ts.isObjectLiteralExpression(parent) ||
            (ts.isVariableDeclaration(parent) && ts.isObjectBindingPattern(parent.name));
    }

    // 检查是否在prototype访问链中
    private isInPrototypeChain(node: ts.Node): boolean {
        let current: ts.Node = node;
        while (current.parent) {
            if (ts.isPropertyAccessExpression(current.parent) &&
                current.parent.name.getText() === 'prototype') {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    // 检查节点是否在计算属性名中
    private isInComputedPropertyName(node: ts.Node): boolean {
        let current = node;
        while (current && current.parent) {
            // 检查是否在计算属性名内部
            if (ts.isComputedPropertyName(current.parent)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    // 检查属性访问是否是未绑定方法
    private checkPropertyAccess(node: ts.PropertyAccessExpression, variableToClassName: Map<string, string>,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>,
        options: Options[0], errors: ErrorReport[]): void {
        // 跳过条件检查
        if (this.shouldSkipPropertyCheck(node)) {
            return;
        }
        // 获取类名和方法名
        const className = this.getClassNameFromExpression(node.expression, variableToClassName);
        if (!className) {
            return;
        }
        const methodName = node.name.getText();
        // 检查是否是方法引用
        if (!this.isPropertyMethodReference(node, className, methodName)) {
            return;
        }
        // 检查是否是类静态方法访问
        if (this.isDirectClassStaticAccess(node, options)) {
            // 如果是静态方法且不忽略静态方法，则报告错误
            if (!options.ignoreStatic && ts.isIdentifier(node.expression)) {
                const sourceCode = this.sourceFile.getFullText();
                const classPattern = new RegExp(`class\\s+${node.expression.getText()}\\s*\\{`);
                if (classPattern.test(sourceCode) && this.isUnboundContext(node.parent, node)) {
                    this.reportUnboundMethodError(node, errors);
                }
            }
            return;
        }
        // 检查实例方法
        const key = `${className}.${methodName}`;
        const methodInfo = classMethodInfo.get(key);
        // 未绑定上下文检查
        if (!this.isUnboundContext(node.parent, node)) {
            return;
        }
        // 豁免情况检查
        if (this.isExemptCase(methodInfo, options, node)) {
            return;
        }
        // 报告错误
        this.reportUnboundMethodError(node, errors);
    }

    // 检查是否应该跳过属性检查
    private shouldSkipPropertyCheck(node: ts.PropertyAccessExpression): boolean {
        // 检查是否包含可选链或括号表达式
        if (this.containsOptionalChainOrParenthesized(node)) {
            return true;
        }

        // 检查是否是非空断言后的属性访问
        if (this.isNonNullAssertionExpression(node.expression)) {
            return true;
        }

        // 检查是否是方法内部的this属性访问
        if (node.expression.kind === ts.SyntaxKind.ThisKeyword) {
            let current: ts.Node = node;
            while (current.parent) {
                if (ts.isMethodDeclaration(current.parent) ||
                    (ts.isPropertyDeclaration(current.parent) &&
                        current.parent.initializer &&
                        ts.isArrowFunction(current.parent.initializer))) {
                    return true;
                }
                current = current.parent;
            }
        }

        return false;
    }

    // 检查是否是直接的类静态方法访问
    private isDirectClassStaticAccess(node: ts.PropertyAccessExpression, options: Options[0]): boolean {
        if (!ts.isIdentifier(node.expression)) {
            return false;
        }

        // 直接在源代码中查找类声明
        const expressionText = node.expression.getText();
        const sourceCode = this.sourceFile.getFullText();
        const classPattern = new RegExp(`class\\s+${expressionText}\\s*\\{`);

        // 检查是否是类名且在未绑定上下文中
        return classPattern.test(sourceCode) && this.isUnboundContext(node.parent, node);
    }

    // 检查是否包含可选链或括号表达式
    private containsOptionalChainOrParenthesized(node: ts.PropertyAccessExpression): boolean {
        // 直接检查当前节点的文本，看是否包含 ?.
        const nodeText = node.getText();
        if (nodeText.includes('?.')) {
            return true;
        }
        // 检查表达式是否是括号表达式
        if (ts.isParenthesizedExpression(node.expression)) {
            // 检查括号内的表达式是否包含可选链
            const innerExpr = node.expression.expression;
            const innerText = innerExpr.getText();
            if (innerText.includes('?.')) {
                return true;
            }
            // 对于括号表达式中的复杂表达式，我们也直接跳过
            // 这样可以避免误报 (a?.b).c 这样的模式
            return true;
        }
        return false;
    }

    // 判断属性引用是否是方法引用
    private isPropertyMethodReference(node: ts.PropertyAccessExpression,
        className: string, propertyName: string): boolean {
        // 1. 快速检查 - 显而易见的方法场景
        if (this.isDirectMethodCall(node)) {
            return true; // 方法调用：foo.method()
        }
        if (this.isKnownGlobalMethod(className, propertyName)) {
            return true; // 已知的全局对象静态方法
        }
        // 2. 特殊处理 - 多级属性访问
        if (this.isNestedPropertyAccess(node) && !this.isExplicitlyDeclaredAsMethod(node)) {
            return false; // 多级属性访问，没有证据表明是方法
        }
        // 3. 上下文检查 - 赋值场景
        if (this.isInAssignmentContext(node)) {
            if (this.isAssignmentWithMethodDeclaration(node, className, propertyName)) {
                return true;
            }
        }
        // 4. 类定义检查
        const methodType = this.checkClassMemberType(className, propertyName);
        if (methodType !== null) {
            return methodType; // true表示是方法，false表示普通属性
        }
        // 5. 上下文推断
        return this.isInMethodReferenceContext(node);
    }

    // 检查是否是已知的全局对象方法
    private isKnownGlobalMethod(className: string, propertyName: string): boolean {
        return className === 'Promise' && this.promiseTemArray.includes(propertyName);
    }

    // 检查在赋值上下文中是否有方法声明
    private isAssignmentWithMethodDeclaration(
        node: ts.PropertyAccessExpression,
        className: string,
        propertyName: string
    ): boolean {
        if (!ts.isBinaryExpression(node.parent)) {
            return false;
        }

        if (node.parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
            return false;
        }

        const foundMethod = this.findMethodInClassByName(className, propertyName);
        return !!foundMethod;
    }

    // 检查类成员的类型，返回null表示未找到成员
    private checkClassMemberType(className: string, propertyName: string): boolean | null {
        let classDecl: ts.ClassDeclaration | undefined;
        // 查找类声明
        const findClass = (node: ts.Node): void => {
            if (ts.isClassDeclaration(node) &&
                node.name?.getText() === className) {
                classDecl = node;
                return;
            }
            if (!classDecl) {
                ts.forEachChild(node, findClass);
            }
        };
        findClass(this.sourceFile);
        if (!classDecl) {
            return null;
        }
        for (const member of classDecl.members) {
            if (!member.name || member.name.getText() !== propertyName) {
                continue;
            }
            // 是方法声明
            if (ts.isMethodDeclaration(member)) {
                return true;
            }
            // 是箭头函数属性
            if (ts.isPropertyDeclaration(member) &&
                member.initializer &&
                ts.isArrowFunction(member.initializer)) {
                return true;
            }
            // 既不是方法也不是箭头函数，是普通属性
            return false;
        }
        return null;
    }

    // 检查是否在赋值上下文中
    private isInAssignmentContext(node: ts.PropertyAccessExpression): boolean {
        const parent = node.parent;
        // 左侧赋值: instance.method = x
        if (ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            parent.left === node) {
            return true;
        }
        // 右侧赋值: x = instance.method
        if (ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            parent.right === node) {
            return true;
        }
        // 变量声明时赋值: let x = instance.method
        if (ts.isVariableDeclaration(parent) &&
            parent.initializer === node) {
            return true;
        }
        return false;
    }

    // 在类定义中查找方法
    private findMethodInClassByName(className: string, methodName: string): ts.MethodDeclaration | undefined {
        // 初始化结果变量
        let result: ts.MethodDeclaration | undefined = undefined;
        // 递归遍历源文件找到特定类及其方法
        const visitNode = (node: ts.Node): void => {
            // 如果已找到结果，不再继续遍历
            if (result) {
                return;
            }
            
            // 如果是类声明且类名匹配
            if (this.isMatchingClass(node, className)) {
                // 在类成员中查找方法
                this.findMethodInClassMembers(node as ts.ClassDeclaration, methodName, (method) => {
                    result = method;
                });
                return;
            }
            
            // 继续遍历子节点
            ts.forEachChild(node, visitNode);
        };
        
        // 从源文件开始遍历
        visitNode(this.sourceFile);
        return result;
    }
    
    // 检查节点是否是匹配的类声明
    private isMatchingClass(node: ts.Node, className: string): boolean {
        return ts.isClassDeclaration(node) && 
               !!node.name && 
               node.name.getText() === className;
    }
    
    // 在类成员中查找特定名称的方法
    private findMethodInClassMembers(
        classDecl: ts.ClassDeclaration, 
        methodName: string, 
        callback: (method: ts.MethodDeclaration) => void
    ): void {
        for (const member of classDecl.members) {
            if (this.isMatchingMethod(member, methodName)) {
                callback(member as ts.MethodDeclaration);
                return;
            }
        }
    }
    
    // 检查成员是否是匹配的方法声明
    private isMatchingMethod(member: ts.ClassElement, methodName: string): boolean {
        return ts.isMethodDeclaration(member) && 
               !!member.name && 
               member.name.getText() === methodName;
    }

    // 检查是否在方法引用上下文中
    private isInMethodReferenceContext(node: ts.PropertyAccessExpression): boolean {
        const parent = node.parent;
        // 赋值表达式右侧
        if (ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            parent.right === node) {
            return true;
        }
        // 函数调用参数
        if (ts.isCallExpression(parent) &&
            parent.arguments.some(arg => arg === node)) {
            return true;
        }
        // 数组元素
        if (ts.isArrayLiteralExpression(parent) &&
            parent.elements.some(el => el === node)) {
            return true;
        }
        // 变量声明初始化
        if (ts.isVariableDeclaration(parent) &&
            parent.initializer === node) {
            return true;
        }
        // 返回语句
        if (ts.isReturnStatement(parent) &&
            parent.expression === node) {
            return true;
        }
        return false;
    }

    // 修改后的解构赋值检查逻辑
    private checkObjectDestructuring(
        node: ts.ObjectBindingPattern, 
        objectMethodInfo: Map<string, { usesThis: boolean; hasThisVoid: boolean }>,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>, 
        errors: ErrorReport[]
    ): void {
        // 1. 快速确认是否是有效的解构上下文
        const parent = node.parent;
        if (!this.isValidDestructuringContext(parent)) {
            return;
        }

        // 2. 获取初始化器表达式
        const initializer = this.getDestructuringInitializer(parent);
        if (!initializer) {
            return;
        }

        // 3. 获取解构上下文信息
        const contextInfo = this.getDestructuringContextInfo(initializer);

        // 4. 处理每个解构元素
        node.elements.forEach(element => {
            if (!ts.isBindingElement(element)) {
                return;
            }
            this.checkDestructuredElement(
                element, 
                contextInfo, 
                objectMethodInfo, 
                classMethodInfo, 
                errors
            );
        });
    }

    // 检查是否是有效的解构上下文
    private isValidDestructuringContext(parent: ts.Node): boolean {
        return ts.isVariableDeclaration(parent) || ts.isBinaryExpression(parent);
    }

    // 获取解构表达式的初始化器
    private getDestructuringInitializer(parent: ts.Node): ts.Expression | undefined {
        if (ts.isVariableDeclaration(parent)) {
            return parent.initializer;
        } else if (ts.isBinaryExpression(parent)) {
            return parent.right;
        }
        return undefined;
    }

    // 获取解构上下文信息
    private getDestructuringContextInfo(initializer: ts.Expression): {
        source: string;
        isNewExpression: boolean;
        className: string;
        isPromiseStatic: boolean;
    } {
        const source = this.getClassNameFromExpression(initializer, this.collectVariableToClassMapping(this.sourceFile)) ||
            initializer.getText(this.sourceFile);
        
        const isNewExpression = ts.isNewExpression(initializer);
        const className = isNewExpression ? initializer.expression.getText(this.sourceFile) : '';
        
        const sourceText = initializer.getText(this.sourceFile);
        const isPromiseStatic = sourceText === 'Promise';
        
        return { source, isNewExpression, className, isPromiseStatic };
    }

    // 检查单个解构元素
    private checkDestructuredElement(
        element: ts.BindingElement,
        contextInfo: { source: string; isNewExpression: boolean; className: string; isPromiseStatic: boolean },
        objectMethodInfo: Map<string, { usesThis: boolean; hasThisVoid: boolean }>,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>,
        errors: ErrorReport[]
    ): void {
        // 1. 提取方法名
        const methodName = element.propertyName?.getText(this.sourceFile) || element.name.getText();
        const key = `${contextInfo.source}.${methodName}`;
        
        // 2. 特殊处理Promise静态方法
        if (contextInfo.isPromiseStatic && this.promiseTemArray.includes(methodName)) {
            this.reportDestructuringError(element, methodName, errors);
            return;
        }
        
        // 3. 检查已知的方法信息
        const methodInfo = classMethodInfo.get(key) || objectMethodInfo.get(key);
        if (methodInfo) {
            this.checkMethodInfoForUnbound(methodInfo, element, methodName, errors);
        }
        // 4. 检查类中的函数表达式属性
        else if (contextInfo.isNewExpression) {
            this.checkFunctionExpressionProperty(contextInfo.className, element, methodName, errors);
        }
    }

    // 检查方法信息是否表示未绑定方法
    private checkMethodInfoForUnbound(
        methodInfo: { usesThis: boolean; hasThisVoid: boolean; isArrowFunc?: boolean },
        element: ts.BindingElement,
        methodName: string,
        errors: ErrorReport[]
    ): void {
        // 箭头函数属性不会导致未绑定问题
        if ('isArrowFunc' in methodInfo && methodInfo.isArrowFunc) {
            return;
        }
        
        // this:void 注解的方法不会导致未绑定问题
        if (methodInfo.hasThisVoid) {
            return;
        }
        
        // 在解绑上下文中报告错误
        if (this.isUnboundContext(element, element)) {
            this.reportDestructuringError(element, methodName, errors);
        }
    }

    // 检查类中是否有函数表达式属性
    private checkFunctionExpressionProperty(
        className: string,
        element: ts.BindingElement,
        methodName: string,
        errors: ErrorReport[]
    ): void {
        if (this.checkClassHasFunctionProperty(className, methodName)) {
            this.reportDestructuringError(element, methodName, errors);
        }
    }

    // 检查是否属于豁免情况
    private isExemptCase(
        methodInfo: { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean } | undefined,
        options: Options[0],
        node: ts.PropertyAccessExpression
    ): boolean {
        // 如果是箭头函数属性则豁免
        if (methodInfo?.isArrowFunc) {
            return true;
        }

        // 静态方法且ignoreStatic为true
        if (methodInfo?.isStatic && options.ignoreStatic) {
            return true;
        }

        // 方法有this:void注解
        if (methodInfo?.hasThisVoid) {
            return true;
        }

        // 使用了bind等方式绑定this
        if (this.isBoundUsage(node)) {
            return true;
        }

        return false;
    }

    // 报告未绑定方法错误
    private reportUnboundMethodError(node: ts.PropertyAccessExpression, errors: ErrorReport[]): void {
        const sourcePos = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());

        // 判断是否是函数表达式属性
        const isFunctionExpression = this.isPropertyAccessToFunctionExpression(node);

        errors.push({
            line: sourcePos.line + 1,
            character: sourcePos.character + 1,
            endCol: sourcePos.character + node.getText().length + 1,
            message: isFunctionExpression ? this.shortMessageStr : this.messageStr
        });
    }

    // 报告解构中的未绑定方法错误
    private reportDestructuringError(element: ts.BindingElement, methodName: string, errors: ErrorReport[]): void {
        const sourcePos = this.sourceFile.getLineAndCharacterOfPosition(element.getStart());

        // 检查父节点以获取类名信息
        const parent = element.parent;
        if (!parent || !ts.isObjectBindingPattern(parent)) {
            // 无法确定是否为函数表达式，使用完整消息
            errors.push({
                line: sourcePos.line + 1,
                character: sourcePos.character + 1,
                endCol: sourcePos.character + methodName.length + 1,
                message: this.messageStr
            });
            return;
        }

        // 尝试获取类名信息
        const declaration = parent.parent;
        let isFunctionExprProperty = false;

        if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
            // 处理变量声明的情况: const { method } = instance
            isFunctionExprProperty = this.isInitializerWithFunctionExprProperty(declaration.initializer, methodName);
        } else if (ts.isBinaryExpression(declaration)) {
            // 处理赋值表达式的情况: ({ method } = instance)
            const binaryExpr = declaration as ts.BinaryExpression;
            if (binaryExpr.right) {
                isFunctionExprProperty = this.isInitializerWithFunctionExprProperty(binaryExpr.right, methodName);
            }
        }

        errors.push({
            line: sourcePos.line + 1,
            character: sourcePos.character + 1,
            endCol: sourcePos.character + methodName.length + 1,
            message: isFunctionExprProperty ? this.shortMessageStr : this.messageStr
        });
    }

    // 检查初始化器是否包含函数表达式属性
    private isInitializerWithFunctionExprProperty(initializer: ts.Expression, propertyName: string): boolean {
        // 处理 new 表达式: new Class()
        if (ts.isNewExpression(initializer)) {
            const className = initializer.expression.getText();
            return this.checkClassHasFunctionProperty(className, propertyName);
        }

        // 处理标识符: instance
        if (ts.isIdentifier(initializer)) {
            const variableName = initializer.getText();
            const variableToClassName = this.collectVariableToClassMapping(this.sourceFile);
            const className = variableToClassName.get(variableName);

            if (className) {
                return this.checkClassHasFunctionProperty(className, propertyName);
            }
        }

        return false;
    }

    // 检查方法是否使用this
    private checkThisUsage(node: ts.MethodDeclaration | ts.PropertyDeclaration): boolean {
        let usesThis = false;
        const visit = (child: ts.Node): void => {
            if (child.kind === ts.SyntaxKind.ThisKeyword) {
                usesThis = true;
            }
            ts.forEachChild(child, visit);
        };

        ts.forEachChild(node, visit);
        return usesThis;
    }

    // 检查方法是否有this: void注解
    private checkThisVoidAnnotation(node: ts.MethodDeclaration | ts.PropertyDeclaration): boolean {
        if (ts.isMethodDeclaration(node)) {
            return node.parameters.some(p =>
                p.name.getText() === 'this' &&
                p.type?.getText() === 'void'
            );
        }
        return false;
    }

    // 判断是否在解绑上下文中使用（赋值、解构等）
    private isUnboundContext(parentNode: ts.Node, currentExpr: ts.Node): boolean {
        // 处理函数调用参数的情况（新增）
        if (ts.isCallExpression(parentNode)) {
            return parentNode.arguments.some(arg => arg === currentExpr);
        }

        // 处理赋值表达式的情况
        if (ts.isBinaryExpression(parentNode) &&
            parentNode.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            return currentExpr === parentNode.right;
        }

        // 处理变量声明的情况
        if (ts.isVariableDeclaration(parentNode)) {
            return true;
        }
        // 处理对象解构的情况
        return ts.isPropertyAssignment(parentNode) ||
            ts.isBindingElement(parentNode) ||
            ts.isSpreadAssignment(parentNode);
    }

    // 检查是否已正确绑定（如使用bind、箭头函数等）
    private isBoundUsage(node: ts.PropertyAccessExpression): boolean {
        let current = node.parent;
        while (current) {
            if (ts.isCallExpression(current)) {
                const expr = current.expression;
                if (ts.isPropertyAccessExpression(expr) &&
                    expr.name.getText() === 'bind') {
                    return true;
                }
            }
            if (ts.isArrowFunction(current) ||
                ts.isFunctionExpression(current)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    // 检查一个表达式是否是非空断言表达式
    private isNonNullAssertionExpression(node: ts.Expression): boolean {
        // 直接非空断言 foo!
        if (ts.isNonNullExpression(node)) {
            return true;
        }

        // 多层非空断言 foo!!
        if (ts.isNonNullExpression(node) &&
            ts.isNonNullExpression((node as ts.NonNullExpression).expression)) {
            return true;
        }

        // 带括号的非空断言 (foo!)
        if (ts.isParenthesizedExpression(node)) {
            return this.isNonNullAssertionExpression((node as ts.ParenthesizedExpression).expression);
        }

        return false;
    }

    // 检查是否是继承自Promise的静态方法
    private isInheritedStaticMethod(
        node: ts.PropertyAccessExpression,
        className: string,
        methodName: string
    ): boolean {
        // 1. 检查方法名是否在Promise静态方法列表中
        if (!this.promiseTemArray.includes(methodName)) {
            return false; // 不是Promise静态方法名
        }

        // 2. 检查使用上下文
        if (this.isInAssignmentContext(node)) {
            return true; // 在赋值上下文中使用
        }

        // 3. 检查类是否继承自Promise
        if (!ts.isIdentifier(node.expression)) {
            return false;
        }

        const classDecl = this.findClassDeclarationByName(className);
        return this.isClassInheritingPromise(classDecl);
    }

    // 查找类声明
    private findClassDeclarationByName(className: string): ts.ClassDeclaration | undefined {
        let classDecl: ts.ClassDeclaration | undefined;

        const findClass = (sourceNode: ts.Node): void => {
            if (ts.isClassDeclaration(sourceNode) &&
                sourceNode.name?.getText() === className) {
                classDecl = sourceNode;
                return;
            }

            if (!classDecl) {
                ts.forEachChild(sourceNode, findClass);
            }
        };

        findClass(this.sourceFile);
        return classDecl;
    }

    // 检查类是否继承自Promise
    private isClassInheritingPromise(classDecl?: ts.ClassDeclaration): boolean {
        if (!classDecl || !classDecl.heritageClauses) {
            return false;
        }

        for (const heritage of classDecl.heritageClauses) {
            if (heritage.token !== ts.SyntaxKind.ExtendsKeyword) {
                continue;
            }

            for (const type of heritage.types) {
                const baseType = type.expression.getText();

                if (baseType === 'Promise' || baseType.startsWith('Promise<')) {
                    return true;
                }

                // 递归检查基类是否是Promise的后代
                if (this.isPromiseDescendant(baseType)) {
                    return true;
                }
            }
        }

        return false;
    }

    // 检查一个类是否是Promise的后代
    private isPromiseDescendant(className: string): boolean {
        // 查找类声明
        const classDecl = this.findClassDeclarationByName(className);
        return this.isClassInheritingPromise(classDecl);
    }

    // 检查是否是静态箭头函数属性
    private isStaticArrowFunctionProperty(className: string, propertyName: string): boolean {
        // 查找类声明
        let classDecl: ts.ClassDeclaration | undefined;
        const findClass = (sourceNode: ts.Node): void => {
            if (ts.isClassDeclaration(sourceNode) &&
                sourceNode.name?.getText() === className) {
                classDecl = sourceNode;
                return;
            }
            ts.forEachChild(sourceNode, findClass);
        };

        findClass(this.sourceFile);

        // 检查类中是否有对应名称的静态箭头函数属性
        if (classDecl) {
            for (const member of classDecl.members) {
                if (ts.isPropertyDeclaration(member) &&
                    member.name.getText() === propertyName &&
                    member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) &&
                    member.initializer &&
                    ts.isArrowFunction(member.initializer)) {
                    return true;
                }
            }
        }

        return false;
    }

    // 专门检查赋值表达式中的解构情况
    private checkAssignmentExpression(
        node: ts.ParenthesizedExpression,
        objectMethodInfo: Map<string, { usesThis: boolean; hasThisVoid: boolean }>,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>,
        errors: ErrorReport[]
    ): void {
        // 检查括号内表达式
        const innerExpr = node.expression;
        // 情况1: 括号内是赋值表达式
        if (ts.isBinaryExpression(innerExpr) &&
            innerExpr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            // 分别处理不同类型的左侧表达式
            if (ts.isObjectBindingPattern(innerExpr.left)) {
                // 对象解构模式 - 如 { unboundX } = ...
                this.processBindingPattern(innerExpr.left, innerExpr.right, classMethodInfo, errors);
            }
            else if (ts.isObjectLiteralExpression(innerExpr.left)) {
                // 对象字面量 - 可能是一种不同的解构语法
                this.processObjectLiteral(innerExpr.left, innerExpr.right, classMethodInfo, errors);
            }
            else if (ts.isParenthesizedExpression(innerExpr.left)) {
                // 括号内可能是对象绑定模式
                const innerExpression = innerExpr.left.expression;
                if (ts.isObjectBindingPattern(innerExpression)) {
                    this.processBindingPattern(innerExpression, innerExpr.right, classMethodInfo, errors);
                }
                else if (ts.isObjectLiteralExpression(innerExpression)) {
                    this.processObjectLiteral(innerExpression, innerExpr.right, classMethodInfo, errors);
                }
            }
        }
    }

    // 处理对象绑定模式
    private processBindingPattern(pattern: ts.ObjectBindingPattern, initializer: ts.Expression,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>,
        errors: ErrorReport[]): void {
        // 获取类名或对象名
        const source = this.getClassNameFromExpression(initializer, this.collectVariableToClassMapping(this.sourceFile)) ||
            initializer.getText(this.sourceFile);
        // 检查是否是新建类实例的表达式
        const isNewExpression = ts.isNewExpression(initializer);
        const className = isNewExpression ? initializer.expression.getText(this.sourceFile) : '';
        // 检查每个绑定元素
        pattern.elements.forEach((element: ts.BindingElement) => {
            if (!ts.isBindingElement(element)) {
                return;
            }
            const methodName = element.propertyName?.getText() || element.name.getText();
            const key = `${source}.${methodName}`;
            // 检查是否为类方法
            if (classMethodInfo.has(key)) {
                const methodInfo = classMethodInfo.get(key);
                // 如果是箭头函数属性，不需要报错
                if (methodInfo?.isArrowFunc) {
                    return;
                }
                // 找到实际位置并报告错误
                const sourcePos = this.sourceFile.getLineAndCharacterOfPosition(element.getStart());
                errors.push({
                    line: sourcePos.line + 1,
                    character: sourcePos.character + 1,
                    endCol: sourcePos.character + methodName.length + 1,
                    message: this.messageStr
                });
            } 
            // 当从classMethodInfo中找不到方法信息时，如果是new表达式，尝试直接查找类中是否有函数表达式属性
            else if (isNewExpression) {
                // 尝试在源代码中查找类定义
                if (this.checkClassHasFunctionProperty(className, methodName)) {
                    // 如果找到了函数表达式属性，报告错误
                    const sourcePos = this.sourceFile.getLineAndCharacterOfPosition(element.getStart());
                    errors.push({
                        line: sourcePos.line + 1,
                        character: sourcePos.character + 1,
                        endCol: sourcePos.character + methodName.length + 1,
                        message: this.messageStr
                    });
                }
            }
        });
    }

    // 处理对象字面量表达式
    private processObjectLiteral(literal: ts.ObjectLiteralExpression, initializer: ts.Expression,
        classMethodInfo: Map<string, { isStatic: boolean; usesThis: boolean; hasThisVoid: boolean; isArrowFunc: boolean }>,
        errors: ErrorReport[]): void {
        // 获取类名或对象名
        const source = this.getClassNameFromExpression(initializer, this.collectVariableToClassMapping(this.sourceFile)) ||
            initializer.getText(this.sourceFile);
        const isNewExpression = ts.isNewExpression(initializer); // 检查是否是new表达式，用于判断函数表达式
        const className = isNewExpression ? initializer.expression.getText(this.sourceFile) : '';
        literal.properties.forEach(prop => {
            let propName = '';
            if (ts.isPropertyAssignment(prop)) {
                propName = prop.name.getText();
            } else if (ts.isShorthandPropertyAssignment(prop)) {
                propName = prop.name.getText();
            } else {
                return;
            }
            const key = `${source}.${propName}`;
            // 检查是否为类方法
            if (classMethodInfo.has(key)) {
                const methodInfo = classMethodInfo.get(key);
                // 如果是箭头函数属性，不需要报错
                if (methodInfo?.isArrowFunc) {
                    return;
                }
                const sourcePos = this.sourceFile.getLineAndCharacterOfPosition(prop.name.getStart());
                let isFunctionExpression = false;
                if (isNewExpression) {
                    // 直接检查类中是否有对应名称的函数表达式属性
                    isFunctionExpression = this.checkClassHasFunctionProperty(className, propName);
                }
                errors.push({
                    line: sourcePos.line + 1,
                    character: sourcePos.character + 1,
                    endCol: sourcePos.character + propName.length + 1,
                    message: isFunctionExpression ? this.shortMessageStr : this.messageStr
                });
            } else if (isNewExpression) { // 额外处理：当从classMethodInfo中找不到方法信息时，检查类中是否有函数表达式属性
                if (this.checkClassHasFunctionProperty(className, propName)) {
                    const sourcePos = this.sourceFile.getLineAndCharacterOfPosition(prop.name.getStart());
                    errors.push({
                        line: sourcePos.line + 1,
                        character: sourcePos.character + 1,
                        endCol: sourcePos.character + propName.length + 1,
                        message: this.shortMessageStr
                    });
                }
            }
        });
    }

    // 获取表达式中的类名
    private getClassNameFromExpression(expr: ts.Expression, variableToClassName: Map<string, string>): string | undefined {
        // 处理this表达式：通过检查节点的kind属性
        if (expr.kind === ts.SyntaxKind.ThisKeyword) {
            return this.currentClassName || undefined;
        }
        // 处理 prototype 访问
        if (ts.isPropertyAccessExpression(expr) && expr.name.getText() === 'prototype') {
            return expr.expression.getText(this.sourceFile);
        }
        // 处理 new ClassName() 的情况
        if (ts.isNewExpression(expr)) {
            return expr.expression.getText(this.sourceFile);
        }
        // 处理变量引用的情况
        if (ts.isIdentifier(expr)) {
            return variableToClassName.get(expr.text);
        }
        return expr.getText(this.sourceFile);
    }

    // 检查类是否有函数表达式属性
    private checkClassHasFunctionProperty(className: string, propertyName: string): boolean {
        // 使用独立函数检查单个类声明
        const checkClass = (classDecl: ts.ClassDeclaration): boolean => {
            if (!classDecl.name || classDecl.name.getText() !== className) {
                return false;
            }
            
            return this.findFunctionPropertyInClass(classDecl, propertyName);
        };
        
        // 在源文件中查找匹配的类
        return this.findNodeInSourceFile<ts.ClassDeclaration>(
            (node): node is ts.ClassDeclaration => ts.isClassDeclaration(node),
            checkClass
        );
    }

    // 在类中查找函数表达式属性
    private findFunctionPropertyInClass(classDecl: ts.ClassDeclaration, propertyName: string): boolean {
        for (const member of classDecl.members) {
            // 只处理属性声明
            if (!ts.isPropertyDeclaration(member)) {
                continue;
            }
            
            // 检查属性名
            if (member.name.getText() !== propertyName) {
                continue;
            }
            
            // 检查初始化器
            if (!member.initializer || !ts.isFunctionExpression(member.initializer)) {
                continue;
            }
            
            return true; // 找到匹配的函数表达式属性
        }
        
        return false; // 未找到
    }

    // 泛型辅助方法：在源文件中查找特定类型的节点
    private findNodeInSourceFile<T extends ts.Node>(
        typeGuard: (node: ts.Node) => node is T,
        checker: (node: T) => boolean
    ): boolean {
        let found = false;
        const visitor = (node: ts.Node): void => {
            // 如果已经找到，提前返回
            if (found) {
                return;
            }
            
            // 类型检查并运行检查函数
            if (typeGuard(node) && checker(node)) {
                found = true;
                return;
            }
            
            // 继续遍历子节点
            if (!found) {
                ts.forEachChild(node, visitor);
            }
        };
        
        ts.forEachChild(this.sourceFile, visitor);
        return found;
    }

    // 判断属性访问是否指向函数表达式属性
    private isPropertyAccessToFunctionExpression(node: ts.PropertyAccessExpression): boolean {
        // 获取属性名和对象表达式
        const propertyName = node.name.getText();
        const objExpression = node.expression;

        // 如果是new表达式
        if (ts.isNewExpression(objExpression)) {
            const className = objExpression.expression.getText();

            // 查找类声明
            return this.checkClassHasFunctionProperty(className, propertyName);
        }

        // 如果是普通标识符
        if (ts.isIdentifier(objExpression)) {
            const objName = objExpression.getText();

            // 尝试找到对应的类型
            const variableToClassName = this.collectVariableToClassMapping(this.sourceFile);
            const className = variableToClassName.get(objName);

            if (className) {
                return this.checkClassHasFunctionProperty(className, propertyName);
            }
        }

        return false;
    }
}