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

import { Scene } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
import { SceneConfig } from "arkanalyzer";
import { fileRuleMapping } from "./FileRuleMapping";
import { RuleConfig } from "../../model/RuleConfig";
import { ProjectConfig, SelectedFileInfo } from "../../model/ProjectConfig";
import { Project2Check } from "../../model/Project2Check";
import { File2Check } from "../../model/File2Check";
import { DisableText } from "./Disable";
import { Message } from "../../model/Message";
import { FileUtils } from "./FileUtils";
import { ScopeHelper } from "./ScopeHelper";
import { RuleListUtil } from "./DefectsList";
import { FixMode } from "../../model/Fix";
import { FileIssues, FileReports, IssueReport, engine } from "../../model/Defects";
import { FixUtils } from "./FixUtils";
import { FixEngine } from "../../codeFix/FixEngine";
import { CheckerUtils } from "../checker/CheckerUtils";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CheckEntry');

export class CheckEntry {
    public ruleConfig: RuleConfig;
    public projectConfig: ProjectConfig;
    public projectCheck: Project2Check;
    public fileChecks: File2Check[] = [];
    public scene: Scene;
    public message: Message;
    public selectFileList: SelectedFileInfo[] = [];

    constructor() {
    }

    public addFileCheck(fileCheck: File2Check): void {
        this.fileChecks.push(fileCheck);
    }

    public addProjectCheck(projectCheck: Project2Check): void {
        this.projectCheck = projectCheck;
    }

    public setDisableText(fileDisableText: string, nextLineDisableText: string): void {
        DisableText.FILE_DISABLE_TEXT = fileDisableText;
        DisableText.NEXT_LINE_DISABLE_TEXT = nextLineDisableText;
    }

    public setEngineName(engineName: string): void {
        engine.engineName = engineName;
    }

    public setCheckFileList(selectFileList: SelectedFileInfo[]): void {
        this.selectFileList = selectFileList;
    }

    public setMessage(message: Message): void {
        this.message = message;
    }

    public async runAll(): Promise<void> {
        // TODO: worker_threads改造
        let checkedIndex = 1;
        for (const fileCheck of this.fileChecks) {
            try {
                await fileCheck.run();
                // 进度条通知
                this.message?.progressNotify(checkedIndex / (this.fileChecks.length + 1), fileCheck.arkFile.getFilePath());
                checkedIndex++;
            } catch (error) {
                logger.error(`Error running file check for ${fileCheck.arkFile.getFilePath()}: ${(error as Error).message}`);
                continue;
            }
        }

        if (this.projectCheck) {
            try {
                await this.projectCheck.run();
                this.message?.progressNotify(checkedIndex / (this.fileChecks.length + 1), 'Project Check');
            } catch (error) {
                logger.error(`Error running project check: ${(error as Error).message}`);
            }
        }
    }

    /**
     * 按规则维度统计并输出告警信息，按文件维度汇总并返回告警信息。
     * 
     * @returns FileReport[] 文件报告数组，每个元素包含文件名、缺陷列表和输出信息
     */
    public sortIssues(): FileIssues[] {
        const issuesMapByChecker: Map<string, IssueReport[]> = new Map();
        const issuesMapByFile: Map<string, IssueReport[]> = new Map();
        RuleListUtil.printDefects();
        for (const fileCheck of this.fileChecks) {
            if (!fileCheck.issues || fileCheck.issues.length === 0) {
                continue;
            }
            issuesMapByFile.set(fileCheck.arkFile.getFilePath(), fileCheck.issues);
            for (const issue of fileCheck.issues) {
                logger.debug(issue.defect.mergeKey);
                const checkerStorage = issuesMapByChecker.get(issue.defect.ruleId);
                if (checkerStorage) {
                    checkerStorage.push(issue);
                } else {
                    issuesMapByChecker.set(issue.defect.ruleId, [issue]);
                }
            }
        }

        for (const issue of this.projectCheck?.issues ?? []) {
            logger.debug(issue.defect.mergeKey);
            const checkerStorage = issuesMapByChecker.get(issue.defect.ruleId);
            if (checkerStorage) {
                checkerStorage.push(issue);
            } else {
                issuesMapByChecker.set(issue.defect.ruleId, [issue]);
            }

            const filePath = issue.defect.mergeKey.split('%')[0];
            const fileStorage = issuesMapByFile.get(filePath);
            if (fileStorage) {
                fileStorage.push(issue);
            } else {
                issuesMapByFile.set(filePath, [issue]);
            }
        }
        issuesMapByChecker.forEach((issues, checker) => {
            logger.info(issues.length + ' issues from checker - ' + checker);
        });
        const fileReports: FileIssues[] = [];
        issuesMapByFile.forEach((issues, filePath) => {
            fileReports.push({ filePath, issues });
        });
        return fileReports;
    }

    public buildScope(): void {
        new ScopeHelper().buildScope(this.scene);
    }

    /**
     * 修复代码问题
     *
     * @param fileIssues 以文件为维度的issues信息
     * @returns 修复后的文件报告数组，去掉已修复issues，且需更新未修复issues行列号等信息
     */
    public codeFix(fileIssues: FileIssues[]): FileReports[] {
        const fileReports: FileReports[] = [];
        for (const fileIssue of fileIssues) {
            const arkFile = CheckerUtils.getArkFileByFilePath(this.scene, fileIssue.filePath);
            if (!arkFile) {
                fileReports.push({ filePath: fileIssue.filePath, defects: fileIssue.issues.map(issue => issue.defect) });
                continue;
            }
            let keys: string[] = [];
            let isFixAll = false;
            // 寻找该文件的fixKey，即需要修复的issue
            for (const fileInfo of this.selectFileList) {
                if (fileInfo.fixKey && fileInfo.filePath === fileIssue.filePath) {
                    keys = fileInfo.fixKey;
                    break;
                }
            }
            // 没有指定key，则修复所有issue
            if (keys.length === 0) {
                isFixAll = true;
            }

            const remainIssues: IssueReport[] = [];
            const astFixIssues: IssueReport[] = [];
            this.classifyIssues(fileIssue.issues, isFixAll, keys, astFixIssues, remainIssues);
            const astFixReport = new FixEngine().getEngine(FixMode.AST).applyFix(arkFile, astFixIssues, remainIssues);
            fileReports.push(astFixReport);
        }
        return fileReports;
    }

    private classifyIssues(allIssues: IssueReport[], fixAll: boolean, keys: string[], astFixIssues: IssueReport[],
        remainIssues: IssueReport[]): void {
        for (const issue of allIssues) {
            if (fixAll || keys.includes(issue.defect.fixKey)) {
                if (issue.fix && issue.defect.fixable && FixUtils.isRuleFix(issue.fix)) {
                    astFixIssues.push(issue);
                } else {
                    remainIssues.push(issue);
                    logger.debug('Fix type is unsupported.');
                }
            } else {
                remainIssues.push(issue);
            }
        }
    }
}

export async function checkEntryBuilder(checkEntry: CheckEntry): Promise<boolean> {
    // 1、 无指定文件则检查项目下所有文件
    let checkFileList = checkEntry.selectFileList.map(file => file.filePath);
    if (checkFileList.length === 0) {
        checkFileList = FileUtils.getAllFiles(checkEntry.projectConfig.projectPath, ['.ts', '.ets', '.json5']);
    }
    
    // 2、文件过滤和文件级屏蔽处理
    checkFileList = await FileUtils.getFiltedFiles(checkFileList, checkEntry.ruleConfig);
    logger.info("File count: " + checkFileList.length);
    if (checkFileList.length === 0) {
        checkEntry.message?.progressNotify(1, 'No file to check.');
        return false;
    }

    // 3、scene按需构建、scope构建
    if (!buildScene(checkFileList, checkEntry)) {
        return false;
    }

    // 4、规则和文件映射构建
    if (!(await fileRuleMapping(checkFileList, checkEntry))) {
        return false;
    }
    return true;
}

/**
 * 获取指定检查的文件列表
 * 
 * @param checkFilePath - 指定的检查文件路径的配置文件路径，该文件内容示例{"checkPath": [{"filePath": "xxx", "fixKey": ["%line%sCol%eCol%ruleId"]}]}
 * filePath为需要检查的文件路径，fixKey为需要修复的缺陷key，空数组则不修复。
 * @returns SelectFileInfo[] - 需要检查的文件列表
 */
export function getSelectFileList(checkFilePath: string): SelectedFileInfo[] {
    if (checkFilePath.length > 0) {
        // 解析指定的文件
        return FileUtils.getSeletctedFileInfos(checkFilePath, ['.ts', '.ets', '.json5']);
    }
    return [];
}

/**
 * 构建Scene
 * @param fileList - 文件列表
 * @param checkEntry - 检查条目
 * @returns {boolean} - 构建是否成功
 */
function buildScene(fileList: string[], checkEntry: CheckEntry): boolean {
    try {
        // 构建SceneConfig信息
        const sceneConfig = new SceneConfig();
        const projectName = checkEntry.projectConfig.projectName;
        const projectPath = checkEntry.projectConfig.projectPath;
        const sdkList = FileUtils.genSdks(checkEntry.projectConfig);
        sceneConfig.buildFromProjectFiles(projectName, projectPath, fileList, sdkList);
        logger.info("Build sceneConfig completed.");
        // 构建Scene信息
        checkEntry.scene = new Scene();
        checkEntry.scene.buildSceneFromFiles(sceneConfig);
        logger.info("Build scene completed.");
        checkEntry.scene.inferTypes();
        logger.info("Infer types completed.");
    } catch (error) {
        logger.error("Build scene or infer types error: ", error);
        return false;
    }
    // 构建Scope信息
    checkEntry.buildScope();
    logger.info("Build scope completed.");
    return true;
}
