/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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
import { ArkMethod, Stmt, ArkAssignStmt, NumberType, ArkNormalBinopExpr } from "arkanalyzer";
import { BaseMetaData, BaseChecker } from "../BaseChecker";
import { Rule, Defects, MatcherTypes, MatcherCallback, MethodMatcher } from '../../Index';
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from "../../model/Defects";

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-loss-of-precision-check.md',
    description: 'This number literal will lose precision at runtime.'
};

export class NoLossOfPrecisionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private buildMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
    };
    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        };
        return [matchBuildCb];
    };
    public check = (targetMtd: ArkMethod) => {
        const severity = this.rule.alert ?? this.metaData.severity;
        const stmts = targetMtd.getBody()?.getCfg().getStmts() ?? [];
        stmts.forEach((stmt) => {
            if (!(stmt instanceof ArkAssignStmt)) {
                return;
            };
            const originalText = stmt.getOriginalText();
            if (!originalText) {
                return;
            };
            const trimmedText = originalText?.trim();
            const parts = originalText?.split('=');
            const right = stmt.getRightOp();
            if (right instanceof ArkNormalBinopExpr) {
                this.checkBinaryExpression(stmt, originalText, parts, severity);
                return;
            };
            if (!trimmedText || !(right?.getType() instanceof NumberType) || parts?.length !== 2) {
                return;
            };
            const originalTextValue = parts[1].trim().replace(/;$/, '');
            const cleanedNumberStr = originalTextValue.replace(/_/g, '');
            const numberStr = cleanedNumberStr.toString();
            if (!this.isNumber(numberStr)) {
                return;
            };
            const numberValue = this.getNumberValue(numberStr, stmt);
            if (this.checkIntegerstartsWithZero(stmt, numberStr, numberValue, originalTextValue, severity)) {
                return;
            }
            if (this.checkIntegerRange(stmt, numberStr, numberValue, originalTextValue, severity)) {
                return;
            };
            if (this.checkExponentAndMantissa(stmt, numberStr, originalText, severity)) {
                return;
            };
            if (this.checkDecimalPart(stmt, numberStr, originalText, severity)) {
                return;
            };
        });
    };
    private checkBinaryExpression(stmt: ArkAssignStmt, originalText: string, parts: string[], severity: number): void {
        if (parts.length !== 2) {
            return;
        };
        const rightExpression = parts[1].trim().replace(/;$/, '');
        const numberRegex = /\b0\d+\b/g;
        const matches = rightExpression.match(numberRegex);
        if (matches) {
            // 检查每个匹配到的数字
            for (const match of matches) {
                if (this.isDecimalNumber(match)) {
                    continue;
                }
                if (match.length > 2 && match.startsWith('0') &&
                    !match.startsWith('0x') && !match.startsWith('0X') &&
                    !match.startsWith('0b') && !match.startsWith('0B') &&
                    !match.startsWith('0o') && !match.startsWith('0O')) {

                    this.addIssueReport(stmt, match, severity);
                    return;
                };
            };
        };
    };

    private checkIntegerstartsWithZero(stmt: ArkAssignStmt, numberStr: string, numberValue: number, originalTextValue: string, severity: number): boolean {
        if (this.isDecimalNumber(numberStr)) {
            return false;
        };
        if (numberStr.length > 1 &&
            numberStr.startsWith('0') &&
            !numberStr.startsWith('0x') &&
            !numberStr.startsWith('0X') &&
            !numberStr.startsWith('0b') &&
            !numberStr.startsWith('0B') &&
            !numberStr.startsWith('0o') &&
            !numberStr.startsWith('0O')) {
            if (numberStr.length > 2) {
                this.addIssueReport(stmt, originalTextValue, severity);
                return true;
            };
            if (/^0\d+$/.test(numberStr)) {
                this.addIssueReport(stmt, originalTextValue, severity);
                return true;
            };
        };
        return false;
    };

    /**
     * 检查是否是小数
     */
    private isDecimalNumber(str: string): boolean {
        return str.includes('.') || /^0\.\d+$/.test(str);
    };

    private checkIntegerRange(stmt: ArkAssignStmt, numberStr: string, numberValue: number, originalTextValue: string, severity: number): boolean {
        let isIntegerInRange = originalTextValue.includes('e') || originalTextValue.includes('E');
        if (!isIntegerInRange && (numberValue > Number.MAX_SAFE_INTEGER || numberValue < Number.MIN_SAFE_INTEGER)) {
            const lastDigit = originalTextValue[originalTextValue.length - 1];
            if (lastDigit === '0' && !originalTextValue.includes('.')) {
                numberStr = stmt.getRightOp().toString();
            } else {
                this.addIssueReport(stmt, originalTextValue, severity);
                return true;
            };
        };
        return false;
    };

    private checkExponentAndMantissa(stmt: ArkAssignStmt, numberStr: string, originalText: string, severity: number): boolean {
        if (numberStr.includes('e') || numberStr.includes('E')) {
            const [mantissa, exponent] = numberStr.split(/[eE]/);
            const expNum = parseInt(exponent, 10);
            if (expNum > 308 || expNum < -308) {
                const value = originalText.split('=')[1].trim();
                this.addIssueReport(stmt, value, severity);
                return true;
            };
            const mantissaDecimalPart = mantissa.split('.')[1];
            if (mantissaDecimalPart && mantissaDecimalPart.length > 15) {
                const value = originalText.split('=')[1].trim();
                this.addIssueReport(stmt, value, severity);
                return true;
            };
        };
        return false;
    };

    private checkDecimalPart(stmt: ArkAssignStmt, numberStr: string, originalText: string, severity: number): boolean {
        const decimalPart = numberStr.split('.')[1];
        if (decimalPart) {
            if (decimalPart.length > 15) {
                const normalizedDecimalPart = decimalPart.replace(/0+$/, '');
                if (normalizedDecimalPart.length > 1) {
                    const value = originalText.split('=')[1].trim();
                    this.addIssueReport(stmt, value, severity);
                    return true;
                };
            } else {
                const num = parseFloat(numberStr).toString();
                if (num !== numberStr) {
                    const value = originalText.split('=')[1].trim();
                    this.addIssueReport(stmt, value, severity);
                    return true;
                };
            };
        };
        return false;
    };
    private getNumberValue(numberStr: string, stmt: ArkAssignStmt): number {
        if (numberStr.startsWith('0x') || numberStr.startsWith('0X')) {
            return parseInt(numberStr, 16);
        } else if (numberStr.startsWith('0o') || numberStr.startsWith('0O')) {
            return +stmt.getRightOp();
        } else if (numberStr.startsWith('0b') || numberStr.startsWith('0B')) {
            return +stmt.getRightOp();
        } else if (numberStr.includes('e') || numberStr.includes('E')) {
            return parseFloat(numberStr);
        } else {
            return parseFloat(numberStr);
        };
    };
    private isNumber(isNumber: string): boolean {
        const isNumericLiteral = /^-?(0[bB][01_]+|0[oO][0-7_]+|0[xX][0-9a-fA-F_]+|[0-9_]*\.?[0-9_]+([eE][-+]?[0-9_]+)?)$/;
        const isNumberConstantValue = isNumericLiteral.test(isNumber);
        return isNumberConstantValue;
    };
    private addIssueReport(stmt: Stmt, name: string, severity: number) {
        const warnInfo = this.getLineAndColumn(stmt, name);
        const defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
        RuleListUtil.push(defects);
    };
    private getLineAndColumn(stmt: Stmt, name: string) {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            let originText = stmt.getOriginalText() ?? '';
            let startCol = originPosition.getColNo();
            const pos = originText.indexOf(name);
            if (pos !== -1) {
                startCol += pos;
                const endCol = startCol + name.length - 1;
                const originPath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
                return { line, startCol, endCol, filePath: originPath };
            };
        };
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    };
};