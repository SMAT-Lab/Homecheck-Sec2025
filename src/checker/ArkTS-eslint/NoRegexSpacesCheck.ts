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

import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';

interface Violation {
    line: number;
    character: number;
    message: string;
    suggestion: string;
    filePath?: string;
    node: ts.Node
};

export class NoRegexSpacesCheck implements BaseChecker {
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public rule: Rule;
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-regex-spaces-check.md',
        description: 'Disallow multiple spaces in regular expressions.',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatcher];
    };

    public check = (target: ArkFile): void => {
        const astRoot = AstTreeUtils.getSourceFileFromArkFile(target);
        const violations = this.checkAction(astRoot, astRoot);
        violations.forEach((violation) => {
            const filePath = target.getFilePath();
            let defect = this.addIssueReport(violation, filePath);
            let ruleFix = this.createFix(violation.node, violation.suggestion);
            this.issues.push(new IssueReport(defect, ruleFix));
        });
    };

    private checkAction(astRoot: ts.Node, sourceFile: ts.SourceFile): Violation[] {
        const violations: Violation[] = [];
        const checkNode = (node: ts.Node): void => {
            // 检查正则表达式字面量
            if (ts.isRegularExpressionLiteral(node)) {
                this.checkRegexLiteral(node, sourceFile, violations);
            }
            // 检查通过 RegExp 构造函数创建的正则表达式
            if (
                (ts.isNewExpression(node) || ts.isCallExpression(node)) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === 'RegExp'
            ) {
                this.checkRegExpConstructor(node, sourceFile, violations, node);
            }
            ts.forEachChild(node, checkNode);
        };
        checkNode(astRoot);
        return violations;
    };

    private checkRegexLiteral(node: ts.RegularExpressionLiteral, sourceFile: ts.SourceFile, violations: Violation[]): void {
        const regexText = node.text;
        if (!/ {2,}/.test(regexText) || /^\s+$/.test(regexText)) {
            return;
        }
        const spaceCount = this.countConsecutiveSpaces(regexText);
        if (this.hasInvalidMultipleSpaces(regexText)) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const suggestion = this.fixMultipleSpaces(regexText);
            violations.push({
                message: `Spaces are hard to count. Use {${spaceCount}}`,
                line: line + 1,
                character: character + 1,
                suggestion: suggestion,
                node: node
            });
        }
    };

    private hasInvalidMultipleSpaces(regexText: string): boolean {
        let state = {
            inCharClass: false,
            inQuantifier: false,
            inLookahead: false,
            escaped: false,
            spaceCount: 0,
            charClassDepth: 0
        };
        for (let i = 0; i < regexText.length; i++) {
            const char = regexText[i];
            // 处理转义字符
            if (this.handleEscapedCharacter(state, char)) {
                continue;
            }
            // 处理字符类
            const charClassResult = this.handleCharClass(state, char, regexText, i);
            if (charClassResult.processed) {
                continue;
            }
            // 处理前瞻
            const lookaheadResult = this.handleLookahead(state, char, regexText, i);
            if (lookaheadResult.processed) {
                i = lookaheadResult.newIndex;
                continue;
            }
            // 处理量词
            if (this.handleQuantifier(state, char)) {
                continue;
            }

            // 处理空格
            if (char === ' ' && !state.escaped) {
                if (this.isInvalidSpace(state, regexText, i)) {
                    return true;
                }
            } else {
                state.spaceCount = 0;
            }
        }
        return false;
    };

    private handleCharClass(state: any, char: string, regexText: string, index: number): { processed: boolean } {
        if (char === '[' && !state.escaped) {
            state.charClassDepth++;
            state.inCharClass = true;
            state.spaceCount = 0;
            return { processed: true };
        }
        if (char === ']' && !state.escaped && state.inCharClass) {
            state.charClassDepth--;
            if (state.charClassDepth === 0) {
                state.inCharClass = false;
            }
            state.spaceCount = 0;
            return { processed: true };
        }
        return { processed: false };
    };

    private handleLookahead(state: any, char: string, regexText: string, index: number): { processed: boolean, newIndex: number } {
        if (char === '(' && !state.escaped && regexText.substr(index, 3) === '(?=') {
            state.inLookahead = true;
            state.spaceCount = 0;
            return { processed: true, newIndex: index + 2 }; // 跳过 ?=
        }
        if (char === ')' && !state.escaped && state.inLookahead) {
            state.inLookahead = false;
            state.spaceCount = 0;
            return { processed: true, newIndex: index };
        }
        return { processed: false, newIndex: index };
    };

    private handleQuantifier(state: any, char: string): boolean {
        if (char === '{' && !state.escaped) {
            state.inQuantifier = true;
            state.spaceCount = 0;
            return true;
        }
        if (char === '}' && !state.escaped && state.inQuantifier) {
            state.inQuantifier = false;
            state.spaceCount = 0;
            return true;
        }
        return false;
    };

    private handleEscapedCharacter(state: any, char: string): boolean {
        if (state.escaped) {
            state.escaped = false;
            if (char === ' ') {
                state.spaceCount = 0;
            }
            return true;
        }
        if (char === '\\') {
            state.escaped = true;
            return true;
        }
        return false;
    };

    private isInvalidSpace(state: any, regexText: string, index: number): boolean {
        // 在任何层级的字符类中都允许连续空格
        if (state.charClassDepth > 0) {
            return false;
        }
        state.spaceCount++;
        if (state.spaceCount > 1 && !state.inQuantifier) {
            // 检查后面是否紧跟着量词
            const nextChar = regexText[index + 1];
            if (nextChar !== '{' && nextChar !== '*' && nextChar !== '+' && nextChar !== '?') {
                return true;
            }
        }
        return false;
    };

    private checkRegExpConstructor(
        node: ts.NewExpression | ts.CallExpression,
        sourceFile: ts.SourceFile,
        violations: Violation[],
        parentNode: ts.Node
    ): void {
        if (node.arguments && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
            const regexText = node.arguments[0].text;
            if (!/ {2,}/.test(regexText) || /^\s+$/.test(regexText)) {
                return;
            }
            const spaceCount = this.countConsecutiveSpaces(regexText);
            if (this.hasInvalidMultipleSpaces(regexText)) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                const suggestion = this.fixRegExpString(node);
                violations.push({
                    message: `Spaces are hard to count. Use {${spaceCount}}`,
                    line: line + 1,
                    character: character + 1,
                    suggestion: suggestion,
                    node: node
                });
            }
        }
    }

    private fixRegExpString(node: ts.NewExpression | ts.CallExpression): string {
        if (!node.arguments || node.arguments.length === 0 || !ts.isStringLiteral(node.arguments[0])) {
            return node.getText();
        }
        const regexText = node.arguments[0].text;
        const fixedRegexText = this.fixMultipleSpaces(regexText);
        const quoteChar = node.arguments[0].getText().charAt(0); // 获取原始引号类型 (' 或 ")
        // 保持原始构造函数调用形式
        if (ts.isNewExpression(node)) {
            return `new RegExp(${quoteChar}${fixedRegexText}${quoteChar})`;
        } else {
            return `RegExp(${quoteChar}${fixedRegexText}${quoteChar})`;
        }
    }

    private fixMultipleSpaces(regexText: string): string {
        // 第一步：保存和替换特殊部分
        const result = this.saveSpecialParts(regexText);
        let processedText = result.processedText;
        const savedParts = result.savedParts;
        // 第二步：修复前瞻断言中的空格
        processedText = this.fixLookaheads(processedText);
        // 第三步：特殊处理量词序列情况
        processedText = this.fixQuantifiers(processedText);
        // 第四步：修复常规连续空格
        processedText = this.fixRegularSpaces(processedText);
        // 第五步：恢复保存的部分
        processedText = this.restoreSavedParts(processedText, savedParts);
        return processedText;
    }

    private saveSpecialParts(regexText: string): { processedText: string, savedParts: { [key: string]: string } } {
        const savedParts: { [key: string]: string } = {};
        let uniqueId = 0;

        // 替换并保存字符类内容
        let processedText = regexText.replace(/\[([^\]]*)\]/g, (match) => {
            const placeholder = `__CLASS_${uniqueId}__`;
            savedParts[placeholder] = match;
            uniqueId++;
            return placeholder;
        });

        // 替换并保存转义字符
        processedText = processedText.replace(/\\(.)/g, (match) => {
            const placeholder = `__ESCAPE_${uniqueId}__`;
            savedParts[placeholder] = match;
            uniqueId++;
            return placeholder;
        });

        return { processedText, savedParts };
    }

    private fixLookaheads(text: string): string {
        return text.replace(/\(\?=([^)]*)\)/g, (match, inside: string) => {
            // 修复前瞻断言内的空格
            const fixedInside = inside.replace(/ {2,}/g, (spaces: string) => {
                return ` {${spaces.length}}`;
            });
            return `(?=${fixedInside})`;
        });
    }

    private spacesRegex = / {2,}(?=[\?\*\+\{])/g;

    private fixQuantifiers(text: string): string {
        // 特殊处理量词序列情况：如 "  {3}" 或 "  +" 等
        return text.replace(this.spacesRegex, (spaces: string) => {
            return ` {${spaces.length - 1}} `;
        });
    }

    private fixRegularSpaces(text: string): string {
        // 修复其他普通连续空格
        return text.replace(/ {2,}/g, (spaces: string) => {
            return ` {${spaces.length}}`;
        });
    }

    private restoreSavedParts(text: string, savedParts: { [key: string]: string }): string {
        let restoredText = text;
        // 恢复保存的部分
        Object.keys(savedParts).forEach(placeholder => {
            restoredText = restoredText.replace(placeholder, savedParts[placeholder]);
        });
        return restoredText;
    }

    private countConsecutiveSpaces(text: string): number {
        const isSpecial = this.isSpecialRegexPattern(text);
        if (isSpecial) {
            // 返回第一个连续空格序列的长度
            const firstSpaceLength = this.getFirstSpaceSequenceLength(text);
            return firstSpaceLength;
        }

        let maxConsecutiveSpaces = 0;
        let currentSpaces = 0;
        let i = 0;

        while (i < text.length) {
            // 处理转义字符
            if (text[i] === '\\') {
                const result = this.handleEscapeCharacter(text, i, currentSpaces, maxConsecutiveSpaces);
                i = result.index;
                currentSpaces = result.currentSpaces;
                maxConsecutiveSpaces = result.maxSpaces;
                continue;
            }

            // 处理字符类 [...]
            if (text[i] === '[') {
                const result = this.handleCharacterClass(text, i, currentSpaces, maxConsecutiveSpaces);
                i = result.index;
                currentSpaces = result.currentSpaces;
                maxConsecutiveSpaces = result.maxSpaces;
            }

            // 空格计数
            if (text[i] === ' ') {
                currentSpaces++;
            } else {
                const result = this.handleNonSpaceCharacter(text[i], currentSpaces, maxConsecutiveSpaces);
                currentSpaces = result.currentSpaces;
                maxConsecutiveSpaces = result.maxSpaces;
            }
            i++;
        }

        // 检查结尾的空格序列
        maxConsecutiveSpaces = this.updateMaxSpaceCount(currentSpaces, maxConsecutiveSpaces);

        return maxConsecutiveSpaces;
    }

    /**
     * 处理转义字符
     */
    private handleEscapeCharacter(
        text: string,
        index: number,
        currentSpaces: number,
        maxSpaces: number): {
            index: number,
            currentSpaces: number,
            maxSpaces: number
        } {
        // 跳过转义字符和被转义的字符
        index += 2;
        // 不立即重置计数器，先检查是否需要记录
        maxSpaces = this.updateMaxSpaceCount(currentSpaces, maxSpaces);
        currentSpaces = 0;

        return { index, currentSpaces, maxSpaces };
    }

    /**
     * 处理字符类
     */
    private handleCharacterClass(
        text: string,
        index: number,
        currentSpaces: number,
        maxSpaces: number): {
            index: number,
            currentSpaces: number,
            maxSpaces: number
        } {
        // 首先检查当前累积的空格数
        maxSpaces = this.updateMaxSpaceCount(currentSpaces, maxSpaces);

        // 跳过整个字符类内容
        const closingBracket = this.findClosingBracket(text, index);
        if (closingBracket > index) {
            // 字符类作为一个整体，相当于一个非空格字符
            // 记录当前的连续空格
            maxSpaces = this.updateMaxSpaceCount(currentSpaces, maxSpaces);
            currentSpaces = 0; // 重置空格计数
            index = closingBracket + 1;
        }

        return { index, currentSpaces, maxSpaces };
    }

    /**
     * 处理非空格字符
     */
    private handleNonSpaceCharacter(
        char: string,
        currentSpaces: number,
        maxSpaces: number): {
            currentSpaces: number,
            maxSpaces: number
        } {
        // 遇到非空格字符，处理已累积的空格
        if (currentSpaces >= 2) {
            // 检查是否紧跟量词
            if (this.isQuantifier(char)) {
                // 量词前的空格，最后一个空格不计入违规
                currentSpaces--;
            }

            // 更新最大空格数
            maxSpaces = this.updateMaxSpaceCount(currentSpaces, maxSpaces);
        }

        currentSpaces = 0;
        return { currentSpaces, maxSpaces };
    }

    /**
     * 检查字符是否为量词
     */
    private isQuantifier(char: string): boolean {
        return char === '{' || char === '*' || char === '+' || char === '?';
    }

    /**
     * 更新最大空格计数
     */
    private updateMaxSpaceCount(currentSpaces: number, maxSpaces: number): number {
        if (currentSpaces >= 2 && currentSpaces > maxSpaces) {
            return currentSpaces;
        }
        return maxSpaces;
    }

    // 新增：检查是否为特殊的正则表达式模式
    private isSpecialRegexPattern(text: string): boolean {
        try {
            const result = /^\/\s{2,}.+?\s{2,}\/$/.test(text);
            return result;
        } catch (e) {
            return false;
        }
    };

    // 新增：获取第一个连续空格序列的长度
    private getFirstSpaceSequenceLength(text: string): number {
        // 跳过开始的'/'分隔符
        let startIndex = text.startsWith('/') ? 1 : 0;
        let spaceCount = 0;
        for (let i = startIndex; i < text.length; i++) {
            if (text[i] === ' ') {
                spaceCount++;
            } else {
                break;
            }
        }
        return spaceCount >= 2 ? spaceCount : 0;
    };

    private createFix(node: ts.Node, fixText: string): { range: [number, number], text: string } {
        return {
            range: [node.getStart(), node.getEnd()],
            text: fixText
        };
    };

    private addIssueReport(violation: Violation, filePath: string): Defects {
        this.metaData.description = violation.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(
            violation.line,
            violation.character,
            violation.character,
            this.metaData.description,
            severity, this.rule.ruleId,
            filePath,
            this.metaData.ruleDocPath, true, false, true);
        this.defects.push(defect);
        RuleListUtil.push(defect);
        return defect;
    };

    private findClosingBracket(text: string, start: number): number {
        let i = start + 1;
        while (i < text.length) {
            if (text[i] === '\\') {
                // 跳过转义字符
                i += 2;
                continue;
            }
            if (text[i] === ']') {
                return i;
            }
            i++;
        }
        return -1;
    }
}