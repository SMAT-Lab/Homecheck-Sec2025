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
import { ArkArrayRef, ArkAssignStmt, ArkClass, ArkIfStmt, ArkThisRef, BasicBlock, DEFAULT_ARK_METHOD_NAME, Local, Scene, Stmt } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { CheckerStorage, CheckerUtils, Scope, ScopeType, TempLocation } from "../../Index";
import { Variable } from "../../model/Variable";
import { VarInfo } from "../../model/VarInfo";
import { FixUtils } from "./FixUtils";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ScopeHelper');

export class ScopeHelper {
    private gFilePath: string = '';
    private firstBlock: BasicBlock | undefined;
    private finishBlockSet: Set<BasicBlock>;
    private isSwitchLastCase = false;
    private gFinishIfStmtLines: number[] = [];
    private gTernaryConditionLines: Set<number> = new Set();

    public buildScope(scene: Scene): void {
        let scopeMap = new Map<string, Scope>();
        for (const file of scene.getFiles()) {
            this.gFilePath = file.getFilePath();
            const firstScope = new Scope(null, new Array<Variable>(), 0);
            scopeMap.set(this.gFilePath, firstScope);
            for (const clazz of file.getClasses()) {
                this.createScopeInClass(clazz, firstScope);
            }
        }
        CheckerStorage.getInstance().setScopeMap(scopeMap);
    }

    private createScopeInClass(clazz: ArkClass, firstScope: Scope): void {
        for (let method of clazz.getMethods()) {
            this.gFinishIfStmtLines = [];
            this.gTernaryConditionLines.clear();
            this.finishBlockSet = new Set();
            this.firstBlock = method.getBody()?.getCfg()?.getStartingBlock();
            if (!this.firstBlock) {
                logger.debug(`${clazz.getName()}::${method.getName()} has no body.`);
                continue;
            }
            let curScope = firstScope;
            if (method.getName() !== DEFAULT_ARK_METHOD_NAME) {
                curScope = new Scope(firstScope, new Array<Variable>(), 1);
                firstScope.setChildScope(curScope);
            }
            this.blockProcess(this.firstBlock, curScope);
        }
    }

    private blockProcess(block: BasicBlock, parentScope: Scope): void {
        let curScope = parentScope;
        let stmts = block.getStmts();
        if (stmts.length === 0) {
            return;
        }
        if (this.isFirstThisBlock(block)) {
            const succBlocks = block.getSuccessors();
            if (succBlocks.length > 0) {
                this.blockProcess(block.getSuccessors()[0], curScope);
                return;
            }
        }
        let isSwitchBlock = false;
        let nextScopeType = CheckerUtils.getScopeType(stmts[stmts.length - 1]);
        curScope.blocks.add(block);
        this.finishBlockSet.add(block);
        for (let i = 0; i < stmts.length; i++) {
            const stmt = stmts[i];
            if ((i === stmts.length - 1) && (this.isForStmtDefinedPart(stmts[stmts.length - 1], nextScopeType))) {
                curScope = this.genChildScope(curScope, ScopeType.FOR_CONDITION_TYPE);
                nextScopeType = ScopeType.UNKNOWN_TYPE;
            }
            if (!FixUtils.hasOwnProperty(stmt, 'scope')) {
                Object.defineProperty(stmt, 'scope', { value: curScope });
            }
            if (stmt instanceof ArkAssignStmt && !this.assignStmtProcess(stmt, curScope)) {
                continue;
            } else if (stmt instanceof ArkIfStmt) {
                this.gFinishIfStmtLines.push(stmt.getOriginPositionInfo().getLineNo());
                if (/^.*\?.*:.*$/.test(stmt.getOriginalText() ?? '')) {
                    this.gTernaryConditionLines.add(stmt.getOriginPositionInfo().getLineNo());
                }
            }
        }
        if (isSwitchBlock) {
            this.switchBlockPreProcess(block, curScope);
        } else {
            this.nextBlockPreProcess(block, curScope, nextScopeType);
        }
    }

    private isFirstThisBlock(block: BasicBlock): boolean {
        if (block.getPredecessors().length === 0) {
            const stmts = block.getStmts();
            if (stmts.length === 1) {
                if (stmts[0] instanceof ArkAssignStmt &&
                    stmts[0].getRightOp() instanceof ArkThisRef) {
                    return true;
                }
            }
        }
        return false;
    }

    private isForStmtDefinedPart(stmt: Stmt, nextScopeType: ScopeType): boolean {
        if (stmt instanceof ArkAssignStmt && nextScopeType === ScopeType.FOR_CONDITION_TYPE &&
            !this.gFinishIfStmtLines.includes(stmt.getOriginPositionInfo().getLineNo())) {
            return true;
        }
        return false;
    }

    private genChildScope(curScope: Scope, scopeType: ScopeType): Scope {
        let newScope = new Scope(curScope, new Array<Variable>(), curScope.scopeLevel + 1, scopeType);
        curScope.setChildScope(newScope);
        return newScope;
    }

    private assignStmtProcess(stmt: Stmt, curScope: Scope): boolean {
        let def = stmt.getDef();
        if (def instanceof Local) {
            if (def.getName() === 'this') {
                return false;
            }
            const isForStmtThirdPart = (CheckerUtils.getScopeType(stmt) === ScopeType.FOR_CONDITION_TYPE &&
                this.gFinishIfStmtLines.includes(stmt.getOriginPositionInfo().getLineNo()));
            if (CheckerUtils.wherIsTemp(stmt) === TempLocation.LEFT ||
                (!isForStmtThirdPart && CheckerUtils.isDeclaringStmt(def.getName(), stmt))) {
                curScope.addVariable(new Variable(stmt));
            } else {
                this.getDefAndSetRedef(def.getName(), curScope, curScope, stmt, SetDefMode.REDEF);
            }
        } else if (def instanceof ArkArrayRef) {
            let base = def.getBase();
            if (base instanceof Local && !base.getName().includes('%')) {
                this.getDefAndSetRedef(base.getName(), curScope, curScope, stmt, SetDefMode.LEFTUSED);
            }
        }
        return true;
    }

    private getDefAndSetRedef(name: string, searchScope: Scope, varScope: Scope, stmt: Stmt, mode: SetDefMode): boolean {
        let defList = searchScope.defList;
        for (let variable of defList) {
            if (variable.getName() === name) {
                if (mode === SetDefMode.REDEF) {
                    variable.redefInfo.add(new VarInfo(stmt, varScope));
                } else if (mode === SetDefMode.LEFTUSED) {
                    variable.leftUsedInfo.add(new VarInfo(stmt, varScope));
                }
            }
        }
        if (searchScope.parentScope !== null) {
            return this.getDefAndSetRedef(name, searchScope.parentScope, varScope, stmt, mode);
        }
        return false;
    }

    private switchBlockPreProcess(block: BasicBlock, curScope: Scope): void {
        const caseBlocks = block.getSuccessors();
        for (let caseBlock of caseBlocks) {
            this.finishBlockSet.add(caseBlock);
        }
        for (let i = 0; i < caseBlocks.length; i++) {
            if (i === caseBlocks.length - 1) {
                this.isSwitchLastCase = true;
            }
            this.blockProcess(caseBlocks[i], this.genChildScope(curScope, ScopeType.CASE_TYPE));
        }
        this.isSwitchLastCase = false;
    }

    private nextBlockPreProcess(block: BasicBlock, curScope: Scope, nextScopeType: ScopeType): void {
        const succBlocks = block.getSuccessors();
        const proedBlocks = block.getPredecessors();
        for (let i = 0; i < succBlocks.length; i++) {
            if (this.finishBlockSet.has(succBlocks[i])) {
                continue;
            }
            if (this.isTernaryCondition(succBlocks[i], proedBlocks)) {
                this.blockProcess(succBlocks[i], curScope);
                continue;
            }
            this.handleSuccessorBlock(succBlocks[i], curScope, nextScopeType, i);
        }
    }

    private handleSuccessorBlock(succBlock: BasicBlock, curScope: Scope, nextScopeType: ScopeType, index: number): void {
        if (index === 0) {
            if (this.isNeedCreateScope(nextScopeType)) {
                const type = (nextScopeType === ScopeType.FOR_CONDITION_TYPE) ? ScopeType.FOR_IN_TYPE : nextScopeType;
                this.blockProcess(succBlock, this.genChildScope(curScope, type));
            } else {
                if (this.isSwitchLastCase) {
                    this.isSwitchLastCase = false;
                    curScope = curScope.parentScope ?? curScope;
                }
                this.blockProcess(succBlock, this.getReturnScope(succBlock, curScope));
            }
        } else {
            if (nextScopeType === ScopeType.FOR_CONDITION_TYPE) {
                this.blockProcess(succBlock, this.getReturnScope(succBlock, curScope.parentScope ?? curScope));
            } else if (nextScopeType === ScopeType.WHILE_TYPE) {
                this.blockProcess(succBlock, this.getReturnScope(succBlock, curScope));
            } else {
                this.blockProcess(succBlock, this.genChildScope(curScope, ScopeType.ELSE_TYPE));
            }
        }
    }

    private isTernaryCondition(succBlock: BasicBlock, predBlocks: BasicBlock[]): boolean {
        const succStmts = succBlock.getStmts();
        if (succStmts.length > 0 && this.gTernaryConditionLines.has(succStmts[0].getOriginPositionInfo().getLineNo())) {
            return true;
        } else if (predBlocks.length === 1 && this.gTernaryConditionLines.has(predBlocks?.[0].getStmts()?.at(-1)?.getOriginPositionInfo().getLineNo() ?? 0)) {
            return true;
        } else {
            return false;
        }
    }

    private isNeedCreateScope(nextScopeType: ScopeType): boolean {
        if (nextScopeType === ScopeType.IF_TYPE ||
            nextScopeType === ScopeType.FOR_CONDITION_TYPE ||
            nextScopeType === ScopeType.WHILE_TYPE) {
            return true;
        }
        return false;
    }

    private getReturnScope(succBlock: BasicBlock, curScope: Scope): Scope {
        const stmts = succBlock.getStmts();
        if (stmts.length !== 0) {
            const type = CheckerUtils.getScopeType(stmts[0]);
            if ([ScopeType.WHILE_TYPE, ScopeType.FOR_CONDITION_TYPE].includes(type)) {
                return curScope;
            }
        } else {
            return curScope;
        }
        let returnScopeLevel = curScope.scopeLevel - (succBlock.getPredecessors().length - 1);
        let exitNum = curScope.scopeLevel - returnScopeLevel;
        while (exitNum) {
            if (curScope.parentScope !== null) {
                curScope = curScope.parentScope;
                exitNum--;
            } else {
                logger.debug('CountExitScopeNum error!');
                break;
            }
        }
        return curScope;
    }
}

enum SetDefMode {
    REDEF = 0,
    LEFTUSED
}