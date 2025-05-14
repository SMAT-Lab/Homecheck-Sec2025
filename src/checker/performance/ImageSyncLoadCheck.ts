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

import { ArkAssignStmt, ArkInstanceFieldRef, ArkInvokeStmt, ArkMethod, Constant, Local, MethodSignature, Stmt, ViewTreeNode } from 'arkanalyzer/lib';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MethodMatcher, MatcherCallback } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ImageSyncLoadCheck');
let viewTreeTool: ViewTreeTool = new ViewTreeTool();
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/image-sync-load-check.md',
    description: 'Asynchronous loading is recommended when a Iarge image is input.'
};

export class ImageSyncLoadCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly IMAGE: string = 'Image';
    readonly SYNCLOAD: string = 'syncLoad';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        hasViewTree: true
    };
    private mtdMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchClazzCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check
        };
        const matchMethodCb: MatcherCallback = {
            matcher: this.mtdMatcher,
            callback: this.check
        };
        return [matchClazzCb, matchMethodCb];
    }

    public check = (target: ArkClass | ArkMethod): void => {
        if (target instanceof ArkClass && !viewTreeTool.hasTraverse(target)) {
            this.obtainClassViewTree(target);
        } else if (target instanceof ArkMethod) {
            this.obtainMethodViewTree(target);
        }
    };

    private obtainClassViewTree(clazz: ArkClass): void {
        let viewTreeRoot = clazz.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return;
        }
        this.traverseViewTree(viewTreeRoot);
    }

    private obtainMethodViewTree(method: ArkMethod): void {
        let viewTreeRoot = method.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return;
        }
        this.traverseViewTree(viewTreeRoot);
    }

    private traverseViewTree(viewTreeRoot: ViewTreeNode): void {
        if (viewTreeTool.hasTraverse(viewTreeRoot)) {
            return;
        }
        if (viewTreeRoot.name === this.IMAGE) {
            for (let [key, vals] of viewTreeRoot.attributes) {
                if (key !== this.SYNCLOAD) {
                    continue;
                }
                let stmt = this.checkSyncLoadByVals(vals);
                if (stmt) {
                    this.addIssueReport(stmt);
                }
            }
        }
        if (viewTreeRoot.children.length > 0) {
            for (let child of viewTreeRoot.children) {
                this.traverseViewTree(child);
            }
        }
    }

    private checkSyncLoadByVals(vals: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]]): Stmt | null {
        let stmt: Stmt | null = null;
        for (let val of vals) {
            if (val instanceof ArkInvokeStmt) {
                stmt = val;
            } else if (val instanceof ArkAssignStmt) {
                let leftOp = val.getLeftOp();
                if (leftOp instanceof Local) {
                    stmt = leftOp.getDeclaringStmt();
                }
            } else if (val instanceof Array) {
                let value = val[0].toString();
                if (value === 'true') {
                    return stmt;
                }
            }
        }
        return null;
    }

    private addIssueReport(stmt: Stmt): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt);
        if (warnInfo) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(stmt: Stmt): {
        lineNum: number;
        startCol: number;
        endCol: number;
        filePath: string;
    } | undefined {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            let text = stmt.getOriginalText();
            let startCol = 0;
            if (!text || text?.length === 0) {
                return undefined;
            }
            let checkText = '.syncLoad(true)';
            let originalTexts = text.split('\n');
            let lineCount = -1;
            for (let originalText of originalTexts) {
                lineCount++;
                if (!originalText.includes(checkText)) {
                    continue;
                }
                if (lineCount === 0) {
                    startCol = originalText.indexOf(checkText) + originPosition.getColNo();
                } else {
                    startCol = originalText.indexOf(checkText) + 1;
                }
                let endCol = startCol + checkText.length - 1;
                let lineNum = line + lineCount;
                const originPath = arkFile.getFilePath();
                return { lineNum, startCol, endCol, filePath: originPath };
            }
        } else {
            logger.debug('ArkFile is null.');
        }
        return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}