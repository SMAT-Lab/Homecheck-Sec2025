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
import { AstTreeUtils, ArkFile, ts } from "arkanalyzer";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Rule, Defects, FileMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from "../../model/Defects";
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-for-in-array.md',
    description: 'For-in loops over arrays skips holes, returns indices as strings, and may visit the prototype chain or other enumerable properties. Use a more robust iteration method such as for-of or array.forEach instead.'
};
let filePath = '';
export class NoForInArrayCheck implements BaseChecker {
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
            callback: this.check.bind(this)
        };
        return [matchBuildCb];
    };

    public check = (arkFile: ArkFile) => {
        filePath = arkFile.getFilePath();
        const isTsFile = this.isTsFile(filePath);
        if (!isTsFile) {
            return;
        };
        const astRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        for (let child of astRoot.statements) {
            this.isForInCheck(child);
        };
    };
    private isForInCheck = (node: ts.Node): void => {
        if (ts.isForInStatement(node)) {
            this.handleForInStatement(node);
        };
        ts.forEachChild(node, this.isForInCheck);
    };
    private handleForInStatement(node: ts.ForInStatement): void {
        const iterationObject = node.expression;
        if (ts.isObjectLiteralExpression(iterationObject)) {
            return;
        };
        const severity = this.rule.alert ?? this.metaData.severity;
        this.addIssueReport(node, this.metaData.description, severity);
    };
    private addIssueReport(node: ts.Node, description: string, severity: number): void {
        const warnInfo = this.getLineAndColumn(node);
        const defect = new Defects(
            warnInfo.line, warnInfo.startCol, warnInfo.endCol, description, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };
    private getLineAndColumn(node: ts.Node): { line: number; startCol: number; endCol: number; filePath: string } {
        const sourceFile = node.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const endCharacter = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).character;
        return {
            line: line + 1,
            startCol: character + 1,
            endCol: endCharacter + 1,
            filePath: filePath
        };
    };
    private isTsFile(filePath: string): boolean {
        return filePath.toLowerCase().endsWith('.ts');
    };
};