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
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { ArkAssignStmt, ArkInvokeStmt, Stmt } from 'arkanalyzer/lib/core/base/Stmt';
import { ArkFile } from 'arkanalyzer/lib/core/model/ArkFile';
import { ArkMethod } from 'arkanalyzer/lib/core/model/ArkMethod';
import { AbstractInvokeExpr, ArkInstanceInvokeExpr } from 'arkanalyzer/lib/core/base/Expr';
import { MethodSignature } from 'arkanalyzer/lib/core/model/ArkSignature';
import { ClassType, FunctionType } from 'arkanalyzer/lib/core/base/Type';
import { Constant } from 'arkanalyzer/lib/core/base/Constant';
import { Value } from 'arkanalyzer/lib/core/base/Value';
import { Local } from 'arkanalyzer/lib/core/base/Local';
import { ArkInstanceFieldRef, ArkStaticFieldRef } from 'arkanalyzer/lib/core/base/Ref';
import { Rule, Defects, FileMatcher, MatcherTypes, MatcherCallback, CheckerUtils } from '../../Index';
import { IssueReport } from '../../model/Defects';

const destoryMethods: string[] = ['aboutToDisappear', 'onPageHide', 'onDisAppear'];
const loadAnimationSignatureStrs: string[] = [
    '@thirdParty/@ohos/lottie/index.d.ts: LottiePlayer.loadAnimation(@internalSdk/@internal/es5.d.ts: ObjectConstructor)',
    '@thirdParty/@ohos/lottie/index.d.ts: LottiePlayer.loadAnimation(@ES2015/BuiltinClass: Object)'
];
const lottieDestorySignatureStr = '@thirdParty/@ohos/lottie/index.d.ts: LottiePlayer.destroy(string)';
const animationDestorySignatureStr = '@thirdParty/@ohos/lottie/index.d.ts: AnimationItem.destroy(string)';
const addEventListenerSignatureStr = '@thirdParty/@ohos/lottie/index.d.ts: AnimationItem.addEventListener(string, LoadCallback<T = any>)';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'LottieAnimationDestoryCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/lottie-animation-destroy-check.md',
    description: 'Destroy Lottie animations correctly.'
};

interface LoadAnimationInfo {
    initStmt: Stmt;
    animItemName: string;
    animName: string;
    destoryStmt: Stmt | null;
}

export class LottieAnimationDestoryCheck implements BaseChecker {
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
        let hasImportLottie = false;
        for (let importInfo of arkFile.getImportInfos()) {
            let form = importInfo.getFrom();
            if (form && form === '@ohos/lottie') {
                hasImportLottie = true;
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
        if (hasImportLottie && hasViewTree) {
            this.processArkFile(arkFile);
        }
    };

    private processArkFile(arkFile: ArkFile): void {
        let loadAnims: LoadAnimationInfo[] = [];
        let releaseMethods: ArkMethod[] = [];
        for (let clazz of arkFile.getClasses()) {
            for (let arkMethod of clazz.getMethods()) {
                this.processArkMethod(arkFile, arkMethod, loadAnims, releaseMethods);
            }
        }
        for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
            for (let clazz of namespace.getClasses()) {
                for (let arkMethod of clazz.getMethods()) {
                    this.processArkMethod(arkFile, arkMethod, loadAnims, releaseMethods);
                }
            }
        }

        if (loadAnims.length === 0) {
            return;
        }
        let destroyAnimCount = this.getDestroyAnimCount(loadAnims, releaseMethods);
        if (destroyAnimCount === 0) {
            for (let animInfo of loadAnims) {
                let invokerExpr = CheckerUtils.getInvokeExprFromStmt(animInfo.initStmt);
                if (invokerExpr && invokerExpr instanceof ArkInstanceInvokeExpr) {
                    let baseName = invokerExpr.getBase().getName();
                    this.reportIssue(arkFile, animInfo.initStmt, baseName);
                }
            }
        } else if (destroyAnimCount < loadAnims.length) {
            for (let animInfo of loadAnims) {
                if (!animInfo.destoryStmt) {
                    continue;
                }
                let invokerExpr = CheckerUtils.getInvokeExprFromStmt(animInfo.destoryStmt);
                if (!invokerExpr || !(invokerExpr instanceof ArkInstanceInvokeExpr)) {
                    continue;
                }
                let baseName = this.getInstanceBaseName(invokerExpr.getBase());
                let realFile = animInfo.destoryStmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
                if (realFile) {
                    this.reportIssue(realFile, animInfo.destoryStmt, baseName);
                }
            }
        }
    }

    private getDestroyAnimCount(loadAnims: LoadAnimationInfo[], releaseMethods: ArkMethod[]): number {
        let destroyAnimCount = 0;
        let busyMethods = new Set<MethodSignature>();
        for (let arkMethod of releaseMethods) {
            if (destroyAnimCount >= loadAnims.length) {
                break;
            }
            busyMethods.clear();
            destroyAnimCount += this.getCountFromDestroryMethod(loadAnims, arkMethod, busyMethods);
        }
        return destroyAnimCount;
    }

    private getCountFromDestroryMethod(loadAnims: LoadAnimationInfo[], arkMethod: ArkMethod, busyMethods: Set<MethodSignature>): number {
        let destroyAnimCount = 0;
        busyMethods.add(arkMethod.getSignature());
        for (let stmt of arkMethod.getBody()?.getCfg()?.getStmts() ?? []) {
            let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            if (!(invokeExpr instanceof AbstractInvokeExpr)) {
                continue;
            }
            let methodSignature = invokeExpr.getMethodSignature();
            let methodSignatureStr = methodSignature.toString();
            if (busyMethods.has(methodSignature)) {
                continue;
            }
            if (methodSignatureStr !== lottieDestorySignatureStr && methodSignatureStr !== animationDestorySignatureStr) {
                let invokeMethods = this.findCallerMethodByInvoker(stmt, invokeExpr);
                for (let subMethod of invokeMethods) {
                    destroyAnimCount += this.getCountFromDestroryMethod(loadAnims, subMethod, busyMethods);
                }
                continue;
            }
            if (methodSignatureStr === lottieDestorySignatureStr && invokeExpr.getArgs().length === 0) {
                destroyAnimCount = loadAnims.length;
                break;
            }
            let targetAnim = loadAnims.find((anim) => { return anim.destoryStmt === null });
            if (targetAnim) {
                destroyAnimCount++;
                targetAnim.destoryStmt = stmt;
            }
        }
        return destroyAnimCount;
    }

    private findCallerMethodByInvoker(stmt: Stmt, invokeExpr: AbstractInvokeExpr): ArkMethod[] {
        let methods: ArkMethod[] = [];
        let invokerFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        let invokerClass = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkClass();
        if (!invokerFile || !invokerClass) {
            return methods;
        }
        let invokeArgs = invokeExpr.getArgs();
        for (let argv of invokeArgs) {
            let type = argv.getType();
            if (!(type instanceof FunctionType)) {
                continue;
            }
            let anonymousMethod = invokerFile.getScene().getMethod(type.getMethodSignature());
            if (!anonymousMethod) {
                logger.debug('Find FunctionType method error!');
                continue;
            }
            methods.push(anonymousMethod);
        }
        let invokeMethod = invokerFile.getScene().getMethod(invokeExpr.getMethodSignature());
        if (!invokeMethod) {
            logger.debug('Find method error!');
            return methods;
        }
        methods.push(invokeMethod);
        return methods;
    }

    private processArkMethod(arkFile: ArkFile, arkMethod: ArkMethod, loadInfos: LoadAnimationInfo[], releaseMethods: ArkMethod[]): void {
        for (let stmt of arkMethod.getBody()?.getCfg()?.getStmts() ?? []) {
            let invokerExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokerExpr) {
                continue;
            }
            let methodSignature = invokerExpr.getMethodSignature();
            let methodSignatureStr = methodSignature.toString();
            let methodName = methodSignature.getMethodSubSignature().getMethodName();
            if (loadAnimationSignatureStrs.includes(methodSignatureStr)) {
                let animItemName = this.getInstanceName(stmt);
                let animName = this.getAnimName(arkFile, invokerExpr.getArg(0));
                loadInfos.push({ initStmt: stmt, animItemName: animItemName, animName: animName, destoryStmt: null });
            } else {
                this.findReleaseMethod(arkFile, invokerExpr, methodName, methodSignatureStr, releaseMethods);
            }
        }
        let methodName = arkMethod.getSubSignature().getMethodName();
        if (destoryMethods.includes(methodName)) {
            releaseMethods.push(arkMethod);
        }
    }

    private findReleaseMethod(arkFile: ArkFile, invokerExpr: AbstractInvokeExpr, methodName: string,
        methodSignatureStr: string, releaseMethods: ArkMethod[]): void {
        if (methodSignatureStr === addEventListenerSignatureStr) {
            let eventName = invokerExpr.getArg(0);
            if (!(eventName instanceof Constant)) {
                return;
            }
            if (eventName.getValue() !== 'complete') {
                return;
            }
            let callback = invokerExpr.getArg(1);
            let type = callback.getType();
            if (!(type instanceof FunctionType)) {
                return;
            }
            let animCompleteMethod = arkFile.getScene().getMethod(type.getMethodSignature());
            if (!animCompleteMethod) {
                logger.debug('Find FunctionType method error!');
                return;
            }
            releaseMethods.push(animCompleteMethod);
            return;
        }
        if (!destoryMethods.includes(methodName)) {
            return;
        }
        let invokeArgvs = invokerExpr.getArgs();
        for (let argv of invokeArgvs) {
            let type = argv.getType();
            if (!(type instanceof FunctionType)) {
                continue;
            }
            let anonymousMethod = arkFile.getScene().getMethod(type.getMethodSignature());
            if (!anonymousMethod) {
                logger.debug('Find FunctionType method error!');
                return;
            }
            releaseMethods.push(anonymousMethod);
        }
    }

    private getAnimName(arkFile: ArkFile, value: Value): string {
        if (!(value instanceof Local)) {
            return '';
        }
        let type = value.getType();
        if (!(type instanceof ClassType)) {
            return '';
        }
        let anonymousClassSignature = type.getClassSignature();
        let anonymousClass = arkFile.getClass(anonymousClassSignature);
        if (!anonymousClass) {
            return '';
        }
        let nameField = anonymousClass.getFieldWithName('name');
        if (!nameField) {
            return '';
        }
        let stmts = nameField.getInitializer();
        if (stmts.length === 0) {
            return '';
        }
        let stmt = stmts[0];
        if (!(stmt instanceof ArkAssignStmt)) {
            return '';
        }
        let initializer = stmt.getRightOp();
        if (!initializer) {
            return '';
        }
        if (initializer instanceof Constant) {
            return initializer.getValue();
        }
        if (initializer instanceof Local) {
            return initializer.getName();
        }
        if (initializer instanceof ArkInstanceFieldRef) {
            return initializer.getFieldName();
        }
        if (initializer instanceof ArkStaticFieldRef) {
            let baseName = initializer.getFieldSignature().getBaseName();
            return baseName + initializer.getFieldName();
        }
        return '';
    }

    private getInstanceName(stmt: Stmt | null): string {
        if (!stmt) {
            return '';
        }
        if (stmt instanceof ArkInvokeStmt) {
            return '';
        }
        if (!(stmt instanceof ArkAssignStmt)) {
            return '';
        }
        let leftOp = stmt.getLeftOp();
        if (!(leftOp instanceof Local)) {
            return '';
        }
        if (!leftOp.getName().includes('%')) {
            return leftOp.getName();
        }
        for (let useStmt of leftOp.getUsedStmts()) {
            if (!(useStmt instanceof ArkAssignStmt)) {
                continue;
            }
            let leftVal = useStmt.getLeftOp();
            if (leftVal instanceof ArkInstanceFieldRef) {
                return leftVal.getFieldName();
            }
        }
        return '';
    }

    private getInstanceBaseName(value: Value): string {
        if (!(value instanceof Local)) {
            return '';
        }
        if (!value.getName().includes('%')) {
            return value.getName();
        }
        let declaringStmt = value.getDeclaringStmt();
        if (!declaringStmt || !(declaringStmt instanceof ArkAssignStmt)) {
            return '';
        }
        let rightOp = declaringStmt.getRightOp();
        if (rightOp instanceof ArkInstanceFieldRef) {
            return rightOp.getFieldName();
        }
        return '';
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt, keyword: string): void {
        let filePath = arkFile.getFilePath();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let startColum = originalPosition.getColNo() + text.indexOf(keyword);
        let endColum = startColum + keyword.length - 1;
        filePath = arkFile.getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}