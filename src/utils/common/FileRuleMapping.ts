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

import { ArkFile } from "arkanalyzer";
import { CheckEntry } from "./CheckEntry";
import { ConfigUtils } from "./ConfigUtils";
import { CheckerUtils } from "../checker/CheckerUtils";
import { file2CheckRuleMap, project2CheckRuleMap } from "./CheckerIndex";
import { Rule } from "../../model/Rule";
import { RuleConfig } from "../../model/RuleConfig";
import { fileCheckBuilder, projectCheckBuilder } from "./CheckBuilder";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileUtils } from "./FileUtils";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'fileRuleMapping');

export async function fileRuleMapping(checkFileList: string[], checkEntry: CheckEntry): Promise<boolean> {
    // 获取规则配置文件的规则，除了override
    const allRulesMap = ConfigUtils.getRuleMap(checkEntry.ruleConfig, checkEntry.projectConfig, checkEntry.message);
    if (allRulesMap.size === 0) {
        checkEntry.message?.progressNotify(1, "No rule to check");
        return false;
    }

    let arkFiles: ArkFile[] = [];
    const fiRulesMap: Map<string, Rule> = new Map();
    const fileRulesMap = await createFileRulesMap(checkFileList, allRulesMap, checkEntry, file2CheckRuleMap, fiRulesMap);
    for (const filePath of checkFileList) {
        try {
            const arkFile = CheckerUtils.getArkFileByFilePath(checkEntry.scene, filePath);
            if (!arkFile) {
                continue;
            }

            arkFiles.push(arkFile);
            const enabledRules = fileRulesMap.get(filePath);
            if (enabledRules) {
                checkEntry.addFileCheck(fileCheckBuilder(arkFile, enabledRules));
            }
        } catch (error) {
            logger.error(`Error processing file ${filePath}: ${(error as Error).message}`);
        }
    }

    const proRulesMap: Map<string, Rule> = new Map();
    const projectRulesMap = await createFileRulesMap(checkFileList, allRulesMap, checkEntry, project2CheckRuleMap, proRulesMap);
    const projectRules = Array.from(proRulesMap.values());
    try {
        checkEntry.addProjectCheck(projectCheckBuilder(arkFiles, projectRules));
        checkEntry.projectCheck.ruleMap = projectRulesMap;
    } catch (error) {
        logger.error(`Error adding project check: ${(error as Error).message}`);
    }
    return true;
}

function filterRule(allRulesMap: Map<string, Rule>, filterMap?: Map<string, Rule[]>): Rule[] {
    const rules: Rule[] = [];
    for (const [key, value] of allRulesMap) {
        if (filterMap && !filterMap.has(key)) {
            continue;
        }
        rules.push(value);
    }
    return rules;
}

async function createFileRulesMap(allFiles: string[], allRulesMap: Map<string, Rule>, checkEntry: CheckEntry,
    checksRuleMap: Map<string, any>, proRulesMap: Map<string, Rule>): Promise<Map<string, Rule[]>> {
    // 获取配置的规则列表
    let fileRulesMap: Map<string, Rule[]> = new Map();
    const ruleMap = filterRule(allRulesMap, checksRuleMap);

    const defaultRules = Array.from(ruleMap.values());
    allFiles.forEach(filePath => fileRulesMap.set(filePath, defaultRules));
    ruleMap.forEach(rule => {
        proRulesMap.set(rule.ruleId, rule);
    });
    // 检查额外规则覆盖
    for (const override of checkEntry.ruleConfig.overrides ?? []) {
        try {
            const overrideFileRulesMap = await createFileRulesMapWithOverride(checkEntry, override, checksRuleMap, proRulesMap);
            fileRulesMap = mergeFileRulesMap(fileRulesMap, overrideFileRulesMap);
        } catch (error) {
            logger.error(`Error check extra rule overrides: ${(error as Error).message}`);
        }
    }
    return fileRulesMap;
}

async function createFileRulesMapWithOverride(checkEntry: CheckEntry, override: RuleConfig,
    checksRuleMap: Map<string, any>, proRulesMap: Map<string, Rule>): Promise<Map<string, Rule[]>> {
    let checkFileList = checkEntry.selectFileList.map(file => file.filePath);
    if (checkFileList.length === 0) {
        checkFileList = FileUtils.getAllFiles(checkEntry.projectConfig.projectPath, ['.ts', '.ets', '.json5']);
    }
    checkFileList = await FileUtils.getFiltedFiles(checkFileList, override);
    const allRuleMap = ConfigUtils.getRuleMap(override, checkEntry.projectConfig, checkEntry.message);
    const ruleMap = filterRule(allRuleMap, checksRuleMap);
    ruleMap.forEach(rule => {
        if (!proRulesMap.has(rule.ruleId)) {
            proRulesMap.set(rule.ruleId, rule);
        }
    });
    const fileRulesMap: Map<string, Rule[]> = new Map();
    const defaultRules = Array.from(ruleMap.values());
    checkFileList.forEach(filePath => fileRulesMap.set(filePath, defaultRules));
    return fileRulesMap;
}

function mergeFileRulesMap(fileRulesMap: Map<string, Rule[]>,
    overrideFileRulesMap: Map<string, Rule[]>): Map<string, Rule[]> {
    // 取fileRule和overrideRule交集
    for (const [key, vals] of overrideFileRulesMap) {
        if (!fileRulesMap.has(key) || vals.length === 0) {
            continue;
        }
        let fileRules = fileRulesMap.get(key);
        if (!fileRules || fileRules.length === 0) {
            fileRulesMap.set(key, vals);
            continue;
        }
        let newRules = [...fileRules];
        vals.forEach(val => {
            let existIndex = fileRules?.findIndex(fileRule => fileRule.ruleId === val.ruleId);
            if (existIndex === undefined || existIndex === -1) {
                newRules.push(val);
            } else {
                newRules[existIndex] = val;
            }
        });
        fileRulesMap.set(key, newRules);
    }
    // 筛除关闭的rule
    const filteredRulesMap = new Map<string, Rule[]>();
    for (const [key, rules] of fileRulesMap) {
        const filteredRules = rules.filter(rule => rule.alert !== 0);
        filteredRulesMap.set(key, filteredRules);
    }
    return filteredRulesMap;
}