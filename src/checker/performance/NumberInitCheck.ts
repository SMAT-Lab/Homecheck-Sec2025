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
import { ArkAssignStmt, ArkFile, Stmt, Value } from 'arkanalyzer';
import { CheckerStorage, CheckerUtils, Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule, Scope, ScopeType } from '../../Index';
import { ValueType } from '../../model/NumberValue';
import { Variable } from '../../model/Variable';
import { VarInfo } from '../../model/VarInfo';
import { NumberUtils } from '../../utils/checker/NumberUtils';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NumberInitCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/number-init-check.md',
    description: 'Number variable of both int and float types detected. The value assigned to a variable should be of the type declared for the variable.'
};

export class NumberInitCheck implements BaseChecker {
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
        let filePath = arkFile.getFilePath();
        let scope = CheckerStorage.getInstance().getScope(filePath);
        if (scope) {
            this.traverseScope(scope);
        }
    };

    private traverseScope(scope: Scope): void {
        this.parameteCheck(scope);
        if (scope.childScopeList.length !== 0) {
            for (let childScope of scope.childScopeList) {
                this.traverseScope(childScope);
            }
        }
    }

    private parameteCheck(scope: Scope): void {
        if (scope.defList.length === 0) {
            return;
        }
        for (let defValueInfo of scope.defList) {
            let defType: ValueType = ValueType.UNKNOWN;
            let defStmt = defValueInfo.defStmt;
            let defStmtInfo = new VarInfo(defStmt, scope);
            if (defStmt instanceof ArkAssignStmt) {
                let rightOp = defStmt.getRightOp();
                defType = this.checkValueType(defStmtInfo, rightOp);
                if (defType === ValueType.UNKNOWN) {
                    continue;
                }
            }
            this.checkByDefValueInfo(defValueInfo, defType);
        }
    }

    private checkValueType(varInfo: VarInfo, value: Value): ValueType {
        const arkFile = varInfo.stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            if (!NumberUtils.isValueSupportCalculation(arkFile, varInfo, value)) {
                return ValueType.UNKNOWN;
            }
            let reDefValue = NumberUtils.getNumberByScope(arkFile, varInfo, value);
            return reDefValue.type;
        }
        return ValueType.UNKNOWN;
    }

    private checkByDefValueInfo(defValueInfo: Variable, defType: ValueType): void {
        let reDefStmtInfos = defValueInfo.redefInfo;
        for (let reDefStmtInfo of reDefStmtInfos) {
            let reDefStmt = reDefStmtInfo.stmt;
            if (reDefStmt instanceof ArkAssignStmt) {
                let rightOp = reDefStmt.getRightOp();
                let reDefType = this.checkValueType(reDefStmtInfo, rightOp);
                if (reDefType === ValueType.UNKNOWN) {
                    break;
                } else if (reDefType !== defType) {
                    this.setIssueReports(reDefStmt);
                }
            }
        }
    }

    private setIssueReports(reDefStmt: Stmt): void {
        const arkFile = reDefStmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        let originalPosition = reDefStmt.getOriginPositionInfo();
        const lineNo = originalPosition.getLineNo();
        const spacesColumn = originalPosition.getColNo();
        let text = reDefStmt.getOriginalText();
        if (!arkFile || !text || text.length === 0) {
            return;
        }
        const filePath = arkFile.getFilePath();
        const texts = text.split('\n');
        text = texts[0];
        let checkText = '';
        const severity = this.rule.alert ?? this.metaData.severity;
        if (text.includes(';')) {
            if (CheckerUtils.getScopeType(reDefStmt) === ScopeType.FOR_CONDITION_TYPE) {
                checkText = text.substring(text.lastIndexOf(';') + 2, text.indexOf(';'));
                checkText = checkText.substring(checkText.indexOf('=') + 2);
            } else {
                checkText = text.substring(text.indexOf('=') + 2, text.indexOf(';'));
            }
        } else {
            checkText = text.substring(text.indexOf('=') + 2);
        }
        const checkTextLen = checkText.length;
        const startColumn = spacesColumn + text.indexOf(checkText);
        const endColumn = startColumn + checkTextLen - 1;
        let defects = new Defects(lineNo, startColumn, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}