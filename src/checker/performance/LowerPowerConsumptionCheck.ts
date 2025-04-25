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

import { ArkAssignStmt, ArkClass, ArkField, ArkFile, ArkMethod, ArkStaticFieldRef, ClassType, Local, Stmt } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { ClassMatcher, Defects, FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'LowerPowerConsumptionCheck');
const SIGNATURESTR = '@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRendererInfo';
const SIGNATURESTR2 = '@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.AudioRendererInfo.usage';
const SIGNATURESTR3 = '@ohosSdk/api/@ohos.multimedia.audio.d.ts: audio.StreamUsage.[static]STREAM_USAGE_UNKNOWN';
const keyword: string = 'usage';
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/lower-power-consumption-check.md',
    description: 'When creating an AudioRenderer instance, the correct usage type should be set.'
};

export class LowerPowerConsumptionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
    };

    private mtdMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.fileCheck
        };
        const matchClazzCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.clsCheck
        };
        const matchMethodCb: MatcherCallback = {
            matcher: this.mtdMatcher,
            callback: this.check
        };
        return [matchFileCb, matchClazzCb, matchMethodCb];
    }

    public fileCheck = (arkFile: ArkFile): void => {
        // 全局变量
        let defaultClass = arkFile.getDefaultClass();
        let method = defaultClass.getMethods()[0];
        let stmt = this.traversalLocals(method);
        if (stmt) {
            this.reportIssue(stmt);
        }
    };

    public clsCheck = (clazz: ArkClass): void => {
        // 成员变量
        let stmt = this.processClazz(clazz.getFields());
        if (stmt) {
            this.reportIssue(stmt);
        }
    };

    public check = (target: ArkMethod): void => {
        // 局部变量
        let stmt = this.traversalLocals(target);
        if (stmt) {
            this.reportIssue(stmt);
        }
    };

    private processClazz(fields: ArkField[]): Stmt | null {
        let stmt: Stmt | null = null;
        for (let field of fields) {
            const type = field.getSignature().getType();
            if (!(type instanceof ClassType)) {
                continue;
            }
            const fieldSignatureStr = type.getClassSignature().toString();
            if (fieldSignatureStr !== SIGNATURESTR) {
                continue;
            }
            const initializers = field?.getInitializer() ?? [];
            const initializer = initializers[initializers.length - 1];
            const method = initializer.getCfg().getDeclaringMethod();
            let fieldInfos = this.processDeclaringStmt(method, initializer);
            if (fieldInfos === undefined) {
                continue;
            }
            let usageStmt = this.processUsage(fieldInfos);
            if (usageStmt) {
                stmt = usageStmt;
                return stmt;
            }
        }
        return stmt;
    }

    private traversalLocals(method: ArkMethod): Stmt | null {
        let stmt: Stmt | null = null;
        let locals = method.getBody()?.getLocals();
        if (!locals) {
            return stmt;
        }
        for (let [key, value] of locals) {
            let type = value.getType();
            if (!(type instanceof ClassType)) {
                continue;
            }
            const classSignatureStr = type.getClassSignature().toString();
            if (classSignatureStr !== SIGNATURESTR) {
                continue;
            }
            let declaringStmt = value.getDeclaringStmt();
            if (declaringStmt === null) {
                continue;
            }
            let fieldInfos = this.processDeclaringStmt(method, declaringStmt);
            if (fieldInfos === undefined) {
                continue;
            }
            let usageStmt = this.processUsage(fieldInfos);
            if (usageStmt) {
                stmt = usageStmt;
                return stmt;
            }
        }
        return stmt;
    }

    private processDeclaringStmt(method: ArkMethod, stmt: Stmt): ArkField[] | undefined {
        let fieldInfos: ArkField[] | undefined = undefined;
        if (!(stmt instanceof ArkAssignStmt)) {
            return fieldInfos;
        }
        let rightOp = stmt.getRightOp();
        if (!(rightOp instanceof Local)) {
            return fieldInfos;
        }
        let type = rightOp.getType();
        if (!(type instanceof ClassType)) {
            return fieldInfos;
        }
        let arkClass = method.getDeclaringArkFile().getScene().getClass(type.getClassSignature());
        fieldInfos = arkClass?.getFields();
        return fieldInfos;
    }

    private processUsage(fieldInfos: ArkField[]): Stmt | null {
        let stmt: Stmt | null = null;
        for (let fieldInfo of fieldInfos) {
            const fieldSignatureStr = fieldInfo.getSignature().toString();
            if (fieldSignatureStr !== SIGNATURESTR2) {
                continue;
            }
            const initializers = fieldInfo.getInitializer();
            const initializer = initializers[initializers.length - 1];
            if (!(initializer instanceof ArkAssignStmt)) {
                continue;
            }
            const rightOp = initializer.getRightOp();
            if (!(rightOp instanceof Local)) {
                continue;
            }
            const declaringStmt = rightOp.getDeclaringStmt();
            if (!(declaringStmt instanceof ArkAssignStmt)) {
                continue;
            }
            const rightOp2 = declaringStmt.getRightOp();
            if (!(rightOp2 instanceof ArkStaticFieldRef)) {
                continue;
            }
            const fieldSignatureStr2 = rightOp2.getFieldSignature().toString();
            if (fieldSignatureStr2 === SIGNATURESTR3) {
                stmt = declaringStmt;
                return stmt;
            }
        }
        return stmt;
    }

    private reportIssue(stmt: Stmt,): void {
        const arkFile = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.debug('Stmt text is empty.');
            return;
        }
        let index = text.indexOf(keyword);
        if (index === -1) {
            logger.debug(`Can not find ${keyword} in ${text}.`);
            return;
        }
        const severity = this.rule.alert ?? this.metaData.severity;
        let originalPosition = stmt.getOriginPositionInfo();
        let lineNum = originalPosition.getLineNo();
        let startColum = originalPosition.getColNo() + index;
        let endColum = startColum + keyword.length - 1;
        let filePath = arkFile.getFilePath();
        let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}