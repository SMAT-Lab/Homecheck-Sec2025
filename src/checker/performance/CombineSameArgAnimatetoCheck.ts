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

import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ANONYMOUS_METHOD_PREFIX, ArkClass, ArkFile, ArkInstanceFieldRef, ArkMethod, ClassType, Constant, DEFAULT_ARK_CLASS_NAME, FunctionType, Local, MethodSignature, Scene, Stmt, UNKNOWN_FILE_NAME, UNKNOWN_PROJECT_NAME, Value } from 'arkanalyzer';
import { CheckerUtils, Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule } from '../../Index';
import { IssueReport } from '../../model/Defects';

let gFilePath = '';
let gKeyword: string = 'animateTo';
let curFinishedMap = new Map<string, WarnInfo[]>();
let animateToSignatureStr = `@ohosSdk/component/common.d.ts: ${DEFAULT_ARK_CLASS_NAME}.animateTo(@ohosSdk/component/common.d.ts: AnimateParam, @ohosSdk/component/common.d.ts: ${DEFAULT_ARK_CLASS_NAME}.${ANONYMOUS_METHOD_PREFIX}0())`;
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CombineSameArgAnimatetoCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/combine-same-arg-animateto-check.md',
    description: 'The same animateto is used when the parameters are the same.'
};

interface WarnInfo {
    stmt: Stmt;
    arkFile: ArkFile;
}

export class CombineSameArgAnimatetoCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
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
        let scene = arkFile.getScene();
        gFilePath = arkFile.getFilePath();
        for (let clazz of arkFile.getClasses()) {
            this.classProcess(clazz, scene);
        }
        for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
            for (let clazz of namespace.getClasses()) {
                this.classProcess(clazz, scene);
            }
        }
    };

    private classProcess(arkClass: ArkClass, scene: Scene): void {
        if (!arkClass.hasViewTree()) {
            return;
        }
        let viewTreeRoot = arkClass.getViewTree()?.getRoot();
        if (!viewTreeRoot) {
            return;
        }
        for (let child of viewTreeRoot.children) {
            let attributes = child.attributes;
            for (let values of attributes) {
                for (let value of values) {
                    curFinishedMap.clear();
                    this.valueProcess(value, scene);
                    this.getIssueReports();
                }
            }
        }
    }

    private valueProcess(value: string | [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]], scene: Scene): void {
        if (!(value instanceof Array)) {
            return;
        }
        let arrays = value[1];
        for (let array of arrays) {
            if (!(array instanceof MethodSignature)) {
                continue;
            }
            let method = scene.getMethod(array);
            if (method === null) {
                continue;
            }
            let busyMethods = new Set<MethodSignature>();
            this.findSymbolInMethod(method, scene, busyMethods);
        }
    }

    private findSymbolInMethod(method: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>): void {
        const animatetoStmts = method.getBody()?.getCfg().getStmts();
        if (!animatetoStmts) {
            return;
        }
        const curMethodSignature = method.getSignature();
        busyMethods.add(curMethodSignature);
        for (let stmt of animatetoStmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            const invokeSignature = invokeExpr.getMethodSignature();
            let invokeSignatureStr = invokeSignature.toString();
            if (busyMethods.has(invokeSignature) || invokeSignatureStr.includes(`@${UNKNOWN_PROJECT_NAME}/${UNKNOWN_FILE_NAME}`)) {
                continue;
            }
            let clazz = method.getDeclaringArkClass();
            if (invokeSignatureStr === animateToSignatureStr) {
                this.animateToCheck(stmt, clazz.getDeclaringArkFile(), scene);
            } else {
                this.findSymbolInInvokeStmt(stmt, scene, busyMethods);
                let invokeMethod = scene.getMethod(invokeSignature);
                if (invokeMethod === null) {
                    continue;
                }
                this.findSymbolInMethod(invokeMethod, scene, busyMethods);
            }
        }
        busyMethods.delete(curMethodSignature);
    }

    private animateToCheck(stmt: Stmt, file: ArkFile, scene: Scene): void {
        const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invokeExpr) {
            return;
        }
        let arg = invokeExpr.getArg(0);
        if (!(arg instanceof Local)) {
            return;
        }
        let type = arg.getType();
        if (!(type instanceof ClassType)) {
            return;
        }
        let classSignature = type.getClassSignature();
        let code = scene.getClass(classSignature)?.getCode();
        if (!code) {
            return;
        }
        let warnInfoStmt: WarnInfo = {
            stmt: stmt,
            arkFile: file
        };
        if (curFinishedMap.has(code)) {
            let warnInfoList = curFinishedMap.get(code);
            if (warnInfoList) {
                warnInfoList.push(warnInfoStmt);
            }
        } else {
            curFinishedMap.set(code, [warnInfoStmt]);
        }
    }

    private findSymbolInInvokeStmt(stmt: Stmt, scene: Scene, busyMethods: Set<MethodSignature>): void {
        let invokeArgvs = CheckerUtils.getInvokeExprFromStmt(stmt)?.getArgs();
        if (invokeArgvs) {
            this.findSymbolInArgs(invokeArgvs, scene, busyMethods);
        }
    }

    private findSymbolInArgs(invokeArgvs: Value[], scene: Scene, busyMethods: Set<MethodSignature>): void {
        for (let argv of invokeArgvs) {
            let type = argv.getType();
            if (!(type instanceof FunctionType)) {
                continue;
            }
            let methodSignature = type.getMethodSignature();
            let anonymousMethod = scene.getMethod(methodSignature);
            if (anonymousMethod !== null && !busyMethods.has(anonymousMethod.getSignature())) {
                this.findSymbolInMethod(anonymousMethod, scene, busyMethods);
            }
        }
    }

    private getIssueReports(): void {
        curFinishedMap.forEach((warnInfoList) => {
            if (warnInfoList.length > 1) {
                warnInfoList.forEach((warnInfo) => {
                    this.reportIssue(warnInfo.arkFile, warnInfo.stmt);
                });
            }
        });
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt): void {
        let arkFilePath = arkFile.getFilePath();
        if (arkFilePath !== gFilePath || !stmt) {
            return;
        }
        let originPosition = stmt.getOriginPositionInfo();
        let lineNum = originPosition.getLineNo();
        let orgStmtStr = stmt.getOriginalText();
        if (!orgStmtStr || orgStmtStr.length === 0) {
            return;
        }
        let startCol = -1;
        startCol = originPosition.getColNo() + orgStmtStr.indexOf(gKeyword);
        let endCol = startCol + gKeyword.length - 1;
        if (startCol === -1) {
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(lineNum, startCol, endCol, this.metaData.description, severity, this.rule.ruleId,
            arkFilePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defects, undefined));
    }
}