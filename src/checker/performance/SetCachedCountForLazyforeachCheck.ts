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

import { ArkAssignStmt, ArkInstanceFieldRef, ClassSignature, Constant, FileSignature, MethodSignature, Stmt, ViewTreeNode } from "arkanalyzer/lib";
import { ArkClass } from "arkanalyzer/lib/core/model/ArkClass";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from "../../Index";
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from "../../model/Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'SetCachedCountForLazyforeachCheck');
let warnInfo: WarnInfo = { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
const cacheCountControls: string[] = ['Grid', 'List', 'Swiper', 'WaterFlow'];
let viewTreeTool: ViewTreeTool = new ViewTreeTool();
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/set-cached-count-for-lazyforeach-check.md",
    description: "Set cachedCount to preloaded items to achieve better scrolling experience."
};
interface WarnInfo {
    lineNum: number;
    startCol: number;
    endCol: number;
    filePath: string;
};

export class SetCachedCountForLazyforeachCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly CREATE: string = 'create';
    readonly CACHED_COUNT: string = 'cachedCount';
    readonly LAZY_FOREACH: string = 'LazyForEach';
    readonly usedComponentMap: Map<ClassSignature | MethodSignature, string> = new Map();
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClazzCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        }
        return [matchClazzCb];
    }

    public check = (target: ArkClass) => {
        let fileSignature = target.getDeclaringArkFile().getFileSignature();
        if (!viewTreeTool.hasTraverse(target)) {
            let viewTreeRoot = target.getViewTree()?.getRoot();
            if (!viewTreeRoot) {
                return;
            }
            this.traverseViewTree(viewTreeRoot, fileSignature);
        }
    }

    private traverseViewTree(viewTreeRoot: ViewTreeNode, fileSignature: FileSignature) {
        let hasCachedCount = false;
        let hasLazyForeach = false;
        if (viewTreeRoot === undefined) {
            return;
        }
        let name = viewTreeRoot.name;
        if (cacheCountControls.includes(name)) {
            hasLazyForeach = this.isLazyForeach(viewTreeRoot);
            if (!hasLazyForeach) {
                return;
            }
            for (let [key, vals] of viewTreeRoot.attributes) {
                if (key === this.CREATE) {
                    this.getWarnInfoByVals(name, vals);
                } else if (key === this.CACHED_COUNT) {
                    hasCachedCount = true
                }
            }
            if (!hasCachedCount) {
                this.addIssueReport(this.issues);
            }
        }
        if (viewTreeRoot.children.length > 0) {
            this.traverseViewTreeByChild(viewTreeRoot, fileSignature);
        }
    }

    private traverseViewTreeByChild(viewTreeRoot: ViewTreeNode, fileSignature: FileSignature) {
        for (let child of viewTreeRoot.children) {
            let signature = child.signature;
            if (signature && signature instanceof ClassSignature) {
                if (fileSignature !== signature.getDeclaringFileSignature() || this.usedComponentMap.has(signature)) {
                    continue;
                }
                this.usedComponentMap.set(signature, signature.getClassName());
            } else if (signature && signature instanceof MethodSignature) {
                if (this.usedComponentMap.has(signature)) {
                    continue;
                }
                this.usedComponentMap.set(signature, signature.getMethodSubSignature().getMethodName());
            }
            this.traverseViewTree(child, fileSignature);
            if (signature && signature instanceof ClassSignature) {
                this.usedComponentMap.delete(signature);
            }
        }
    }

    private isLazyForeach(viewTreeRoot: ViewTreeNode): boolean {
        for (let child of viewTreeRoot.children) {
            let signature = child.signature;
            if (signature) {
                if (this.usedComponentMap.has(signature)) {
                    continue;
                }
                if (signature instanceof ClassSignature) {
                    this.usedComponentMap.set(signature, signature.getClassName())
                } else if (signature instanceof MethodSignature) {
                    this.usedComponentMap.set(signature, signature.getMethodSubSignature().getMethodName());
                }
            }
            if (this.isLazyForeachByChild(child)) {
                return true;
            }
            if (signature && signature instanceof ClassSignature) {
                this.usedComponentMap.delete(signature);
            }
        }
        return false;
    }

    private isLazyForeachByChild(child: ViewTreeNode): boolean {
        if (child.name === this.LAZY_FOREACH) {
            return true;
        } else if (child.children.length > 0) {
            for (let subChild of child.children) {
                if (this.isLazyForeach(subChild)) {
                    return true;
                }
            }
        }
        return false;
    }

    private getWarnInfoByVals(name: string, vals: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]]) {
        for (let val of vals) {
            if (val instanceof ArkAssignStmt) {
                this.getWarnInfo(name, val);
                break;
            }
        }
    }

    private getWarnInfo(name: string, stmt: ArkAssignStmt) {
        const arkFile = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originPosition = stmt.getOriginPositionInfo();
            warnInfo.lineNum = originPosition.getLineNo();
            warnInfo.startCol = originPosition.getColNo();
            warnInfo.endCol = warnInfo.startCol + name.length - 1;
            warnInfo.filePath = arkFile.getFilePath();
        }
    }

    private addIssueReport(issues: IssueReport[]) {
        const severity = this.rule.alert ?? this.metaData.severity;
        if (warnInfo.lineNum !== -1 && !this.isExistIssueReport(issues)) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private isExistIssueReport(defects: IssueReport[]): boolean {
        for (let defect of defects) {
            if (defect.defect.mergeKey.substring(1, defect.defect.mergeKey.indexOf('%')) === warnInfo.filePath &&
                defect.defect.reportLine === warnInfo.lineNum && defect.defect.reportColumn === warnInfo.startCol) {
                return true;
            }
        }
        return false;
    }
}