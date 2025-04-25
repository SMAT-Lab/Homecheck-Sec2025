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

import { AbstractExpr, ArkAssignStmt, ArkFile, ArkNormalBinopExpr, ArkStaticFieldRef, ClassSignature, ClassType, Constant, EnumValueType, ImportInfo, Local, Stmt, StringType, Value } from "arkanalyzer";
import { ClassCategory } from "arkanalyzer/lib/core/model/ArkClass";
import { VarInfo } from "../../model/VarInfo";
import { StmtExt } from "../../model/StmtExt";
import { CheckerStorage } from "../common/CheckerStorage";
import { Scope } from "../../model/Scope";

export class StringUtils {
    public static getStringByScope(arkFile: ArkFile, valueStmtInfo: VarInfo, value: Value): string {
        if (value instanceof Constant) {
            return value.getValue();
        } else if (value instanceof Local) {
            if (!value.toString().includes('%')) {
                let importInfo = this.getValueImportInfo(arkFile, value);
                if (importInfo) {
                    return this.getImportStringValue(importInfo, value);
                } else {
                    return this.getMethodStringValue(arkFile, valueStmtInfo, value);
                }
            } else {
                let declaringStmt = value.getDeclaringStmt();
                if (!declaringStmt) {
                    return '';
                }
                let tmpStmt = declaringStmt;
                if (!(declaringStmt instanceof ArkAssignStmt)) {
                    return '';
                }
                let rightOp = declaringStmt.getRightOp();
                valueStmtInfo.stmt = declaringStmt;
                valueStmtInfo.scope = (tmpStmt as StmtExt).scope;
                return this.getStringByScope(arkFile, valueStmtInfo, rightOp);
            }
        } else if (value instanceof AbstractExpr && value.getType() instanceof StringType) {
            return this.getExprStringValue(arkFile, valueStmtInfo, value);
        } else if (value instanceof ArkStaticFieldRef && value.getType() instanceof StringType) {
            return this.getStaticStringValue(arkFile, value);
        } else if (value instanceof ArkStaticFieldRef && value.getType() instanceof ClassType) {
            return this.getStaticStringValue(arkFile, value);
        } else if (value instanceof ArkStaticFieldRef && value.getType() instanceof EnumValueType) {
            return this.getStaticStringValue(arkFile, value);
        }
        return '';
    }

    private static getValueImportInfo(arkFile: ArkFile, value: Local): ImportInfo | undefined {
        let importInfos = arkFile.getImportInfos();
        for (let importInfo of importInfos) {
            if (importInfo.getImportClauseName() === value.getName()) {
                return importInfo;
            }
        }
        return undefined;
    }

    private static getImportStringValue(importInfo: ImportInfo, value: Local): string {
        let exportInfo = importInfo.getLazyExportInfo();
        let importArkFile = exportInfo?.getDeclaringArkFile();
        if (!importArkFile) {
            return '';
        }
        let scope = CheckerStorage.getInstance().getScope(importArkFile.getFilePath());
        if (!scope) {
            return '';
        }
        for (let varDef of scope.defList) {
            if (varDef.getName() === value.getName()) {
                continue;
            }
            let stmt = varDef.defStmt;
            const text = stmt.getOriginalText();
            if (!text || text.length === 0 || !text.includes('const')) {
                continue;
            }
            if (stmt instanceof ArkAssignStmt) {
                let defStmtInfo = new VarInfo(stmt, scope);
                let rightOp = stmt.getRightOp();
                return this.getStringByScope(importArkFile, defStmtInfo, rightOp);
            }
        }
        return '';
    }

    private static getMethodStringValue(arkFile: ArkFile, valueStmtInfo: VarInfo, value: Local): string {
        let scope: Scope = valueStmtInfo.scope;
        let valueStmt: Stmt = valueStmtInfo.stmt;
        let hasFind = false;
        if (!scope || !scope.defList) {
            return '';
        }
        let defLists = scope.defList;
        for (let defVar of defLists) {
            if (defVar.getName() !== value.getName()) {
                continue;
            }
            hasFind = true;
            let nearReDefStmtInfo = new VarInfo(defVar.defStmt, scope);
            let reDefStmtInfos = defVar.redefInfo;
            for (let reDefStmtInfo of reDefStmtInfos) {
                let originalLine = valueStmt.getOriginPositionInfo().getLineNo();
                let redefLine = reDefStmtInfo.stmt.getOriginPositionInfo().getLineNo();
                if (redefLine >= originalLine) {
                    break;
                }
                nearReDefStmtInfo = reDefStmtInfo;
            }
            let stmt = nearReDefStmtInfo.stmt;
            if (stmt instanceof ArkAssignStmt) {
                let rightOp = stmt.getRightOp();
                return this.getStringByScope(arkFile, nearReDefStmtInfo, rightOp);
            }
        }
        if (!hasFind && scope.parentScope !== null) {
            let defStmtInfo = new VarInfo(valueStmt, scope.parentScope);
            return this.getStringByScope(arkFile, defStmtInfo, value);
        }
        return '';
    }

    private static getExprStringValue(arkFile: ArkFile, stmtInfo: VarInfo, value: AbstractExpr): string {
        if (value instanceof ArkNormalBinopExpr) {
            let stringOfOp1 = this.getStringByScope(arkFile, stmtInfo, value.getOp1());
            let stringOfOp2 = this.getStringByScope(arkFile, stmtInfo, value.getOp2());
            switch (value.getOperator()) {
                case '+':
                    return stringOfOp1 + stringOfOp2;
            }
        }
        return '';
    }

    private static getStaticStringValue(arkFile: ArkFile, value: ArkStaticFieldRef): string {
        let classSignature = value.getFieldSignature().getDeclaringSignature();
        if (!(classSignature instanceof ClassSignature)) {
            return '';
        }
        let fieldSignature = classSignature.getDeclaringFileSignature();
        let staticClassArkFile = arkFile.getScene().getFile(fieldSignature);
        if (!staticClassArkFile) {
            return '';
        }
        let staticClass = staticClassArkFile.getClass(classSignature);
        if (!staticClass) {
            return '';
        }
        let staticField = staticClass.getStaticFieldWithName(value.getFieldName());
        if (!staticField) {
            return '';
        }
        if (staticClass.getCategory() === ClassCategory.CLASS && !staticField.isReadonly()) {
            return '';
        }
        let stmts = staticField.getInitializer();
        if (stmts.length === 0) {
            return '';
        }
        let stmt = stmts[0];
        let varInfo = new VarInfo(stmt, (stmt as StmtExt).scope);
        if (!(stmt instanceof ArkAssignStmt)) {
            return '';
        }
        let initValue = stmt.getRightOp();
        return this.getStringByScope(staticClassArkFile, varInfo, initValue);
    }
}