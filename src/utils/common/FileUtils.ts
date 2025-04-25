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
import * as fs from "fs";
import * as path from "path";
import { createInterface } from "readline";
import { DisableText } from "./Disable";
import { Sdk } from "arkanalyzer/lib/Config";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { ProjectConfig, SelectedFileInfo } from "../../model/ProjectConfig";
import { RuleConfig } from "../../model/RuleConfig";
import { GlobMatch } from "./GlobMatch";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'FileUtils');
export class FileUtils {
    /**
     * 读取指定文件并返回其内容
     * @param {string} fileName - 要读取的文件名
     * @returns {string} - 文件内容
     */
    public static readFile(fileName: string): string {
        return fs.readFileSync(fileName, 'utf8').replace(/^\ufeff/u, '');
    }

    /**
     * 根据给定的文件列表和规则配置，过滤出符合规则的文件列表。
     * @param fileList 文件列表。
     * @param ruleConfig 规则配置，包含匹配和忽略文件的规则，以及可能的重写规则。
     * @returns 返回符合规则的文件列表，异常情况下返回空数组。
     */
    public static async getFiltedFiles(fileList: string[], ruleConfig: RuleConfig): Promise<string[]> {
        try {
            let result = await this.matchFiles(fileList, ruleConfig.files, ruleConfig.ignore);
            const overrides = ruleConfig.overrides;
            if (overrides.length > 0) {
                for (const override of overrides) {
                    result = result.concat(await this.getFiltedFiles(fileList, override));
                    result = [...new Set(result)];
                }
            }
            return result;
        } catch (error) {
            logger.error(`Error occurred while reading files: ${error}`);
            return [];
        }
    }

    /**
     * 匹配文件列表中的文件，返回符合条件的文件路径列表
     * @param fileList 文件路径列表
     * @param fileTypes 文件类型列表，使用glob模式匹配
     * @param ignoreDirs 要忽略的目录列表，使用glob模式匹配，默认为空数组
     * @returns 符合条件的文件路径列表
     */
    public static async matchFiles(fileList: string[], fileGlob: GlobMatch, ignoreGlob: GlobMatch): Promise<string[]> {
        let result: string[] = [];
        for (const filePath of fileList) {
            if (!ignoreGlob?.matchGlob(filePath) && fileGlob.matchGlob(filePath)) {
                // 读取file文件内容首行，若为屏蔽行则跳过
                const firstLineText = await this.readLinesFromFile(filePath, 1);
                if (firstLineText.includes(DisableText.FILE_DISABLE_TEXT)) {
                    continue;
                }
                result.push(filePath);
            }
        }
        return result;
    }


    /**
     * 从文件中读取指定行或全部行
     * @param filePath 文件路径
     * @param lineNo 要读取的行号，不传或者0值则读取全部行
     * @returns 读取到的行组成的字符串数组
     * @throws 如果读取文件时发生错误，将抛出异常
     */
    public static async readLinesFromFile(filePath: string, lineNo?: number): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            let lines: string[] = [];
            let readLineNo = 1;

            const readStream = fs.createReadStream(filePath);
            const rl = createInterface({
                input: readStream,
                crlfDelay: Infinity
            });

            const handleLine = (line: string): void => {
                if (lineNo) {
                    if (readLineNo === lineNo) {
                        lines.push(line);
                        rl.close();
                    }
                } else {
                    lines.push(line);
                }
                readLineNo++;
            };

            rl.on('line', handleLine);

            rl.on('close', () => {
                readStream.destroy();
                resolve(lines);
            });

            rl.on('error', (err) => {
                readStream.destroy();
                reject(err);
            });

            readStream.on('error', (err) => {
                rl.close();
                reject(err);
            });
        })
    }

    /**
     * 检查文件是否存在
     * @param filePath 文件路径
     * @returns 如果文件存在则返回true，否则返回false
     */
    public static isExistsSync(filePath: string): boolean {
        return fs.existsSync(filePath);
    }

    /**
     * 从指定路径的JSON文件中获取符合条件的文件信息列表
     * @param jsonPath JSON文件路径
     * @param exts 文件扩展名数组
     * @returns 符合条件的文件信息数组
     */
    public static getSeletctedFileInfos(jsonPath: string, exts: string[]): SelectedFileInfo[] {
        const fileInfoList: SelectedFileInfo[] = [];
        try {
            const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            jsonData.checkPath?.forEach((fileInfo: SelectedFileInfo) => {
                if (exts.includes(path.extname(fileInfo.filePath))) {
                    fileInfoList.push(fileInfo);
                }
            });
        } catch (error) {
            logger.error(`Error occurred while reading file list from ${jsonPath}: ${error}`);
        }
        return fileInfoList;
    }

    /**
     * 获取指定目录下所有符合条件的文件
     * @param dirPath - 目录路径
     * @param exts - 文件扩展名数组，如果为空则获取所有文件，['.ts', '.ets', '.json5']
     * @param filenameArr - 存储符合条件的文件路径的数组，默认为空数组
     * @param visited - 已访问的目录集合，默认为空集合
     * @returns 符合条件的文件路径数组
     */
    public static getAllFiles(dirPath: string, exts: string[], filenameArr: string[] = [], visited: Set<string> = new Set<string>()): string[] {
        // 检查目录是否存在
        if (!fs.existsSync(dirPath)) {
            logger.error(`'${dirPath}' is not exist, please check!`);
            return filenameArr;
        }
        // 获取目录的绝对路径
        const realSrc = fs.realpathSync(dirPath);
        // 避免重复访问
        if (visited.has(realSrc)) {
            return filenameArr;
        }
        visited.add(realSrc);
        // 读取目录下的文件和文件夹
        fs.readdirSync(realSrc).forEach(fileName => {
            if (this.shouldSkipFile(fileName)) {
                return;
            }
            const realFile = path.resolve(realSrc, fileName);
            // 如果是文件夹，则递归调用
            if (fs.statSync(realFile).isDirectory()) {
                this.getAllFiles(realFile, exts, filenameArr, visited);
            } else {
                // 如果扩展名为空，则添加所有文件
                if (exts.length === 0) {
                    filenameArr.push(realFile);
                } else if (this.shouldAddFile(realFile, exts)) {
                    filenameArr.push(realFile);
                }
            }
        })
        return filenameArr;
    }

    private static shouldSkipFile(fileName: string): boolean {
        return ['oh_modules', 'node_modules', 'hvigorfile.ts', 'ohosTest'].includes(fileName);
    }

    private static shouldAddFile(filePath: string, exts: string[]): boolean {
        if (exts.length === 0) {
            return true;
        }
        const ext = path.extname(filePath).toLowerCase();
        return exts.includes(ext);
    }

    /**
     * 生成SDK数组
     * @param projectConfig - 项目配置
     * @returns Sdk[] - SDK数组
     */
    public static genSdks(projectConfig: ProjectConfig): Sdk[] {
        let sdks: Sdk[] = [];
        const sdkConfigPath = path.join(projectConfig.arkCheckPath, 'resources', 'sdkConfig.json');
        if (fs.existsSync(sdkConfigPath)) {
            const configurations = JSON.parse(fs.readFileSync(sdkConfigPath, 'utf-8'));
            sdks = configurations.sdks ?? [];
        }
        if (!projectConfig.ohosSdkPath && !projectConfig.hmsSdkPath) {
            return sdks;
        }
        sdks.forEach(sdk => {
            if (sdk.name === 'ohosSdk') {
                sdk.path = projectConfig.ohosSdkPath;
            } else if (sdk.name === 'hmsSdk') {
                sdk.path = projectConfig.hmsSdkPath;
            } else {
                sdk.path = path.join(projectConfig.arkCheckPath, sdk.path);
            }
        });
        projectConfig.sdksThirdParty?.forEach(sdkThirdParty => {
            let sdkJson = JSON.parse(JSON.stringify(sdkThirdParty));
            let sdkFd = sdks.find(sdk => sdk.name === sdkJson.name);
            if (!sdkFd) {
                let sdk3rd: Sdk = {
                    name: sdkJson.name,
                    path: path.resolve(sdkJson.path),
                    moduleName: sdkJson.moduleName,
                };
                sdks.push(sdk3rd);
            } else {
                sdkFd.path = path.resolve(sdkJson.path);
                sdkFd.moduleName = sdkJson.moduleName;
            }
        });
        return sdks;
    }


    /**
     * 写入文件，同步接口
     * @param filePath 文件路径
     * @param content 写入的内容
     * @param mode 写入模式，不传默认为追加模式
     **/
    public static writeToFile(filePath: string, content: string, mode: WriteFileMode = WriteFileMode.APPEND) {
        const dirName = path.dirname(filePath);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }
        if (mode === WriteFileMode.OVERWRITE) {
            fs.writeFileSync(filePath, content, { encoding: 'utf8' });
        } else if (mode === WriteFileMode.APPEND) {
            fs.appendFileSync(filePath, content, { encoding: 'utf8' });
        } else {
            logger.error(`Invalid write mode: ${mode}`);
        }
    }
}

export enum WriteFileMode {
    OVERWRITE,
    APPEND
}