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

import { AbstractInvokeExpr, ArkAssignStmt, ArkClass, ArkFile, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkInvokeStmt, ArkMethod, Constant, FileSignature, FunctionType, MethodSignature, parseJsonText, Scene, Stmt, Value, ViewTreeNode } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, Defects, MatcherCallback, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from '../../model/Defects';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { moduleJson5Module } from '../../utils/checker/AbilityInterface';
import fs from 'fs';
import path from 'path';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'HomepagePrepareLoadCheck');
const ON_CREATE: string = 'onCreate';
const WEB: string = 'Web';
const ON_APPEAR: string = 'onAppear';
const ON_PAGE_END: string = 'onPageEnd';
const ABOUT_TO_APPEAR: string = 'aboutToAppear';
let hasWeb = false;
let homePageHasFunction = false;
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
    ruleDocPath: 'docs/homepage-prepare-load-check.md',
    description: 'Pre-connection before opening the home page can improve the page loading speed.'
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
 * Pre-connection before opening the home page can improve the page loading speed.
 */
export class HomepagePrepareLoadCheck implements BaseChecker {
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
    }

    public check = (scene: Scene): void => {
        const projectDir = scene.getRealProjectDir();
        const Json5Files = this.getJson5Files(projectDir, ['.json5']);
        let moduleJson5File = [];
        for (let filePath of Json5Files) {
            if (filePath.endsWith('module.json5')) {
                moduleJson5File.push(filePath);
            }
        }
        const mainAbilityFiles = this.getMainAbilityPath(moduleJson5File, scene);
        this.abilityProcess(mainAbilityFiles, scene);
    };

    private getMainAbilityPath(moduleJson5List: string[], scene: Scene): ArkFile[] {
        let mainAbilityFiles = [];
        for (let moduleJson5Item of moduleJson5List) {
            const module: moduleJson5Module | undefined = parseJsonText(fs.readFileSync(moduleJson5Item, 'utf8')).module as moduleJson5Module;
            if (module === undefined) {
                continue;
            }
            if (module.type !== 'entry') {
                continue;
            }
            const mainAbilityName = module.mainElement;
            const abilities = module.abilities ?? [];
            for (let ability of abilities) {
                if (ability.name !== mainAbilityName) {
                    continue;
                }
                const filePath = path.resolve(path.join(path.dirname(moduleJson5Item), ability.srcEntry));
                const relativefileName = path.relative(scene.getRealProjectDir(), filePath);
                const tmpSig = new FileSignature(scene.getProjectName(), relativefileName);
                const mainAbilityFile = scene.getFile(tmpSig);
                if (mainAbilityFile) {
                    mainAbilityFiles.push(mainAbilityFile);
                }
            }
        }
        return mainAbilityFiles;
    }

    private abilityProcess(mainAbilityFiles: ArkFile[], scene: Scene): void {
        for (let mainAbilityFile of mainAbilityFiles) {
            for (let clazz of mainAbilityFile.getClasses()) {
                this.abilityClazzProcess(clazz, scene);
            }
            for (let namespace of mainAbilityFile.getAllNamespacesUnderThisFile()) {
                for (let clazz of namespace.getClasses()) {
                    this.abilityClazzProcess(clazz, scene);
                }
            }
        }
    }

    private abilityClazzProcess(clazz: ArkClass, scene: Scene): void {
        hasWeb = false;
        homePageHasFunction = false;
        let abilityHasFunction = false;
        let methods = clazz.getMethods();
        warnInfo = { line: -1, startCol: -1, endCol: -1, filePath: '' };
        // const methodSignature = '@scene/entry/src/main/ets/entryability/EntryAbility.ets: EntryAbility.onCreate(Want, AbilityConstant.LaunchParam)';
        // entryAbility 的文件路径和文件名不一定是EntryAbility，所以只用签名尾部判断
        const onCreateSignatureEnd = '.onCreate(Want, AbilityConstant.LaunchParam)';
        const onWindowStageCreateSignatureEnd = '.onWindowStageCreate(@ohosSdk/api/@ohos.window.d.ts: window.WindowStage)';
        for (let method of methods) {
            if (method.getSignature().toString().endsWith(onCreateSignatureEnd)) {
                this.getWarnInfo(method);
                let busyMethods = new Set<MethodSignature>();
                // 判断onCreate里面是否有预连接方法
                abilityHasFunction = this.findSymbolInMethod(method, scene, busyMethods);
                if (abilityHasFunction) {
                    return;
                }
            } else if (method.getSignature().toString().endsWith(onWindowStageCreateSignatureEnd)) {
                let busyMethods = new Set<MethodSignature>();
                let homePageFile = this.getHomePageFile(method, scene, busyMethods);
                if (homePageFile) {
                    this.homePageProcess([homePageFile], scene);
                }
                break;
            }
        }
        // Ability的onCreate里面没有预连接方法，主页里面有Web组件且aboutToAppear、onAppear、onPageEnd里面没有预连接方法
        if (!abilityHasFunction && hasWeb && !homePageHasFunction) {
            this.pushIssueReport();
        }
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
        const stmts = method.getBody()?.getCfg().getStmts();
        if (stmts === undefined) {
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
            const prepareForPageLoadStr = '@ohosSdk/api/@ohos.web.webview.d.ts: webview.WebviewController.[static]prepareForPageLoad(string, boolean, number)';
            let invokeSignatureStr = invokeSignature.toString();
            // 匹配
            if (invokeSignatureStr === prepareForPageLoadStr) {
                // 方法处理完毕，退出忙碌集合
                busyMethods.delete(curMethodSignature);
                return true;
            } else {
                // 不匹配，需要深度探索
                let hasTargetsinvokeSignature = this.findSymbolInstmt(stmt, scene, busyMethods);
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

    /**
     * Parse the arguments which is a anonymous functions, and search the symbol in deeply.
     * 
     * @param stmt Stmt
     * @param scene Scene
     * @param busyMethods the set of busy methods.
     * @returns boolean
     */
    private findSymbolInstmt(stmt: Stmt, scene: Scene, busyMethods: Set<MethodSignature>): boolean {
        let invokeArgvs = null;
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp();
            if (rightOp instanceof ArkInstanceInvokeExpr) {
                invokeArgvs = rightOp.getArgs();
            }
        } else if (stmt instanceof ArkInvokeStmt) {
            invokeArgvs = stmt.getInvokeExpr().getArgs();
        }
        if (invokeArgvs && (stmt instanceof ArkInvokeStmt || stmt instanceof ArkAssignStmt)) {
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

    private getHomePageFile(method: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>): ArkFile | null {
        const stmts = method.getBody()?.getCfg().getStmts();
        if (stmts === undefined) {
            return null;
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
            const loadContentSignatureStr: string[] = [
                '@ohosSdk/api/@ohos.window.d.ts: window.WindowStage.loadContent(string, LocalStorage, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<void>)',
                '@ohosSdk/api/@ohos.window.d.ts: window.WindowStage.loadContent(string, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<void,void>)',
                '@ohosSdk/api/@ohos.window.d.ts: window.WindowStage.loadContent(string, LocalStorage)',
                '@ohosSdk/api/@ohos.window.d.ts: window.WindowStage.loadContent(string, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<void>)'

            ];
            let invokeSignatureStr = invokeSignature.toString();
            if (loadContentSignatureStr.includes(invokeSignatureStr)) {
                return this.getFileByInvokeExpr(invokeExpr, stmt, scene);
            }
        }
        // 方法处理完毕，退出忙碌集合
        busyMethods.delete(curMethodSignature);
        return null;
    }

    private getFileByInvokeExpr(invokeExpr: AbstractInvokeExpr, stmt: Stmt, scene: Scene): ArkFile | null {
        let arg = invokeExpr.getArgs()[0];
        if (arg instanceof Constant) {
            let homePagePath = arg.getValue();
            const declaringArkFile = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile();
            if (declaringArkFile) {
                let filePath = declaringArkFile.getFilePath();
                // 获取entryAbility文件夹
                filePath = path.dirname(filePath);
                // 获取到上一层目录（ets）
                filePath = path.dirname(filePath);
                const homePagePaths = homePagePath.split('/');
                homePagePath = filePath;
                for (let subPath of homePagePaths) {
                    homePagePath = path.join(homePagePath, subPath);
                }
                homePagePath = homePagePath + '.ets';
                return this.getFile(scene, homePagePath);
            }
        }
        return null;
    }

    private getFile(scene: Scene, homePagePath: string): ArkFile | null {
        const files = scene.getFiles();
        for (let file of files) {
            const filePath = file.getFilePath();
            if (filePath === homePagePath) {
                return file;
            }
        }
        return null;
    }

    private homePageProcess(files: ArkFile[], scene: Scene): void {
        for (let file of files) {
            for (let clazz of file.getClasses()) {
                this.homePageClazzProcess(clazz, scene);
            }
            for (let namespace of file.getAllNamespacesUnderThisFile()) {
                for (let clazz of namespace.getClasses()) {
                    this.homePageClazzProcess(clazz, scene);
                }
            }
        }
    }

    private homePageClazzProcess(clazz: ArkClass, scene: Scene): void {
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
            hasWeb = true;
            for (let [key, vals] of viewTreeRoot.attributes) {
                if (key === ON_APPEAR && this.findSymbolInWebControl(vals, scene)) {
                    homePageHasFunction = true;
                    return;
                } else if (key === ON_PAGE_END && this.findSymbolInWebControl(vals, scene)) {
                    homePageHasFunction = true;
                    return;
                }
            }
            if (this.findSymbolInAboutToAppear(clazz, scene)) {
                homePageHasFunction = true;
                return;
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
     * Find symbol in web control.
     * 
     * @param vals
     * @param scene
     * @returns boolean if finded that return true, else return false. 
     */
    private findSymbolInWebControl(vals: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]], scene: Scene): boolean {
        for (let val of vals) {
            if (val instanceof ArkAssignStmt || val instanceof ArkInvokeStmt) {
                let busyMethods = new Set<MethodSignature>();
                return this.findSymbolInstmt(val, scene, busyMethods);
            }
        }
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
     * Get the warn info.
     * 
     * @param method: The method of control.
     */
    private getWarnInfo(method: ArkMethod): void {
        const arkFile = method.getDeclaringArkFile();
        if (!arkFile) {
            return;
        }
        warnInfo.filePath = arkFile.getFilePath();
        warnInfo.line = method.getLine() ?? (method.getDeclareLines() ?? [-1])[0];
        warnInfo.startCol = method.getColumn() ?? (method.getDeclareColumns() ?? [-1])[0];
        warnInfo.endCol = warnInfo.startCol + ON_CREATE.length - 1;
    }

    /**
     * When not finded targets signature Push the issueReports.
     */
    private pushIssueReport(): void {
        if (warnInfo.line !== -1 && warnInfo.startCol !== -1 && warnInfo.endCol !== -1 && !this.isExistIssueReport(this.issues)) {
            const severity = this.rule.alert ?? this.metaData.severity;
            let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    /**
     * Check the IssueReport is exist.
     * 
     * @returns boolean
     */
    private isExistIssueReport(issues: IssueReport[]): boolean {
        for (let issue of issues) {
            if (issue.defect.mergeKey.substring(1, issue.defect.mergeKey.indexOf('%')) === warnInfo.filePath &&
                issue.defect.reportLine === warnInfo.line && issue.defect.reportColumn === warnInfo.startCol) {
                return true;
            }
        }
        return false;
    }

    private getJson5Files(srcPath: string, exts: string[], filenameArr: string[] = [], visited: Set<string> = new Set<string>()): string[] {
        if (!fs.existsSync(srcPath)) {
            logger.warn('Input directory is not exist, please check!');
            return filenameArr;
        }
        const realSrc = fs.realpathSync(srcPath);
        if (visited.has(realSrc)) {
            return filenameArr;
        }
        visited.add(realSrc);
        let fileNames = fs.readdirSync(realSrc);
        fileNames.forEach((fileName) => {
            if (fileName !== 'oh_modules' &&
                fileName !== 'node_modules' &&
                fileName !== 'hvigorfile.ts' &&
                fileName !== 'ohosTest' &&
                fileName !== 'build'
            ) {
                const realFile = path.resolve(realSrc, fileName);
                if (fs.statSync(realFile).isDirectory()) {
                    this.getJson5Files(realFile, exts, filenameArr, visited);
                } else if (exts.includes(path.extname(fileName))) {
                    filenameArr.push(realFile);
                }
            }
        });
        return filenameArr;
    }
}