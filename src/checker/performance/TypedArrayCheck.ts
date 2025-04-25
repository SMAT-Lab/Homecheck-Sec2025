/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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

import { ArkArrayRef, ArkAssignStmt, ArkMethod, ArkNewArrayExpr, ArkNormalBinopExpr, ArkUnopExpr, ArrayType, Constant, NumberType, Stmt, Value } from "arkanalyzer/lib";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Local } from "arkanalyzer/lib/core/base/Local";
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback } from "../../Index";
import { IssueReport } from "../../model/Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'TypedArrayCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: "docs/typed-array-check.md",
    description: 'Array used only for numeric calculation detected. TypedArray is recommended.'
};
const binopOperator = ['+', '-', '*', '/', '%', '&', '|', '^', '>>', '<<', '>>>'];
const unopOperator = ['~'];
const unNumCalculateOpr = ['!'];
enum StmtCalculateType {
    NUM_CALCULATE,
    OTHER_CALCULATE,
    NOT_CALCULATE
}
enum TempLocation {
    NOFOUND = 0,
    LEFT,
    RIGHT
}
interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
    filePath: string;
}

export class TypedArrayCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchMethodCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check
        }
        return [matchMethodCb];
    }

    public check = (targetmethod: ArkMethod) => {
        const stmts = targetmethod.getBody()?.getCfg().getStmts() ?? [];
        for (let stmt of stmts) {
            if (stmt instanceof ArkAssignStmt && this.isArray(stmt)) {
                const truelyDef = this.getTruelyArrDef(stmt);
                if (truelyDef === null || !((truelyDef.getType() as ArrayType).getBaseType() instanceof NumberType)) {
                    continue;
                }
                let arrName = truelyDef.getName();
                let usedStmts = truelyDef.getUsedStmts();
                if (usedStmts !== undefined && arrName !== undefined && this.usedStmtProcess(usedStmts, arrName)) {
                    this.addIssueReport(stmt, arrName);
                }
            }
        }
    }

    private addIssueReport(stmt: Stmt, arrName: string) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt, arrName);
        let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }

    private getLineAndColumn(stmt: Stmt, arrName: string): WarnInfo {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originText = stmt.getOriginalText() ?? '';
            const pos = originText.indexOf(' ' + arrName);
            if (pos !== -1) {
                const startCol = originPosition.getColNo() + pos + 1;
                const endCol = startCol + arrName.length - 1;
                const originPath = arkFile.getFilePath();
                return { line: line, startCol: startCol, endCol: endCol, filePath: originPath };
            }
        } else {
            logger.debug('ArkFile is null.');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }

    private usedStmtProcess(usedStmts: Stmt[], arrName: string): boolean {
        let result = false;
        for (let usedStmt of usedStmts) {
            if (this.isArrInLeft(usedStmt, arrName)) {
                continue;
            }
            let oneResult = this.isCalculatedStmt(usedStmt, arrName, false);
            if (oneResult === StmtCalculateType.NUM_CALCULATE) {
                result = true;
            } else if (oneResult === StmtCalculateType.OTHER_CALCULATE) {
                result = false;
                break;
            }
        }
        return result;
    }

    public isArray(stmt: Stmt): boolean {
        let exprs = stmt.getExprs();
        for (let i = 0; i < exprs.length; i++) {
            let expr = exprs[i];
            if (expr instanceof ArkNewArrayExpr) {
                return true;
            }
        }
        return false;
    }

    public getTruelyArrDef(stmt: Stmt): Local | null {
        let def = stmt.getDef();
        if (def instanceof Local) {
            let tempName = def.getName();
            let usedStmts = def.getUsedStmts();
            for (let usedStmt of usedStmts) {
                if (!(usedStmt instanceof ArkAssignStmt)) {
                    continue;
                }
                const truelyDef = this.getArrDef(usedStmt, tempName);
                if (truelyDef) {
                    return truelyDef;
                }
            }
        }
        return null;
    }

    public getArrDef(stmt: ArkAssignStmt, tempName: string): Local | null {
        let right = stmt.getRightOp();
        if (right instanceof Local && right.getName() === tempName) {
            let def = stmt.getDef();
            if (def instanceof Local && def.getType() instanceof ArrayType) {
                return def;
            }
        }
        return null;
    }

    private isArrInLeft(stmt: Stmt, arrName: string): boolean {
        if (stmt instanceof ArkAssignStmt) {
            let def = stmt.getDef();
            if (def instanceof ArkArrayRef) {
                let base = def.getBase();
                if (base instanceof Local && base.getName() === arrName) {
                    return true;
                }
            }
        }
        return false;
    }

    private isCalculatedStmt(stmt: Stmt, arrName: string, flag: boolean): StmtCalculateType {
        if (stmt instanceof ArkAssignStmt) {
            if (stmt.getExprs().length === 0) {
                return this.noEXprProcess(stmt, arrName, flag);
            } else {
                return this.exprProcess(stmt, arrName);
            }
        }
        return StmtCalculateType.OTHER_CALCULATE;
    }

    private exprProcess(stmt: Stmt, arrName: string): StmtCalculateType {
        let exprs = stmt.getExprs();
        for (let i = 0; i < exprs.length; i++) {
            let expr = exprs[i];
            if (expr instanceof ArkNormalBinopExpr && binopOperator.includes(expr.getOperator())) {
                return this.binopProcess(stmt, expr, arrName);
            } else if (expr instanceof ArkUnopExpr) {
                return this.unopProcess(stmt, expr, arrName);
            }
        }
        return StmtCalculateType.NOT_CALCULATE;
    }

    private binopProcess(stmt: Stmt, expr: ArkNormalBinopExpr, arrName: string): StmtCalculateType {
        let tempLocation = this.whereIsTepm(stmt);
        if (expr.getOperator() === '+') {
            if (this.isNumberOp(expr.getOp1()) && this.isNumberOp(expr.getOp2())) {
                if (tempLocation === TempLocation.LEFT) {
                    return this.leftTempRecursion(stmt, arrName, true);
                }
                return StmtCalculateType.NUM_CALCULATE;
            }
            return StmtCalculateType.OTHER_CALCULATE;
        } else {
            if (tempLocation === TempLocation.LEFT) {
                return this.leftTempRecursion(stmt, arrName, true);
            }
            return StmtCalculateType.NUM_CALCULATE;
        }
    }

    private unopProcess(stmt: Stmt, expr: ArkUnopExpr, arrName: string): StmtCalculateType {
        if (unopOperator.includes(expr.getOperator())) {
            if (this.whereIsTepm(stmt) === TempLocation.LEFT) {
                return this.leftTempRecursion(stmt, arrName, true);
            }
            return StmtCalculateType.NUM_CALCULATE;
        } else if (unNumCalculateOpr.includes(expr.getOperator())) {
            return StmtCalculateType.OTHER_CALCULATE;
        }
        return StmtCalculateType.NOT_CALCULATE;
    }

    private noEXprProcess(stmt: Stmt, arrName: string, flag: boolean): StmtCalculateType {
        let tempLocation = this.whereIsTepm(stmt);
        if (tempLocation === TempLocation.LEFT) {
            return this.leftTempRecursion(stmt, arrName, flag);
        } else if (tempLocation === TempLocation.RIGHT) {
            if (flag) {
                return StmtCalculateType.NUM_CALCULATE;
            } else {
                return StmtCalculateType.NOT_CALCULATE;
            }
        } else {
            return StmtCalculateType.NOT_CALCULATE;
        }
    }

    private whereIsTepm(stmt: Stmt): TempLocation {
        let def = stmt.getDef();
        if (def instanceof Local) {
            if (def.getName().includes('%')) {
                return TempLocation.LEFT;
            }
        }
        if (stmt instanceof ArkAssignStmt) {
            let right = stmt.getRightOp();
            if (right instanceof Local) {
                if (right.getName().includes('%')) {
                    return TempLocation.RIGHT;
                }
            }
        }
        return TempLocation.NOFOUND;
    }

    private leftTempRecursion(stmt: Stmt, arrName: string, flag: boolean): StmtCalculateType {
        let def = stmt.getDef();
        if (def instanceof Local) {
            let usedStmts = def.getUsedStmts();
            for (let i = 0; i < usedStmts.length; i++) {
                return this.isCalculatedStmt(usedStmts[i], arrName, flag);
            }
        }
        return StmtCalculateType.NOT_CALCULATE;
    }

    public isNumberOp(op: Value): boolean {
        if (op instanceof Local || op instanceof Constant) {
            let type = op.getType();
            if (type instanceof NumberType) {
                return true;
            }
        }
        return false;
    }
}