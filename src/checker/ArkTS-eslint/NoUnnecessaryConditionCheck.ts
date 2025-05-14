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
    ArkClass,
    ArkMethod,
    ts,
    StringType,
    Local,
    AnyType,
    UnknownType,
    FunctionType,
    UnionType,
    UnclearReferenceType,
    Type,
    Stmt,
    AstTreeUtils,
    ArkAssignStmt,
    NumberType,
    BooleanType,
    UndefinedType,
    Value,
    IntersectionType,
    LiteralType,
    NullType,
    VoidType,
    ArkUnopExpr,
    UnaryOperator,
    ArkArrayRef,
    ArkNormalBinopExpr,
    NormalBinaryOperator,
    AbstractInvokeExpr,
    AbstractFieldRef,
    ClassType,
    NeverType,
    ArkInstanceInvokeExpr,
    ArrayType,
    TupleType,
    ArkIfStmt,
    ArkConditionExpr,
    Constant,
    ArkPtrInvokeExpr,
    ArkNewExpr,
    ArkInvokeStmt,
    ArkParameterRef,
    ArkTypeOfExpr,
    ArkStaticInvokeExpr,
    ArkInstanceFieldRef,
    GenericType,
    ArkNewArrayExpr,
    ArkAwaitExpr,
    BigIntType
} from "arkanalyzer";
import { ModifierType } from 'arkanalyzer/lib/core/model/ArkBaseModel';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { RuleFix } from '../../model/Fix';
import { BooleanConstant, NumberConstant, StringConstant, UndefinedConstant } from "arkanalyzer/lib/core/base/Constant";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnnecessaryConditionCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/no-unnecessary-condition.md",
    description: "Disallow conditionals where the type is always truthy or always falsy.",
    messages: {
        alwaysTruthy: 'Unnecessary conditional, value is always truthy.',
        alwaysFalsy: 'Unnecessary conditional, value is always falsy.',
        alwaysTruthyFunc:
            'This callback should return a conditional, but return is always truthy.',
        alwaysFalsyFunc:
            'This callback should return a conditional, but return is always falsy.',
        neverNullish:
            'Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined.',
        alwaysNullish:
            'Unnecessary conditional, left-hand side of `??` operator is always `null` or `undefined`.',
        literalBooleanExpression:
            'Unnecessary conditional, both sides of the expression are literal values.',
        noOverlapBooleanExpression:
            'Unnecessary conditional, the types have no overlap.',
        never: 'Unnecessary conditional, value is `never`.',
        neverOptionalChain: 'Unnecessary optional chain on a non-nullish value.',
        noStrictNullCheck:
            'This rule requires the `strictNullChecks` compiler option to be turned on to function correctly.',
    }
};

interface Options {
    allowConstantLoopConditions?: boolean;
    allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing?: boolean;
}

interface LocationInfo {
    fileName: string;
    line: number;
    startCol: number;
    endCol: number;
    start: number;
    end: number;
    nameStr: string;
    description: string;
    messageId: string;
}
export class NoUnnecessaryConditionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private ARRAY_PREDICATE_FUNCTIONS = new Set(['filter', 'find', 'some', 'every']);
    private BOOL_OPERATORS = new Set(['<', '>', '<=', '>=', '==', '===', '!=', '!==']);
    private line: number = 0;
    private col: number = 0;
    private locationInfos: LocationInfo[] = [];
    private globalStmt: Stmt;
    private rootNode: ts.Node;
    private globalMethod: ArkMethod;
    private option: Options;
    private useMethod: string[] = [];
    private stmtCache: Map<string, Stmt> = new Map();
    private nullishType = [NullType, UndefinedType];
    private defaultOptions: Options = {
        allowConstantLoopConditions: false,
        allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false,
    };
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

    public check = (arkFile: ArkFile) => {
        this.locationInfos = [];
        const code = arkFile.getCode();
        if (!code) {
            return;
        }
        this.stmtCache.clear();
        this.option = this.rule && this.rule.option[0] ? this.rule.option[0] as Options : this.defaultOptions;

        arkFile.getClasses().forEach(cls => this.checkClass(cls));
        // 输出结果
        this.locationInfos.forEach(loc => {
            this.addIssueReportNodeFix(loc, arkFile);
        });
    }

    private isLiteralType(type: Type): boolean {
        return type instanceof LiteralType || type instanceof BooleanType || type instanceof UndefinedType ||
            type instanceof NullType || type instanceof VoidType;
    }

    private isNullishType(value: Type): boolean {
        return this.nullishType.some(t => value instanceof t);
    }

    private isPossiblyNullish(value: Type): boolean {
        return this.unionTypeParts(value).some(t => this.isNullishType(t));
    }

    private isAlwaysNullish(value: Type): boolean {
        return this.unionTypeParts(value).every(t => this.isNullishType(t));
    }
    private isTruthyLiteral(value: Type): boolean {
        if (!value) {
            return false;
        }
        if (!(value instanceof LiteralType)) {
            return false;
        }
        if (value.getLiteralName() === true || value.getLiteralName()) {
            return true;
        }
        return false;
    }

    private isFalsyLiteral(value: Type): boolean {
        if (!value) {
            return false;
        }
        if (value instanceof LiteralType) {
            if (value.getLiteralName() === false) {
                return true;
            }
            if (['0', 'false', ''].includes(value.getLiteralName().toString())) {
                return true;
            }
        }

        if ([NullType, UndefinedType].some(ty => value instanceof ty)) {
            return true;
        }
        return false;
    }

    /**
     * 检查是否存在至少一个类型是true类型   
     * @param value 
     * @returns 
     */
    private isPossiblyTruthy(value: Type): boolean {
        if (!value) {
            return false;
        }
        //处理联合类型中包含交集类型的情况
        let types = this.unionTypeParts(value).map(type => this.unionTypeParts(type));
        //检查是否存在至少一个类型不是false类型
        return types.some(intersectionParts =>
            //交集类型中只要有一个是true，则返回true
            intersectionParts.every(t => !this.isFalsyLiteral(t)));
    }

    /**
     * 检查是否存在至少一个类型是false类型   
     * @param value 
     * @returns 
     */
    private isPossiblyFalsy(value: Type): boolean {
        if (!value) {
            return false;
        }
        //处理联合类型
        return this.unionTypeParts(value)
            //处理联合类型中包含交集类型的情况
            .flatMap(type => this.unionTypeParts(type))
            //过滤掉非true类型
            .filter(t => !this.isTruthyLiteral(t))
            //检查是否存在至少一个类型是false类型
            .some(l => (l instanceof LiteralType && ['false', '0', ''].includes(l.getLiteralName().toString())) ||
                [NullType, UndefinedType, NumberType, StringType,
                    BooleanType, BigIntType, UnclearReferenceType].some(ty => l instanceof ty));
    }

    private checkClass(arkClass: ArkClass): void {
        const methods = arkClass.getMethods(true);
        this.useMethod = [];
        methods.forEach(method => {
            this.checkMethod(method);
        });
    }

    private checkMethod(arkMethod: ArkMethod): void {
        const stmts = arkMethod.getBody()?.getCfg().getStmts();
        const methodName = arkMethod.getSignature().getMethodSubSignature().getMethodName();
        if (this.useMethod.includes(methodName)) {
            return;
        }
        this.globalMethod = arkMethod;
        this.useMethod.push(methodName);
        stmts?.forEach(stmt => {
            this.checkStmt(stmt);
        });
    }

    private checkStmt(arkStmt: Stmt): void {
        if (this.checkStmtIf(arkStmt)) {
            return;
        }
        this.globalStmt = arkStmt;
        let originCode = arkStmt.getOriginalText();
        if (!originCode) {
            return;
        }
        const astNode = AstTreeUtils.getASTNode('temp', originCode);
        if (astNode) {
            this.locationInfos.push(...this.checkCondition(astNode));
        }
    }

    private checkLogicalExpressionForUnnecessaryConditionals(stmt: Stmt | Value,
        node: ts.BinaryExpression, results: LocationInfo[]): void {
        if (!(stmt instanceof ArkNormalBinopExpr || stmt instanceof ArkConditionExpr)) {
            return;
        }
        if (!node) {
            return;
        }
        if (stmt.getOperator() === NormalBinaryOperator.NullishCoalescing) {
            this.checkNodeForNullish(stmt.getOp1(), node?.left, results);
            return;
        }
        this.checkNode(stmt.getOp1(), node?.left, results);
    }

    private checkCallExpression(stmt: Stmt | Value, node: ts.CallExpression, results: LocationInfo[]): void {
        if (!node) {
            return;
        }
        if (stmt instanceof ArkInvokeStmt) {
            stmt = stmt.getInvokeExpr();
        }
        if (!(stmt instanceof ArkInstanceInvokeExpr)) {
            return;
        }
        if (node && this.isArrayPredicateFunction(stmt, node) && node?.arguments.length) {
            this.checkArrayPredicateFunction(stmt, node, results);
        }
    }

    private checkArrayPredicateFunction(stmt: ArkInstanceInvokeExpr, node: ts.CallExpression, results: LocationInfo[]): void {
        if (!node) {
            return;
        }
        const callback = stmt.getArg(0);
        const argument = node?.arguments[0];
        if (callback instanceof Local && callback.getType() instanceof FunctionType && argument &&
            (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) {
            const methodName = callback.getName();
            const method = this.globalMethod.getDeclaringArkClass().getMethodWithName(methodName);
            let stmts = method?.getBody()?.getCfg().getStmts();
            if (stmts && stmts[0]) {
                this.checkNode(stmts[0], argument.body, results);
                return;
            }
            let returnType = method?.getReturnType() ? this.unionTypeParts(method?.getReturnType()) : [];
            if (returnType.length === 0 ||
                returnType.some(t => t instanceof AnyType || t instanceof UnknownType)) {
                return;
            }
            if (!returnType.some(t => this.isPossiblyFalsy(t))) {
                this.reportIssue(argument.body, 'alwaysTruthyFunc', results);
                return;
            }
            if (!returnType.some(t => this.isPossiblyTruthy(t))) {
                this.reportIssue(argument.body, 'alwaysFalsyFunc', results);
                return;
            }
        }
    }



    private isArrayPredicateFunction(stmt: ArkInstanceInvokeExpr, node: ts.CallExpression): boolean {
        if (!node) {
            return false;
        }
        const methodName = stmt.getMethodSignature().getMethodSubSignature().getMethodName();
        if (node && this.ARRAY_PREDICATE_FUNCTIONS.has(methodName) &&
            this.isArrayType(stmt.getBase(), node)) {
            return true;
        }
        return false;
    }

    private isArrayType(value: Value, node: ts.Node): boolean {
        if (!node) {
            return false;
        }
        const type = value.getType();
        return type instanceof ArrayType || type instanceof TupleType;
    }

    private checkIfLoopIsNecessaryConditional(stmt: Stmt | Value,
        node: ts.Node,
        results: LocationInfo[]): void {
        if (!node) {
            return;
        }
        if (stmt instanceof ArkConditionExpr) {
            let op1 = stmt.getOp1();
            let op2 = stmt.getOp2();
            if (this.option.allowConstantLoopConditions &&
                this.isTruthyLiteral(op1.getType()) && this.isTruthyLiteral(op2.getType())) {
                return;
            }
        }
        this.checkNode(stmt, node, results);
    }

    private checkAssignmentExpression(stmt: Stmt | Value, node: ts.BinaryExpression, results: LocationInfo[]): void {
        if (!node) {
            return;
        }
        if (stmt instanceof ArkNormalBinopExpr) {
            if (node && [ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.BarBarEqualsToken].
                includes(node?.operatorToken?.kind)) {
                this.checkNode(stmt.getOp1(), node?.left, results);
            } else if (node && node?.operatorToken?.kind === ts.SyntaxKind.QuestionQuestionEqualsToken) {
                this.checkNodeForNullish(stmt.getOp1(), node?.left, results);
            }
        }
    }

    private checkNodeForNullish(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[]): void {
        if (!node) {
            return;
        }
        const type = this.getConstrainedType(stmt, node);
        if (type instanceof UndefinedType) {
            return;
        }
        if (type instanceof AnyType || type instanceof UnknownType) {
            return;
        }
        let messageId: string | null = null;
        if (type instanceof NeverType) {
            messageId = 'never';
        } else if (type && !this.isPossiblyNullish(type)) {
            if (!(stmt instanceof ArkArrayRef ||
                (node && ts.isElementAccessExpression(node) &&
                    ts.isLiteralExpression(node?.argumentExpression))) &&
                !ts.isNonNullChain(node)) {
                if (type instanceof UnclearReferenceType) {
                    return;
                }
                messageId = 'neverNullish';
            }
        } else if (type && this.isAlwaysNullish(type)) {
            messageId = 'alwaysNullish';
        }
        if (messageId) {
            this.reportIssue(node, messageId, results);
        }
    }

    private checkNode(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[], isUnaryNotArgument = false): void {
        if (!node) {
            return;
        }
        if (ts.isParenthesizedExpression(node)) {
            this.checkNode(stmt, node?.expression, results, isUnaryNotArgument);
            return;
        }
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp();
            if ([StringConstant, NumberConstant, BooleanConstant]
                .some(value => rightOp instanceof value) &&
                [ArkNormalBinopExpr, ArkConditionExpr].every(value => !(rightOp instanceof value))) {
                return;
            }
            if (!(rightOp instanceof UndefinedConstant)) {
                stmt = rightOp;
            }
        }
        if (stmt instanceof Local && stmt.getDeclaringStmt() && stmt.getName().includes('%')) {
            //处理这种嵌套的逻辑表达式(a || b) && c
            let decalarationStmt = stmt.getDeclaringStmt() as ArkAssignStmt;
            this.checkNode(decalarationStmt, node, results);
            return;
        }
        this.checkExpressionNode(stmt, node, results, isUnaryNotArgument);
    }

    private checkExpressionNode(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[], isUnaryNotArgument = false): void {
        if (node && ts.isPrefixUnaryExpression(node)) {
            if (stmt instanceof ArkConditionExpr &&
                stmt.getOp2() instanceof Constant &&
                stmt.getOperator() === '!=') {
                this.checkNode(stmt.getOp1(), node, results);
                return;
            }
            if (!(stmt instanceof ArkUnopExpr)) {
                return;
            }

            let op = stmt.getOp();
            if (stmt.getOperator() === UnaryOperator.LogicalNot) {
                if (op instanceof Local && op.getDeclaringStmt() && op.getName().includes('%')) {
                    let decalarationStmt = op.getDeclaringStmt() as ArkAssignStmt;
                    this.checkNode(decalarationStmt, node.operand, results, !isUnaryNotArgument);
                    return;
                }
                this.checkNode(op, node.operand, results, !isUnaryNotArgument);
                return;
            }
        }

        if (stmt instanceof ArkArrayRef ||
            (node && ts.isElementAccessExpression(node) && ts.isLiteralExpression(node.argumentExpression))) {
            return;
        }
        if (stmt instanceof ArkNormalBinopExpr &&
            stmt.getOperator() !== NormalBinaryOperator.NullishCoalescing && node &&
            ts.isBinaryExpression(node)) {
            //这里检查右值，左值在checkLogicalExpressionForUnnecessaryConditionals方法里检查
            this.checkNode(stmt.getOp2(), node.right, results);
            return;
        }
        this.checkNodeOther(stmt, node, results, isUnaryNotArgument);
    }
    private checkNodeOther(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[], isUnaryNotArgument = false): void {
        let type = this.getConstrainedType(stmt, node);

        //<T extends string>(x: T)
        if (type instanceof GenericType) {
            type = type.getConstraint() ? type.getConstraint() : AnyType.getInstance();
        }
        if (type instanceof ClassType) {
            //目前类似new Boolean(true),这种基础类型的参数未能解析，所以返回默认值
            let clsName = type.getClassSignature().getClassName();
            if (clsName === 'Boolean') {
                type = new LiteralType(false);
            }
            if (clsName === 'String') {
                type = new LiteralType('');
            }
            if (clsName === 'Number') {
                type = new LiteralType(1);
            }
            if (clsName === 'Array') {
                type = new ArrayType(AnyType.getInstance(), 1);
            }
        }
        if (type instanceof FunctionType) {
            type = new LiteralType(true);
        }
        node = this.getReportedNode(node);
        if (type && this.unionTypeParts(type).some(ty =>
            ty instanceof AnyType || ty instanceof UnknownType)) {
            return;
        }
        let messageId: string | null = null;
        if (type instanceof NeverType) {
            messageId = 'never';
        } else if (type && !this.isPossiblyTruthy(type)) {
            messageId = !isUnaryNotArgument ? 'alwaysFalsy' : 'alwaysTruthy';
        } else if (type && !this.isPossiblyFalsy(type)) {
            messageId = !isUnaryNotArgument ? 'alwaysTruthy' : 'alwaysFalsy';
        }
        if (messageId) {
            this.reportIssue(node, messageId, results);
        }
    }

    private getReportedNode(node: ts.Node): ts.Node {
        if (ts.isPrefixUnaryExpression(node)) {
            return this.getReportedNode(node?.operand);
        }
        if (ts.isParenthesizedExpression(node) ||
            ts.isTypeOfExpression(node) ||
            ts.isCallExpression(node) ||
            ts.isAwaitExpression(node)) {
            return this.getReportedNode(node?.expression);
        }
        return node;
    }

    private getConstrainedTypeOfArkConditionExpr(stmt: ArkConditionExpr, node: ts.Node, num: number = 0): Type | undefined {
        let op1 = stmt.getOp1();
        let op2 = stmt.getOp2();
        let op1Type = this.getConstrainedType(op1, node, num);

        //如果条件表达式是a=1,则op1Type为1
        if (ts.isIdentifier(node) && ts.isBinaryExpression(node.parent)) {
            node = node.parent;
        }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            if (ts.isLiteralExpression(node.right)) {
                op1Type = new LiteralType(node.right.text);
            } else if (ts.isParenthesizedExpression(node.right) && ts.isLiteralExpression(node.right.expression)) {
                op1Type = new LiteralType(node.right.expression.text);
            }
        }
        //特殊情况，function类型在条件表达式中，则返回true
        if (op1Type instanceof FunctionType && stmt.getUses().some(use => use instanceof ArkIfStmt)) {
            return new LiteralType(true);
        }
        let op2Type = this.getConstrainedType(op2, node);

        if (!(op1Type instanceof LiteralType)) {
            return op1Type;
        }

        if (op1Type instanceof LiteralType && op2Type instanceof LiteralType) {
            if (['===', '=='].includes(stmt.getOperator())) {
                return new LiteralType(op1Type.getLiteralName() === op2Type.getLiteralName());
            }
            if (['!==', '!='].includes(stmt.getOperator())) {
                return new LiteralType(op1Type.getLiteralName() !== op2Type.getLiteralName());
            }
            if (stmt.getOperator() === '>') {
                return new LiteralType(op1Type.getLiteralName() > op2Type.getLiteralName());
            }
            if (stmt.getOperator() === '<') {
                return new LiteralType(op1Type.getLiteralName() < op2Type.getLiteralName());
            }
            if (stmt.getOperator() === '>=') {
                return new LiteralType(op1Type.getLiteralName() >= op2Type.getLiteralName());
            }
            if (stmt.getOperator() === '<=') {
                return new LiteralType(op1Type.getLiteralName() <= op2Type.getLiteralName());
            }
        }
        return op2Type;
    }

    private getConstrainedTypeOfArkNewExpr(stmt: ArkNewExpr, node: ts.Node): Type | undefined {
        let type: Type | undefined = undefined;
        if (ts.isNewExpression(node) && node?.arguments && node?.arguments[0] && ts.isLiteralExpression(node?.arguments[0])) {
            let argument = node?.arguments[0];
            if (argument?.kind === ts.SyntaxKind.TrueKeyword) {
                type = new LiteralType(true);
            }
            if (argument?.kind === ts.SyntaxKind.FalseKeyword) {
                type = new LiteralType(false);
            }
            if (ts.isStringLiteral(argument) || ts.isNumericLiteral(argument) || ts.isBigIntLiteral(argument)) {
                type = new LiteralType(argument.text);
            }
            return type;
        }
        return stmt.getClassType();
    }

    private getConstrainedType(stmt: Value | Stmt, node: ts.Node, num: number = 0): Type | undefined {
        let type: Type | undefined = undefined;
        try {
            if (num > 5) {
                return type;
            }
            num++;
            if (stmt instanceof ArkConditionExpr) {
                return this.getConstrainedTypeOfArkConditionExpr(stmt, node, num);
            }
            if (stmt instanceof ArkTypeOfExpr && ts.isTypeOfExpression(node)) {
                return StringType.getInstance();
            }
            if (stmt instanceof ArkNewExpr) {
                return this.getConstrainedTypeOfArkNewExpr(stmt, node);
            }
            //字面量类型
            if (stmt instanceof Constant) {
                return this.getConstrainedTypeOfConstant(stmt, node);
            }
            if (stmt instanceof ArkAssignStmt) {
                return this.getConstrainedTypeOfArkAssignStmt(stmt, node);
            }
            if (stmt instanceof ArkInstanceFieldRef) {
                return stmt.getFieldSignature().getType();
            }
            if (stmt instanceof ArkAwaitExpr) {
                return this.getConstrainedType(stmt.getPromise(), node);
            }
            if (stmt instanceof Local) {
                if (!stmt.getName().includes('%')) {
                    type = this.getTypeByName(stmt.getName());
                }
                let decalarationStmt = stmt.getDeclaringStmt();
                if (!type && decalarationStmt) {
                    return this.getConstrainedType(decalarationStmt, node);
                }
                //如果变量声明没有类型，则通过声明语句获取类型
                if (!type && stmt.getType()) {
                    type = stmt.getType();
                }
                return type;
            }
        } catch (error) {
            return undefined;
        }
        return this.getConstrainedTypeOther(stmt, node);
    }

    private getConstrainedTypeOfConstant(stmt: Constant, node: ts.Node): Type | undefined {
        if (stmt instanceof StringConstant || stmt instanceof NumberConstant || stmt instanceof BooleanConstant) {
            return new LiteralType(stmt.getValue());
        }
        return stmt.getType();
    }

    private getConstrainedTypeOfArkAssignStmt(stmt: ArkAssignStmt, node: ts.Node): Type | undefined {
        let type: Type | undefined = undefined;
        const leftOp = stmt.getLeftOp();
        const rightOp = stmt.getRightOp();
        if (leftOp instanceof Local && !leftOp.getName().includes('%')) {
            if (rightOp instanceof NumberConstant || rightOp instanceof StringConstant || rightOp instanceof BooleanConstant) {
                return leftOp.getConstFlag() ? new LiteralType(rightOp.getValue()) : rightOp.getType();
            }
            type = this.getConstrainedType(leftOp, node);
        }
        //左侧没有声明，则通过右侧的类型推断
        if (!type || type instanceof UnknownType) {
            return this.getConstrainedType(rightOp, node);
        }
        return type;
    }

    private getConstrainedTypeOther(stmt: Value | Stmt, node: ts.Node): Type | undefined {
        let type: Type | undefined = undefined;
        if (stmt instanceof ArkInstanceInvokeExpr) {
            let base = stmt.getBase();
            let arg0 = stmt.getArg(0);
            if (base.getType() instanceof ClassType && base.getName() === 'Promise') {
                if (arg0 && arg0 instanceof Constant) {
                    type = new LiteralType(arg0.getValue());
                } else {
                    type = base.getType();
                }
                return type;
            }
            return stmt.getMethodSignature().getMethodSubSignature().getReturnType();
        }
        if (stmt instanceof AbstractInvokeExpr) {
            //调用表达式，如果是调用方法，则判断其方法返回类型
            const methodName = stmt.getMethodSignature().getMethodSubSignature().getMethodName();
            const method = this.globalMethod.getDeclaringArkClass().getMethodWithName(methodName);
            if (method) {
                this.useMethod.push(methodName);
                type = method.getReturnType();
                if (type instanceof VoidType && method.containsModifier(ModifierType.ASYNC)) {
                    type = new UnclearReferenceType('Promise');
                }
            }
            return type;
        }
        if (stmt instanceof AbstractFieldRef) {
            //变量使用，其中包含了调用变量例如：a.b.c
            const fieldSignature = stmt.getFieldSignature();
            return fieldSignature.getType();
        }
        if (stmt instanceof ClassType) {
            return stmt;
        }
        if (stmt instanceof ArkPtrInvokeExpr ||
            stmt instanceof ArkParameterRef) {
            return stmt.getType();
        }
        return type;
    }

    private checkStmtIf(arkStmt: Stmt): boolean {
        if (arkStmt.getOriginalText() === '') {
            return true;
        }
        this.line = arkStmt.getOriginPositionInfo().getLineNo();
        this.col = arkStmt.getOriginPositionInfo().getColNo();
        if (arkStmt instanceof ArkAssignStmt && arkStmt.getRightOp().getType() instanceof NumberType) {
            return true;
        }
        return false;
    }

    private checkCondition(sourceFile: ts.SourceFile): LocationInfo[] {
        const results: LocationInfo[] = [];
        this.rootNode = sourceFile.statements[0];
        if (!this.rootNode) {
            return results;
        }
        if (ts.isExpressionStatement(this.rootNode)) {
            this.rootNode = this.rootNode?.expression;
        }
        if (this.rootNode.getText().includes('?.')) {
            this.checkOptionalChain(this.globalStmt, this.rootNode, results);
        }
        this.visitCheck(this.globalStmt, this.rootNode, results);
        return results;
    }

    private checkOptionalChain(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[]): void {
        if (!node) {
            return;
        }
        if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node) || ts.isElementAccessExpression(node)) {
            this.checkOptionalChainStmt(node, stmt, results);
        }
        ts.forEachChild(node, (child) => this.checkOptionalChain(stmt, child, results));
    }

    private checkOptionalChainStmt(node: ts.PropertyAccessExpression | ts.CallExpression | ts.ElementAccessExpression,
        stmt: Stmt | Value, results: LocationInfo[]): void {
        if (!node.getText() || !node.getText().includes('?')) {
            return;
        }
        if (!node.expression || !node.expression.getText()) {
            return;
        }
        let objName = node.expression.getText();

        if (stmt instanceof ArkInvokeStmt && stmt.getInvokeExpr()) {
            let invokeExpr = stmt.getInvokeExpr();
            if (invokeExpr instanceof ArkInstanceInvokeExpr) {
                let type = invokeExpr.getBase().getType();
                if (invokeExpr.getBase().getName() === objName) {
                    this.checkOptionalChainType(node, type, results);
                }
            } else {
                let type = stmt.getInvokeExpr().getType();
                this.checkOptionalChainType(node, type, results);
            }
        }

        if (stmt instanceof ArkAssignStmt && stmt.getRightOp() && stmt.getRightOp() instanceof Local) {
            this.checkChainStmtOfRightOp(node, stmt, results);
        }
        if (stmt instanceof ArkAssignStmt && stmt.getLeftOp() && stmt.getLeftOp() instanceof Local) {
            this.checkChainStmtOfLeftOp(node, stmt, results);
        }
    }

    private checkChainStmtOfRightOp(node: ts.PropertyAccessExpression | ts.CallExpression | ts.ElementAccessExpression,
        stmt: ArkAssignStmt, results: LocationInfo[]): void {
        let objName = node?.expression.getText();
        let op2 = stmt.getRightOp() as Local;
        if (op2 instanceof ArkStaticInvokeExpr) {
            let methodName = op2.getMethodSignature().getMethodSubSignature().getMethodName();
            if (methodName === 'Array') {
                this.reportOptionalChainIssue(node, results);
                return;
            }
            let returnType = op2.getMethodSignature().getMethodSubSignature().getReturnType();
            this.checkOptionalChainType(node, returnType, results);
        }
        if (op2 instanceof ArkNewArrayExpr) {
            let baseType = op2.getBaseType();
            this.checkOptionalChainType(node, baseType, results);
        }
        if (op2 instanceof ArkInstanceFieldRef) {
            let baseType = op2.getBase().getType();
            if (op2.getBase().getName() === objName) {
                this.checkOptionalChainType(node, baseType, results);
            }

        }
        if (op2 instanceof ArkInstanceInvokeExpr) {
            let baseType = op2.getBase().getType();
            if (op2.getBase().getName() === objName) {
                this.checkOptionalChainType(node, baseType, results);
            }
        }
    }

    private checkChainStmtOfLeftOp(node: ts.PropertyAccessExpression | ts.CallExpression | ts.ElementAccessExpression,
        stmt: ArkAssignStmt, results: LocationInfo[]): void {
        let objName = node?.expression.getText();
        let op1 = stmt.getLeftOp() as Local;
        let declaringStmt = op1.getDeclaringStmt();
        if (declaringStmt && declaringStmt instanceof ArkAssignStmt) {
            const declaringRightOp = declaringStmt.getRightOp();
            if (declaringRightOp instanceof ArkInstanceFieldRef) {
                let base = declaringRightOp.getBase().getType();
                if (declaringRightOp.getBase().getName() === objName) {
                    this.checkOptionalChainType(node, base, results);
                }
            }
        }
        let startingStmt = declaringStmt?.getCfg().getStartingStmt().getCfg().getStartingStmt();
        if (startingStmt && startingStmt instanceof ArkAssignStmt) {
            const startingRightOp = startingStmt.getRightOp();
            if (startingRightOp instanceof ArkParameterRef) {
                const rightOpType = startingRightOp.getType();
                this.checkOptionalChainType(node, rightOpType, results);
            }
        }
    }


    private checkOptionalChainType(node: ts.PropertyAccessExpression | ts.CallExpression | ts.ElementAccessExpression,
        opType: Type, results: LocationInfo[]): void {
        let isUnknownType = opType instanceof UnknownType || opType instanceof VoidType;
        if (isUnknownType) {
            return;
        }
        let isNullType = opType instanceof NullType;
        let isUndefinedType = opType instanceof UndefinedType;
        if (!(opType instanceof UnionType) && !isNullType && !isUndefinedType) {
            this.reportOptionalChainIssue(node, results);
        }
        if (opType instanceof UnionType) {
            let hasNullOrUndefined = this.unionTypeParts(opType).some(ty =>
                ty instanceof NullType || ty instanceof UndefinedType);
            if (opType && !hasNullOrUndefined) {
                this.reportOptionalChainIssue(node, results);
            }
        }
    }

    private getQuestionDotToken(node: ts.Node): ts.Node | undefined {
        if (ts.isPropertyAccessExpression(node) && node?.questionDotToken) {
            return node?.questionDotToken;
        }
        if (ts.isCallExpression(node) && node?.questionDotToken) {
            return node?.questionDotToken;
        }
        if (ts.isElementAccessChain(node) && node?.questionDotToken) {
            return node?.questionDotToken;
        }
        return undefined;
    }

    private reportOptionalChainIssue(node: ts.PropertyAccessExpression | ts.CallExpression | ts.ElementAccessExpression | ts.BinaryExpression,
        results: LocationInfo[]): void {
        const questionDotToken = this.getQuestionDotToken(node);
        if (!questionDotToken) {
            return;
        }
        let characterLength: number;
        if (ts.isCallExpression(node) || ts.isElementAccessExpression(node) || ts.isBinaryExpression(node)) {
            // 对于 CallExpression 和 ElementAccessExpression
            characterLength = 2; // ?. 的长度为2
        } else {
            // 对于 PropertyAccessExpression
            characterLength = 1; // ? 的长度为1
        }
        // 获取行列号
        const { line, character } = this.rootNode.getSourceFile().getLineAndCharacterOfPosition(questionDotToken.getStart());
        const startLine = this.line + line;
        const endCol = this.col + character + characterLength;
        const startCol = this.col + character;
        let start = 0;
        const end = start + characterLength;

        results.push({
            fileName: this.rootNode.getSourceFile().fileName,
            line: startLine,
            startCol: startCol,
            endCol: endCol,
            start: start,
            end: end,
            nameStr: '?.',
            description: this.metaData.messages.neverOptionalChain,
            messageId: 'neverOptionalChain'
        });
    }

    private isConditionNode(node: ts.Node): boolean {
        return (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isWhileStatement(node) ||
            ts.isDoStatement(node) || ts.isConditionalExpression(node));
    }

    private visitCheck(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[]): void {
        if (stmt instanceof ArkAssignStmt) {
            stmt = stmt.getRightOp();
        }
        if (stmt instanceof ArkNormalBinopExpr && (!ts.isBinaryExpression(node) || node.right.getText() !== stmt.getOp2().toString())) {
            node = this.checkLocal(stmt, stmt.toString(), node) ?? node;
        }
        if (node && ts.isBinaryExpression(node)) {
            if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                node = node.right;
                this.visitCheck(stmt, node, results);
                return;
            }
            if ([
                ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.BarBarEqualsToken,
                ts.SyntaxKind.AmpersandAmpersandEqualsToken].includes(node.operatorToken.kind)) {
                this.checkAssignmentExpression(stmt, node, results);
            } else if ([
                NormalBinaryOperator.NullishCoalescing,
                NormalBinaryOperator.LogicalOr,
                NormalBinaryOperator.LogicalAnd].
                some(op => stmt instanceof ArkNormalBinopExpr && stmt.getOperator() === op)) {
                this.checkLogicalExpressionForUnnecessaryConditionals(stmt, node, results);
            } else {
                this.checkIfBinaryExpressionIsNecessaryConditional(stmt, node, results);
            }
        }

        this.visitCheckOfArkIfStmt(stmt, node, results);
        if (ts.isCallExpression(node) && stmt instanceof ArkInvokeStmt) {
            this.checkCallExpression(stmt, node, results);
        }
    }

    private visitCheckOfArkIfStmt(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[]): void {
        if (!node) {
            return;
        }
        if (!(stmt instanceof ArkIfStmt)) {
            return;
        }
        stmt = stmt.getConditionExpr();
        if (stmt instanceof ArkConditionExpr && !this.isConditionNode(node)) {
            node = this.checkLocal(stmt, stmt.toString(), node) ?? node;
            if (this.isConditionNode(node?.parent)) {
                node = node?.parent;
            }
        }
        let test = node;
        if (!test) {
            return;
        }
        if (ts.isDoStatement(node) || ts.isIfStatement(node) || ts.isWhileStatement(node)) {
            node = node?.expression;
        }
        if (ts.isConditionalExpression(node) || ts.isForStatement(node)) {
            if (!node?.condition) {
                return;
            }
            node = node?.condition;
        }
        this.visitCheckOfArkIfStmtOther(stmt, node, test, results);
    }

    private visitCheckOfArkIfStmtOther(stmt: Stmt | Value, test: ts.Node, node: ts.Node, results: LocationInfo[]): void {
        if (!test || !node) {
            return;
        }
        if (stmt instanceof ArkConditionExpr && stmt.getOp1() instanceof Local) {
            let op1 = stmt.getOp1() as Local;
            let decalarationStmt = op1.getDeclaringStmt();
            if (decalarationStmt && decalarationStmt instanceof ArkAssignStmt &&
                op1.getName().includes('%') && decalarationStmt.getRightOp() instanceof ArkNormalBinopExpr) {
                stmt = decalarationStmt;
            }
        }
        if (ts.isDoStatement(test) || ts.isForStatement(test) || ts.isWhileStatement(test)) {
            this.checkIfLoopIsNecessaryConditional(stmt, node, results);
        }
        if (ts.isConditionalExpression(test) || ts.isIfStatement(test) ||
            stmt instanceof ArkConditionExpr) {
            this.checkNode(stmt, node, results);
        }
    }

    private matchNormalBinopExpr(stmt: ArkNormalBinopExpr | ArkConditionExpr, stmtStr: string, node: ts.Node): string {
        let op1 = stmt.getOp1();
        let op2 = stmt.getOp2();
        let nodeText = '';
        let stmtStrs = stmtStr.split(stmt.getOperator());
        if (op1.getType() instanceof FunctionType && stmtStrs[0].includes('%') && ts.isConditionalExpression(node)) {
            let op1ReplaceText = this.getNormalBinopExprText(op1, node);
            nodeText = ts.isParenthesizedExpression(node?.condition) ? `(${op1ReplaceText})` : op1ReplaceText;
            stmtStrs[0] = this.replacePlaceholder(stmtStrs[0], op1ReplaceText);
        }

        if (stmtStr.includes('%') && ts.isBinaryExpression(node)) {

            if (op1 instanceof Local && op1.getName().includes('%')) {
                let op1ReplaceText = this.getNormalBinopExprText(op1, node);
                nodeText = ts.isParenthesizedExpression(node?.left) ? `(${op1ReplaceText})` : op1ReplaceText;
                stmtStrs[0] = this.replacePlaceholder(stmtStrs[0], nodeText);
            }
            if (op2 instanceof Local && op2.getName().includes('%')) {
                let op2ReplaceText = this.getNormalBinopExprText(op2, node);
                nodeText = ts.isParenthesizedExpression(node?.right) ? `(${op2ReplaceText})` : op2ReplaceText;
                stmtStrs[1] = this.replacePlaceholder(stmtStrs[1], nodeText);
            }
        }
        stmtStr = (stmt instanceof ArkConditionExpr &&
            [BooleanConstant, StringConstant, NumberConstant, LiteralType]
                .some(ty => op2 instanceof ty)) ?
            stmtStrs[0] : stmtStrs.join(stmt.getOperator()).toString();
        return stmtStr.trim();
    }

    private checkLocal(stmt: Stmt | Value, stmtStr: string, node: ts.Node): ts.Node | undefined {
        let isReplace = false;
        if (stmt instanceof ArkNormalBinopExpr) {
            let op1 = stmt.getOp1();
            let op2 = stmt.getOp2();
            if (ts.isBinaryExpression(node) &&
                stmt.getOperator() === node?.operatorToken.getText() &&
                (op2 instanceof Local && op2.getName() === node?.right.getText() ||
                    op1 instanceof Local && op1.getName() === node?.left.getText())) {
                return node;
            }
            stmtStr = this.matchNormalBinopExpr(stmt, stmtStr, node);
        }

        if (stmt instanceof ArkConditionExpr) {
            stmtStr = this.matchNormalBinopExpr(stmt, stmtStr, node);
        }
        let childtext = node?.getText().replace('?.', '.').replace('new', '');
        if (childtext.trim() === stmtStr.trim()) {
            isReplace = true;
            return node;
        }
        if (!isReplace) {
            let childs = node?.getChildren();
            for (const child of childs) {
                let result = this.checkLocal(stmt, stmtStr, child);
                if (result) {
                    return result;
                }
            }
        }
        return undefined;
    }

    private getNormalBinopExprText(stmt: Value | Stmt, node: ts.Node): string {
        if (!node) {
            return stmt.toString();
        }
        if (stmt instanceof ArkNormalBinopExpr) {
            return this.matchNormalBinopExpr(stmt, stmt.toString(), node);
        }
        if (stmt instanceof ArkInstanceFieldRef) {
            return `${stmt.getBase().getName()}.${stmt.getFieldSignature().getFieldName()}`;
        }
        if (stmt instanceof ArkAssignStmt) {
            return this.getNormalBinopExprText(stmt.getRightOp(), node);
        }

        if (stmt instanceof ArkNewExpr) {
            const className = stmt.getClassType().getClassSignature().getClassName();
            const cls = this.globalMethod.getDeclaringArkClass().getDeclaringArkFile().getClassWithName(className);
            const code = cls?.getCode();
            return code ?? className;

        }
        if (stmt instanceof Local) {
            const decalarationStmt = stmt.getDeclaringStmt();
            if (decalarationStmt instanceof ArkAssignStmt) {
                return this.getNormalBinopExprText(decalarationStmt, node);
            }
            if (!decalarationStmt && stmt.getType() instanceof FunctionType) {
                const method = this.globalMethod.getDeclaringArkClass().getMethodWithName(stmt.getName());
                const methodCode = method?.getCode();
                if (methodCode) {
                    return methodCode;
                }
            }
        }
        return stmt.toString();
    }

    private replacePlaceholder(input: string, replacement: string): string {
        // 使用正则表达式匹配 % 后面跟随字母或数字的占位符
        return input.replace(/%\w+/g, replacement);
    }

    private checkIfBinaryExpressionIsNecessaryConditional(stmt: Stmt | Value, node: ts.BinaryExpression, results: LocationInfo[]): void {
        if (stmt instanceof ArkAssignStmt) {
            stmt = stmt.getRightOp();
        }
        if (stmt instanceof ArkNormalBinopExpr || stmt instanceof ArkConditionExpr) {
            if (!this.BOOL_OPERATORS.has(stmt.getOperator())) {
                return;
            }
            let leftType = this.getConstrainedType(stmt.getOp1(), node.left);
            let rightType = this.getConstrainedType(stmt.getOp2(), node.right);
            if (leftType === undefined || rightType === undefined) {
                return;
            }
            if (this.isLiteralType(leftType) && this.isLiteralType(rightType)) {
                this.reportIssue(node, 'literalBooleanExpression', results);
                return;
            }
            const isComparable = (type: Type, types: Type[]): boolean => {
                // Allow comparison to `any`, `unknown` or a naked type parameter.
                types.push(AnyType.getInstance(), UnknownType.getInstance());

                // Allow loose comparison to nullish values.
                if (node && (node.operatorToken.getText() === '==' || node.operatorToken.getText() === '!=')) {
                    types.push(NullType.getInstance(), UndefinedType.getInstance(), VoidType.getInstance());
                }
                return types.some(t => t === type);
            };
            if ((leftType instanceof UndefinedType &&
                !isComparable(rightType, [UndefinedType.getInstance(), VoidType.getInstance()])) ||
                (rightType instanceof UndefinedType &&
                    !isComparable(leftType, [AnyType.getInstance(), UnknownType.getInstance()])) ||
                (leftType instanceof NullType && !isComparable(rightType, [NullType.getInstance()])) ||
                (rightType instanceof NullType && !isComparable(leftType, [NullType.getInstance()]))
            ) {
                this.reportIssue(node, 'noOverlapBooleanExpression', results);
                return;
            }
        }
    }

    private unionTypeParts(type: Type): Type[] {
        if (type instanceof UnionType || type instanceof IntersectionType) {
            return type.getTypes();
        }
        return [type];
    }


    private getVariableType(ast: ts.VariableStatement | ts.VariableDeclaration, name: string, leftOp: Local): Type | undefined {
        if (ts.isVariableStatement(ast)) {
            let declaration = ast.declarationList.declarations.find(declaration =>
                ts.isIdentifier(declaration.name) && declaration.name.getText() === name);
            if (declaration) {
                return this.getVariableType(declaration, name, leftOp);
            }
        }
        if (ts.isVariableDeclaration(ast)) {
            if (ast.type) {
                if (ast.type?.kind === ts.SyntaxKind.StringKeyword) {
                    return StringType.getInstance();
                }
                if (ast.type?.kind === ts.SyntaxKind.NumberKeyword) {
                    return NumberType.getInstance();
                }
                if (ast.type?.kind === ts.SyntaxKind.BooleanKeyword) {
                    return BooleanType.getInstance();
                }
                return undefined;
            }
            if (ast.initializer) {
                if (leftOp.getConstFlag() && [
                    ts.SyntaxKind.NumericLiteral,
                    ts.SyntaxKind.StringLiteral,
                ].includes(ast.initializer?.kind)) {
                    return new LiteralType(ast.initializer.getText());
                }
                if (ts.SyntaxKind.TrueKeyword === ast.initializer?.kind) {
                    return new LiteralType(true);
                }
                if (ts.SyntaxKind.FalseKeyword === ast.initializer?.kind) {
                    return new LiteralType(false);
                }
            }
        }
        return undefined;
    }
    /**
     * 获取变量的实际类型
     * @param name 变量名
     * @returns 变量的实际类型
     */
    private getTypeByName(name: string): Type | undefined {
        let type = undefined;
        //先检查是否当前方法入参变量
        this.globalMethod.getParameters().forEach(parameter => {
            if (parameter.getName() === name) {
                type = parameter.getType();
            }
        });
        if (type) {
            return type;
        }
        //再检查是否当前方法的局部变量
        let declarStmt: Stmt | undefined;
        let stmts = this.globalMethod.getBody()?.getCfg().getStmts() ?? [];
        let seekIndex = stmts.length - 1;
        for (let i = 0; i < stmts.length - 1; i++) {
            let stmt = stmts[i];
            if (stmt === this.globalStmt) {
                seekIndex = i;
                break;
            }
        }
        //根据当前Stmt下标，从后往前遍历，找到变量声明语句或者赋值语句
        for (let i = seekIndex; i >= 0; i--) {
            let seekStmt = stmts[i];
            if (seekStmt instanceof ArkAssignStmt && seekStmt.getLeftOp() instanceof Local) {
                let leftLocal = seekStmt.getLeftOp() as Local;
                if (leftLocal.getName() === name) {
                    declarStmt = seekStmt;
                    break;
                }
            }
        }
        if (!declarStmt) {
            declarStmt = this.getDeclarStmt(stmts, name, seekIndex);
        }
        if (declarStmt instanceof ArkAssignStmt) {
            type = this.getTypeByArkAssignStmt(declarStmt, name);
        }

        if (!type) {
            let method = this.globalMethod.getDeclaringArkClass().getMethodWithName(name);
            if (method) {
                type = new FunctionType(method.getSignature());
            }
        }
        return type;
    }
    private getDeclarStmt(stmts: Stmt[], name: string, seekIndex: number): Stmt | undefined {
        let declarStmt: Stmt | undefined;
        for (let i = seekIndex; i < stmts.length - 1; i++) {
            let seekStmt = stmts[i];
            if (seekStmt instanceof ArkAssignStmt &&
                seekStmt.getLeftOp() instanceof Local) {
                let leftLocal = seekStmt.getLeftOp() as Local;
                if (leftLocal.getName() === name) {
                    declarStmt = seekStmt;
                    break;
                }
            }
        }
        return declarStmt;
    }

    private getTypeByArkAssignStmt(declarStmt: ArkAssignStmt, name: string): Type | undefined {
        let type = undefined;
        let rightOp = declarStmt.getRightOp();
        let leftOp = declarStmt.getLeftOp();
        type = this.getTypeByArkAssignStmtOther(declarStmt, name);
        // 如果左操作数是联合类型，且右操作数不是undefined，则取右操作数的类型
        if (leftOp.getType() instanceof UnionType && !(rightOp instanceof UndefinedConstant)) {
            type = rightOp.getType();
        }
        if (!type && leftOp instanceof Local && leftOp.getConstFlag() &&
            (rightOp instanceof NumberConstant || rightOp instanceof StringConstant || rightOp instanceof BooleanConstant)) {
            return new LiteralType(rightOp.getValue());
        }

        if (!type && rightOp || (type instanceof UnknownType && !(rightOp instanceof UnknownType))) {
            type = rightOp.getType();
        }

        if (type instanceof UnknownType && leftOp instanceof Local && rightOp instanceof ArkInstanceInvokeExpr) {
            let clsName = rightOp.getBase().getName();
            let arg0 = rightOp.getArg(0);
            if (rightOp.getBase().getType() instanceof ClassType && clsName === 'Promise' && arg0 && arg0 instanceof Constant) {
                type = arg0.getType();
            }
        }
        return type;
    }

    private getTypeByArkAssignStmtOther(declarStmt: ArkAssignStmt, name: string): Type | undefined {
        let type = undefined;
        let leftOp = declarStmt.getLeftOp();
        let ast = AstTreeUtils.getASTNode('temp', declarStmt.getOriginalText() ?? '');
        let astNode = ast.statements[0];
        if (leftOp instanceof Local && (ts.isVariableStatement(astNode) || ts.isVariableDeclaration(astNode))) {
            type = this.getVariableType(astNode, name, leftOp);
        }
        if (!type && leftOp.getType()) {
            //如果左操作为有效类型则取左操作数的类型
            type = leftOp.getType();
        }
        return type;
    }

    // 辅助方法：创建和添加问题报告
    private reportIssue(
        node: ts.Node,
        messageId: string,
        results: LocationInfo[]
    ): void {
        if (!node) {
            return;
        }
        const { line, character } = this.rootNode.getSourceFile().getLineAndCharacterOfPosition(node?.getStart());
        const assertionName = node?.getText();
        const start = node?.getStart();
        const end = node?.getEnd();
        const endCharacter = character + assertionName.length;

        results.push({
            fileName: this.rootNode.getSourceFile().fileName,
            line: this.line + line,
            startCol: this.col + character,
            endCol: this.col + endCharacter,
            start: start,
            end: end,
            nameStr: assertionName,
            description: this.metaData.messages[messageId],
            messageId: messageId
        });
    }

    // 创建修复对象 
    private ruleFix(loc: LocationInfo, sourceFile: ts.SourceFile): RuleFix {
        const [start, end] = this.getFixRange(loc, sourceFile);
        return { range: [start, end], text: '' };
    }

    // 获取起始位置和结束位置
    private getFixRange(loc: LocationInfo, sourceFile: ts.SourceFile): [number, number] {
        const startPosition = this.getLineStartPosition(sourceFile, loc.line) + loc.startCol - 1;
        const endPosition = startPosition + loc.end;
        return [startPosition, endPosition];
    }


    // 获取相对全文起始位置
    private getLineStartPosition(sourceFile: ts.SourceFile, lineNumber: number): number {
        // 将字符串按行分割成数组
        const lines = sourceFile.getFullText().split('\n');

        // 检查行号是否有效
        if (lineNumber < 1 || lineNumber > lines.length) {
            return 0; // 行号无效，返回 null
        }

        // 计算指定行的起始位置
        let position = 0;
        for (let i = 0; i < lineNumber - 1; i++) {
            position += lines[i].length + 1; // 加 1 是为了包括换行符
        }
        return position;
    }

    private addIssueReportNodeFix(loc: LocationInfo, arkFile: ArkFile): void {

        const filePath = arkFile.getFilePath();
        const severity = this.rule.alert ?? this.metaData.severity;
        if (loc.description) {
            this.metaData.description = loc.description;
        }
        if (loc.nameStr === '?.') {
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
            let defectFix = new Defects(loc.line, loc.startCol, loc.endCol, this.metaData.description, severity,
                this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
            let fix: RuleFix = this.ruleFix(loc, sourceFile);
            this.issues.push(new IssueReport(defectFix, fix));
            RuleListUtil.push(defectFix);
        } else {
            let defect = new Defects(loc.line, loc.startCol, loc.endCol, this.metaData.description, severity,
                this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defect, undefined));
            RuleListUtil.push(defect);
        }
    }
}