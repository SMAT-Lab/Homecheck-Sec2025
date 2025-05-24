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

import type {ArkFile, ImportInfo} from 'arkanalyzer';
import type {DependsNode} from 'arkanalyzer/lib/core/graph/DependsGraph';
import type {File, FileDepsGraph, ImportInfo4Dep} from './fileComponent';

export class ArkFileDeps {
    private static instance: ArkFileDeps;

    private constructor() {
    }

    public static getInstance(): ArkFileDeps {
        if (!this.instance) {
            this.instance = new ArkFileDeps();
        }
        return this.instance;
    }

    public addDeps(depsGraph: FileDepsGraph, node: DependsNode<File>, arkFile: ArkFile): void {
        let importInfos = arkFile.getImportInfos();
        if (importInfos && importInfos.length > 0) {
            for (let importInfo of importInfos) {
                this.processImportInfo(depsGraph, node, importInfo);
            }
        }
    }

    private processImportInfo(depsGraph: FileDepsGraph, src: DependsNode<File>, importInfo: ImportInfo): void {
        const nodeAttr = this.genNodeByImportInfo(importInfo);
        if (nodeAttr) {
            const dst = depsGraph.addDepsNode(nodeAttr.name, nodeAttr);
            const edge = depsGraph.addEdge(src, dst, {kind: 0, attr: new Map()});
            depsGraph.addImportInfo2Edge(edge.getEdgeAttr(), this.simplifyImportInfo(importInfo));
        }
    }

    private genNodeByImportInfo(importInfo: ImportInfo): File | undefined {
        const lazyExport = importInfo.getLazyExportInfo();
        if (lazyExport) {
            const exportArkFile = lazyExport.getDeclaringArkFile();
            if (exportArkFile) {
                return {
                    name: exportArkFile.getFilePath(),
                    kind: 0,
                };
            }
        }
        const from = importInfo.getFrom();
        if (from?.endsWith('.so')) {
            return {
                name: importInfo.getFrom()!,
                kind: 0,
            };
        }
        if (from) {
            return {
                name: importInfo.getFrom()!,
                kind: 1,
            };
        }
        return undefined;
    }

    private simplifyImportInfo(importInfo: ImportInfo): ImportInfo4Dep {
        return {
            importClauseName: importInfo.getImportClauseName(),
            importType: importInfo.getImportType(),
            importFrom: importInfo.getFrom(),
            nameBeforeAs: importInfo.getNameBeforeAs(),
            isDefault: importInfo.isDefault(),
        };
    }
}