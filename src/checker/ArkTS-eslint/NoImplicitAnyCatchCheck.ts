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


import {ts, ArkFile, AstTreeUtils} from "arkanalyzer/lib";
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from "../BaseChecker";
import {Defects, IssueReport} from '../../model/Defects';
import {FileMatcher, MatcherCallback, MatcherTypes} from "../../matcher/Matchers";
import {Utils} from '../../Index';
import {Rule} from "../../model/Rule";
import {RuleListUtil} from "../../utils/common/DefectsList";
import {RuleFix} from '../../model/Fix';

const defaultOptions: Options = {
    allowExplicitAny: false
}

interface Options {
    allowExplicitAny: boolean
}

interface lineColumnInfo {
    line: number,
    character: number
}

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoImplicitAnyCatchCheck');
const gmetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-implicit-any-catch-check.md", // TODO: support url
    description: "Implicit any in catch clause."
};

export class NoImplicitAnyCatchCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gmetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    }

    private issueMap: Map<string, IssueReport> = new Map();
    public check = (file: ArkFile): void => {
        if (this.getFileExtension(file.getName()) !== '.ets') {
            let options: Options;
            if (this.rule && this.rule.option.length > 0) {
                options = this.rule.option[0] as Options;
            } else {
                options = defaultOptions;
            }
            this.checkCatchParameter(file, options);
            this.reportSortedIssues();
        }
    }

    private getFileExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }
        return filePath.substring(lastDotIndex);
    }

    public checkCatchParameter(file: ArkFile, options: Options): { line: number, character: number }[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(file);
        const catchLocations: { line: number, character: number }[] = [];
        const traverse = (node: ts.Node) => {
            if (ts.isCatchClause(node)) {
                this.handleCatchClause(node, file, options, catchLocations, sourceFile);
            }
            // 递归遍历所有子节点
            ts.forEachChild(node, childNode => traverse(childNode));
        }
        // 从源文件开始遍历
        traverse(sourceFile);
        // 返回找到的 catch 子句的行列号数组
        return catchLocations;
    }

    private determineFixText(variableDeclaration: ts.VariableDeclaration | undefined,
                             text: string | undefined, options: Options): string | undefined {
        this.metaData.description = 'Implicit any in catch clause.';                        
        if (!variableDeclaration) {
            return undefined;
        }
        if (options.allowExplicitAny) {
            return variableDeclaration.type ? undefined : `${text}: unknown`;
        }
        const type = variableDeclaration.type?.getText();
        if (type?.toLowerCase() === 'any') {
            this.metaData.description = 'Explicit any in catch clause.';
            return `${text?.slice(0, text.indexOf(':'))}: unknown`;
        }
        return type ? undefined : `${text}: unknown`;
    }


    private handleCatchClause(node: ts.CatchClause, file: ArkFile, options: Options,
                              catchLocations: { line: number, character: number }[], sourceFile: ts.SourceFile): void {
        const variableDeclaration = node.variableDeclaration;
        const text = variableDeclaration?.getText();
        const pos = variableDeclaration?.getStart();
        const end = variableDeclaration?.getEnd();
        let fixText: string | undefined = this.determineFixText(variableDeclaration, text, options);
        if (fixText) {
            const start = node.getStart();
            const position = ts.getLineAndCharacterOfPosition(sourceFile, start);
            const line = position.line + 1;
            const character = position.character + 1;
            catchLocations.push({ line, character });
            const defect = this.addIssueReport(file, this.metaData, { line, character });
            if (pos && end && defect) {
                let fix: RuleFix = this.ruleFix(pos, end, fixText);
                this.issueMap.set(defect.fixKey, { defect, fix });
            }
        }
    }

    private ruleFix(pos: number, end: number, fixText: string): RuleFix {
        return {range: [pos, end], text: fixText};
    }

    private reportSortedIssues(): void {
        if (this.issueMap.size === 0) {
            return;
        }
        const sortedIssues = Array.from(this.issueMap.entries())
            .sort(([keyA], [keyB]) => Utils.sortByLineAndColumn(keyA, keyB));
        this.issues = [];
        sortedIssues.forEach(([_, issue]) => {
            RuleListUtil.push(issue.defect);
            this.issues.push(issue);
        });
    }

    private addIssueReport(arkFile: ArkFile, metaData: BaseMetaData, lineAndColumn: lineColumnInfo): Defects | void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(arkFile, lineAndColumn);
        if (warnInfo) {
            const filePath = arkFile.getFilePath();
            let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol,
                this.metaData.description, severity, this.rule.ruleId, filePath,
                this.metaData.ruleDocPath, true, false, true);
            this.defects.push(defects);
            return defects;
        }
    }

    private getLineAndColumn(arkfile: ArkFile, lineColumn: lineColumnInfo): {
        line: number, startCol: number, endCol: number, filePath: string } | null {
        if (arkfile) {
            const originPath = arkfile.getFilePath();
            return {
                line: lineColumn.line,
                startCol: lineColumn.character,
                endCol: lineColumn.character,
                filePath: originPath
            };
        } else {
            logger.debug('arkFile is null');
        }
        return null;
    }
}