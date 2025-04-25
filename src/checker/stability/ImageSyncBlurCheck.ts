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

import { ArkAssignStmt, ArkField, ArkFile, ArkInstanceFieldRef, ArkNewExpr, ArkStaticFieldRef, ClassType, Constant, Local, MethodSignature, Stmt, ViewTreeNode } from 'arkanalyzer/lib';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback, CheckerUtils } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ImageSyncBlurCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/image-sync-blur-check.md',
    description: 'Static images should use the correct color picking method.'
};
const DEFAULT_SIGNATURE: string = '@ohosSdk/component/common.d.ts: AdaptiveColor.[static]DEFAULT';
const ADAPTIVE_COLOR: string = 'adaptiveColor';
const IMAGE_BLUR: string = 'Image';
const BLUR_STYLE: string = 'foregroundBlurStyle';
let viewTreeTool: ViewTreeTool = new ViewTreeTool();

export class ImageSyncBlurCheck implements BaseChecker {
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

    public check = (arkClass: ArkClass): void => {
        let viewTreeRoot = arkClass.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return;
        }
        this.traverseViewTree(viewTreeRoot, arkClass);
    };

    private traverseViewTree(viewTreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        if (viewTreeTool.hasTraverse(viewTreeRoot)) {
            return;
        }
        if (viewTreeRoot.name === IMAGE_BLUR) {
            for (let [key, vals] of viewTreeRoot.attributes) {
                if (key !== BLUR_STYLE) {
                    continue;
                }
                this.checkSyncBlurByVals(vals, arkClass);
            }
        }
        if (viewTreeRoot.children.length > 0) {
            for (let child of viewTreeRoot.children) {
                this.traverseViewTree(child, arkClass);
            }
        }
    }

    private checkSyncBlurByVals(vals: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]], arkClass: ArkClass): void {
        let invoker = CheckerUtils.getInvokeExprFromStmt(vals[0]);
        if (!invoker) {
            return;
        }
        let arg = invoker.getArg(1);
        if (arg instanceof Local) {
            let stmt = arg.getDeclaringStmt();
            if (stmt) {
                this.traversalLocals(stmt);
            } else {
                this.traversalDefaultClass(arkClass.getDeclaringArkFile(), arg.getName());
            }
        }
    }

    private traversalLocals(declaringStmt: Stmt): void {
        let method = declaringStmt.getCfg().getDeclaringMethod();
        if (!(declaringStmt instanceof ArkAssignStmt)) {
            return;
        }
        let rightOp = declaringStmt.getRightOp();
        if (rightOp instanceof Local || rightOp instanceof ArkNewExpr) {
            let type = rightOp.getType();
            if (!(type instanceof ClassType)) {
                return;
            }
            let arkClass = method.getDeclaringArkFile().getScene().getClass(type.getClassSignature());
            let fields = arkClass?.getFields();
            if (!fields) {
                return;
            }
            this.checkFieldsForAdaptiveColor(fields);
        } else if (rightOp instanceof ArkInstanceFieldRef) {
            let field = method.getDeclaringArkClass().getField(rightOp.getFieldSignature());
            if (!field) {
                return;
            }
            let initializer = field.getInitializer()[0];
            this.traversalLocals(initializer);
        }
    }

    private traversalDefaultClass(arkFile: ArkFile, name: string): void {
        let defaultClass = arkFile.getDefaultClass();
        let method = defaultClass.getMethods()[0];
        let locals = method.getBody()?.getLocals();
        if (!locals) {
            return;
        }
        for (let [key, value] of locals) {
            if (!(value instanceof Local)) {
                continue;
            }
            if (key !== name) {
                continue;
            }
            let declaringStmt = value.getDeclaringStmt();
            if (!declaringStmt) {
                return;
            }
            this.traversalLocals(declaringStmt);
        }
    }

    private checkFieldsForAdaptiveColor(fields: ArkField[]): void {
        for (const field of fields) {
            let name = field.getName();
            if (name !== ADAPTIVE_COLOR) {
                continue;
            }
            let initializer = field.getInitializer()[0];
            if (initializer instanceof ArkAssignStmt) {
                let rightOp = initializer.getRightOp();
                if (!(rightOp instanceof ArkStaticFieldRef)) {
                    continue;
                }
                if (rightOp.getFieldSignature().toString() !== DEFAULT_SIGNATURE) {
                    this.reportIssue(field, name);
                }
            }
        }
    }

    private reportIssue(field: ArkField, name: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = field.getDeclaringArkClass().getDeclaringArkFile().getFilePath();
        let lineNum = field.getOriginPosition().getLineNo();
        let startColum = field.getOriginPosition().getColNo();
        let endColumn = startColum + name.length - 1;
        let defects = new Defects(lineNum, startColum, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}