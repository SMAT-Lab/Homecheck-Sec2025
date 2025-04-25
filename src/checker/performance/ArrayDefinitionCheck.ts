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

import { ArkAssignStmt, ArkMethod, ArkNewArrayExpr, Stmt } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ArrayDefinitionCheck');
const ARRAY_NAME: string = 'Array';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/array-definition-check.md',
    description: 'Array type definition is not correct.'
};

export class ArrayDefinitionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private buildMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        };
        return [matchBuildCb];
    }

    public check = (arkMethod: ArkMethod): void => {
        for (let stmt of arkMethod.getBody()?.getCfg()?.getStmts() ?? []) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let rightOp = stmt.getRightOp();
            if (!rightOp || !(rightOp instanceof ArkNewArrayExpr)) {
                continue;
            }
            let text = stmt.getOriginalText() ?? '';
            if (this.isGenericArray(text)) {
                this.reportIssue(stmt, text,);
            }
        }
    };

    private isGenericArray(text: string): boolean {
        let matchArr = text.match(/:([\s\S]*?)=/);
        if (matchArr !== null) {
            let matchTags = matchArr[1].match(/Array|<|>/g);
            return matchTags !== null && matchTags.includes('Array') && matchTags.includes('<') && matchTags.includes('>');
        }
        return false;
    }

    private reportIssue(stmt: Stmt, text: string): void {
        const filePath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
        let lineNum = stmt.getOriginPositionInfo().getLineNo();
        let startColum = stmt.getOriginPositionInfo().getColNo() + text.indexOf(ARRAY_NAME);
        let endColumn = stmt.getOriginPositionInfo().getColNo() + text.indexOf('=') - 1;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColum, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}