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

import { ArkAssignStmt, ArkField, ArkFile, ArkInstanceFieldRef, ArkMethod, ArkNewExpr, ArkStaticFieldRef, ClassSignature, ClassType, DEFAULT_ARK_CLASS_NAME, Local, Stmt, Value } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback, CheckerUtils, CheckerStorage, Scope } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { VarInfo } from '../../model/VarInfo';
import { NumberUtils } from '../../utils/checker/NumberUtils';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoHighLoadedFrameRateRangeCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/no-high-loaded-frame-rate-range.md',
    description: 'Do not set the expected, min, and max values of ExpectedFrameRateRange all to 120.'
};
const setExpectedFrameRateRangeSignature: string[] = [
    '@ohosSdk/api/@ohos.graphics.displaySync.d.ts: displaySync.DisplaySync.setExpectedFrameRateRange(ExpectedFrameRateRange)',
    '@ohosSdk/api/@ohos.graphics.displaySync.d.ts: displaySync.DisplaySync.setExpectedFrameRateRange(@ohosSdk/component/common.d.ts: ExpectedFrameRateRange)'
];
const animateToSiganture = `@ohosSdk/component/common.d.ts: ${DEFAULT_ARK_CLASS_NAME}.animateTo(@ohosSdk/component/common.d.ts: AnimateParam, @ohosSdk/component/common.d.ts: ${DEFAULT_ARK_CLASS_NAME}.%AM0())`;
const setFrameRateRangeSignature: string[] = [
    '@ohosSdk/api/@ohos.arkui.UIContext.d.ts: DynamicSyncScene.setFrameRateRange(ExpectedFrameRateRange)',
    '@ohosSdk/api/@ohos.arkui.UIContext.d.ts: DynamicSyncScene.setFrameRateRange(@ohosSdk/component/common.d.ts: ExpectedFrameRateRange)'
];

export class NoHighLoadedFrameRateRangeCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD
    };

    public registerMatchers(): MatcherCallback[] {
        const matchMethodCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check
        };
        return [matchMethodCb];
    }

    public check = (arkMethod: ArkMethod): void => {
        let stmts = arkMethod.getBody()?.getCfg().getStmts();
        if (!stmts) {
            return;
        }
        for (const stmt of stmts) {
            let invoke = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invoke) {
                continue;
            }
            if (!(setExpectedFrameRateRangeSignature.includes(invoke.getMethodSignature().toString()) ||
                invoke.getMethodSignature().toString() === animateToSiganture ||
                setFrameRateRangeSignature.includes(invoke.getMethodSignature().toString()))) {
                continue;
            }
            let arg = invoke.getArg(0);
            if (!(arg instanceof Local)) {
                continue;
            }
            let fieldValue = this.getFieldNum(stmt, arg, arg.getName());
            if (fieldValue.length === 3) {
                this.reportIssue(arkMethod.getDeclaringArkFile(), stmt, invoke.getMethodSignature().getMethodSubSignature().getMethodName());
            }
        }
    };

    private getFieldNum(stmt: Stmt, arg: Local, name: string): number[] {
        let fieldValue: number[] = [];
        let arkFile = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile();
        let declaringStmt = arg.getDeclaringStmt();
        if (declaringStmt) {
            // 场景一：局部变量
            fieldValue = this.traversalLocals(declaringStmt);
            if (fieldValue.length !== 0) {
                return fieldValue;
            }
        } else {
            // 场景二：全局变量
            fieldValue = this.traversalDefaultClass(arkFile, name);
            if (fieldValue.length !== 0) {
                return fieldValue;
            }
        }
        // 场景三：import模块
        let imports = arkFile.getImportInfos();
        for (let subImport of imports) {
            if (subImport.getImportClauseName() !== name) {
                continue;
            }
            let arkFile = subImport.getLazyExportInfo()?.getDeclaringArkFile();
            if (!arkFile) {
                continue;
            }
            fieldValue = this.traversalDefaultClass(arkFile, name);
        }
        return fieldValue;
    }

    private traversalLocals(declaringStmt: Stmt): number[] {
        if (!(declaringStmt instanceof ArkAssignStmt)) {
            return [];
        }
        let method = declaringStmt.getCfg().getDeclaringMethod();
        let rightOp = declaringStmt.getRightOp();
        if (rightOp instanceof Local || rightOp instanceof ArkNewExpr) {
            let type = rightOp.getType();
            if (!(type instanceof ClassType)) {
                return [];
            }
            let arkClass = method.getDeclaringArkFile().getScene().getClass(type.getClassSignature());
            let fields = arkClass?.getFields();
            if (!fields) {
                return [];
            }
            return this.getReasonableFieldValues(fields);
        } else if (rightOp instanceof ArkInstanceFieldRef) {
            let field = method.getDeclaringArkClass().getField(rightOp.getFieldSignature());
            if (!field) {
                return [];
            }
            let initializer = field.getInitializer()[0];
            return this.traversalLocals(initializer);
        } else if (rightOp instanceof ArkStaticFieldRef) {
            let fieldSignature = rightOp.getFieldSignature();
            let declareSignature = fieldSignature.getDeclaringSignature();
            if (!(declareSignature instanceof ClassSignature)) {
                return [];
            }
            let declareClass = method.getDeclaringArkFile().getScene().getClass(declareSignature);
            let field = declareClass?.getStaticFieldWithName(rightOp.getFieldName());
            if (!field) {
                return [];
            }
            let initializer = field.getInitializer()[0];
            return this.traversalLocals(initializer);
        }
        return [];
    }

    private traversalDefaultClass(arkFile: ArkFile, name: string): number[] {
        let defaultClass = arkFile.getDefaultClass();
        let method = defaultClass.getMethods()[0];
        let locals = method.getBody()?.getLocals();
        if (!locals) {
            return [];
        }
        for (let [key, value] of locals) {
            if (!(value instanceof Local)) {
                continue;
            }
            if (key !== name) {
                continue;
            }
            let declaringStmt = value.getDeclaringStmt();
            if (!declaringStmt) {
                return [];
            }
            return this.traversalLocals(declaringStmt);
        }
        return [];
    }

    private getReasonableFieldValues(fields: ArkField[]): number[] {
        let fieldValue: number[] = [];
        for (const field of fields) {
            let arkFile = field.getDeclaringArkClass().getDeclaringArkFile();
            if (field.getName() === 'expectedFrameRateRange') {
                return this.traversalLocals(field.getInitializer()[0]);
            }
            if (!['expected', 'min', 'max'].includes(field.getName())) {
                continue;
            }
            let initializer = field.getInitializer()[0];
            if (!(initializer instanceof ArkAssignStmt)) {
                continue;
            }
            let rightOp = initializer.getRightOp();
            let scope = CheckerStorage.getInstance().getScope(arkFile.getFilePath());
            if (!scope) {
                continue;
            }
            let val = this.processScope(scope, initializer, arkFile, rightOp);
            if (!val) {
                continue;
            }
            if (val >= 120) {
                fieldValue.push(val);
            }
        }
        return fieldValue;
    }

    private processScope(scope: Scope, initializer: ArkAssignStmt, arkFile: ArkFile, rightOp: Value): number | null {
        let varInfo = new VarInfo(initializer, scope);
        let reDefValue = NumberUtils.getNumberByScope(arkFile, varInfo, rightOp);
        if (reDefValue.type === 0) {
            return reDefValue.value;
        }
        if (scope.childScopeList.length !== 0) {
            for (let childScope of scope.childScopeList) {
                let result = this.processScope(childScope, initializer, arkFile, rightOp);
                if (result !== null) {
                    return result;
                }
            }
        }
        return null;
    }

    public reportIssue(arkFile: ArkFile, stmt: Stmt, methodName: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        const lineNum = originPositionInfo.getLineNo();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const startColumn = originPositionInfo.getColNo() + text.lastIndexOf(methodName);
        const endColunm = startColumn + methodName.length;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}