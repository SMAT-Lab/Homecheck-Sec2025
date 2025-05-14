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

import { ArkAssignStmt, ArkField, ArkFile, ArkInstanceFieldRef, ArkMethod, ArkReturnVoidStmt, ArkThisRef, BasicBlock, FunctionType, Local, Stmt } from 'arkanalyzer/lib';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, ClassMatcher, Defects, MatcherCallback, MatcherTypes, Rule } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoStateVarAccessInLoopCheck');
const loopInvokeMethods: string[] = ['forEach', 'map', 'flatMap', 'filter', 'reduce', 'every', 'some', 'find'];
const viewTreeTool: ViewTreeTool = new ViewTreeTool();
const visitedBlockSet: Set<BasicBlock> = new Set();
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/no-state-var-access-in-loop-check.md',
    description: 'Avoid frequently reading state variables in loop logic.'
};

export class NoStateVarAccessInLoopCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClazzCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        };
        return [matchClazzCb];
    }

    public check = (target: ArkClass): void => {
        if (viewTreeTool.hasTraverse(target)) {
            return;
        }
        for (let arkField of target.getFields()) {
            if (!arkField.hasDecorator(new Set(['State', 'Prop', 'Link', 'ObjectLink']))) {
                continue;
            }
            this.accessInLoopInCurrentClass(target, arkField);
        }
    };

    private accessInLoopInCurrentClass(clazz: ArkClass, arkField: ArkField): void {
        for (let method of clazz.getMethods()) {
            if (method.isGenerated()) {
                continue;
            }
            const firstBlock = method.getBody()?.getCfg().getStartingBlock();
            if (!firstBlock) {
                return;
            }
            this.blockProcess(clazz, method, firstBlock, arkField);
            for (let stmt of method.getBody()?.getCfg().getStmts() ?? []) {
                const invokerExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
                if (!invokerExpr) {
                    continue;
                }
                const name = invokerExpr.getMethodSignature().getMethodSubSignature().getMethodName();
                if (!loopInvokeMethods.includes(name)) {
                    continue;
                }
                if (invokerExpr.getArgs().length <= 0) {
                    continue;
                }
                const arg0 = invokerExpr.getArg(0);
                if (!(arg0 instanceof Local)) {
                    continue;
                }
                const localType = arg0.getType();
                if (!(localType instanceof FunctionType)) {
                    continue;
                }
                const loopMethod = clazz.getMethod(localType.getMethodSignature());
                if (!loopMethod) {
                    continue;
                }
                if (loopMethod.isGenerated()) {
                    continue;
                }
                const stmts = loopMethod.getCfg()?.getStmts();
                if (!stmts) {
                    continue;
                }
                this.loopBlockStmtsProcess(clazz, loopMethod, stmts, arkField);
            }
        }
    }

    private blockProcess(clazz: ArkClass, method: ArkMethod, block: BasicBlock, arkField: ArkField): void {
        const stmts = block.getStmts();
        if (stmts.length === 0) {
            return;
        }
        if (this.isFirstBlock(method, block)) {
            const succBlocks = block.getSuccessors();
            if (succBlocks.length > 0) {
                this.blockProcess(clazz, method, succBlocks[0], arkField);
            }
            return;
        }
        visitedBlockSet.clear();
        visitedBlockSet.add(block);
        if (this.isLoopBlock(block.getId(), block.getSuccessors())) {
            this.loopBlockStmtsProcess(clazz, method, stmts, arkField);
        }
        const blocks = method.getBody()?.getCfg().getBlocks();
        if (!blocks) {
            return;
        }
        if (block.getId() < 0 || block.getId() > blocks.size) {
            return;
        }
        let nextBlock = null;
        for (let value of blocks) {
            if (value.getId() === (block.getId() + 1)) {
                nextBlock = value;
                break;
            }
        }
        if (!nextBlock) {
            return;
        }
        this.blockProcess(clazz, method, nextBlock, arkField);
    }

    private loopBlockStmtsProcess(clazz: ArkClass, method: ArkMethod, stmts: Stmt[], arkField: ArkField): void {
        for (let stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                if (this.isStmtReadStateVar(stmt, arkField)) {
                    const arkFile = method.getDeclaringArkFile();
                    const keyword = 'this.' + arkField.getName();
                    this.addIssueReport(arkFile, stmt, keyword);
                }
            }
            const invokerExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokerExpr) {
                continue;
            }
            const targetMethod = clazz.getMethod(invokerExpr.getMethodSignature());
            if (!targetMethod) {
                continue;
            }
            if (targetMethod.isGenerated()) {
                continue;
            }
            const targetStmts = targetMethod.getCfg()?.getStmts();
            if (!targetStmts) {
                continue;
            }
            this.loopBlockStmtsProcess(clazz, targetMethod, targetStmts, arkField);
        }
    }

    private isStmtReadStateVar(stmt: ArkAssignStmt, arkField: ArkField): boolean {
        const leftOp = stmt.getLeftOp();
        if (leftOp instanceof ArkInstanceFieldRef) {
            if (leftOp.getBase().getName() === 'this' && leftOp.getFieldSignature().toString() === arkField.getSignature().toString()) {
                return true;
            }
        }
        const rightOp = stmt.getRightOp();
        if (rightOp instanceof ArkInstanceFieldRef) {
            if (rightOp.getBase().getName() === 'this' && rightOp.getFieldSignature().toString() === arkField.getSignature().toString()) {
                return true;
            }
        }
        return false;
    }

    private isLoopBlock(currentBlockId: number, successorBlocks: BasicBlock[]): boolean {
        let flag = false;
        for (let succBlock of successorBlocks) {
            if (succBlock.getId() === currentBlockId) {
                flag = true;
                break;
            } else if (this.isLastBlock(succBlock)) {
                continue;
            } else if (visitedBlockSet.has(succBlock)) {
                continue;
            } else {
                visitedBlockSet.add(succBlock);
                if (this.isLoopBlock(currentBlockId, succBlock.getSuccessors())) {
                    flag = true;
                }
            }
        }
        return flag;
    }

    private isFirstBlock(method: ArkMethod, block: BasicBlock): boolean {
        if (block.getPredecessors().length !== 0) {
            return false;
        }
        const stmts = block.getStmts();
        const pCount = method.getParameters().length;
        if (pCount < 0 || pCount > stmts.length) {
            return false;
        }
        const thisRefStmt = stmts[pCount];
        if (thisRefStmt instanceof ArkAssignStmt && thisRefStmt.getRightOp() instanceof ArkThisRef) {
            return true;
        }
        return false;
    }

    private isLastBlock(block: BasicBlock): boolean {
        if (block.getPredecessors().length !== 0) {
            return false;
        }
        const stmts = block.getStmts();
        if (stmts.length === 0) {
            return false;
        }
        const returnStmt = stmts[stmts.length - 1];
        if (returnStmt instanceof ArkAssignStmt || returnStmt instanceof ArkReturnVoidStmt) {
            return true;
        }
        return false;
    }

    private addIssueReport(arkFile: ArkFile, stmt: ArkAssignStmt, keyword: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(arkFile, stmt, keyword);
        if (warnInfo) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(arkFile: ArkFile, stmt: ArkAssignStmt, keyword: string): {
        lineNum: number;
        startCol: number;
        endCol: number;
        filePath: string;
    } | undefined {
        if (arkFile) {
            const originPosition = stmt.getOriginPositionInfo();
            const lineNum = originPosition.getLineNo();
            const text = stmt.getOriginalText();
            if (!text || text.length === 0) {
                return undefined;
            }
            const startCol = originPosition.getColNo() + text.indexOf(keyword);
            const endCol = startCol + keyword.length - 1;
            const originPath = arkFile.getFilePath();
            return { lineNum, startCol, endCol, filePath: originPath };
        } else {
            logger.debug('ArkFile is null.');
        }
        return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}