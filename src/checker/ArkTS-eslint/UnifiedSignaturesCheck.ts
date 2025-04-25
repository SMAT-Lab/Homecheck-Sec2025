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

import { RuleListUtil } from "../../utils/common/DefectsList";
import { ArkFile, ts } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects } from "../../model/Defects";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { AstTreeUtils } from "arkanalyzer";
import { Rule } from "../../model/Rule";
import { IssueReport } from "../../model/Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UnifiedSignaturesCheck');

type Options = [{
    ignoreDifferentlyNamedParameters?: boolean;
}];

export class UnifiedSignaturesCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/unified-signatures-check.md',
        description: 'Function overloads can be unified into a single signature.',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    private defaultOption: Options = [{}];

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatcher];
    };

    public check = (target: ArkFile): void => {
        this.defaultOption = this.rule && this.rule.option[0] ? this.rule.option as Options : [{}];
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
        this.checkBodyForOverloadMethods(sourceFile);
    };

    private checkBodyForOverloadMethods(sourceFile: ts.SourceFile,): Method[] {
        const lineAndersonColumn: Method[] = [];
        this.visit(sourceFile, lineAndersonColumn, sourceFile);
        return lineAndersonColumn;
    };

    private visit(node: ts.Node, lineAndersonColumn: Method[], sourceFile: ts.SourceFile): void {
        let members = this.getNodeMembers(node);
        if (members) {
            if (ts.isSourceFile(node)) {
                this.processSourceFileNode(node, members, sourceFile);
            } else {
                this.processNonSourceFileNode(node, members, sourceFile);
            }
        }
        ts.forEachChild(node, (n) => this.visit(n, lineAndersonColumn, sourceFile));
    };

    // 处理源文件节点
    private processSourceFileNode(node: ts.Node, members: ts.Node[], sourceFile: ts.SourceFile): void {
        // 收集所有函数声明
        const functionDeclarations: ts.FunctionDeclaration[] = [];
        members.forEach(member => {
            if (ts.isFunctionDeclaration(member)) {
                functionDeclarations.push(member);
            }
        });
        // 按名称分组
        const functionGroups: Map<string, ts.FunctionDeclaration[]> = new Map();
        functionDeclarations.forEach(func => {
            const name = func.name && ts.isIdentifier(func.name) ? func.name.text : null;
            if (!name) {
                return;
            }
            if (!functionGroups.has(name)) {
                functionGroups.set(name, []);
            }
            functionGroups.get(name)!.push(func);
        });
        // 处理每个函数组
        functionGroups.forEach((funcs, name) => {
            if (funcs.length > 1) {
                this.checkFunctionGroup(funcs, node, sourceFile);
            }
        });
    };

    // 检查函数组中的重载
    private checkFunctionGroup(
        funcs: ts.FunctionDeclaration[],
        node: ts.Node,
        sourceFile: ts.SourceFile
    ): void {
        // 提取方法信息
        const methods: Method[] = [];
        funcs.forEach(func => {
            const method = this.getMemberMethod(func, sourceFile);
            if (method) {
                methods.push(method);
            }
        });
        // 计算有实现的方法数量
        const implementedMethodsCount = methods.filter(method => method.hasImplementation).length;
        // 检查是否可以统一
        this.checkMethodPairsForUnification(methods, node, methods.length - implementedMethodsCount);
    };

    // 检查方法对是否可以统一
    private checkMethodPairsForUnification(
        methods: Method[],
        node: ts.Node,
        implementedMethodsCount: number
    ): void {
        for (let i = 0; i < methods.length; i++) {
            for (let j = i + 1; j < methods.length; j++) {
                const method1 = methods[i];
                const method2 = methods[j];
                const unificationResult = this.canUnifyMethods(
                    method1,
                    method2,
                    implementedMethodsCount
                );

                if (unificationResult.canUnify) {
                    this.addIssueReport(
                        method2.line,
                        unificationResult.paramInfo.character,
                        method2.endCol,
                        node.getSourceFile().fileName,
                        unificationResult.reason
                    );
                }
            }
        }
    };

    // 处理非源文件节点
    private processNonSourceFileNode(node: ts.Node, members: ts.Node[], sourceFile: ts.SourceFile): void {
        const accessors: Map<string, { get?: Method, set?: Method }> = new Map();
        members.forEach((member: ts.Node) => {
            const method = this.getMemberMethod(member, sourceFile);
            if (method == null) {
                return;
            }

            // 处理访问器
            if (method.isAccessor) {
                this.processAccessorMethod(method, accessors, node);
            }
        });
    };

    // 处理访问器方法
    private processAccessorMethod(
        method: Method,
        accessors: Map<string, { get?: Method, set?: Method }>,
        node: ts.Node
    ): void {
        const accessorName = method.name;
        if (!accessors.has(accessorName)) {
            accessors.set(accessorName, {} as { get?: Method, set?: Method });
        }
        const accessorInfo = accessors.get(accessorName)!;
        if (method.accessorType === 'get') {
            accessorInfo.get = method;
        } else if (method.accessorType === 'set') {
            accessorInfo.set = method;
        }
        // 如果同时存在 get 和 set 访问器，检查是否可以统一
        if (accessorInfo.get && accessorInfo.set) {
            this.checkAccessorPairUnification(accessorInfo, accessorName, node);
            // 清除已处理的访问器，避免重复报告
            accessors.delete(accessorName);
        }
    };

    // 检查访问器对是否可以统一
    private checkAccessorPairUnification(
        accessorInfo: { get?: Method, set?: Method },
        accessorName: string,
        node: ts.Node
    ): void {
        logger.debug(`Found matching get/set accessors for: ${accessorName}`);
        // 检查 get 和 set 访问器是否有实现
        if (accessorInfo.get!.hasImplementation || accessorInfo.set!.hasImplementation) {
            return;
        }
        // 检查 get 和 set 访问器是否可以统一
        const unificationResult = this.canUnifyMethods(accessorInfo.get!, accessorInfo.set!, 2);
        if (unificationResult.canUnify) {
            this.addIssueReport(
                accessorInfo.set!.line,
                unificationResult.paramInfo.character,
                accessorInfo.set!.endCol,
                node.getSourceFile().fileName,
                unificationResult.reason
            );
        }
    };

    private getMemberMethod(member: ts.Node, sourceFile: ts.SourceFile): Method | null {
        const position = member.getStart();
        const endPosition = member.getEnd();
        const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, position);
        const { line: endLine, character: endChar } = ts.getLineAndCharacterOfPosition(sourceFile, endPosition);

        if (ts.isFunctionDeclaration(member) || ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
            return this.getFunctionOrMethodInfo(member, sourceFile, line, character, endChar);
        } else if (ts.isGetAccessorDeclaration(member)) {
            return this.getGetAccessorInfo(member, sourceFile, line, character, endChar);
        } else if (ts.isSetAccessorDeclaration(member)) {
            return this.getSetAccessorInfo(member, sourceFile, line, character, endChar);
        }
        return null;
    };

    // 处理函数声明或方法声明
    private getFunctionOrMethodInfo(
        member: ts.FunctionDeclaration | ts.MethodDeclaration | ts.MethodSignature,
        sourceFile: ts.SourceFile,
        line: number,
        character: number,
        endChar: number
    ): Method | null {
        const name = member.name && ts.isIdentifier(member.name) ? member.name.text : null;
        if (!name) {
            return null;
        }
        // 检查是否是私有字段方法（以#开头）
        if (name.startsWith('#')) {
            return null;
        }
        const parameters = this.extractParameters(member, sourceFile);
        const isStatic = member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) || false;
        const hasImplementation = ts.isMethodSignature(member) ? false : member.body !== undefined;
        return {
            name,
            static: isStatic,
            line: line + 1,
            character: character + 1,
            endCol: endChar + 1,
            isAccessor: false,
            parameters,
            node: member,
            hasImplementation
        };
    }

    // 处理getter访问器
    private getGetAccessorInfo(
        member: ts.GetAccessorDeclaration,
        sourceFile: ts.SourceFile,
        line: number,
        character: number,
        endChar: number
    ): Method | null {
        const name = member.name && ts.isIdentifier(member.name) ? member.name.text : null;
        if (!name) {
            return null;
        }
        // 检查是否是私有字段访问器（以#开头）
        if (name.startsWith('#')) {
            return null;
        }
        const isStatic = member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) || false;
        // 提取 get 访问器的参数
        const parameters = this.extractParameters(member, sourceFile);
        const hasImplementation = member.body !== undefined;
        return {
            name,
            static: isStatic,
            line: line + 1,
            character: character + 1,
            endCol: endChar + 1,
            isAccessor: true,
            accessorType: 'get',
            parameters,
            node: member,
            hasImplementation
        };
    }

    // 处理setter访问器
    private getSetAccessorInfo(
        member: ts.SetAccessorDeclaration,
        sourceFile: ts.SourceFile,
        line: number,
        character: number,
        endChar: number
    ): Method | null {
        const name = member.name && ts.isIdentifier(member.name) ? member.name.text : null;
        if (!name) {
            return null;
        }
        // 检查是否是私有字段访问器（以#开头）
        if (name.startsWith('#')) {
            return null;
        }
        const isStatic = member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) || false;
        // 提取 set 访问器的参数
        const parameters = this.extractParameters(member, sourceFile);
        const hasImplementation = member.body !== undefined;
        return {
            name,
            static: isStatic,
            line: line + 1,
            character: character + 1,
            endCol: endChar + 1,
            isAccessor: true,
            accessorType: 'set',
            parameters,
            node: member,
            hasImplementation
        };
    }

    private extractParameters(
        member: ts.FunctionDeclaration | ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration | ts.MethodSignature,
        sourceFile: ts.SourceFile): Parameter[] {
        const parameters: Parameter[] = [];
        if (member.parameters) {
            member.parameters.forEach(param => {
                const name = param.name && ts.isIdentifier(param.name) ? param.name.text : '';
                const type = param.type ? param.type.getText() : 'any';
                const isOptional = param.questionToken !== undefined;
                const isRest = param.dotDotDotToken !== undefined;
                // 获取参数的位置信息
                const position = param.getStart();
                const endPosition = param.getEnd();
                const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, position);
                const { character: endChar } = ts.getLineAndCharacterOfPosition(sourceFile, endPosition);
                parameters.push({
                    name,
                    type,
                    isOptional,
                    isRest,
                    line: line + 1,
                    character: character + 1,
                    endCol: endChar + 1
                });
            });
        }
        return parameters;
    };

    private getNodeMembers(node: ts.Node): ts.Node[] | undefined {
        if (ts.isModuleDeclaration(node)) {
            return this.getModuleDeclarationMembers(node);
        } else if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node) || ts.isTypeLiteralNode(node) || ts.isTypeAliasDeclaration(node)) {
            return this.getTypeOrClassMembers(node);
        } else if (ts.isSourceFile(node)) {
            return Array.from(node.statements);
        }
        return undefined;
    };

    private getModuleDeclarationMembers(node: ts.ModuleDeclaration): ts.Node[] | undefined {
        return node.body && ts.isModuleBlock(node.body) ? Array.from(node.body.statements) : undefined;
    };

    private getTypeOrClassMembers(node: ts.Node): ts.Node[] {
        let members: ts.Node[] = [];
        if (ts.isTypeAliasDeclaration(node)) {
            members = this.getTypeAliasMembers(node);
        } else {
            // 对于接口、类或类型字面量，直接获取成员
            members = Array.from((node as ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeLiteralNode).members as ts.NodeArray<ts.Node>);
        }
        // 处理接口中的方法重载
        if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
            this.processMethodOverloads(members, node);
        }
        return members;
    };

    private getTypeAliasMembers(node: ts.TypeAliasDeclaration): ts.Node[] {
        if (node.type && ts.isTypeLiteralNode(node.type)) {
            // 如果类型别名的类型是类型字面量，获取其成员
            return Array.from(node.type.members as ts.NodeArray<ts.Node>);
        }
        return [];
    };

    private processMethodOverloads(members: ts.Node[], node: ts.Node): void {
        // 收集所有方法声明
        const methodDeclarations = this.collectMethodDeclarations(members);
        // 按名称分组
        const methodGroups = this.groupMethodsByName(methodDeclarations);
        // 处理每个方法组
        this.checkOverloadMethodGroups(methodGroups, node);
    };

    private collectMethodDeclarations(members: ts.Node[]): (ts.MethodSignature | ts.MethodDeclaration)[] {
        const methodDeclarations: (ts.MethodSignature | ts.MethodDeclaration)[] = [];
        members.forEach(member => {
            if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
                // 检查是否是私有字段方法（以#开头）
                const name = member.name && ts.isIdentifier(member.name) ? member.name.text : null;
                if (name && name.startsWith('#')) {
                    return;
                }
                methodDeclarations.push(member);
            }
        });
        return methodDeclarations;
    };

    private groupMethodsByName(methodDeclarations: (ts.MethodSignature | ts.MethodDeclaration)[]): Map<string, (ts.MethodSignature | ts.MethodDeclaration)[]> {
        const methodGroups: Map<string, (ts.MethodSignature | ts.MethodDeclaration)[]> = new Map();
        methodDeclarations.forEach(method => {
            const name = method.name && ts.isIdentifier(method.name) ? method.name.text : null;
            if (!name) {
                return;
            }
            if (!methodGroups.has(name)) {
                methodGroups.set(name, []);
            }
            methodGroups.get(name)!.push(method);
        });
        return methodGroups;
    };

    private checkOverloadMethodGroups(
        methodGroups: Map<string, (ts.MethodSignature | ts.MethodDeclaration)[]>,
        node: ts.Node
    ): void {
        methodGroups.forEach((methods, name) => {
            if (methods.length > 1) {
                // 提取方法信息
                const methodInfos: Method[] = this.extractMethodInfos(methods, node);
                // 计算有实现的方法数量
                const implementedMethodsCount = methodInfos.filter(method => method.hasImplementation).length;
                // 检查方法是否可以统一
                this.checkMethodPairsForUnification(methodInfos, node, methodInfos.length - implementedMethodsCount);
            }
        });
    };

    private extractMethodInfos(
        methods: (ts.MethodSignature | ts.MethodDeclaration)[],
        node: ts.Node
    ): Method[] {
        const methodInfos: Method[] = [];
        methods.forEach(method => {
            const methodInfo = this.getMemberMethod(method, node.getSourceFile());
            if (methodInfo) {
                methodInfos.push(methodInfo);
            }
        });
        return methodInfos;
    };

    private addIssueReport(
        line: number,
        startCol: number,
        endCol: number,
        filePath: string,
        unificationReason?: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        let description = unificationReason ? unificationReason : this.metaData.description;
        const defect = new Defects(line, startCol, endCol, description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };

    private canUnifyMethods(
        method1: Method,
        method2: Method,
        number: number): {
            canUnify: boolean;
            reason: string;
            paramInfo?: any
        } {
        // 基本验证检查
        const basicValidation = this.performBasicMethodValidation(method1, method2);
        if (!basicValidation.isValid) {
            return { canUnify: false, reason: basicValidation.reason };
        }

        // 检查返回类型是否兼容
        const returnTypeCheck = this.checkReturnTypeCompatibility(method1, method2);
        if (!returnTypeCheck.isCompatible) {
            return { canUnify: false, reason: returnTypeCheck.reason };
        }

        // 检查参数数量
        const paramCountResult = this.checkParameterCountCompatibility(method1, method2);
        if (!paramCountResult.isCompatible) {
            return { canUnify: false, reason: paramCountResult.reason };
        }

        // 根据参数数量相等或相差1的情况进行不同的检查
        if (method1.parameters!.length === method2.parameters!.length) {
            return this.checkMethodsWithSameParamCount(method1, method2, number);
        } else {
            return this.checkMethodsWithDifferentParamCount(method1, method2);
        }
    };

    // 检查参数数量差异
    private checkParameterCountCompatibility(method1: Method, method2: Method): {
        isCompatible: boolean;
        reason: string
    } {
        const paramCountDiff = Math.abs(method1.parameters!.length - method2.parameters!.length);
        if (paramCountDiff >= 2) {
            return {
                isCompatible: false,
                reason: 'Parameter count difference is too large to unify'
            };
        }
        return { isCompatible: true, reason: '' };
    }

    // 执行基本的方法验证
    private performBasicMethodValidation(method1: Method, method2: Method): { isValid: boolean; reason: string } {
        // 检查静态/实例方法
        if (method1.static !== method2.static) {
            return { isValid: false, reason: 'Cannot unify static and instance methods' };
        }
        // 检查方法实现
        if (method1.hasImplementation || method2.hasImplementation) {
            return { isValid: false, reason: 'Cannot unify methods with implementation' };
        }
        // 检查参数信息
        if (!method1.parameters || !method2.parameters) {
            return { isValid: false, reason: 'Missing parameter information' };
        }
        return { isValid: true, reason: '' };
    };

    // 检查返回类型兼容性
    private checkReturnTypeCompatibility(method1: Method, method2: Method): { isCompatible: boolean; reason: string } {
        const returnType1 = this.getReturnType(method1.node);
        const returnType2 = this.getReturnType(method2.node);
        const hasExplicitReturn1 = this.hasExplicitReturnType(method1.node);
        const hasExplicitReturn2 = this.hasExplicitReturnType(method2.node);
        // 特殊处理get/set访问器的默认返回类型情况
        if (method1.isAccessor && method2.isAccessor && method1.accessorType !== method2.accessorType) {
            return this.checkAccessorsReturnTypeCompatibility(method1, method2, returnType1, returnType2);
        } else if (returnType1 && returnType2) {
            // 检查普通方法的返回类型
            if (hasExplicitReturn1 && hasExplicitReturn2 && returnType1 !== returnType2) {
                return { isCompatible: false, reason: 'Return types are different' };
            }
            // 检查返回类型显式性不匹配
            if ((hasExplicitReturn1 && !hasExplicitReturn2) || (!hasExplicitReturn1 && hasExplicitReturn2)) {
                return { isCompatible: false, reason: 'Cannot unify explicit return type with implicit return type' };
            }
        }
        return { isCompatible: true, reason: '' };
    };

    // 检查访问器返回类型兼容性
    private checkAccessorsReturnTypeCompatibility(
        method1: Method,
        method2: Method,
        returnType1: string | null,
        returnType2: string | null
    ): { isCompatible: boolean; reason: string } {
        const isGetter1 = method1.accessorType === 'get';
        // 检查是否是默认类型情况
        const getterMethod = isGetter1 ? method1 : method2;
        const getterNode = getterMethod.node as ts.GetAccessorDeclaration;
        // 只有在默认类型情况下允许类型不匹配
        const isGetterDefault = !getterNode.type && (returnType1 === 'any' || returnType2 === 'any');
        const isSetterDefault = returnType1 === 'void' || returnType2 === 'void';
        if (!(isGetterDefault && isSetterDefault)) {
            return { isCompatible: false, reason: 'Accessor return types are incompatible' };
        }
        // 在默认类型情况下，允许统一
        return { isCompatible: true, reason: '' };
    };

    // 检查具有相同参数数量的方法
    private checkMethodsWithSameParamCount(method1: Method, method2: Method, number: number): { canUnify: boolean; reason: string; paramInfo?: any } {
        // 检查是否有剩余参数
        const hasRestParam = method1.parameters!.some(p => p.isRest) || method2.parameters!.some(p => p.isRest);
        if (hasRestParam) {
            return { canUnify: false, reason: 'Cannot unify methods with rest parameters when parameter count is the same' };
        }
        // 检查是否有可选参数
        const hasOptionalParam = method1.parameters!.some(p => p.isOptional) || method2.parameters!.some(p => p.isOptional);
        if (hasOptionalParam) {
            return { canUnify: false, reason: 'Cannot unify methods with optional parameters when parameter count is the same' };
        }
        // 检查是否可以合并为联合类型
        const canMergeAsUnion = this.canMergeAsUnionType(method1, method2, number);
        if (canMergeAsUnion.canMerge) {
            return {
                canUnify: true,
                reason: `${canMergeAsUnion.details}`,
                paramInfo: {
                    ...canMergeAsUnion.paramInfo,
                    methodIndex: 0
                }
            };
        }
        return { canUnify: false, reason: 'Cannot unify methods with same parameter count' };
    };

    // 检查具有不同参数数量的方法
    private checkMethodsWithDifferentParamCount(method1: Method, method2: Method): { canUnify: boolean; reason: string; paramInfo?: any } {
        // 确定哪个方法有更多参数
        const longerMethod = method1.parameters!.length > method2.parameters!.length ? method1 : method2;
        const shorterMethod = method1.parameters!.length > method2.parameters!.length ? method2 : method1;
        // 确保两个方法都有参数且参数不为空
        if (longerMethod.parameters!.length > 0 && shorterMethod.parameters!.length > 0) {
            // 检查第一个参数是否相同
            const firstParam1 = longerMethod.parameters![0];
            const firstParam2 = shorterMethod.parameters![0];
            if (firstParam1.name !== firstParam2.name || firstParam1.type !== firstParam2.type) {
                return { canUnify: false, reason: 'First parameters are different' };
            }
        }
        // 检查是否可以合并为可选参数或剩余参数
        const canMergeAsOptional = this.canMergeAsOptionalOrRest(method1, method2);
        if (canMergeAsOptional.canMerge) {
            return {
                canUnify: true,
                reason: canMergeAsOptional.details,
                paramInfo: {
                    ...canMergeAsOptional.paramInfo,
                    methodIndex: method1.parameters!.length > method2.parameters!.length ? 0 : 1
                }
            };
        }
        return { canUnify: false, reason: 'Cannot unify methods with different parameter count' };
    };

    private hasExplicitReturnType(node: ts.Node | undefined): boolean {
        if (!node) {
            return false;
        };
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
            return node.type !== undefined;
        } else if (ts.isGetAccessorDeclaration(node)) {
            return node.type !== undefined;
        } else if (ts.isSetAccessorDeclaration(node)) {
            // 设置器总是有明确的void返回类型
            return true;
        }
        return false;
    };

    private getReturnType(node: ts.Node | undefined): string | null {
        if (!node) {
            return null;
        };

        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
            return node.type ? node.type.getText() : 'void';
        } else if (ts.isGetAccessorDeclaration(node)) {
            return node.type ? node.type.getText() : 'any';
        } else if (ts.isSetAccessorDeclaration(node)) {
            return 'void';
        }
        return null;
    };

    // 辅助方法：检查类型是否为泛型数组类型
    private isGenericArrayType(type: string): boolean {
        // 简单判断是否符合 T[] 格式
        return /^[A-Z](\[\])+$/.test(type);
    };

    // 添加新的辅助方法: 检查类型是否为泛型类型(包括单字母泛型和泛型数组)
    private isGenericType(type: string): boolean {
        // 检查单字母泛型(如T)或泛型数组(如T[])
        return /^[A-Z](\[\])*$/.test(type);
    };

    private canMergeAsUnionType(
        method1: Method,
        method2: Method,
        number: number): {
            canMerge: boolean;
            details: string;
            paramInfo?: {
                line: number;
                character: number;
                endCol: number;
                name: string;
                type1: string;
                type2: string;
                isOptional1: boolean;
                isOptional2: boolean;
                methodIndex?: number
            }
        } {
        // 检查参数长度是否匹配
        if (!method1.parameters || !method2.parameters || method1.parameters.length !== method2.parameters.length) {
            return { canMerge: false, details: '' };
        }
        // 检查交叉依赖和类型兼容性
        if (!this.areParametersCompatibleForUnion(method1.parameters, method2.parameters)) {
            return { canMerge: false, details: '' };
        }
        // 查找参数差异
        const differences = this.findParameterDifferences(method1.parameters, method2.parameters);
        // 分析差异并生成报告
        return this.analyzeDifferencesForUnion(differences, method1, number);
    };

    // 检查参数是否兼容合并为联合类型
    private areParametersCompatibleForUnion(params1: Parameter[], params2: Parameter[]): boolean {
        // 检查是否存在参数间的交叉依赖关系
        if (params1.length >= 2) {
            const paramDiffs = this.collectParameterTypeDifferences(params1, params2);
            // 检查交叉依赖
            if (paramDiffs.length >= 2 && this.hasCrossDependency(paramDiffs, params1, params2)) {
                return false;
            }
        }
        // 检查泛型兼容性
        return this.checkGenericCompatibility(params1, params2);
    };

    // 收集参数类型差异
    private collectParameterTypeDifferences(params1: Parameter[], params2: Parameter[]): { pos: number, type1: string, type2: string }[] {
        const paramDiffs: { pos: number, type1: string, type2: string }[] = [];
        for (let i = 0; i < params1.length; i++) {
            const param1 = params1[i];
            const param2 = params2[i];
            if (param1.type !== param2.type) {
                paramDiffs.push({
                    pos: i,
                    type1: param1.type,
                    type2: param2.type
                });
            }
        }
        return paramDiffs;
    }

    // 检查参数之间是否存在交叉依赖
    private hasCrossDependency(
        paramDiffs: { pos: number, type1: string, type2: string }[],
        params1: Parameter[],
        params2: Parameter[]
    ): boolean {
        for (let i = 0; i < paramDiffs.length; i++) {
            for (let j = i + 1; j < paramDiffs.length; j++) {
                const diff1 = paramDiffs[i];
                const diff2 = paramDiffs[j];
                // 检查交叉模式: A的type1对应B的type2，A的type2对应B的type1
                if ((diff1.type1 === diff2.type2 && diff1.type2 === diff2.type1) ||
                    (diff1.type1 === params1[diff2.pos].type && diff1.type2 === params2[diff2.pos].type)) {
                    return true;
                }
            }
        }
        return false;
    };

    // 检查泛型类型兼容性
    private checkGenericCompatibility(params1: Parameter[], params2: Parameter[]): boolean {
        for (let i = 0; i < params1.length; i++) {
            const param1 = params1[i];
            const param2 = params2[i];
            // 检查是否一个是泛型而另一个不是泛型
            const isParam1Generic = this.isGenericType(param1.type);
            const isParam2Generic = this.isGenericType(param2.type);

            if (isParam1Generic !== isParam2Generic) {
                return false;
            }
        }
        return true;
    };

    // 查找参数差异
    private findParameterDifferences(params1: Parameter[], params2: Parameter[]): {
        index: number;
        type1: string;
        type2: string;
        isOptional1: boolean;
        isOptional2: boolean;
        line: number;
        character: number;
        endCol: number;
        name: string;
        methodIndex: number;
        hasDifferentNames: boolean;
    }[] {
        const differences: {
            index: number;
            type1: string;
            type2: string;
            isOptional1: boolean;
            isOptional2: boolean;
            line: number;
            character: number;
            endCol: number;
            name: string;
            methodIndex: number;
            hasDifferentNames: boolean;
        }[] = [];

        for (let i = 0; i < params1.length; i++) {
            const param1 = params1[i];
            const param2 = params2[i];
            // 检查参数类型是否不同或可选性不同
            if (param1.type !== param2.type || param1.isOptional !== param2.isOptional) {
                differences.push({
                    index: i,
                    type1: param1.type,
                    type2: param2.type,
                    isOptional1: param1.isOptional,
                    isOptional2: param2.isOptional,
                    line: param2.line,
                    character: param2.character,
                    endCol: param2.endCol,
                    name: param2.name,
                    methodIndex: 0,
                    hasDifferentNames: param1.name !== param2.name
                });
            }
        }
        return differences;
    };

    // 分析差异并生成报告
    private analyzeDifferencesForUnion(
        differences: {
            index: number;
            type1: string;
            type2: string;
            isOptional1: boolean;
            isOptional2: boolean;
            line: number;
            character: number;
            endCol: number;
            name: string;
            methodIndex: number;
            hasDifferentNames: boolean;
        }[],
        method1: Method,
        number: number
    ): {
        canMerge: boolean;
        details: string;
        paramInfo?: {
            line: number;
            character: number;
            endCol: number;
            name: string;
            type1: string;
            type2: string;
            isOptional1: boolean;
            isOptional2: boolean;
            methodIndex?: number;
        };
    } {
        if (differences.length > 0) {
            const hasDifferentNames = differences.some(diff => diff.hasDifferentNames);
            if (this.defaultOption[0].ignoreDifferentlyNamedParameters && hasDifferentNames) {
                return { canMerge: false, details: '' };
            }
            const details = this.generateUnionMergeDetails(differences, method1, number);
            return {
                canMerge: true,
                details,
                paramInfo: {
                    line: differences[0].line,
                    character: differences[0].character,
                    endCol: differences[0].endCol,
                    name: differences[0].name,
                    type1: differences[0].type1,
                    type2: differences[0].type2,
                    isOptional1: differences[0].isOptional1,
                    isOptional2: differences[0].isOptional2,
                    methodIndex: differences[0].methodIndex
                }
            };
        }
        return { canMerge: false, details: '' };
    };

    // 生成联合类型合并详情
    private generateUnionMergeDetails(
        differences: {
            index: number;
            type1: string;
            type2: string;
            isOptional1: boolean;
            isOptional2: boolean;
            line: number;
            character: number;
            endCol: number;
            name: string;
            methodIndex: number;
            hasDifferentNames: boolean;
        }[],
        method1: Method,
        number: number
    ): string {
        return differences.map(diff => {
            if (diff.isOptional1 !== diff.isOptional2) {
                return `These overloads can be combined into one signature taking '${diff.type1} | ${diff.type2}'.`;
            } else {
                return number > 2 ?
                    `This overload and the one on line ${method1.line} can be combined into one signature taking '${diff.type1} | ${diff.type2}'.` :
                    `These overloads can be combined into one signature taking '${diff.type1} | ${diff.type2}'.`;
            }
        }).join(', ');
    };

    private canMergeAsOptionalOrRest(method1: Method, method2: Method): {
        canMerge: boolean;
        details: string;
        paramInfo?: {
            line: number;
            character: number;
            endCol: number;
            name: string;
            isRest: boolean;
            isReordered?: boolean;
            methodIndex?: number
        }
    } {
        // 基本验证检查
        if (!method1.parameters || !method2.parameters) {
            return { canMerge: false, details: '' };
        }
        // 检查是否涉及泛型数组类型的特殊情况
        if (this.hasSpecialGenericArrayCase(method1, method2)) {
            return { canMerge: false, details: '' };
        }
        // 确定参数较长和较短的方法
        const { longerMethod, shorterMethod } = this.identifyMethodsByParamLength(method1, method2);
        // 检查是否可以通过可选参数合并
        const optionalMergeResult = this.checkOptionalParameterMerge(longerMethod, shorterMethod, method1, method2);
        if (optionalMergeResult.canMerge) {
            return optionalMergeResult;
        }
        // 检查是否可以通过参数重排序合并
        return this.checkParameterReorderingMerge(method1, method2);
    };

    // 检查是否存在泛型数组的特殊情况
    private hasSpecialGenericArrayCase(method1: Method, method2: Method): boolean {
        if (method1.parameters!.length === 0 && method2.parameters!.length === 1) {
            return this.isGenericArrayType(method2.parameters![0].type);
        } else if (method2.parameters!.length === 0 && method1.parameters!.length === 1) {
            return this.isGenericArrayType(method1.parameters![0].type);
        }
        return false;
    };

    // 确定哪个方法有更多参数
    private identifyMethodsByParamLength(method1: Method, method2: Method): {
        longerMethod: Method,
        shorterMethod: Method
    } {
        return method1.parameters!.length > method2.parameters!.length
            ? { longerMethod: method1, shorterMethod: method2 }
            : { longerMethod: method2, shorterMethod: method1 };
    }

    // 检查是否可以通过可选参数合并
    private checkOptionalParameterMerge(
        longerMethod: Method,
        shorterMethod: Method,
        originalMethod1: Method,
        originalMethod2: Method
    ): {
        canMerge: boolean;
        details: string;
        paramInfo?: {
            line: number;
            character: number;
            endCol: number;
            name: string;
            isRest: boolean;
            methodIndex?: number
        }
    } {
        // 检查前面的参数是否相同
        if (!this.haveIdenticalPrefixParameters(longerMethod, shorterMethod)) {
            return { canMerge: false, details: '' };
        }
        // 检查多出的参数
        const extraParam = longerMethod.parameters![longerMethod.parameters!.length - 1];
        // 检查是否可以作为可选参数
        if (!extraParam.isRest) {
            return {
                canMerge: true,
                details: `These overloads can be combined into one signature with an optional parameter.`,
                paramInfo: {
                    line: extraParam.line,
                    character: extraParam.character,
                    endCol: extraParam.endCol,
                    name: extraParam.name,
                    isRest: false,
                    methodIndex: originalMethod1.parameters!.length > originalMethod2.parameters!.length ? 0 : 1
                }
            };
        }
        // 检查是否可以作为剩余参数
        if (extraParam.isRest) {
            return {
                canMerge: true,
                details: `These overloads can be combined into one signature with an optional parameter.`,
                paramInfo: {
                    line: extraParam.line,
                    character: extraParam.character,
                    endCol: extraParam.endCol,
                    name: extraParam.name,
                    isRest: true,
                }
            };
        }
        return { canMerge: false, details: '' };
    };

    // 检查前面的参数是否完全相同
    private haveIdenticalPrefixParameters(longerMethod: Method, shorterMethod: Method): boolean {
        for (let i = 0; i < shorterMethod.parameters!.length; i++) {
            const param1 = longerMethod.parameters![i];
            const param2 = shorterMethod.parameters![i];

            if (param1.name !== param2.name || param1.type !== param2.type) {
                return false;
            }
        }
        return true;
    };

    // 检查是否可以通过参数重排序合并
    private checkParameterReorderingMerge(method1: Method, method2: Method): {
        canMerge: boolean;
        details: string;
        paramInfo?: {
            line: number;
            character: number;
            endCol: number;
            name: string;
            isRest: boolean;
            isReordered?: boolean;
        }
    } {
        // 检查参数集合是否相同但顺序不同
        if (!this.hasSameParametersInDifferentOrder(method1, method2)) {
            return { canMerge: false, details: '' };
        }
        // 找到第一个不同的参数
        for (let i = 0; i < method1.parameters!.length; i++) {
            const param1 = method1.parameters![i];
            const param2 = method2.parameters![i];
            if (param1.name !== param2.name) {
                return {
                    canMerge: true,
                    details: `Parameters can be reordered to match the other overload`,
                    paramInfo: {
                        line: param2.line,
                        character: param2.character,
                        endCol: param2.endCol,
                        name: param2.name,
                        isRest: false,
                        isReordered: true,
                    }
                };
            }
        }
        return { canMerge: false, details: '' };
    };

    // 检查参数名称集合是否相同但顺序不同
    private hasSameParametersInDifferentOrder(method1: Method, method2: Method): boolean {
        const paramNames1 = method1.parameters!.map(p => p.name);
        const paramNames2 = method2.parameters!.map(p => p.name);
        return paramNames1.length === paramNames2.length &&
            paramNames1.every(name => paramNames2.includes(name)) &&
            paramNames2.every(name => paramNames1.includes(name));
    }
};

interface Method {
    name: string;
    static: boolean;
    line: number;
    character: number;
    endCol: number;
    isAccessor?: boolean;
    accessorType?: 'get' | 'set' | 'both';
    parameters?: Parameter[];
    node?: ts.Node;
    unificationReason?: string;
    paramInfo?: any;
    hasImplementation: boolean;
};

interface Parameter {
    name: string;
    type: string;
    isOptional: boolean;
    isRest: boolean;
    line: number;
    character: number;
    endCol: number;
};