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

export enum FileCategory {
    FILE = 0,
    PKG = 1,
    SO = 2,
    UNKNOWN = -1,
}

export interface FileCategoryType {
    name: string;
    id: number;
}

export function getComponentCategories(): FileCategoryType[] {
    return Object.entries(FileCategory)
        .filter((e) => !isNaN(e[0] as any))
        .map((e) => ({name: e[1] as string, id: parseInt(e[0])}));
}

export interface File {
    id?: number;
    name: string;
    version?: number;
    files?: Set<string>;
    kind: FileCategory;
    tag?: string;
}

export interface ImportInfo4Dep {
    importClauseName: string;
    importType: string;
    importFrom?: string;
    nameBeforeAs?: string;
    isDefault?: boolean;
}

export interface FileEdgeAttr {
    kind: 0;
    // import clause name + import type, import info
    attr: Map<string, ImportInfo4Dep>;
}

export class FileDepsGraph extends DependsGraph<File, FileEdgeAttr> {
    public constructor() {
        super();
    }

    addImportInfo2Edge(edge: FileEdgeAttr, importInfo: ImportInfo4Dep): void {
        const attrKey = `${importInfo.importClauseName} + ${importInfo.importType}`;
        edge.attr.set(attrKey, importInfo);
    }

    public toJson(): { nodes: File[]; edges: any[]; categories: {} } {
        return {
            categories: getComponentCategories(),
            nodes: Array.from(this.getNodesIter()).map((value) => {
                let pkg = (value as DependsNode<File>).getNodeAttr() as File;
                pkg.id = (value as DependsNode<File>).getID();
                return pkg;
            }),
            edges: Array.from(this.edgesMap.values()).map((value) => {
                return {
                    source: value.getSrcID(),
                    target: value.getDstID(),
                    attr: Array.from(value.getEdgeAttr().attr.values())
                };
            }),
        };
    }

    public dump(): string {
        return new GraphPrinter<this>(this).dump();
    }

    getGraphName(): string {
        return 'File Dependency Graph';
    }
}
