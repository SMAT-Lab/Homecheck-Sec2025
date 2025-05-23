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

import {ArkFile, Scene, SceneConfig} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {buildModuleChains} from './BuildModuleChains';
import {ProjectConfig} from '../model/ProjectConfig';
import {FileUtils, WriteFileMode} from '../utils/common/FileUtils';
import {Utils} from '../utils/common/Utils';
import {buildFileDepGraph, buildModuleDepGraph} from './depGraph/builder';
import {OptionValues} from 'commander';
import {ConfigUtils} from '../Index';
import path from 'path';
import fs from 'fs';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'runTool');

export function runTool(tool: Tools, argvObj: OptionValues): void {
    const startTime = new Date().getTime();
    const projectConfig = new ProjectConfig(ConfigUtils.getConfig(argvObj.projectConfigPath));
    let depGraphOutputDir = argvObj.depGraphOutputDir;

    try {
        // 日志配置
        ConfigUtils.setLogConfig(projectConfig);
        logger.info('start to run tool...');
        const scene = buildScene(projectConfig);
        if (!scene) {
            return;
        }
        // 运行对应工具模块
        switch (tool) {
            case Tools.ImportChains:
                logger.info('start to buildModuleChains...');
                buildModuleChains(scene, [], projectConfig.reportDir);
                logger.info('buildModuleChains completed.');
                break;
            case Tools.DepGraph:
                if (!depGraphOutputDir) {
                    logger.warn('The output directory of dependency graph is not set, by default it will be set to current directory.');
                    depGraphOutputDir = './';
                }
                if (!fs.existsSync(depGraphOutputDir)) {
                    logger.error(`The given depGraphOutputDir: ${depGraphOutputDir} is not exist.`);
                    process.exit(-1);
                }
                genFileDepGraph(depGraphOutputDir, scene.getFiles());
                genModuleDepGraph(depGraphOutputDir, scene);
                break;
            default:
                logger.error(`Unknown tool: ${tool}`);
                break;
        }
    } catch (error) {
        logger.error(`Error occurred: ${(error as Error).message}`);
        return;
    }
    const endTime = new Date().getTime();
    logger.info(`HomeCheck tools took: ${(endTime - startTime) / 1000}s`);
}

function buildScene(projectConfig: ProjectConfig): Scene | null {
    try {
        // 构建SceneConfig
        const config: SceneConfig = new SceneConfig();
        const fileList = FileUtils.getAllFiles(projectConfig.projectPath, ['.ts', '.ets']);
        config.buildFromProjectFiles(projectConfig.projectName, projectConfig.projectPath, fileList, FileUtils.genSdks(projectConfig));
        logger.info('Build sceneConfig completed.');
        // 构建Scene
        const scene = new Scene();
        scene.buildSceneFromFiles(config);
        logger.info('Build scene completed.');
        scene.inferTypes();
        logger.info('Infer types completed.');
        return scene;
    } catch (error) {
        logger.error(`Build scene or infer types error: ${(error as Error).message}`);
        logger.error(`Error stack: ${(error as Error).stack}`);
        return null;
    }
}

function genFileDepGraph(outputPath: string, arkFiles: ArkFile[]): void {
    const fileDepGraphJson = path.join(outputPath, './fileDepGraph.json');
    const fileDepGraphDot = path.join(outputPath, './fileDepGraph.dot');

    logger.info('Started to build file dependency graph...');

    const depGraph = buildFileDepGraph(arkFiles);

    const jsonRes = JSON.stringify(depGraph.toJson());
    FileUtils.writeToFile(fileDepGraphJson, jsonRes, WriteFileMode.OVERWRITE);
    logger.info('Building dependency graph in json format has completed.');

    const dotRes = depGraph.dump();
    FileUtils.writeToFile(fileDepGraphDot, dotRes, WriteFileMode.OVERWRITE);
    logger.info('Building dependency graph in dot format has completed.');

    logger.info('Building file dependency graph completed.');
}

function genModuleDepGraph(outputPath: string, scene: Scene): void {
    const moduleDepGraphJson = path.join(outputPath, './moduleDepGraph.json');
    const moduleDepGraphDot = path.join(outputPath, './moduleDepGraph.dot');

    logger.info('Started to build module dependency graph...');

    const depGraph = buildModuleDepGraph(scene);

    const jsonRes = JSON.stringify(depGraph.toJson());
    FileUtils.writeToFile(moduleDepGraphJson, jsonRes, WriteFileMode.OVERWRITE);
    logger.info('Building module graph in json format has completed.');

    const dotRes = depGraph.dump();
    FileUtils.writeToFile(moduleDepGraphDot, dotRes, WriteFileMode.OVERWRITE);
    logger.info('Building module graph in dot format has completed.');

    logger.info('Building file module graph completed.');
}

export enum Tools {
    ImportChains = 0,
    DepGraph = 1,
}