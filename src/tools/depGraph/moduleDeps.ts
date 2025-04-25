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

import { fetchDependenciesFromFile, OH_PACKAGE_JSON5 } from 'arkanalyzer';
import type { DependsNode } from 'arkanalyzer/lib/core/graph/DependsGraph';
import { Module, ModuleCategory, ModuleDepsGraph } from './moduleComponent';
import path from 'path';
import fs from 'fs';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { getModuleKind, OH_MODULES_DIR } from './utils';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'moduleDeps');

export class ModuleDeps {
    private static instance: ModuleDeps;

    private constructor() {
    }

    public static getInstance(): ModuleDeps {
        if (!this.instance) {
            this.instance = new ModuleDeps();
        }
        return this.instance;
    }

    public addDeps(depsGraph: ModuleDepsGraph, src: DependsNode<Module>): void {
        const moduleOhPkgPath = path.join(src.getNodeAttr().name, OH_PACKAGE_JSON5);
        if (moduleOhPkgPath) {
            const dstNodes: Module[] = this.getDstDeps(moduleOhPkgPath);
            dstNodes.forEach((dstNode) => {
                if (!depsGraph.hasDepsNode(dstNode.name)) {
                    const dst = depsGraph.addDepsNode(dstNode.name, dstNode);
                    const edge = depsGraph.addEdge(src, dst, { kind: 0 });
                    this.addDeps(depsGraph, dst);
                }
            });
        }
    }

    private getDstDeps(ohPkgPath: string): Module[] {
        let dstDeps: Module[] = [];
        const ohContent = fetchDependenciesFromFile(ohPkgPath);
        let depMaps: Map<string, string> = new Map();

        if (ohContent && ohContent.dependencies) {
            Object.entries(ohContent.dependencies).forEach(([name, value]) => {
                dstDeps.push(this.genDstNode(name, value as string, ohPkgPath));
            });
        }

        return dstDeps;
    }

    private genDstNode(key: string, value: string, ohPkgPath: string): Module {
        if (value.startsWith('tag:')) {
            return {
                name: path.join(path.dirname(ohPkgPath), OH_MODULES_DIR, key),
                kind: ModuleCategory.TAGGED_PACKAGE,
                tag: value.replace(/^tag:/, ''),
            };
        } else if (/^(file:|\.\/|\.\.\/)/.test(value)) {
            return this.handleLocal(key, value.replace(/^file:/, ''), ohPkgPath);
        } else if (/^[~^0-9]/.test(value)) {
            return {
                name: path.join(path.dirname(ohPkgPath), OH_MODULES_DIR, key),
                kind: ModuleCategory.THIRD_PARTY_PACKAGE,
                tag: value,
            };
        } else {
            return {
                name: `Unknown: key is ${key}, value is ${value}, module path is ${path.dirname(ohPkgPath)}.`,
                kind: ModuleCategory.UNKNOWN,
            };
        }
    }

    private handleLocal(moduleName: string, modulePath: string, ohPkgPath: string): Module {
        const moduleInstalledPath = path.join(path.dirname(ohPkgPath), OH_MODULES_DIR, moduleName);
        const originPkgPath = path.join(path.dirname(ohPkgPath), modulePath);
        const isDir = fs.statSync(originPkgPath).isDirectory();
        let moduleKind = getModuleKind(moduleInstalledPath);
        if (moduleKind === ModuleCategory.UNKNOWN && (modulePath.endsWith('.hsp') || modulePath.endsWith('.tgz'))) {
            moduleKind = ModuleCategory.HSP;
        } else if (moduleKind === ModuleCategory.UNKNOWN && (modulePath.endsWith('.har'))) {
            moduleKind = ModuleCategory.HAR;
        }
        return {
            name: isDir ? originPkgPath : moduleInstalledPath,
            kind: moduleKind,
            originPath: isDir ? undefined : originPkgPath,
        };
    }
}