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

import { ArkClass, ArkFile, ArkMethod, FunctionType, Local, MethodSignature, Scene, Stmt, UNKNOWN_FILE_NAME, UNKNOWN_PROJECT_NAME, ViewTreeNode } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback, CheckerUtils } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'WebOnActiveCheck');
let viewTreeTool: ViewTreeTool = new ViewTreeTool();
const WEB: string = 'Web';
const onPageBegin: string = 'onPageBegin';
const onFirstMeaningfulPaint: string = 'onFirstMeaningfulPaint';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/web-on-active-check.md',
    description: 'Call the API to stop rendering of a web page after its first render is complete.'
};
const onActiveSignature = '@ohosSdk/api/@ohos.web.webview.d.ts: webview.WebviewController.onActive()';
const onInActiveSignature = '@ohosSdk/api/@ohos.web.webview.d.ts: webview.WebviewController.onInactive()';

export class WebOnActiveCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private buildMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
        hasViewTree: true
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    }

    public check = (arkClass: ArkClass) => {
        if (viewTreeTool.hasTraverse(arkClass)) {
            return;
        }
        const viewtreeRoot = arkClass.getViewTree()?.getRoot();
        if (!viewtreeRoot) {
            return;
        }
        this.traverseViewTree(viewtreeRoot, arkClass);
    }

    private traverseViewTree(viewtreeRoot: ViewTreeNode, arkClass: ArkClass): void {
        if (viewtreeRoot === undefined || viewTreeTool.hasTraverse(viewtreeRoot)) {
            return;
        }
        let name = viewtreeRoot.name;
        if (name === WEB) {
            if (this.isHasActive(viewtreeRoot, arkClass, onActiveSignature, onPageBegin) &&
                !this.isHasActive(viewtreeRoot, arkClass, onInActiveSignature, onFirstMeaningfulPaint)) {
                this.setReportIssue(arkClass, viewtreeRoot);
            }
        }
        if (viewtreeRoot.children.length > 0) {
            for (let child of viewtreeRoot.children) {
                let classSignature = child.signature;
                if (classSignature && child.isCustomComponent()) {
                    continue;
                }
                this.traverseViewTree(child, arkClass);
            }
        }
    }

    private isHasActive(viewtreeRoot: ViewTreeNode, arkClass: ArkClass, signatureStr: string,
        attribute: string): boolean {
        let vals = viewtreeRoot.attributes.get(attribute);
        if (!vals) {
            return false;
        }
        let stmt = vals[0];
        let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invokeExpr) {
            return false;
        }
        let arg = invokeExpr.getArg(0);
        if (!(arg instanceof Local)) {
            return false;
        }
        let type = arg.getType();
        if (!(type instanceof FunctionType)) {
            return false;
        }
        let signature = type.getMethodSignature();
        let scene = arkClass.getDeclaringArkFile().getScene();
        let method = scene.getMethod(signature);
        if (!method) {
            return false;
        }
        let busyMethods = new Set<MethodSignature>();
        return this.findSymbolInMethod(method, scene, busyMethods, signatureStr);
    }

    private findSymbolInMethod(arkMethod: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>,
        signature: string): boolean {
        const stmts = arkMethod.getBody()?.getCfg()?.getStmts();
        if (!stmts) {
            return false;
        }
        const curMethodSignature = arkMethod.getSignature();
        busyMethods.add(curMethodSignature);
        for (let stmt of stmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            const invokeSignature = invokeExpr.getMethodSignature();
            let invokeSignatureStr = invokeSignature.toString();
            if (busyMethods.has(invokeSignature) || invokeSignatureStr.includes(`@${UNKNOWN_PROJECT_NAME}/${UNKNOWN_FILE_NAME}`)) {
                continue;
            }
            if (invokeSignatureStr === signature) {
                return true;
            } else {
                let invokeMethod = scene.getMethod(invokeSignature);
                if (invokeMethod === null) {
                    continue;
                }
                if (this.findSymbolInMethod(invokeMethod, scene, busyMethods, signature)) {
                    return true;
                }
            }
        }
        busyMethods.delete(curMethodSignature);
        return false;
    }

    private setReportIssue(arkClass: ArkClass, viewtreeRoot: ViewTreeNode): void {
        let arkFile = arkClass.getDeclaringArkFile();
        for (let [key, vals] of viewtreeRoot.attributes) {
            if (key !== 'create') {
                continue;
            }
            let stmt = vals[0];
            this.reportIssue(arkFile, stmt);
        }
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt | undefined) {
        if (!stmt) {
            return;
        }
        const filePath = arkFile.getFilePath();
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let startColumn = -1;
        let endColumn = -1;
        const orgStmtStr = stmt.getOriginalText();
        if (orgStmtStr && orgStmtStr.length !== 0) {
            startColumn = originalPosition.getColNo() + orgStmtStr.indexOf('Web');
            endColumn = startColumn + 'Web'.length - 1;
        }
        if (startColumn === -1) {
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}