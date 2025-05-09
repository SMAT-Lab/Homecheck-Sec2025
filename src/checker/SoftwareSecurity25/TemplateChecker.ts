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

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoNonNullAssertionCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-non-null-assertion-check.md',
    description: 'Disallow non-null assertions using the ! postfix operator.'
};

export class TemplateChecker implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
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
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject === undefined) {
            return;
        }

        this.loopNode(targetFile, sourceFile, sourceFileObject);
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isNonNullExpression(child)) {
                this.checkNonNullExpression(targetFile, sourceFile, child);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkNonNullExpression(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const message = 'Forbidden non-null assertion.';
        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
        const startLine = startPosition.line + 1;
        const startCol = startPosition.character + 1;
        const endPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getEnd());
        const endLine = endPosition.line + 1;
        const endCol = endPosition.character + 1;
        this.addIssueReport(targetFile, startLine, startCol, endLine, endCol, message);
    }

    private addIssueReport(arkFile: ArkFile, startLine: number, startCol: number, endLine: number, endCol: number, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(startLine, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}