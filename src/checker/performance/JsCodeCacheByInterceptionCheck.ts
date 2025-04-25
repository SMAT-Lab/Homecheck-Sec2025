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

import { AbstractInvokeExpr, ArkAssignStmt, ArkConditionExpr, ArkField, ArkFile, ArkIfStmt, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkMethod, ArkNewExpr, ArkStaticFieldRef, ArrayType, BasicBlock, BooleanType, ClassSignature, ClassType, Constant, FunctionType, Local, MethodSignature, PrimitiveType, Scene, Stmt, StringType, Type, UnknownType, Value, ViewTreeNode } from 'arkanalyzer';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, ClassMatcher, MatcherTypes, MatcherCallback, CheckerStorage, CheckerUtils, ScopeType } from '../../Index';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { StmtExt } from '../../model/StmtExt';
import { VarInfo } from '../../model/VarInfo';
import { StringUtils } from '../../utils/checker/StringUtils';
import { IssueReport } from '../../model/Defects';

const MIN_VERSION = 9;
const visitedMethod: Set<MethodSignature> = new Set();
const customSchemeMap: Map<string, CustomScheme> = new Map();
const schemeCmpMethods: string[] = ['startsWith', 'includes'];
const urlCmpMethods: string[] = ['endsWith', 'indexOf'];
let hasCustomSchemeCached = false;
const customizeSchemesSignatureStr = '@ohosSdk/api/@ohos.web.webview.d.ts: webview.WebviewController.[static]customizeSchemes(@ohosSdk/api/@ohos.web.webview.d.ts: webview.WebCustomScheme[])';
const webCustomSchemeSignatureStr = '@ohosSdk/api/@ohos.web.webview.d.ts: webview.WebCustomScheme';
const setResponseHeaderSignatureStr = '@ohosSdk/component/web.d.ts: WebResourceResponse.setResponseHeader(@ohosSdk/component/web.d.ts: Header[])';
const webResourceRequestTypeStr = '@ohosSdk/component/web.d.ts: WebResourceRequest';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/js-code-cache-by-interception-check.md',
    description: 'In scenarios involving JavaScript resource interception and replacement, set ResponseDataID to generate bytecode cache for faster page loading.',
    extendField: 'In scenarios involving JavaScript resource interception and replacement, enable bytecode cache in the custom protocol registration phase for faster page loading.'
};
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'JsCodeCacheByInterceptionCheck');

interface ResourceUrl {
    scheme: string;
    suffix: string;
}

interface CustomScheme {
    scheme: string;
    isCodeCacheSupported: boolean;
    field: ArkField;
}

export class JsCodeCacheByInterceptionCheck implements BaseChecker {
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
        if (!arkClass.hasViewTree() || this.viewTreeTool.hasTraverse(arkClass)) {
            return;
        }
        let viewRoot = arkClass.getViewTree()?.getRoot();
        if (!viewRoot) {
            return;
        }
        this.traverseViewTree(arkClass.getDeclaringArkFile(), viewRoot);
    }

    private traverseViewTree(arkFile: ArkFile, treeNode: ViewTreeNode): void {
        if (!treeNode) {
            return;
        }
        if (treeNode.isCustomComponent()) {
            return;
        }
        if (treeNode.name === 'Web') {
            let stmts = treeNode.attributes.get('onInterceptRequest');
            if (!stmts) {
                return;
            }
            let stmt = stmts[0];
            let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                return;
            }
            if (invokeExpr.getArgs().length === 0) {
                return;
            }
            let argType = invokeExpr.getArg(0).getType();
            if (!(argType instanceof FunctionType)) {
                return;
            }
            let interceptMethod = arkFile.getScene().getMethod(argType.getMethodSignature());
            if (!interceptMethod) {
                return;
            }
            this.processOnInterceptRequestMethod(arkFile, treeNode, interceptMethod);
        } else {
            for (let children of treeNode.children) {
                this.traverseViewTree(arkFile, children);
            }
        }
    }

    private traverseStmts(arkFile: ArkFile, treeNode: ViewTreeNode, interceptMethod: ArkMethod, gResUrl: ResourceUrl): void {
        const stmts = interceptMethod.getCfg()?.getStmts() ?? [];
        for (let i = 0; i < stmts.length; i++) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmts[i]);
            if (!invokeExpr || invokeExpr.getArgs().length === 0) {
                continue;
            }
            const methodName = invokeExpr.getMethodSignature().getMethodSubSignature().getMethodName();
            if (schemeCmpMethods.includes(methodName)) {
                this.parseTargetArg(arkFile, stmts[i], invokeExpr.getArgs()[0], gResUrl);
            }
            const argTypes = this.getArgType(invokeExpr);
            if (!argTypes.includes(webResourceRequestTypeStr)) {
                continue;
            }
            const invokeMethod = arkFile.getScene().getMethod(invokeExpr.getMethodSignature());
            if (!invokeMethod) {
                continue;
            }
            this.processOnInterceptRequestMethod(arkFile, treeNode, invokeMethod);
        }
    }

    private processBlocks(arkFile: ArkFile, treeNode: ViewTreeNode, interceptMethod: ArkMethod, gResUrl: ResourceUrl): Map<number, boolean> {
        const scopeFlags: Map<number, boolean> = new Map();
        const blocks = interceptMethod.getCfg()?.getBlocks() ?? [];
        for (let block of blocks) {
            if (!this.isIfBlock(block)) {
                continue;
            }
            const stmt = this.getIfConditionStmt(block);
            if (!stmt) {
                continue;
            }
            let resUrl: ResourceUrl = { scheme: '', suffix: '' };
            if (!this.isInterceptionJs(arkFile, stmt, resUrl)) {
                continue;
            }
            if (resUrl.scheme === '') {
                if (gResUrl.scheme === '') {
                    continue;
                }
                resUrl.scheme = gResUrl.scheme;
                resUrl.suffix = gResUrl.suffix;
            }
            if (resUrl.scheme !== 'http' && resUrl.scheme !== 'https') {
                const customSchemeModel = this.getCustomSchemeModel(arkFile.getScene(), resUrl.scheme);
                if (!customSchemeModel) {
                    this.reportIssue(arkFile, treeNode, 'onInterceptRequest', this.metaData.extendField);
                    continue;
                }
                if (!customSchemeModel.isCodeCacheSupported) {
                    const declaringArkFile = customSchemeModel.field.getDeclaringArkClass().getDeclaringArkFile();
                    this.reportIssue(declaringArkFile, customSchemeModel.field, 'schemeName', this.metaData.extendField);
                    continue;
                }
            }
            const blockStmts = block.getStmts();
            const hasSetResponseDataId = this.hasHeaderSetResponseDataId(arkFile, blockStmts);
            const scopeLevel = this.getScopeLevel(block);
            const scopeFlag = scopeFlags.get(scopeLevel);
            if (scopeFlag === undefined) {
                scopeFlags.set(scopeLevel, hasSetResponseDataId);
            } else if (!scopeFlag) {
                scopeFlags.set(scopeLevel, hasSetResponseDataId);
            }
        }
        return scopeFlags;
    }

    private processOnInterceptRequestMethod(arkFile: ArkFile, treeNode: ViewTreeNode, interceptMethod: ArkMethod): void {
        let gResUrl: ResourceUrl = { scheme: '', suffix: '' };
        this.traverseStmts(arkFile, treeNode, interceptMethod, gResUrl);
        const scopeFlags = this.processBlocks(arkFile, treeNode, interceptMethod, gResUrl);
        for (let [scopeLevel, hasSetResponseId] of scopeFlags) {
            if (!hasSetResponseId) {
                this.reportIssue(arkFile, treeNode, 'onInterceptRequest', this.metaData.description);
            }
        }
    }

    private parseTargetArg(arkFile: ArkFile, stmt: Stmt, value: Value, gResUrl: ResourceUrl): void {
        let scope = (stmt as StmtExt).scope;
        let varInfo: VarInfo = new VarInfo(stmt, scope);
        let argStr = StringUtils.getStringByScope(arkFile, varInfo, value);
        if (argStr.includes('http://') || argStr.includes('https://')) {
            gResUrl.scheme = 'http';
            if (argStr.endsWith('js') || argStr.indexOf('.js') !== -1) {
                gResUrl.suffix = '.js';
            }
        }
        if (argStr.includes('://')) {
            let scheme = argStr.substring(0, argStr.indexOf('://'));
            gResUrl.scheme = scheme;
            if (argStr.endsWith('.js') || argStr.indexOf('.js') !== -1) {
                gResUrl.suffix = '.js';
            }
        }
    }

    private getArgType(invokeExpr: AbstractInvokeExpr): string[] {
        let argTypes: string[] = [];
        let parameters = invokeExpr.getMethodSignature().getMethodSubSignature().getParameters();
        for (let parameter of parameters) {
            argTypes.push(parameter.getType().toString());
        }
        return argTypes;
    }

    private isIfBlock(block: BasicBlock): boolean {
        const stmts = block.getStmts();
        if (stmts.length === 0) {
            return false;
        }
        let stmt = stmts[0];
        let stmtExt = stmt as StmtExt;
        if (!stmtExt.scope) {
            return false;
        }
        return stmtExt.scope.scopeType === ScopeType.IF_TYPE;
    }

    private getIfConditionStmt(block: BasicBlock): Stmt | null {
        let curScopeLevel = this.getScopeLevel(block);
        let predecessorBlock = block.getPredecessors();
        while (predecessorBlock.length != 0) {
            let firstPredecessorBlock = predecessorBlock[0];
            const blkStmts = firstPredecessorBlock.getStmts();
            if (blkStmts.length === 0) {
                break;
            }
            let ifStmt = blkStmts[blkStmts.length - 1];
            let ifScopeLevel = this.getScopeLevel(firstPredecessorBlock);
            if ((curScopeLevel - ifScopeLevel) === 1 && ifStmt instanceof ArkIfStmt) {
                return ifStmt;
            }
            predecessorBlock = firstPredecessorBlock.getPredecessors();
        }
        return null;
    }

    private getScopeLevel(block: BasicBlock): number {
        let stmts = block.getStmts();
        if (stmts.length === 0) {
            return -1;
        }
        let stmt = stmts[0];
        let scope = (stmt as StmtExt).scope;
        if (!scope) {
            return -1;
        }
        return scope.scopeLevel;
    }

    private isInterceptionJs(arkFile: ArkFile, ifStmt: Stmt, resUrl: ResourceUrl): boolean {
        let scope = (ifStmt as StmtExt).scope;
        if (!(ifStmt instanceof ArkIfStmt)) {
            return false;
        }
        let conditionExpr = ifStmt.getConditionExpr();
        let cmpType = this.getConditionValueType(conditionExpr);
        let op1 = conditionExpr.getOp1();
        let op2 = conditionExpr.getOp2();
        let varInfo: VarInfo = new VarInfo(ifStmt, scope);
        if (conditionExpr.getOperator().includes('==') && cmpType instanceof StringType) {
            let op1Str = StringUtils.getStringByScope(arkFile, varInfo, op1);
            let op2Str = StringUtils.getStringByScope(arkFile, varInfo, op2);
            if (op1Str.endsWith('.js') || op2Str.endsWith('.js')) {
                resUrl.scheme = this.getCustomScheme([op1Str, op2Str]);
                resUrl.suffix = '.js';
                return true;
            }
        } else {
            if ((op1.getType() instanceof UnknownType || op1.getType() instanceof BooleanType) && (op1 instanceof Local)) {
                return this.isConditionIncludeJs(arkFile, varInfo, op1, resUrl);
            } else if ((op2.getType() instanceof UnknownType || op2.getType() instanceof BooleanType) && (op2 instanceof Local)) {
                return this.isConditionIncludeJs(arkFile, varInfo, op2, resUrl);
            }
        }
        return false;
    }

    private getConditionValueType(expr: ArkConditionExpr): Type {
        let op1 = expr.getOp1();
        if (op1.getType() instanceof PrimitiveType) {
            return op1.getType();
        }
        let op2 = expr.getOp2();
        if (op2.getType() instanceof PrimitiveType) {
            return op2.getType();
        }
        return UnknownType.getInstance();
    }

    private getCustomScheme(urls: string[]): string {
        for (let url of urls) {
            if (!url.includes('://')) {
                continue;
            }
            let scheme = url.substring(0, url.indexOf('://'));
            return scheme;
        }
        return '';
    }

    private isConditionIncludeJs(arkFile: ArkFile, varInfo: VarInfo, op: Local, resUrl: ResourceUrl): boolean {
        let declaringStmt = op.getDeclaringStmt();
        let digDeep = 0;
        let isInterceptionJs = false;
        while (declaringStmt) {
            if (digDeep > 20) {
                break;
            }
            if (!(declaringStmt instanceof ArkAssignStmt)) {
                isInterceptionJs = false;
                break;
            }
            let rightOp = declaringStmt.getRightOp();
            if (rightOp instanceof ArkInstanceInvokeExpr) {
                let methodName = rightOp.getMethodSignature().getMethodSubSignature().getMethodName();
                let args = rightOp.getArgs();
                if (args.length === 0) {
                    isInterceptionJs = false;
                    break;
                }
                if (!urlCmpMethods.includes(methodName)) {
                    isInterceptionJs = false;
                    break;
                }
                let arg0 = args[0];
                let rsStr = StringUtils.getStringByScope(arkFile, varInfo, arg0);
                if (rsStr.endsWith('.js')) {
                    isInterceptionJs = true;
                    break;
                }
            } else if (rightOp instanceof ArkConditionExpr) {
                let op1 = rightOp.getOp1();
                let op2 = rightOp.getOp2();
                if ((op1.getType() instanceof UnknownType || op1.getType() instanceof BooleanType) && (op1 instanceof Local)) {
                    return this.isConditionIncludeJs(arkFile, varInfo, op1, resUrl);
                } else if ((op2.getType() instanceof UnknownType || op2.getType() instanceof BooleanType) && (op2 instanceof Local)) {
                    return this.isConditionIncludeJs(arkFile, varInfo, op2, resUrl);
                }
                isInterceptionJs = false;
                break;
            } else if (rightOp instanceof Local) {
                declaringStmt = rightOp.getDeclaringStmt();
            }
            digDeep++;
        }
        return isInterceptionJs;
    }

    private getCustomSchemeModel(sence: Scene, scheme: string): CustomScheme | undefined {
        if (hasCustomSchemeCached) {
            let schemeModel = customSchemeMap.get(scheme);
            if (schemeModel) {
                return schemeModel;
            }
            return undefined;
        }
        for (let arkFile of sence.getFiles()) {
            for (let clazz of arkFile.getClasses()) {
                this.processArkClass(arkFile, clazz, scheme);
            }
            for (const arkNamespace of arkFile.getAllNamespacesUnderThisFile()) {
                for (const clazz of arkNamespace.getClasses()) {
                    this.processArkClass(arkFile, clazz, scheme);
                }
            }
        }
        hasCustomSchemeCached = true;
        let schemeModel = customSchemeMap.get(scheme);
        if (schemeModel) {
            return schemeModel;
        }
        return undefined;
    }

    private processArkClass(arkFile: ArkFile, clazz: ArkClass, scheme: string): void {
        for (let method of clazz.getMethods()) {
            for (let stmt of method.getBody()?.getCfg()?.getStmts() ?? []) {
                let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
                if (!invokeExpr) {
                    continue;
                }
                let methodSignatureStr = invokeExpr.getMethodSignature().toString();
                if (methodSignatureStr === customizeSchemesSignatureStr) {
                    this.processSchemeContent(arkFile, clazz, invokeExpr.getArg(0));
                }
            }
        }
    }

    private processSchemeContent(arkFile: ArkFile, clazz: ArkClass, value: Value): void {
        if (!(value instanceof Local)) {
            return;
        }
        let valueType = value.getType();
        if (!(valueType instanceof ArrayType)) {
            return;
        }
        let usedStmts = value.getUsedStmts();
        if (!usedStmts) {
            return;
        }
        for (let usedStmt of usedStmts) {
            if (!(usedStmt instanceof ArkAssignStmt)) {
                continue;
            }
            let rightOp = usedStmt.getRightOp();
            if (!(rightOp instanceof Local)) {
                continue;
            }
            let declaringStmt = rightOp.getDeclaringStmt();
            if (!declaringStmt) {
                continue;
            }
            if (!(declaringStmt instanceof ArkAssignStmt)) {
                continue;
            }
            let dRightOp = declaringStmt.getRightOp();
            this.processSchemeValue(arkFile, clazz, declaringStmt, dRightOp);
        }
    }

    private processSchemeValue(arkFile: ArkFile, clazz: ArkClass, stmt: Stmt, rightOp: Value): void {
        if (rightOp instanceof ArkNewExpr) {
            this.getSchemeAndCodeCacheSupport(arkFile, stmt, rightOp);
        } else if (rightOp instanceof ArkInstanceFieldRef) {
            let instanceField = clazz.getField(rightOp.getFieldSignature());
            if (!instanceField) {
                return;
            }
            let type = instanceField.getType();
            if (!(type instanceof ClassType)) {
                return;
            }
            let classSignatureStr = type.getClassSignature().toString();
            if (classSignatureStr !== webCustomSchemeSignatureStr) {
                return;
            }
            let initializerStmts = instanceField.getInitializer();
            for (let initializerStmt of initializerStmts) {
                if (!(initializerStmt instanceof ArkAssignStmt)) {
                    continue;
                }
                let rightOp = initializerStmt.getRightOp();
                if (!(rightOp instanceof ArkNewExpr)) {
                    continue;
                }
                this.getSchemeAndCodeCacheSupport(arkFile, initializerStmt, rightOp);
            }
        } else if (rightOp instanceof ArkStaticFieldRef) {
            let declaringSignature = rightOp.getFieldSignature().getDeclaringSignature();
            if (!(declaringSignature instanceof ClassSignature)) {
                return;
            }
            let staticClass = arkFile.getScene().getClass(declaringSignature);
            if (!staticClass) {
                return;
            }
            let staticField = staticClass.getStaticFieldWithName(rightOp.getFieldName());
            if (!staticField) {
                return;
            }
            let initializerStmts = staticField.getInitializer();
            for (let initializerStmt of initializerStmts) {
                if (!(initializerStmt instanceof ArkAssignStmt)) {
                    continue;
                }
                let rightOp = initializerStmt.getRightOp();
                if (!(rightOp instanceof ArkNewExpr)) {
                    continue;
                }
                this.getSchemeAndCodeCacheSupport(arkFile, initializerStmt, rightOp);
            }
        }
    }

    private getSchemeAndCodeCacheSupport(arkFile: ArkFile, stmt: Stmt, rightOp: ArkNewExpr): void {
        let clazzSignature = rightOp.getClassType().getClassSignature();
        let schemeClass = arkFile.getScene().getClass(clazzSignature);
        if (!schemeClass) {
            return;
        }
        let schemeNameFiled = schemeClass.getFieldWithName('schemeName');
        let isSupportCodeCacheField = schemeClass.getFieldWithName('isCodeCacheSupported');
        if (!schemeNameFiled) {
            return;
        }
        let schemeName = this.getFieldValue(arkFile, schemeNameFiled);
        let isSupportCodeCache = false;
        if (isSupportCodeCacheField) {
            isSupportCodeCache = this.getFieldValue(arkFile, isSupportCodeCacheField) === 'true';
        }
        if (schemeName !== '') {
            customSchemeMap.set(schemeName, { scheme: schemeName, isCodeCacheSupported: isSupportCodeCache, field: schemeNameFiled });
        }
    }

    private getFieldValue(arkFile: ArkFile, arkField: ArkField): string {
        let stmts = arkField.getInitializer();
        if (stmts.length === 0) {
            return '';
        }
        let stmt = stmts[0];
        if (!(stmt instanceof ArkAssignStmt)) {
            return '';
        }
        let rightOp = stmt.getRightOp();
        if (!rightOp) {
            return '';
        }
        if (rightOp instanceof Constant) {
            return rightOp.getValue();
        }
        if (rightOp instanceof ArkStaticFieldRef) {
            let declaringSignature = rightOp.getFieldSignature().getDeclaringSignature();
            if (!(declaringSignature instanceof ClassSignature)) {
                return '';
            }
            let staticClass = arkFile.getScene().getClass(declaringSignature);
            if (!staticClass) {
                return '';
            }
            let staticField = staticClass.getStaticFieldWithName(rightOp.getFieldName());
            if (!staticField) {
                return '';
            }
            return this.getFieldValue(arkFile, staticField);
        }
        return '';
    }

    private hasHeaderSetResponseDataId(arkFile: ArkFile, stmts: Stmt[]): boolean {
        let hasSetResponseDataId = false;
        for (let stmt of stmts) {
            let invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            let methodSignature = invokeExpr.getMethodSignature();
            let methodSignatureStr = methodSignature.toString();
            if (methodSignatureStr === setResponseHeaderSignatureStr) {
                return this.isSetResponseDataId(arkFile, invokeExpr.getArg(0));
            }
            let args = invokeExpr.getArgs();
            if (args.length === 0) {
                continue;
            }
            if (visitedMethod.has(methodSignature)) {
                continue;
            }
            visitedMethod.add(methodSignature);
            let argTypes = this.getArgType(invokeExpr);
            if (!argTypes.includes('WebResourceResponse')) {
                continue;
            }
            let invokeMethod = arkFile.getScene().getMethod(methodSignature);
            if (!invokeMethod) {
                continue;
            }
            let subStmts = invokeMethod.getCfg()?.getStmts() ?? [];
            hasSetResponseDataId = this.hasHeaderSetResponseDataId(arkFile, subStmts);
            if (hasSetResponseDataId) {
                return true;
            }
        }
        return hasSetResponseDataId;
    }

    private isSetResponseDataId(arkFile: ArkFile, arg: Value): boolean {
        if (!(arg instanceof Local)) {
            return false;
        }
        let usedStmts = arg.getUsedStmts();
        for (let useStmt of usedStmts) {
            if (!(useStmt instanceof ArkAssignStmt)) {
                continue;
            }
            let rightOp = useStmt.getRightOp();
            let valueType = rightOp.getType();
            if (!(valueType instanceof ClassType)) {
                continue;
            }
            let paramClass = arkFile.getScene().getClass(valueType.getClassSignature());
            if (!paramClass) {
                continue;
            }
            let keyFields = paramClass.getFields();
            for (let field of keyFields) {
                if (this.getFieldValue(arkFile, field) === 'ResponseDataID') {
                    return true;
                }
            }
        }
        return false;
    }

    private reportIssue(arkFile: ArkFile, nodeOrField: ViewTreeNode | ArkField, keyword: string, description: string) {
        const severity = this.rule.alert ?? this.metaData.severity;
        let filePath = arkFile.getFilePath();
        let lineNum = -1;
        let startColumn = -1;
        let endColumn = -1;
        if (nodeOrField instanceof ArkField) {
            let orgPosition = nodeOrField.getOriginPosition();
            lineNum = orgPosition.getLineNo();
            startColumn = orgPosition.getColNo();
            endColumn = startColumn + keyword.length;
        } else {
            let invokeStmts = nodeOrField.attributes.get(keyword);
            if (!invokeStmts) {
                return;
            }
            let invokeExpr = invokeStmts[0].getInvokeExpr();
            if (!invokeExpr) {
                return;
            }
            if (invokeExpr.getArgs().length === 0) {
                return;
            }
            let arg0 = invokeExpr.getArg(0);
            let firstArgPosition = invokeStmts[0].getOperandOriginalPosition(arg0);
            if (!firstArgPosition) {
                return;
            }
            lineNum = firstArgPosition.getFirstLine();
            endColumn = firstArgPosition.getFirstCol() - 1;
            startColumn = endColumn - keyword.length;
        }
        if (lineNum === -1 || startColumn === -1) {
            return;
        }
        let defects = new Defects(lineNum, startColumn, endColumn, description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}