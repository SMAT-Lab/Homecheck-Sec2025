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
import { AbstractFieldRef, AbstractInvokeExpr, ArkAssignStmt, ArkAwaitExpr, ArkField, ArkFile, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkInvokeStmt, ArkMethod, ArkPtrInvokeExpr, ArkReturnStmt, ArkStaticFieldRef, ClassSignature, DEFAULT_ARK_CLASS_NAME, FunctionType, Local, MethodSignature, Scene, Stmt, Type, UnionType, UnknownType, Value } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { CheckerStorage, CheckerUtils, Defects, MatcherCallback, Rule } from '../../Index';
import { VarInfo } from '../../model/VarInfo';
import { StringUtils } from '../../utils/checker/StringUtils';
import { StmtExt } from '../../model/StmtExt';
import { IssueReport } from '../../model/Defects';

const multimediaAPI8CreateSignList: string[] = [
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.${DEFAULT_ARK_CLASS_NAME}.createAudioRenderer(@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRendererOptions, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRenderer>)`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.${DEFAULT_ARK_CLASS_NAME}.createAudioRenderer(@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRendererOptions, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRenderer,void>)`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.${DEFAULT_ARK_CLASS_NAME}.createAudioRenderer(@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRendererOptions)`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.${DEFAULT_ARK_CLASS_NAME}.createAudioCapturer(@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioCapturerOptions, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioCapturer>)`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.${DEFAULT_ARK_CLASS_NAME}.createAudioCapturer(@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioCapturerOptions)`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.${DEFAULT_ARK_CLASS_NAME}.createAudioCapturer(@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioCapturerOptions, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioCapturer,void>)`];
const multimediaAPI9CreateSignList: string[] = [
    `@ohosSdk/api/@ohos.multimedia.media.d.ts: media.${DEFAULT_ARK_CLASS_NAME}.createAVPlayer(@ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.media.d.ts: media.AVPlayer>)`,
    `@ohosSdk/api/@ohos.multimedia.media.d.ts: media.${DEFAULT_ARK_CLASS_NAME}.createAVPlayer()`,
    `@ohosSdk/api/@ohos.multimedia.media.d.ts: media.${DEFAULT_ARK_CLASS_NAME}.createAVPlayer(@ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.media.d.ts: media.AVPlayer,void>)`
];
const multimediaAPI11CreateSignList: string[] = [
    `@ohosSdk/api/@ohos.multimedia.audioHaptic.d.ts: audioHaptic.AudioHapticManager.createPlayer(number, AudioHapticPlayerOptions)`,
    `@ohosSdk/api/@ohos.multimedia.audioHaptic.d.ts: audioHaptic.AudioHapticManager.createPlayer(number, @ohosSdk/api/@ohos.multimedia.audioHaptic.d.ts: audioHaptic.AudioHapticPlayerOptions)`
];
const multimediaInterruptSignList: string[] = [
    `@ohosSdk/api/@ohos.multimedia.media.d.ts: media.AVPlayer.on('audioInterrupt', @ohosSdk/api/@ohos.base.d.ts: Callback<@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.InterruptEvent>)`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRenderer.on('audioInterrupt', @ohosSdk/api/@ohos.base.d.ts: Callback<@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.InterruptEvent>)`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioCapturer.on('audioInterrupt', @ohosSdk/api/@ohos.base.d.ts: Callback<@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.InterruptEvent>)`,
    `@ohosSdk/api/@ohos.multimedia.audioHaptic.d.ts: audioHaptic.AudioHapticPlayer.on('audioInterrupt', @ohosSdk/api/@ohos.base.d.ts: Callback<@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.InterruptEvent>)`
];
const multimediaTypeList: string[] = [
    `@ohosSdk/api/@ohos.multimedia.media.d.ts: media.AVPlayer`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRenderer`,
    `@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioCapturer`,
    `@ohosSdk/api/@ohos.multimedia.audioHaptic.d.ts: audioHaptic.AudioHapticPlayer`
];

const AUDIO_INTERRUPT = 'audioInterrupt';
const multimediaInterruptStmtList: Set<Stmt> = new Set();
const multimediaCreateList: CreateMultimediaInfo[] = [];
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AudioInterruptCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/audio-interrupt-check.md',
    description: 'When implementing audio playback or recording features in your app, make sure it listens for audio focus changes and acts accordingly.'
};

interface CreateMultimediaInfo {
    methodName: string;
    createStmt: Stmt;
    varInfo: Local | null;
    fieldInfo: ArkField | null;
    interruptInfo: Stmt | null;
}

enum UseType {
    CALLBACK,
    PROMISE_THEN,
    PROMISE_AWIT,
    UNKNOWN
}

export class AudioInterruptCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public issues: IssueReport[] = [];

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: undefined,
            callback: this.check
        };
        return [matchBuildCb];
    }

    public check = (scene: Scene): void => {
        for (let arkFile of scene.getFiles()) {
            this.processClass(arkFile);
        }
        this.commonInvokerMatch();
        for (let cmi of multimediaCreateList) {
            if (!cmi.interruptInfo) {
                let targetArkFile = cmi.createStmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
                if (!targetArkFile) {
                    continue;
                }
                this.reportIssue(targetArkFile, cmi.createStmt, cmi.methodName);
            }
        }
    };

    private processClass(arkFile: ArkFile): void {
        for (let clazz of arkFile.getClasses()) {
            for (let mtd of clazz.getMethods()) {
                this.processArkMethod(arkFile, mtd);
            }
        }
        for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
            for (let clazz of namespace.getClasses()) {
                for (let mtd of clazz.getMethods()) {
                    this.processArkMethod(arkFile, mtd);
                }
            }
        }
    }

    private processArkMethod(arkFile: ArkFile, method: ArkMethod): void {
        let busyMethods: Set<MethodSignature> = new Set();
        let stmts = method.getBody()?.getCfg()?.getStmts();
        if (!stmts) {
            return;
        }
        for (let i = 0; i < stmts.length; i++) {
            let stmt = stmts[i];
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invoker) {
                continue;
            }
            const methodSignature = invoker.getMethodSignature();
            const methodName = methodSignature.getMethodSubSignature().getMethodName();
            if (this.isAudioInterruptStmt(arkFile, stmt, invoker)) {
                multimediaInterruptStmtList.add(stmt);
                continue;
            }
            if (!this.isMultimediaCreateStmt(stmt)) {
                continue;
            }
            let createInfo: CreateMultimediaInfo = {
                methodName: methodName,
                createStmt: stmt,
                varInfo: null,
                fieldInfo: null,
                interruptInfo: null
            };
            multimediaCreateList.push(createInfo);
            if (stmt instanceof ArkInvokeStmt) {
                let callbackMethod = this.getInvokeCallbackMethod(arkFile, stmt, methodName);
                if (!callbackMethod) {
                    continue;
                }
                busyMethods.add(methodSignature);
                this.processCallbackMethod(arkFile, callbackMethod, 0, createInfo, busyMethods, UseType.CALLBACK);
                continue;
            }
            if (stmt instanceof ArkAssignStmt) {
                let leftOp = stmt.getLeftOp();
                if (this.isAwaitReturnStmt(stmt)) {
                    this.processCallbackMethod(arkFile, method, i, createInfo, busyMethods, UseType.PROMISE_AWIT);
                    continue;
                }
                let thenCallbackMethod = this.getPromiseThenCallbackMethod(arkFile, leftOp);
                if (!thenCallbackMethod) {
                    continue;
                }
                busyMethods.add(thenCallbackMethod.getSignature());
                this.processCallbackMethod(arkFile, thenCallbackMethod, 0, createInfo, busyMethods, UseType.PROMISE_THEN);
            }
        }
    }

    private isAwaitReturnStmt(stmt: ArkAssignStmt): boolean {
        let leftOp = stmt.getLeftOp();
        if (!(leftOp instanceof Local)) {
            return false;
        }
        if (!leftOp.getName().includes('%')) {
            return false;
        }
        let usedStmts = leftOp.getUsedStmts();
        for (let usedStmt of usedStmts) {
            if (!(usedStmt instanceof ArkAssignStmt)) {
                continue;
            }
            let rightOp = usedStmt.getRightOp();
            if (rightOp instanceof ArkAwaitExpr) {
                return true;
            }
        }
        return false;
    }

    private getPromiseThenCallbackMethod(arkFile: ArkFile, leftOp: Value): ArkMethod | null {
        if (!(leftOp instanceof Local)) {
            return null;
        }
        let usedStmts = leftOp.getUsedStmts();
        if (usedStmts.length === 0) {
            return null;
        }
        let firstStmt = usedStmts[0];
        let thenInvoker = CheckerUtils.getInvokeExprFromStmt(firstStmt);
        if (!thenInvoker) {
            return null;
        }
        let methodSignature = thenInvoker.getMethodSignature();
        let thenMethodName = methodSignature.getMethodSubSignature().getMethodName();
        if (thenMethodName !== 'then') {
            return null;
        }
        let args = thenInvoker.getArgs();
        if (args.length === 0) {
            return null;
        }
        let thenArg = args[0];
        if (!(thenArg instanceof Local)) {
            return null;
        }
        let thenArgType = thenArg.getType();
        if (!(thenArgType instanceof FunctionType)) {
            return null;
        }
        return arkFile.getScene().getMethod(thenArgType.getMethodSignature());
    }

    private processCallbackMethod(arkFile: ArkFile, callbackMethod: ArkMethod, index: number,
        createInfo: CreateMultimediaInfo, busyMethods: Set<MethodSignature>, useType: UseType): void {
        let stmts = callbackMethod.getBody()?.getCfg()?.getStmts();
        if (!stmts) {
            return;
        }
        for (let i = index; i < stmts.length; i++) {
            let stmt = stmts[i];
            if (stmt instanceof ArkAssignStmt && this.isInstanceAssignToVariable(callbackMethod, stmt, useType)) {
                this.parseRealAttachInstance(callbackMethod, stmt, createInfo, useType);
            } else if (stmt instanceof ArkInvokeStmt && this.isResolveAssignToVariable(arkFile, stmt, useType)) {
                let invokeExpr = stmt.getInvokeExpr();
                if (!(invokeExpr instanceof ArkPtrInvokeExpr)) {
                    continue;
                }
                let ptr = invokeExpr.getFuncPtrLocal();
                if (!(ptr instanceof ArkInstanceFieldRef)) {
                    continue;
                }
                let base = this.getFieldByBase(ptr.getBase());
                if (base && base instanceof Local) {
                    createInfo.varInfo = base;
                } else if (base && base instanceof ArkField) {
                    createInfo.varInfo = ptr.getBase();
                    createInfo.fieldInfo = base;
                }
            }
            let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invoker) {
                continue;
            }
            if (this.isAudioInterruptStmt(arkFile, stmt, invoker)) {
                this.parseInvokerAudioInterruptStmt(callbackMethod, stmt, invoker, createInfo, useType);
                continue;
            }
            for (let arg of invoker.getArgs()) {
                if (!this.isArgTypeMultimedia(callbackMethod, arg, useType)) {
                    continue;
                }
                let methodSignature = invoker.getMethodSignature();
                if (busyMethods.has(methodSignature)) {
                    continue;
                }
                busyMethods.add(methodSignature);
                let invokeChainMethod = arkFile.getScene().getMethod(methodSignature);
                if (!invokeChainMethod) {
                    continue;
                }
                this.processCallbackMethod(arkFile, invokeChainMethod, 0, createInfo, busyMethods, UseType.CALLBACK);
            }
        }
    }

    private parseRealAttachInstance(callbackMethod: ArkMethod, stmt: ArkAssignStmt, createInfo: CreateMultimediaInfo, useType: UseType): void {
        let leftOp = stmt.getLeftOp();
        if (leftOp instanceof Local) {
            createInfo.varInfo = leftOp;
            let useStmts = leftOp.getUsedStmts();
            for (let usedStmt of useStmts) {
                if (!(usedStmt instanceof ArkAssignStmt)) {
                    continue;
                }
                let usedLeftOp = usedStmt.getLeftOp();
                let usedRightOp = usedStmt.getRightOp();
                if (usedRightOp instanceof Local && usedRightOp.getName() === leftOp.getName()) {
                    this.parseRealAttachInstance(callbackMethod, usedStmt, createInfo, useType);
                } else if (usedLeftOp instanceof Local && usedRightOp instanceof ArkAwaitExpr) {
                    createInfo.varInfo = usedLeftOp;
                }
            }
        } else if (leftOp instanceof AbstractFieldRef) {
            createInfo.fieldInfo = callbackMethod.getDeclaringArkClass().getField(leftOp.getFieldSignature());
        } else {
            logger.debug('Process callback method unknown type.');
        }
    }

    private isArgTypeMultimedia(callbackMethod: ArkMethod, arg: Value, useType: UseType): boolean {
        if (!(arg instanceof Local)) {
            return false;
        }
        let argType = arg.getType();
        if (multimediaTypeList.includes(argType.toString())) {
            return true;
        }
        if (argType instanceof UnionType) {
            for (let type of argType.getTypes()) {
                if (multimediaTypeList.includes(type.toString())) {
                    return true;
                }
            }
        }
        let declaringStmt = arg.getDeclaringStmt();
        let backTrackCount = 0;
        while (declaringStmt && backTrackCount < 12) {
            if (this.isMultimediaCreateStmt(declaringStmt)) {
                return true;
            }
            if (declaringStmt instanceof ArkAssignStmt) {
                let leftOpType = declaringStmt.getLeftOp().getType().toString();
                let rightOp = declaringStmt.getRightOp();
                let rightOpType = rightOp.getType().toString();
                if (multimediaTypeList.includes(leftOpType) || multimediaTypeList.includes(rightOpType)) {
                    return true;
                }
                if (rightOp instanceof Local) {
                    declaringStmt = rightOp.getDeclaringStmt();
                } else {
                    break;
                }
            } else {
                break;
            }
            backTrackCount++;
        }
        if (useType === UseType.CALLBACK || useType === UseType.PROMISE_THEN) {
            let parameter = callbackMethod.getParameters().find((param) => {
                return param.getName() === arg.getName();
            });
            return parameter !== undefined;
        }
        return false;
    }

    private getInvokeCallbackMethod(arkFile: ArkFile, stmt: ArkInvokeStmt, methodName: string): ArkMethod | null {
        let arg: Value | null = null;
        if (methodName === 'createAVPlayer') {
            arg = stmt.getInvokeExpr().getArg(0);
        } else if (methodName === 'createAudioRenderer' || methodName === 'createAudioCapturer') {
            arg = stmt.getInvokeExpr().getArg(1);
        }
        if (!arg) {
            return null;
        }
        if (!(arg instanceof Local)) {
            return null;
        }
        let type = arg.getType();
        if (!(type instanceof FunctionType)) {
            return null;
        }
        return arkFile.getScene().getMethod(type.getMethodSignature());
    }

    private parseInvokerAudioInterruptStmt(callbackMethod: ArkMethod, stmt: Stmt, invoker: AbstractInvokeExpr,
        createInfo: CreateMultimediaInfo, useType: UseType): void {
        if (!(invoker instanceof ArkInstanceInvokeExpr)) {
            return;
        }
        let base = invoker.getBase();
        let baseInfo = this.getFieldByBase(base);
        if (!baseInfo) {
            logger.debug('Can not find invoker base.');
            return;
        }
        let localInfo = createInfo.varInfo;
        if (localInfo && baseInfo instanceof Local && baseInfo.getName() === localInfo.getName()) {
            createInfo.interruptInfo = stmt;
            return;
        }
        let fieldInfo = createInfo.fieldInfo;
        if (fieldInfo && baseInfo instanceof ArkField &&
            (fieldInfo.getSignature().toString() === baseInfo.getSignature().toString())) {
            createInfo.interruptInfo = stmt;
            return;
        }
        if (useType === UseType.CALLBACK || useType === UseType.PROMISE_THEN) {
            let targetParam = callbackMethod.getParameters().find((param) => param.getName() === baseInfo?.getName());
            if (targetParam) {
                createInfo.interruptInfo = stmt;
                return;
            }
        }
        if (baseInfo instanceof Local) {
            createInfo.varInfo = baseInfo;
        } else if (baseInfo instanceof AbstractFieldRef) {
            createInfo.fieldInfo = baseInfo;
        }
        multimediaInterruptStmtList.add(stmt);
        this.commonInvokerMatch();
    }

    private getFieldByBase(base: Local): ArkField | Local | null {
        let callMethod = base.getDeclaringStmt()?.getCfg()?.getDeclaringMethod();
        if (!callMethod) {
            return base;
        }
        if (!base.getName().includes('%')) {
            if (callMethod.getBody()?.getLocals().has(base.getName())) {
                return base;
            }
        } else {
            let declaringStmt = base.getDeclaringStmt();
            if (!declaringStmt || !(declaringStmt instanceof ArkAssignStmt)) {
                return null;
            }
            let rightOp = declaringStmt.getRightOp();
            if (rightOp instanceof ArkInstanceFieldRef) {
                return callMethod.getDeclaringArkClass().getField(rightOp.getFieldSignature());
            } else if (rightOp instanceof ArkStaticFieldRef) {
                let classSignature = rightOp.getFieldSignature().getDeclaringSignature();
                if (!(classSignature instanceof ClassSignature)) {
                    return null;
                }
                let targetClass = callMethod.getDeclaringArkFile().getScene().getClass(classSignature);
                if (!targetClass) {
                    return null;
                }
                return targetClass.getField(rightOp.getFieldSignature());
            } else {
                logger.debug('Temp variable unknown type, not implement.');
            }
        }
        return null;
    }

    private commonInvokerMatch(): void {
        for (let cmi of multimediaCreateList) {
            if (cmi.interruptInfo) {
                continue;
            }
            for (let stmt of multimediaInterruptStmtList) {
                let invoker = stmt.getInvokeExpr();
                if (!invoker || !(invoker instanceof ArkInstanceInvokeExpr)) {
                    continue;
                }
                let base = invoker.getBase();
                if (this.isInvokerAndStmtMatch(cmi, base)) {
                    cmi.interruptInfo = stmt;
                    break;
                }
            }
        }
    }

    private isInvokerAndStmtMatch(cmi: CreateMultimediaInfo, base: Local): boolean {
        let baseInfo = this.getFieldByBase(base);
        if (!baseInfo) {
            return false;
        }
        let fieldInfo = cmi.fieldInfo;
        if (fieldInfo && (baseInfo instanceof ArkField) &&
            fieldInfo.getSignature().toString() === baseInfo.getSignature().toString()) {
            return true;
        }
        let localInfo = cmi.varInfo;
        if (localInfo && (baseInfo instanceof Local) && !baseInfo.getName().includes('%') &&
            localInfo.getName() === baseInfo.getName()) {
            return true;
        }
        let declaringStmt = base.getDeclaringStmt();
        while (declaringStmt && (declaringStmt instanceof ArkAssignStmt)) {
            let leftOp = declaringStmt.getLeftOp();
            if (leftOp instanceof Local && this.isDesignatedField(leftOp, declaringStmt, fieldInfo, localInfo)) {
                return true;
            }
            let invokeExpr = CheckerUtils.getInvokeExprFromAwaitStmt(declaringStmt);
            if (!invokeExpr) {
                return false;
            }
            let targetArkFile = declaringStmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
            if (!targetArkFile) {
                return false;
            }
            let invokeMethod = targetArkFile.getScene().getMethod(invokeExpr.getMethodSignature());
            if (!invokeMethod) {
                return false;
            }
            let returnOp = this.getReturnOp(invokeMethod);
            if (!returnOp) {
                return false;
            }
            declaringStmt = returnOp.getDeclaringStmt();
        }
        return false;
    }

    public isDesignatedField(leftOp: Local, declaringStmt: ArkAssignStmt, fieldInfo: ArkField | null,
        localInfo: Local | null): boolean {
        if (leftOp.getName().includes('%')) {
            let rightOp = declaringStmt.getRightOp();
            if (fieldInfo && rightOp instanceof AbstractFieldRef &&
                rightOp.getFieldSignature().toString() === fieldInfo.getSignature().toString()) {
                return true;
            }
        } else {
            if (localInfo && localInfo.getName() === leftOp.getName()) {
                return true;
            }
            if (this.isMultimediaCreateStmt(declaringStmt)) {
                return true;
            }
        }
        return false;
    }

    private getReturnOp(invokeMethod: ArkMethod): Local | null {
        let blocks = invokeMethod.getCfg()?.getBlocks();
        if (!blocks) {
            return null;
        }
        for (let block of blocks) {
            let tailStmt = block.getTail();
            if (tailStmt && tailStmt instanceof ArkReturnStmt) {
                let returnOp = tailStmt.getOp();
                if (returnOp instanceof Local) {
                    return returnOp;
                }
            }
        }
        return null;
    }

    private isResolveAssignToVariable(arkFile: ArkFile, stmt: ArkInvokeStmt, useType: UseType): boolean {
        const invoke = stmt.getInvokeExpr();
        if (!(invoke instanceof ArkPtrInvokeExpr)) {
            return false;
        }
        let fieldRef = invoke.getFuncPtrLocal();
        if (!(fieldRef instanceof AbstractFieldRef)) {
            return false;
        }
        let fieldName = fieldRef.getFieldName();
        if (fieldName !== 'resolve') {
            return false;
        }
        let declareSignature = fieldRef.getFieldSignature().getDeclaringSignature();
        let resolveClass = arkFile.getScene().getClass(declareSignature as ClassSignature);
        if (!resolveClass) {
            return false;
        }
        let superClassName = resolveClass.getSuperClassName();
        if (superClassName === 'Promise<T>') {
            return true;
        }
        return false;
    }

    private isInstanceAssignToVariable(callbackMethod: ArkMethod, stmt: ArkAssignStmt, useType: UseType): boolean {
        let rightOp = stmt.getRightOp();
        let rightType = rightOp.getType();
        if (this.typeProcess(useType, stmt, rightType, rightOp)) {
            return true;
        }
        if (!(rightOp instanceof Local)) {
            return false;
        }
        let hasInLocal = callbackMethod.getBody()?.getLocals().has(rightOp.getName());
        if (!hasInLocal) {
            return false;
        }
        if (!this.isArgTypeMultimedia(callbackMethod, rightOp, useType)) {
            logger.debug('Maybe include middle variables, not implement.');
        }
        if (!(rightType instanceof UnknownType) && multimediaTypeList.includes(rightType.toString())) {
            return true;
        }
        let leftOp = stmt.getLeftOp();
        let leftType = leftOp.getType();
        let parameters = callbackMethod.getParameters();
        if (parameters.length === 0) {
            return false;
        }
        let parameterType = parameters[parameters.length - 1].getType();
        if (parameterType instanceof UnknownType && rightType instanceof UnknownType && leftType instanceof UnknownType) {
            return true;
        } else if (!(parameterType instanceof UnknownType) || !(rightType instanceof UnknownType) || !(leftOp instanceof AbstractFieldRef)) {
            return false;
        }
        if (!(leftType instanceof UnionType)) {
            return multimediaTypeList.includes(leftType.toString());
        }
        for (let type of leftType.getTypes()) {
            if (multimediaTypeList.includes(type.toString())) {
                return true;
            }
        }
        return false;
    }

    private typeProcess(useType: UseType, stmt: ArkAssignStmt, rightType: Type, rightOp: Value): boolean {
        if (useType === UseType.PROMISE_AWIT) {
            if (this.isAwaitReturnStmt(stmt) && this.isMultimediaCreateStmt(stmt)) {
                return true;
            }
        }
        if (useType !== UseType.CALLBACK && useType !== UseType.PROMISE_THEN) {
            if (multimediaTypeList.includes(rightType.toString())) {
                return true;
            }
        }
        return false;
    }

    private isMultimediaCreateStmt(stmt: Stmt): boolean {
        let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invoker) {
            return false;
        }
        const methodSignature = invoker.getMethodSignature();
        const methodSignatureStr = methodSignature.toString();
        let apiVersion = CheckerStorage.getInstance().getApiVersion();
        if (apiVersion < 8) {
            return false;
        }
        if (apiVersion < 9) {
            return multimediaAPI8CreateSignList.includes(methodSignatureStr);
        }
        if (apiVersion < 11) {
            return multimediaAPI8CreateSignList.includes(methodSignatureStr) || multimediaAPI9CreateSignList.includes(methodSignatureStr);
        }
        return multimediaAPI8CreateSignList.includes(methodSignatureStr) ||
            multimediaAPI9CreateSignList.includes(methodSignatureStr) || multimediaAPI11CreateSignList.includes(methodSignatureStr);
    }

    private isAudioInterruptStmt(arkFile: ArkFile, stmt: Stmt, invoker: AbstractInvokeExpr): boolean {
        if (!this.isAudioInterruptSignature(arkFile, invoker)) {
            return false;
        }
        let args = invoker.getArgs();
        if (args.length === 0) {
            return false;
        }
        let arg0 = args[0];
        let varInfo = new VarInfo(stmt, (stmt as StmtExt).scope);
        let interruptStr = StringUtils.getStringByScope(arkFile, varInfo, arg0);
        return interruptStr === AUDIO_INTERRUPT;
    }

    private isAudioInterruptSignature(arkFile: ArkFile, invoker: AbstractInvokeExpr): boolean {
        const methodSignature = invoker.getMethodSignature();
        const classSignatureStr = methodSignature.getDeclaringClassSignature().toString();
        if (!multimediaTypeList.includes(classSignatureStr)) {
            return false;
        }
        let methodName = methodSignature.getMethodSubSignature().getMethodName();
        if (methodName !== 'on') {
            return false;
        }
        let onArkMethod = arkFile.getScene().getMethod(methodSignature);
        if (!onArkMethod) {
            return false;
        }
        let declareSignatures = onArkMethod.getDeclareSignatures();
        if (!declareSignatures) {
            return false;
        }
        for (let declareSignature of declareSignatures) {
            let declareSignatureStr = declareSignature.toString();
            if (multimediaInterruptSignList.includes(declareSignatureStr)) {
                return true;
            }
        }
        return false;
    }

    private reportIssue(arkFile: ArkFile, stmt: Stmt, methodName: string): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.debug('Stmt text is empty.');
            return;
        }
        let methodNameIndex = text.indexOf(methodName);
        if (methodNameIndex === -1) {
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let startColum = originalPosition.getColNo() + methodNameIndex;
        let endColum = startColum + methodName.length - 1;
        let filePath = arkFile.getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}