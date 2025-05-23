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

import {DependsGraph, DependsNode} from 'arkanalyzer/lib/core/graph/DependsGraph';
import {GraphPrinter} from 'arkanalyzer';

export enum ModuleCategory {
    ENTRY = 0,
    FEATURE = 1,
    HAR = 2,
    HSP = 3,
    THIRD_PARTY_PACKAGE = 4,
    TAGGED_PACKAGE = 5,
    UNKNOWN = -1,
}

export interface ModuleCategoryType {
    name: string;
    id: number;
}

export function getComponentCategories(): ModuleCategoryType[] {
    return Object.entries(ModuleCategory)
        .filter((e) => !isNaN(e[0] as any))
        .map((e) => ({name: e[1] as string, id: parseInt(e[0])}));
}

export interface Module {
    id?: number;
    name: string;
    version?: number;
    files?: Set<string>;
    kind: ModuleCategory;
    tag?: string;
    originPath?: string;//for .har, .tgz, .hsp
}

export interface ModuleEdgeAttr {
    kind: 0;
}

export class ModuleDepsGraph extends DependsGraph<Module, ModuleEdgeAttr> {
    public constructor() {
        super();
    }

    public toJson(): { nodes: Module[]; edges: any[]; categories: {} } {
        return {
            categories: getComponentCategories(),
            nodes: Array.from(this.getNodesIter()).map((value) => {
                let module = (value as DependsNode<Module>).getNodeAttr() as Module;
                module.id = (value as DependsNode<Module>).getID();
                return module;
            }),
            edges: Array.from(this.edgesMap.values()).map((value) => {
                return {
                    source: value.getSrcID(),
                    target: value.getDstID()
                };
            }),
        };
    }

    public dump(): string {
        return new GraphPrinter<this>(this).dump();
    }

    getGraphName(): string {
        return 'Module Dependency Graph';
    }
}
