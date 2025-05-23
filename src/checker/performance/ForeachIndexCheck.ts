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

import { AbstractInvokeExpr, ArkAssignStmt, ArkInstanceInvokeExpr, ArkMethod, ArkNormalBinopExpr, ArkReturnStmt, FunctionType, Local, Scene, Stmt, Value } from 'arkanalyzer';
import { ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MethodMatcher, MatcherCallback, CheckerUtils, Scope } from '../../Index';
import { StmtExt } from '../../model/StmtExt';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ForeachIndexCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/foreach-index-check.md',
    description: 'For a sound rendering performance, avoid using the index as the return value or part of the return value for the keyGenerator parameter of ForEach.'
};

interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
    filePath: string;
}

export class ForeachIndexCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly FOREACH_STR: string = 'ForEach';
    readonly CREAER_STR: string = 'create';
    readonly supportFileType: string[] = ['.ets'];
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        category: [ClassCategory.STRUCT]
    };
    private buildMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.clsMatcher],
        name: ['build']
    };
    private builderMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        decorators: ['Builder']
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        };
        const matchBuilderCb: MatcherCallback = {
            matcher: this.builderMatcher,
            callback: this.check
        };
        return [matchBuildCb, matchBuilderCb];
    }

    public check = (targetMtd: ArkMethod): void => {
        const stmts = targetMtd.getBody()?.getCfg().getStmts() ?? [];
        for (const stmt of stmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            const methodSign = invokeExpr.getMethodSignature();
            const className = methodSign.getDeclaringClassSignature().getClassName();
            const methodName = methodSign.getMethodSubSignature().getMethodName();
            const argsNum = invokeExpr.getArgs().length;
            if (className === this.FOREACH_STR && methodName === this.CREAER_STR && argsNum === 3 &&
                this.checkIndexArg(invokeExpr.getArgs(), targetMtd.getDeclaringArkFile().getScene())) {
                this.addIssueReport(stmt);
            }
        }
    };

    private checkIndexArg(args: Value[], scene: Scene): boolean {
        const keyType = args[2].getType();
        if (keyType instanceof FunctionType) {
            const keyGenerator = scene.getMethod(keyType.getMethodSignature());
            if (!keyGenerator) {
                return false;
            }
            const params = keyGenerator.getParameters();
            if (params.length === 2) {
                return this.checkIndexUsedInBody(keyGenerator, params[1].getName());
            } else {
                const itemType = args[1].getType();
                if (itemType instanceof FunctionType) {
                    return scene.getMethod(itemType.getMethodSignature())?.getParameters().length === 2;
                }
            }
        }
        return false;
    }

    private checkIndexUsedInBody(keyGenerator: ArkMethod, targeName: string): boolean {
        for (const stmt of keyGenerator.getCfg()?.getStmts() ?? []) {
            if (stmt instanceof ArkReturnStmt) {
                const op = stmt.getOp();
                if (op instanceof Local && this.isUsedIndexInLocal(op, stmt, targeName)) {
                    return true;
                } else if (op instanceof AbstractInvokeExpr && this.isUsedIndexInInvokeExpr(op, stmt, targeName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private isUsedIndexInLocal(op: Local, curStmt: Stmt, targeName: string): boolean {
        if (op.getName().includes('%')) {
            const defStmt = op.getDeclaringStmt();
            if (!defStmt || !(defStmt instanceof ArkAssignStmt)) {
                return false;
            }
            const rightOp = defStmt.getRightOp();
            if (rightOp instanceof Local) {
                return this.isUsedIndexInLocal(rightOp, defStmt, targeName);
            } else if (rightOp instanceof ArkNormalBinopExpr) {
                return this.isUsedIndexInBinop(rightOp, defStmt, targeName);
            } else if (rightOp instanceof AbstractInvokeExpr) {
                return this.isUsedIndexInInvokeExpr(rightOp, defStmt, targeName);
            }
        } else {
            if (op.getName() === targeName && !this.isVarDefInScope(targeName, (curStmt as StmtExt).scope)) {
                return true;
            }
        }
        return false;
    }

    private isUsedIndexInInvokeExpr(invokeExpr: AbstractInvokeExpr, stmt: Stmt, targeName: string): boolean {
        const args = invokeExpr.getArgs();
        for (const arg of args) {
            if (arg instanceof Local && this.isUsedIndexInLocal(arg, stmt, targeName)) {
                return true;
            } else if (arg instanceof AbstractInvokeExpr && this.isUsedIndexInInvokeExpr(arg, stmt, targeName)) {
                return true;
            }
        }
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            const base = invokeExpr.getBase();
            if (base instanceof Local) {
                return this.isUsedIndexInLocal(base, stmt, targeName);
            }
        }
        return false;
    }

    private isUsedIndexInBinop(ops: ArkNormalBinopExpr, defStmt: Stmt, targeName: string): boolean {
        const op1 = ops.getOp1();
        const op2 = ops.getOp2();
        if (op1 instanceof Local) {
            if (this.isUsedIndexInLocal(op1, defStmt, targeName)) {
                return true;
            }
        }
        if (op2 instanceof Local) {
            return this.isUsedIndexInLocal(op2, defStmt, targeName);
        }
        return false;
    }

    private isVarDefInScope(targeName: string, scope?: Scope | null): boolean {
        if (!scope || scope.scopeLevel < 1) {
            return false;
        }
        for (const def of scope.defList ?? []) {
            if (def.getName() === targeName) {
                return true;
            }
        }
        return this.isVarDefInScope(targeName, scope.parentScope);
    }


    private addIssueReport(stmt: Stmt): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt);
        if (warnInfo.line <= 0 || warnInfo.startCol <= 0 || !this.supportFileType.some(type => (warnInfo.filePath.endsWith(type)))) {
            return;
        }
        let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }

    private getLineAndColumn(stmt: Stmt): WarnInfo {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originText = stmt.getOriginalText() ?? '';
            let startCol = originPosition.getColNo();
            const pos = originText.indexOf(this.FOREACH_STR);
            if (pos !== -1) {
                startCol += pos;
                const endCol = startCol + this.FOREACH_STR.length - 1;
                const originPath = arkFile.getFilePath();
                return { line, startCol, endCol, filePath: originPath };
            }
        } else {
            logger.debug('Get arkFile failed.');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}