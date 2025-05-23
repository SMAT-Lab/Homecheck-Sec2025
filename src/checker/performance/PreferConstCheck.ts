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

import { ArkAssignStmt, ArkFile, ArkMethod, AstTreeUtils, Local, Stmt, ts } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Range, RuleFix } from '../../model/Fix';
import { StmtExt } from '../../model/StmtExt';
import { Scope } from '../../Index';
import { FixUtils } from '../../utils/common/FixUtils';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PreferConstCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/prefer-const-check.md',
    description: 'is never reassigned. Use \'const\' instead.'
};

export class PreferConstCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private buildMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        };
        return [matchBuildCb];
    }

    public check = (arkFile: ArkFile): void => {
        for (let clazz of arkFile.getClasses()) {
            for (let method of clazz.getMethods()) {
                this.processMethod(method, arkFile);
            }
        }
    };

    private processMethod(method: ArkMethod, arkFile: ArkFile): void {
        for (let stmt of method.getCfg()?.getStmts() ?? []) {
            let scope = (stmt as StmtExt).scope;
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let leftOp = stmt.getLeftOp();
            if (!(leftOp instanceof Local)) {
                continue;
            }
            if (leftOp.getName().includes('%') || leftOp.getName() === 'this') {
                continue;
            }
            if (!this.isVariableModified(leftOp, scope) && !leftOp.getConstFlag()) {
                // 创建issue
                let defect = this.createDefect(arkFile, stmt, leftOp.getName());
                if (!defect) {
                    continue;
                }
                // 创建fix
                let fix = this.createFix(arkFile, stmt, leftOp);
                this.issues.push(new IssueReport(defect, fix));
            }
        }
    }

    private isVariableModified(leftOp: Local, scope: Scope): boolean {
        for (let def of scope.defList) {
            if (def.getName() !== leftOp.getName()) {
                continue;
            }
            if (def.redefInfo.size !== 0) {
                return true;
            } else {
                return false;
            }
        }
        return false;
    }


    private createDefect(arkFile: ArkFile, stmt: Stmt, keyword: string): Defects | null {
        const filePath = arkFile.getFilePath();
        let text = stmt.getOriginalText();
        if (!text) {
            return null;
        }
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let startColum = originalPosition.getColNo() + text.indexOf(keyword);
        let endColumn = startColum + keyword.length - 1;
        const severity = this.rule.alert ?? this.metaData.severity;
        let description = `\`${keyword}\`` + this.metaData.description;
        return new Defects(lineNum, startColum, endColumn, description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
    }

    private createFix(arkFile: ArkFile, stmt: Stmt, leftOp: Local): RuleFix | undefined {
        let text = stmt.getOriginalText();
        if (!text) {
            return undefined;
        }
        let range = this.getRangeBySourceFile(arkFile, text, leftOp.getName());
        let start = FixUtils.getRangeStart(arkFile, stmt);
        return { range: [start + range[0], start + range[1]], text: 'const' };
    }

    private getRangeBySourceFile(arkFile: ArkFile, code: string, varName: string): Range {
        let stmtAst = AstTreeUtils.getASTNode(arkFile.getName(), code);
        for (let child of stmtAst.statements) {
            if (!(ts.isVariableStatement(child))) {
                return [0, 0];
            }
            for (let declaration of child.declarationList.declarations) {
                if (declaration.name.getText() !== varName) {
                    return [0, 0];
                }
                let firstToken = child.getFirstToken();
                if (firstToken) {
                    return [firstToken.getStart(), firstToken.getEnd()];
                }
            }
        }
        return [0, 0];
    }
}