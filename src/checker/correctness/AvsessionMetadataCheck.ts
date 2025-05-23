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

import { AbstractFieldRef, AbstractInvokeExpr, ArkAssignStmt, ArkAwaitExpr, ArkClass, ArkField, ArkFile, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkInvokeStmt, ArkMethod, ArkNewExpr, ArkReturnStmt, ArkStaticFieldRef, ClassSignature, ClassType, DEFAULT_ARK_CLASS_NAME, FunctionType, Local, MethodSignature, Scene, Stmt, UnionType, UnknownType, Value } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerStorage, CheckerUtils, Defects, MatcherCallback, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from '../../model/Defects';

const multimediaAPI10CreateSignList: string[] = [
    `@ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.${DEFAULT_ARK_CLASS_NAME}.createAVSession(@ohosSdk/api/application/BaseContext.d.ts: BaseContext, string, @ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.${DEFAULT_ARK_CLASS_NAME}.[static]${DEFAULT_ARK_CLASS_NAME}()#AVSessionType)`,
    `@ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.${DEFAULT_ARK_CLASS_NAME}.createAVSession(Context, string, @ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.${DEFAULT_ARK_CLASS_NAME}.[static]${DEFAULT_ARK_CLASS_NAME}()#AVSessionType)`,
    `@ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.${DEFAULT_ARK_CLASS_NAME}.createAVSession(@ohosSdk/api/application/BaseContext.d.ts: BaseContext, string, @ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.${DEFAULT_ARK_CLASS_NAME}.[static]${DEFAULT_ARK_CLASS_NAME}()#AVSessionType, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.AVSession,void>)`,
    `@ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.${DEFAULT_ARK_CLASS_NAME}.createAVSession(Context, string, @ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.${DEFAULT_ARK_CLASS_NAME}.[static]${DEFAULT_ARK_CLASS_NAME}()#AVSessionType, @ohosSdk/api/@ohos.base.d.ts: AsyncCallback<@ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.AVSession,void>)`
];
const multimediaTypeList: string[] = [
    `@ohosSdk/api/@ohos.multimedia.avsession.d.ts: avSession.AVSession`
];

const multimediaStmtList: Set<Stmt> = new Set();
const multimediaCreateList: CreateMultimediaInfo[] = [];
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AvsessionMetadataCheck');
const SETAVMETADATA: string = 'setAVMetadata';
const SETAVPLAYBACKSTATE: string = 'setAVPlaybackState';
const fieldInfo: string[] = ['mediaImage', 'title', 'author', 'subtitle', 'duration', 'state', 'position'];
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/avsession-metadata-check.md',
    description: 'After creating an AV session, ' + 'an audio/video app should provide basic metadata and playback status information for the session.'
};

interface CreateMultimediaInfo {
    methodName: string;
    createStmt: Stmt;
    varInfo: Local | null;
    fieldInfo: ArkField | null;
    avMetadataStmt: Stmt | null;
    avPlaybackStateStmt: Stmt | null;

}

enum UseType {
    CALLBACK,
    PROMISE_THEN,
    PROMISE_AWIT,
    UNKNOWN
}

export class AvsessionMetadataCheck implements BaseChecker {
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
        for (let arkFile of scene.getFiles()) {
            this.processClass(arkFile);
        }
        this.commonInvokerMatch();
        for (let cmi of multimediaCreateList) {
            this.processReportIssue(cmi);
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

    private processReportIssue(cmi: CreateMultimediaInfo): void {
        if (cmi.avMetadataStmt && cmi.avPlaybackStateStmt) {
            if (!(this.getMultipleScenariosField(cmi.avMetadataStmt) && this.getMultipleScenariosField(cmi.avPlaybackStateStmt))) {
                let targetArkFile = cmi.createStmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
                if (!targetArkFile) {
                    return;
                }
                this.reportIssue(targetArkFile, cmi.createStmt, cmi.methodName);
            }
        } else {
            let targetArkFile = cmi.createStmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
            if (!targetArkFile) {
                return;
            }
            this.reportIssue(targetArkFile, cmi.createStmt, cmi.methodName);
        }
    }

    private getMultipleScenariosField(stmt: Stmt): boolean {
        let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invoker) {
            return false;
        }
        let args = invoker.getArgs();
        let arg = args[0];
        if (!(arg instanceof Local)) {
            return false;
        }
        let name = arg.getName();
        if (name.includes('%')) {
            name = this.getNewName(arg);
        }
        let newFieldList = this.getField(stmt, arg, name);
        let methodName = invoker.getMethodSignature().getMethodSubSignature().getMethodName();
        if (methodName === SETAVMETADATA) {
            return this.isHasAuthorAndSubtitle(newFieldList);
        } else {
            return newFieldList.size === 2;
        }
    }

    private getNewName(arg: Local): string {
        let newName = '';
        let declaringStmt = arg.getDeclaringStmt();
        if (!(declaringStmt instanceof ArkAssignStmt)) {
            return newName;
        }
        let rightOp = declaringStmt.getRightOp();
        if (!rightOp) {
            return newName;
        }
        if (rightOp instanceof AbstractFieldRef) {
            newName = rightOp.getFieldName();
        }
        return newName;
    }

    private getField(stmt: Stmt, arg: Local, name: string): Set<string> {
        let newFieldList = new Set<string>();
        // 场景一：方法内部
        let method = stmt.getCfg().getDeclaringMethod();
        newFieldList = this.traversalLocals(method, arg);
        if (newFieldList.size !== 0) {
            return newFieldList;
        }
        // 场景二：普通成员变量
        let clazz = method.getDeclaringArkClass();
        newFieldList = this.traversalFields(clazz, name);
        if (newFieldList.size !== 0) {
            return newFieldList;
        }
        // 场景三：静态成员变量
        newFieldList = this.traversalStaticFields(clazz, arg, name);
        if (newFieldList.size !== 0) {
            return newFieldList;
        }
        // 场景四：全局变量
        let arkFile = clazz.getDeclaringArkFile();
        newFieldList = this.traversalDefaultClass(arkFile, name);
        if (newFieldList.size !== 0) {
            return newFieldList;
        }
        // 场景五：import模块
        let imports = arkFile.getImportInfos();
        for (let subImport of imports) {
            if (subImport.getImportClauseName() !== name) {
                continue;
            }
            let arkFile = subImport.getLazyExportInfo()?.getDeclaringArkFile();
            if (!arkFile) {
                continue;
            }
            newFieldList = this.traversalDefaultClass(arkFile, name);
        }
        return newFieldList;
    }

    private traversalLocals(method: ArkMethod, arg: Local): Set<string> {
        let newFieldList = new Set<string>();
        let declaringStmt = arg.getDeclaringStmt();
        if (!(declaringStmt instanceof ArkAssignStmt)) {
            return newFieldList;
        }
        let rightOp = declaringStmt.getRightOp();
        if (!(rightOp instanceof Local)) {
            return newFieldList;
        }
        let type = rightOp.getType();
        if (!(type instanceof ClassType)) {
            return newFieldList;
        }
        let arkClass = method.getDeclaringArkFile().getScene().getClass(type.getClassSignature());
        let fields = arkClass?.getFields();
        if (!fields) {
            return newFieldList;
        }
        for (let field of fields) {
            if (!fieldInfo.includes(field.getName())) {
                continue;
            }
            newFieldList.add(field.getName());
        }
        return newFieldList;
    }

    private traversalFields(clazz: ArkClass, name: string): Set<string> {
        let newFieldList = new Set<string>();
        for (let field of clazz.getFields()) {
            if (field.getName() !== name) {
                continue;
            }
            newFieldList = this.isArkFieldGetFields(clazz, field);
        }
        return newFieldList;
    }

    private traversalStaticFields(clazz: ArkClass, arg: Local, name: string): Set<string> {
        let newFieldList = new Set<string>();
        let declaringStmt = arg.getDeclaringStmt();
        if (!(declaringStmt instanceof ArkAssignStmt)) {
            return newFieldList;
        }
        let rightOp = declaringStmt.getRightOp();
        if (rightOp instanceof ArkStaticFieldRef) {
            let fieldSignature = rightOp.getFieldSignature();
            let declareSignature = fieldSignature.getDeclaringSignature();
            if (!(declareSignature instanceof ClassSignature)) {
                return newFieldList;
            }
            let declareClass = clazz.getDeclaringArkFile().getScene().getClass(declareSignature);
            let field = declareClass?.getStaticFieldWithName(name);
            if (!field) {
                return newFieldList;
            }
            newFieldList = this.isArkFieldGetFields(clazz, field);
        }
        return newFieldList;
    }

    private traversalDefaultClass(arkFile: ArkFile, name: string): Set<string> {
        let newFieldList = new Set<string>();
        let defaultClass = arkFile.getDefaultClass();
        let method = defaultClass.getMethods()[0];
        let locals = method.getBody()?.getLocals();
        if (!locals) {
            return newFieldList;
        }
        for (let [key, value] of locals) {
            if (!(value instanceof Local)) {
                continue;
            }
            if (key !== name) {
                continue;
            }
            newFieldList = this.traversalLocals(method, value);
        }
        return newFieldList;
    }

    private isArkFieldGetFields(clazz: ArkClass, field: ArkField): Set<string> {
        let newFieldList = new Set<string>();
        let initializer = field.getInitializer()[0];
        if (initializer instanceof ArkAssignStmt) {
            let rightOp = initializer.getRightOp();
            if (!(rightOp instanceof ArkNewExpr)) {
                return newFieldList;
            }
            let type = rightOp.getClassType();
            let arkClass = clazz.getDeclaringArkFile().getClass(type.getClassSignature());
            let fields = arkClass?.getFields();
            if (!fields) {
                return newFieldList;
            }
            for (let field of fields) {
                if (fieldInfo.includes(field.getName())) {
                    newFieldList.add(field.getName());
                }
            }
        }
        return newFieldList;
    }

    private isHasAuthorAndSubtitle(newFieldList: Set<string>): boolean {
        if (newFieldList.size === 5) {
            return true;
        }
        if (newFieldList.size === 4) {
            if (newFieldList.has('author') && newFieldList.has('subtitle')) {
                return false;
            } else {
                return true;
            }
        }
        return false;
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
            if (this.isAudioInterruptStmt(invoker)) {
                multimediaStmtList.add(stmt);
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
                avMetadataStmt: null,
                avPlaybackStateStmt: null,
            };
            multimediaCreateList.push(createInfo);
            if (stmt instanceof ArkInvokeStmt) {
                let callbackMethod = this.getInvokeCallbackMethod(arkFile, stmt, methodName, invoker);
                if (!callbackMethod) {
                    continue;
                }
                busyMethods.add(methodSignature);
                this.processCallbackMethod(arkFile, callbackMethod, 0, createInfo, busyMethods, UseType.CALLBACK);
            }
            if (stmt instanceof ArkAssignStmt) {
                let leftOp = stmt.getLeftOp();
                if (this.isAwaitReturnStmt(stmt)) {
                    this.processCallbackMethod(arkFile, method, i, createInfo, busyMethods, UseType.PROMISE_AWIT);
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
            }
            if (stmt instanceof ArkInvokeStmt && this.isResolveAssignToVariable(arkFile, stmt, useType)) {
                this.handleInvokeStmt(stmt, createInfo);
            }
            this.handleInvoker(callbackMethod, stmt, createInfo, busyMethods, useType);
        }
    }

    private handleInvokeStmt(stmt: ArkInvokeStmt, createInfo: CreateMultimediaInfo): void {
        let invokeExpr = stmt.getInvokeExpr();
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            let base = this.getFieldByBase(invokeExpr.getBase());
            if (base && base instanceof Local) {
                createInfo.varInfo = base;
            } else if (base && base instanceof ArkField) {
                createInfo.varInfo = invokeExpr.getBase();
                createInfo.fieldInfo = base;
            }
        }
    }

    private handleInvoker(callbackMethod: ArkMethod, stmt: Stmt, createInfo: CreateMultimediaInfo, busyMethods: Set<MethodSignature>, useType: UseType): void {
        let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invoker) {
            return;
        }
        if (this.isAudioInterruptStmt(invoker)) {
            this.parseInvokerAudioInterruptStmt(callbackMethod, stmt, invoker, createInfo, useType);
            return;
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
            let invokeChainMethod = callbackMethod.getDeclaringArkFile().getScene().getMethod(methodSignature);
            if (!invokeChainMethod) {
                continue;
            }
            this.processCallbackMethod(callbackMethod.getDeclaringArkFile(), invokeChainMethod, 0, createInfo, busyMethods, UseType.CALLBACK);
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
            let parameter = callbackMethod.getParameters().find((param) => param.getName() === arg.getName());
            return parameter !== undefined;
        }
        return false;
    }

    private getInvokeCallbackMethod(arkFile: ArkFile, stmt: ArkInvokeStmt, methodName: string, invoker: AbstractInvokeExpr): ArkMethod | null {
        let arg: Value | null = null;
        if (methodName === 'createAVSession') {
            const methodSignature = invoker.getMethodSignature();
            arg = stmt.getInvokeExpr().getArg(3);
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
        let methodName = invoker.getMethodSignature().getMethodSubSignature().getMethodName();
        let baseInfo = this.getFieldByBase(base);
        if (!baseInfo) {
            logger.info('Can not find invoker base.');
            return;
        }
        let localInfo = createInfo.varInfo;
        if (localInfo && baseInfo instanceof Local && baseInfo.getName() === localInfo.getName()) {
            if (methodName === SETAVMETADATA) {
                createInfo.avMetadataStmt = stmt;
            } else {
                createInfo.avPlaybackStateStmt = stmt;
            }
            return;
        }
        let fieldInfo = createInfo.fieldInfo;
        if (fieldInfo && baseInfo instanceof ArkField &&
            (fieldInfo.getSignature().toString() === baseInfo.getSignature().toString())) {
            if (methodName === SETAVMETADATA) {
                createInfo.avMetadataStmt = stmt;
            } else {
                createInfo.avPlaybackStateStmt = stmt;
            }
            return;
        }
        if (useType === UseType.CALLBACK || useType === UseType.PROMISE_THEN) {
            let targetParam = callbackMethod.getParameters().find((param) => param.getName() === baseInfo?.getName());
            if (targetParam) {
                this.setStmt(methodName, createInfo, stmt);
                return;
            }
        }
        if (baseInfo instanceof Local) {
            createInfo.varInfo = baseInfo;
        } else if (baseInfo instanceof AbstractFieldRef) {
            createInfo.fieldInfo = baseInfo;
        }
        multimediaStmtList.add(stmt);
        this.commonInvokerMatch();
    }

    private setStmt(methodName: string, createInfo: CreateMultimediaInfo, stmt: Stmt): void {
        if (methodName === SETAVMETADATA) {
            createInfo.avMetadataStmt = stmt;
        } else {
            createInfo.avPlaybackStateStmt = stmt;
        }
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
            if (cmi.avMetadataStmt && cmi.avPlaybackStateStmt) {
                continue;
            }
            this.findMatchingStmt(cmi);
        }
    }

    private findMatchingStmt(cmi: CreateMultimediaInfo): void {
        for (let stmt of multimediaStmtList) {
            let invoker = stmt.getInvokeExpr();
            if (!invoker || !(invoker instanceof ArkInstanceInvokeExpr)) {
                continue;
            }
            let base = invoker.getBase();
            let methodName = invoker.getMethodSignature().getMethodSubSignature().getMethodName();
            if (this.isInvokerAndStmtMatch(cmi, base)) {
                if (methodName === SETAVMETADATA) {
                    cmi.avMetadataStmt = stmt;
                } else {
                    cmi.avPlaybackStateStmt = stmt;
                }
                if (cmi.avMetadataStmt && cmi.avPlaybackStateStmt) {
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

    private isDesignatedField(leftOp: Local, declaringStmt: ArkAssignStmt, fieldInfo: ArkField | null,
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
        let methodSignature = stmt.getInvokeExpr().getMethodSignature();
        let methodName = methodSignature.getMethodSubSignature().getMethodName();
        if (methodName !== 'resolve') {
            return false;
        }
        let declareSignature = methodSignature.getDeclaringClassSignature();
        let resolveClass = arkFile.getScene().getClass(declareSignature);
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
        if (!(rightOp instanceof Local)) {
            return false;
        }
        let hasInLocal = callbackMethod.getBody()?.getLocals().has(rightOp.getName());
        if (!hasInLocal) {
            return false;
        }
        if (this.isArgTypeMultimedia(callbackMethod, rightOp, useType)) {
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
            if (parameterType instanceof UnknownType && rightOp instanceof UnknownType && (leftOp instanceof AbstractFieldRef)) {
                if (leftType instanceof UnionType) {
                    return this.isType(leftType);
                } else {
                    return multimediaTypeList.includes(leftType.toString());
                }
            }
        } else {
            logger.debug('Maybe include middle variables, not implement.');
        }
        return false;
    }

    private isType(leftType: UnionType): boolean {
        for (let type of leftType.getTypes()) {
            if (multimediaTypeList.includes(type.toString())) {
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
        if (apiVersion < 10) {
            return false;
        }
        return multimediaAPI10CreateSignList.includes(methodSignatureStr);
    }

    private isAudioInterruptStmt(invoker: AbstractInvokeExpr): boolean {
        const methodSignature = invoker.getMethodSignature();
        const classSignatureStr = methodSignature.getDeclaringClassSignature().toString();
        if (!multimediaTypeList.includes(classSignatureStr)) {
            return false;
        }
        let methodName = methodSignature.getMethodSubSignature().getMethodName();
        if (methodName === SETAVMETADATA || methodName === SETAVPLAYBACKSTATE) {
            return true;
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