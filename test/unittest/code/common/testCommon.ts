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

import * as fs from 'node:fs';
import * as path from "node:path";
import { Scene } from 'arkanalyzer';
import { SceneConfig, Sdk } from 'arkanalyzer/lib/Config';
import { Rule } from '../../../../src/Index';
import { File2Check } from '../../../../src/model/File2Check';
import { Project2Check } from '../../../../src/model/Project2Check';
import { CheckEntry } from '../../../../src/utils/common/CheckEntry';

// 枚举，用于指定检查模式
export enum CHECK_MODE {
    FILE2CHECK,
    PROJECT2CHECK
}

/*
 * 测试用例检查入口，用于测试单个checker的规则检查
 * @param projectPath 项目路径
 * @param rule 规则对象
 * @param checkMode 检查模式，枚举CHECK_MODE
 * @param checker 需要测试的checker类
 * @returns CheckEntry 检查入口对象，可通过该对象的issues属性获取检查结果
 */
export async function testCaseCheck(projectPath: string, rule: Rule, checkMode: CHECK_MODE, checker: any, needScope: boolean = false): Promise<CheckEntry> {
    const checkEntry = new CheckEntry();
    checkEntry.scene = buildScene(projectPath);
    if (needScope) {
        checkEntry.buildScope();
    }
    if (checkMode === CHECK_MODE.FILE2CHECK) {
        genFile2Check(checkEntry, rule, checker);
    } else {
        genProject2Check(checkEntry, rule, checker);
    }
    await checkEntry.runAll();
    return checkEntry;
}

function genFile2Check(checkEntry: CheckEntry, rule: Rule, checker: any) {
    for (const arkFile of checkEntry.scene.getFiles()) {
        const checkIns = new File2Check();
        checkIns.arkFile = arkFile;
        const checkerIns = new checker();
        checkerIns.rule = rule;
        checkIns.addChecker(rule.ruleId, checkerIns);
        checkEntry.addFileCheck(checkIns);
    }
}

function genProject2Check(checkEntry: CheckEntry, rule: Rule, checker: any) {
    const projectCheck = new Project2Check();
    const checkerIns = new checker();
    checkerIns.rule = rule;
    projectCheck.arkFiles = checkEntry.scene.getFiles();
    projectCheck.addChecker(rule.ruleId, checkerIns);
    checkEntry.addProjectCheck(projectCheck);
}

function buildScene(projectPath: string): Scene {
    const config: SceneConfig = new SceneConfig();
    config.buildConfig('arkCheckTest', projectPath, genSdks());
    config.buildFromProjectDir(projectPath);
    const scene = new Scene();
    scene.buildSceneFromProjectDir(config);
    scene.inferTypes();
    return scene;
}

function genSdks(): Sdk[] {
    let sdks: Sdk[] = [];
    const sdkConfigPath = path.resolve('./resources/sdkConfig.json');
    if (fs.existsSync(sdkConfigPath)) {
        const configurations = JSON.parse(fs.readFileSync(sdkConfigPath, 'utf-8'));
        sdks = configurations.sdks ?? [];
    }
    for(let sdk of sdks) {
        if (sdk.name === 'ohosSdk') {
            sdk.path = './test/unittest/sdks/ohosSdk';
        } else if (sdk.name === 'hmsSdk') {
            sdk.path = './test/unittest/sdks/hmsSdk';
        }
    }
    return sdks;
}

/*
 * 测试用例检查入口，用于测试单个checker的规则检查,支持module
 * @param projectPath 项目路径
 * @param rule 规则对象
 * @param checkMode 检查模式，枚举CHECK_MODE
 * @param checker 需要测试的checker类
 * @param checker 是否需要scope，默认为false
 * @returns CheckEntry 检查入口对象，可通过该对象的issues属性获取检查结果
 */
export async function testCaseCheckDedicated(projectPath: string, rule: Rule, checkMode: CHECK_MODE, checker: any,
    needScope: boolean = false): Promise<CheckEntry> {
    const checkEntry = new CheckEntry();
    checkEntry.scene = buildSceneDedicated(projectPath);
    if (needScope) {
        checkEntry.buildScope();
    }
    if (checkMode === CHECK_MODE.FILE2CHECK) {
        genFile2Check(checkEntry, rule, checker);
    } else {
        genProject2Check(checkEntry, rule, checker);
    }
    await checkEntry.runAll();
    return checkEntry;
}

function buildSceneDedicated(projectPath: string): Scene {
    const config: SceneConfig = new SceneConfig();
    config.buildConfig('arkCheckTest', projectPath, genSdks());
    config.buildFromProjectDir(projectPath);
    const scene = new Scene();
    scene.buildBasicInfo(config);
    scene.buildScene4HarmonyProject();
    scene.inferTypes();
    return scene;
}