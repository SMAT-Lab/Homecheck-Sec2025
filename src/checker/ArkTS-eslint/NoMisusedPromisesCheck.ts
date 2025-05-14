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
    ts,
    ArkFile,
    AbstractExpr,
    ArkAssignStmt,
    NormalBinaryOperator,
    Value,
    Local,
    Type,
    ArkClass,
    Stmt,
    ArkPtrInvokeExpr,
    ArkStaticInvokeExpr,
    ArkNormalBinopExpr,
    ArkAwaitExpr,
    ArkInstanceInvokeExpr,
    FunctionType,
    ClassType,
    ArkNewExpr,
    NumberType,
    AstTreeUtils,
    ArrayType,
    UnknownType,
    ArkConditionExpr,
    ArkInvokeStmt,
    ArkIfStmt,
    UnionType,
    AliasType,
    IntersectionType,
    ArkInstanceFieldRef,
    ClassSignature,
    UnclearReferenceType,
    TupleType,
    LiteralType,
    ArkMethod,
    VoidType,
    ArkReturnStmt,
    ArkUnopExpr,
    AbstractInvokeExpr,
    UnaryOperator
} from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { MethodParameter } from 'arkanalyzer/lib/core/model/builder/ArkMethodBuilder';
import { ModifierType } from 'arkanalyzer/lib/core/model/ArkBaseModel';
import { TypeQueryExpr } from 'arkanalyzer/lib/core/base/TypeExpr';

const targetClasses = ['Promise', 'PromiseLike', 'PromiseConstructor'];
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoMisusedPromisesCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-misused-promises.md',
    description: 'Disallow Promises in places not designed to handle them',
    messages: {
        conditional: 'Expected non-Promise value in a boolean conditional.',
        spread: 'Expected a non-Promise value to be spreaded in an object.',
        voidReturnArgument:
            'Promise returned in function argument where a void return was expected.',
        voidReturnAttribute:
            'Promise-returning function provided to attribute where a void return was expected.',
        voidReturnProperty:
            'Promise-returning function provided to property where a void return was expected.',
        voidReturnReturnValue:
            'Promise-returning function provided to return value where a void return was expected.',
        voidReturnVariable:
            'Promise-returning function provided to variable where a void return was expected.',
    },
    defaultOptions: { checksConditionals: true, checksSpreads: true, checksVoidReturn: true }
};

type Options =
    {
        checksConditionals?: boolean;
        checksSpreads?: boolean;
        checksVoidReturn?:
        | boolean
        | ChecksVoidReturnOptions;
    };

interface ChecksVoidReturnOptions {
    arguments?: boolean;
    attributes?: boolean;
    properties?: boolean;
    returns?: boolean;
    variables?: boolean;
}

function parseCheckVoidReturn(checksVoidReturn: boolean | ChecksVoidReturnOptions | undefined): ChecksVoidReturnOptions | false {
    if (checksVoidReturn === false) {
        return false;
    }
    if (checksVoidReturn === true || checksVoidReturn === undefined) {
        return {
            arguments: true,
            attributes: true,
            properties: true,
            returns: true,
            variables: true,
        };
    }

    return {
        arguments: checksVoidReturn.arguments ?? true,
        attributes: checksVoidReturn.attributes ?? true,
        properties: checksVoidReturn.properties ?? true,
        returns: checksVoidReturn.returns ?? true,
        variables: checksVoidReturn.variables ?? true,
    };
}

const LogicalTypes = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken];

export class NoMisusedPromisesCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private globalArkCls: ArkClass;
    private globalArkFile: ArkFile;
    private globalArkMethod: ArkMethod;
    private globalNode: ts.Node;
    private globalStmt: Stmt;
    private useMethods: string[] = [];
    private errorPositions: { line: number, colum: number, message: string, sourceCode: string, generic?: string }[] = [];
    private visitedNodes = new Set<string>();
    private typeCache = new Map<string, boolean>();
    private methodCache = new Map<string, ArkMethod | undefined>();
    private readonly MAX_RECURSION_DEPTH = 3;

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchFileCb];
    }

    private getOption(): Options {
        let option = this.metaData.defaultOptions;
        if (this.rule && this.rule.option[0]) {
            option = this.rule.option[0] as Options;
        }
        return option;
    }

    private getNodeKey(value: Value | Stmt, node: ts.Node): string {
        return `${value.constructor.name}-${value instanceof Local ? value.getName() : value.constructor.name}-${node.getText()}`;
    }

    private getTypeKey(type: Type, cls?: ArkClass | null): string {
        return `${type.constructor.name}-${cls?.getSignature().getClassName() ?? 'null'}`;
    }

    private getMethodKey(cls: ArkClass, methodName: string): string {
        return `${cls.getSignature().getClassName()}-${methodName}`;
    }

    private getMethodWithCache(cls: ArkClass, methodName: string): ArkMethod | undefined {
        const key = this.getMethodKey(cls, methodName);
        if (this.methodCache.has(key)) {
            return this.methodCache.get(key);
        }
        const method = cls.getMethodWithName(methodName) ?? undefined;
        this.methodCache.set(key, method);
        return method;
    }

    private checkIsPromise(value: Local, node: ts.Node, cls?: ArkClass | null, depth: number = 0): boolean {
        if (depth > this.MAX_RECURSION_DEPTH) {
            return false;
        }

        if (!node) {
            return false;
        }

        const nodeKey = this.getNodeKey(value, node);
        if (this.visitedNodes.has(nodeKey)) {
            return false;
        }
        this.visitedNodes.add(nodeKey);

        try {
            const valueDeclar = value.getDeclaringStmt();
            const type = value.getType();

            if (type instanceof UnknownType) {
                return this.handleUnknownType(valueDeclar, node, cls);
            }

            const typeKey = this.getTypeKey(type, cls);
            if (this.typeCache.has(typeKey)) {
                return this.typeCache.get(typeKey) ?? false;
            }

            const isPromiseResult = this.isPromiseType(type, cls);
            this.typeCache.set(typeKey, isPromiseResult);

            if (isPromiseResult) {
                return true;
            }

            return this.checkDeclarationStatement(valueDeclar, node, depth, cls);
        } finally {
            this.visitedNodes.delete(nodeKey);
        }
    }

    private handleUnknownType(valueDeclar: Stmt | null, node: ts.Node, cls?: ArkClass | null): boolean {
        if (valueDeclar instanceof ArkAssignStmt) {
            return this.isPromise(valueDeclar.getRightOp(), this.getExpressionNode(node), cls);
        }
        return false;
    }

    private checkDeclarationStatement(valueDeclar: Stmt | null, node: ts.Node, depth: number, cls?: ArkClass | null): boolean {
        if (valueDeclar instanceof ArkAssignStmt) {
            return this.isPromise(valueDeclar.getRightOp(), node, cls, depth + 1);
        }
        return false;
    }

    private isPromiseType(type: Type, cls?: ArkClass | null): boolean {
        if (type instanceof LiteralType) {
            return false;
        }

        const typeKey = this.getTypeKey(type, cls);
        if (this.typeCache.has(typeKey)) {
            return this.typeCache.get(typeKey) ?? false;
        }

        const result = this.checkTypeForPromise(type, cls);
        this.typeCache.set(typeKey, result);
        return result;
    }

    private checkTypeForPromise(type: Type, cls?: ArkClass | null): boolean {
        if (type instanceof ClassType) {
            return this.checkIsPromiseCls(type);
        }
        if (type instanceof TupleType) {
            return type.getTypes().some(t => this.isPromiseType(t, cls));
        }
        if (type instanceof FunctionType) {
            return this.checkFunctionTypeForPromise(type, cls);
        }
        if (type instanceof ArrayType) {
            return this.isPromiseType(type.getBaseType(), cls);
        }
        if (type instanceof UnclearReferenceType) {
            return targetClasses.includes(type.getName());
        }
        if (type instanceof IntersectionType) {
            return type.getTypes().some(t => this.isPromiseType(t, cls));
        }
        if (type instanceof AliasType) {
            return this.isPromiseType(type.getOriginalType(), cls);
        }
        if (type instanceof UnionType) {
            return type.getTypes().some(t => this.isPromiseType(t, cls));
        }
        return false;
    }

    private checkFunctionTypeForPromise(type: FunctionType, cls?: ArkClass | null): boolean {
        const methodName = type.getMethodSignature().getMethodSubSignature().getMethodName();
        const arkMethod = this.getMethodWithCache(cls ?? this.globalArkCls, methodName);

        if (!this.useMethods.includes(methodName)) {
            this.useMethods.push(methodName);
        }

        if (arkMethod?.containsModifier(ModifierType.ASYNC)) {
            return true;
        }
        if (arkMethod?.getBodyBuilder()?.getGlobals()?.has('Promise')) {
            return true;
        }

        const returnType = arkMethod?.getSignature().getMethodSubSignature().getReturnType();
        if (returnType instanceof UnionType) {
            return returnType.getTypes().some(t => this.isPromiseType(t, cls));
        }
        if (returnType) {
            return this.isPromiseType(returnType, cls);
        }
        return false;
    }

    private getExpressionNode(node: ts.Node): ts.Node {
        if (node && (ts.isCallExpression(node) || ts.isIfStatement(node) || ts.isPropertyAccessExpression(node))) {
            return node.expression;
        }
        return node;
    }

    private checkConditional(stmt: Stmt | Value, node: ts.Node, checkRight: boolean = false): void {
        stmt = this.handleIfStatement(stmt);
        stmt = this.handleAssignStatement(stmt);

        if (!node || !this.isValidBinaryExpression(node)) {
            return;
        }

        node = this.handleParenthesizedExpression(node);
        stmt = this.handleLocalVariable(stmt, node);

        if (this.handleUnaryExpression(stmt, node)) {
            checkRight = true;
        }

        if (stmt instanceof ArkAssignStmt) {
            this.checkConditional(stmt.getRightOp(), node, checkRight);
            return;
        }

        if (stmt instanceof ArkConditionExpr) {
            this.handleConditionExpression(stmt, node, checkRight);
            return;
        }

        if (stmt instanceof ArkNormalBinopExpr && ts.isBinaryExpression(node)) {
            this.handleBinaryExpression(stmt, node, checkRight);
            return;
        }

        if (node && this.isPromiseLike(stmt, node)) {
            this.handlePromiseLikeExpression(node);
        }
    }

    private handleIfStatement(stmt: Stmt | Value): Stmt | Value {
        if (stmt instanceof ArkIfStmt) {
            return stmt.getConditionExpr();
        }
        return stmt;
    }

    private handleAssignStatement(stmt: Stmt | Value): Stmt | Value {
        if (stmt instanceof ArkAssignStmt) {
            const rightOp = stmt.getRightOp();
            const leftOp = stmt.getLeftOp();
            if (leftOp instanceof Local && leftOp.getUsedStmts().length > 0) {
                return stmt;
            }
            return rightOp;
        }
        return stmt;
    }

    private isValidBinaryExpression(node: ts.Node): boolean {
        if (node && ts.isBinaryExpression(node) && node.operatorToken && !LogicalTypes.includes(node.operatorToken.kind)) {
            return false;
        }
        return true;
    }

    private handleParenthesizedExpression(node: ts.Node): ts.Node {
        if (node && ts.isParenthesizedExpression(node)) {
            return node.expression;
        }
        return node;
    }

    private handleLocalVariable(stmt: Stmt | Value, node: ts.Node): Stmt | Value {
        if (stmt instanceof Local) {
            const declarStmt = stmt.getDeclaringStmt();
            if (declarStmt && declarStmt instanceof ArkAssignStmt) {
                this.checkConditional(declarStmt.getRightOp(), node, false);
                return stmt;
            }
        }
        return stmt;
    }

    private handleUnaryExpression(stmt: Stmt | Value, node: ts.Node): boolean {
        if (stmt instanceof ArkUnopExpr) {
            if (stmt.getOperator() !== UnaryOperator.LogicalNot) {
                return false;
            }
            return true;
        }
        return false;
    }

    private handleConditionExpression(stmt: ArkConditionExpr, node: ts.Node, checkRight: boolean): void {
        this.checkConditional(stmt.getOp1(), node, checkRight);
        this.checkConditional(stmt.getOp2(), node, checkRight);
    }

    private handleBinaryExpression(stmt: ArkNormalBinopExpr, node: ts.BinaryExpression, checkRight: boolean): void {
        if (node.left && (stmt.getOperator() !== NormalBinaryOperator.NullishCoalescing || checkRight)) {

            this.checkConditional(stmt.getOp1(), node.left, checkRight);

        }
        if (node.right && checkRight) {

            this.checkConditional(stmt.getOp2(), node.right, checkRight);

        }
    }

    private handlePromiseLikeExpression(node: ts.Node): void {
        let currentNode = node;

        if (this.isControlStatement(node)) {
            if (node && (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node))) {
                currentNode = node.expression;
            }
        }

        if (node && this.isVariableDeclaration(node)) {
            currentNode = this.getVariableDeclarationNode(node);
        }

        if (node && ts.isConditionalExpression(currentNode)) {
            currentNode = currentNode.condition;
        }

        if (node && ts.isForStatement(currentNode) && currentNode.condition) {
            currentNode = currentNode.condition;
        }

        if (node && ts.isPrefixUnaryExpression(currentNode)) {
            currentNode = currentNode.operand;
        }

        this.report('conditional', currentNode);
    }

    private isControlStatement(node: ts.Node): boolean {
        return ts.isIfStatement(node) ||
            ts.isWhileStatement(node) ||
            ts.isDoStatement(node);
    }

    private isVariableDeclaration(node: ts.Node): boolean {
        return ts.isVariableStatement(node) || ts.isVariableDeclaration(node);
    }

    private getVariableDeclarationNode(node: ts.Node): ts.Node {
        if (node && ts.isVariableStatement(node)) {
            node = node.declarationList.declarations[0];
        }
        if (node && ts.isVariableDeclaration(node) && node.initializer) {
            return node.initializer;
        }
        return node;
    }

    private isTestExprForBinaryExpression(node: ts.BinaryExpression): boolean {
        if (!node || !node.parent) {
            return false;
        }

        return ts.isIfStatement(node.parent) ||
            ts.isWhileStatement(node.parent) ||
            ts.isDoStatement(node.parent) ||
            (ts.isConditionalExpression(node.parent) && node.parent.condition === node);
    }

    report(messageId: string, node: ts.Node): void {
        if (node && ts.isParenthesizedExpression(node)) {
            node = node.expression;
            this.report(messageId, node);
            return;
        }
        let startLine = this.globalStmt.getOriginPositionInfo().getLineNo();
        let startCol = this.globalStmt.getOriginPositionInfo().getColNo();
        let { line, character } = this.globalNode.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
        startLine += line;
        character = startCol !== 1 ? (character + startCol) : character + 1;
        this.errorPositions.push({
            line: startLine,
            colum: character,
            message: messageId,
            sourceCode: node.getText()
        });
    }

    private checkIsPromiseCls(type: ClassType): boolean {
        if (targetClasses.includes(type.getClassSignature().getClassName())) {
            return true;
        } else {
            //自定义类中包含then方法，并且两个参数都是方法类型
            let declaringCls = this.globalArkFile.getClassWithName(type.getClassSignature().getClassName());
            if (!declaringCls) {
                return false;
            }
            //自定义类中包含then方法，并且两个参数都是方法类型
            if (this.checkIsCustemClsPromise(declaringCls)) {
                return true;
            }
            //自定义类继承自包含then方法的类，并且两个参数都是方法类型
            let heritageClassKeys = declaringCls.getAllHeritageClasses();
            let hasTargetClass = false;
            // 遍历 keys
            for (const clsName of heritageClassKeys) {
                if (targetClasses.includes(clsName.getName())) {
                    hasTargetClass = true;
                    break;
                }
            }
            return hasTargetClass;
        }
    }

    private checkIsCustemClsPromise(declaringCls: ArkClass): boolean {
        return declaringCls.getMethods().some(method => {
            let methodSignature = method.getSignature().getMethodSubSignature();
            return methodSignature.getMethodName() === 'then' &&
                methodSignature.getParameters().length === 2 &&
                methodSignature.getParameters().every(param => param instanceof MethodParameter);
        }) ||
            //自定义类继承自包含then方法的类，并且两个参数都是方法类型
            declaringCls?.getAllHeritageClasses().some(herCls => {
                return herCls.getMethods().some(method => {
                    let methodSignature = method.getSignature().getMethodSubSignature();
                    return methodSignature.getMethodName() === 'then' &&
                        methodSignature.getParameters().length === 2 &&
                        methodSignature.getParameters().every(param => param instanceof MethodParameter);
                });
            });
    }

    private isPromise(value: Value | Stmt, node: ts.Node, cls?: ArkClass | null, depth: number = 0): boolean {
        depth++;
        if (depth > this.MAX_RECURSION_DEPTH || this.isInVildNode(node) || value instanceof ArkAwaitExpr) {
            return false;
        }
        if (node && ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            targetClasses.includes(node.expression.text)) {
            return true;
        }
        if (value instanceof Local) {
            return this.checkIsPromise(value, node, cls, depth);
        }
        return this.checkAbsArkIsPromise(value, node, cls, depth);
    }

    private checkAbsArkIsPromise(value: Value | Stmt, node: ts.Node, cls?: ArkClass | null, depth: number = 0): boolean {
        if (value instanceof ArkInstanceFieldRef && this.checkFieldRefIsPromise(value, node)) {
            return true;
        }
        if (value instanceof ArkPtrInvokeExpr && this.checkPrtIsPromise(value)) {
            return true;
        }
        if (value instanceof ArkStaticInvokeExpr) {
            let methodSignature = value.getMethodSignature().getMethodSubSignature();
            let arkMethod = this.globalArkCls.getMethodWithName(methodSignature.getMethodName());
            if (arkMethod?.containsModifier(ModifierType.ASYNC)) {
                return true;
            }
            return this.isPromiseType(methodSignature.getReturnType());
        }
        if (value instanceof ArkNormalBinopExpr) {
            const op1 = value.getOp1();
            const op2 = value.getOp2();
            return this.isPromise(op1, node, cls, depth) || this.isPromise(op2, node, cls, depth);
        }
        if (value instanceof ArkInstanceInvokeExpr) {
            return this.isPromise(value.getBase(), this.getExpressionNode(node), cls, depth);
        }
        if (value instanceof ArkConditionExpr) {
            return this.isPromise(value.getOp1(), this.getExpressionNode(node), cls, depth) ||
                this.isPromise(value.getOp2(), node, cls, depth);
        }
        if (value instanceof ArkUnopExpr) {
            return this.isPromise(value.getOp(), node, cls, depth);
        }
        if (value instanceof ArkNewExpr) {
            return this.isPromiseType(value.getType(), cls);
        }
        return false;
    }

    private checkFieldRef(declarCls: ArkClass, value: ArkInstanceFieldRef, node: ts.Node): boolean {
        for (const field of declarCls?.getFields() ?? []) {
            if (node && field.getSignature().getFieldName() === value.getFieldSignature().getFieldName()) {
                return this.isPromiseType(field.getType()) ||
                    field.getInitializer().some(init => init instanceof ArkAssignStmt &&
                        this.isPromise(init.getRightOp(), node));
            }
        }
        return false;
    }

    private checkFieldRefIsPromise(value: ArkInstanceFieldRef, node: ts.Node): boolean {
        let declarSignature = value.getFieldSignature().getDeclaringSignature();
        if (declarSignature instanceof ClassSignature) {
            let declarCls = this.globalArkCls.getDeclaringArkFile().getClassWithName(declarSignature.getClassName());
            if (declarCls && node && this.checkFieldRef(declarCls, value, node)) {
                return true;
            }
        }
        return false;
    }

    isPromiseLike(value: Value | Stmt, node: ts.Node, cls?: ArkClass | null, depth: number = 0): boolean {
        if (value instanceof ArkAssignStmt) {
            return this.isPromise(value.getRightOp(), this.getExpressionNode(node), cls) ||
                this.isPromise(value.getLeftOp(), this.getExpressionNode(node), cls);
        }
        if (value instanceof ArkReturnStmt) {
            return this.isPromise(value.getOp(), this.getExpressionNode(node), cls);
        }
        if (value instanceof ArkInvokeStmt) {
            return this.isPromise(value.getInvokeExpr(), this.getExpressionNode(node), cls);
        }
        if (value instanceof Local || value instanceof AbstractExpr) {
            return this.isPromise(value, this.getExpressionNode(node), cls);
        }
        return false;
    }

    private isInVildNode(node: ts.Node): boolean {
        if (!node) {
            return true;
        }
        if (ts.isLiteralExpression(node) ||
            ts.isLiteralTypeNode(node) ||
            ts.isAwaitExpression(node)) {
            return true;
        }
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.questionDotToken) {
            return true;
        }
        if ([ts.SyntaxKind.NullKeyword, ts.SyntaxKind.UndefinedKeyword].includes(node.kind)) {
            return true;
        }
        return false;
    }

    private checkPrtIsPromise(value: ArkPtrInvokeExpr): boolean {
        let funcExpr = value.getFuncPtrLocal();
        if (!(funcExpr instanceof Local)) {
            return false;
        }
        let methodName = funcExpr.getName();
        let arkMethod = this.globalArkCls.getMethodWithName(methodName);
        let methodDeclar = funcExpr.getDeclaringStmt();
        if (methodDeclar && methodDeclar instanceof ArkAssignStmt) {
            let functionleftType = methodDeclar.getLeftOp().getType();
            let functionrightType = methodDeclar.getRightOp().getType();
            if ([functionleftType, functionrightType].some(funtype => funtype instanceof FunctionType && this.isPromiseType(funtype))) {
                return true;
            }
        }
        if (arkMethod?.containsModifier(ModifierType.ASYNC)) {
            return true;
        }
        return false;
    }

    checkNoMisusedPromises(stmt: Stmt): void {
        const option = this.getOption();
        const checksVoidReturn = parseCheckVoidReturn(option.checksVoidReturn);
        if (!stmt.getOriginalText()) {
            return;
        }
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp().getType();
            if (rightOp instanceof NumberType) {
                return;
            }
        }
        const sourceFile = AstTreeUtils.getASTNode('temp.ts', stmt.getOriginalText() ?? '');
        let tsNode: ts.Node = ts.isSourceFile(sourceFile) && sourceFile.statements.length > 0 ? sourceFile.statements[0] : sourceFile;
        if (ts.isExpressionStatement(tsNode)) {
            tsNode = tsNode.expression;
        }
        this.globalNode = tsNode;
        if (option.checksConditionals) {
            if (stmt instanceof ArkIfStmt ||
                ((ts.isBinaryExpression(tsNode) ||
                    ts.isConditionalExpression(tsNode)) &&
                    stmt instanceof ArkAssignStmt && stmt.getRightOp() instanceof ArkNormalBinopExpr)
            ) {
                this.checkConditional(stmt, tsNode, this.isTestExprForBinaryExpression(tsNode as ts.BinaryExpression));
            }
        }

        if (checksVoidReturn) {
            this.checkVoidReturn(stmt, tsNode, checksVoidReturn);
        }
        if (option.checksSpreads) {
            //因为底座返回语句不能确定是否Spread，所以遍历ts.Node看是否存在SpreadElement
            this.checkSpread(stmt, tsNode);
        }
    }

    getArgumentsPtrFunction(type: Type, count: number = 0): ArkMethod | null {
        let funcMethod: ArkMethod | null = null;
        if (count > this.MAX_RECURSION_DEPTH * 2) {
            return null;
        }
        count++;
        if (type instanceof FunctionType) {
            let methodName = type.getMethodSignature().getMethodSubSignature().getMethodName();
            funcMethod = this.globalArkCls.getMethodWithName(methodName);
        }
        if (type instanceof TypeQueryExpr) {
            return this.getArgumentsPtrFunction(type.getGenerateTypes()?.find(ty => ty instanceof AliasType) ?? type.getType(), count);
        }
        if (type instanceof AliasType) {
            return this.getArgumentsPtrFunction(type.getOriginalType(), count);
        }
        if (type instanceof UnionType) {
            return this.getArgumentsPtrFunction(type.getTypes().find(ty => ty instanceof FunctionType) ?? type, count);
        }
        return funcMethod;
    }

    checkGetDeclarStmt(declarName: string): Stmt | null {
        // 首先在全局语句中查找
        const globalStmt = this.findDeclarationInStmts(this.globalStmt.getCfg().getStmts(), declarName);
        if (globalStmt) {
            return globalStmt;
        }

        // 然后在方法体中查找
        return this.findDeclarationInStmts(this.globalArkMethod.getBody()?.getCfg().getStmts() ?? [], declarName);
    }

    private findDeclarationInStmts(stmts: Stmt[], declarName: string): Stmt | null {
        return stmts.find(stmt => {
            if (stmt instanceof ArkAssignStmt && stmt.getLeftOp() instanceof Local) {
                const local = stmt.getLeftOp() as Local;
                return local.getName() === declarName;
            }
            return false;
        }) ?? null;
    }

    private handleAssignStmt(stmt: ArkAssignStmt | Value): { stmt: Stmt | Value, funcMethod: ArkMethod | undefined } {
        if (!(stmt instanceof ArkAssignStmt)) {
            return { stmt, funcMethod: undefined };
        }
        let assignLeft = stmt.getLeftOp();
        let assignRight = stmt.getRightOp();
        let funcMethod: ArkMethod | undefined;

        if (assignLeft instanceof Local && assignRight instanceof ArkNewExpr) {
            const usedStmt = assignLeft.getUsedStmts().find(sm => sm instanceof ArkInvokeStmt);
            if (usedStmt instanceof ArkInvokeStmt) {
                stmt = usedStmt.getInvokeExpr();
            }
            let assignCls = this.globalArkFile.getClassWithName(assignRight.getClassType().getClassSignature().getClassName());
            const constructorMethod = assignCls?.getMethodWithName('constructor');
            funcMethod = constructorMethod ?? undefined;
        }

        return { stmt, funcMethod };
    }

    private handleInvokeExpr(stmt: AbstractInvokeExpr): ArkMethod | undefined {
        let method = stmt.getMethodSignature().getMethodSubSignature();
        let funcMethod: ArkMethod | undefined;

        if (stmt instanceof ArkPtrInvokeExpr) {
            let funcExpr = stmt.getFuncPtrLocal();
            const ptrMethod = this.getArgumentsPtrFunction(funcExpr.getType());
            funcMethod = ptrMethod ?? undefined;
        }
        if (stmt instanceof ArkStaticInvokeExpr) {
            let methodName = method.getMethodName();
            const staticMethod = this.globalArkCls.getMethodWithName(methodName);
            funcMethod = staticMethod ?? undefined;

            if (!funcMethod) {
                let ptrStmt = this.checkGetDeclarStmt(methodName);
                if (ptrStmt instanceof ArkAssignStmt) {
                    let local = ptrStmt.getLeftOp() as Local;
                    const ptrMethod = this.getArgumentsPtrFunction(local.getType());
                    funcMethod = ptrMethod ?? undefined;
                }
            }
        }

        return funcMethod;
    }

    private handleSpreadElement(node: ts.CallExpression | ts.NewExpression, i: number, stmt: AbstractInvokeExpr): Value {
        let arg = stmt.getArg(i);
        if (node && node.arguments && node.arguments[i] && ts.isSpreadElement(node.arguments[i])) {
            let argument = node.arguments[i] as ts.SpreadElement;
            if (argument.expression && ts.isIdentifier(argument.expression)) {
                let declarStmt = this.checkGetDeclarStmt(argument.expression.text);
                if (declarStmt instanceof ArkAssignStmt) {
                    arg = declarStmt.getRightOp();
                }
            }
        }
        return arg;
    }

    private getParamType(funcMethod: ArkMethod | undefined, i: number, stmt: AbstractInvokeExpr): Type | undefined {
        if (!funcMethod || !funcMethod.getParameters() || funcMethod.getParameters().length === 0) {
            return funcMethod?.getReturnType();
        }

        let funcMethodParam = funcMethod.getParameters()[i];
        if (!funcMethodParam || i === funcMethod.getParameters().length - 1) {
            funcMethodParam = funcMethod.getParameters()[funcMethod.getParameters().length - 1];
            if (stmt.getArgs().length > funcMethod.getParameters().length) {
                let funcMethodParamType = funcMethodParam.getType();
                if (funcMethodParamType instanceof ArrayType) {
                    return funcMethodParamType.getBaseType();
                }
                if (funcMethodParamType instanceof TupleType) {
                    let k = i - (funcMethod.getParameters().length - 1);
                    return funcMethodParamType.getTypes()[k];
                }
                return funcMethodParamType;
            }
        }
        return funcMethodParam.getType();
    }

    private checkArgumentType(arg: Value, node: ts.CallExpression | ts.NewExpression,
        method: any, methodReturnType: Type, funcMethod: ArkMethod | undefined,
        i: number, stmt: AbstractInvokeExpr): void {
        if (!node || !node.arguments || !this.isPromiseLike(arg, node.arguments[i])) {
            return;
        }

        const paramType = this.getParamType(funcMethod, i, stmt);
        const isVoidParam = paramType && this.isVoidType(paramType);
        const isForEachFirstArg = method.getMethodName() === 'forEach' && i === 0;
        const isConstructorWithPromiseReturn = method.getMethodName() === 'constructor' && this.isPromiseType(methodReturnType);

        if (isVoidParam || isForEachFirstArg || isConstructorWithPromiseReturn) {
            this.report('voidReturnArgument', node.arguments[i]);
        }
    }

    private processInvokeExpr(stmt: AbstractInvokeExpr, node: ts.CallExpression | ts.NewExpression): void {
        const funcMethod = this.handleInvokeExpr(stmt);
        const method = stmt.getMethodSignature().getMethodSubSignature();
        const methodReturnType = method.getReturnType();

        for (let i = 0; i < stmt.getArgs().length; i++) {
            const arg = this.handleSpreadElement(node, i, stmt);
            this.checkArgumentType(arg, node, method, methodReturnType, funcMethod, i, stmt);
        }
    }

    checkArguments(stmt: Stmt | Value, node: ts.CallExpression | ts.NewExpression): void {
        if (stmt instanceof ArkAssignStmt) {
            const result = this.handleAssignStmt(stmt);
            stmt = result.stmt;
        }

        if (stmt instanceof ArkInvokeStmt) {
            stmt = stmt.getInvokeExpr();
        }

        if (stmt instanceof AbstractInvokeExpr) {
            this.processInvokeExpr(stmt, node);
        }
    }

    isVoidType(type: Type): boolean {
        if (type instanceof UnionType) {
            if (type.getTypes().some(type => this.isPromiseType(type))) {
                return false;
            }
            return type.getTypes().some(type => this.isVoidType(type));
        }
        if (type instanceof UnclearReferenceType) {
            if (type.getName() === 'Record') {
                return type.getGenericTypes().some(generic => this.isVoidType(generic));
            }
        }
        if (type instanceof ArrayType) {
            return this.isVoidType(type.getBaseType());
        }
        if (type instanceof AliasType) {
            return this.isVoidType(type.getOriginalType());
        }
        if (type instanceof TupleType) {
            return type.getTypes().some(type => this.isVoidType(type));
        }
        if (type instanceof FunctionType) {
            let returnType = type.getMethodSignature().getMethodSubSignature().getReturnType();
            return this.isVoidType(returnType);
        }
        if (type instanceof VoidType) {
            return true;
        }
        return false;
    }

    checkProperty(stmt: Value | Stmt, node: ts.Node): void {
        if (node && ts.isReturnStatement(node)) {
            this.handleReturnStatement(stmt, node);
        }

        const { leftType, rightType, rightCls, leftCls } = this.getPropertyTypes(stmt);
        if (!rightCls) {
            return;
        }

        const propertyName = this.getPropertyName(node);
        if (!propertyName) {
            return;
        }

        if (node && ts.isPropertyAssignment(node)) {
            this.handlePropertyAssignment(node, propertyName, leftType, rightCls, leftCls);
        } else if (node && ts.isShorthandPropertyAssignment(node)) {
            this.handleShorthandPropertyAssignment(node, propertyName, leftType, rightCls, leftCls);
        } else if (node && ts.isMethodDeclaration(node)) {
            this.handleMethodDeclaration(node, propertyName, leftType, rightCls, leftCls);
        }

        node.getChildren().forEach(child => {
            this.checkProperty(stmt, child);
        });
    }

    private handleReturnStatement(stmt: Value | Stmt, node: ts.ReturnStatement): void {
        if (node && node.expression && ts.isObjectLiteralExpression(node.expression)) {
            node.expression.properties?.forEach(ch => {
                this.checkProperty(stmt, ch);
            });
        }
    }

    private getPropertyTypes(stmt: Value | Stmt): {
        leftType: Type | undefined, rightType: Type | undefined,
        rightCls: ArkClass | undefined, leftCls: ArkClass | undefined
    } {
        let leftType: Type | undefined;
        let rightType: Type | undefined;
        let rightCls: ArkClass | undefined;
        let leftCls: ArkClass | undefined;

        if (stmt instanceof ArkReturnStmt) {
            leftType = this.globalArkMethod.getSignature().getMethodSubSignature().getReturnType();
            rightType = stmt.getOp().getType();
        }
        if (stmt instanceof ArkAssignStmt) {
            leftType = stmt.getLeftOp().getType();
            rightType = stmt.getRightOp().getType();
        }

        if (leftType instanceof AliasType) {
            leftType = leftType.getOriginalType();
        }
        if (rightType instanceof FunctionType) {
            rightType = rightType.getMethodSignature().getMethodSubSignature().getReturnType();
        }
        if (leftType instanceof FunctionType) {
            leftType = leftType.getMethodSignature().getMethodSubSignature().getReturnType();
        }

        if (rightType instanceof ClassType) {
            const cls = this.globalArkFile.getClassWithName(rightType.getClassSignature().getClassName());
            if (cls) {
                rightCls = cls;
            }
        }
        if (leftType instanceof ClassType) {
            const cls = this.globalArkFile.getClassWithName(leftType.getClassSignature().getClassName());
            leftCls = cls ?? undefined;
            if (leftCls === rightCls) {
                return { leftType, rightType, rightCls, leftCls };
            }
        }
        return { leftType, rightType, rightCls, leftCls };
    }

    private getPropertyName(node: ts.Node): string | undefined {
        if (node && (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isMethodDeclaration(node))) {
            return node.name.getText();
        }
        return undefined;
    }

    private handlePropertyAssignment(node: ts.PropertyAssignment, propertyName: string,
        leftType: Type | undefined, rightCls: ArkClass, leftCls: ArkClass | undefined): void {
        if (!node || !node.initializer) {
            return;
        }

        if (leftType instanceof ClassType) {
            const cls = this.globalArkFile.getClassWithName(leftType.getClassSignature().getClassName());
            if (cls) {
                leftCls = cls;
            }
        }

        let fieldType = leftCls?.getFieldWithName(propertyName)?.getType();
        let rightReturnType = rightCls.getFieldWithName(propertyName)?.getType();

        if ((fieldType && this.isVoidType(fieldType) || leftType && this.isVoidType(leftType)) &&
            rightCls && rightReturnType && this.isPromiseType(rightReturnType, rightCls)) {
            this.report('voidReturnProperty', node);
        }
    }

    private handleShorthandPropertyAssignment(node: ts.ShorthandPropertyAssignment, propertyName: string, leftType: Type | undefined,
        rightCls: ArkClass, leftCls: ArkClass | undefined): void {
        let rightRtType = rightCls?.getFieldWithName(propertyName)?.getType();
        let rightMethod;
        if (rightRtType instanceof UnknownType || rightRtType === undefined) {
            let declare = this.getDeclarByName(propertyName);
            if (declare instanceof Type || declare === null) {
                rightRtType = declare ?? rightRtType;
            } else {
                rightMethod = declare;
            }
        }

        let leftRtType = leftCls?.getFieldWithName(propertyName)?.getType();
        if ((leftRtType && this.isVoidType(leftRtType) || leftType && this.isVoidType(leftType)) &&
            (rightRtType && this.isPromiseType(rightRtType, rightCls) ||
                rightMethod && (rightMethod.containsModifier(ModifierType.ASYNC) ||
                    (this.isPromiseType(rightMethod.getReturnType()))))) {
            this.report('voidReturnProperty', node);
        }
    }

    private handleMethodDeclaration(node: ts.MethodDeclaration, propertyName: string,
        leftType: Type | undefined, rightCls: ArkClass, leftCls: ArkClass | undefined): void {
        let rightReturnType = rightCls?.getMethodWithName(propertyName)?.getReturnType();
        let leftReturnType = leftCls?.getFieldWithName(propertyName)?.getSignature().getType();
        let returnStmt;

        if (rightReturnType instanceof UnknownType || rightReturnType === undefined) {
            let rightMethod = rightCls?.getMethodWithName(propertyName);
            returnStmt = rightMethod?.getBody()?.getCfg().getStmts().find(sm => sm instanceof ArkReturnStmt);
        }

        if (leftReturnType instanceof UnknownType || leftReturnType === undefined) {
            leftReturnType = leftCls?.getMethodWithName(propertyName)?.getSignature().getMethodSubSignature().getReturnType();
        }

        if (leftReturnType && this.isVoidType(leftReturnType) &&
            ((rightReturnType && this.isPromiseType(rightReturnType, rightCls)) ||
                (returnStmt && this.isPromiseLike(returnStmt, node)))) {
            this.report('voidReturnProperty', node);
        }
    }

    getDeclarByName(propertyName: string): Type | ArkMethod | null {
        let type = null;
        let declarStmt = this.globalStmt.getCfg().getStmts().find(sm => {
            if (sm instanceof ArkAssignStmt && sm.getLeftOp() instanceof Local) {
                let leftLocal = sm.getLeftOp() as Local;
                if (leftLocal.getName() === propertyName) {
                    return sm;
                }
            }
            return null;
        });
        if (declarStmt instanceof ArkAssignStmt) {
            type = declarStmt.getRightOp().getType();
        }
        if (!type) {
            type = this.globalArkCls.getMethodWithName(propertyName);
        }
        return type ? type : null;
    }

    checkReturnType(op: Local, node: ts.ReturnStatement): boolean {
        let opDeclar = op.getDeclaringStmt();
        let method = this.globalArkMethod.getSignature().getMethodSubSignature();
        let returnType = method.getReturnType();
        if ((returnType instanceof UnknownType || returnType === undefined) && this.globalStmt instanceof ArkAssignStmt) {
            let leftTy = this.globalStmt.getLeftOp().getType();
            if (leftTy instanceof AliasType) {
                leftTy = leftTy.getOriginalType();
            }
            if (leftTy instanceof ClassType) {
                let leftCls = this.globalArkFile.getClassWithName(leftTy.getClassSignature().getClassName());
                let clsRtTy = leftCls?.getMethodWithName(method.getMethodName())?.getSignature().getMethodSubSignature().getReturnType();
                returnType = clsRtTy ?? returnType;
            }
        }
        if (!this.isVoidType(returnType)) {
            return false;
        }
        if (this.isPromiseType(op.getType())) {
            return true;
        }
        return opDeclar && this.isPromiseLike(opDeclar, node) || false;
    }

    checkReturnStatement(stmt: Stmt | Value, node: ts.Node): void {
        if (node && ts.isReturnStatement(node) && stmt instanceof ArkReturnStmt) {
            const op = stmt.getOp();
            if (op && op instanceof Local && this.checkReturnType(op, node) && node.expression) {
                this.report('voidReturnReturnValue', node.expression);
            }
        }
    }

    checkAssignment(stmt: Stmt | Value, node: ts.BinaryExpression | ts.VariableDeclaration): void {
        if (stmt instanceof ArkAssignStmt) {
            let leftOp = stmt.getLeftOp();
            let right = stmt.getRightOp();

            if (!(leftOp instanceof Local && right instanceof Local)) {
                return;
            }
            if (node && ts.isVariableDeclaration(node) &&
                node.name?.getText() === leftOp.getName() &&
                this.leftVoidReturn(leftOp) &&
                this.isPromiseLike(right, node.initializer ?? node)) {
                this.report('voidReturnVariable', node.initializer ?? node);
            }
            if (node && ts.isBinaryExpression(node) &&
                this.leftVoidReturn(leftOp) &&
                this.isPromiseLike(right, ts.isBinaryExpression(node) ? node.right : node)) {
                this.report('voidReturnVariable', ts.isBinaryExpression(node) ? node.right : node);
            }
        }
    }

    checkVariableDeclarations(stmt: Stmt | Value, node: ts.Node): void {
        if (!node) {
            return;
        }
        let declarations = ts.isVariableStatement(node) ? node.declarationList.declarations : [node];
        declarations.forEach(declaration => {
            if (ts.isVariableDeclaration(declaration) && declaration.initializer && ts.isCallOrNewExpression(declaration.initializer)) {
                this.checkArguments(stmt, declaration.initializer);
            }
        });
    }

    checkVariableAssignments(stmt: Stmt | Value, node: ts.Node): void {
        if (node && ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            this.checkAssignment(stmt, node);
        }
        if (node && (ts.isVariableStatement(node) || ts.isVariableDeclaration(node))) {
            let declarations = ts.isVariableStatement(node) ? node.declarationList.declarations : [node];
            for (const declaration of declarations) {
                this.checkAssignment(stmt, declaration);
            }
        }
    }

    checkVoidReturn(stmt: Stmt | Value, node: ts.Node, checksVoidReturn: ChecksVoidReturnOptions): void {
        if (checksVoidReturn.arguments) {
            if (node && (ts.isVariableDeclaration(node) || ts.isVariableStatement(node))) {
                this.checkVariableDeclarations(stmt, node);
            }
            if (node && ts.isCallOrNewExpression(node)) {
                this.checkArguments(stmt, node);
            }
        }

        if (checksVoidReturn.attributes && node && ts.isJsxAttribute(node)) {
            //todo checkJSXAttribute
        }

        if (checksVoidReturn.properties) {
            this.checkProperty(stmt, node);
        }

        if (checksVoidReturn.returns) {
            this.checkReturnStatement(stmt, node);
        }

        if (checksVoidReturn.variables) {
            this.checkVariableAssignments(stmt, node);
        }
    }

    leftVoidReturn(left: Local): boolean {
        let leftType = left.getType();
        if (leftType instanceof FunctionType) {
            let methodName = leftType.getMethodSignature().getMethodSubSignature().getMethodName();
            let leftMethod = this.globalArkCls.getMethodWithName(methodName);
            let leftReturnType = leftMethod?.getSignature().getMethodSubSignature().getReturnType();
            if (leftReturnType && this.isVoidType(leftReturnType)) {
                return true;
            }
        }
        return false;
    }

    checkSpread(stmt: Stmt | Value, node: ts.Node): void {
        if (node && (ts.isSpreadAssignment(node) || ts.isSpreadElement(node))) {
            if (this.checkTsNodeIsPromise(node.expression)) {
                this.report('spread', node.expression);
            }
        }
        node.forEachChild(child => {
            this.checkSpread(stmt, child);
        });
    }

    checkTsNodeIsPromise(node: ts.Node): boolean {
        if (node && ts.isAwaitExpression(node)) {
            return false;
        }
        if (node && ts.isParenthesizedExpression(node)) {
            return this.checkTsNodeIsPromise(node.expression);
        }
        if (node && ts.isConditionalExpression(node)) {
            return this.checkTsNodeIsPromise(node.whenTrue) || this.checkTsNodeIsPromise(node.whenFalse);
        }
        if (node && ts.isBinaryExpression(node)) {
            return this.checkTsNodeIsPromise(node.left) || this.checkTsNodeIsPromise(node.right);
        }
        if (node && ts.isCallExpression(node)) {
            return this.checkTsNodeIsPromise(node.expression);
        }
        if (node && ts.isPropertyAccessExpression(node)) {
            return this.checkTsNodeIsPromise(node.expression);
        }
        if (node && ts.isIdentifier(node)) {
            if (node.text === 'Promise') {
                return true;
            }
            let declare = this.checkGetDeclarStmt(node.text) as ArkAssignStmt;
            let rightType = declare?.getRightOp().getType();
            if (declare && rightType instanceof FunctionType) {
                return this.isPromiseLike(declare, node) ?? false;
            }
        }
        return false;
    }

    checkMethod(arkMethod: ArkMethod): void {
        this.globalArkMethod = arkMethod;
        if (this.useMethods.includes(arkMethod.getSignature().getMethodSubSignature().getMethodName())) {
            return;
        }
        arkMethod.getBody()?.getCfg().getStmts().forEach(stmt => {
            this.globalStmt = stmt;
            this.checkNoMisusedPromises(stmt);
        });
    }

    checkClass(arkCls: ArkClass): void {
        this.globalArkCls = arkCls;
        arkCls.getMethods().forEach(method => {
            this.checkMethod(method);
        });
    }

    checkFile(arkFile: ArkFile): void {
        this.globalArkFile = arkFile;
        arkFile.getClasses().forEach(classDeclaration => {
            this.globalArkCls = classDeclaration;
            this.checkClass(classDeclaration);
        });
    }

    public check = (target: ArkFile): void => {
        // 清理所有缓存
        this.visitedNodes.clear();
        this.typeCache.clear();
        this.methodCache.clear();
        this.checkFile(target);
        this.sortAndReportErrors(target);
    }

    private sortAndReportErrors(target: ArkFile): void {
        this.errorPositions.sort((a, b) => {
            if (a.line !== b.line) {
                return a.line - b.line;
            }
            return a.colum - b.colum;
        });

        this.errorPositions.forEach(position => {
            this.addIssueReport(target, position.line, position.colum, position.sourceCode, position.message);
        });
    }

    private addIssueReport(arkFile: ArkFile, lineNum: number, startColum: number, code: string, messageId: string, generic: string = '') {
        const severity = this.rule.alert ?? this.metaData.severity;
        let message = this.metaData.messages[messageId];
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
