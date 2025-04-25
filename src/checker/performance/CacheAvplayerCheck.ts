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

import { ArkClass, ArkFile, ArkMethod, ArkNamespace, FunctionType, MethodSignature, Scene, Stmt, UNKNOWN_FILE_NAME, UNKNOWN_PROJECT_NAME, Value } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Defects } from '../../model/Defects';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule } from '../../model/Rule';
import { IssueReport } from '../../model/Defects';
import { CheckerUtils } from '../../Index';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CacheAvplayerCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/cache-avplayer-check.md',
    description: 'Suggest cache avplayer.'
};
const gKeyword = 'release';
const aboutToDisappearStr = 'aboutToDisappear';
const releaseSignature: string[] = [
    `@ohosSdk/api/@ohos.multimedia.media.d.ts: media.AVPlayer.release(AsyncCallback<void>)`,
    `@ohosSdk/api/@ohos.multimedia.media.d.ts: media.AVPlayer.release()`
];
const importSignature = '@ohosSdk/api/@ohos.multimedia.media.d.ts: ';

export class CacheAvplayerCheck implements BaseChecker {
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

    public check = (targetFile: ArkFile): void => {
        if (!this.importCheck(targetFile)) {
            return;
        }
        for (let arkClass of targetFile.getClasses()) {
            this.classProcess(arkClass);
        }
        for (let namespace of targetFile.getAllNamespacesUnderThisFile()) {
            for (let arkClass of namespace.getClasses()) {
                this.classProcess(arkClass);
            }
        }
    };

    private importCheck(arkFile: ArkFile): boolean {
        let importInfos = arkFile.getImportInfos();
        for (let importInfo of importInfos) {
            let lazyExportInfo = importInfo.getLazyExportInfo();
            if (!lazyExportInfo) {
                continue;
            }
            let arkExport = lazyExportInfo.getArkExport();
            if (!(arkExport instanceof ArkNamespace)) {
                continue;
            }
            let arkFile = arkExport.getDeclaringArkFile();
            if (!arkFile) {
                continue;
            }
            let declaringFileSignature = arkFile.getFileSignature();
            if (declaringFileSignature.toString() === importSignature) {
                return true;
            }
        }
        return false;
    }

    private classProcess(arkClass: ArkClass): void {
        let arkMethods = arkClass.getMethods();
        for (let arkMethod of arkMethods) {
            if (arkMethod.getName() !== aboutToDisappearStr) {
                continue;
            }
            let busyMethods = new Set<MethodSignature>();
            this.findSymbolInMethod(arkMethod, arkMethod.getDeclaringArkFile().getScene(), busyMethods)
        }
    }

    private findSymbolInMethod(arkMethod: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>): void {
        const cfgStmts = arkMethod.getBody()?.getCfg().getStmts();
        if (!cfgStmts) {
            return;
        }
        const curMethodSignature = arkMethod.getSignature();
        busyMethods.add(curMethodSignature);
        for (let stmt of cfgStmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            const cacheInvokeSignature = invokeExpr.getMethodSignature();
            let invokeSignatureStr = cacheInvokeSignature.toString();
            if (busyMethods.has(cacheInvokeSignature) || invokeSignatureStr.includes(`@${UNKNOWN_PROJECT_NAME}/${UNKNOWN_FILE_NAME}`)) {
                continue;
            }
            let clazz = arkMethod.getDeclaringArkClass();
            if (releaseSignature.includes(invokeSignatureStr)) {
                this.reportIssue(clazz.getDeclaringArkFile(), stmt);
            } else {
                this.findSymbolInvokeStmt(stmt, scene, busyMethods);
                let invokeMethod = scene.getMethod(cacheInvokeSignature);
                if (invokeMethod === null) {
                    continue;
                }
                this.findSymbolInMethod(invokeMethod, scene, busyMethods);
            }
        }
        busyMethods.delete(curMethodSignature);
    }

    private findSymbolInvokeStmt(stmt: Stmt, scene: Scene, busyMethods: Set<MethodSignature>): void {
        let invokeArgs = CheckerUtils.getInvokeExprFromStmt(stmt)?.getArgs();
        if (invokeArgs) {
            this.findSymbolInArgs(invokeArgs, scene, busyMethods);
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
            } else {
                logger.debug('Find FunctionType method error!');
            }
        }
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt | undefined): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        let filePath = arkFile.getFilePath();
        if (!stmt) {
            return;
        }
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let orgStmtStr = stmt.getOriginalText();
        let startColumn = -1;
        let endColumn = -1;
        if (orgStmtStr && orgStmtStr.length !== 0) {
            startColumn = originalPosition.getColNo() + orgStmtStr.indexOf(gKeyword);
            endColumn = startColumn + gKeyword.length - 1;
        }
        if (startColumn === -1) {
            return;
        }
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}