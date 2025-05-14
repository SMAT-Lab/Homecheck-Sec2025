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

import { accessSync, constants } from 'fs';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { fetchDependenciesFromFile, Scene } from 'arkanalyzer';
import fs from 'fs';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import path from 'path';
import { Rule, Defects, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { readImageInfo } from '../../utils/checker/ImageUtils';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'StartWindowIconCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/start-window-icon-check.md',
    description: 'For faster app startup, keep the startup icon size within 256 x 256 pixels.'
};

export class StartWindowIconCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: undefined,
            callback: this.check
        };
        return [matchBuildCb];
    }

    public check = (scene: Scene): void => {
        let moduleJson5Files = this.getJson5Files(scene.getRealProjectDir(), ['.json5']);
        for (let filePath of moduleJson5Files) {
            if (filePath.endsWith('module.json5')) {
                const jsonData = fetchDependenciesFromFile(filePath);
                let module = jsonData.module as moduleJson5Module;
                let type = module.type;
                if (type !== 'entry') {
                    continue;
                }
                let mainElement = module.mainElement;
                if (mainElement === undefined) {
                    continue;
                }
                let abilities = module.abilities;
                if (abilities === undefined) {
                    continue;
                }
                for (let ability of abilities) {
                    this.iconCheckByAbility(ability, mainElement, filePath);
                }
            }
        }
    };

    private iconCheckByAbility(ability: moduleAbility, mainElement: string, filePath: string): void {
        let abilityName = ability.name;
        if (abilityName === mainElement) {
            let startWindowIcon: string = ability.startWindowIcon;
            if (startWindowIcon !== undefined && startWindowIcon.startsWith('$media:')) {
                this.iconCheckByIcon(startWindowIcon, filePath, abilityName);
            }
        }
    }

    private iconCheckByIcon(startWindowIcon: string, filePath: string, abilityName: string): void {
        try {
            let iconName = startWindowIcon.substring(startWindowIcon.indexOf(':') + 1);
            let subReadFilePath = filePath.substring(0, filePath.lastIndexOf('src'));
            subReadFilePath = path.join(subReadFilePath, 'src', 'main', 'resources', 'base', 'media');
            if (!this.pathExistsSync(subReadFilePath)) {
                logger.warn(`No permission to access the icon search path ${subReadFilePath}`);
                return;
            }
            for (let name of fs.readdirSync(subReadFilePath)) {
                if (name.split('.')[0] === iconName) {
                    this.iconCheckByIconPath(subReadFilePath, name, filePath, abilityName);
                }
            }
        } catch (e) {
            logger.warn(`StartWindowIconCheck error`, e);
        }
    }

    private iconCheckByIconPath(subReadFilePath: string, name: string, filePath: string, abilityName: string): void {
        let isReport = this.iconCheck(path.join(subReadFilePath, name));
        if (isReport) {
            const warnInfo = this.getWarnInfo(filePath, abilityName);
            const severity = this.rule.alert ?? this.metaData.severity;
            let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId, filePath,
                this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private pathExistsSync(path: string): boolean {
        try {
            accessSync(path, constants.F_OK);
            return true;
        } catch (e) {
            return false;
        }
    }

    private getWarnInfo(filePath: string, abilityName: string): WarnInfo {
        let line = 0;
        let isAbilities = false;
        let isAbilityName = false;
        let isTargetsAbility = false;
        let isStartWindowIcon = false;

        let readData = fs.readFileSync(filePath, 'utf8');
        let readLines: string[] = readData.split('\n');
        let warnInfo: WarnInfo = { line: -1, startCol: -1, endCol: -1 };
        for (let readLine of readLines) {
            line++;
            let lineData = readLine.split(':');
            if (readLine.includes('"abilities"')) {
                isAbilities = true;
            } else if (isAbilities && lineData[0].includes('"name"')) {
                isAbilityName = true;
                if (lineData[1].includes(abilityName)) {
                    isTargetsAbility = true;
                }
            } else if (isAbilities && lineData[0].includes('"startWindowIcon"')) {
                isStartWindowIcon = true;
                warnInfo.line = line;
                warnInfo.startCol = readLine.indexOf(':') + 2;
                warnInfo.endCol = readLine.lastIndexOf('"') + 1;
            }

            if (isAbilityName && isStartWindowIcon) {
                if (isTargetsAbility) {
                    return warnInfo;
                }
                isAbilityName = false;
                isStartWindowIcon = false;
            }
        }
        return warnInfo;
    }

    private iconCheck(iconPath: string): boolean {
        try {
            const info = readImageInfo(iconPath);
            if (info === undefined) {
                return false;
            }
            const maxSize = 256 * 256;
            if (info.width !== undefined && info.height !== undefined) {
                const iconSize = info.width * info.height;
                if (iconSize > maxSize) {
                    return true;
                }
            }
        } catch (err) {
            logger.warn(`Error for check icon: ${err}`);
        }
        return false;
    }

    private getJson5Files(srcPath: string, exts: string[], filenameArr: string[] = [], visited: Set<string> = new Set<string>()): string[] {
        if (!fs.existsSync(srcPath)) {
            logger.warn('Input directory is not exist, please check!');
            return filenameArr;
        }
        const realSrc = fs.realpathSync(srcPath);
        if (visited.has(realSrc)) {
            return filenameArr;
        }
        visited.add(realSrc);
        let fileNames = fs.readdirSync(realSrc);
        fileNames.forEach((fileName) => {
            if (fileName !== 'oh_modules' &&
                fileName !== 'node_modules' &&
                fileName !== 'hvigorfile.ts' &&
                fileName !== 'ohosTest' &&
                fileName !== 'build'
            ) {
                const realFile = path.resolve(realSrc, fileName);
                if (fs.statSync(realFile).isDirectory()) {
                    this.getJson5Files(realFile, exts, filenameArr, visited);
                } else if (exts.includes(path.extname(fileName))) {
                    filenameArr.push(realFile);
                }
            }
        });
        return filenameArr;
    }
}

interface moduleJson5Module {
    type: string;
    mainElement: string;
    abilities: moduleAbility[];
}

interface moduleAbility {
    name: string;
    startWindowIcon: string;
}

interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
}