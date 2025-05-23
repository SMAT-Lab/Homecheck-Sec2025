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

import { ArkFile, ExportInfo } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import path from 'path';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUseAnyExportCurrentCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/no-use-any-export-current-check.md',
    description: 'Do not use export * to export types and data defined in the current module.'
};

export class NoUseAnyExportCurrentCheck implements BaseChecker {
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
        this.processExportInfos(arkFile, arkFile.getExportInfos());
        for (const namespace of arkFile.getAllNamespacesUnderThisFile()) {
            this.processExportInfos(arkFile, namespace.getExportInfos());
        }
    };

    private processExportInfos(arkFile: ArkFile, exportInfos: ExportInfo[]): void {
        for (let exportInfo of exportInfos) {
            let clauseName = exportInfo.getExportClauseName();
            let nameBeforeAs = exportInfo.getNameBeforeAs();
            let exportFrom = exportInfo.getFrom();
            if (!exportFrom) {
                continue;
            }
            let exportName = path.basename(exportFrom);
            let fileName = path.basename(arkFile.getFilePath()).replace(/.ets|.ts$/gi, '');
            if ((clauseName === '*' || nameBeforeAs === '*') && exportName === fileName) {
                this.reportIssue(arkFile, exportInfo);
            }
        }
    }

    private reportIssue(arkFile: ArkFile, exportInfo: ExportInfo): void {
        let arkFilePath = arkFile.getFilePath();
        let text = exportInfo.getTsSourceCode();
        let originPosition = exportInfo.getOriginTsPosition();
        let lineNum = originPosition.getLineNo();
        let startColumn = originPosition.getColNo();
        let endColumn = startColumn + text.length - 1;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity, this.rule.ruleId,
            arkFilePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defects, undefined));
    }
}