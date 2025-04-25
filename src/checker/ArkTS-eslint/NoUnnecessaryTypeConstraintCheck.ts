/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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

import {
    ArkMethod,
    ArkClass,
    ArkFile,
    ArkAliasTypeDefineStmt
} from "arkanalyzer";
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from "../BaseChecker";
import {Defects, IssueReport} from "../../model/Defects";
import {Rule} from "../../model/Rule";
import {ClassMatcher, MatcherCallback, MatcherTypes} from "../../matcher/Matchers";
import {RuleListUtil} from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ForeachArgsCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/no-unnecessary-type-constraint-check.md",
    description: "Disallow unnecessary constraints on generic types"
};

export class NoUnnecessaryTypeConstraintCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    }

    public check = (targetClass: ArkClass): void => {
        const severity = this.rule.alert ?? this.metaData.severity;
        if (!this.getFileExtension(targetClass.getDeclaringArkFile().getName(), 'ts')) {
            return;
        }
        if (targetClass.getCode()) {
            let genericDeclaration = this.getGenericDeclaration(targetClass.getCode() ?? '');
            if (genericDeclaration.text) {
                this.reportIssue(targetClass.getDeclaringArkFile(), targetClass.getLine() ?? 0,
                    targetClass.getColumn() ?? 0, genericDeclaration.text,
                    genericDeclaration.message,
                    severity);
            }
        }
        for (let method of targetClass.getMethods()) {
            this.processArkMethod(method, severity)
        }
    }

    private processArkMethod(method: ArkMethod, severity: number): void {
        if (method.getCode()) {
            let genericDeclaration = this.getGenericDeclaration(method.getCode() ?? '');
            if (genericDeclaration.text) {
                if (method.getColumn() !== null && method.getLine() !== null) {
                    this.reportIssue(method.getDeclaringArkFile(), method.getLine() ?? 0,
                        method.getColumn() ?? 0, genericDeclaration.text,
                        genericDeclaration.message,
                        severity);
                }
            }
        }
        this.processAliasTypes(method, severity);
        this.processStatements(method, severity);
    }

    private processAliasTypes(method: ArkMethod, severity: number): void {
        const aliasTypeMap = method.getBody()?.getAliasTypeMap() ?? [];
        for (let aliasType of aliasTypeMap) {
            aliasType.forEach((generic) => {
                this.processGenericArray(generic, method, severity);
            });
        }
    }

    private processGenericArray(generic: any, method: ArkMethod, severity: number): void {
        if (generic instanceof Array) {
            generic.forEach((genericType) => {
                this.checkGenericType(genericType, method, severity);
            });
        }
    }

    private checkGenericType(genericType: any, method: ArkMethod, severity: number): void {
        if (genericType instanceof ArkAliasTypeDefineStmt) {
            const genericDeclaration = this.getGenericDeclaration(genericType.getOriginalText() ?? '');
            if (genericDeclaration.text) {
                this.reportIssue(
                    method.getDeclaringArkFile(),
                    genericType.getOriginPositionInfo().getLineNo() ?? 0,
                    genericType.getOriginPositionInfo().getColNo() ?? 0,
                    genericDeclaration.text,
                    genericDeclaration.message,
                    severity
                );
            }
        }
    }

    private processStatements(method: ArkMethod, severity: number): void {
        const stmts = method.getBody()?.getCfg()?.getStmts() ?? [];
        for (let stmt of stmts) {
            if (stmt.getOriginalText()) {
                const genericDeclaration = this.getGenericDeclaration(stmt.getOriginalText() ?? '');
                if (genericDeclaration.text) {
                    this.reportIssue(
                        method.getDeclaringArkFile(),
                        stmt.getOriginPositionInfo().getLineNo() ?? 0,
                        stmt.getOriginPositionInfo().getColNo() ?? 0,
                        genericDeclaration.text,
                        genericDeclaration.message,
                        severity
                    );
                }
            }
        }
    }

    private getFileExtension(filePath: string, filetype: string): boolean {
        const match = filePath.match(/\.([0-9a-zA-Z]+)$/);
        if (match) {
            const extension = match[1];
            return extension === filetype;
        }
        return false;
    }

    private getGenericDeclaration(str: string): { text: string, message: string } {
        let match = str.match(/^[^({]*/);
        let result = match ? match[0] : str;
        const regex = /<\w+\s+extends\s+(any|unknown)>/;
        const genericTypeRegex = /<(\w+)\s+extends\s+(\w+)>/;
        const matchType = result.match(genericTypeRegex);
        let genericParam = '';
        let typeConstraint = '';
        if (matchType && matchType.length >= 3) {
            genericParam = matchType[1] || '';
            typeConstraint = matchType[2] || '';
        }
        return {
            message: `Constraining the generic type \`${genericParam}\` to \`${typeConstraint}\` does nothing and is unnecessary.`,
            text: regex.test(result) ? result : '',
        };
    }

    private reportIssue(arkFile: ArkFile, lineNum: number, colum: number, text: string, message: string, severity: number): void {
        if (arkFile) {
            let startColum = colum + text.indexOf('<') + 1;
            let endColum = colum + text.indexOf('>');
            const filePath = arkFile.getFilePath();
            let defect = new Defects(lineNum, startColum, endColum, message, severity, this.rule.ruleId, filePath,
                this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defect, undefined));
            RuleListUtil.push(defect);
        } else {
            logger.debug('originStmt or arkFile is null');
        }
    }
}