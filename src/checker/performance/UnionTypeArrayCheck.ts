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
import { Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule } from '../../Index';
import { ArkAssignStmt, ArkClass, ArkFile, ArkMethod, ArkNewArrayExpr, ArrayType, Local, NumberType, Stmt, UnionType, Value } from 'arkanalyzer';
import { ValueType } from '../../model/NumberValue';
import { StmtExt } from '../../model/StmtExt';
import { VarInfo } from '../../model/VarInfo';
import { NumberUtils } from '../../utils/checker/NumberUtils';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UnionTypeArrayCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/union-type-array-check.md',
    description: 'Suggestion: Avoid using arrays of union types.'
};

export class UnionTypeArrayCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
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
            this.unionClassProcess(clazz);
        }
        for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
            for (let clazz of namespace.getClasses()) {
                this.unionClassProcess(clazz);
            }
        }
    };

    public unionClassProcess(arkClass: ArkClass): void {
        let arkMethods = arkClass.getMethods();
        for (let arkMethod of arkMethods) {
            this.methodProcess(arkMethod, arkClass);
        }
    }

    public methodProcess(arkMethod: ArkMethod, clazz: ArkClass): void {
        const stmts = arkMethod.getBody()?.getCfg()?.getStmts();
        if (!stmts) {
            return;
        }
        let arkFile = clazz.getDeclaringArkFile();
        for (let stmt of stmts) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let rightOp = stmt.getRightOp();
            if (!rightOp || !(rightOp instanceof ArkNewArrayExpr)) {
                continue;
            }
            let leftOp = stmt.getLeftOp();
            let leftType = leftOp.getType();
            if (!(leftType instanceof ArrayType)) {
                continue;
            }
            let type = leftType.getBaseType();
            if (type instanceof UnionType) {
                let arrayName = this.getArrayName(leftOp);
                if (arrayName === undefined) {
                    continue;
                }
                this.reportIssue(arkFile, stmt, arrayName);
            } else if (type instanceof NumberType) {
                if (!(this.numberCheck(leftOp, clazz))) {
                    continue;
                }
                let arrayName = this.getArrayName(leftOp);
                if (arrayName === undefined) {
                    continue;
                }
                this.reportIssue(arkFile, stmt, arrayName);
            }
        }
    }

    public getArrayName(leftOp: Value): string | undefined {
        if (!(leftOp instanceof Local)) {
            return undefined;
        }
        let stmts = leftOp.getUsedStmts();
        if (!stmts) {
            return undefined;
        }
        for (let stmt of stmts) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let rightOp = stmt.getRightOp();
            if (!(rightOp instanceof Local)) {
                continue;
            }
            if (!rightOp.getName().includes('%')) {
                continue;
            }
            let leftOp = stmt.getLeftOp();
            if (!(leftOp instanceof Local)) {
                return undefined;
            }
            return leftOp.getName();
        }
        return undefined;
    }

    public numberCheck(leftOp: Value, clazz: ArkClass): boolean {
        if (!(leftOp instanceof Local)) {
            return false;
        }
        let stmts = leftOp.getUsedStmts();
        if (!stmts) {
            return false;
        }
        let valueType: ValueType = ValueType.UNKNOWN;
        for (let [index, stmt] of stmts.entries()) {
            let scope = (stmt as StmtExt).scope;
            if (!scope || !(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let arkFile = clazz.getDeclaringArkFile();
            let rightOp = stmt.getRightOp();
            let varInfo: VarInfo = new VarInfo(stmt, scope);
            if (!NumberUtils.isValueSupportCalculation(arkFile, varInfo, rightOp)) {
                continue;
            }
            let reDefValue = NumberUtils.getNumberByScope(arkFile, varInfo, rightOp);
            if (index === 0) {
                valueType = reDefValue.type;
                continue;
            }
            if (reDefValue.type !== valueType) {
                return true;
            }
        }
        return false;
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt | undefined, keyword: string): void {
        if (!stmt) {
            return;
        }
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let orgStmtStr = stmt.getOriginalText();
        if (!orgStmtStr || orgStmtStr.length === 0) {
            return;
        }
        let startColumn = originalPosition.getColNo() + orgStmtStr.indexOf(keyword);
        let endColumn = startColumn + keyword.length - 1;
        if (startColumn === -1) {
            return;
        }
        let filePath = arkFile.getFilePath();
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}