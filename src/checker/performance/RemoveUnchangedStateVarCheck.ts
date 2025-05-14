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

import { ArkAssignStmt, ArkField, ArkFile, ArkInstanceFieldRef, ClassSignature, PrimitiveType, ViewTreeNode } from 'arkanalyzer/lib';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'RemoveUnchangedStateVarCheck');
const viewTreeTool = new ViewTreeTool();
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/remove-unchanged-state-var-check.md',
    description: 'Consider use unstate variable.'
};

export class RemoveUnchangedStateVarCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
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
        };
        return [matchClazzCb];
    }

    public check = (target: ArkClass): void => {
        if (viewTreeTool.hasTraverse(target)) {
            return;
        }
        for (let arkField of target.getFields()) {
            if (!arkField.hasDecorator('State')) {
                continue;
            }
            let isModified = this.isStateVarModified(target, arkField);
            if (!isModified) {
                this.addIssueReport(target, arkField);
            }
        }
    };

    private isStateVarModified(clazz: ArkClass, arkField: ArkField): boolean {
        let isModified = this.isModifiedByCurrentClass(clazz, arkField);
        if (isModified) {
            return true;
        }
        if (!this.isPrimitiveType(arkField)) {
            return true;
        }
        let viewTreeRoot = clazz.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return false;
        }
        const arkFile = clazz.getDeclaringArkFile();
        return this.traverseViewTree(arkFile, viewTreeRoot, arkField);
    }

    private isModifiedByCurrentClass(clazz: ArkClass, arkField: ArkField): boolean {
        let methods = clazz.getMethods();
        for (let method of methods) {
            let stmts = method.getCfg()?.getStmts();
            if (!stmts) {
                continue;
            }
            for (let stmt of stmts) {
                if (!(stmt instanceof ArkAssignStmt)) {
                    continue;
                }
                let leftOp = stmt.getLeftOp();
                if (!(leftOp instanceof ArkInstanceFieldRef)) {
                    continue;
                }
                if (leftOp.getFieldSignature().toString() === arkField.getSignature().toString()) {
                    return true;
                }
            }
        }
        return false;
    }

    private isPrimitiveType(arkField: ArkField): boolean {
        let type = arkField.getType();
        if (type instanceof PrimitiveType) {
            return true;
        } else {
            return false;
        }
    }

    private traverseViewTree(arkFile: ArkFile, viewTreeRoot: ViewTreeNode, arkField: ArkField): boolean {
        if (viewTreeRoot === undefined || viewTreeRoot === null) {
            return false;
        }
        if (viewTreeRoot.isCustomComponent()) {
            let valuesTransferMap = viewTreeRoot.stateValuesTransfer;
            if (!valuesTransferMap) {
                return false;
            }
            for (let [key, value] of valuesTransferMap) {
                if (!(value instanceof ArkField)) {
                    continue;
                }
                if (value !== arkField) {
                    continue;
                }
                let signature = viewTreeRoot.signature;
                if (!signature) {
                    continue;
                }
                if (!(signature instanceof ClassSignature)) {
                    continue;
                }
                let clazz = arkFile.getScene().getClass(signature);
                if (!clazz) {
                    continue;
                }
                return this.isStateVarModified(clazz, key);
            }
        } else {
            for (let child of viewTreeRoot.children) {
                if (child.children.length === 0) {
                    continue;
                }
                return this.traverseViewTree(arkFile, child, arkField);
            }
        }
        return false;
    }

    private addIssueReport(target: ArkClass, arkField: ArkField): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(target, arkField);
        if (warnInfo) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(target: ArkClass, arkField: ArkField): {
        lineNum: number;
        startCol: number;
        endCol: number;
        filePath: string;
    } {
        const originPosition = arkField.getOriginPosition();
        const lineNum = originPosition.getLineNo();
        const arkFile = target.getDeclaringArkFile();
        if (arkFile) {
            const filedName = arkField.getName();
            const lineCode = arkField.getCode();
            const startCol = originPosition.getColNo() + lineCode.indexOf(filedName);
            const endCol = startCol + filedName.length - 1;
            const originPath = arkFile.getFilePath();
            return { lineNum, startCol, endCol, filePath: originPath };
        } else {
            logger.debug('ArkFile is null.');
        }
        return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}