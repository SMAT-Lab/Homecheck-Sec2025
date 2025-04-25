/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUselessEscapeCheck');

// 定义一个包含各种换行符的 Set 对象
const LINEBREAKS = new Set(["\r\n", "\r", "\n", "\\u2028", "\\u2029"]);
// 调用 union 函数，将一个包含特定转义字符的 Set 和 LINEBREAKS 集合合并
const VALID_STRING_ESCAPES = union(new Set("\\nrvtbfux"), LINEBREAKS);
// 在正则表达式中常用的转义字符和数字字符
const REGEX_GENERAL_ESCAPES = new Set("\\bcdDfnpPrsStvwWxu0123456789]");
// 用于非字符类的正则表达式上下文
const REGEX_NON_CHARCLASS_ESCAPES = union(REGEX_GENERAL_ESCAPES, new Set("^/.$*+?[{}|()Bk"));
/* 
 * 用于字符类的正则表达式上下文
 * Set of characters that require escaping in character classes in `unicodeSets` mode.
 * ( ) [ ] { } / - \ | are ClassSetSyntaxCharacter
 */
const REGEX_CLASSSET_CHARACTER_ESCAPES = union(REGEX_GENERAL_ESCAPES, new Set("q/[{}|()-"));

/*
 * 正则表达式中可能需要特殊处理的双标点符号
 * A single character set of ClassSetReservedDoublePunctuator.
 * && !! ## $$ %% ,, :: ;; << == >> ?? @@ `` ~~ are ClassSetReservedDoublePunctuator
 */
const REGEX_CLASS_SET_RESERVED_DOUBLE_PUNCTUATOR = new Set("!#$%&,:;<=>@`~");
/*
 * 正则表达式中可能需要特殊处理的双标点符号
 *  ^ * + . 这些普通字符
 */
const REGEX_SPECIAL_DOUBLE_PUNCTUATOR = new Set("*+^?");
/*
 * 正则表达式中可能需要特殊处理的 Unicode 属性
 * 
 */
const UNICODE_PROPERTY_REGEX = /^[pP]\{/;

/**
 * 合并两个集合
 * @param setA 第一个集合
 * @param setB 第二个集合
 * @returns 包含两个集合元素的新集合
 */
function union<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    return new Set([...Array.from(setA), ...Array.from(setB)]);
}

interface WarnInfo {
    line: number;
    character: number;
    endCol: number;
    message: string;
}

interface EscapeInfo { start: number, end: number, negate: boolean };

export class NoUselessEscapeCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private filePath: string = '';
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-useless-escape-check.md',
        description: `Unnecessary escape character: `,
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    };

    public check = (target: ArkFile): void => {
        this.filePath = target.getFilePath();
        this.checkAction(target);
    };

    private checkAction(target: ArkFile): void {
        try {
            const tempWarnInfos: WarnInfo[] = [];
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);

            this.traverseAst(sourceFile, tempWarnInfos, target);

            // 按行号和字符位置排序后添加到 issues
            this.addSortedWarnings(tempWarnInfos);
        } catch (error) {
            logger.error(`Error in checkAction: ${error instanceof Error ? error.message : String(error)}`);
        };
    };

    private traverseAst(node: ts.Node, warnInfos: WarnInfo[], target: ArkFile): void {
        if (this.shouldCheckNode(node)) {
            this.processNode(node, warnInfos, target);
        };
        ts.forEachChild(node, child => this.traverseAst(child, warnInfos, target));
    };

    private shouldCheckNode(node: ts.Node): boolean {
        return ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isTemplateExpression(node) ||
            ts.isRegularExpressionLiteral(node) ||
            (ts.isNewExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === 'RegExp');
    };

    private processNode(node: ts.Node, warnInfos: WarnInfo[], target: ArkFile): void {
        const sourceFile = node.getSourceFile();

        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
            this.checkStringLiteral(node, sourceFile, target, warnInfos);
        } else if (ts.isRegularExpressionLiteral(node)) {
            this.checkRegexLiteral(node, sourceFile, target, warnInfos);
        } else if (ts.isNewExpression(node)) {
            this.checkRegExpConstructor(node, sourceFile, target, warnInfos);
        };
    };

    private addSortedWarnings(warnInfos: WarnInfo[]): void {
        warnInfos
            .sort((a, b) => a.line === b.line ? a.character - b.character : a.line - b.line)
            .forEach(warnInfo => this.addIssueReport(warnInfo));
    };

    private checkStringLiteral(node: ts.Node, sourceFile: ts.SourceFile, target: ArkFile, warnInfos: WarnInfo[]): void {
        if (ts.isTemplateExpression(node)) {
            // 处理模板字符串表达式
            node.templateSpans.forEach((span) => {
                // 处理插值前的部分
                this.checkTemplatePart(node, span.literal, sourceFile, warnInfos);
                // 处理插值表达式
                this.checkStringLiteral(span.expression, sourceFile, target, warnInfos);
            });
            // 处理模板字符串的最后一部分
            this.checkTemplatePart(node, node.head, sourceFile, warnInfos);
        } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            // 处理普通字符串字面量或无替换的模板字符串
            const start = node.getStart();
            const end = node.getEnd();
            const text = sourceFile.getFullText().slice(start, end);
            this.checkTextForUselessEscapes(node, text, start, sourceFile, warnInfos);
        };
    };

    private checkTemplatePart(node: ts.Node, part: ts.TemplateLiteralLikeNode, sourceFile: ts.SourceFile, warnInfos: WarnInfo[]): void {
        const start = part.getStart();
        const end = part.getEnd();
        const text = sourceFile.getFullText().slice(start, end);
        this.checkTextForUselessEscapes(node, text, start, sourceFile, warnInfos);
    };

    // 公共方法： 检查文本中的转义符
    private checkTextForUselessEscapes(node: ts.Node, text: string, start: number, sourceFile: ts.SourceFile, warnInfos: WarnInfo[]): void {
        const pattern = /\\[^\d]/gu;
        let match;
        while ((match = pattern.exec(text))) {
            const escapedChar = match[0][1];
            let isUnnecessaryEscape = !VALID_STRING_ESCAPES.has(escapedChar);
            let isQuoteEscape;
            const isTemplateElement = ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node);
            if (isTemplateElement) {
                isQuoteEscape = escapedChar === "`";
                if (escapedChar === "$") {
                    // Warn if `\$` is not followed by `{`
                    isUnnecessaryEscape = match.input[match.index + 2] !== "{";
                } else if (escapedChar === "{") {
                    // Warn if `\{` is not preceded by `$`
                    isUnnecessaryEscape = match.input[match.index - 1] !== "$";
                };
            } else {
                isQuoteEscape = escapedChar === text[0];
            };
            if (isUnnecessaryEscape && !isQuoteEscape) {
                // 计算无用转义字符的实际位置
                const actualPosition = start + match.index;
                let { line, character } = sourceFile.getLineAndCharacterOfPosition(actualPosition);
                warnInfos.push({
                    line: line + 1,
                    character: character + 1,
                    endCol: character + 2,
                    message: escapedChar === ' ' ? `Unnecessary escape character: \\${escapedChar}.` : `Unnecessary escape character: \\${escapedChar}`,
                });
            };
        };
    };

    /**
     * 检查正则表达式字面量中是否存在不必要的转义字符
     * @param node - 正则表达式字面量节点
     * @param sourceFile - 源文件对象
     * @param target - ArkFile 对象，用于获取文件路径
     */
    private checkRegexLiteral(node: ts.RegularExpressionLiteral, sourceFile: ts.SourceFile, target: ArkFile, warnInfos: WarnInfo[]): void {
        const regexText = node.text;
        // 从正则表达式节点中提取模式和标志信息
        const pattern = regexText.slice(1, regexText.lastIndexOf('/'));
        const flags = regexText.slice(regexText.lastIndexOf('/') + 1);
        // 获取模式文本在源文件中的起始位置
        const start = node.getStart() + 1;
        // 判断是否启用 Unicode 模式
        const unicode = flags.includes("u");
        // 判断是否启用 Unicode 集合模式
        const unicodeSets = flags.includes("v");
        this.commonCheckRegex(pattern, start, sourceFile, target, unicode, unicodeSets, warnInfos);
    };

    /**
     * 检查使用 new RegExp 构造函数创建的正则表达式中是否存在不必要的转义字符
     * @param node - new RegExp 调用节点
     * @param sourceFile - 源文件对象
     * @param target - ArkFile 对象，用于获取文件路径
     */
    private checkRegExpConstructor(node: ts.NewExpression, sourceFile: ts.SourceFile, target: ArkFile, warnInfos: WarnInfo[]): void {
        const args = node.arguments;
        if (!args || args?.length === 0) {
            return;
        };
        const patternArg = args[0];
        const flagsArg = args.length > 1 ? args[1] : undefined;
        if (ts.isStringLiteral(patternArg)) {
            const pattern = patternArg.text;
            const regexFlags = flagsArg && ts.isStringLiteral(flagsArg) ? flagsArg.text : '';
            const start = patternArg.getStart();
            const unicode = regexFlags.includes("u");
            const unicodeSets = regexFlags.includes("v");
            // 如果是 Unicode 模式，我们需要特别小心处理转义
            if (unicode) {
                try {
                    // 尝试创建正则表达式来验证语法
                    new RegExp(pattern, regexFlags);
                } catch (e) {
                    // 如果创建失败，说明有无效的转义序列
                    // 在这种情况下，所有转义都是必要的
                    return;
                };
            };
            this.commonCheckRegex(pattern, start, sourceFile, target, unicode, unicodeSets, warnInfos);
        };
    };

    private commonCheckRegex(pattern: string, start: number, sourceFile: ts.SourceFile, target: ArkFile, unicode: boolean,
        unicodeSets: boolean, warnInfos: WarnInfo[]): void {
        const characterClassStack: EscapeInfo[] = [];
        for (let i = 0; i < pattern.length; i++) {
            const currentChar = pattern[i];
            if (currentChar === '[' || currentChar === ']') {
                this.handleCharacterClass(currentChar, i, start, characterClassStack);
                continue;
            };
            if (currentChar === '\\') {
                this.checkEscapeCharacter(pattern, i, start, sourceFile, warnInfos, characterClassStack, unicode, unicodeSets);
                i++; // 跳过转义字符后的字符
            };
        };
    };

    private handleCharacterClass(char: string, index: number, start: number, characterClassStack: EscapeInfo[]): void {
        if (char === '[') {
            // 只有当不在字符类中时，才开始新的字符类
            if (characterClassStack.length === 0) {
                characterClassStack.unshift({
                    start: index + start,
                    end: -1,
                    negate: false
                });
            };
            // 如果已经在字符类中，[就是普通字符
        } else if (char === ']' && characterClassStack.length) {
            characterClassStack[0].end = index + start;
            characterClassStack.shift();
        };
    };

    private checkEscapeCharacter(pattern: string, index: number, start: number, sourceFile: ts.SourceFile, warnInfos: WarnInfo[],
        characterClassStack: EscapeInfo[], unicode: boolean, unicodeSets: boolean): void {
        const nextChar = pattern[index + 1];
        if (!nextChar) {
            return;
        };

        const inCharClass = characterClassStack.length > 0;
        if (this.isUselessEscape(inCharClass, pattern, index, nextChar, characterClassStack[0]?.start - start,
            unicode, unicodeSets, characterClassStack, start)) {
            const actualPosition = start + index;
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(actualPosition);
            warnInfos.push({
                line: line + 1,
                character: character + 1,
                endCol: character + 2,
                message: `Unnecessary escape character: \\${nextChar}`
            });
        };
    };

    /**
     * 判断转义字符是否为不必要的转义
     * @param inCharClass - 是否处于字符类内部
     * @param regexStr - 正则表达式模式的文本内容
     * @param index - 当前字符的索引
     * @param nextChar - 转义字符后面的字符
     * @param charClassStartIndex - 字符类的起始索引
     * @param unicode - 是否启用 Unicode 模式
     * @param unicodeSets - 是否启用 Unicode 集合模式
     * @param characterClassStack - 字符类栈
     * @param start - 正则表达式模式在源文件中的起始位置
     * @returns 是否为不必要的转义
     */
    private isUselessEscape(
        inCharClass: boolean,
        regexStr: string,
        index: number,
        nextChar: string,
        charClassStartIndex: number,
        unicode: boolean,
        unicodeSets: boolean,
        characterClassStack: any[],
        start: number
    ): boolean {
        // 如果是 Unicode 模式，所有转义都是必要的
        // 因为无效的转义会导致 SyntaxError
        if (unicode && !inCharClass) {
            return false;
        };
        const validEscapes = this.getValidEscapes(inCharClass, unicodeSets);

        if (validEscapes.has(nextChar)) {
            return false;
        };

        // 处理字符类内的特殊情况
        if (inCharClass) {
            if (this.handleCharClassEscapes(nextChar, regexStr, index, charClassStartIndex)) {
                return true;
            };

            if (nextChar === '^') {
                return this.handleCharClassSpecialCases(nextChar, regexStr, index, charClassStartIndex,
                    characterClassStack, start, unicode, unicodeSets);
            };

            if (this.shouldKeepDashEscape(nextChar, unicodeSets, characterClassStack, index, start)) {
                return false;
            };

            return this.handleInCharClassEscapes(nextChar, regexStr, index, charClassStartIndex,
                characterClassStack, start, unicode, unicodeSets);
        };

        // 处理 Unicode 模式的特殊情况
        if (unicode && this.shouldKeepUnicodeEscape(regexStr, index, nextChar)) {
            return false;
        };

        return true;
    };

    private handleInCharClassEscapes(
        nextChar: string,
        regexStr: string,
        index: number,
        charClassStartIndex: number,
        characterClassStack: any[],
        start: number,
        unicode: boolean,
        unicodeSets: boolean
    ): boolean {
        // 处理重复字符转义
        if (this.isRepeatedChar(regexStr, index, nextChar)) {
            if (unicode && !unicodeSets && !REGEX_CLASS_SET_RESERVED_DOUBLE_PUNCTUATOR.has(nextChar)) {
                return true;
            };
            if (unicodeSets && this.isSubsequentEscape(regexStr, index)) {
                return false;
            };
        };

        // 处理 unicodeSets 模式下的特殊情况
        if (unicodeSets && this.isSpecialPunctuator(nextChar)) {
            return !this.isValidDoublePunctuatorEscape(regexStr, index, nextChar, characterClassStack, start, true);
        };

        // 处理非 Unicode 模式的特殊情况
        if (!unicode && !unicodeSets) {
            return this.handleNonUnicodeCharClass(regexStr, index, charClassStartIndex);
        }

        // 检查特殊组合
        return !this.isCharClassWithSpecialCombination(regexStr, charClassStartIndex);
    };

    private shouldKeepDashEscape(nextChar: string, unicodeSets: boolean, characterClassStack: any[], index: number, start: number): boolean {
        return nextChar === '-' && !unicodeSets && this.isDashInMiddleOfClass(characterClassStack, index, start);
    };

    private shouldKeepUnicodeEscape(regexStr: string, index: number, nextChar: string): boolean {
        return this.isSurrogatePair(regexStr, index + 1) ||
            this.isValidUnicodeProperty(nextChar, regexStr, index);
    };

    private isSpecialPunctuator(nextChar: string): boolean {
        return REGEX_CLASS_SET_RESERVED_DOUBLE_PUNCTUATOR.has(nextChar) ||
            REGEX_SPECIAL_DOUBLE_PUNCTUATOR.has(nextChar) ||
            nextChar === '.';
    };

    private handleNonUnicodeCharClass(regexStr: string, index: number, charClassStartIndex: number): boolean {
        const charClassContent = regexStr.slice(charClassStartIndex + 1, regexStr.indexOf(']', charClassStartIndex));
        const currentIndexInClass = index - charClassStartIndex - 1;

        if (currentIndexInClass < charClassContent.length - 2 && charClassContent.startsWith('\\.--')) {
            return false;
        };

        if (currentIndexInClass < charClassContent.length && charClassContent.endsWith('--\\.')) {
            return false;
        };

        return true;
    };

    private handleCharClassEscapes(nextChar: string, regexStr: string, index: number, charClassStartIndex: number): boolean {
        return this.isUnnecessaryBracketEscape(nextChar, regexStr, index) ||
            this.isUnnecessaryDashEscape(nextChar, index, charClassStartIndex, regexStr);
    };

    private handleCharClassSpecialCases(nextChar: string, regexStr: string, index: number, charClassStartIndex: number,
        characterClassStack: any[], start: number, unicode: boolean, unicodeSets: boolean): boolean {
        const characterClassNode = characterClassStack[0];
        const charClassContent = regexStr.slice(charClassStartIndex + 1, regexStr.indexOf(']', charClassStartIndex));
        const currentIndexInClass = index - charClassStartIndex - 1;
        const charClassStart = characterClassNode.start;
        const currentIndex = index + start;

        // 上一个字符
        const prevChar = currentIndexInClass > 0 ? charClassContent[currentIndexInClass - 1] : '';
        // 下一个字符
        const nextCharInClass = currentIndexInClass < charClassContent.length - 1 ? charClassContent[currentIndexInClass + 1] : '';
        // 下下一个字符
        const nextNextCharInClass = currentIndexInClass < charClassContent.length - 2 ? charClassContent[currentIndexInClass + 2] : '';

        // 如果 ^ 在字符类开头，是取反符号，转义有意义
        if (currentIndex === charClassStart + 1) {
            return false;
        };

        // 检查是特殊情况
        if (unicodeSets && currentIndexInClass > 1 &&
            currentIndexInClass < charClassContent.length &&
            (charClassContent.endsWith('^\\^\\^') || charClassContent.startsWith('^^\\^'))
        ) {
            return false;
        };

        // 如果前后有其他 ^，转义有意义
        if (unicodeSets && (prevChar === '^' || nextCharInClass === '^') && nextNextCharInClass === '^') {
            return false;
        };
        // 其他情况认为转义无用
        return true;
    };

    // 获取有效的转义字符集合
    private getValidEscapes(inCharClass: boolean, unicodeSets: boolean): Set<string> {
        return inCharClass ? (unicodeSets ? REGEX_CLASSSET_CHARACTER_ESCAPES : REGEX_GENERAL_ESCAPES) : REGEX_NON_CHARCLASS_ESCAPES;
    };

    // 判断 [ 的转义是否不必要
    private isUnnecessaryBracketEscape(nextChar: string, regexStr: string, index: number): boolean {
        return nextChar === '[' && regexStr[index + 2] !== '=' && regexStr[index + 2] !== ':' && regexStr[index + 2] !== '^';
    };

    // 判断 - 的转义是否不必要
    private isUnnecessaryDashEscape(nextChar: string, index: number, charClassStartIndex: number, regexStr: string): boolean {
        return nextChar === '-' && (index === charClassStartIndex + 1 || regexStr[index + 2] === ']');
    };

    // 判断 - 是否在字符类中间
    private isDashInMiddleOfClass(characterClassStack: any[], index: number, start: number): boolean {
        const characterClassNode = characterClassStack[0];
        return characterClassNode.start + 1 !== index + start && index + start + 2 !== characterClassNode.end - 1;
    };

    // 判断是否为有效的 Unicode 属性
    private isValidUnicodeProperty(nextChar: string, regexStr: string, index: number): boolean {
        if (nextChar === 'p' || nextChar === 'P') {
            const nextTwoChars = regexStr.slice(index + 1, index + 3);
            return UNICODE_PROPERTY_REGEX.test(nextTwoChars);
        }
        return false;
    };

    // 判断是否为重复字符
    private isRepeatedChar(regexStr: string, index: number, nextChar: string): boolean {
        return index + 1 < regexStr.length && regexStr[index + 1] === nextChar;
    };

    // 判断是否为后续的转义
    private isSubsequentEscape(regexStr: string, index: number): boolean {
        return index > 0 && regexStr[index - 1] === '\\';
    };

    // 判断双标点符号转义是否有效
    private isValidDoublePunctuatorEscape(regexStr: string, index: number, nextChar: string, characterClassStack: any[], start: number,
        unicodeSets: boolean): boolean {
        // 检查下一个字符是否和当前字符相同
        if (index + 1 < regexStr.length && regexStr[index + 1] === nextChar) {
            // v 模式下，后续重复双标点符号转义有效
            // 检查前一个字符是否为转义符号 \
            if (index > 0 && regexStr[index - 1] === '\\') {
                // 如果前一个字符是转义符号，说明当前转义是连续双标点符号中的后续转义，认为是有效的转义
                return true;
            };
        };
        // 检查当前字符和后面一个字符相同
        if (index > 0 && regexStr[index + 2] === nextChar && unicodeSets) {
            return true;
        };
        // 检查前一个字符是否和当前字符相同
        if (index > 0 && regexStr[index - 1] === nextChar && unicodeSets) {
            // 如果当前字符不是 ^
            if (nextChar !== '^') {
                // 对于非 ^ 的双标点符号，如果前一个字符和当前字符相同，认为是有效的转义
                return true;
            }
            // 获取当前字符类节点
            const characterClassNode = characterClassStack[0];
            // 检查字符类是否没有取反（即不以 ^ 开头表示取反）
            if (!characterClassNode.negate) {
                // 如果字符类没有取反，认为当前 ^ 的转义是有效的
                return true;
            }
            // 获取字符类中取反符号 ^ 的索引位置
            const negateCaretIndex = characterClassNode.start + 1;
            // 检查取反符号 ^ 的索引是否小于当前索引减去起始偏移
            return negateCaretIndex < index + start - 1;
        };
        // 如果以上条件都不满足，认为当前转义是无效的
        return false;
    };

    // 通用函数：判断字符类中是否有特殊组合
    private isCharClassWithSpecialCombination(regexStr: string, charClassStartIndex: number): boolean {
        const charClassContent = regexStr.slice(charClassStartIndex + 1, regexStr.length - 1);
        const specialCombinations = ['..', '--', '&&', '||'];
        const hasSpecialCombination = specialCombinations.some(comb => charClassContent.includes(comb));
        const hasUnicodeProperty = /\\p\{/.test(charClassContent);

        return hasSpecialCombination || hasUnicodeProperty;
    };

    // 检查是否为代理对
    private isSurrogatePair(str: string, index: number): boolean {
        const charCode = str.charCodeAt(index);
        return charCode >= 0xD800 && charCode <= 0xDBFF &&
            index + 1 < str.length &&
            str.charCodeAt(index + 1) >= 0xDC00 && str.charCodeAt(index + 1) <= 0xDFFF;
    };

    private addIssueReport(warnInfo: WarnInfo): void {
        this.metaData.description = warnInfo.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(warnInfo.line, warnInfo.character, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            this.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };
}