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

import { AbstractFieldRef, AbstractInvokeExpr, ArkAssignStmt, ArkClass, ArkField, ArkFile, ArkInstanceFieldRef, ArkInstanceInvokeExpr, fetchDependenciesFromFile, Local, Scene, Stmt, Value } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import path from 'path';
import fs from 'fs';
import { CheckerUtils } from '../../Index';
import { BooleanConstant } from 'arkanalyzer/lib/core/base/Constant';

const gifComponentOptionsTypeStrList: string[] = [
    `@thirdParty/@ohos/gif-drawable/src/main/ets/components/gif/display/GIFComponentV2.ets: GIFComponentV2.ControllerOptions`,
    `@thirdParty/@ohos/gif-drawable/src/main/ets/components/gif/display/GIFComponent.ets: GIFComponent.ControllerOptions`
];

const gifComponentOptionsNewTypeStrList: string[] = [
    `@thirdParty/@ohos/gif-drawable/src/main/ets/components/gif/display/GIFComponentV2.ets: GIFComponentV2.ControllerOptions.constructor()`,
    `@thirdParty/@ohos/gif-drawable/src/main/ets/components/gif/display/GIFComponent.ets: GIFComponent.ControllerOptions.constructor()`
];

const gifOptionSetOpenHarwareStrList: string[] = [
    `@thirdParty/@ohos/gif-drawable/src/main/ets/components/gif/display/GIFComponentV2.ets: GIFComponentV2.ControllerOptions.setOpenHardware(boolean)`,
    `@thirdParty/@ohos/gif-drawable/src/main/ets/components/gif/display/GIFComponent.ets: GIFComponent.ControllerOptions.setOpenHardware(boolean)`
];

let gifLibVersion: string = 'unknown';
let hardwareVersionList: string[] = ['2.1.1-rc.0'];
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'GifHardwareDecodingCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/gif-hardware-decoding-check.md',
    description: 'Enable hardware decoding for GIF images.'
};

interface GifOptionsInfo {
    optionInfo: ArkField | Local;
    openHardware: boolean;
    setStmt: Stmt | null;
}

export class GifHardwareDecodingCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private buildMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        };
        return [matchBuildCb];
    }

    public check = (arkFile: ArkFile): void => {
        if (gifLibVersion === 'unknown') {
            gifLibVersion = this.getGifDrawableVersion(arkFile.getScene());
        }
        const gifOptionsList: GifOptionsInfo[] = [];
        let hasImportGifDrawable = false;
        for (let importInfo of arkFile.getImportInfos()) {
            let form = importInfo.getFrom();
            if (form && form === '@ohos/gif-drawable') {
                hasImportGifDrawable = true;
                break;
            }
        }
        let hasViewTree = false;
        for (let clazz of arkFile.getClasses()) {
            if (clazz.hasViewTree()) {
                hasViewTree = true;
                break;
            }
        }
        if (hasImportGifDrawable && hasViewTree) {
            this.processArkFile(arkFile, gifOptionsList);
        }

        let isDefaultHardware = this.isDefaultHardwareVersion(gifLibVersion);
        for (let optionInfo of gifOptionsList) {
            if (isDefaultHardware === undefined && isDefaultHardware) {
                if (optionInfo.setStmt && !optionInfo.openHardware) {
                    this.reportIssue(optionInfo.optionInfo);
                }
            } else {
                if (!optionInfo.openHardware) {
                    this.reportIssue(optionInfo.optionInfo);
                }
            }
        }
    };

    private isDefaultHardwareVersion(version: string): boolean | undefined {
        if (version === '') {
            return undefined;
        }
        if (hardwareVersionList.includes(version)) {
            return true;
        }
        const checkVersion = (ver: string, baseVersion: string): boolean | undefined => {
            const arr = this.getVersionResult(ver, baseVersion);
            return arr.some((value) => value > 0);
        };
        if (version.startsWith('~')) {
            const ver = this.getMaJarVersion(version);
            return checkVersion(ver, '2.2.0');
        } else if (version.startsWith('^')) {
            const ver = this.getMaJarVersion(version);
            return checkVersion(ver, '3.0.0');
        } else {
            let majarVersion = version;
            let rcVersion = '';
            if (version.includes('-')) {
                const vers = version.split('-');
                majarVersion = vers[0];
                rcVersion = vers[1].split('.')[1];
            }
            const arr = this.getVersionResult(majarVersion, '2.1.1');
            if (rcVersion !== '') {
                arr.push(Number(rcVersion));
            } else {
                arr.push(0);
            }
            return arr.some((value) => value > 0);
        }
    }

    private getVersionResult(ver1: string, ver2: string): number[] {
        let cmps: number[] = [];
        let ver1s = ver1.split('.');
        let ver2s = ver2.split('.');
        for (let i = 0; i < ver1s.length; i++) {
            let num1 = Number(ver1s[i]);
            let num2 = Number(ver2s[i]);
            cmps.push(num1 - num2);
        }
        return cmps;
    }

    private getMaJarVersion(version: string): string {
        let ver = version;
        if (version.startsWith('~')) {
            ver = version.replace('~', '');
        } else if (version.startsWith('^')) {
            ver = version.replace('^', '');
        }
        if (ver.includes('-')) {
            ver = ver.split('-')[0];
        }
        return ver;
    }

    private processArkFile(arkFile: ArkFile, gifOptionsList: GifOptionsInfo[]): void {
        for (let clazz of arkFile.getClasses()) {
            if (!clazz.hasViewTree()) {
                continue;
            }
            for (let field of clazz.getFields()) {
                let typeStr = field.getType().toString();
                if (gifComponentOptionsTypeStrList.includes(typeStr)) {
                    let variableInfo = { optionInfo: field, setStmt: null, openHardware: false };
                    gifOptionsList.push(variableInfo);
                }
            }
            this.processArkMethod(clazz, gifOptionsList);
        }
    }

    private processArkMethod(clazz: ArkClass, gifOptionsList: GifOptionsInfo[]): void {
        for (let method of clazz.getMethods()) {
            let stmts = method.getCfg()?.getStmts() ?? [];
            for (let stmt of stmts) {
                this.processStmt(stmt, gifOptionsList);
            }
        }
    }

    private processStmt(stmt: any, gifOptionsList: GifOptionsInfo[]): void {
        if (stmt instanceof ArkAssignStmt) {
            this.processAssignStmt(stmt, gifOptionsList);
        }
        let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invokeExpr) {
            return;
        }
        let methodSignature = invokeExpr.getMethodSignature();
        let methodSignatureStr = methodSignature.toString();
        if (gifComponentOptionsNewTypeStrList.includes(methodSignatureStr)) {
            this.getGifOptionInfo(invokeExpr, gifOptionsList);
        }
        if (gifOptionSetOpenHarwareStrList.includes(methodSignatureStr)) {
            this.processGifOptionInfoIfHardwareDecode(invokeExpr, gifOptionsList, stmt);
        }
    }

    private processGifOptionInfoIfHardwareDecode(invokeExpr: any, gifOptionsList: GifOptionsInfo[], stmt: any): void {
        if (this.isHardwareDecode(invokeExpr.getArg(0))) {
            this.processGifOptionInfo(invokeExpr, gifOptionsList, stmt);
        }
    }

    private processGifOptionInfo(invokeExpr: AbstractInvokeExpr, gifOptionsList: GifOptionsInfo[], stmt: Stmt): void {
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            let base = invokeExpr.getBase();
            let realBase = this.getRealBase(base);
            if (!realBase) {
                return;
            }
            for (let gifOptionInfo of gifOptionsList) {
                if (realBase instanceof Local && gifOptionInfo.optionInfo instanceof Local &&
                    realBase.getName() === gifOptionInfo.optionInfo.getName()) {
                    gifOptionInfo.openHardware = true;
                    gifOptionInfo.setStmt = stmt;
                } else if (realBase instanceof AbstractFieldRef && gifOptionInfo.optionInfo instanceof ArkField &&
                    realBase.getFieldSignature().toString() === gifOptionInfo.optionInfo.getSignature().toString()) {
                    gifOptionInfo.openHardware = true;
                    gifOptionInfo.setStmt = stmt;
                }
            }
        }
    }

    private getRealBase(base: Local): Local | AbstractFieldRef | null {
        if (!base.getName().includes('%')) {
            return base;
        }
        let declaringStmt = base.getDeclaringStmt();
        if (declaringStmt && declaringStmt instanceof ArkAssignStmt) {
            let rightOp = declaringStmt.getRightOp();
            if (rightOp instanceof ArkInstanceFieldRef) {
                return rightOp;
            }
            if (rightOp instanceof ArkInstanceInvokeExpr) {
                return this.getRealBase(rightOp.getBase());
            }
        }
        return null;
    }

    private isHardwareDecode(arg: Value): boolean {
        if (arg instanceof BooleanConstant) {
            return arg.getValue() === 'true';
        }
        return false;
    }

    private getGifOptionInfo(invokeExpr: AbstractInvokeExpr, gifOptionsList: GifOptionsInfo[]): void {
        if (!(invokeExpr instanceof ArkInstanceInvokeExpr)) {
            return;
        }
        let base = invokeExpr.getBase();
        let usedStmts = base.getUsedStmts();
        for (let stmt of usedStmts) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let rightOp = stmt.getRightOp();
            let leftOp = stmt.getLeftOp();
            if (rightOp === base && leftOp instanceof Local) {
                let variableInfo = { optionInfo: leftOp, setStmt: null, openHardware: false };
                gifOptionsList.push(variableInfo);
            }
        }
    }

    private processAssignStmt(stmt: ArkAssignStmt, gifOptionsList: GifOptionsInfo[]): void {
        let leftOp = stmt.getLeftOp();
        let rightOp = stmt.getRightOp();
        let typeStr = leftOp.getType().toString();
        if (gifComponentOptionsTypeStrList.includes(typeStr)) {
            let rightOptionInfo = this.getRightOptionInfo(rightOp, gifOptionsList);
            if (rightOptionInfo[0]) {
                this.updateLeftOptionHardware(leftOp, gifOptionsList, rightOptionInfo);
            }
        }
    }

    private updateLeftOptionHardware(leftOp: Value, gifOptionsList: GifOptionsInfo[], rightOptionInfo: [boolean, Stmt | null]): void {
        for (let gifOptionInfo of gifOptionsList) {
            if (leftOp instanceof Local && gifOptionInfo.optionInfo instanceof Local &&
                leftOp.getName() === gifOptionInfo.optionInfo.getName()) {
                gifOptionInfo.openHardware = true;
                gifOptionInfo.setStmt = rightOptionInfo[1];
            } else if (leftOp instanceof AbstractFieldRef && gifOptionInfo.optionInfo instanceof ArkField &&
                leftOp.getFieldSignature().toString() === gifOptionInfo.optionInfo.getSignature().toString()) {
                gifOptionInfo.openHardware = true;
                gifOptionInfo.setStmt = rightOptionInfo[1];
            }
        }
    }

    private getRightOptionInfo(rightOp: Value, gifOptionsList: GifOptionsInfo[]): [boolean, Stmt | null] {
        for (let gifOptionInfo of gifOptionsList) {
            if (rightOp instanceof Local && gifOptionInfo.optionInfo instanceof Local &&
                rightOp.getName() === gifOptionInfo.optionInfo.getName()) {
                return [gifOptionInfo.openHardware, gifOptionInfo.setStmt];
            } else if (rightOp instanceof AbstractFieldRef && gifOptionInfo.optionInfo instanceof ArkField &&
                rightOp.getFieldSignature().toString() === gifOptionInfo.optionInfo.getSignature().toString()) {
                return [gifOptionInfo.openHardware, gifOptionInfo.setStmt]
            }
        }
        return [false, null];
    }


    private getGifDrawableVersion(sence: Scene): string {
        let ohPkgContent = sence.getOhPkgContent();
        let deps = ohPkgContent['dependencies'];
        if (!deps) {
            return '';
        }
        let version = (deps as { [k: string]: unknown })['@ohos/gif-drawable'];
        if (!version) {
            return '';
        }
        let depVersion = version as string;
        const libOhPkgFilePath = path.join(sence.getRealProjectDir(), 'oh_modules', '@ohos', 'gif-drawable', 'oh-package.json5');
        if (fs.existsSync(libOhPkgFilePath)) {
            let libOhPkgContent = fetchDependenciesFromFile(libOhPkgFilePath);
            depVersion = libOhPkgContent['version'] as string;
        } else {
            logger.debug('Lib oh-package.json5 is not exist, please check!');
        }
        return depVersion;
    }


    private reportIssue(optionInfo: ArkField | Local): void {
        let lineNum = -1;
        let startColum = -1;
        let endColumn = -1;
        let filePath = '';
        if (optionInfo instanceof ArkField) {
            let positionInfo = optionInfo.getOriginPosition();
            lineNum = positionInfo.getLineNo();
            let fieldName = optionInfo.getName();
            let lineCode = optionInfo.getCode();
            startColum = positionInfo.getColNo() + lineCode.indexOf(fieldName);
            endColumn = startColum + fieldName.length - 1;
            let arkFile = optionInfo.getDeclaringArkClass().getDeclaringArkFile();
            filePath = arkFile.getFilePath();
        } else {
            let keyword = optionInfo.getName();
            let declaringStmt = optionInfo.getDeclaringStmt();
            if (!declaringStmt) {
                return;
            }
            let originalPosition = declaringStmt.getOriginPositionInfo();
            let text = declaringStmt.getOriginalText() ?? '';
            lineNum = originalPosition.getLineNo();
            startColum = originalPosition.getColNo() + text.indexOf(keyword);
            endColumn = startColum + keyword.length - 1;
            let arkFile = declaringStmt.getCfg().getDeclaringMethod().getDeclaringArkFile();
            filePath = arkFile.getFilePath();
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(lineNum, startColum, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
    }
}