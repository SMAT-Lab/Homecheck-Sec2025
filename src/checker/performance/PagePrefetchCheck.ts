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

import { ArkAssignStmt, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkInvokeStmt, ArkMethod, Constant, FunctionType, MethodSignature, Scene, Stmt, Value, ViewTreeNode } from 'arkanalyzer/lib';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MatcherCallback, CheckerUtils } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PagePrefetchCheck');
const CREATE: string = 'create';
const WEB: string = 'Web';
const ON_APPEAR: string = 'onAppear';
const ON_PAGE_END: string = 'onPageEnd';
const ABOUT_TO_APPEAR: string = 'aboutToAppear';
let viewTreeTool: ViewTreeTool = new ViewTreeTool();
// 用完初始化
let warnInfo: WarnInfo = {
    line: -1,
    startCol: -1,
    endCol: -1,
    filePath: ''
};

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/page-prefetch-check.md',
    description: 'Invoking pre-download in the onPageEnd of the web component can speed up the loading speed.'
};

/**
 * Record the warning info.
 */
interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
    filePath: string;
}

/**
 * Invoking pre-download in the onPageEnd of the web component can speed up the loading speed.
 */
export class PagePrefetchCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: undefined,
            callback: this.check
        };
        return [matchBuildCb];
    };

    public check = (scene: Scene): void => {
        for (let file of scene.getFiles()) {
            for (let clazz of file.getClasses()) {
                this.clazzProcess(clazz, scene);
            }
            for (let namespace of file.getAllNamespacesUnderThisFile()) {
                for (let clazz of namespace.getClasses()) {
                    this.clazzProcess(clazz, scene);
                }
            }
        }
    };

    private clazzProcess(clazz: ArkClass, scene: Scene): void {
        if (clazz.hasViewTree() && !viewTreeTool.hasTraverse(clazz)) {
            let viewTreeRoot = clazz.getViewTree()?.getRoot();
            if (!viewTreeRoot) {
                return;
            }
            this.traverseViewTree(viewTreeRoot, clazz, scene);
        }
    }

    /**
    * Traverse the viewtree.
    * 
    * @param viewTreeRoot
    * @param clazz
    * @param scene
    */
    private traverseViewTree(viewTreeRoot: ViewTreeNode, clazz: ArkClass, scene: Scene): void {
        if (viewTreeRoot === undefined) {
            return;
        }
        let name = viewTreeRoot.name;
        if (name === WEB) {
            let isFindedInPageEnd = false;
            for (let [key, vals] of viewTreeRoot.attributes) {
                if (key === CREATE) {
                    this.getWarnInfoByAttributes(vals);
                } else if (!isFindedInPageEnd && (key === ON_APPEAR || key === ON_PAGE_END)) {
                    isFindedInPageEnd = this.findSymbolInStmts(vals, scene);
                }
            }
            if (!isFindedInPageEnd) {
                isFindedInPageEnd = this.findSymbolInAboutToAppear(clazz, scene);
            }
            if (!isFindedInPageEnd) {
                this.pushIssueReport();
            }
        }
        if (viewTreeRoot.children.length > 0) {
            for (let child of viewTreeRoot.children) {
                let classSignature = child.signature;
                // 如果是Component，如果在子节点遍历一遍，入口获取arkClass.getViewTree()的时候还会来一次会重复
                if (classSignature && child.isCustomComponent()) {
                    continue;
                }
                // 如果找到逐层推出递归，如果没找到继续往子节点深度查找
                this.traverseViewTree(child, clazz, scene);
            }
        }
    }

    /**
     * Find symbol in appear.
     * 
     * @param stmts
     * @param scene
     * @returns boolean if finded that return true, else return false.
     */
    private findSymbolInStmts(stmts: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]], scene: Scene): boolean {
        for (let stmt of stmts) {
            if (stmt instanceof ArkInvokeStmt) {
                let busyMethods = new Set<MethodSignature>;
                return this.findSymbolInStmt(stmt, scene, busyMethods);
            }
        }
        return false;
    }

    /**
     * Parse the arguments which is a anonymous functions, and search the symbol in deeply.
     * 
     * @param stmt Stmt
     * @param scene Scene
     * @param busyMethods the set of busy methods.
     * @returns boolean
     */
    private findSymbolInStmt(stmt: Stmt, scene: Scene, busyMethods: Set<MethodSignature>): boolean {
        let invokeArgvs = null;
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp();
            if (rightOp instanceof ArkInstanceInvokeExpr) {
                invokeArgvs = rightOp.getArgs();
            }
        } else if (stmt instanceof ArkInvokeStmt) {
            invokeArgvs = stmt.getInvokeExpr().getArgs();
        }
        if (invokeArgvs) {
            return this.findSymbolInArgs(invokeArgvs, scene, busyMethods);
        }
        return false;
    }

    /**
     * Parse the arguments which is a anonymous functions, and search the symbol in deeply.
     * 
     * @param invokeArgvs
     * @param scene
     * @param busyMethods
     * @returns boolean
     */
    private findSymbolInArgs(invokeArgvs: Value[], scene: Scene, busyMethods: Set<MethodSignature>): boolean {
        for (let argv of invokeArgvs) {
            let type = argv.getType();
            if (type instanceof FunctionType) {
                let methodSignature = type.getMethodSignature();
                let anonymousMethod = scene.getMethod(methodSignature);
                if (anonymousMethod !== null && !busyMethods.has(anonymousMethod.getSignature())) {
                    return this.findSymbolInMethod(anonymousMethod, scene, busyMethods);
                } else {
                    logger.debug('Find FunctionType method error');
                }
            }
        }
        return false;
    }

    /**
     * Search the symbol in deeply.
     * 
     * @param method Method to be checked.
     * @param scene Scene
     * @param busyMethods the set of busy methods.
     * @returns boolean
     */
    private findSymbolInMethod(method: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>): boolean {
        const stmts = method.getBody()?.getCfg()?.getStmts();
        if (!stmts) {
            return false;
        }
        const curMethodSignature = method.getSignature();
        // 即将处理，加入忙碌集合
        busyMethods.add(curMethodSignature);
        for (let stmt of stmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            const invokeSignature = invokeExpr.getMethodSignature();
            // 方法忙碌，为递归调用，跳过
            if (busyMethods.has(invokeSignature)) {
                continue;
            }
            const prepareForPageLoadStr = '@ohosSdk/api/@ohos.web.webview.d.ts: webview.WebviewController.prefetchPage(string, @ohosSdk/api/@ohos.web.webview.d.ts: webview.WebHeader[])';
            let invokeSignatureStr = invokeSignature.toString();
            // 匹配
            if (invokeSignatureStr === prepareForPageLoadStr) {
                // 方法处理完毕，退出忙碌集合
                busyMethods.delete(curMethodSignature);
                return true;
            } else {
                // 不匹配，需要深度探索
                let hasTargetsinvokeSignature = this.findSymbolInStmt(stmt, scene, busyMethods);
                if (hasTargetsinvokeSignature) {
                    // 方法处理完毕，退出忙碌集合
                    busyMethods.delete(curMethodSignature);
                    return true;
                }
                let invokeMethod = scene.getMethod(invokeSignature);
                if (invokeMethod === null) {
                    continue;
                }
                if (this.findSymbolInMethod(invokeMethod, scene, busyMethods)) {
                    // 方法处理完毕，退出忙碌集合
                    busyMethods.delete(curMethodSignature);
                    return true;
                }
            }
        }
        // 方法处理完毕，退出忙碌集合
        busyMethods.delete(curMethodSignature);
        return false;
    }

    private findSymbolInAboutToAppear(clazz: ArkClass, scene: Scene): boolean {
        const methods = clazz.getMethods();
        for (let method of methods) {
            const methodName = method.getName();
            if (methodName === ABOUT_TO_APPEAR) {
                let busyMethods = new Set<MethodSignature>();
                return this.findSymbolInMethod(method, scene, busyMethods);
            }
        }
        return false;
    }

    /**
     * Get the warn info by attributes.
     * 
     * @param vals: The stmt of control.
     */
    private getWarnInfoByAttributes(vals: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]]): void {
        for (let val of vals) {
            if (val instanceof Stmt) {
                this.getWarnInfo(val);
                break;
            }
        }
    }

    /**
     * Get the warn info.
     * 
     * @param method: The stmt of method.
     */
    private getWarnInfo(stmt: Stmt): void {
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile === undefined) {
            return;
        }
        const originalPosition = stmt.getOriginPositionInfo();
        warnInfo.filePath = arkFile.getFilePath();
        warnInfo.line = originalPosition.getLineNo();
        warnInfo.startCol = originalPosition.getColNo();
        warnInfo.endCol = warnInfo.startCol + WEB.length - 1;
    }

    /**
     * When not finded targets signature Push the issueReports.
     */
    private pushIssueReport(): void {
        if (warnInfo.line !== -1 && warnInfo.startCol !== -1 && warnInfo.endCol !== -1) {
            const severity = this.rule.alert ?? this.metaData.severity;
            let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
            warnInfo = { line: -1, startCol: -1, endCol: -1, filePath: '' };
        }
    }
}