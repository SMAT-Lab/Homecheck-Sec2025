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
    ts,
    ArkFile,
    AstTreeUtils,
    ArkMethod,
    Local,
    UnclearReferenceType,
    FunctionType,
    ArkAliasTypeDefineStmt,
    AliasType,
    UnionType,
    ArkClass,
    ArkAssignStmt,
    Type,
    VoidType,
    ClassType,
    ArkNewExpr,
    ArrayType,
    GenericType,
    ArkInvokeStmt,
    IntersectionType,
    UnknownType,
    Stmt
} from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { KeyofTypeExpr } from 'arkanalyzer/lib/core/base/TypeExpr';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoInvalidVoidTypeCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-invalid-void-type-check.md',
    description: 'Disallow `void` type outside of generic or return types',
    messages: {
        invalidVoidForGeneric:
            '{{ generic }} may not have void as a type argument.',
        invalidVoidNotReturn: 'void is only valid as a return type.',
        invalidVoidNotReturnOrGeneric:
            'void is only valid as a return type or generic type argument.',
        invalidVoidNotReturnOrThisParam:
            'void is only valid as return type or type of `this` parameter.',
        invalidVoidNotReturnOrThisParamOrGeneric:
            'void is only valid as a return type or generic type argument or the type of a `this` parameter.',
        invalidVoidUnionConstituent:
            'void is not valid as a constituent in a union type',
    },
    defaultOptions: { allowInGenericTypeArguments: true, allowAsThisParameter: false }
};

enum CheckType {
    ReturnType,
    GenericTypeArgument,
    ThisParameter,
    leftOp,
    rightOp,
    DefaultCase,
    NewExpr,
    Constraint,
    UnionType
}

type Options = {
    allowAsThisParameter?: boolean;
    allowInGenericTypeArguments?: [string, ...string[]] | boolean;
}

// 错误位置信息接口
interface ErrorPosition {
    line: number;
    colum: number;
    message: string;
    sourceCode: string;
    generic?: string;
}

export class NoInvalidVoidTypeCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private globleStmt: Stmt;
    private globleArkFile: ArkFile;
    private line: number = 0;
    private column: number = 0;
    private useMethods: string[] = [];
    private useCls: string[] = [];

    public registerMatchers(): MatcherCallback[] {
        const fileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileCb];
    }

    private getOption(): Options {
        let option = this.metaData.defaultOptions;
        if (this.rule && this.rule.option[0]) {
            option = this.rule.option[0] as Options;
        }
        return option;
    }

    /**
     * 在AST中查找类型节点的位置
     */
    private typeCheck(node: ts.TypeNode, astTree: ts.Node, position: { line: number, column: number }): void {
        if (node.kind === ts.SyntaxKind.VoidKeyword) {
            let { line, character } = astTree.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
            position.line = line;
            position.column = character;
        }
        this.checkTypeNode(node, astTree, position);
    }

    /**
     * 检查各种类型节点
     */
    private checkTypeNode(node: ts.TypeNode, astTree: ts.Node, position: { line: number, column: number }): void {
        if (ts.isParenthesizedTypeNode(node)) {
            this.typeCheck(node.type, astTree, position);
        }
        if (ts.isMappedTypeNode(node) && node.type) {
            this.typeCheck(node.type, astTree, position);
        }
        if (ts.isUnionTypeNode(node)) {
            node.types.forEach(ty => {
                this.typeCheck(ty, astTree, position);
            });
        }
        if (ts.isIntersectionTypeNode(node)) {
            node.types.forEach(ty => {
                this.typeCheck(ty, astTree, position);
            });
        }
        if (ts.isTypeLiteralNode(node)) {
            node.members.forEach(property => {
                if (ts.isPropertySignature(property) && property.type) {
                    this.typeCheck(property.type, astTree, position);
                }
            });
        }
        if (ts.isFunctionTypeNode(node) && ts.isTypeAliasDeclaration(astTree)) {
            this.typeCheck(node.type, astTree, position);
        }
        if (ts.isArrayTypeNode(node)) {
            this.typeCheck(node.elementType, astTree, position);
        }
        if (ts.isConditionalTypeNode(node)) {
            this.typeCheck(node.checkType, astTree, position);
            this.typeCheck(node.extendsType, astTree, position);
            this.typeCheck(node.trueType, astTree, position);
            this.typeCheck(node.falseType, astTree, position);
        }
        if (ts.isTypeOperatorNode(node)) {
            this.typeCheck(node.type, astTree, position);
        }
        if (ts.isTypeReferenceNode(node) && node.typeArguments) {
            node.typeArguments.forEach(argument => {
                this.typeCheck(argument, astTree, position);
            });
        }
        if ((ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) && node.type) {
            this.typeCheck(node.type, astTree, position);
        }
    }

    /**
     * 获取AST节点位置
     */
    private getASTNodePosition(code: string, type: CheckType): { line: number, column: number } {
        let position: { line: number, column: number } = { line: 0, column: 0 };
        let astTree = AstTreeUtils.getASTNode('temp', code);
        let rootNode = astTree.statements[0];
        this.traverseNode(astTree, type, position, rootNode);
        return position;
    }

    private checkTypeParameter(node: ts.TypeParameterDeclaration, type: CheckType, position: { line: number, column: number },
        astTree: ts.Node): boolean {
        if (type === CheckType.Constraint && node.constraint) {
            this.typeCheck(node.constraint, astTree, position);
            return true;
        }
        if (type === CheckType.DefaultCase && node.default) {
            this.typeCheck(node.default, astTree, position);
            return true;
        }
        return false;
    }

    private checkFunctionLike(node: ts.Node, type: CheckType, position: { line: number, column: number },
        astTree: ts.Node): boolean {
        if (type === CheckType.ReturnType && (node as ts.FunctionLikeDeclaration).type) {
            this.typeCheck((node as ts.FunctionLikeDeclaration).type as ts.TypeNode, astTree, position);
            return true;
        }
        if (type === CheckType.ThisParameter && (node as ts.FunctionLikeDeclaration).parameters.length > 0) {
            (node as ts.FunctionLikeDeclaration).parameters.forEach((param: ts.ParameterDeclaration) => {
                if (param.type) {
                    this.typeCheck(param.type, astTree, position);
                }
            });
            return true;
        }
        return false;
    }

    private checkVariableDeclaration(node: ts.VariableDeclaration, type: CheckType, position: { line: number, column: number },
        astTree: ts.Node): boolean {
        if (node.type && type === CheckType.leftOp) {
            this.typeCheck(node.type, astTree, position);
            return true; // 停止遍历
        }
        if (node.initializer && ts.isNewExpression(node.initializer) &&
            node.initializer.typeArguments && type === CheckType.rightOp) {
            node.initializer.typeArguments.forEach(argument => {
                this.typeCheck(argument, astTree, position);
            });
            return true; // 停止遍历
        }
        return false;
    }

    /**
     * 遍历AST节点
     */
    private traverseNode(node: ts.Node, type: CheckType, position: { line: number, column: number },
        astTree: ts.Node): boolean {
        let hasFound = false;

        // 检查函数声明类型节点
        if (this.isFunctionLikeNode(node)) {
            hasFound = this.checkFunctionLike(node, type, position, astTree);
        }

        // 检查类型参数声明
        if (ts.isTypeParameterDeclaration(node)) {
            hasFound = this.checkTypeParameter(node, type, position, astTree) || hasFound;
        }

        // 检查映射类型节点
        if (ts.isMappedTypeNode(node) && node.type) {
            this.typeCheck(node.type, astTree, position);
            hasFound = true;
        }

        // 检查void表达式
        if (type === CheckType.ThisParameter && node.kind === ts.SyntaxKind.VoidExpression) {
            let { line, character } = astTree.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
            position.line = line;
            position.column = character;
            hasFound = true;
        }

        if (ts.isTypeAliasDeclaration(node)) {
            this.typeCheck(node.type, astTree, position);
            hasFound = true;
        }

        // 检查调用表达式的类型参数
        if (ts.isCallExpression(node)) {
            for (const typeArgument of node.typeArguments ?? []) {
                this.typeCheck(typeArgument, astTree, position);
                hasFound = true;
            }
        }

        // 检查变量声明
        if (ts.isVariableDeclaration(node)) {
            hasFound = this.checkVariableDeclaration(node, type, position, astTree) || hasFound;
        }

        // 检查类型节点
        if (ts.isTypeNode(node)) {
            this.typeCheck(node as ts.TypeNode, astTree, position);
        }


        if (hasFound) {
            return true;
        }
        // 继续遍历子节点
        return node.forEachChild(childNode => {
            if (this.traverseNode(childNode, type, position, astTree)) {
                return true; // 停止遍历
            }
            return false;
        }) || false;
    }

    /**
     * 判断是否为函数相关节点
     */
    private isFunctionLikeNode(node: ts.Node): boolean {
        return (
            ts.isFunctionDeclaration(node) ||
            ts.isArrowFunction(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isFunctionTypeNode(node) ||
            ts.isFunctionLike(node)
        );
    }

    /**
     * 添加错误报告
     */
    private report(line: number, colum: number, messageId: string,
        errorPositions: ErrorPosition[], generic?: string): void {
        errorPositions.push({
            line: line,
            colum: colum,
            message: messageId,
            sourceCode: 'void',
            generic
        });
    }

    /**
     * 检查泛型类型参数
     */
    private checkGenericTypeArgument(type: Type, originalText: string,
        checkType: CheckType, errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean,
        genericName?: string): void {
        let invalidType = [ClassType, AliasType, UnclearReferenceType, ArrayType];

        if (!(invalidType.some(inType => type instanceof inType) || type instanceof GenericType)) {
            return;
        }

        if (Array.isArray(allowInGenericTypeArguments)) {
            if (!genericName) {
                return;
            }
            genericName = genericName?.replace(/ /g, '');
            if (!allowInGenericTypeArguments.map(s => s.replace(/ /g, '')).includes(genericName)) {
                let position = this.getASTNodePosition(originalText, checkType);
                if (position.column > 0) {
                    this.report(
                        position.line + this.line,
                        position.column + this.column,
                        'invalidVoidForGeneric',
                        errorPositions,
                        genericName
                    );
                }
            }
            return;
        }

        if (!allowInGenericTypeArguments) {
            let position = this.getASTNodePosition(originalText, checkType);
            if (position.column > 0) {
                this.report(
                    position.line + this.line,
                    position.column + this.column,
                    allowAsThisParameter ? 'invalidVoidNotReturnOrThisParam' : 'invalidVoidNotReturn',
                    errorPositions
                );
            }
        }
    }

    /**
     * 检查联合类型是否有效
     */
    private isValidUnionType(type: UnionType): boolean {
        return type.getTypes().every(member => {
            let types;
            if (member instanceof AliasType) {
                types = member.getRealGenericTypes();
            }
            if (member instanceof ClassType) {
                types = member.getRealGenericTypes();
                if (!types) {
                    let arkCls = this.globleArkFile.getClassWithName(member.getClassSignature().getClassName().toString());

                }
            }
            if (member instanceof UnclearReferenceType) {
                types = member.getGenericTypes();
            }
            return ['void', 'never'].includes(member.getTypeString()) ||
                (types && types.some(type => type.getTypeString() === 'void'));
        });
    }

    /**
     * 获取消息ID
     */
    private getNotReturnOrGenericMessageId(type: Type): string {
        return type instanceof UnionType ?
            'invalidVoidUnionConstituent' : 'invalidVoidNotReturnOrGeneric';
    }

    /**
     * 处理类和别名类型
     */
    private handleClassOrAliasType(type: Type, originalText: string,
        checkType: CheckType, errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): void {
        let genericName: string = '';
        let types: Type[] | undefined;

        if (type instanceof ClassType) {
            genericName = type.getClassSignature().getClassName().toString();
            types = type.getRealGenericTypes();
        } else if (type instanceof AliasType) {
            genericName = type.getName();
            types = type.getRealGenericTypes();
        } else if (type instanceof UnclearReferenceType) {
            genericName = type.getName();
            types = type.getGenericTypes();
        }

        if (checkType === CheckType.NewExpr) {
            if (allowInGenericTypeArguments === true) {
                return;
            }
            types?.forEach(subType => {
                this.checkVoidType(subType, originalText, checkType,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            });
            return;
        }

        if (types?.some(ty => ty instanceof VoidType)) {
            this.checkGenericTypeArgument(type, originalText, checkType,
                errorPositions, allowInGenericTypeArguments,
                allowAsThisParameter, genericName);
        }
    }

    /**
     * 处理数组类型
     */
    private handleArrayType(type: ArrayType, originalText: string,
        checkType: CheckType, errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): void {
        if (type.getBaseType() instanceof VoidType) {
            if (/Array<.*?>/.test(originalText)) {
                this.checkGenericTypeArgument(type, originalText, checkType,
                    errorPositions, allowInGenericTypeArguments,
                    allowAsThisParameter, 'Array');
            } else {
                this.checkVoidType(type.getBaseType(), originalText, checkType,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            }
        }
    }

    /**
     * 处理联合类型
     */
    private handleUnionType(type: UnionType, originalText: string,
        checkType: CheckType, errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): boolean {
        let isValid = this.isValidUnionType(type);
        if (isValid) {
            for (const ty of type.getTypes()) {
                if (!(ty instanceof VoidType)) {
                    this.checkVoidType(ty, originalText, checkType,
                        errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
                }
            }
        }
        return isValid;
    }

    /**
     * 处理Void或Unknown类型
     */
    private handleVoidOrUnknownType(type: Type, originalText: string,
        checkType: CheckType, errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): void {
        let position;

        if (type instanceof UnknownType) {
            position = this.getASTNodePosition(originalText, checkType);
            if (position.column === 0) {
                return;
            }
        }
        if (type instanceof VoidType || type instanceof UnionType || type instanceof IntersectionType || position) {
            if (!position) {
                position = this.getASTNodePosition(originalText, checkType);
            }
            let messageId =
                allowInGenericTypeArguments && allowAsThisParameter ?
                    'invalidVoidNotReturnOrThisParamOrGeneric' : allowInGenericTypeArguments ?
                        this.getNotReturnOrGenericMessageId(type) : allowAsThisParameter ?
                            'invalidVoidNotReturnOrThisParam' : 'invalidVoidNotReturn';

            if (position.column > 0) {
                this.report(position.line + this.line, position.column + this.column, messageId, errorPositions);
            }
        }
    }

    /**
     * 检查Void类型
     */
    private checkVoidType(type: Type, originalText: string,
        checkType: CheckType, errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): void {
        // 处理类类型、别名类型或不明确引用类型
        if (type instanceof ClassType || type instanceof AliasType || type instanceof UnclearReferenceType) {
            this.handleClassOrAliasType(type, originalText, checkType,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            return;
        }

        // 处理keyof类型表达式
        if (type instanceof KeyofTypeExpr) {
            this.checkVoidType(type.getOpType(), originalText, checkType,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
        }

        // 处理函数类型
        if (type instanceof FunctionType) {
            let methodName = type.getMethodSignature().getMethodSubSignature().getMethodName();
            let arkCls = this.globleStmt.getCfg()?.getDeclaringMethod()?.getDeclaringArkClass();

            let method = arkCls?.getMethodWithName(methodName)?.getSignature().getMethodSubSignature();
            method?.getParameters().forEach(parameter => {
                this.checkVoidType(parameter.getType(), originalText, checkType,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            });
            if (method?.getReturnType() instanceof VoidType) {
                return;
            }
            if (method?.getReturnType().getTypeString().includes('void')) {
                this.checkVoidType(method.getReturnType(), originalText, CheckType.ReturnType,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            }
        }

        // 处理泛型类型
        if (type instanceof GenericType) {
            const defaultType = type.getDefaultType();
            const constraint = type.getConstraint();

            if (defaultType) {
                this.checkGenericTypeArgument(type, originalText, CheckType.DefaultCase,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            }

            if (constraint) {
                this.checkVoidType(constraint, originalText, CheckType.Constraint,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            }
        }

        // 处理数组类型
        if (type instanceof ArrayType) {
            this.handleArrayType(type, originalText, checkType,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
        }

        // 处理联合类型
        if (type instanceof UnionType) {
            if (this.handleUnionType(type, originalText, checkType,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter)) {
                return;
            }
        }
        // 处理void类型或unknown类型
        this.handleVoidOrUnknownType(type, originalText, checkType,
            errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
    }

    /**
     * 分析类中的方法
     */
    private analyzeMethod(method: any, useMethods: string[], errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): void {
        const statements = method.getBody()?.getCfg().getStmts();
        if (statements) {
            statements.forEach((stmt: ArkAliasTypeDefineStmt | ArkAssignStmt | ArkInvokeStmt) => {
                this.analyzeStatement(stmt, useMethods, errorPositions,
                    allowInGenericTypeArguments, allowAsThisParameter);
            });
        }

        this.line = method.getLine() ?? method.getDeclareLines()?.at(0);
        this.column = method.getColumn() ?? method.getDeclareColumns()?.at(0);
        let methodCode = method.getCode();
        if (!this.line || !this.column || !methodCode) {
            return;
        }

        this.analyzeMethodParameters(method, methodCode,
            errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
    }

    /**
     * 分析方法参数
     */
    private analyzeMethodParameters(method: ArkMethod, methodCode: string,
        errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): void {
        for (const parameter of method.getParameters()) {
            if (allowAsThisParameter &&
                parameter.getType().getTypeString() === 'void' &&
                parameter.getName() === 'this') {
                continue;
            }
            if (parameter.getType().getTypeString().includes('void')) {
                this.checkVoidType(parameter.getType(), methodCode, CheckType.ThisParameter,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            }
        }

        const genericTypes = method.getGenericTypes();
        if (genericTypes) {
            genericTypes.forEach((genericType: Type) => {
                this.checkVoidType(genericType, methodCode, CheckType.GenericTypeArgument,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            });
        }

        if (method.getReturnType().getTypeString().includes('void')) {
            if (method.getReturnType() instanceof VoidType) {
                return;
            }
            this.checkVoidType(method.getReturnType(), methodCode, CheckType.ReturnType,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
        }
    }

    /**
     * 分析语句
     */
    private analyzeStatement(stmt: ArkAliasTypeDefineStmt | ArkAssignStmt | ArkInvokeStmt,
        useMethods: string[], errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): void {
        this.globleStmt = stmt;
        let originalText = stmt.getOriginalText() ?? '';
        this.line = stmt.getOriginPositionInfo().getLineNo();
        this.column = stmt.getOriginPositionInfo().getColNo();
        if (stmt instanceof ArkAliasTypeDefineStmt) {
            this.checkVoidType(stmt.getAliasType().getOriginalType(), originalText,
                CheckType.GenericTypeArgument, errorPositions,
                allowInGenericTypeArguments, allowAsThisParameter);
        } else if (stmt instanceof ArkAssignStmt) {
            this.analyzeAssignStatement(stmt, originalText, useMethods,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
        } else if (stmt instanceof ArkInvokeStmt) {
            const genericTypes = stmt.getInvokeExpr().getRealGenericTypes();
            if (genericTypes) {
                genericTypes.forEach((genericType: Type) => {
                    this.checkVoidType(genericType, originalText, CheckType.GenericTypeArgument,
                        errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
                });
            }
        }
    }

    /**
     * 分析赋值语句
     */
    private analyzeAssignStatement(stmt: ArkAssignStmt, originalText: string,
        useMethods: string[], errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[],
        allowAsThisParameter?: boolean): void {
        let rightType = stmt.getRightOp().getType();
        let leftType = stmt.getLeftOp().getType();
        if (leftType.getTypeString().includes('void')) {
            this.checkVoidType(stmt.getLeftOp().getType(), originalText, CheckType.leftOp,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
        }
        if (rightType instanceof FunctionType) {
            let method = rightType.getMethodSignature().getMethodSubSignature();
            useMethods.push(method.getMethodName());
            if (method.getReturnType() instanceof VoidType) {
                return;
            }
            if (method.getReturnType().getTypeString().includes('void')) {
                this.checkVoidType(method.getReturnType(), originalText, CheckType.ReturnType,
                    errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            }
        }

        if (stmt.getRightOp() instanceof ArkNewExpr) {
            this.checkVoidType(rightType, originalText, CheckType.NewExpr,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
        } else if (!(stmt.getRightOp() instanceof Local)) {
            this.checkVoidType(rightType, originalText, CheckType.rightOp,
                errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
        }
    }

    /**
     * 分析类的字段
     */
    private analyzeFields(cls: ArkClass, errorPositions: ErrorPosition[],
        allowInGenericTypeArguments: boolean | string[] | undefined,
        allowAsThisParameter?: boolean): void {
        cls.getFields().forEach(field => {
            let type = field.getSignature().getType();
            //这里 7 表示类属性方法
            if (field.getCategory() === 7 && type instanceof VoidType) {
                return;
            }
            this.line = field.getOriginPosition().getLineNo();
            this.column = field.getOriginPosition().getColNo();
            this.checkVoidType(type,
                field.getCode(),
                CheckType.ThisParameter,
                errorPositions,
                allowInGenericTypeArguments || false,
                allowAsThisParameter);
        });
    }

    /**
     * 获取错误位置
     */
    private getMessage(arkfile: ArkFile, option: Options): ErrorPosition[] {
        let errorPositions: ErrorPosition[] = [];
        const allowInGenericTypeArguments = option.allowInGenericTypeArguments;
        const allowAsThisParameter = option.allowAsThisParameter;

        arkfile.getClasses().forEach(cls => {
            if (this.useCls.includes(cls.getSignature().getClassName())) {
                return;
            }
            // 分析类的字段
            this.analyzeFields(cls, errorPositions, allowInGenericTypeArguments, allowAsThisParameter);
            this.useMethods = [];
            // 分析类的方法

            cls.getMethods().forEach(method => {
                //这些方法在其他表达式中已使用
                if (this.useMethods.includes(method.getName())) {
                    return;
                }
                this.analyzeMethod(method, this.useMethods, errorPositions,
                    allowInGenericTypeArguments || false, allowAsThisParameter);
            });
        });
        return errorPositions;
    }

    /**
     * 检查文件
     */
    public check = (target: ArkFile): void => {
        let options = this.getOption();
        this.globleArkFile = target;
        let errorPositions: ErrorPosition[] = this.getMessage(target, options);

        // 对错误位置排序
        errorPositions.sort((a, b) => {
            if (a.line !== b.line) {
                return a.line - b.line; // 先按行号排序
            }
            return a.colum - b.colum; // 行号相同时按列号排序
        });

        // 报告所有错误
        errorPositions.forEach(position => {
            this.addIssueReport(target, position.line, position.colum,
                position.sourceCode, position.message, position.generic);
        });
    }

    /**
     * 添加问题报告
     */
    private addIssueReport(arkFile: ArkFile, lineNum: number, startColum: number,
        code: string, messageId: string, generic: string = ''): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        let message = messageId !== 'invalidVoidForGeneric'
            ? this.metaData.messages[messageId]
            : `${generic} may not have void as a type argument.`;

        let filePath = arkFile.getFilePath();
        let endColum = startColum + code.length - 1;

        let defect = new Defects(
            lineNum,
            startColum,
            endColum,
            message,
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
}
