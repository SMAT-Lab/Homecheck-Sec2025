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
    AbstractExpr,
    ArkAssignStmt,
    BasicBlock,
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
    NumberType,
    ClassType,
    ArkNewExpr,
    AstTreeUtils,
    ArrayType,
    UnknownType,
    ArkInvokeStmt,
    ArkIfStmt,
    UnionType,
    AliasType,
    IntersectionType,
    ArkInstanceFieldRef,
    ClassSignature,
    BooleanType,
    UnclearReferenceType,
    GenericType,
    ArkArrayRef,
    TupleType,
    LiteralType,
    ArkMethod
} from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { ModifierType } from 'arkanalyzer/lib/core/model/ArkBaseModel';
import { MethodParameter } from 'arkanalyzer/lib/core/model/builder/ArkMethodBuilder';
import { BooleanConstant, NumberConstant } from 'arkanalyzer/lib/core/base/Constant';
type Options =
    {
        ignoreVoid?: boolean;
        ignoreIIFE?: boolean;
    };
const numberRex = new RegExp('-?\d+(\.\d+)?');
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoFloatingPromisesCheck');
const targetClasses = ['Promise', 'PromiseLike', 'PromiseConstructor'];
const messageBase =
    'Promises must be awaited, end with a call to .catch, or end with a call to .then with a rejection handler.';

const messageBaseVoid =
    'Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler' +
    ' or be explicitly marked as ignored with the `void` operator.';

const messageRejectionHandler =
    'A rejection handler that is not a function will be ignored.';

const messagePromiseArray =
    `An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar.`;

const messagePromiseArrayVoid =
    `An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar,` +
    ' or explicitly marking the expression as ignored with the `void` operator.';

const gMetaData: BaseMetaData = {
    name: 'no-floating-promises',
    severity: 2,
    ruleDocPath: 'docs/no-floating-promises-check.md',
    description: 'Require Promise-like statements to be handled appropriately',
    messages: {
        floating: messageBase,
        floatingFixAwait: 'Add await operator.',
        floatingVoid: messageBaseVoid,
        floatingFixVoid: 'Add void operator to ignore.',
        floatingUselessRejectionHandler:
            messageBase + ' ' + messageRejectionHandler,
        floatingUselessRejectionHandlerVoid:
            messageBaseVoid + ' ' + messageRejectionHandler,
        floatingPromiseArray: messagePromiseArray,
        floatingPromiseArrayVoid: messagePromiseArrayVoid,
    },
    defaultOptions: {
        ignoreVoid: true,
        ignoreIIFE: false,
    }
};

type UnhandledPromiseResult = {
    isUnhandled: boolean;
    nonFunctionHandler?: boolean;
    promiseArray?: boolean;
};

export class NoFloatingPromisesCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private errorPositions: { line: number, colum: number, message: string, sourceCode: string }[] = [];
    private useMethods: string[] = [];
    //底座遍历过程中已被调用的方法，不做重复检查，每个class会重置一次
    private globalArkFile: ArkFile;
    private globalArkCls: ArkClass;
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    // 添加缓存机制，避免递归栈溢出
    private promiseTypeCache: Map<string, boolean> = new Map();
    private statementCache: Map<string, boolean> = new Map();
    private promiseCache: Map<string, boolean> = new Map();
    private unhandledPromiseCache: Map<string, UnhandledPromiseResult> = new Map();
    private maxDepth: number = 20;
    private processedTypes: Set<string> = new Set();
    private recursionCount: Map<string, number> = new Map();

    // 重置缓存
    private resetCaches(): void {
        this.promiseTypeCache.clear();
        this.promiseCache.clear();
        this.unhandledPromiseCache.clear();
        this.processedTypes.clear();
        this.recursionCount.clear();
    }

    // 检查并增加递归次数
    private checkAndIncreaseRecursion(key: string): boolean {
        const count = this.recursionCount.get(key) || 0;
        if (count >= this.maxDepth) {
            // 达到最大递归深度
            return false;
        }
        this.recursionCount.set(key, count + 1);
        return true;
    }

    // 减少递归次数
    private decreaseRecursion(key: string): void {
        const count = this.recursionCount.get(key) || 0;
        if (count > 0) {
            this.recursionCount.set(key, count - 1);
        }
    }

    // 获取类型缓存键
    private getTypeKey(type: Type): string {
        if (type instanceof ClassType) {
            return `ClassType:${type.getClassSignature().getClassName()}`;
        }
        return `${type.constructor.name}:${type.toString().substring(0, 50)}`;
    }

    public registerMatchers(): MatcherCallback[] {
        const fileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileCb];
    };

    private getOption(): Options {
        let option = this.metaData.defaultOptions;
        if (this.rule && this.rule.option[0]) {
            option = this.rule.option[0] as Options;
        }
        return option;
    }
    private isAsyncIife(node: ts.ExpressionStatement): boolean {
        return ts.isCallExpression(node.expression) &&
            ts.isParenthesizedExpression(node.expression.expression) &&
            (ts.isArrowFunction(node.expression.expression.expression) ||
                ts.isFunctionExpression(node.expression.expression.expression));
    }

    private getRejectionHandlerFromThenCall(expression: ts.CallExpression): ts.Expression | undefined {
        if (ts.isPropertyAccessExpression(expression.expression) &&
            ts.isIdentifier(expression.expression.name) &&
            expression.expression.name.text === 'then' &&
            expression.arguments.length >= 2
        ) {
            return expression.arguments[1];
        }
        return undefined;
    }

    private hasValidRejectionHandler(node: ts.CallExpression, value: Value | Stmt, stmt: Stmt): UnhandledPromiseResult {
        const catchRejectionHandler = this.getRejectionHandlerFromCatchCall(node);
        if (catchRejectionHandler) {
            if (this.isValidCatchHandler(catchRejectionHandler, value)) {
                return { isUnhandled: false };
            }
            return { isUnhandled: true, nonFunctionHandler: true };
        }
        const thenRejectionHandler = this.getRejectionHandlerFromThenCall(node);
        if (thenRejectionHandler) {
            if (this.isValidThenHandler(thenRejectionHandler, value)) {
                return { isUnhandled: false };
            }
            return { isUnhandled: true, nonFunctionHandler: true };
        }

        if (ts.isPropertyAccessExpression(node.expression)) {
            const baseExpr = node.expression.expression;
            if (ts.isParenthesizedExpression(baseExpr)) {
                return this.isUnhandledPromise(baseExpr.expression, value, stmt);
            }
            if (ts.isOptionalChain(baseExpr)) {
                return this.isUnhandledPromise(baseExpr, value, stmt);
            }
            if (ts.isTaggedTemplateExpression(baseExpr) && !['then', 'catch'].includes(node.expression.name.getText())) {
                return { isUnhandled: false };
            }
        }

        // `x.finally()` is transparent to resolution of the promise, so check `x`.
        const promiseFinallyObject = this.getObjectFromFinallyCall(node);
        if (promiseFinallyObject) {
            return this.isUnhandledPromise(promiseFinallyObject, value instanceof ArkInstanceInvokeExpr ? value.getBase() : value, stmt);
        }

        return { isUnhandled: true };
    }
    private getObjectFromFinallyCall(
        expression: ts.CallExpression,
    ): ts.Expression | undefined {
        if (
            ts.isPropertyAccessExpression(expression.expression) &&
            ts.isIdentifier(expression.expression.name) &&
            expression.expression.name.text === 'finally'
        ) {
            return expression.expression.expression;
        }
        return undefined;
    }
    private isValidCatchHandler(handler: ts.Expression, value: Value | Stmt): boolean {
        return ts.isFunctionExpression(handler) ||
            ts.isArrowFunction(handler) ||
            (ts.isIdentifier(handler) && value instanceof ArkInstanceInvokeExpr && this.isFunctionType(value.getArg(0) as Local));
    }
    private isValidThenHandler(handler: ts.Expression, value: Value | Stmt): boolean {
        return ts.isFunctionExpression(handler) ||
            ts.isArrowFunction(handler) ||
            (ts.isIdentifier(handler) && value instanceof ArkInstanceInvokeExpr && this.isFunctionType(value.getArg(1) as Local));
    }

    private isFunctionType(local: Local): boolean {
        if (local instanceof FunctionType) {
            return true;
        }
        if (local?.getType() instanceof FunctionType) {
            return true;
        }
        return false;
    }

    private getRejectionHandlerFromCatchCall(expression: ts.CallExpression): ts.Expression | undefined {
        if (ts.isPropertyAccessExpression(expression.expression) &&
            ts.isIdentifier(expression.expression.name) &&
            expression.expression.name.text === 'catch' &&
            expression.arguments.length >= 1
        ) {
            return expression.arguments[0];
        }
        return undefined;
    }
    private report(stmt: Stmt, message: string): { line: number, colum: number, message: string, sourceCode: string } {
        const line = stmt.getOriginPositionInfo().getLineNo();
        const col = stmt.getOriginPositionInfo().getColNo();
        return { line, colum: col, message, sourceCode: stmt.getOriginalText() ?? '' };
    }
    private getErrorMessage(option: Options, promiseArray: boolean, nonFunctionHandler: boolean): string {
        if (promiseArray) {
            return option.ignoreVoid ? 'floatingPromiseArrayVoid' : 'floatingPromiseArray';
        }
        if (option.ignoreVoid) {
            return nonFunctionHandler ? 'floatingUselessRejectionHandlerVoid' : 'floatingVoid';
        }
        return nonFunctionHandler ? 'floatingUselessRejectionHandler' : 'floating';
    }
    private checkArrayLiteralExpression(node: ts.ArrayLiteralExpression, value: Stmt | Value, stmt: Stmt): boolean {
        if (!(stmt instanceof ArkAssignStmt)) {
            return false;
        }
        if (node.elements.length === 0) {
            return true;
        }
        let leftop = stmt.getLeftOp();
        if (leftop instanceof ArkArrayRef) {
            let leftIdx = leftop.getIndex();
            if (leftIdx instanceof NumberConstant) {
                let eles: ts.Node[] = node.elements.map(element => element);
                let targetElement = eles[parseInt(leftIdx.getValue())];

                // 如果是字面量，直接返回 true
                if (ts.isLiteralExpression(targetElement)) {
                    return true;
                }

                // 检查是否是已处理的 Promise
                let result = this.isUnhandledPromise(targetElement, value, stmt);
                return !result.isUnhandled;
            }
        } else {
            return true;
        }
        return false;
    }
    private checkCommaBinaryExpression(node: ts.BinaryExpression, value: Stmt | Value, stmt: Stmt): UnhandledPromiseResult {
        let items: UnhandledPromiseResult[] = [{ name: 'right', node: node.right }, { name: 'left', node: node.left }].map(item => {
            return this.isUnhandledPromise(item.node,
                (value instanceof ArkAssignStmt ? (item.name === 'right' ? value.getRightOp() : value.getLeftOp()) ?? value : value), stmt);
        });
        return items.find(item => item.isUnhandled) ?? { isUnhandled: false };
    }
    private getConditionalValue(block: BasicBlock, value: Stmt | Value): { leftValue: Value | Stmt | undefined, rightValue: Value | Stmt | undefined } {
        let left;
        let right;
        for (let i = 0; i < block.getSuccessors().length; i++) {
            let success = block.getSuccessors()[i];
            if (success.getStmts().length > 0) {
                if (i === 0) {
                    left = success.getStmts()[success.getStmts().length - 1];
                }
                if (i === 1) {
                    right = success.getStmts()[success.getStmts().length - 1];
                }
            }
        }
        return { leftValue: left, rightValue: right };
    }

    private checkConditional(node: ts.ConditionalExpression, value: Stmt | Value, stmt: Stmt): UnhandledPromiseResult {
        if (!(value instanceof ArkIfStmt)) {
            return { isUnhandled: false };
        }
        let leftValue;
        let rightVlaue;
        for (const block of value.getCfg().getBlocks()) {
            if (block.getStmts().some(stmt => value === stmt)) {
                let result = this.getConditionalValue(block, value);
                leftValue = result.leftValue;
                rightVlaue = result.rightValue;
            }
        }
        if (!leftValue && !rightVlaue) {
            return { isUnhandled: false };
        }
        // We must be getting the promise-like value from one of the branches of the
        // ternary. Check them directly.
        const alternateResult = this.isUnhandledPromise(node.whenTrue, leftValue ?? value, stmt);
        if (alternateResult.isUnhandled) {
            return alternateResult;
        }
        return this.isUnhandledPromise(node.whenFalse, rightVlaue ?? value, stmt);
    }

    private isUnhandledPromise(node: ts.Node, value: Value | Stmt, stmt: Stmt): UnhandledPromiseResult {
        // 创建缓存键
        const cacheKey = `isUnhandled_${node.pos}_${node.end}_${value.toString().substring(0, 50)}`;

        // 检查缓存
        if (this.unhandledPromiseCache.has(cacheKey)) {
            return this.unhandledPromiseCache.get(cacheKey)!;
        }

        // 检查递归深度
        if (!this.checkAndIncreaseRecursion(cacheKey)) {
            this.decreaseRecursion(cacheKey);
            return { isUnhandled: false }; // 递归太深，保守返回不是未处理的promise
        }

        let result: UnhandledPromiseResult;

        try {
            result = this._determineUnhandledPromise(node, value, stmt);
        } catch (e) {
            logger.error(`isUnhandledPromise error: ${e}`);
            result = { isUnhandled: false };
        }

        // 缓存结果
        this.unhandledPromiseCache.set(cacheKey, result);

        // 减少递归计数
        this.decreaseRecursion(cacheKey);

        return result;
    }

    private _determineUnhandledPromise(node: ts.Node, value: Value | Stmt, stmt: Stmt): UnhandledPromiseResult {
        // 处理各种表达式类型

        // 1. "as"表达式
        if (ts.isAsExpression(node)) {
            return this.isUnhandledPromise(node.expression, value, stmt);
        }

        // 2. 数组字面量表达式
        if (ts.isArrayLiteralExpression(node)) {
            return this.checkArrayExpression(node, value, stmt);
        }

        // 3. 逗号表达式
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            return this.checkCommaBinaryExpression(node, value, stmt);
        }

        // 4. await表达式
        if (ts.isAwaitExpression(node) ||
            (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
                node.expression.getText() === 'await')) {
            return this.checkAwaitExpression(node, value, stmt);
        }

        // 处理属性访问表达式
        if (ts.isPropertyAccessExpression(node)) {
            if (ts.isParenthesizedExpression(node.expression) && ts.isAwaitExpression(node.expression.expression)) {
                return { isUnhandled: false };
            }
        }

        // 5. void表达式
        if (this.getOption().ignoreVoid && ts.isVoidExpression(node)) {
            return { isUnhandled: false };
        }

        // 6. 条件表达式
        if (ts.isConditionalExpression(node)) {
            return this.checkConditional(node, value, stmt);
        }

        // 7. Promise数组
        if (this.isPromiseArray(value, node)) {
            return { isUnhandled: true, promiseArray: true };
        }

        // 8. 检查是否类似Promise
        if (!this.isPromiseLike(value, node)) {
            return { isUnhandled: false };
        }
        return this.checkNodeIsPromise(node, value, stmt);
    }

    private checkAwaitExpression(node: ts.AwaitExpression | ts.CallExpression, value: Value | Stmt, stmt: Stmt): UnhandledPromiseResult {
        if (value instanceof ArkAwaitExpr && !this.isPromise(value.getPromise(), node)) {
            return this.isUnhandledPromise(node.expression, value.getPromise(), stmt);
        }
        return { isUnhandled: false };
    }

    private checkArrayExpression(node: ts.ArrayLiteralExpression, value: Value | Stmt, stmt: Stmt): UnhandledPromiseResult {
        if (!(value instanceof ArkAssignStmt) || this.checkArrayLiteralExpression(node, value, stmt)) {
            return { isUnhandled: false };
        }
        return { isUnhandled: true };
    }

    private checkNodeIsPromise(node: ts.Node, value: Value | Stmt, stmt: Stmt): UnhandledPromiseResult {
        if (ts.isCallExpression(node)) {
            if (ts.isParenthesizedExpression(node.expression)) {
                return this.isUnhandledPromise(node.expression.expression, value, stmt);
            }
            // 处理可选链调用
            if (ts.isIdentifier(node.expression) && node.questionDotToken) {
                return this.isUnhandledPromise(node, value, stmt);
            }
            return this.hasValidRejectionHandler(node, value, stmt);
        } else if (ts.isBinaryExpression(node) &&
            [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) {
            // 处理逻辑运算符
            return this.checkNormalBinop(value, stmt, node);
        }
        return { isUnhandled: true };
    }

    private checkNormalBinop(value: Value | Stmt, stmt: Stmt, node: ts.BinaryExpression): UnhandledPromiseResult {
        if (value instanceof ArkAssignStmt) {
            value = value.getRightOp();
        }
        if (value instanceof ArkNormalBinopExpr) {
            let left = value.getOp1();
            let right = value.getOp2();
            if (left instanceof ArkAwaitExpr && left.getPromise()) {
                left = left.getPromise();
            }
            if (ts.isVoidExpression(node.left) && value.getOperator() === '&&') {
                return { isUnhandled: false };
            }
            let leftResult = this.checkNormalBinopLeftValue(left, value, stmt, node);

            if (leftResult) {
                return leftResult;
            }
            return this.isUnhandledPromise(node.right, right, stmt);
        }
        return { isUnhandled: false };
    }
    private checkNormalBinopLeftValue(left: Value, value: ArkNormalBinopExpr, stmt: Stmt, node: ts.BinaryExpression): UnhandledPromiseResult | false {
        if (left.getType() instanceof BooleanType && left instanceof Local) {
            //当逻辑符&&左边为false时，右边不会执行，所以不会有promise
            let leftDeclar = left.getDeclaringStmt();
            if (leftDeclar instanceof ArkAssignStmt && this.checkQueryValue(leftDeclar, value, stmt, left)) {
                return { isUnhandled: false };
            }
        } else {
            let leftRs = this.isUnhandledPromise(node.left, left, stmt);
            if (leftRs.isUnhandled) {
                return leftRs;
            }
        }
        return false;
    }

    private checkQueryValueStmt(block: BasicBlock, stmt: Stmt): number {
        let seekIdx = block.getStmts().length - 1;
        for (let i = 0; i < block.getStmts().length; i++) {
            let valueStmt = block.getStmts()[i];
            if (valueStmt === stmt) {
                seekIdx = i;
                break;
            }
        }
        return seekIdx;
    }

    private checkQueryBySeekIndex(seekIdx: number, block: BasicBlock, queryValue: Local, leftValue: Value): Value {
        for (let i = seekIdx; i > 0; i--) {
            let seekStmt = block.getStmts()[i];
            if (seekStmt instanceof ArkAssignStmt && seekStmt.getLeftOp() === queryValue) {
                let seekleft = seekStmt.getLeftOp();
                let seekright = seekStmt.getRightOp();
                if (seekleft instanceof Local &&
                    queryValue.getName() === seekleft.getName() &&
                    seekright instanceof BooleanConstant) {
                    //找到变量赋值语句
                    leftValue = seekright;
                    break;
                }
            }
        }
        return leftValue;
    }

    private checkQueryValue(leftDeclar: ArkAssignStmt, value: ArkNormalBinopExpr, stmt: Stmt, queryValue: Local): boolean {
        let leftValue = leftDeclar.getRightOp();
        let leftDeclar_left = leftDeclar.getLeftOp();
        if (leftDeclar_left instanceof Local && !leftDeclar_left.getConstFlag()) {
            //当左边为变量时，判断变量是否为false
            for (const block of stmt.getCfg().getBlocks()) {
                let seekIdx = this.checkQueryValueStmt(block, stmt);
                leftValue = this.checkQueryBySeekIndex(seekIdx, block, queryValue, leftValue);
            }
        }
        if (leftValue instanceof BooleanConstant) {
            let leftVl = leftValue.getValue();
            if (leftVl === 'false' && value.getOperator() === '&&') {
                return true;
            }
            if (leftVl === 'true' && ['||', '??'].includes(value.getOperator())) {
                return true;
            }
        }
        return false;
    }

    private preCheck(tsNode: ts.Node, value: Stmt): void {
        //如果是变量声明，并且右值为方法时，就把方法名加入到useMethods中
        if ((ts.isVariableStatement(tsNode) || ts.isVariableDeclaration(tsNode)) && value instanceof ArkAssignStmt) {
            let initType = value.getRightOp().getType();
            //如果是函数类型，就把函数名加入到useMethods中
            if (initType instanceof FunctionType) {
                this.useMethods.push(initType.getMethodSignature().getMethodSubSignature().getMethodName());
            }
        }
    }

    private checkExpr(stmt: Stmt, option: Options): { line: number, colum: number, message: string, sourceCode: string } {
        const sourceCode = AstTreeUtils.getASTNode('temp', stmt.getOriginalText() ?? '');
        const tsNode = ts.isSourceFile(sourceCode) && sourceCode.statements.length > 0 ? sourceCode.statements[0] : sourceCode;
        let checkValue: Value | Stmt = stmt;
        let position: { line: number, colum: number, message: string, sourceCode: string } = { line: 0, colum: 0, message: '', sourceCode: '' };
        this.preCheck(tsNode, checkValue);
        if (!ts.isExpressionStatement(tsNode) || (option.ignoreIIFE && this.isAsyncIife(tsNode))) {
            return position;
        }
        if ((ts.isArrowFunction(tsNode.expression) || ts.isFunctionExpression(tsNode.expression)) &&
            !ts.isCallExpression(tsNode.parent)) {
            return position;
        }
        let expression = tsNode.expression;

        if (stmt instanceof ArkInvokeStmt) {
            checkValue = stmt.getInvokeExpr();
        }
        if (stmt instanceof ArkAssignStmt && stmt.getRightOp() instanceof AbstractExpr) {
            if (stmt.getRightOp() instanceof ArkNormalBinopExpr || stmt.getRightOp() instanceof ArkAwaitExpr) {
                checkValue = stmt.getRightOp();
            } else {
                return position;
            }
        }
        const { isUnhandled, nonFunctionHandler, promiseArray } = this.isUnhandledPromise(expression, checkValue, stmt);
        if (isUnhandled) {
            const message = this.getErrorMessage(option, promiseArray ?? false, nonFunctionHandler ?? false);
            return this.report(stmt, message);
        }
        return position;
    }

    private isInVildNode(node: ts.Node): boolean {
        if (!node) {
            return true;
        }

        if (ts.isLiteralExpression(node) || ts.isLiteralTypeNode(node)) {
            return true;
        }
        if ([ts.SyntaxKind.NullKeyword, ts.SyntaxKind.UndefinedKeyword].includes(node.kind)) {
            return true;
        }
        return false;
    }

    private checkIsPromise(value: Local, node: ts.Node): boolean {
        let valueDeclar = value.getDeclaringStmt();
        if (value.getType() instanceof UnknownType) {
            let unknownDeclar = value.getDeclaringStmt();
            if (unknownDeclar && unknownDeclar instanceof ArkAssignStmt) {
                return this.isPromise(unknownDeclar.getRightOp(), this.getNode(node));
            }
        } else {
            return this.isPromiseType(value.getType()) || (valueDeclar instanceof ArkAssignStmt && this.isPromise(valueDeclar.getRightOp(), node));
        }
        return false;
    }

    private checkFieldRef(declarCls: ArkClass, value: ArkInstanceFieldRef, node: ts.Node): boolean {
        for (const field of declarCls?.getFields() ?? []) {
            if (field.getSignature().getFieldName() === value.getFieldSignature().getFieldName()) {
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
            if (declarCls && this.checkFieldRef(declarCls, value, node)) {
                return true;
            }
        }
        if (this.isPromiseArray(value.getBase(), node) && this.isNumericUsingIsNaN(value.getFieldSignature().getFieldName())) {
            return true;
        }
        return false;
    }

    private isPromise(value: Value, node: ts.Node): boolean {
        // 创建缓存键
        const cacheKey = `isPromise_${value.toString().substring(0, 50)}_${node.pos}_${node.end}`;

        // 检查缓存
        if (this.statementCache.has(value.toString())) {
            return this.statementCache.get(value.toString()) ?? false;
        }

        if (this.promiseCache.has(cacheKey)) {
            return this.promiseCache.get(cacheKey) ?? false;
        }

        // 检查递归深度
        if (!this.checkAndIncreaseRecursion(cacheKey)) {
            this.decreaseRecursion(cacheKey);
            return false; // 递归太深，保守返回false
        }

        let result = false;

        try {
            result = this._determineIsPromise(value, node);
        } catch (e) {
            logger.error(`isPromise error: ${e}`);
            result = false;
        }

        // 保存到缓存
        this.promiseCache.set(cacheKey, result);
        this.statementCache.set(value.toString(), result);
        // 减少递归计数
        this.decreaseRecursion(cacheKey);

        return result;
    }

    private _determineIsPromise(value: Value, node: ts.Node): boolean {
        // 快速判断
        if (this.isInVildNode(node)) {
            return false;
        }
        // 针对不同情况的处理
        if (ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            targetClasses.includes(node.expression.text)) {
            return true;
        }

        if (value instanceof Local && this.checkIsPromise(value, node)) {
            return true;
        }

        if (value instanceof ArkInstanceFieldRef && this.checkFieldRefIsPromise(value, node)) {
            return true;
        }

        if (value instanceof ArkStaticInvokeExpr) {
            return this._checkStaticInvokeExpr(value);
        }

        if (value instanceof ArkNormalBinopExpr) {
            return this.isPromise(value.getOp1(), node) || this.isPromise(value.getOp2(), node);
        }

        if (value instanceof ArkInstanceInvokeExpr) {
            return this.isPromise(value.getBase(), this.getNode(node));
        }

        if (value instanceof ArkNewExpr) {
            return this.isPromiseType(value.getType());
        }

        if (value instanceof ArkPtrInvokeExpr && this.checkPrtIsPromise(value)) {
            return true;
        }

        return false;
    }

    private _checkStaticInvokeExpr(value: ArkStaticInvokeExpr): boolean {
        const methodSignature = value.getMethodSignature().getMethodSubSignature();
        const arkMethod = this.globalArkCls.getMethodWithName(methodSignature.getMethodName());

        if (arkMethod?.containsModifier(ModifierType.ASYNC)) {
            return true;
        }

        return this.isPromiseType(methodSignature.getReturnType());
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

    private isPsArray(type: Type, isArray: boolean = false): boolean {
        // 创建缓存键
        const typeKey = this.getTypeKey(type);
        const cacheKey = `isPsArray_${typeKey}_${isArray}`;

        // 检查缓存
        if (this.promiseCache.has(cacheKey)) {
            return this.promiseCache.get(cacheKey)!;
        }

        // 检查递归深度
        if (!this.checkAndIncreaseRecursion(cacheKey)) {
            this.decreaseRecursion(cacheKey);
            return false; // 递归太深，保守返回false
        }

        // 检查类型是否已处理过
        if (this.processedTypes.has(typeKey)) {
            this.decreaseRecursion(cacheKey);
            return false;
        }
        this.processedTypes.add(typeKey);

        let result = false;

        try {
            result = this._determineIsPsArray(type, isArray);
        } catch (e) {
            logger.error(`isPsArray error: ${e}`);
            result = false;
        }

        // 移除处理标记
        this.processedTypes.delete(typeKey);

        // 缓存结果
        this.promiseCache.set(cacheKey, result);

        // 减少递归计数
        this.decreaseRecursion(cacheKey);

        return result;
    }

    private _determineIsPsArray(type: Type, isArray: boolean): boolean {
        // 快速判断特定类型
        if (type instanceof LiteralType || type instanceof FunctionType) {
            return false;
        }

        // 处理数组类型
        if (type instanceof ArrayType) {
            if (isArray) {
                return true;
            }
            return this.isPromiseType(type.getBaseType());
        }

        // 处理元组类型
        if (type instanceof TupleType) {
            return this._checkTypesCollection(type.getTypes());
        }

        // 处理泛型类型
        if (type instanceof GenericType) {
            return this._checkGenericPsArray(type, isArray);
        }

        // 处理联合类型
        if (type instanceof UnionType) {
            return this._checkUnionPsArray(type, isArray);
        }

        // 处理别名类型
        if (type instanceof AliasType) {
            return this._checkAliasPsArray(type, isArray);
        }

        // 处理交集类型
        if (type instanceof IntersectionType) {
            return this._checkIntersectionPsArray(type, isArray);
        }

        // 处理不明确的引用类型
        if (type instanceof UnclearReferenceType) {
            return this._checkUnclearReferencePsArray(type, isArray);
        }

        return false;
    }

    private _checkGenericPsArray(type: GenericType, isArray: boolean): boolean {
        const constraint = type.getConstraint();
        if (!constraint) {
            return false;
        }

        const constraintKey = this.getTypeKey(constraint);
        if (this.processedTypes.has(constraintKey)) {
            return false;
        }

        return this.isPsArray(constraint, isArray);
    }

    private _checkUnionPsArray(type: UnionType, isArray: boolean): boolean {
        return type.getTypes().some(t => {
            const tKey = this.getTypeKey(t);
            if (this.processedTypes.has(tKey)) {
                return false;
            }
            return this.isPsArray(t, isArray);
        });
    }

    private _checkAliasPsArray(type: AliasType, isArray: boolean): boolean {
        const origTypeKey = this.getTypeKey(type.getOriginalType());
        if (this.processedTypes.has(origTypeKey)) {
            return false;
        }

        return this.isPsArray(type.getOriginalType(), isArray);
    }

    private _checkIntersectionPsArray(type: IntersectionType, isArray: boolean): boolean {
        return type.getTypes().some(t => {
            const tKey = this.getTypeKey(t);
            if (this.processedTypes.has(tKey)) {
                return false;
            }
            return this.isPsArray(t, isArray);
        });
    }

    private _checkUnclearReferencePsArray(type: UnclearReferenceType, isArray: boolean): boolean {
        if (type.getName() !== 'Array') {
            return false;
        }

        if (isArray) {
            return true;
        }

        return type.getGenericTypes().some(t => {
            const tKey = this.getTypeKey(t);
            if (this.processedTypes.has(tKey)) {
                return false;
            }
            return this.isPromiseType(t);
        });
    }

    private typesIsPromiseArray(types: Type[]): boolean {
        return types.some(ty => {
            if (ty instanceof ArrayType) {
                return this.isPsArray(ty.getBaseType());
            }
            if (ty instanceof GenericType) {
                let baseConstraint = ty.getConstraint();
                if (baseConstraint !== undefined && baseConstraint instanceof UnclearReferenceType && baseConstraint.getName() === 'Array') {
                    return baseConstraint.getGenericTypes().some(t => this.isPsArray(t));
                }
            }
            return false;
        });
    }

    private isPromiseArray(stmt: Value | Stmt, node: ts.Node): boolean {
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp();
            let leftOp = stmt.getLeftOp();
            if ([rightOp, leftOp].some(op => this.isPsArray(op.getType()))) {
                return true;
            }
            if (leftOp instanceof ArkArrayRef && this.isPromise(rightOp, node)) {
                return true;
            }
            if (rightOp instanceof ArkInstanceFieldRef &&
                rightOp.getBase() instanceof Local &&
                this.isNumericUsingIsNaN(rightOp.getFieldSignature().getFieldName())) {
                let baseType = rightOp.getBase().getType();
                let tys = [baseType];
                if (baseType instanceof UnionType) {
                    tys = baseType.getTypes();
                }
                if (this.typesIsPromiseArray(tys)) {
                    return true;
                }
            }
        }

        if (stmt instanceof ArkStaticInvokeExpr) {
            return this.isPsArray(stmt.getMethodSignature().getMethodSubSignature().getReturnType());
        }

        if (stmt instanceof ArkInstanceInvokeExpr) {
            let methodName = stmt.getMethodSignature().getMethodSubSignature().getMethodName();
            if (stmt.getBase().getType() instanceof ArrayType &&
                methodName === 'map' &&
                stmt.getArgs().some(arg => this.isPromise(arg, node))) {
                return true;
            }
        }
        if (stmt instanceof Local) {
            let tys = [stmt.getType()];
            if (tys[0] instanceof UnionType) {
                tys = tys[0].getTypes();
            }
            if (tys.some(type => this.isPsArray(type))) {
                return true;
            }
        }
        return false;
    }

    private getNode(node: ts.Node): ts.Node {
        if (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) {
            return node.expression;
        }

        return node;
    }

    private isNumericUsingIsNaN(str: string): boolean {
        return !isNaN(Number(str)) && isFinite(Number(str));
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
    private isPromiseType(type: Type): boolean {
        // 检查缓存
        if (this.statementCache.has(type.toString())) {
            return this.statementCache.get(type.toString())!;
        }
        const typeKey = this.getTypeKey(type);
        if (this.promiseTypeCache.has(typeKey)) {
            return this.promiseTypeCache.get(typeKey)!;
        }

        // 检查递归深度
        if (!this.checkAndIncreaseRecursion(typeKey)) {
            this.decreaseRecursion(typeKey);
            return false; // 递归太深，保守返回false
        }

        // 检查类型是否已经处理过，避免循环引用导致递归栈溢出
        if (this.processedTypes.has(typeKey)) {
            this.decreaseRecursion(typeKey);
            return false;
        }

        // 标记为正在处理
        this.processedTypes.add(typeKey);

        let result = false;
        try {
            result = this._determinePromiseType(type, typeKey);
        } catch (e) {
            logger.error(`isPromiseType error: ${e}`);
            result = false;
        }

        // 结束处理，移除标记
        this.processedTypes.delete(typeKey);

        // 保存到缓存
        this.statementCache.set(type.toString(), result);
        this.promiseTypeCache.set(typeKey, result);

        // 减少递归计数
        this.decreaseRecursion(typeKey);

        return result;
    }

    private _determinePromiseType(type: Type, typeKey: string): boolean {
        // 快速处理简单类型
        if (type instanceof LiteralType) {
            return false;
        }

        // 处理不同类型的具体逻辑
        if (type instanceof ClassType) {
            return this.checkIsPromiseCls(type);
        }
        if (type instanceof TupleType) {
            return this._checkTupleType(type);
        }
        if (type instanceof FunctionType) {
            return this._checkFunctionType(type);
        }
        if (type instanceof UnclearReferenceType) {
            return targetClasses.includes(type.getName());
        }
        if (type instanceof IntersectionType) {
            return this._checkTypesCollection(type.getTypes());
        }
        if (type instanceof AliasType) {
            return this._checkAliasType(type);
        }
        if (type instanceof UnionType) {
            return this._checkTypesCollection(type.getTypes());
        }

        return false;
    }

    private _checkTypesCollection(types: Type[]): boolean {
        for (const t of types) {
            const tKey = this.getTypeKey(t);
            if (this.processedTypes.has(tKey)) {
                continue;
            }

            if (this.isPromiseType(t)) {
                return true;
            }
        }
        return false;
    }

    private _checkTupleType(type: TupleType): boolean {
        return this._checkTypesCollection(type.getTypes());
    }

    private _checkAliasType(type: AliasType): boolean {
        const origTypeKey = this.getTypeKey(type.getOriginalType());
        if (this.processedTypes.has(origTypeKey)) {
            return false;
        }

        return this.isPromiseType(type.getOriginalType());
    }

    private _checkFunctionType(type: FunctionType): boolean {
        const methodName = type.getMethodSignature().getMethodSubSignature().getMethodName();
        const arkMethod = this.globalArkCls.getMethodWithName(methodName);

        if (!this.useMethods.includes(methodName)) {
            this.useMethods.push(methodName);
        }

        // 异步方法直接返回true
        if (arkMethod?.containsModifier(ModifierType.ASYNC)) {
            return true;
        }

        const returnType = arkMethod?.getSignature().getMethodSubSignature().getReturnType();
        if (!returnType) {
            return false;
        }

        // 处理未知类型
        if (returnType instanceof UnknownType) {
            return !!arkMethod?.getBodyBuilder()?.getGlobals()?.has('Promise');
        }

        const rtKey = this.getTypeKey(returnType);
        if (this.processedTypes.has(rtKey)) {
            return false;
        }

        return this.isPromiseType(returnType);
    }

    private isPromiseLike(value: Value | Stmt, node: ts.Node): boolean {
        if (value instanceof ArkAssignStmt) {
            return this.isPromise(value.getRightOp(), this.getNode(node)) || this.isPromise(value.getLeftOp(), this.getNode(node));
        }
        if (value instanceof ArkInvokeStmt) {
            return this.isPromise(value.getInvokeExpr(), this.getNode(node));
        }
        if (value instanceof Local || value instanceof AbstractExpr) {
            return this.isPromise(value, this.getNode(node));
        }
        //使用底座推到变量类型
        return false;
    }
    private checkMethod = (method: ArkMethod): void => {
        method.getCfg()?.getStmts().forEach(stmt => {
            this.checkStmt(stmt);
        });
    };
    private checkClass = (cls: ArkClass): void => {
        this.useMethods = [];
        this.globalArkCls = cls;
        // 每次处理新类时重置缓存
        this.resetCaches();
        cls.getMethods().forEach(method => {
            if (this.useMethods.includes(method.getSignature().getMethodSubSignature().getMethodName())) {
                return;
            }
            this.checkMethod(method);
        });
    };
    private checkStmt = (stmt: Stmt): void => {
        if (!stmt.getOriginalText()) {
            return;
        }
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp().getType();
            if (rightOp instanceof NumberType) {
                return;
            }
        }
        let pos = this.checkExpr(stmt, this.getOption());
        if (pos.line !== 0 && pos.colum !== 0) {
            this.errorPositions.push(pos);
        }
    };

    public check = (target: ArkFile): void => {
        this.statementCache.clear();
        this.globalArkFile = target;
        // 每次处理新文件时完全重置缓存
        this.resetCaches();
        target.getClasses().forEach(cls => {
            this.checkClass(cls);
        });
        // 对 errorPositions 进行排序
        this.errorPositions.sort((a, b) => {
            if (a.line !== b.line) {
                return a.line - b.line; // 先按行号排序
            }
            return a.colum - b.colum; // 行号相同时按列号排序
        });
        this.errorPositions.forEach(position => {
            this.addIssueReport(target, position.line, position.colum, position.sourceCode, position.message);
        });
    };

    private addIssueReport(arkFile: ArkFile, lineNum: number, startColum: number, code: string, messageId: string): void {
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
            false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}