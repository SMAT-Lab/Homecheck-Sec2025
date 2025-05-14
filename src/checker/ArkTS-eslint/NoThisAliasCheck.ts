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
import {ArkFile, AstTreeUtils, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../BaseChecker';
import {Defects} from '../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../Index';
import {Rule} from '../../Index';
import {RuleListUtil} from '../../utils/common/DefectsList';
import {IssueReport} from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoThisAliasCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-this-alias.md',
    description: 'Disallow aliasing this.'
};

type Options = [{
    allowDestructuring: boolean,
    allowedNames: string[]
}]

export class NoThisAliasCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    private allowDestructuring = true;
    private allowedNames: string[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        if (!targetFile.getFilePath().endsWith('.ts')) {
            return;
        }

        if (this.rule && this.rule.option) {
            const options = this.rule.option as Options;
            if (options.length > 0) {
                const option = options[0];
                if (option.allowDestructuring != undefined) {
                    this.allowDestructuring = option.allowDestructuring;
                }
                if (option.allowedNames != undefined) {
                    this.allowedNames = option.allowedNames;
                }
            }
        }

        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject == undefined) {
            return;
        }

        this.loopNode(targetFile, sourceFile, sourceFileObject);
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isVariableDeclaration(child) || ts.isBinaryExpression(child)) {
                this.checkVariableDeclaration(targetFile, sourceFile, child);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkVariableDeclaration(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        if (children.length == 0) {
            return;
        }

        const lastNode = children[children.length - 1];
        if (lastNode.kind != ts.SyntaxKind.ThisKeyword) {
            return;
        }

        const firstNode = children[0];
        let message: string | undefined = undefined;
        if (ts.isObjectBindingPattern(firstNode) || ts.isArrayBindingPattern(firstNode)) {
            if (!this.allowDestructuring) {
                message = 'Unexpected aliasing of members of \'this\' to local variables.';
            }
        } else {
            const name = firstNode.getText();
            if (this.allowedNames.indexOf(name) == -1) {
                message = 'Unexpected aliasing of \'this\' to local variable.';
            }
        }

        if (message) {
            const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, firstNode.getStart());
            const startLine = startPosition.line + 1;
            const startCol = startPosition.character + 1;
            this.addIssueReport(targetFile, startLine, startCol, 0, message);
        }
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}