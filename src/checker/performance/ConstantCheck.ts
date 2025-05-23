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

import { ArkFile, Local, Stmt } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { CheckerStorage } from '../../utils/common/CheckerStorage';
import { Defects } from '../../model/Defects';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule } from '../../model/Rule';
import { Scope } from '../../model/Scope';
import { Variable } from '../../model/Variable';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ConstantCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/constant-check.md',
    description: 'Variables that are not changed should be declared as "const".'
};

interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
    filePath: string;
}

export class ConstantCheck implements BaseChecker {
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

    public check = (targetFile: ArkFile): void => {
        let firstScope = CheckerStorage.getInstance().getScope(targetFile.getFilePath());
        if (firstScope === undefined) {
            logger.warn('Scope is undefined.');
            return;
        }
        let scope: Scope[] = [firstScope];
        this.scopeListProcess(scope);
    };

    private isConst(stmt: Stmt): boolean {
        const text = stmt.getOriginalText();
        if (text && text.length !== 0) {
            if (text.includes('const')) {
                return true;
            }
        } else {
            logger.warn('Get origin text failed, line = ' + stmt.getOriginPositionInfo());
        }
        return false;
    }

    private scopeListProcess(scopeList: Scope[]): void {
        for (let scope of scopeList) {
            for (let variable of scope.defList) {
                let def = variable.defStmt.getDef();
                if (!(def instanceof Local) || def.getName().includes('%')) {
                    continue;
                }
                if (!this.isConst(variable.defStmt) && variable.redefInfo.size === 0) {
                    this.addIssueReport(variable);
                }
            }
            if (scope.childScopeList.length !== 0) {
                this.scopeListProcess(scope.childScopeList);
            }
        }
    }

    private addIssueReport(variable: Variable): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(variable, variable.defStmt.getOriginPositionInfo().getLineNo());
        let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }

    private getLineAndColumn(variable: Variable, tsLine: number): WarnInfo {
        const arkFile = variable.defStmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        const originText = variable.defStmt.getOriginalText();
        if (arkFile && originText && originText.length !== 0) {
            const pos = originText.indexOf(' ' + variable.getName());
            if (pos !== -1) {
                const startCol = variable.defStmt.getOriginPositionInfo().getColNo() + pos + 1;
                const endCol = startCol + variable.getName().length - 1;
                const originPath = arkFile.getFilePath();
                return { line: tsLine, startCol: startCol, endCol: endCol, filePath: originPath };
            }
        } else {
            logger.warn('Get originStmt failed.');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}