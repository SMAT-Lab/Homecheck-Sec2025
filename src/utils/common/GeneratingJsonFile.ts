import * as fs from 'fs';
import * as path from 'path';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileReports } from '../../model/Defects';
import { FileUtils, WriteFileMode } from './FileUtils';
import { CheckEntry } from './CheckEntry';
import { HomeSecReport } from './HomeSecReport';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'GeneratingJsonFile');
const severitys: string[] = ['OFF', 'WARN', 'ERROR', 'SUGGESTION'];
const FILE_NAMING_RULE = '@hw-stylistic/file-naming-convention';

export class GeneratingJsonFile {
    public static generatingJsonFile(checkEntry: CheckEntry, filePath: string, fileReports: FileReports[]): void {
        writeFileFix(fileReports);
        const fileDefectInfos = this.format(fileReports);
        let results: Map<string, FileDefectInfo> = new Map();
        for (let fileDefectInfo of fileDefectInfos) {
            this.addResult(fileDefectInfo, results);
        }
        const jsonString = this.format2(results);
        HomeSecReport.getInstance().addProjectResult(checkEntry.projectConfig.projectName, checkEntry.projectConfig.projectPath, jsonString);
        try {
            FileUtils.writeToFile(filePath, jsonString, WriteFileMode.OVERWRITE);
        } catch (error) {
            logger.error(`write file ${filePath} failed, error: ${error}`);
        }
    }

    /**
     * 过滤掉部分不需要的defect属性
     *
     * @param fileReports 原始文件缺陷信息数组
     * @returns 过滤后的文件缺陷信息数组
     */
    private static format(fileReports: FileReports[]): FileDefectInfo[] {
        const fileDefectInfos: FileDefectInfo[] = [];
        for (const fileReport of fileReports) {
            const fileDefectInfo: FileDefectInfo = {
                filePath: fileReport.filePath,
                defects: []
            };
            for (const defect of fileReport.defects) {
                const defectInfo: DefectInfo = {
                    reportLine: defect.reportLine,
                    reportColumn: defect.reportColumn,
                    ruleId: defect.ruleId,
                    severity: severitys[defect.severity],
                    mergeKey: defect.mergeKey,
                    description: defect.description,
                    ruleDocPath: defect.ruleDocPath
                };
                fileDefectInfo.defects.push(defectInfo);
            }
            fileDefectInfos.push(fileDefectInfo);
        }
        return fileDefectInfos;
    }

    private static addResult(defect: FileDefectInfo, results: Map<string, FileDefectInfo>): void {
        const normalizedPath = path.normalize(defect.filePath).toLocaleLowerCase();
        if (!results.has(normalizedPath)) {
            results.set(normalizedPath, defect);
        } else {
            results.get(normalizedPath)?.defects.push(...defect.defects);
        }
        const defectInfo = results.get(normalizedPath);
        defectInfo?.defects.sort((defectA, defectB) => {
            if (defectA.ruleId === FILE_NAMING_RULE) {
                return -1;
            }
            if (defectB.ruleId === FILE_NAMING_RULE) {
                return 1;
            }
            if (defectA.reportLine === defectB.reportLine) {
                if (defectA.reportColumn === defectB.reportColumn) {
                    return defectA.mergeKey.localeCompare(defectB.mergeKey);
                }
                return defectA.reportColumn - defectB.reportColumn;
            }
            return defectA.reportLine - defectB.reportLine;
        });
    }

    private static format2(results: Map<string, FileDefectInfo>): string {
        const jsonResults: JsonResult[] = [];
        for (let result of results) {
            const oneResult: JsonResult = {
                filePath: '',
                messages: []
            };
            oneResult.filePath = result[1].filePath;
            let defects = result[1].defects;
            for (let defect of defects) {
                const oneDefect: SimpleDefect = {
                    line: 0,
                    column: 0,
                    severity: '',
                    message: '',
                    rule: '',
                };
                oneDefect.line = defect.reportLine;
                oneDefect.column = defect.reportColumn;
                oneDefect.severity = defect.severity;
                oneDefect.message = defect.description;
                oneDefect.rule = defect.ruleId;
                oneResult.messages.push(oneDefect);
            }
            jsonResults.push(oneResult);
        }
        return JSON.stringify(jsonResults, null, 2);
    }
}

interface JsonResult {
    filePath: string;
    messages: SimpleDefect[];
}

interface SimpleDefect {
    line: number;
    column: number;
    severity: string;
    message: string;
    rule: string | null;
}

interface FileDefectInfo {
    filePath: string;
    defects: DefectInfo[];
}

interface DefectInfo {
    severity: string;
    description: string;
    mergeKey: string;
    reportLine: number;
    reportColumn: number;
    ruleId: string | null;
    ruleDocPath: string | null;
}

function writeFileFix(fileReports: FileReports[]): void {
    for (const fileReport of fileReports) {
        if (fileReport.output) {
            try {
                const sanitizedContent = fileReport.output.replace(/\r/g, ''); // 移除所有 \r
                fs.writeFileSync(fileReport.filePath + '.homecheckFix', sanitizedContent, { encoding: 'utf8' });
            } catch (error) {
                logger.error((error as Error).message);
            };
        };
    };
}