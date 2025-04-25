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

import { ArkFile, ArkInstanceFieldRef, ArkMethod, Constant, FunctionType, MethodSignature, Scene, Stmt, UNKNOWN_FILE_NAME, UNKNOWN_PROJECT_NAME, Value, ViewTreeNode } from "arkanalyzer";
import { ArkClass } from "arkanalyzer/lib/core/model/ArkClass";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { CheckerStorage, CheckerUtils, ClassMatcher, Defects, MatcherCallback, MatcherTypes, Rule } from "../../Index";
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from "../../model/Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'JsCodeCacheByPrecompileCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: "docs/js-code-cache-by-precompile-check.md",
    description: 'Pre-compile JavaScript into bytecode in the ' +
        'onControllerAttached phase of the Web component for faster page loading.'
};
const webSet: Set<string> = new Set<string>(['onControllerAttached']);
const ABOUT_TO_APPEAR: string = 'aboutToAppear';
const precompileJavaScriptSignature = '@ohosSdk/api/@ohos.web.webview.d.ts: webview.WebviewController.precompileJavaScript(string, string|Uint8Array, @ohosSdk/api/@ohos.web.webview.d.ts: webview.CacheOptions)';
const MIN_VERSION = 12;

export class JsCodeCacheByPrecompileCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private viewTreeTool: ViewTreeTool = new ViewTreeTool();

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
        let api = CheckerStorage.getInstance().getApiVersion();
        if (api < MIN_VERSION) {
            return;
        }
        if (this.viewTreeTool.hasTraverse(arkClass)) {
            return;
        }
        const viewtreeRoot = arkClass.getViewTree()?.getRoot();
        if (!viewtreeRoot) {
            return;
        }
        this.traverseViewTree(viewtreeRoot, arkClass, arkClass.getDeclaringArkFile().getScene());
    }

    private traverseViewTree(viewtreeRoot: ViewTreeNode, arkClass: ArkClass, scene: Scene): void {
        if (!viewtreeRoot) {
            return;
        }
        let name = viewtreeRoot.name;
        if (name === 'Web') {
            this.webOperation(viewtreeRoot, arkClass, scene);
        }
        if (viewtreeRoot.children.length > 0) {
            for (let child of viewtreeRoot.children) {
                let classSignature = child.signature;
                if (classSignature && child.isCustomComponent()) {
                    continue;
                }
                this.traverseViewTree(child, arkClass, scene);
            }
        }
    }

    private webOperation(viewtreeRoot: ViewTreeNode, arkClass: ArkClass, scene: Scene): void {
        let hasJsInValue = false;
        for (let [key, vals] of viewtreeRoot.attributes) {
            if (!webSet.has(key)) {
                continue;
            }
            if (this.isHasJSInValue(vals, scene)) {
                hasJsInValue = true;
                return;
            }
        }
        if (!hasJsInValue && !this.findSymbolInAboutToAppear(arkClass, scene)) {
            this.setReportIssue(arkClass, viewtreeRoot);
        }
    }

    private findSymbolInAboutToAppear(arkClass: ArkClass, scene: Scene): boolean {
        const methods = arkClass.getMethods();
        for (let method of methods) {
            const methodName = method.getName();
            if (methodName === ABOUT_TO_APPEAR) {
                let busyMethods = new Set<MethodSignature>();
                return this.findSymbolInMethod(method, scene, busyMethods);
            }
        }
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

    private isHasJSInValue(values: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]], scene: Scene): boolean {
        let value = values[0];
        let invokeExpr = CheckerUtils.getInvokeExprFromStmt(value);
        if (!invokeExpr) {
            return false;
        }
        let args = invokeExpr.getArgs();
        if (args.length === 0) {
            return false;
        }
        let arg = args[0];
        let type = arg.getType();
        if (!(type instanceof FunctionType)) {
            return false;
        }
        let invokeMethod = scene.getMethod(type.getMethodSignature());
        if (!invokeMethod) {
            return false;
        }
        let busyMethods = new Set<MethodSignature>();
        if (this.findSymbolInMethod(invokeMethod, scene, busyMethods)) {
            return true;
        }
        return false;
    }

    private findSymbolInMethod(arkMethod: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>): boolean {
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
            if (invokeSignatureStr === precompileJavaScriptSignature) {
                return true;
            } else {
                this.findSymbolInInvokeStmt(stmt, scene, busyMethods);
                let invokeMethod = scene.getMethod(invokeSignature);
                if (invokeMethod === null) {
                    continue;
                }
                if (this.findSymbolInMethod(invokeMethod, scene, busyMethods)) {
                    return true;
                }
            }
        }
        busyMethods.delete(curMethodSignature);
        return false;
    }

    private findSymbolInInvokeStmt(stmt: Stmt, scene: Scene, busyMethods: Set<MethodSignature>): void {
        let invokeArgs = CheckerUtils.getInvokeExprFromStmt(stmt)?.getArgs();
        if (invokeArgs) {
            this.findSymbolInArgs(invokeArgs, scene, busyMethods);
        }
    }

    private findSymbolInArgs(invokeArgs: Value[], scene: Scene, busyMethods: Set<MethodSignature>): void {
        for (let arg of invokeArgs) {
            let type = arg.getType();
            if (!(type instanceof FunctionType)) {
                continue;
            }
            let methodSignature = type.getMethodSignature();
            let anonyMouseMethod = scene.getMethod(methodSignature);
            if (anonyMouseMethod === null || busyMethods.has(anonyMouseMethod.getSignature())) {
                continue;
            }
            this.findSymbolInMethod(anonyMouseMethod, scene, busyMethods);
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