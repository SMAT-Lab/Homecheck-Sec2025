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

import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { ArkFile } from 'arkanalyzer/lib/core/model/ArkFile';
import { ArkMethod } from 'arkanalyzer/lib/core/model/ArkMethod';
import { BasicBlock } from 'arkanalyzer/lib/core/graph/BasicBlock';
import { ArkAssignStmt, ArkIfStmt, Stmt } from 'arkanalyzer/lib/core/base/Stmt';
import { Value } from 'arkanalyzer/lib/core/base/Value';
import { Local } from 'arkanalyzer/lib/core/base/Local';
import { ArkArrayRef, ArkStaticFieldRef } from 'arkanalyzer/lib/core/base/Ref';
import { AbstractBinopExpr } from 'arkanalyzer/lib/core/base/Expr';
import { ClassSignature } from 'arkanalyzer/lib/core/model/ArkSignature';
import { Rule, Defects, FileMatcher, MatcherTypes, MatcherCallback, CheckerUtils, ScopeType, TempLocation, Scope } from '../../Index';
import { StmtExt } from '../../model/StmtExt';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ConstantPropertyReferencingInLoopsCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/constant-property-referencing-check-in-loops.md',
    description: 'This property access occurs within a loop and returns a constant result; you are advised to extract it outside the loop body to reduce the number of property access times.'
};

interface WarnInfo {
    line: number,
    startCol: number,
    endCol: number,
    filePath: string
}

export class ConstantPropertyReferencingInLoopsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    private valueStr: string = '';
    private indexStr: string = '';
    private isArrayStaticField: boolean = false;
    private isIndexConstant: boolean = true;
    private isStaticFieldConstant: boolean = false;
    private isRecursiveStart: boolean = false;
    private recursiveTime: number = 0;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchFileCb];
    }

    public check = (arkFile: ArkFile): void => {
        for (let clazz of arkFile.getClasses()) {
            this.constantCheckByArkMethods(clazz.getMethods())
        }
        for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
            for (let clazz of namespace.getClasses()) {
                this.constantCheckByArkMethods(clazz.getMethods());
            }
        }
    };

    private constantCheckByArkMethods(methods: ArkMethod[]): void {
        let blocks: Set<BasicBlock> | undefined = undefined;
        for (let method of methods) {
            blocks = method.getCfg()?.getBlocks();
            if (!blocks) {
                continue;
            }
            let blockValues = blocks.values();
            for (let i = 0; i < blocks.size; i++) {
                let value = blockValues.next().value;
                if (!value) {
                    continue;
                }
                let stmts = value.getStmts();
                this.constantCheckByArkStmts(stmts, i, blocks, blockValues, method);
            }

        }
    }

    private constantCheckByArkStmts(stmts: Stmt[], index: number, blocks: Set<BasicBlock>,
        blockValues: IterableIterator<BasicBlock>, method: ArkMethod): void {
        for (let stmt of stmts) {
            if (!(stmt instanceof ArkIfStmt)) {
                continue;
            }
            if (CheckerUtils.getScopeType(stmt) !== ScopeType.FOR_CONDITION_TYPE && CheckerUtils.getScopeType(stmt) !== ScopeType.WHILE_TYPE) {
                continue;
            }
            let variableMap: Map<string, number> = new Map<string, number>();
            let externalVariables: string[] = [];
            externalVariables = this.getExternalVariables(index, blocks);
            const value = blockValues.next().value;
            if (!value) {
                continue;
            }
            const cyclicStmt = value.stmts[0];
            if (!cyclicStmt) {
                continue;
            }
            const cyclicScope = (cyclicStmt as StmtExt).scope;
            index++;
            if (!cyclicScope) {
                continue;
            }

            let cyclicStmts = this.getCyclicStmts(cyclicScope, method);
            if (CheckerUtils.getScopeType(stmt) === ScopeType.FOR_CONDITION_TYPE) {
                variableMap = this.getVariableMap(externalVariables, cyclicStmts, cyclicScope);
                const conditionExpr = stmt.getConditionExpr();
                const op1 = conditionExpr.getOp1();
                this.setVariableMapByValue(op1, variableMap, stmt);
            }
            this.initData();
            this.constantCheckByCycliStmts(cyclicStmts, variableMap, '');
        }
    }

    private setVariableMapByValue(op1: Value, variableMap: Map<string, number>, stmt: Stmt): void {
        if (op1 instanceof Local) {
            variableMap.set(op1.getName(), stmt.getOriginPositionInfo().getLineNo());
        }
    }

    private constantCheckByCycliStmts(stmts: Stmt[], variableMap: Map<string, number>, operator: string): void {
        for (let stmt of stmts) {
            let leftName = '';
            if (stmt instanceof ArkAssignStmt) {
                this.constantCheckByAssignStmt(leftName, stmt, variableMap, operator);
            } else if (stmt instanceof ArkIfStmt) {
                this.checkByIfStmt(variableMap, operator, stmt);
                this.checkReportAndInit(leftName, stmt);
            }
        }
    }

    private constantCheckByAssignStmt(leftOpName: string, stmt: ArkAssignStmt, variableMap: Map<string, number>, operator: string): void {
        let rightOp = stmt.getRightOp();
        let leftOp = stmt.getLeftOp();
        if (leftOp instanceof Local) {
            leftOpName = leftOp.getName();
            if (leftOpName.startsWith('%') && !this.isRecursiveStart) {
                return;
            }
        }

        if (rightOp instanceof ArkStaticFieldRef) {
            this.checkByStaticFieldRef(rightOp, variableMap, operator, stmt);
        } else if (rightOp instanceof AbstractBinopExpr) {
            this.checkByBinopExpr(rightOp, variableMap, operator, stmt);
        } else if (rightOp instanceof ArkArrayRef) {
            this.checkByArrayRef(rightOp, variableMap, operator);
        } else {
            this.dealWithElse(stmt);
        }

        this.checkReportAndInit(leftOpName, stmt);
    }

    private checkByStaticFieldRef(rightOp: ArkStaticFieldRef, variableMap: Map<string, number>, operator: string, stmt: Stmt): void {
        const staticFieldStr = this.getValueStr(rightOp);
        if (!variableMap.has(staticFieldStr)) {
            this.isStaticFieldConstant = true;
            if (this.isArrayStaticField) {
                if (this.indexStr === '') {
                    this.indexStr = staticFieldStr;
                } else {
                    this.indexStr = this.indexStr + ' ' + operator + ' ' + staticFieldStr;
                }
            } else {
                if (this.valueStr === '') {
                    this.valueStr = staticFieldStr;
                } else {
                    this.valueStr = this.valueStr + ' ' + operator + ' ' + staticFieldStr;
                }
            }
        } else {
            this.dealWithElse(stmt);
        }
    }

    private checkByBinopExpr(rightOp: AbstractBinopExpr, variableMap: Map<string, number>, operator: string, stmt: Stmt): void {
        const uses = rightOp.getUses();
        for (let use of uses) {
            if (!(use instanceof Local)) {
                continue;
            }
            let useName = use.getName();
            if (useName.includes('%')) {
                const declaringStmt = use.getDeclaringStmt();
                if (declaringStmt && declaringStmt !== stmt) {
                    operator = rightOp.getOperator();
                    this.recursiveTime++;
                    this.isRecursiveStart = true;
                    this.constantCheckByCycliStmts([declaringStmt], variableMap, operator);
                    this.recursiveTime--;
                }
            } else if (!variableMap.has(useName)) {
                this.withoutVariableMapOperation(useName, operator);
            } else {
                this.dealWithElse(stmt);
            }
        }
    }

    private checkByArrayRef(rightOp: ArkArrayRef, variableMap: Map<string, number>, operator: string): void {
        this.isArrayStaticField = false;
        let arrayValueStr = '';
        const rightOpBase = rightOp.getBase();
        const declaringStmt = rightOpBase.getDeclaringStmt();
        if (!(declaringStmt instanceof ArkAssignStmt)) {
            return;
        }
        const declaringStmtRightOp = declaringStmt.getRightOp();
        if (declaringStmtRightOp instanceof ArkStaticFieldRef) {
            arrayValueStr = this.getValueStr(declaringStmtRightOp);
            this.isArrayStaticField = arrayValueStr !== '';
        }

        if (this.isArrayStaticField) {
            const index = rightOp.getIndex() as Local;
            const indexName = index.getName();
            if (indexName.startsWith('%')) {
                this.handleRecursiveIndex(index, variableMap, operator);
            } else {
                this.handleNonRecursiveIndex(indexName, variableMap, operator);
            }

            if (this.indexStr.length > 0) {
                arrayValueStr = this.isIndexConstant ? arrayValueStr + '[' + this.indexStr + ']' : this.indexStr;
            }
            this.valueStr = this.valueStr ? this.valueStr + ' ' + operator + ' ' + arrayValueStr : arrayValueStr;
        }
    }

    private handleRecursiveIndex(index: Local, variableMap: Map<string, number>, operator: string): void {
        const indexDeclaringStmt = index.getDeclaringStmt();
        if (indexDeclaringStmt) {
            this.recursiveTime++;
            this.isRecursiveStart = true;
            this.constantCheckByCycliStmts([indexDeclaringStmt], variableMap, operator);
            this.recursiveTime--;
        }
    }

    private handleNonRecursiveIndex(indexName: string, variableMap: Map<string, number>, operator: string): void {
        if (!variableMap.has(indexName)) {
            if (this.isArrayStaticField) {
                this.isStaticFieldConstant = true;
            }
            this.updateIndexStr(indexName, operator);
        }
    }

    private updateIndexStr(indexName: string, operator: string): void {
        if (this.indexStr === '') {
            this.indexStr = indexName;
        } else {
            this.indexStr = this.indexStr + ' ' + operator + ' ' + indexName;
        }
    }

    private checkByIfStmt(variableMap: Map<string, number>, operator: string, stmt: ArkIfStmt): void {
        const conditionExpr = stmt.getConditionExpr();
        const op1 = conditionExpr.getOp1();
        if (op1 instanceof Local) {
            const op1Name = op1.getName();
            if (op1Name.startsWith('%')) {
                const declaringStmt = op1.getDeclaringStmt();
                if (declaringStmt) {
                    this.recursiveTime++;
                    this.isRecursiveStart = true;
                    this.constantCheckByCycliStmts([declaringStmt], variableMap, operator);
                    this.recursiveTime--;
                }
            }
        }
    }

    private checkReportAndInit(leftName: string, stmt: Stmt): void {
        if (this.isStaticFieldConstant && ((!leftName.startsWith('%') && !this.isRecursiveStart) ||
            (this.isRecursiveStart && this.recursiveTime == 0))) {
            this.pushIssueReports(this.valueStr, stmt);
        }
        if (this.recursiveTime === 0) {
            this.initData();
        }
    }

    private initData(): void {
        this.valueStr = '';
        this.indexStr = '';
        this.isStaticFieldConstant = false;
        this.isRecursiveStart = false;
        this.isArrayStaticField = false;
        this.isIndexConstant = true;
    }

    private dealWithElse(stmt: Stmt): void {
        if (this.isStaticFieldConstant && this.isRecursiveStart && this.valueStr !== '') {
            this.pushIssueReports(this.valueStr, stmt);
        }
        if (this.isArrayStaticField && this.isRecursiveStart) {
            this.isIndexConstant = true;
        }
        if (this.valueStr !== '') {
            this.valueStr = '';
        }
    }

    private withoutVariableMapOperation(useName: string, operator: string): void {
        if (this.isArrayStaticField) {
            if (this.indexStr === '') {
                this.indexStr = useName;
            } else {
                this.indexStr = this.indexStr + ' ' + operator + ' ' + useName;
            }
        } else {
            if (this.valueStr === '') {
                this.valueStr = useName;
            } else {
                this.valueStr = this.valueStr + ' ' + operator + ' ' + useName;
            }
        }
    }

    private getValueStr(rightOp: Value): string {
        let valueString = '';
        if (rightOp instanceof ArkStaticFieldRef) {
            const classSignature = rightOp.getFieldSignature().getDeclaringSignature() as ClassSignature;
            const className = classSignature.getClassName();
            const fieldName = rightOp.getFieldName();
            valueString = className + '.' + fieldName;
            const declaringNamespaceSignature = classSignature.getDeclaringNamespaceSignature();
            if (declaringNamespaceSignature) {
                const nameSpace = declaringNamespaceSignature.getNamespaceName();
                valueString = nameSpace + '.' + valueString;
            }
        } else if (rightOp instanceof Local) {
            valueString = rightOp.getName();
        }
        return valueString;
    }

    private getVariableMap(externalVariables: string[], stmts: Stmt[], scope: Scope): Map<string, number> {
        let variableMap: Map<string, number> = new Map();
        for (let stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                let leftOp = stmt.getLeftOp();
                if (leftOp instanceof Local) {
                    this.getVariableMapByLocal(leftOp, externalVariables, stmt, variableMap);
                } else if (leftOp instanceof ArkStaticFieldRef) {
                    let classSignature = leftOp.getFieldSignature().getDeclaringSignature() as ClassSignature;
                    let className = classSignature.getClassName();
                    let fieldName = leftOp.getFieldName();
                    let staticFieldStr = className + '.' + fieldName;
                    variableMap.set(staticFieldStr, stmt.getOriginPositionInfo().getLineNo());
                }
            }
        }
        const defList = scope.defList;
        for (let defItem of defList) {
            const redefInfoSize = defItem.redefInfo.size;
            if (redefInfoSize > 0) {
                variableMap.set(defItem.getName(), defItem.defStmt.getOriginPositionInfo().getLineNo());
            }
        }
        return variableMap;
    }

    private getVariableMapByLocal(leftOp: Local, externalVariables: string[], stmt: Stmt, variableMap: Map<string, number>): void {
        let leftOpName = leftOp.getName();
        for (let externalVariable of externalVariables) {
            if (leftOpName === externalVariable) {
                if (CheckerUtils.isDeclaringStmt(leftOpName, stmt)) {
                    let index = externalVariables.indexOf(externalVariable);
                    externalVariables.splice(index, 1);
                } else {
                    variableMap.set(leftOpName, stmt.getOriginPositionInfo().getLineNo());
                }
            }
        }
    }

    private getCyclicStmts(scope: Scope, method: ArkMethod): Stmt[] {
        let stmts: Stmt[] = [];
        let blocks = scope.blocks;
        let baseBlocks: BasicBlock[] = [];
        for (let block of blocks) {
            baseBlocks.push(block);
        }
        let startStmt = baseBlocks[0].getStmts()[0];
        let lastBlockStmts = baseBlocks[baseBlocks.length - 1].getStmts();
        let endStmt = lastBlockStmts[lastBlockStmts.length - 1];
        let isAdd = false;
        let methodStmts = method.getCfg()?.getStmts();
        if (methodStmts) {
            for (let stmt of methodStmts) {
                if (stmt === startStmt) {
                    isAdd = true;
                } else if (stmt === endStmt && isAdd) {
                    stmts.push(stmt);
                    break;
                }
                if (isAdd) {
                    stmts.push(stmt);
                }
            }
        }
        return stmts;
    }

    private getExternalVariables(index: number, blocks: Set<BasicBlock>): string[] {
        let externalVariables: string[] = [];
        let blockValues = blocks.values();
        for (let i = 0; i <= index; i++) {
            if (i === index) {
                break;
            }
            let stmts = blockValues.next().value?.getStmts();
            if (!stmts) {
                continue;
            }
            for (let stmt of stmts) {
                let externalName = this.getDeclaringName(stmt);
                if (externalName !== '' && !this.isExist(externalName, externalVariables)) {
                    externalVariables.push(externalName);
                }
            }
        }
        return externalVariables;
    }

    private isExist(checkData: number | string, checkDatas: number[] | string[]): boolean {
        for (let data of checkDatas) {
            if (data === checkData) {
                return true;
            }
        }
        return false;
    }

    private getDeclaringName(stmt: Stmt): string {
        let def = stmt.getDef();
        if (def instanceof Local) {
            if (def.getName() === 'this') {
                return '';
            }
            if (CheckerUtils.wherIsTemp(stmt) === TempLocation.LEFT || CheckerUtils.isDeclaringStmt(def.getName(), stmt)) {
                return def.getName();
            }
        }
        return '';
    }

    private isExistIssueReport(defect: IssueReport): boolean {
        for (let issue of this.issues) {
            if (defect.defect.fixKey === issue.defect.fixKey && defect.defect.mergeKey === issue.defect.mergeKey) {
                return true;
            }
        }
        return false;
    }

    private pushIssueReports(checkText: string, stmt: Stmt): void {
        let warnInfo = this.getWarnInfo(checkText, stmt);
        if ((warnInfo.filePath === '' && warnInfo.line === -1)) {
            this.initData();
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId, warnInfo.filePath,
            this.metaData.ruleDocPath, true, false, false);
        if (this.isExistIssueReport(new IssueReport(defect, undefined))) {
            this.initData();
            return;
        }
        this.issues.push(new IssueReport(defect, undefined));
        this.initData();
    }

    private getWarnInfo(checkText: string, stmt: Stmt): WarnInfo {
        const text = stmt.getOriginalText();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (!arkFile || !text || text.length === 0) {
            return { line: -1, startCol: -1, endCol: -1, filePath: '' };
        }
        let lineCount = - 1;
        let startColum = - 1;
        let originalPosition = stmt.getOriginPositionInfo();
        const sparse = originalPosition.getColNo();
        const originalTexts = text.split('\n');
        for (let originalText of originalTexts) {
            lineCount++;
            if (originalText.includes(checkText)) {
                if (lineCount === 0) {
                    startColum = originalText.indexOf(checkText) + sparse;
                } else {
                    startColum = originalText.indexOf(checkText) + 1;
                }
                break;
            }
        }
        if (startColum === -1) {
            return { line: -1, startCol: -1, endCol: -1, filePath: '' };
        }
        let lineNo = originalPosition.getLineNo() + lineCount;
        const endColumn = startColum + checkText.length - 1;
        const filePath = arkFile.getFilePath();
        return { line: lineNo, startCol: startColum, endCol: endColumn, filePath: filePath };
    }
}