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
    AbstractExpr,
    AbstractFieldRef,
    AbstractInvokeExpr,
    ArkAssignStmt,
    ArkConditionExpr,
    ArkField,
    ArkIfStmt,
    ArkMethod,
    ArkNormalBinopExpr,
    ArkTypeOfExpr,
    Local,
    Stmt,
    Value,
} from 'arkanalyzer';

import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback, ClassMatcher, FieldMatcher, FileMatcher } from '../../Index';
import { BooleanConstant, NullConstant, NumberConstant, StringConstant, UndefinedConstant } from 'arkanalyzer/lib/core/base/Constant';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ValidTypeofCheck');

type Options = [{
    requireStringLiterals: boolean
}];

type MessageIds = 'invalidValue' | 'notString';

type MessageInfo = {
    invalidValue: string,
    notString: string
};

type WarnInfo = {
    line: number,
    startCol: number,
    endCol: number,
    filePath: string
};
const VALID_TYPES = new Set(['symbol', 'undefined', 'object', 'boolean', 'number', 'string', 'function', 'bigint']);
const OPERATORS = new Set(['==', '===', '!=', '!==']);

export class ValidTypeofCheck implements BaseChecker {
    readonly TYPEOF_NAME = 'typeof';
    private defaultOptions: Options = [{ requireStringLiterals: false }];
    private messageId: MessageIds = 'invalidValue';
    private messages: MessageInfo = {
        invalidValue: 'Invalid typeof comparison value',
        notString: 'Typeof comparisons should be to string literals',
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private textIndexCache: Map<string, { hasBacktick: boolean; hasBrackets: boolean }> = new Map();

    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/valid-typeof-check.md',
        description: 'Invalid typeof comparison value.',
    };

    private fieldMatcher: FieldMatcher = {
        matcherType: MatcherTypes.FIELD,
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
    };

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.clsMatcher],
        file: [this.fileMatcher],
    };

    public registerMatchers(): MatcherCallback[] {
        const methodMatcherCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check,
        };
        const fieldMatcherCb: MatcherCallback = {
            matcher: this.fieldMatcher,
            callback: this.check,
        };
        return [methodMatcherCb, fieldMatcherCb];
    }

    public check = (target: ArkMethod | ArkField): void => {
        if (!this.rule) {
            return;
        };

        this.defaultOptions = this.rule.option[0] ?
            this.rule.option as Options :
            this.defaultOptions;

        if (target instanceof ArkMethod) {
            const stmts = target.getBody()?.getCfg().getStmts() ?? [];
            for (const stmt of stmts) {
                this.checkArkMethod(stmt);
            };
        } else {
            let stmts: Stmt[] = target.getInitializer();
            for (const stmt of stmts) {
                this.checkArkField(stmt);
            };
        };
        // 清理缓存
        this.textIndexCache.clear();
    };

    private checkArkField(stmt: Stmt): void {
        let text = stmt.getOriginalText() ?? '';
        if (text.indexOf('typeof') == -1) {
            return;
        };
        if (!(stmt instanceof ArkAssignStmt)) {
            return;
        };
        let rightOp = stmt.getRightOp();
        if (rightOp instanceof ArkConditionExpr && OPERATORS.has(rightOp.getOperator())) {
            this.checkExpr(stmt, text, rightOp)
        };
    };

    private checkArkMethod(stmt: Stmt): void {
        let text = stmt.getOriginalText() ?? '';
        if (text.indexOf('typeof') == -1) {
            return;
        }
        if (stmt instanceof ArkIfStmt) {
            let exprs = stmt.getExprs();
            for (let i = 0; i < exprs.length; i++) {
                let expr = exprs[i];
                if (expr instanceof ArkConditionExpr && OPERATORS.has(expr.getOperator())) {
                    this.checkExpr(stmt, text, expr);
                };
            };
        };
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp();
            if (rightOp instanceof ArkConditionExpr && OPERATORS.has(rightOp.getOperator())) {
                this.checkExpr(stmt, text, rightOp);
            } else if (rightOp instanceof ArkNormalBinopExpr && OPERATORS.has(rightOp.getOperator())) {
                this.checkExpr(stmt, text, rightOp);
            };
        };
    };

    private checkExpr(stmt: Stmt, text: string, rightOp: ArkConditionExpr | ArkNormalBinopExpr): void {
        const op1 = rightOp.getOp1();
        const op2 = rightOp.getOp2();

        const op1IsTypeOf = op1 instanceof ArkTypeOfExpr;
        const op2IsTypeOf = op2 instanceof ArkTypeOfExpr;

        if (!op1IsTypeOf && !op2IsTypeOf) {
            return;
        }

        if (op1IsTypeOf && !op2IsTypeOf) {
            this.checkMode(stmt, text, op2, rightOp);
        } else if (!op1IsTypeOf && op2IsTypeOf) {
            this.checkMode(stmt, text, op1, rightOp);
        }
    }

    private checkMode(stmt: Stmt, text: string, op: Value, rightOp: AbstractExpr) {
        if (op instanceof StringConstant) {
            this.checkIsString(stmt, text, op, rightOp);
        } else {
            if (!this.defaultOptions[0].requireStringLiterals) {
                if (this.checkParameter(stmt, text, op, rightOp)) {
                    return;
                };
            }
            if (op instanceof UndefinedConstant) {
                this.checkIsUndefined(stmt, text, op, rightOp);
            } else if (op instanceof NullConstant || op instanceof BooleanConstant || op instanceof NumberConstant) {
                this.checkIsNullIsBooleanIsNumber(stmt, text, op, rightOp);
            } else {
                this.checkIsObjectIsFunction(stmt, text, op, rightOp)
            };
        };
    };

    private checkParameter(stmt: Stmt, text: string, op: Value, rightOp: AbstractExpr): boolean {
        let method = stmt.getCfg()?.getDeclaringMethod();
        if (!method) {
            return false;
        };
        let parameter: Value[] = method.getParameterInstances();
        if (parameter && parameter.length > 0) {
            for (const param of parameter) {
                if (param.toString() === op.toString()) {
                    return true;
                }
            }
        }
        return false;
    };

    // 字符串的场景
    private checkIsString(stmt: Stmt, text: string, op: StringConstant, rightOp: AbstractExpr): void {
        let str = op.getValue();
        if (!VALID_TYPES.has(str)) {
            this.messageId = 'invalidValue';
            // 处理 带转义符的字符串
            if (text.indexOf('\\') !== -1) {
                str = this.getRightOpStr(text, rightOp);
            };
            this.addIssueReport(stmt, text, str, op)
        };
    };

    private checkIsUndefined(stmt: Stmt, text: string, op: Value, rightOp: AbstractExpr): void {
        this.messageId = this.defaultOptions[0].requireStringLiterals ? 'notString' : 'invalidValue';
        let str = this.getOpValue(op, text, rightOp);
        this.addIssueReport(stmt, text, str, op)
    };

    private checkIsNullIsBooleanIsNumber(stmt: Stmt, text: string, op: Value, rightOp: AbstractExpr): void {
        this.messageId = 'invalidValue';
        let str = this.getOpValue(op, text, rightOp);
        this.addIssueReport(stmt, text, str, op)
    };

    private checkIsObjectIsFunction(stmt: Stmt, text: string, op: Value, rightOp: AbstractExpr): void {
        if (this.defaultOptions[0].requireStringLiterals) {
            this.messageId = 'notString';
            let str = this.getOpValue(op, text, rightOp);
            this.addIssueReport(stmt, text, str, op)
        };
    };

    private getOpValue(op: Value, text: string, rightOp: AbstractExpr): string {
        if (op instanceof Local) {
            // 处理模板字符串的情况 处理数组字面量的情况 处理方法调用的情况 处理对象调用的情况
            if (text.indexOf('`') !== -1 ||
                text.indexOf('[') !== -1 && text.indexOf(']') !== -1 ||
                (op.getDeclaringStmt() as ArkAssignStmt)?.getRightOp() instanceof AbstractInvokeExpr ||
                (op.getDeclaringStmt() as ArkAssignStmt)?.getRightOp() instanceof AbstractFieldRef) {
                return this.getRightOpStr(text, rightOp);
            } else {
                return op.toString();
            };
        } else if (op instanceof UndefinedConstant || op instanceof NullConstant ||
            op instanceof BooleanConstant || op instanceof NumberConstant) {
            return op.getValue();
        };
        return this.getRightOpStr(text, rightOp);
    };

    private getRightOpStr(text: string, rightOp: AbstractExpr): string {
        // 目前底座无法获取模板字符串的源码，只能通过originalText源码的操作符进行截取
        let str = '';
        if (rightOp instanceof ArkConditionExpr) {
            let operator = rightOp.getOperator();
            str = text.split(operator)[1].trim().replace('`', '');
        };
        return str;
    };

    private addIssueReport(stmt: Stmt, text: string, opValue: string, op: Value): void {
        this.metaData.description = this.messages[this.messageId];
        const warnInfo = this.getLineAndColumn(stmt, text, opValue, op);
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };

    private getLineAndColumn(stmt: Stmt, text: string, opValue: string, op: Value): WarnInfo {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();

        if (!arkFile) {
            logger.debug('originStmt or arkFile is null');
            return { line: -1, startCol: -1, endCol: -1, filePath: '' };
        };

        const index = text.indexOf(opValue);
        const startCol = this.getStartCol(stmt, index, text, opValue, op);
        const endCol = startCol + opValue.length;
        const filePath = arkFile.getFilePath();

        return { line, startCol, endCol, filePath };
    };

    private getStartCol(stmt: Stmt, index: number, text: string, opValue: string, op: Value): number {
        if (this.messageId == 'notString') {
            if (op instanceof Local && op.getType().toString() == 'string' && this.isStringType(opValue)) {
                return stmt.getOriginPositionInfo().getColNo() + index - 1
            };
            return stmt.getOriginPositionInfo().getColNo() + index
        } else if (this.messageId == 'invalidValue') {
            if (op instanceof UndefinedConstant || op instanceof NullConstant ||
                op instanceof BooleanConstant || op instanceof NumberConstant) {
                return stmt.getOriginPositionInfo().getColNo() + index
            };
            return stmt.getOriginPositionInfo().getColNo() + index - 1
        };

        return -1;
    };

    private isStringType(opValue: string): boolean {
        return /['"`]/.test(opValue);
    }
}
