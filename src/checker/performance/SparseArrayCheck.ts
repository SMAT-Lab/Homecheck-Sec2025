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

import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ArkArrayRef, ArkAssignStmt, ArkFile, ArkNewArrayExpr, ArrayType, Local, NumberType, Stmt, Value } from 'arkanalyzer';
import { CheckerStorage, Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule, Scope } from '../../Index';
import { SparseArrayValue, SparseArrayType } from '../../model/SparseArrayValue';
import { VarInfo } from '../../model/VarInfo';
import { NumberUtils } from '../../utils/checker/NumberUtils';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'SparseArrayCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/sparse-array-check.md",
    description: 'Sparse array detected. Avoid using sparse arrays.'
};

export class SparseArrayCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private issueColumnInTs = new Map<string, Array<string>>();
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchFileCb];
    }

    public check = (arkFile: ArkFile) => {
        let arkFilePath = arkFile.getFilePath();
        this.issueColumnInTs.set(arkFilePath, new Array<string>());
        let parentScope = CheckerStorage.getInstance().getScope(arkFilePath);
        if (!parentScope) {
            return;
        }
        //获取所有scope
        let scopes: Scope[] = [];
        this.traverseScope(parentScope, scopes);
        for (let scope of scopes) {
            this.findSparseArrayInScope(arkFile, scope);
        }
        this.issueColumnInTs.clear();
    }

    private findSparseArrayInScope(arkFile: ArkFile, scope: Scope) {
        for (let varDef of scope.defList) {
            for (let leftUsedVarInfo of varDef.leftUsedInfo) {
                let useStmt = leftUsedVarInfo.stmt;
                let def = useStmt.getDef();
                if (!def || !(def instanceof ArkArrayRef)) {
                    continue
                }
                let pIndex = def.getIndex();
                this.valueCalculate(arkFile, useStmt, leftUsedVarInfo, pIndex)
            }
            let defStmt = varDef.defStmt;
            if (!(defStmt instanceof ArkAssignStmt)) {
                continue;
            }
            let leftOp = defStmt.getLeftOp();
            let rightOp = defStmt.getRightOp();
            let isArray = (leftOp !== null) && (leftOp.getType() instanceof ArrayType);
            if (isArray && rightOp instanceof ArkNewArrayExpr) {
                let size = rightOp.getSize();
                let varInfo = new VarInfo(defStmt, scope);
                this.valueCalculate(arkFile, defStmt, varInfo, size);
            }

            if (rightOp instanceof ArkArrayRef) {
                let pIndex = rightOp.getIndex();
                let reDefInfo = new VarInfo(defStmt, scope);
                this.valueCalculate(arkFile, defStmt, reDefInfo, pIndex);
            }
        }
    }

    private valueCalculate(arkFile: ArkFile, stmt: Stmt, varInfo: VarInfo, value: Value) {
        if (NumberUtils.isValueSupportCalculation(arkFile, varInfo, value)) {
            let index = NumberUtils.getNumberByScope(arkFile, varInfo, value);
            if ((value instanceof Local) && (index.value > 1024)) {
                this.reportIssue(arkFile, stmt, value);
            } else if ((value.getType() instanceof NumberType) && (index.value > 1024)) {
                this.reportIssue(arkFile, stmt, value);
            }
        }
    }

    private traverseScope(parentScope: Scope, scopes: Scope[]) {
        scopes.push(parentScope);
        if (parentScope.childScopeList.length !== 0) {
            for (let child of parentScope.childScopeList) {
                this.traverseScope(child, scopes);
            }
        }
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt, value: Value) {
        let filePath = arkFile.getFilePath();
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let startColum = -1;
        let endColum = -1;
        let valStr = '';
        let orgStmtColumn = -1;
        const orgStmtStr = stmt.getOriginalText();
        const severity = this.rule.alert ?? this.metaData.severity;
        if (orgStmtStr && orgStmtStr.length !== 0) {
            orgStmtColumn = originalPosition.getColNo();
            valStr = NumberUtils.getOriginalValueText(stmt, value);
            startColum = this.getRealStartColum(filePath, lineNum, orgStmtColumn, orgStmtStr, valStr, stmt);
            if (startColum === -1) {
                logger.info('Find sparse array, but can not get startColum.');
                return;
            }
            endColum = startColum + valStr.length - 1;
            this.issueColumnInTs.get(filePath)?.push(lineNum + '%' + startColum);
        }
        filePath = arkFile.getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }

    private getRealStartColum(filePath: string, lineNum: number, orgStmtColumn: number, orgStmtStr: string, valStr: string, stmt: Stmt) {
        let startColumn = -1;
        if (!(stmt instanceof ArkAssignStmt)) {
            return -1;
        }
        let fullStmtValue: SparseArrayValue = this.getFullStmtValue(stmt, valStr);
        let realStmtStr = fullStmtValue.fulStmtStr;
        let tmpOrgStmtStr = orgStmtStr;
        while (tmpOrgStmtStr.includes(realStmtStr)) {
            let fullStmtStartColumn = tmpOrgStmtStr.indexOf(realStmtStr);
            startColumn = orgStmtColumn + fullStmtStartColumn + fullStmtValue.baseStr.length;
            if (!this.hasReported(filePath, lineNum, startColumn)) {
                break;
            }
            tmpOrgStmtStr = tmpOrgStmtStr.replace(realStmtStr, '-'.repeat(realStmtStr.length))
        }
        return startColumn;
    }

    private hasReported(filePath: string, lineNum: number, startColumn: number): boolean {
        let targetIssue = this.issueColumnInTs.get(filePath)?.find(
            (lineCol) => lineCol === (lineNum + '%' + startColumn)
        );
        return targetIssue !== undefined;
    }

    private getFullStmtValue(stmt: ArkAssignStmt, valStr: string): SparseArrayValue {
        let rightOp = stmt.getRightOp();
        if (rightOp instanceof ArkNewArrayExpr) {
            return new SparseArrayValue(SparseArrayType.NEW_ARRAY, 'new Array(', valStr);
        }
        if (rightOp instanceof ArkArrayRef) {
            let base = rightOp.getBase();
            if (base instanceof Local) {
                let baseStr = base.toString();
                return new SparseArrayValue(SparseArrayType.ARRAY_RIGHT, baseStr + '[', valStr);
            }
        }
        let leftOp = stmt.getLeftOp();
        if (leftOp instanceof ArkArrayRef) {
            let base = leftOp.getBase();
            if (base instanceof Local) {
                let baseStr = base.toString();
                return new SparseArrayValue(SparseArrayType.ARRAY_LEFT, baseStr + '[', valStr);
            }
        }
        return new SparseArrayValue(SparseArrayType.UNKNOWN, '', valStr);
    }
}