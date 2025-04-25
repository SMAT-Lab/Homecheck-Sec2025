/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distlributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { AbstractInvokeExpr, ArkAssignStmt, ArkFile, ArkInstanceInvokeExpr, ArkInvokeStmt, ArkMethod, ArkStaticInvokeExpr, DEFAULT_ARK_CLASS_NAME, FunctionType, Local, MethodSignature, Scene, Stmt } from 'arkanalyzer';
import { CheckerUtils, Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule, ScopeType } from '../../Index';
import path from 'path';
import { StmtExt } from '../../model/StmtExt';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'HighFrequencyLogCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/high-frequency-log-check.md',
    description: 'Avoid printing logs in frequent functions. The call chain here is as follows: '
};
const frequencyMethods: string[] = ['onScroll', 'onWillScroll', 'onItemDragMove', 'onTouch', 'onDragMove', 'onMouse', 'onActionUpdate', 'onVisibleAreaChange', 'onAreaChange'];
const hilogNsSignStr: string = '@ohosSdk/api/@ohos.hilog.d.ts: hilog';
const hilogPrintSignList: string[] = [
    hilogNsSignStr + `.${DEFAULT_ARK_CLASS_NAME}.info(number, string, string, any[])`,
    hilogNsSignStr + `.${DEFAULT_ARK_CLASS_NAME}.warn(number, string, string, any[])`,
    hilogNsSignStr + `.${DEFAULT_ARK_CLASS_NAME}.error(number, string, string, any[])`,
    hilogNsSignStr + `.${DEFAULT_ARK_CLASS_NAME}.fatal(number, string, string, any[])`
];

interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
    usedChain: string;
}

export class HighFrequencyLogCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    private gFinishedMethodMap = new Map<MethodSignature, WarnInfo[]>();
    private curFinishedMap = new Map<MethodSignature, WarnInfo[]>();
    private conditionScopeTypes = [ScopeType.IF_TYPE, ScopeType.ELSE_TYPE, ScopeType.CASE_TYPE];
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchFileCb];
    }

    public check = (arkFile: ArkFile): void => {
        this.curFinishedMap.clear();
        let scene = arkFile.getScene();
        for (const arkClass of arkFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                this.arkMethodProcess(arkMethod, scene);
            }
        }
        for (const namespace of arkFile.getAllNamespacesUnderThisFile()) {
            for (const arkClass of namespace.getClasses()) {
                for (const arkMethod of arkClass.getMethods()) {
                    this.arkMethodProcess(arkMethod, scene);
                }
            }
        }
        this.genIssueReports(scene.getRealProjectDir());
    };

    private arkMethodProcess(arkMethod: ArkMethod, scene: Scene): void {
        const stmts = arkMethod.getBody()?.getCfg()?.getStmts() ?? [];
        for (let stmt of stmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (invokeExpr) {
                const methodSignature = invokeExpr.getMethodSignature();
                const invokeMethodName = methodSignature.getMethodSubSignature().getMethodName();
                if (invokeMethodName && frequencyMethods.includes(invokeMethodName)) {
                    let busyMethods = new Set<MethodSignature>([methodSignature]);
                    let warnInfoList = this.findSymbolInArgs(invokeExpr, scene, busyMethods);
                    this.curFinishedMap.set(methodSignature, warnInfoList);
                    this.gFinishedMethodMap.set(methodSignature, warnInfoList);
                }
            }
        }
    }

    private genIssueReports(originDir: string): void {
        this.curFinishedMap.forEach((warnInfoList, methodSignature) => {
            if (frequencyMethods.includes(methodSignature.getMethodSubSignature().getMethodName())) {
                warnInfoList.forEach((warnInfo) => {
                    const severity = this.rule.alert ?? this.metaData.severity;
                    const description = this.metaData.description + warnInfo.usedChain?.slice(0, -3);
                    const filePath = path.join(originDir, this.getFilePathInUsedChain(warnInfo.usedChain ?? ''));
                    let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, description, severity,
                        this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
                    this.issues.push(new IssueReport(defects, undefined));
                });
            }
        })
    }

    private getFilePathInUsedChain(usedChain: string): string {
        let warnInfo = usedChain.split('>>')[0].split(':');
        if (warnInfo.length === 4) {
            return warnInfo[0] + ':' + warnInfo[1];
        } else if (warnInfo.length === 3) {
            return warnInfo[0];
        }
        return '';
    }

    private getCurUsedChain(filePath: string, line: number, methodName: string): string {
        return filePath + ':' + line + ':' + methodName + '\n>>';
    }

    private findSymbolInArgs(invokeExpr: AbstractInvokeExpr, scene: Scene, busyMethods: Set<MethodSignature>): WarnInfo[] {
        let invokeArgvs = invokeExpr.getArgs();
        let warnInfoList = [];
        for (let argv of invokeArgvs) {
            let type = argv.getType();
            if (type instanceof FunctionType) {
                let anonymousMethod = scene.getMethod(type.getMethodSignature());
                if (anonymousMethod === null) {
                    logger.debug('Find FunctionType method error!');
                    continue;
                }
                if (busyMethods.has(anonymousMethod.getSignature())) {
                    continue;
                }
                let curArgvWarnInfoList = this.findSymbolInMethod(anonymousMethod, scene, busyMethods);
                this.curFinishedMap.set(type.getMethodSignature(), curArgvWarnInfoList);
                this.gFinishedMethodMap.set(type.getMethodSignature(), curArgvWarnInfoList);
                warnInfoList.push(...curArgvWarnInfoList);
            }
        }
        return warnInfoList;
    }

    private findSymbolInMethod(method: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>): WarnInfo[] {
        const stmts = method.getBody()?.getCfg()?.getStmts() ?? [];
        let warnInfoList: WarnInfo[] = [];
        const curMethodSignature = method.getSignature();
        const matchWarnInfoList = this.gFinishedMethodMap.get(curMethodSignature);
        if (matchWarnInfoList !== undefined) {
            return matchWarnInfoList;
        }
        busyMethods.add(curMethodSignature);
        for (let stmt of stmts) {
            const scopeType = (stmt as StmtExt).scope?.scopeType;
            if (!(stmt instanceof ArkInvokeStmt) || (scopeType === undefined) ||
                (busyMethods.size === 2 && this.conditionScopeTypes.includes(scopeType))) {
                continue
            }
            const invokeExpr = stmt.getInvokeExpr();
            const invokeSignature = invokeExpr.getMethodSignature();
            if (busyMethods.has(invokeSignature)) {
                continue;
            }
            const className = this.getClassName(invokeExpr);
            const methodName = invokeSignature.getMethodSubSignature().getMethodName();
            const invokeName = (className.length === 0) ? methodName : className + '.' + methodName;
            const tempInfo = this.recordWarnInfo(stmt, invokeName);
            if (hilogPrintSignList.includes(invokeSignature.toString()) || (className === 'console' && methodName !== 'debug')) {
                warnInfoList.push({
                    line: tempInfo.line, startCol: tempInfo.startCol, endCol: tempInfo.endCol,
                    usedChain: tempInfo.usedChain
                });
            } else {
                const deepWarnInfoList = this.findDeeply(stmt, scene, busyMethods);
                for (const warnInfo of deepWarnInfoList) {
                    warnInfoList.push({
                        line: tempInfo.line, startCol: tempInfo.startCol, endCol: tempInfo.endCol,
                        usedChain: tempInfo.usedChain + warnInfo.usedChain
                    })
                }
            }
        }
        busyMethods.delete(curMethodSignature);
        this.curFinishedMap.set(curMethodSignature, warnInfoList);
        this.gFinishedMethodMap.set(curMethodSignature, warnInfoList);
        return warnInfoList;
    }

    private findDeeply(stmt: Stmt, scene: Scene, busyMethods: Set<MethodSignature>): WarnInfo[] {
        const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (invokeExpr) {
            let warnInfoList = this.findSymbolInArgs(invokeExpr, scene, busyMethods);
            const invokeMethod = scene.getMethod(invokeExpr.getMethodSignature());
            if (invokeMethod === null) {
                return warnInfoList;
            }
            let methodWarnInfos = this.findSymbolInMethod(invokeMethod, scene, busyMethods);
            return warnInfoList.concat(methodWarnInfos);
        }
        return [];
    }

    private getClassName(invokeExpr: AbstractInvokeExpr): string {
        let className = '';
        if (invokeExpr instanceof ArkStaticInvokeExpr) {
            const classSign = invokeExpr.getMethodSignature().getDeclaringClassSignature();
            className = classSign.getClassName();
            if (className === DEFAULT_ARK_CLASS_NAME) {
                className = classSign.getDeclaringNamespaceSignature()?.getNamespaceName() ?? '';
            }
        } else if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            className = invokeExpr.getBase().getName();
            if (className.includes('%')) {
                className = this.getRealClassName(invokeExpr, className);
            }
        } else {
            logger.warn('UnSupported expr type was found!');
        }
        return className;
    }

    private getRealClassName(invokeExpr: ArkInstanceInvokeExpr, tempClassName: string): string {
        const tempDef = invokeExpr.getBase().getDeclaringStmt()?.getDef();
        if (!(tempDef instanceof Local)) {
            return '';
        }
        const usedStmts = tempDef.getUsedStmts();
        for (let stmt of usedStmts) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            const rightOp = stmt.getRightOp();
            if (rightOp instanceof Local && (rightOp.getName() === tempClassName)) {
                const leftOp = stmt.getLeftOp();
                if (leftOp instanceof Local) {
                    return leftOp.getName();
                }
            }
        }
        return '';
    }

    private recordWarnInfo(stmt: Stmt, invokeName: string): WarnInfo {
        let warnInfo: WarnInfo = { line: -1, startCol: -1, endCol: -1, usedChain: '' };
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originText = stmt.getOriginalText() ?? '';
            if (invokeName.includes('.constructor')) {
                invokeName = invokeName.split('.')[0];
            }
            const pos = originText.indexOf(invokeName);
            if (pos !== -1) {
                const originPath = arkFile.getFilePath();
                const relativePath = path.relative(arkFile.getScene().getRealProjectDir(), originPath);
                let originalPosition = stmt.getOriginPositionInfo();
                warnInfo.line = originalPosition.getLineNo();
                warnInfo.startCol = originalPosition.getColNo() + pos;
                warnInfo.endCol = warnInfo.startCol + invokeName.length - 1;
                warnInfo.usedChain = this.getCurUsedChain(relativePath, warnInfo.line, invokeName);
            }
        } else {
            logger.warn('Get ArkFile failed.');
        }
        return warnInfo;
    }
}