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

import { ArkFile, FileSignature, ImportInfo, Scene } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoCycleCheck');
let originalFilePath = '';
let projectDir = '';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/no-cycle-check.md',
    description: 'Cyclic dependency is prohibited. The call chain here is as follows: '
};

export class NoCycleCheck implements BaseChecker {
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

    /**
     * 循环依赖检测.
     * 
     * @param arkFile
     */
    public check = (arkFile: ArkFile): void => {
        originalFilePath = arkFile.getFilePath();
        projectDir = arkFile.getProjectDir();
        let scene = arkFile.getScene();
        let originalImportInfos = arkFile.getImportInfos();
        let refChainInfo = originalFilePath.substring(projectDir.length, originalFilePath.length);
        let refFileSignatureChain = new Set<FileSignature>();
        this.getImportByRecursion(scene, originalImportInfos, refChainInfo, refFileSignatureChain);
    };

    /**
     * 递归获取依赖.
     * 
     * @param scene
     * @param importInfos
     * @param refChainInfo
     * @param refFileSignatureChain
     */
    private getImportByRecursion(scene: Scene, importInfos: ImportInfo[], refChainInfo: string, refFileSignatureChain: Set<FileSignature>): void {
        for (let importInfo of importInfos) {
            let importFilePath = importInfo.getLazyExportInfo()?.getDeclaringArkFile().getFilePath();
            let reportLine = importInfo.getOriginTsPosition().getLineNo();
            let reportColumn = 1;
            let reportEndColumn = reportColumn + importInfo.getTsSourceCode().length;
            refChainInfo = refChainInfo + '%' + reportLine + '%' + reportColumn + '%' + reportEndColumn;
            refChainInfo = refChainInfo + '\n>>' + importFilePath?.substring(projectDir.length, importFilePath.length);
            if (!importFilePath) {
                continue;
            }
            let fileSignature = importInfo.getLazyExportInfo()?.getDeclaringArkFile().getFileSignature() ?? new FileSignature('', '');
            let importInfos1 = scene.getFile(fileSignature)?.getImportInfos();
            if (importFilePath === originalFilePath) {
                this.reportIssue(reportLine, reportColumn, reportEndColumn, refChainInfo);
                break;
            } else if (refFileSignatureChain.has(fileSignature)) {
                // 说明调用链有其他文件之间的循环依赖，等到查询对应文件时再上报
                continue;
            } else {
                if (importInfos1) {
                    refFileSignatureChain.add(fileSignature);
                    this.getImportByRecursion(scene, importInfos1, refChainInfo, refFileSignatureChain);
                }
            }
        }
    }

    /**
     * 拼接issue.
     * 
     * @param lineNum
     * @param startColumn
     * @param endColunm
     * @param refChainInfo
     */
    private reportIssue(lineNum: number, startColumn: number, endColunm: number, refChainInfo: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        let description = this.metaData.description + refChainInfo;
        let defects = new Defects(lineNum, startColumn, endColunm, description, severity, this.rule.ruleId,
            originalFilePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}