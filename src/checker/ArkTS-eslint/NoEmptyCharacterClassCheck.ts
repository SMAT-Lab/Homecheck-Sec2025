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
import { ArkAssignStmt, ArkInstanceInvokeExpr, ArkMethod, Local, Stmt } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher } from "../../matcher/Matchers";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { RuleListUtil } from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoEmptyCharacterClassCheck');

export class NoEmptyCharacterClassCheck implements BaseChecker {
    readonly REG_EXP = 'RegExp';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: "docs/no-empty-character-class.md",
        description: "Disallow empty character classes in regular expressions."
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        file: [this.fileMatcher]
    };

    public registerMatchers(): MatcherCallback[] {
        const methodMatcherCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check,
        };
        return [methodMatcherCb];
    };

    public check = (target: ArkMethod) => {
        const stmts = target.getBody()?.getCfg().getStmts() ?? [];
        for (const stmt of stmts) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }
            let leftOp = stmt.getLeftOp();
            if (!(leftOp instanceof Local)) {
                continue;
            };
            let rightOp = stmt.getRightOp();
            if (rightOp instanceof ArkInstanceInvokeExpr) {
                let rightArgs = rightOp.getArgs();
                for (const rightArg of rightArgs) {
                    let rightArgTyp = rightArg.getType().getTypeString();
                    if (rightArgTyp?.includes(this.REG_EXP)) {
                        this.checkCode(stmt);
                    }
                }
            };
            let leftType = leftOp.getType().getTypeString();
            if (leftType.includes(this.REG_EXP)) {
                this.checkCode(stmt);
            } else {
                let leftUsedStmts = leftOp.getUsedStmts();
                for (const leftUsedStmt of leftUsedStmts) {
                    let leftArgs = leftUsedStmt.getInvokeExpr()?.getArgs() ?? [];
                    for (const leftArg of leftArgs) {
                        let leftArgType = leftArg.getType().getTypeString();
                        if (leftArgType?.includes(this.REG_EXP)) {
                            this.checkCode(stmt);
                        }
                    }
                }
            }
        }
    };

    private checkCode(stmt: Stmt) {
        const originText = stmt.getOriginalText() ?? '';
        // 使用更精确的正则表达式模式来匹配正则表达式
        const regexPattern = /\/(?:[^\/\\]|\\[\s\S])*?\/[gimsuyv]*/g;
        const regexMatches = [...originText.matchAll(regexPattern)];
        for (const regexMatch of regexMatches) {
            const regex = regexMatch[0];
            const matchIndex = regexMatch.index !== undefined ? regexMatch.index : 0;
            const hasVFlag = /\/[gimsuy]*v[gimsuy]*$/.test(regex);
            // 检查基本的空字符类 []
            this.checkEmptyClass(regex, matchIndex, stmt);
            // 检查未闭合的字符类 [
            this.checkUnclosedCharClass(regex, matchIndex, stmt);
            // 如果是v标志的正则表达式，还需要检查嵌套的空字符类
            if (hasVFlag) {
                // 检查 [[]] 模式 (嵌套的空字符类)
                this.checkNestedEmptyClass(regex, matchIndex, stmt);
                // 检查 [[]--[x]] 模式 (减法操作中的空字符类)
                this.checkSetOperationEmptyClass(regex, matchIndex, '--', stmt);
                // 检查 [[x]&&[]] 模式 (交集操作中的空字符类)
                this.checkSetOperationEmptyClass(regex, matchIndex, '&&', stmt);
            }
        }
    };

    // 提取公共方法: 获取正则表达式起始位置
    private getRegexStartPosition(regex: string, startIndex: number, stmt: Stmt): number {
        const content = this.extractRegexContent(regex);
        const originText = stmt.getOriginalText() ?? '';
        let regexStartPos = originText.indexOf(content);
        if (regexStartPos === -1) {
            regexStartPos = startIndex;
        }
        return regexStartPos;
    };

    // 检查未闭合的字符类
    private checkUnclosedCharClass(regex: string, startIndex: number, stmt: Stmt): void {
        // 分析正则表达式，找出未闭合的字符类
        let inCharClass = false;
        let escaped = false;
        let unclosedClassPositions: number[] = [];
        // 正确提取正则表达式内容，避免误提取
        const content = this.extractRegexContent(regex);
        // 获取正则表达式在原始字符串中的准确起始位置
        const regexStartPos = this.getRegexStartPosition(regex, startIndex, stmt);
        // 重构字符类检测逻辑
        for (let i = 0; i < content.length; i++) {
            if (escaped) {
                // 已转义的字符不作为语法字符处理
                escaped = false;
                continue;
            }
            if (content[i] === '\\') {
                // 标记转义
                escaped = true;
                continue;
            }
            if (!inCharClass && content[i] === '[') {
                // 找到字符类的开始
                inCharClass = true;
                unclosedClassPositions.push(i);
            } else if (inCharClass && content[i] === ']') {
                // 找到字符类的结束
                inCharClass = false;
                unclosedClassPositions.pop();
            }
        }
        // 处理所有未闭合的字符类
        for (const pos of unclosedClassPositions) {
            const message = 'Unclosed character class in regular expression';
            // 传递正则表达式起始位置+偏移量，而不是内容的起始位置
            this.addIssueReport(stmt, '[', message, regexStartPos - 1);
        }
    };

    private extractRegexContent(regex: string): string {
        // 检查是否是有效的正则表达式格式
        if (regex.length < 2 || regex[0] !== '/') {
            return '';
        }
        // 查找真正的结束位置，需要考虑转义字符
        let escaped = false;
        let endIndex = -1;
        for (let i = 1; i < regex.length; i++) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (regex[i] === '\\') {
                escaped = true;
                continue;
            }
            if (regex[i] === '/' && !escaped) {
                endIndex = i;
                break;
            }
        }
        if (endIndex === -1) {
            // 未找到有效的结束分隔符
            return regex.substring(1);
        }
        return regex.substring(1, endIndex);
    };

    // 检查基本的空字符类 []
    private checkEmptyClass(regex: string, startIndex: number, stmt: Stmt): void {
        // 提取正则表达式内容，不包括定界符和标志
        const content = this.extractRegexContent(regex);
        // 获取正则表达式在原始字符串中的准确起始位置
        const regexStartPos = this.getRegexStartPosition(regex, startIndex, stmt);
        // 使用状态机检测真正的空字符类，避免误报
        let inCharClass = false;
        let escaped = false;
        let emptyClassPositions: number[] = [];
        let openBracketPos = -1;
        for (let i = 0; i < content.length; i++) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (content[i] === '\\') {
                escaped = true;
                continue;
            }
            if (!inCharClass && content[i] === '[') {
                inCharClass = true;
                openBracketPos = i;
            } else if (inCharClass) {
                if (content[i] === ']' && openBracketPos === i - 1) {
                    // 找到空字符类 []
                    emptyClassPositions.push(openBracketPos);
                    inCharClass = false;
                } else if (content[i] === ']') {
                    // 非空字符类结束
                    inCharClass = false;
                }
            }
        }
        // 对每个空字符类生成报告
        for (const pos of emptyClassPositions) {
            const message = 'Empty class';
            this.addIssueReport(stmt, '[]', message, regexStartPos - 1);
        }
    };

    private handleClosingBracket(
        i: number,
        content: string,
        bracketStack: number[],
        inCharClass: boolean,
        nestedEmptyClassPositions: number[]
    ): void {
        if (bracketStack.length > 0) {
            const openPos = bracketStack.pop() || 0;
            // 如果是空字符类并且在另一个字符类内部
            if (i - openPos === 1 && bracketStack.length > 0) {
                nestedEmptyClassPositions.push(openPos);
            }
        }
        if (bracketStack.length === 0) {
            inCharClass = false;
        }
    }

    // 检查嵌套的空字符类 [[]]
    private checkNestedEmptyClass(regex: string, startIndex: number, stmt: Stmt): void {
        // 提取正则表达式内容
        const content = this.extractRegexContent(regex);
        // 获取正则表达式在原始字符串中的准确起始位置
        const regexStartPos = this.getRegexStartPosition(regex, startIndex, stmt);
        // 查找嵌套的空字符类位置
        const nestedEmptyClassPositions = this.findNestedEmptyClassPositions(content);

        // 对每个嵌套的空字符类生成报告
        for (const pos of nestedEmptyClassPositions) {
            const message = 'Empty class';
            this.addIssueReport(stmt, '[]', message, regexStartPos - 1);
        }
    }

    // 查找嵌套的空字符类位置
    private findNestedEmptyClassPositions(content: string): number[] {
        let bracketStack: number[] = [];
        let nestedEmptyClassPositions: number[] = [];
        let escaped = false;
        let inCharClass = false;

        for (let i = 0; i < content.length; i++) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (content[i] === '\\') {
                escaped = true;
                continue;
            }
            if (content[i] === '[') {
                bracketStack.push(i);
                if (!inCharClass) {
                    inCharClass = true;
                }
            } else if (content[i] === ']' && inCharClass) {
                this.handleClosingBracket(i, content, bracketStack, inCharClass, nestedEmptyClassPositions);
            }
        }
        return nestedEmptyClassPositions;
    }

    // 检查集合操作中的空字符类 [[]--[x]] 或 [[x]&&[]]
    private checkSetOperationEmptyClass(regex: string, startIndex: number, operator: string, stmt: Stmt): void {
        // 更简单的模式，先检测是否包含 "[]" 和 操作符
        if (regex.includes('[]') && regex.includes(operator)) {
            // 执行更精确的分析
            this.analyzeSetOperation(regex, startIndex, operator, stmt);
        }
    };

    private analyzeSetOperation(regex: string, startIndex: number, operator: string, stmt: Stmt): void {
        // 获取正则表达式内容和起始位置
        const content = this.extractRegexContent(regex);
        const regexStartPos = this.getRegexStartPosition(regex, startIndex, stmt);
        const emptyClassPositions = this.findEmptyClassPositions(content, operator);

        // 处理找到的空字符类
        for (const pos of emptyClassPositions) {
            const message = 'Empty class';
            this.addIssueReport(stmt, '[]', message, regexStartPos - 1);
        }
    };

    private findEmptyClassPositions(content: string, operator: string): number[] {
        let inCharClass = false;
        let bracketStack: number[] = [];
        let emptyClassPositions: number[] = [];
        let i = 0;
        while (i < content.length) {
            i = this.processCharacter(
                content,
                i,
                bracketStack,
                emptyClassPositions,
                operator,
                inCharClass
            );

            // 更新inCharClass状态
            if (bracketStack.length === 0) {
                inCharClass = false;
            }
        }

        return emptyClassPositions;
    }

    private processCharacter(
        content: string,
        index: number,
        bracketStack: number[],
        emptyClassPositions: number[],
        operator: string,
        inCharClass: boolean
    ): number {
        const char = content[index];

        // 处理转义字符
        if (this.isEscapeSequence(content, index)) {
            return index + 2;
        }

        // 处理字符类开始
        if (char === '[') {
            bracketStack.push(index);
            inCharClass = true;
            return index + 1;
        }

        // 处理字符类结束
        if (char === ']' && inCharClass) {
            this.processClosingBracket(
                content,
                index,
                bracketStack,
                emptyClassPositions,
                operator
            );
        }

        return index + 1;
    }

    private isEscapeSequence(content: string, index: number): boolean {
        return content[index] === '\\' && index + 1 < content.length;
    }

    private processClosingBracket(
        content: string,
        index: number,
        bracketStack: number[],
        emptyClassPositions: number[],
        operator: string
    ): void {
        if (bracketStack.length > 0) {
            const openPos = bracketStack.pop() || 0;

            // 检查是否为空字符类 []
            if (index - openPos === 1) {
                emptyClassPositions.push(openPos);
            }

            this.checkOperatorContext(
                content,
                openPos,
                index,
                emptyClassPositions,
                operator
            );
        }
    }

    private checkOperatorContext(
        content: string,
        openPos: number,
        closePos: number,
        emptyClassPositions: number[],
        operator: string
    ): void {
        // 检查前后文中是否包含操作符
        const beforeText = content.substring(Math.max(0, openPos - 10), openPos);
        const afterText = content.substring(closePos, Math.min(content.length, closePos + 10));

        if (beforeText.includes(operator) || afterText.includes(operator)) {
            // 检查该字符类是否为空字符类，或者其内容包含空字符类
            const classContent = content.substring(openPos + 1, closePos);

            if (classContent === '') {
                emptyClassPositions.push(openPos);
            } else if (classContent.includes('[]')) {
                const emptyPos = classContent.indexOf('[]');
                if (emptyPos !== -1) {
                    emptyClassPositions.push(openPos + 1 + emptyPos);
                }
            }
        }
    }

    private addIssueReport(stmt: Stmt, matchText: string, message?: string, matchIndex?: number) {
        let currentDescription = message ? message : this.metaData.description;
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt, matchText, matchIndex);
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, currentDescription, severity, this.rule.ruleId,
            warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private getLineAndColumn(stmt: Stmt, matchText: string, matchIndex?: number) {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (!arkFile) {
            logger.debug('originStmt or arkFile is null');
        }
        const originText = stmt.getOriginalText() ?? '';
        // 获取语句起始列号
        let startCol = originPosition.getColNo();
        if (matchIndex !== undefined) {
            // 确保matchIndex是相对于语句开始的偏移量
            startCol += matchIndex;
            const endCol = startCol + matchText.length;
            const originPath = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile().getFilePath();
            return { line, startCol, endCol, filePath: originPath };
        } else {
            // 处理matchIndex未定义的情况
            const pos = originText.indexOf(matchText);
            if (pos !== -1) {
                startCol += pos;
                const endCol = startCol + matchText.length;
                const originPath = arkFile.getFilePath();
                return { line, startCol, endCol, filePath: originPath };
            }
        }
        return { line: -1, startCol: -1, endCol: 0, filePath: '' };
    };
}