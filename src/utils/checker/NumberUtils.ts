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

import { AbstractExpr, ArkAssignStmt, ArkFile, ArkInstanceFieldRef, ArkNormalBinopExpr, ArkStaticFieldRef, ArkUnopExpr, ClassSignature, Constant, ImportInfo, Local, NumberType, Stmt, Value } from 'arkanalyzer';
import { VarInfo } from '../../model/VarInfo';
import { CheckerStorage } from '../common/CheckerStorage';
import { NumberValue, ValueType } from '../../model/NumberValue';
import { StmtExt } from '../../model/StmtExt';

export class NumberUtils {
    public static readonly mBinopList: string[] = ['+', '-', '*', '/', '%', '<<', '>>', '&', '|', '^', '>>>'];

    private static isSupportOperator(operator: string): boolean {
        return this.mBinopList.includes(operator);
    }

    public static isValueSupportCalculation(arkFile: ArkFile, valueStmtInfo: VarInfo, value: Value): boolean {
        if (value instanceof Constant && value.getType() instanceof NumberType) {
            return true;
        } else if (value instanceof Local) {
            let importInfo = NumberUtils.getValueImportInfo(arkFile, value);
            if (importInfo) {
                return NumberUtils.isImportValueSupportCalculate(arkFile, importInfo, value);
            } else {
                return NumberUtils.isMethodValueSupportCalculate(arkFile, valueStmtInfo, value);
            }
        } else if (value instanceof AbstractExpr && value.getType() instanceof NumberType) {
            return NumberUtils.isExprSupportCalculate(arkFile, valueStmtInfo, value);
        } else if (value instanceof ArkStaticFieldRef && value.getType() instanceof NumberType) {
            return true;
        }
        return false;
    }

    private static isExprSupportCalculate(arkFile: ArkFile, valueStmtInfo: VarInfo, value: AbstractExpr): boolean {
        if (value instanceof ArkNormalBinopExpr && this.isSupportOperator(value.getOperator())) {
            return NumberUtils.isValueSupportCalculation(arkFile, valueStmtInfo, value.getOp1()) &&
                NumberUtils.isValueSupportCalculation(arkFile, valueStmtInfo, value.getOp2());
        } else if (value instanceof ArkUnopExpr) {
            let op = value.getUses()[0];
            return NumberUtils.isValueSupportCalculation(arkFile, valueStmtInfo, op);
        }
        return false;
    }

    private static isMethodValueSupportCalculate(arkFile: ArkFile, valueStmtInfo: VarInfo, value: Local): boolean {
        let scope = valueStmtInfo.scope;
        let valueStmt: Stmt = valueStmtInfo.stmt;
        if (!scope || !scope.defList) {
            return false;
        }
        let hasFind = false;
        let defList = scope.defList;
        for (let defVar of defList) {
            if (defVar.getName() !== value.getName()) {
                continue;
            }
            hasFind = true;
            let nearReDefStmtInfo = new VarInfo(defVar.defStmt, scope);
            let reDefStmtInfos = defVar.redefInfo;
            for (let reDefStmtInfo of reDefStmtInfos) {
                let originalLine = valueStmt.getOriginPositionInfo().getLineNo();
                if (reDefStmtInfo.stmt.getOriginPositionInfo().getLineNo() >= originalLine) {
                    break;
                }
                nearReDefStmtInfo = reDefStmtInfo;
            }
            if (!nearReDefStmtInfo || !(nearReDefStmtInfo instanceof VarInfo)) {
                continue;
            }
            let stmt = nearReDefStmtInfo.stmt;
            if (stmt instanceof ArkAssignStmt) {
                let rightOp = stmt.getRightOp();
                return NumberUtils.isValueSupportCalculation(arkFile, nearReDefStmtInfo, rightOp);
            }
        }

        if (!hasFind && scope.parentScope != null) {
            let defStmtInfo = new VarInfo(valueStmt, scope.parentScope);
            return NumberUtils.isValueSupportCalculation(arkFile, defStmtInfo, value);
        }
        return false;
    }

    private static isImportValueSupportCalculate(arkFile: ArkFile, importInfo: ImportInfo, value: Local): boolean {
        let exportInfo = importInfo.getLazyExportInfo();
        let importArkFile = exportInfo?.getDeclaringArkFile();
        if (!importArkFile) {
            return false;
        }
        let scope = CheckerStorage.getInstance().getScope(importArkFile.getFilePath());
        if (!scope) {
            return false;
        }
        for (let varDef of scope.defList) {
            if (varDef.getName() !== value.getName()) {
                continue;
            }
            let stmt = varDef.defStmt;
            if (stmt instanceof ArkAssignStmt) {
                let defStmtInfo = new VarInfo(stmt, scope);
                let rightOp = stmt.getRightOp();
                return NumberUtils.isValueSupportCalculation(importArkFile, defStmtInfo, rightOp);
            }
        }
        return false;
    }

    private static getValueImportInfo(arkFile: ArkFile, value: Local): ImportInfo | undefined {
        let importInfos = arkFile.getImportInfos();
        for (let importInfo of importInfos) {
            if (importInfo.getImportClauseName() == value.getName()) {
                return importInfo;
            }
        }
        return undefined;
    }

    public static getNumberByScope(arkFile: ArkFile, valueStmtInfo: VarInfo, value: Value): NumberValue {
        if (value instanceof Constant && value.getType() instanceof NumberType) {
            let valueStr = value.getValue();
            let numberValue = Number(valueStr);
            if (valueStr.includes('.')) {
                return new NumberValue(numberValue, ValueType.DOUBLE);
            } else {
                return new NumberValue(numberValue, ValueType.INT);
            }
        } else if (value instanceof Local) {
            let importInfo = this.getValueImportInfo(arkFile, value);
            if (importInfo) {
                return this.getImportNumberValue(arkFile, importInfo, value);
            } else {
                return this.getMethodNumberValue(arkFile, valueStmtInfo, value);
            }
        } else if (value instanceof AbstractExpr && value.getType() instanceof NumberType) {
            return this.getExprNumberValue(arkFile, valueStmtInfo, value);
        } else if (value instanceof ArkStaticFieldRef && value.getType() instanceof NumberType) {
            return this.getStaticNumberValue(arkFile, valueStmtInfo, value);
        } else if (value instanceof ArkInstanceFieldRef) {
            return this.getInstanceFieldValue(arkFile, valueStmtInfo, value);
        }
        return new NumberValue(0, ValueType.UNKNOWN);
    }

    private static getInstanceFieldValue(arkFile: ArkFile, valueStmtInfo: VarInfo, value: ArkInstanceFieldRef): NumberValue {
        let fieldSignature = value.getFieldSignature();
        for (let clazz of arkFile.getClasses()) {
            let field = clazz.getField(fieldSignature);
            if (!field) {
                continue;
            }
            let initializer = field.getInitializer()[0];
            if (!initializer) {
                continue;
            }
            if (!(initializer instanceof ArkAssignStmt)) {
                continue;
            }
            return this.getNumberByScope(arkFile, valueStmtInfo, initializer.getRightOp());
        }
        return new NumberValue(0, ValueType.UNKNOWN);
    }

    private static getImportNumberValue(arkFile: ArkFile, importInfo: ImportInfo, value: Local): NumberValue {
        let exportInfo = importInfo.getLazyExportInfo();
        let importArkFile = exportInfo?.getDeclaringArkFile();
        if (!importArkFile) {
            return new NumberValue(0, ValueType.UNKNOWN);
        }
        let scope = CheckerStorage.getInstance().getScope(importArkFile.getFilePath());
        if (!scope) {
            return new NumberValue(0, ValueType.UNKNOWN);
        }
        for (let varDef of scope.defList) {
            if (varDef.getName() !== value.getName()) {
                continue;
            }
            let stmt = varDef.defStmt;
            if (stmt instanceof ArkAssignStmt) {
                let defStmtInfo = new VarInfo(stmt, scope);
                let rightOp = stmt.getRightOp();
                return this.getNumberByScope(importArkFile, defStmtInfo, rightOp);
            }
        }
        return new NumberValue(0, ValueType.UNKNOWN);
    }

    private static getMethodNumberValue(arkFile: ArkFile, valueStmtInfo: VarInfo, value: Local): NumberValue {
        let scope = valueStmtInfo.scope;
        let valueStmt = valueStmtInfo.stmt;
        if (!scope || !scope.defList) {
            return new NumberValue(0, ValueType.UNKNOWN);
        }
        let hasFind = false;
        let defList = scope.defList;
        for (let defVar of defList) {
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
                return this.getNumberByScope(arkFile, nearReDefStmtInfo, rightOp);
            }
        }

        if (!hasFind && scope.parentScope != null) {
            let defStmtInfo = new VarInfo(valueStmt, scope.parentScope);
            return this.getNumberByScope(arkFile, defStmtInfo, value);
        }
        return new NumberValue(0, ValueType.UNKNOWN);
    }

    private static getExprNumberValue(arkFile: ArkFile, stmeInfo: VarInfo, value: AbstractExpr): NumberValue {
        if (value instanceof ArkNormalBinopExpr) {
            if (this.isSupportOperator(value.getOperator())) {
                let valueOfOp1 = this.getNumberByScope(arkFile, stmeInfo, value.getOp1());
                let valueOfOp2 = this.getNumberByScope(arkFile, stmeInfo, value.getOp2());
                switch (value.getOperator()) {
                    case '+':
                        return new NumberValue(valueOfOp1.value + valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '-':
                        return new NumberValue(valueOfOp1.value - valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '*':
                        return new NumberValue(valueOfOp1.value * valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '/':
                        return new NumberValue(valueOfOp1.value / valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '%':
                        return new NumberValue(valueOfOp1.value % valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '&':
                        return new NumberValue(valueOfOp1.value & valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '|':
                        return new NumberValue(valueOfOp1.value | valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '^':
                        return new NumberValue(valueOfOp1.value ^ valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '>>':
                        return new NumberValue(valueOfOp1.value >> valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '<<':
                        return new NumberValue(valueOfOp1.value << valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                    case '>>>':
                        return new NumberValue(valueOfOp1.value >>> valueOfOp2.value, valueOfOp1.type | valueOfOp2.type);
                }
            }
        } else if (value instanceof ArkUnopExpr) {
            let op = value.getUses()[0];
            let valueOfOp = this.getNumberByScope(arkFile, stmeInfo, op);
            switch (value.getOperator()) {
                case '-':
                    return new NumberValue(-valueOfOp.value, valueOfOp.type);
                case '~':
                    return new NumberValue(~valueOfOp.value, valueOfOp.type);
            }
        }
        return new NumberValue(0, ValueType.UNKNOWN);
    }

    private static getStaticNumberValue(arkFile: ArkFile, valueStmtInfo: VarInfo, value: ArkStaticFieldRef): NumberValue {
        let classSignature = value.getFieldSignature().getDeclaringSignature();
        if (!(classSignature instanceof ClassSignature)) {
            return new NumberValue(0, ValueType.UNKNOWN);
        }

        let fileSignature = classSignature.getDeclaringFileSignature();
        let staticClassArkFile = arkFile.getScene().getFile(fileSignature);

        if (staticClassArkFile) {
            let staticClass = staticClassArkFile.getClass(classSignature);
            if (!staticClass) {
                return new NumberValue(0, ValueType.UNKNOWN);
            }

            let staticField = staticClass.getStaticFieldWithName(value.getFieldName());
            if (!staticField) {
                return new NumberValue(0, ValueType.UNKNOWN);
            }

            let stmts = staticField.getInitializer();
            if (stmts.length === 0) {
                return new NumberValue(0, ValueType.UNKNOWN);
            }

            let stmt = stmts[0];
            new VarInfo(stmt, (stmt as StmtExt).scope)
            if (!(stmt instanceof ArkAssignStmt)) {
                return new NumberValue(0, ValueType.UNKNOWN);
            }

            let initValue = stmt.getRightOp();
            return this.getNumberByScope(arkFile, valueStmtInfo, initValue);
        }
        return new NumberValue(0, ValueType.UNKNOWN);
    }

    public static getOriginalValueText(stmt: Stmt, value: Value): string {
        let valStr = '';
        if (value instanceof Constant) {
            valStr = value.toString()
        } else if (value instanceof Local) {
            if (!value.toString().includes('%')) {
                valStr = value.toString();
            } else {
                let declaringStmt = value.getDeclaringStmt();
                if (declaringStmt instanceof ArkAssignStmt) {
                    return this.getOriginalValueText(stmt, declaringStmt.getRightOp());
                }
            }
        } else if (value instanceof ArkNormalBinopExpr) {
            if (!value.toString().includes('%')) {
                valStr = value.toString();
            } else {
                let originalPosition = stmt.getOperandOriginalPosition(value);
                if (!originalPosition) {
                    return this.getOriginalValueText(stmt, value.getOp1()) + ' ' + value.getOperator() + ' '
                        + this.getOriginalValueText(stmt, value.getOp2());
                }
                const text = stmt.getOriginalText();
                if (!text || text.length === 0) {
                    return this.getOriginalValueText(stmt, value.getOp1()) + ' ' + value.getOperator() + ' '
                        + this.getOriginalValueText(stmt, value.getOp2());
                }
                let startColum = stmt.getOriginPositionInfo().getColNo();
                return text.substring(originalPosition.getFirstCol() - startColum, originalPosition.getLastCol() - startColum);
            }
        } else if (value instanceof ArkUnopExpr) {
            if (!value.toString().includes('%')) {
                valStr = value.toString();
            } else {
                valStr = value.getOperator() + this.getOriginalValueText(stmt, value.getUses()[0]);
            }
        } else if (value instanceof ArkStaticFieldRef) {
            let fieldSignature = value.getFieldSignature();
            let declaringSignature = fieldSignature.getDeclaringSignature();
            if (declaringSignature instanceof ClassSignature) {
                valStr = declaringSignature.getClassName() + '.' + fieldSignature.getFieldName();
            }
        }
        return valStr;
    }
}