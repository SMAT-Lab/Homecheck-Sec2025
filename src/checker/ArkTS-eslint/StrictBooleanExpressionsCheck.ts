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
    BigIntType,
    EnumValueType,
    ArkReturnStmt
} from 'arkanalyzer';


import { ModifierType } from 'arkanalyzer/lib/core/model/ArkBaseModel';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { RuleFix } from '../../model/Fix';
import { BooleanConstant, NumberConstant, StringConstant, UndefinedConstant } from 'arkanalyzer/lib/core/base/Constant';
import { MethodParameter } from 'arkanalyzer/lib/core/model/builder/ArkMethodBuilder';

//strict-boolean-expressions-check
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/strict-boolean-expressions.md',
    description: 'Disallow certain types in boolean expressions',
    requiresTypeChecking: true,
    //将这里面的改成 StrictBooleanExpressionsCheck中需要上报的消息类型

    messages: {
        conditionErrorOther:
            'Unexpected value in conditional. ' +
            'A boolean expression is required.',
        conditionErrorAny:
            'Unexpected any value in conditional. An explicit comparison or type cast is required.',
        conditionErrorNullish:
            'Unexpected nullish value in conditional. The condition is always false.',
        conditionErrorNullableBoolean:
            'Unexpected nullable boolean value in conditional. ' +
            'Please handle the nullish case explicitly.',
        conditionErrorString:
            'Unexpected string value in conditional. ' +
            'An explicit empty string check is required.',
        conditionErrorNullableString:
            'Unexpected nullable string value in conditional. ' +
            'Please handle the nullish/empty cases explicitly.',
        conditionErrorNumber:
            'Unexpected number value in conditional. ' +
            'An explicit zero/NaN check is required.',
        conditionErrorNullableNumber:
            'Unexpected nullable number value in conditional. ' +
            'Please handle the nullish/zero/NaN cases explicitly.',
        conditionErrorObject:
            'Unexpected object value in conditional. ' +
            'The condition is always true.',
        conditionErrorNullableObject:
            'Unexpected nullable object value in conditional. ' +
            'An explicit null check is required.',
        conditionErrorNullableEnum:
            'Unexpected nullable enum value in conditional. ' +
            'Please handle the nullish/zero/NaN cases explicitly.',
        noStrictNullCheck:
            'This rule requires the `strictNullChecks` compiler option to be turned on to function correctly.',

        conditionFixDefaultFalse:
            'Explicitly treat nullish value the same as false (`value ?? false`)',
        conditionFixDefaultEmptyString:
            'Explicitly treat nullish value the same as an empty string (`value ?? \'\'`)',
        conditionFixDefaultZero:
            'Explicitly treat nullish value the same as 0 (`value ?? 0`)',
        conditionFixCompareNullish:
            'Change condition to check for null/undefined (`value != null`)',
        conditionFixCastBoolean:
            'Explicitly cast value to a boolean (`Boolean(value)`)',
        conditionFixCompareTrue:
            'Change condition to check if true (`value === true`)',
        conditionFixCompareFalse:
            'Change condition to check if false (`value === false`)',
        conditionFixCompareStringLength:
            'Change condition to check string\'s length (`value.length !== 0`)',
        conditionFixCompareEmptyString:
            'Change condition to check for empty string (`value !== \'\'`)',
        conditionFixCompareZero:
            'Change condition to check for 0 (`value !== 0`)',
        conditionFixCompareNaN:
            'Change condition to check for NaN (`!Number.isNaN(value)`)',
    }
};
const a_r = new RegExp(/\[|\]/g);
const b_r = new RegExp(/\s*/g);
const c_r = new RegExp(/[()]/g);
const d_r = new RegExp(/\[([^\]]+)\]/g);
const ConstantType = [StringConstant, NumberConstant, BooleanConstant];

interface Options {
    allowAny?: boolean;
    allowNullableBoolean?: boolean;
    allowNullableEnum?: boolean;
    allowNullableNumber?: boolean;
    allowNullableObject?: boolean;
    allowNullableString?: boolean;
    allowNumber?: boolean;
    allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing?: boolean;
    allowString?: boolean;
    ignoreInBinaryExpression?: boolean;
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
type VariantType =
    | 'any'
    | 'boolean'
    | 'enum'
    | 'never'
    | 'nullish'
    | 'number'
    | 'object'
    | 'string'
    | 'truthy boolean'
    | 'truthy number'
    | 'truthy string';

export class StrictBooleanExpressionsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private line: number = 0;
    private col: number = 0;
    private locationInfos: LocationInfo[] = [];
    private globalStmt: Stmt;
    private rootNode: ts.Node;
    private globalMethod: ArkMethod;
    private option: Options;
    private traversedNodes: Map<string, Set<Stmt | Value>> = new Map();
    private globalStmtCode: string;
    private checkLocalIsReplace: boolean = false;
    private useMethod: string[] = [];
    private types: Set<VariantType>;
    private typeCache: Map<string, Type> = new Map();


    private defaultOptions: Options = {
        allowString: true,
        allowNumber: true,
        allowNullableObject: true,
        allowNullableBoolean: false,
        allowNullableString: false,
        allowNullableNumber: false,
        allowNullableEnum: false,
        allowAny: false,
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
    public check = (arkFile: ArkFile): void => {
        this.locationInfos = [];
        const code = arkFile.getCode();
        if (!code) {
            return;
        }
        this.option = this.rule && this.rule.option[0] ? this.rule.option[0] as Options : this.defaultOptions;
        arkFile.getClasses().forEach(cls => this.checkClass(cls));
        this.sortAndReportErrors(arkFile);
        // 输出结果
        this.locationInfos.forEach(loc => {
            this.addIssueReportNodeFix(loc, arkFile);
        });
    }
    private isConditionNode(node: ts.Node): boolean {
        return ts.isIfStatement(node) ||
            ts.isForStatement(node) ||
            ts.isWhileStatement(node) ||
            ts.isDoStatement(node) ||
            ts.isConditionalExpression(node);
    }

    /**
     * 处理逻辑非表达式(!)
     * @param stmt 
     * @param node 
     * @param results 
     */
    private traverseUnaryLogicalExpression(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[]): void {
        if (!node.kind) {
            return;
        }
        if (stmt instanceof ArkAssignStmt) {
            stmt = stmt.getRightOp();
        }
        if (stmt instanceof Local && stmt.getDeclaringStmt() && stmt.getName().includes('%')) {
            let decalarationStmt = stmt.getDeclaringStmt() as ArkAssignStmt;
            this.traverseUnaryLogicalExpression(decalarationStmt, node, results);
            return;
        }
        this.traverseNode(stmt, node, results, true, true);
    }

    private traverseNode(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[],
        isCondition: boolean = false, isUnary: boolean = false, count: number = 0): void {
        if (count > 5 || !node.kind) {
            return;
        }
        count++;
        if (stmt instanceof Local && stmt.getName().includes('%') &&
            stmt.getType() instanceof BooleanType) {
            stmt = stmt.getDeclaringStmt() ?? stmt;
        }
        if (stmt instanceof ArkAssignStmt) {
            stmt = stmt.getRightOp();
        }
        // for logical operator, we check its operands 
        if (
            stmt instanceof ArkNormalBinopExpr &&
            stmt.getOperator() !== '??'
        ) {
            this.traverseLogicalExpression(stmt, node, results, isCondition, count);
            return;
        }
        // skip if node is not a condition
        if (!isCondition) {
            return;
        }
        let nodes: Set<Value | Stmt> = this.traversedNodes.get(this.globalStmtCode) ?? new Set();
        if (nodes.has(stmt)) {
            return;
        }
        nodes.add(stmt);
        this.traversedNodes.set(this.globalStmtCode, nodes);
        this.checkNode(stmt, node, results, isUnary);
    }

    /**
     * 处理逻辑与表达式(&&、||)
     */
    private traverseLogicalExpression(stmt: Stmt | Value, node: ts.Node,
        results: LocationInfo[], isCondition: boolean = false, count: number = 0): void {
        if (!node.kind) {
            return;
        }
        if (ts.isParenthesizedExpression(node)) {
            this.traverseLogicalExpression(stmt, node.expression, results, isCondition);
            return;
        }

        if (ts.isBinaryExpression(node) && stmt instanceof ArkNormalBinopExpr &&
            [NormalBinaryOperator.LogicalAnd, NormalBinaryOperator.LogicalOr].some(logic => stmt.getOperator() === logic)) {
            if (ts.SyntaxKind.BarBarEqualsToken === node.operatorToken.kind) {
                this.traverseLogicalExpression(stmt.getOp2(), node.right, results, isCondition);
                return;
            }

            let op1 = stmt.getOp1();
            let op2 = stmt.getOp2();
            this.traverseNode(op1, node.left, results, true, false, count);
            this.traverseNode(op2, node.right, results, isCondition, false, count);
        }
    }

    /**
     * 处理if语句的测试表达式
     * @param Ifstmt 
     * @param node 
     * @param results 
     * @returns 
     */
    private traverseTestExpression(Ifstmt: ArkIfStmt, node: ts.Node, results: LocationInfo[]): void {
        let stmt: Stmt | Value = Ifstmt.getConditionExpr();
        if (!(stmt instanceof ArkConditionExpr)) {
            return;
        }
        const operator = stmt.getOperator();
        if (operator !== '!=' && operator !== '&&' && operator !== '||') {
            return;
        }
        if (!this.isConditionNode(node)) {
            this.checkLocalIsReplace = false;
            node = this.checkLocal(stmt, stmt.toString(), node) ?? node;
            node = ts.isParenthesizedExpression(node.parent) ? node.parent : node;
            node = this.isConditionNode(node.parent) ? node.parent : node;

        }
        let test = node;
        if (ts.isDoStatement(node) || ts.isIfStatement(node) || ts.isWhileStatement(node)) {
            node = node.expression;
        }
        if (ts.isConditionalExpression(node) || ts.isForStatement(node)) {
            if (node.condition) {
                node = node.condition;
            }
        }
        this.checkArkCondition(stmt, node, test, results);
    }

    private checkArkCondition(stmt: Stmt | Value, node: ts.Node, test: ts.Node, results: LocationInfo[]): void {
        if (stmt instanceof ArkConditionExpr && stmt.getOp1() instanceof Local) {
            let op1 = stmt.getOp1() as Local;
            let decalarationStmt = op1.getDeclaringStmt();
            if (decalarationStmt instanceof ArkAssignStmt) {
                if (op1.getName().includes('%') && decalarationStmt.getRightOp() instanceof ArkNormalBinopExpr) {
                    stmt = decalarationStmt;
                }
            }
        }
        if (this.isConditionNode(test)) {
            this.traverseNode(stmt, node, results, true);
        }
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
        let originCode = arkStmt.getOriginalText() ?? '';
        const astNode = AstTreeUtils.getASTNode('temp', originCode);
        if (!this.traversedNodes.has(originCode)) {
            this.globalStmtCode = originCode;
            this.traversedNodes.set(originCode, new Set());
        }
        if (astNode) {
            this.locationInfos.push(...this.checkCondition(astNode));
        }
    }

    private checkNodePre(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[]): void {
        if (!node.kind) {
            return;
        }
        if (ts.isParenthesizedExpression(node)) {
            this.checkNodePre(stmt, node.expression, results);
            return;
        }
        if (stmt instanceof ArkReturnStmt) {
            stmt = stmt.getOp();
        }
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp();
            if (ConstantType.some(value => rightOp instanceof value) &&
                [ArkNormalBinopExpr, ArkConditionExpr].every(value => !(rightOp instanceof value))) {
                return;
            }
            if (!(rightOp instanceof UndefinedConstant)) {
                stmt = rightOp;
            }
        }
        this.checkNominalType(stmt, node, results);
    }

    private checkNominalType(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[]): void {
        if (stmt instanceof Local && stmt.getDeclaringStmt() && stmt.getName().includes('%')) {
            //处理这种嵌套的逻辑表达式(a || b) && c
            let decalarationStmt = stmt.getDeclaringStmt() as ArkAssignStmt;
            this.checkNodePre(decalarationStmt, node, results);
            return;
        }
        if ((stmt instanceof ArkNormalBinopExpr &&
            (!ts.isBinaryExpression(node) ||
                node.right.getText() !== stmt.getOp2().toString())
        ) || stmt instanceof ArkUnopExpr) {
            this.checkLocalIsReplace = false;
            node = this.checkLocal(stmt, stmt.toString(), node) ?? node;
        }
        if (!node.kind) {
            return;
        }
        if (stmt instanceof ArkNormalBinopExpr &&
            stmt.getOperator() !== NormalBinaryOperator.NullishCoalescing && node &&
            ts.isBinaryExpression(node)) {
            this.traverseLogicalExpression(stmt, node, results);
            return;
        }
        if (node && ts.isPrefixUnaryExpression(node)) {
            if (stmt instanceof ArkUnopExpr && stmt.getOperator() === UnaryOperator.LogicalNot) {
                this.traverseUnaryLogicalExpression(stmt.getOp(), node, results);
            }
        }
    }

    private getTypeWithCondition(stmt: ArkConditionExpr, node: ts.Node): Type | undefined {
        let op1 = stmt.getOp1();
        let op2 = stmt.getOp2();
        let operator = stmt.getOperator();
        let op1Type = this.getConstrainedType(op1, node);
        node = ts.isParenthesizedExpression(node) ? node.expression : node;
        //如果条件表达式是a=1,则op1Type为1
        if (ts.isIdentifier(node) && ts.isBinaryExpression(node.parent)) {
            node = node.parent;
        }
        if (ts.isBinaryExpression(node)) {
            //这个符号底座暂时解析出来和||没区别，比如a||=b,补全写法为a= a||b,这个时候a的类型为Any
            if (op1 instanceof Local && node.left.getText() === op1.getName() &&
                node.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken) {
                return AnyType.getInstance();
            }
            if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
                ['false', '0', '', 'undefined'].includes(node.right.getText())) {
                if (ts.isLiteralExpression(node.right)) {
                    op1Type = new LiteralType(node.right.text);
                } else if (ts.isParenthesizedExpression(node.right) && ts.isLiteralExpression(node.right.expression)) {
                    op1Type = new LiteralType(node.right.expression.text);
                }
            }
            if (!(op1Type instanceof LiteralType) &&
                node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                return op1Type;
            }
        }
        let op2Type = this.getConstrainedType(op2, node);
        if (node && !ts.isBinaryExpression(node) && !(op1Type instanceof LiteralType) && operator === '!=') {
            if ([LiteralType, NumberType, StringType, BooleanType, UndefinedType, NullType].
                some(ty => op2Type instanceof ty)) {
                return op1Type;
            }
        } return BooleanType.getInstance();
    }

    private getTypeWithNew(stmt: ArkNewExpr, node: ts.Node): Type | undefined {
        let type: Type | undefined = undefined;
        if (ts.isNewExpression(node) && node.arguments && node.arguments[0] && ts.isLiteralExpression(node.arguments[0])) {
            let argument = node.arguments[0];
            if (argument.kind === ts.SyntaxKind.TrueKeyword) {
                type = new LiteralType(true);
            }
            if (argument.kind === ts.SyntaxKind.FalseKeyword) {
                type = new LiteralType(false);
            }
            if (ts.isStringLiteral(argument) ||
                ts.isNumericLiteral(argument) ||
                ts.isBigIntLiteral(argument)) {
                type = new LiteralType(argument.text);
            }
            return type;
        }
        return stmt.getClassType();
    }
    private getClassInstanceType(fieldName: string, clsName: string, isField: boolean): Type | undefined {
        let baseCls = this.globalMethod.getDeclaringArkClass().getDeclaringArkFile().getClassWithName(clsName);
        if (!baseCls) {
            return undefined;
        }
        if (isField) {
            let clsField = baseCls.getFieldWithName(fieldName);
            let clsFieldTy = clsField?.getSignature().getType();
            if (clsField && clsFieldTy) {
                return clsField.getQuestionToken() ? new UnionType([clsFieldTy, UndefinedType.getInstance()]) : clsFieldTy;
            }
        } else {
            let method = baseCls.getMethodWithName(fieldName);
            if (method) {
                let functionty = new FunctionType(method.getSignature());
                return method?.getQuestionToken() ? new UnionType([functionty, UndefinedType.getInstance()
                ]) : functionty;
            }

        }
        return undefined;

    }

    private getTypeWithInvoke(stmt: AbstractInvokeExpr, node: ts.Node): Type | undefined {
        let type: Type | FunctionType = new FunctionType(stmt.getMethodSignature());
        const methodName = stmt.getMethodSignature().getMethodSubSignature().getMethodName();
        const method = this.globalMethod.getDeclaringArkClass().getMethodWithName(methodName);
        if (methodName.includes('sNaN')) {
            return BooleanType.getInstance();
        }
        if (stmt instanceof ArkInstanceInvokeExpr) {
            let base = stmt.getBase();
            let baseType = base.getType();
            if (baseType instanceof ClassType) {
                let clsName = baseType.getClassSignature().getClassName();
                let clstype = this.getClassTypeWithClsName(stmt, clsName, methodName);
                return clstype ? clstype : this.getClassInstanceType(methodName, clsName, false) ?? baseType;
            }
            if (methodName === 'includes') {
                return BooleanType.getInstance();
            }
            return stmt.getMethodSignature().getMethodSubSignature().getReturnType();
        }

        if (stmt instanceof ArkStaticInvokeExpr) {
            let clsName = method?.getSignature().getDeclaringClassSignature().getClassName();
            return clsName ? BooleanType.getInstance() : ['Boolean', 'Number', 'String'].includes(methodName) ?
                BooleanType.getInstance() : UnknownType.getInstance();
        }

        if (!type && method) {
            type = method.getReturnType();
            if (type instanceof VoidType && method.containsModifier(ModifierType.ASYNC)) {
                type = new UnclearReferenceType('Promise', [AnyType.getInstance()]);
            }
            return type;
        }
        return type;
    }

    private getClassTypeWithClsName(stmt: ArkInstanceInvokeExpr, clsName: string, methodName: string): Type | undefined {
        if (clsName === 'Promise') {
            return new UnclearReferenceType('Promise', [stmt.getBase().getType()]);
        }
        if (clsName === 'RegExp') {
            switch (methodName) {
                case 'test':
                    return BooleanType.getInstance();
                case 'exec':
                    return new UnionType([new UnclearReferenceType('RegExpExecArray', [AnyType.getInstance()]), NullType.getInstance()]);
                case 'toString':
                    return StringType.getInstance();
                case 'compile':
                    return new UnclearReferenceType('RegExp', [AnyType.getInstance()]);
                default:
                    return UnknownType.getInstance();
            }
        }
        return undefined;
    }

    private getTypeWithLocal(stmt: Stmt | Value, node: ts.Node, count: number): Type | undefined {
        let type: Type | undefined = undefined;
        if (stmt instanceof ArkAssignStmt) {
            const leftOp = stmt.getLeftOp();
            const rightOp = stmt.getRightOp();
            if (leftOp instanceof Local && !leftOp.getName().includes('%')) {
                if (ConstantType.some(ty => rightOp instanceof ty)) {
                    return leftOp.getConstFlag() ? new LiteralType((rightOp as Constant).getValue()) : rightOp.getType();
                }
                type = this.getConstrainedType(leftOp, node, count);
            }
            //左侧没有声明，则通过右侧的类型推断
            if (!type || type instanceof UnknownType) {
                return this.getConstrainedType(rightOp, node, count);
            }
        }

        if (stmt instanceof Local) {
            if (!stmt.getName().includes('%')) {
                type = this.getTypeByName(stmt.getName());
            }
            let decalarationStmt = stmt.getDeclaringStmt();
            if (!type && decalarationStmt) {
                return this.getConstrainedType(decalarationStmt, node, count);
            }
            if (['Infinity', 'NaN'].includes(stmt.getName())) {
                return NumberType.getInstance();
            }
            //如果变量声明没有类型，则通过声明语句获取类型
            if (!type && stmt.getType()) {
                type = stmt.getType();
            }

            if (type instanceof GenericType) {
                type = type.getConstraint() ? type.getConstraint() : type.getDefaultType() ??
                    AnyType.getInstance();
            }
        }
        return type;
    }

    private getTypesByUnionType(type: Type): Type[] {
        if (type instanceof UnionType || type instanceof IntersectionType) {
            return type.getTypes();
        }
        return [type];
    }

    private getTypeWithOtherValue(stmt: Value | Stmt, node: ts.Node, count: number): Type | undefined {
        if (stmt instanceof ArkInstanceFieldRef) {
            let field = stmt.getFieldSignature();
            let fieldTy = field.getType();
            let fieldBaseTy = stmt.getBase().getType();
            if (fieldBaseTy instanceof ClassType) {
                return this.getClassInstanceType(field.getFieldName(), fieldBaseTy.getClassSignature().getClassName(),
                    !(fieldTy instanceof FunctionType)) ?? fieldTy;
            }
            if (stmt.getBase().getType() instanceof ArrayType && stmt.getFieldSignature().getFieldName() === 'length') {
                return NumberType.getInstance();
            }
            if (field.getType() instanceof UnknownType) {
                let clsty = this.getTypesByUnionType(stmt.getBase().getType()).find(ty => ty instanceof ClassType) as ClassType;
                let cls = this.globalMethod.getDeclaringArkClass().getDeclaringArkFile()
                    .getClassWithName(clsty?.getClassSignature().getClassName());
                let clsField = cls?.getFieldWithName(stmt.getFieldSignature().getFieldName());
                return clsField?.getType() ?? UnknownType.getInstance();
            }
            return field.getType();
        }
        if (stmt instanceof ArkAwaitExpr) {
            let type = this.getConstrainedType(stmt.getPromise(), node, count);
            if (type instanceof UnclearReferenceType && type.getName() === 'Promise') {
                return type.getGenericTypes()[0];
            }
            return type;
        }
        if (stmt instanceof AbstractInvokeExpr) {
            //调用表达式，如果是调用方法，则判断其方法返回类型
            return this.getTypeWithInvoke(stmt, node);
        }
        if (stmt instanceof ArkNewArrayExpr) {
            return new ArrayType(stmt.getBaseType(), 1);
        }
        if (stmt instanceof AbstractFieldRef) {
            //变量使用，其中包含了调用变量例如：a.b.c
            const fieldSignature = stmt.getFieldSignature();
            return fieldSignature.getType();
        }
        if (stmt instanceof ArkPtrInvokeExpr ||
            stmt instanceof ArkParameterRef) {
            return stmt.getType();
        }
        return undefined;
    }

    private getConstrainedType(stmt: Value | Stmt, node: ts.Node, count: number = 0): Type | undefined {
        if (count > 10) {
            return undefined;
        }
        count++;
        let type: Type | undefined = undefined;
        if (stmt instanceof ArkConditionExpr) {
            return this.getTypeWithCondition(stmt, node);
        }
        if (stmt instanceof ArkTypeOfExpr && ts.isTypeOfExpression(node)) {
            return this.getConstrainedType(stmt.getOp(), node);
        }
        if (stmt instanceof ArkNewExpr) {
            return this.getTypeWithNew(stmt, node);
        }
        //字面量类型
        if (stmt instanceof Constant) {
            return ConstantType.some(ty => stmt instanceof ty) ?
                this.getLiteralType(stmt) : stmt.getType();
        }
        if (stmt instanceof ArkAssignStmt || stmt instanceof Local) {
            return this.getTypeWithLocal(stmt, node, count);
        }
        if (stmt instanceof ClassType) {
            type = stmt;
        }
        return this.getTypeWithOtherValue(stmt, node, count);
    }

    private getLiteralType(stmt: Constant): LiteralType {
        let literal = new LiteralType(stmt.getValue());
        if (stmt instanceof BooleanConstant) {
            literal = new LiteralType(stmt.getValue() === 'true');
        }
        if (stmt instanceof StringConstant) {
            literal = new LiteralType(stmt.getValue());
        }
        if (stmt instanceof NumberConstant) {
            literal = new LiteralType(Number(stmt.getValue()));
        }
        return literal;
    }
    /**
     * 获取变量的实际类型
     * @param name 变量名
     * @returns 变量的实际类型
     */
    private getTypeByName(name: string, arkMethod: ArkMethod = this.globalMethod): Type | undefined {
        let type = undefined;
        //先检查是否当前方法入参变量
        arkMethod.getParameters().forEach(parameter => {
            if (parameter instanceof MethodParameter && parameter.getName() === name) {
                let paramType = parameter.getType();
                type = parameter.isOptional() ? [StringType, BooleanType, NumberType].some(ty => paramType instanceof ty) ?
                    new UnionType([parameter.getType(), UndefinedType.getInstance()]) : AnyType.getInstance() : paramType;

            }
        });
        if (type) {
            return type;
        }
        //再检查是否当前方法的局部变量
        const declarStmt = this.getFindVariableStmt(name, arkMethod);
        if (declarStmt instanceof ArkAssignStmt) {
            type = this.inAssignStmt(declarStmt, name, type);
        }
        //当前方法没找到，则检查全局变量
        let defaultMethod = arkMethod.getDeclaringArkClass().getDefaultArkMethod();
        if (!type && defaultMethod && arkMethod !== defaultMethod) {
            return this.getTypeByName(name, defaultMethod);
        }
        if (!type) {
            let arkFile = arkMethod.getDeclaringArkClass().getDeclaringArkFile();
            let method: ArkMethod | undefined = undefined;

            for (const arkClass of arkFile.getClasses()) {
                method = arkClass.getMethods().find(method => method.getName() === name);
                if (method) {
                    break; // 找到匹配的 method 后立即退出循环
                }
            }
            if (method) {
                type = new FunctionType(method.getSignature());
            }
        }
        return type;
    }

    private getVariableType(ast: ts.Node, name: string, leftOp: Local): Type | undefined {
        if (ts.isVariableStatement(ast)) {
            let declaration = ast.declarationList.declarations.find(declaration =>
                ts.isIdentifier(declaration.name) && declaration.name.getText() === name);
            if (declaration) {
                return this.getVariableType(declaration, name, leftOp);
            }
        }
        if (ts.isBinaryExpression(ast) && ast.right && ast.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            if ([
                ts.SyntaxKind.NumericLiteral,
                ts.SyntaxKind.StringLiteral,
            ].includes(ast.right.kind)) {
                return new LiteralType(ast.right.getText());
            }
            if (ts.SyntaxKind.TrueKeyword === ast.right.kind) {
                return new LiteralType(true);
            }
            if (ts.SyntaxKind.FalseKeyword === ast.right.kind) {
                return new LiteralType(false);
            }
        }
        if (ts.isVariableDeclaration(ast)) {
            if (!ast.type && !ast.initializer) {
                return UndefinedType.getInstance();
            }
            if (ast.type) {
                return this.getTypeByAst(ast.type);
            }
            if (ast.initializer) {
                if (leftOp.getConstFlag() && [
                    ts.SyntaxKind.NumericLiteral,
                    ts.SyntaxKind.StringLiteral,
                ].includes(ast.initializer.kind)) {
                    return new LiteralType(ast.initializer.getText());
                }
                if (ts.SyntaxKind.TrueKeyword === ast.initializer.kind) {
                    return new LiteralType(true);
                }
                if (ts.SyntaxKind.FalseKeyword === ast.initializer.kind) {
                    return new LiteralType(false);
                }
            }
        }
        return undefined;
    }

    private getTypeByAst(ast: ts.Node): Type | undefined {
        switch (ast.kind) {
            case ts.SyntaxKind.StringKeyword:
                return StringType.getInstance();
            case ts.SyntaxKind.NumberKeyword:
                return NumberType.getInstance();
            case ts.SyntaxKind.BooleanKeyword:
                return BooleanType.getInstance();
            case ts.SyntaxKind.ObjectKeyword:
                return new UnclearReferenceType('Object', [AnyType.getInstance()]);
            case ts.SyntaxKind.LiteralType:
                return this.getTypeByAst((ast as ts.LiteralTypeNode).literal);
            case ts.SyntaxKind.NullKeyword:
                return NullType.getInstance();
            case ts.SyntaxKind.UndefinedKeyword:
                return UndefinedType.getInstance();
        }
        if (ts.isUnionTypeNode(ast) || ts.isIntersectionTypeNode(ast)) {
            let tys: (Type | undefined)[] = ast.types.map(type => this.getTypeByAst(type));
            let filtertys: Type[] = tys.filter((ty): ty is Type => ty !== undefined);
            return new UnionType(filtertys);
        }
        return undefined;
    }

    private inAssignStmt(declarStmt: ArkAssignStmt, name: string, type: Type | undefined): Type | undefined {
        let rightOp = declarStmt.getRightOp();
        let leftOp = declarStmt.getLeftOp();
        let ast = AstTreeUtils.getASTNode('temp', declarStmt.getOriginalText() ?? '');
        let astNode: ts.Node = ast.statements[0];
        if (astNode && ts.isExpressionStatement(astNode)) {
            astNode = astNode.expression;
        }
        if (rightOp instanceof ArkPtrInvokeExpr) {
            let methodName = rightOp.getMethodSignature().getMethodSubSignature().getMethodName();
            let method = this.globalMethod.getDeclaringArkClass().getMethodWithName(methodName);
            return method?.getSignature().getMethodSubSignature().getReturnType();
        }

        if (rightOp instanceof ArkUnopExpr) {
            return BooleanType.getInstance();
        }

        return this.checkAssignStmtType(leftOp, rightOp, astNode, name, type);
    }

    private checktsNodeType(leftOp: Local, astNode: ts.Node, name: string, type: Type | undefined): Type | undefined {
        if (astNode) {
            if (ts.isVariableStatement(astNode) || ts.isVariableDeclaration(astNode)) {
                type = this.getVariableType(astNode, name, leftOp);
            }
            if (ts.isBinaryExpression(astNode) && astNode.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                type = this.getVariableType(astNode, name, leftOp);
            }
        }
        return type;
    }

    private checkAssignStmtType(leftOp: Value, rightOp: Value, astNode: ts.Node, name: string, type: Type | undefined): Type | undefined {
        if (leftOp instanceof Local) {
            type = this.checktsNodeType(leftOp, astNode, name, type);
        }
        if (!type && leftOp.getType()) {
            //如果左操作为有效类型则取左操作数的类型
            type = leftOp.getType();
        }
        // 如果左操作数是联合类型，且右操作数不是undefined，则取右操作数的类型
        if (leftOp.getType() instanceof UnionType && !(rightOp instanceof UndefinedConstant)) {
            type = rightOp.getType();
        }
        if (!type && leftOp instanceof Local &&
            ConstantType.some(ty => rightOp instanceof ty)) {
            return new LiteralType((rightOp as Constant).getValue());
        }
        if (!type && rightOp) {
            type = rightOp.getType();
        }
        if (type instanceof UnknownType && rightOp instanceof ArkInstanceInvokeExpr) {
            let base = rightOp.getBase();
            if (base.getType() instanceof ClassType && base.getName() === 'Promise') {
                let arg0 = rightOp.getArg(0);
                let tys = arg0 instanceof Constant ? [arg0.getType()] : [AnyType.getInstance()];
                type = new UnclearReferenceType('Promise', tys);
            }
        }
        return type;
    }

    private getFindVariableStmt(name: string, arkMethod: ArkMethod): Stmt | undefined {
        let declarStmt: Stmt | undefined;
        let stmts = arkMethod.getBody()?.getCfg().getStmts() ?? [];
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
            declarStmt = this.getVariableStmtTraversal(name, stmts[i]);
            if (declarStmt) {
                break;
            }
        }
        if (!declarStmt) {
            for (let i = seekIndex; i < stmts.length - 1; i++) {
                declarStmt = this.getVariableStmtTraversal(name, stmts[i]);
                if (declarStmt) {
                    break;
                }
            }
        }
        return declarStmt;
    }

    private getVariableStmtTraversal(name: string, seekStmt: Stmt): Stmt | undefined {
        let declarStmt: Stmt | undefined;
        if (seekStmt instanceof ArkAssignStmt &&
            this.globalStmt.getOriginalText() !== seekStmt.getOriginalText() && seekStmt.getLeftOp() instanceof Local) {
            let leftLocal = seekStmt.getLeftOp() as Local;
            if (leftLocal.getName() === name) {
                declarStmt = seekStmt;
            }
        }
        return declarStmt;
    }

    private is(...wantedTypes: readonly VariantType[]): boolean {
        return this.types.size === wantedTypes.length &&
            wantedTypes.every(type => this.types.has(type));
    }

    private checkNothing(): boolean {
        // boolean
        if (this.is('boolean') || this.is('truthy boolean')) {
            // boolean is always okay
            return true;
        }

        // never
        if (this.is('never')) {
            // never is always okay
            return true;
        }
        return false;
    }

    private checkNullish(node: ts.Node, results: LocationInfo[]): boolean {
        // nullish
        if (this.is('nullish')) {
            // condition is always false
            this.reportIssue(node, 'conditionErrorNullish', results);
            return true;
        }

        // Known edge case: boolean `true` and nullish values are always valid boolean expressions
        if (this.is('nullish', 'truthy boolean')) {
            return true;
        }

        // nullable boolean
        if (this.is('nullish', 'boolean')) {
            if (!this.option.allowNullableBoolean) {
                this.reportIssue(node, 'conditionErrorNullableBoolean', results);
            }
            return true;
        }

        // Known edge case: truthy primitives and nullish values are always valid boolean expressions
        if (
            (this.option.allowNumber && this.is('nullish', 'truthy number')) ||
            (this.option.allowString && this.is('nullish', 'truthy string'))
        ) {
            return true;
        }
        return false;
    }

    private checkString(node: ts.Node, results: LocationInfo[]): boolean {
        // string
        if (this.is('string') || this.is('truthy string')) {
            if (!this.option.allowString) {
                this.reportIssue(node, 'conditionErrorString', results);
            }
            return true;
        }

        // nullable string
        if (this.is('nullish', 'string')) {
            if (!this.option.allowNullableString) {
                this.reportIssue(node, 'conditionErrorNullableString', results);
            }
            return true;
        }
        return false;
    }
    private checkNumber(node: ts.Node, results: LocationInfo[]): boolean {
        // number
        if (this.is('number') || this.is('truthy number')) {
            if (!this.option.allowNumber) {
                this.reportIssue(node, 'conditionErrorNumber', results);
            }
            return true;
        }

        // nullable number
        if (this.is('nullish', 'number')) {
            if (!this.option.allowNullableNumber) {
                this.reportIssue(node, 'conditionErrorNullableNumber', results);
            }
            return true;
        }
        return false;
    }

    private checkObject(node: ts.Node, results: LocationInfo[]): boolean {

        // object
        if (this.is('object')) {
            // condition is always true
            this.reportIssue(node, 'conditionErrorObject', results);
            return true;
        }

        // nullable object
        if (this.is('nullish', 'object')) {
            if (!this.option.allowNullableObject) {
                this.reportIssue(node, 'conditionErrorNullableObject', results);
            }
            return true;
        }
        return false;
    }

    private checkAny(node: ts.Node, results: LocationInfo[]): boolean {
        // nullable enum
        if (
            this.is('nullish', 'number', 'enum') ||
            this.is('nullish', 'string', 'enum') ||
            this.is('nullish', 'truthy number', 'enum') ||
            this.is('nullish', 'truthy string', 'enum') ||
            // mixed enums
            this.is('nullish', 'truthy number', 'truthy string', 'enum') ||
            this.is('nullish', 'truthy number', 'string', 'enum') ||
            this.is('nullish', 'truthy string', 'number', 'enum') ||
            this.is('nullish', 'number', 'string', 'enum')
        ) {
            if (!this.option.allowNullableEnum) {
                this.reportIssue(node, 'conditionErrorNullableEnum', results);
            }
            return true;
        }

        // any
        if (this.is('any')) {
            if (!this.option.allowAny) {
                this.reportIssue(node, 'conditionErrorAny', results);
            }
            return true;
        }
        return false;
    }

    private checkreportedNode(node: ts.Node, results: LocationInfo[], isUnary: boolean): void {
        if (!node) {
            return;
        }
        if (this.checkNothing()) {
            return;
        }
        if (this.checkNullish(node, results)) {
            return;
        }
        if (this.checkString(node, results)) {
            return;
        }
        if (this.checkNumber(node, results)) {
            return;
        }
        if (this.checkObject(node, results)) {
            return;
        }
        if (this.checkAny(node, results)) {
            return;
        }
        this.reportIssue(node, 'conditionErrorOther', results);
    }

    private checkNode(stmt: Stmt | Value, node: ts.Node,
        results: LocationInfo[], isUnary: boolean = false): void {
        if (node) {
            // 生成缓存的唯一键，可以根据 stmt 和 node 的特性生成
            const cacheKey = `${stmt.toString()}-${node.getText()}`; // 这里可以根据需要生成唯一键
            let type: Type | undefined = undefined;
            // 检查缓存中是否已有类型
            if (this.typeCache.has(cacheKey)) {
                type = this.typeCache.get(cacheKey);
            }
            if (!type) {
                type = this.getConstrainedType(stmt, node);
            }
            if (!type) {
                return;
            }
            node = this.getReportedNode(node);
            this.types = this.inspectVariantTypes(this.unionTypeParts(type));
            this.checkreportedNode(node, results, isUnary);
        }
    }

    private isTypeFlagSet(type: Type, types: Type[]): boolean {
        return types.some(t => type.toString() === t.toString());
    }

    private isTrueLiteralType(type: Type): boolean {
        return type instanceof LiteralType && type.getLiteralName() === true;
    }

    private inspectVariantConstTypes(types: Type[], variantTypes: Set<VariantType>): void {
        const booleans = types.filter(type =>
            this.isTypeFlagSet(type, [BooleanType.getInstance(), new LiteralType(true), new LiteralType(false)]),
        );
        if (booleans.length === 1) {
            this.isTrueLiteralType(booleans[0]) ? variantTypes.add('truthy boolean') : variantTypes.add('boolean');
        } else if (booleans.length === 2) {
            variantTypes.add('boolean');
        }
        const strings = types.filter(type =>
            (type instanceof LiteralType && typeof type.getLiteralName() === 'string') || this.isTypeFlagSet(type, [StringType.getInstance()]),
        );
        if (strings.length) {
            if (strings.every(type => type instanceof LiteralType &&
                typeof type.getLiteralName() === 'string' && type.getLiteralName() !== '')) {
                variantTypes.add('truthy string');
            } else {
                variantTypes.add('string');
            }
        }
        const numbers = types.filter(type => (type instanceof LiteralType && typeof type.getLiteralName() === 'number') ||
            this.isTypeFlagSet(
                type, [NumberType.getInstance(), BigIntType.getInstance()]
            ),
        );
        if (numbers.length) {
            if (numbers.every(type => type instanceof LiteralType &&
                (typeof type.getLiteralName() === 'number' || typeof type.getLiteralName() === 'bigint') &&
                type.getLiteralName() !== 0)) {
                variantTypes.add('truthy number');
            } else {
                variantTypes.add('number');
            }
        }
    }

    private inspectVariantTypes(types: Type[]): Set<VariantType> {
        let variantTypes = new Set<VariantType>();
        if (types.some(type => this.isTypeFlagSet(type,
            [NullType.getInstance(), UndefinedType.getInstance(), VoidType.getInstance()]))) {
            variantTypes.add('nullish');
        }
        this.inspectVariantConstTypes(types, variantTypes);

        if (types.some(type => !(type instanceof LiteralType) &&
            !this.isTypeFlagSet(
                type, [
                NullType.getInstance(),
                UndefinedType.getInstance(),
                VoidType.getInstance(),
                BooleanType.getInstance(),
                StringType.getInstance(),
                NumberType.getInstance(),
                BigIntType.getInstance(),
                AnyType.getInstance(),
                UnknownType.getInstance(),
                NeverType.getInstance()]
            ))) {
            variantTypes.add('object');
        }
        if (types.some(type => this.isTypeFlagSet(type, [AnyType.getInstance(), UnknownType.getInstance()]))) {
            variantTypes.add('any');
        }
        if (types.some(type => this.isTypeFlagSet(type, [NeverType.getInstance()]))) {
            variantTypes.add('never');
        }
        return variantTypes;
    }

    private getReportedNode(node: ts.Node): ts.Node {
        if (ts.isPrefixUnaryExpression(node)) {
            return this.getReportedNode(node.operand);
        }
        if (ts.isParenthesizedExpression(node) ||
            ts.isTypeOfExpression(node) ||
            ts.isCallExpression(node)) {
            return this.getReportedNode(node.expression);
        }
        //有列号问题在
        return node;
    }


    private sortAndReportErrors(target: ArkFile): void {
        this.locationInfos.sort((a, b) => {
            if (a.line !== b.line) {
                return a.line - b.line;
            }
            return a.startCol - b.startCol;
        });
    }

    private checkStmtIf(arkStmt: Stmt): boolean {
        if (arkStmt.getOriginalText() === '') {
            return true;
        }
        if (arkStmt instanceof ArkAssignStmt && arkStmt.getRightOp().getType() instanceof NumberType) {
            return true;
        }
        this.line = arkStmt.getOriginPositionInfo().getLineNo();
        this.col = arkStmt.getOriginPositionInfo().getColNo();
        return false;
    }
    private checkCondition(sourceFile: ts.SourceFile): LocationInfo[] {
        const results: LocationInfo[] = [];
        this.rootNode = sourceFile.statements[0];
        if (!this.rootNode) {
            return results;
        }
        if (ts.isExpressionStatement(this.rootNode)) {
            this.rootNode = this.rootNode.expression;
        }
        this.visitCheck(this.globalStmt, this.rootNode, results);
        return results;
    }


    private visitCheck(stmt: Stmt | Value, node: ts.Node, results: LocationInfo[]): void {
        this.checkNodePre(stmt, node, results);
        if (stmt instanceof ArkIfStmt) {
            this.traverseTestExpression(stmt, node, results);
        }
    }

    private matchNormalBinopExpr(stmt: ArkNormalBinopExpr | ArkConditionExpr | ArkUnopExpr, stmtStr: string, node: ts.Node): string {
        let op1 = stmt instanceof ArkUnopExpr ? stmt.getOp() : stmt.getOp1();
        let op2 = stmt instanceof ArkUnopExpr ? stmt.getOp() : stmt.getOp2();
        let nodeText = '';
        let stmtStrs = stmtStr.split(stmt.getOperator());
        if (stmt instanceof ArkConditionExpr && ts.isConditionalExpression(node) && stmtStrs[0].includes('%')) {
            let op1ReplaceText = this.getNormalBinopExprText(op1, node);
            nodeText = ts.isParenthesizedExpression(node.condition) ? `(${op1ReplaceText})` : op1ReplaceText;
            stmtStrs[0] = this.replacePlaceholder(stmtStrs[0], op1ReplaceText);
        }

        if (stmt instanceof ArkUnopExpr && stmtStr.includes('%') &&
            ts.isPrefixUnaryExpression(node)) {
            let op1ReplaceText = this.getNormalBinopExprText(op1, node);
            nodeText = ts.isParenthesizedExpression(node.operand) ? `(${op1ReplaceText})` : `${op1ReplaceText}`;
            stmtStr = this.replacePlaceholder(stmtStr, op1ReplaceText);
        }

        if (ts.isBinaryExpression(node)) {
            if (op1 instanceof Local && op1.getName().includes('%')) {
                let op1ReplaceText = this.getNormalBinopExprText(op1, node);
                nodeText = ts.isParenthesizedExpression(node.left) ? `(${op1ReplaceText})` : op1ReplaceText;
                stmtStrs[0] = this.replacePlaceholder(stmtStrs[0], nodeText);
            }
            if (!(stmt instanceof ArkUnopExpr) && op2 instanceof Local && op2.getName().includes('%')) {
                let op2ReplaceText = this.getNormalBinopExprText(op2, node);
                nodeText = ts.isParenthesizedExpression(node.right) ? `(${op2ReplaceText})` : op2ReplaceText;
                stmtStrs[1] = this.replacePlaceholder(stmtStrs[1], nodeText);
            }
        }


        return this.getStmtStr(stmt, node, stmtStr, stmtStrs, op2);
    }

    private getStmtStr(stmt: Stmt | Value, node: ts.Node, stmtStr: string, stmtStrs: string[], op2: Value): string {
        if (stmt instanceof ArkConditionExpr && [BooleanConstant, StringConstant, NumberConstant, LiteralType]
            .some(ty => op2 instanceof ty)) {
            stmtStr = stmtStrs[0];
        }
        if (stmt instanceof ArkNormalBinopExpr) {
            stmtStr = stmtStrs.join(stmt.getOperator()).toString();
        }
        return stmtStr.trim();
    }
    private checkLocalBinaryExpression(stmt: ArkNormalBinopExpr, node: ts.BinaryExpression): boolean {
        let op1 = stmt.getOp1();
        let op2 = stmt.getOp2();
        if (stmt.getOperator() === node.operatorToken.getText() && (op2 instanceof Local && op2.getName() === node.right.getText() ||
            op1 instanceof Local && op1.getName() === node.left.getText())) {
            return true;
        }
        return false;
    }

    private checkLocalPrefixUnaryExpression(stmt: ArkUnopExpr, stmtStr: string, node: ts.PrefixUnaryExpression): boolean {
        if (ts.isElementAccessExpression(node.operand) && node.operand.expression) {
            if (stmtStr.includes(node.operand.expression.getText()) &&
                stmtStr.includes(node.operand.argumentExpression.getText())) {
                return true;
            }
        }
        return false;
    }

    private checkLocal(stmt: Stmt | Value, stmtStr: string, node: ts.Node): ts.Node | undefined {
        if (stmt instanceof ArkNormalBinopExpr) {
            if (ts.isBinaryExpression(node)) {
                if (this.checkLocalBinaryExpression(stmt, node)) {
                    return node;
                }
                stmtStr = this.matchNormalBinopExpr(stmt, stmtStr, node);
            }
        }
        if (stmt instanceof ArkUnopExpr) {
            if (ts.isPrefixUnaryExpression(node)) {
                if (this.checkLocalPrefixUnaryExpression(stmt, stmtStr, node)) {
                    return node;
                }
            }
            stmtStr = this.matchNormalBinopExpr(stmt, stmtStr, node);
        }
        if (stmt instanceof ArkConditionExpr) {
            stmtStr = this.matchNormalBinopExpr(stmt, stmtStr, node);
        }
        if (this.checkStmtStrAndNode(node, stmtStr)) {
            node = ts.isParenthesizedExpression(node) ? node.expression : node;
            if (stmt instanceof ArkNormalBinopExpr && ts.isBinaryExpression(node)) {
                this.checkLocalIsReplace = true;
                return node;
            } else if (stmt instanceof ArkConditionExpr || stmt instanceof ArkUnopExpr) {
                this.checkLocalIsReplace = true;
                return node;
            }
        }

        if (!this.checkLocalIsReplace) {
            let childs = node.getChildren();
            for (const child of childs) {
                let result = this.checkLocal(stmt, stmtStr, child);
                if (result) {
                    return result;
                }
            }
        }
        return undefined;
    }

    private checkStmtStrAndNode(node: ts.Node, stmtStr: string): boolean {
        let childtext = node.getText().replace('?.', '.').replace('new', '');

        if (ts.isBinaryExpression(node)) {
            if (ts.isBigIntLiteral(node.left) || ts.isBigIntLiteral(node.right)) {
                childtext = childtext.replace('n', '');
            }
            if (ts.isElementAccessExpression(node.left) || ts.isElementAccessExpression(node.right)) {
                childtext = childtext.replace(a_r, '');
            }
        }
        return childtext.replace(b_r, '').replace(c_r, '').replace(d_r, '.$1') ===
            stmtStr.replace(b_r, '').replace(c_r, '');
    }

    private getNormalBinopExprText(stmt: Value | Stmt, node: ts.Node): string {
        if (stmt instanceof ArkNormalBinopExpr) {
            return this.matchNormalBinopExpr(stmt, stmt.toString(), node);
        }
        if (stmt instanceof ArkInstanceFieldRef) {
            let baseName = stmt.getBase().getName();
            if (baseName.includes('%')) {
                baseName = this.getNormalBinopExprText(stmt.getBase().getDeclaringStmt() ?? stmt, node);
            }
            return `${baseName}.${stmt.getFieldSignature().getFieldName()}`;
        }

        if (stmt instanceof ArkInstanceInvokeExpr) {
            let baseName = stmt.getBase().getName();
            let methodName = stmt.getMethodSignature().getMethodSubSignature().getMethodName();
            if (baseName.includes('%')) {
                baseName = this.getNormalBinopExprText(stmt.getBase().getDeclaringStmt() ?? stmt, node);
            }
            return `${baseName}.${methodName}(${stmt.getArgs().map(arg => this.getNormalBinopExprText(arg, node)).join(', ')})`;
        }

        if (stmt instanceof ArkStaticInvokeExpr) {
            let methodName = stmt.getMethodSignature().getMethodSubSignature().getMethodName();
            return `${methodName}(${stmt.getArgs().map(arg => this.getNormalBinopExprText(arg, node)).join(', ')})`;
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

    private unionTypeParts(type: Type): Type[] {
        if (type instanceof UnionType || type instanceof IntersectionType) {
            return type.getTypes();
        }
        return [type];
    }

    // 辅助方法：创建和添加问题报告
    private reportIssue(
        node: ts.Node,
        messageId: string,
        results: LocationInfo[]
    ): void {
        const { line, character } = this.rootNode.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
        if (line > 0) {
            this.col = 1;
        }
        const assertionName = node.getText();
        const start = node.getStart();
        const end = node.getEnd();
        const endCharacter = character + assertionName.length;
        //messageId可能为空的情况 出现了description用作报错信息，需要检查下
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

    private addIssueReportNodeFix(loc: LocationInfo, arkFile: ArkFile): void {
        const filePath = arkFile.getFilePath();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const severity = this.rule.alert ?? this.metaData.severity;
        if (loc.description) {
            this.metaData.description = loc.description;
        }
        let fix = this.getRuleFix(loc, sourceFile);
        let defect = new Defects(loc.line, loc.startCol, loc.endCol, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, fix ? true : false);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    }

    private getRuleFix(loc: LocationInfo, sourceFile: ts.SourceFile): RuleFix | undefined {
        let fix: RuleFix | undefined = undefined;
        if (this.isNoNeedFix(loc.messageId)) {
            return fix;
        }
        switch (loc.messageId) {
            case 'conditionErrorAny':
            case 'conditionErrorNullish':
                fix = this.createNullishOrAnyFix(loc, sourceFile);
                break;
            case 'conditionErrorNullableBoolean':
                fix = this.createNullableBooleanFix(loc, sourceFile);
                break;
            case 'conditionErrorNullableString':
            case 'conditionErrorNullableNumber':
                fix = this.createNullableStringOrNullableNumberFix(loc, sourceFile);
                break;
        }
        return fix;
    }

    private isNoNeedFix(messageId: string): boolean {
        const SKIP_FIX_IDS = new Set([
            'conditionErrorString',
            'conditionErrorNumber',
            'conditionErrorObject',
            'conditionErrorNullableObject',
            'conditionErrorNullableEnum',
            'noStrictNullCheck',
            'conditionFixDefaultFalse',
            'conditionFixDefaultEmptyString',
            'conditionFixDefaultZero',
            'conditionFixCompareNullish',
            'conditionFixCastBoolean',
            'conditionFixCompareTrue',
            'conditionFixCompareFalse',
            'conditionFixCompareStringLength',
            'conditionFixCompareEmptyString',
            'conditionFixCompareZero',
            'conditionFixCompareNaN'
        ]);
        return SKIP_FIX_IDS.has(messageId);
    }

    private getFixRange(loc: LocationInfo, sourceFile: ts.SourceFile): [number, number, boolean] {
        const [startPos, isNeedAddParentheses] = this.getLineStartPosition(sourceFile, loc);
        const startPosition = startPos + loc.startCol - 1;
        const endPosition = startPosition + loc.endCol - loc.startCol;
        return [startPosition, endPosition, isNeedAddParentheses];
    }

    private getLineStartPosition(sourceFile: ts.SourceFile, loc: LocationInfo): [number, boolean] {
        const lineNumber = loc.line;
        const lines = sourceFile.getFullText().split('\n');
        if (lineNumber < 1 || lineNumber > lines.length) {
            return [0, false];
        }
        let position = 0;
        for (let i = 0; i < lineNumber - 1; i++) {
            position += lines[i].length + 1;
        }
        const reportLineStr = lines[lineNumber - 1];
        const leftThreeLetter = reportLineStr.substring(loc.startCol - 4, loc.startCol - 1);
        const [isLeftHasLeftParenthesis, isLeftHasBinaryOperator] = this.checkLeftConditions(leftThreeLetter);
        const rightThreeLetter = reportLineStr.substring(loc.endCol - 1, loc.endCol + 2);
        const [isRightHasRightParenthesis, isRightHasBinaryOperator] = this.checkRightConditions(rightThreeLetter);
        const isNeedAddParentheses = this.shouldAddParentheses(isLeftHasLeftParenthesis, isLeftHasBinaryOperator,
            isRightHasRightParenthesis, isRightHasBinaryOperator);
        return [position, isNeedAddParentheses];
    }

    private shouldAddParentheses(
        isLeftHasLeftParenthesis: boolean,
        isLeftHasBinaryOperator: boolean,
        isRightHasRightParenthesis: boolean,
        isRightHasBinaryOperator: boolean
    ): boolean {
        let isNeedAddParentheses = false;
        if (isLeftHasLeftParenthesis && isRightHasBinaryOperator) {
            isNeedAddParentheses = true;
        }
        if (isLeftHasBinaryOperator && isRightHasRightParenthesis) {
            isNeedAddParentheses = true;
        }
        if (!isLeftHasLeftParenthesis && !isLeftHasBinaryOperator && isRightHasBinaryOperator) {
            isNeedAddParentheses = true;
        }
        if (isLeftHasBinaryOperator && !isRightHasRightParenthesis && !isRightHasBinaryOperator) {
            isNeedAddParentheses = true;
        }
        if (!isLeftHasLeftParenthesis && !isLeftHasBinaryOperator && !isRightHasRightParenthesis && !isRightHasBinaryOperator) {
            isNeedAddParentheses = true;
        }
        if (isLeftHasBinaryOperator && isRightHasBinaryOperator && !isLeftHasLeftParenthesis && !isRightHasRightParenthesis) {
            isNeedAddParentheses = true;
        }
        return isNeedAddParentheses;
    }

    private checkLeftConditions(str: string): [boolean, boolean] {
        let isLeftHasLeftParenthesis = false;
        let isLeftHasBinaryOperator = false;

        // 从右往左遍历字符串（索引 2 → 1 → 0）
        for (let i = str.length - 1; i >= 0; i--) {
            const char = str[i];

            // 检查左括号 '('
            if (char === '(') {
                isLeftHasLeftParenthesis = true;
            }

            // 检查二元操作符（&&、||）或单个 & 
            if (char === '&' || char === '|') {
                // 判断是否有连续操作符（例如 && 或 ||）
                const hasConsecutive = i < str.length - 1 && str[i] === str[i + 1];
                isLeftHasBinaryOperator = true;

                // 如果发现操作符，停止遍历
                break;
            }
        }

        return [isLeftHasLeftParenthesis, isLeftHasBinaryOperator];
    }

    private checkRightConditions(str: string): [boolean, boolean] {
        let isRightHasRightParenthesis = false;
        let isRightHasBinaryOperator = false;

        // 从左往右遍历字符串（索引 0 → 1 → 2）
        for (let i = 0; i < str.length; i++) {
            const char = str[i];

            // 检查右括号 ')'
            if (char === ')') {
                isRightHasRightParenthesis = true;
            }

            // 检查二元操作符（&&、||）或单个 |
            if (char === '|' || char === '&') {
                // 判断是否有连续操作符（例如 || 或 &&）
                const hasConsecutive = i < str.length - 1 && str[i] === str[i + 1];
                isRightHasBinaryOperator = true;

                // 如果发现操作符，停止遍历
                break;
            }
        }

        return [isRightHasRightParenthesis, isRightHasBinaryOperator];
    }

    //nullish类型和any类型 
    private createNullishOrAnyFix(loc: LocationInfo, sourceFile: ts.SourceFile): RuleFix | undefined {
        const [f_start, f_end, isNeedAddParentheses] = this.getFixRange(loc, sourceFile);
        const fixText = `Boolean(${loc.nameStr})`;
        return { range: [f_start, f_end], text: fixText };
    }

    //NullableBoolean
    private createNullableBooleanFix(loc: LocationInfo, sourceFile: ts.SourceFile): RuleFix | undefined {
        const [f_start, f_end, isNeedAddParentheses] = this.getFixRange(loc, sourceFile);
        const fixText = isNeedAddParentheses ? `${'(' + loc.nameStr} ?? false)` : `${loc.nameStr} ?? false`;
        return { range: [f_start, f_end], text: fixText };
    }

    private createNullableStringOrNullableNumberFix(loc: LocationInfo, sourceFile: ts.SourceFile): RuleFix | undefined {
        const [f_start, f_end, isNeedAddParentheses] = this.getFixRange(loc, sourceFile);
        const fixText = isNeedAddParentheses ? `${'(' + loc.nameStr} != null)` : `${loc.nameStr} != null`;
        return { range: [f_start, f_end], text: fixText };
    }
}