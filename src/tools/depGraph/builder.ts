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

import {ArkFile, BUILD_PROFILE_JSON5, parseJsonText, Scene} from 'arkanalyzer';
import {File, FileDepsGraph} from './fileComponent';
import {ArkFileDeps} from './fileDeps';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {Module, ModuleDepsGraph} from './moduleComponent';
import {ModuleDeps} from './moduleDeps';
import {getModuleKind} from './utils';
import path from 'path';
import fs from 'fs';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'DepGraph');

export function buildFileDepGraph(arkFiles: ArkFile[]): FileDepsGraph {
    let depGraph: FileDepsGraph = new FileDepsGraph();
    let arkFileDeps = ArkFileDeps.getInstance();
    arkFiles.forEach(arkFile => {
        const nodeAttr: File = {
            name: arkFile.getFilePath(),
            kind: 0,
        };
        let srcNode = depGraph.addDepsNode(arkFile.getFilePath(), nodeAttr);
        arkFileDeps.addDeps(depGraph, srcNode, arkFile);
    });
    return depGraph;
}

export function buildModuleDepGraph(scene: Scene): ModuleDepsGraph {
    let moduleGraph: ModuleDepsGraph = new ModuleDepsGraph();
    let moduleDeps: ModuleDeps = ModuleDeps.getInstance();
    const modules = getModules(scene.getRealProjectDir());
    modules.forEach((modulePath) => {
        logger.info(`Project module: ${modulePath} found.`);
        const nodeAttr: Module = {
            name: modulePath,
            kind: getModuleKind(modulePath),
        };
        if (!moduleGraph.hasDepsNode(modulePath)) {
            let srcNode = moduleGraph.addDepsNode(modulePath, nodeAttr);
            moduleDeps.addDeps(moduleGraph, srcNode);
        }
    });
    return moduleGraph;
}

function getModules(projectPath: string): string[] {
    const buildProfile = path.join(projectPath, BUILD_PROFILE_JSON5);
    let modulePaths: string[] = [];
    if (fs.existsSync(buildProfile)) {
        let configurationsText: string;
        try {
            configurationsText = fs.readFileSync(buildProfile, 'utf-8');
        } catch (error) {
            logger.error(`Error reading file: ${error}`);
            return modulePaths;
        }
        const buildProfileJson = parseJsonText(configurationsText);
        const modules = buildProfileJson.modules;
        if (modules instanceof Array) {
            modules.forEach((module) => {
                modulePaths.push(path.resolve(projectPath, module.srcPath as string));
            });
        }
    } else {
        logger.warn('There is no build-profile.json5 for this project.');
    }
    return modulePaths;
}