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
import { ArkFile, AstTreeUtils, ts } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { RuleListUtil } from "../../utils/common/DefectsList";
import { Defects, IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUselessBackreferenceCheck');

export class NoUselessBackreferenceCheck implements BaseChecker {
    private readonly cache = CacheManager.getInstance();
    private messageId: MessageIds = 'nested';
    private backReferenceInfo: BackReferenceInfo = {
        backReference: '',
        groupContent: '',
    };
    private get messages(): MessageInfo {
        return {
            nested: `Backreference '${this.backReferenceInfo.backReference}' will be ignored. It references group '(${this.backReferenceInfo.groupContent})' from within that group`,
            forward: `Backreference '${this.backReferenceInfo.backReference}' will be ignored. It references group '(${this.backReferenceInfo.groupContent})' which appears later in the pattern`,
            backward: `Backreference '${this.backReferenceInfo.backReference}' will be ignored. It references group '(${this.backReferenceInfo.groupContent})' which appears before in the same lookbehind`,
            disjunctive: `Backreference '${this.backReferenceInfo.backReference}' will be ignored. It references group '(${this.backReferenceInfo.groupContent})' which is in another alternative`,
            intoNegativeLookaround: `Backreference '${this.backReferenceInfo.backReference}' will be ignored. It references group '(${this.backReferenceInfo.groupContent})' which is in a negative lookaround`,
        };
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private filePath: string = '';

    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-useless-backreference-check.md',
        description: 'Disallow useless backreferences in regular expressions.',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };

        return [fileMatcherCb];
    };

    /**
     * 
     * 在 JavaScript 中，使用斜杠 / 定义正则表达式时，反向引用直接用 \n 表示；
     * 使用 RegExp 构造函数时，由于字符串中的反斜杠需要转义，所以要写成 \\n。
     * 在替换字符串中，使用 $n 来引用捕获组。
     */

    public check = (target: ArkFile): void => {
        try {
            this.filePath = target.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
            // 遍历 AST
            this.visitNode(sourceFile, sourceFile);
        } catch (error) {
            logger.error(`Error occurred while checking file: ${target.getFilePath()}, Error: ${error}`);
        } finally {
            // 检查完成后清理缓存
            this.cache.clear('regex');
        };
    };

    private visitNode(node: ts.Node, sourceFile: ts.SourceFile): void {
        // 检查正则字面量
        if (ts.isRegularExpressionLiteral(node)) {
            this.analyzeRegexPattern(node.text, node, sourceFile);
            return;
        };

        // 统一处理 RegExp 构造函数调用和 new 表达式
        if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && node.arguments && node.arguments?.length > 0) {
            // 首先检查是否是全局 RegExp
            if (this.isGlobalRegExp(node.expression)) {
                // 获取第一个参数
                const pattern = this.extractRegExpPattern(node.arguments[0]);
                if (pattern) {
                    this.analyzeRegexPattern(pattern, node, sourceFile);
                };
            };
        };

        // 递归遍历子节点
        ts.forEachChild(node, child => this.visitNode(child, sourceFile));
    };

    /**
 * 检查是否为全局 RegExp 对象
 */
    private isGlobalRegExp(expression: ts.Expression): boolean {
        if (!ts.isIdentifier(expression)) {
            return false;
        };

        if (expression.text !== 'RegExp') {
            return this.checkRegExpAlias(expression);
        };

        return this.validateGlobalRegExp(expression);
    };

    /**
     * 验证是否为全局 RegExp
     */
    private validateGlobalRegExp(expression: ts.Identifier): boolean {
        let current: ts.Node = expression;
        let foundBlock = false;

        while (current) {
            if (this.isBlockScope(current)) {
                foundBlock = true;
                if (this.hasLocalRegExpDeclaration(current as (ts.Block | ts.SourceFile))) {
                    return false;
                };
            };

            if (this.isFunctionScope(current)) {
                if (this.hasRegExpParameter(current as ts.FunctionLikeDeclaration)) {
                    return false;
                };
            };

            current = current.parent;
        };

        return foundBlock;
    };

    /**
     * 检查是否为块级作用域
     */
    private isBlockScope(node: ts.Node): boolean {
        return ts.isBlock(node) || ts.isSourceFile(node);
    };

    /**
     * 检查是否为函数作用域
     */
    private isFunctionScope(node: ts.Node): boolean {
        return ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node);
    };

    /**
     * 检查块级作用域中是否有局部 RegExp 声明
     */
    private hasLocalRegExpDeclaration(node: ts.Block | ts.SourceFile): boolean {
        return this.checkStatements(node.statements);
    };

    /**
     * 检查语句列表中是否包含 RegExp 声明
     */
    private checkStatements(statements: ts.NodeArray<ts.Statement>): boolean {
        return statements.some(stmt => {
            if (!ts.isVariableStatement(stmt)) {
                return false;
            };
            return this.checkVariableDeclarations(stmt.declarationList.declarations);
        });
    };

    /**
     * 检查变量声明列表中是否包含 RegExp 声明
     */
    private checkVariableDeclarations(declarations: ts.NodeArray<ts.VariableDeclaration>): boolean {
        return declarations.some(decl =>
            ts.isIdentifier(decl.name) &&
            decl.name.text === 'RegExp'
        );
    };

    /**
     * 检查函数参数中是否包含 RegExp
     */
    private hasRegExpParameter(node: ts.FunctionLikeDeclaration): boolean {
        return node.parameters.some(param =>
            ts.isIdentifier(param.name) &&
            param.name.text === 'RegExp'
        );
    };

    /**
     * 检查 RegExp 别名
     */
    private checkRegExpAlias(expression: ts.Identifier): boolean {
        const sourceFile = expression.getSourceFile();
        let currentNode: ts.Node = expression;

        while (currentNode) {
            if (ts.isSourceFile(currentNode)) {
                return this.checkGlobalAliasDeclaration(sourceFile, expression.text);
            };
            currentNode = currentNode.parent;
        };

        return false;
    };

    /**
     * 检查全局作用域中的别名声明
     */
    private checkGlobalAliasDeclaration(
        sourceFile: ts.SourceFile,
        aliasName: string
    ): boolean {
        for (const statement of sourceFile.statements) {
            if (!ts.isVariableStatement(statement)) {
                continue;
            };

            const aliasDeclaration = this.findAliasDeclaration(
                statement.declarationList.declarations,
                aliasName
            );

            if (aliasDeclaration && this.isRegExpAliasInitializer(aliasDeclaration)) {
                return this.isGlobalRegExp(aliasDeclaration.initializer as ts.Identifier);
            };
        };

        return false;
    };

    /**
     * 查找别名声明
     */
    private findAliasDeclaration(
        declarations: ts.NodeArray<ts.VariableDeclaration>,
        aliasName: string
    ): ts.VariableDeclaration | undefined {
        return declarations.find(decl =>
            ts.isIdentifier(decl.name) &&
            decl.name.text === aliasName &&
            decl.initializer &&
            ts.isIdentifier(decl.initializer)
        );
    };

    /**
     * 检查初始化器是否为 RegExp
     */
    private isRegExpAliasInitializer(declaration: ts.VariableDeclaration): boolean {
        if (!declaration.initializer) {
            return false;
        };
        return ts.isIdentifier(declaration.initializer) &&
            declaration.initializer.text === 'RegExp';
    };

    private extractRegExpPattern(arg: ts.Expression): string | null {
        // 直接的字符串字面量
        if (ts.isStringLiteral(arg)) {
            return arg.text;
        };

        // 字符串拼接
        if (ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            return this.evaluateStringConcatenation(arg);
        };

        return null;
    };
    /**
     * 获取标识符的值
     * @param node 标识符节点
     * @returns 标识符的字符串值，如果无法确定则返回 null
     */
    private getIdentifierValue(node: ts.Identifier): string | null {
        try {
            const symbol = node.getText();
            const sourceFile = node.getSourceFile();
            return this.findIdentifierValueInSourceFile(sourceFile, symbol);
        } catch (error) {
            logger.debug(`Error getting identifier value: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        };
    };

    /**
     * 在源文件中查找标识符的值
     */
    private findIdentifierValueInSourceFile(sourceFile: ts.SourceFile, symbol: string): string | null {
        const declaration = this.findVariableDeclaration(sourceFile, symbol);
        if (!declaration) {
            return null;
        };

        return this.extractDeclarationValue(declaration);
    };

    /**
     * 查找变量声明
     */
    private findVariableDeclaration(
        sourceFile: ts.SourceFile,
        symbol: string
    ): ts.VariableDeclaration | null {
        let result: ts.VariableDeclaration | null = null;

        const visitNode = (node: ts.Node): void => {
            if (this.isTargetVariableDeclaration(node, symbol)) {
                result = node as ts.VariableDeclaration;
                return;
            };

            ts.forEachChild(node, visitNode);
        };

        ts.forEachChild(sourceFile, visitNode);
        return result;
    };

    /**
     * 检查是否为目标变量声明
     */
    private isTargetVariableDeclaration(node: ts.Node, symbol: string): boolean {
        if (!ts.isVariableDeclaration(node)) {
            return false;
        };

        return ts.isIdentifier(node.name) &&
            node.name.text === symbol &&
            node.initializer !== undefined;
    };

    /**
     * 从声明中提取值
     */
    private extractDeclarationValue(declaration: ts.VariableDeclaration): string | null {
        const initializer = declaration.initializer;

        if (!initializer) {
            return null;
        };

        if (ts.isStringLiteral(initializer)) {
            return initializer.text;
        };

        if (ts.isTemplateExpression(initializer)) {
            return this.evaluateTemplateExpression(initializer);
        };

        if (ts.isBinaryExpression(initializer)) {
            return this.evaluateStringConcatenation(initializer);
        };

        return null;
    };

    /**
     * 评估模板表达式
     */
    private evaluateTemplateExpression(template: ts.TemplateExpression): string | null {
        try {
            let result = template.head.text;

            for (const span of template.templateSpans) {
                const spanValue = this.evaluateTemplateSpan(span);
                if (spanValue === null) {
                    return null;
                };
                result += spanValue + span.literal.text;
            };

            return result;
        } catch (error) {
            logger.debug(`Error evaluating template expression: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        };
    };

    /**
     * 评估模板表达式片段
     */
    private evaluateTemplateSpan(span: ts.TemplateSpan): string | null {
        const expression = span.expression;

        if (ts.isStringLiteral(expression)) {
            return expression.text;
        };

        if (ts.isIdentifier(expression)) {
            return this.getIdentifierValue(expression);
        };

        if (ts.isBinaryExpression(expression)) {
            return this.evaluateStringConcatenation(expression);
        };

        return null;
    };

    /**
     * 处理字符串拼接表达式
     */
    private evaluateStringConcatenation(node: ts.BinaryExpression): string | null {
        try {
            if (node.operatorToken.kind !== ts.SyntaxKind.PlusToken) {
                return null;
            };

            const leftValue = this.evaluateStringOperand(node.left);
            const rightValue = this.evaluateStringOperand(node.right);

            if (leftValue === null || rightValue === null) {
                return null;
            };

            return leftValue + rightValue;
        } catch (error) {
            logger.debug(`Error evaluating string concatenation: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        };
    };

    /**
     * 评估字符串操作数
     */
    private evaluateStringOperand(node: ts.Expression): string | null {
        if (ts.isStringLiteral(node)) {
            return node.text;
        };

        if (ts.isIdentifier(node)) {
            return this.getIdentifierValue(node);
        };

        if (ts.isBinaryExpression(node)) {
            return this.evaluateStringConcatenation(node);
        };

        if (ts.isTemplateExpression(node)) {
            return this.evaluateTemplateExpression(node);
        };

        return null;
    };

    // 查找正则表达式中的所有捕获组  使用缓存优化的方法
    private findCaptureGroups(pattern: string): CaptureGroupInfo[] {
        const cacheKey = `captureGroups:${pattern}`;
        const cached = this.cache.get<'captureGroups'>('regex', cacheKey);
        if (cached) {
            return cached;
        };

        const groups = this.computeCaptureGroups(pattern);
        this.cache.set('regex', cacheKey, groups);
        return groups;
    };

    private computeCaptureGroups(pattern: string): CaptureGroupInfo[] {
        const groups: CaptureGroupInfo[] = [];
        let groupNumber = 1;
        const stack: number[] = [];

        for (let i = 0; i < pattern.length; i++) {
            if (this.isOpenParenthesis(pattern, i)) {
                const groupMatch = this.processOpenParenthesis(pattern, i);
                if (groupMatch) {
                    stack.push(groupMatch.startIndex);
                    i = groupMatch.skipTo;
                };
                continue;
            };

            if (this.isCloseParenthesis(pattern, i)) {
                const group = this.processCloseParenthesis(pattern, i, stack, groupNumber);
                if (group) {
                    groups.push(group);
                    groupNumber++;
                };
            };
        };

        return groups;
    };

    /**
     * 检查是否为开括号
     */
    private isOpenParenthesis(pattern: string, index: number): boolean {
        return pattern[index] === '(' && !this.isEscaped(pattern, index);
    };

    /**
     * 检查是否为闭括号
     */
    private isCloseParenthesis(pattern: string, index: number): boolean {
        return pattern[index] === ')' && !this.isEscaped(pattern, index);
    };

    /**
     * 处理开括号
     */
    private processOpenParenthesis(pattern: string, index: number): { startIndex: number; skipTo: number } | null {
        // 检查是否是命名捕获组
        if (this.isNamedCaptureGroup(pattern, index)) {
            const endNameIndex = pattern.indexOf('>', index + 3);
            if (endNameIndex !== -1) {
                return { startIndex: index, skipTo: endNameIndex };
            };
        };

        // 检查是否是非捕获组或环视
        if (this.isNonCapturingOrLookaround(pattern, index)) {
            return null;
        };

        // 普通捕获组
        return { startIndex: index, skipTo: index };
    };

    /**
     * 检查是否是命名捕获组
     */
    private isNamedCaptureGroup(pattern: string, index: number): boolean {
        return index + 2 < pattern.length &&
            pattern[index + 1] === '?' &&
            pattern[index + 2] === '<' &&
            pattern[index + 3] !== '=' &&
            pattern[index + 3] !== '!';
    };

    /**
     * 检查是否是非捕获组或环视
     */
    private isNonCapturingOrLookaround(pattern: string, index: number): boolean {
        if (index + 2 >= pattern.length) {
            return false;
        };

        if (pattern[index + 1] !== '?') {
            return false;
        };

        const nextChar = pattern[index + 2];
        return [':', '=', '!', '<'].includes(nextChar);
    };

    /**
     * 处理闭括号
     */
    private processCloseParenthesis(
        pattern: string,
        index: number,
        stack: number[],
        groupNumber: number
    ): CaptureGroupInfo | null {
        if (stack.length === 0) {
            return null;
        };

        const startIndex = stack.pop()!;
        const content = this.extractGroupContent(pattern, startIndex, index);
        const fullMatch = pattern.slice(startIndex, index + 1);
        const name = this.extractGroupName(pattern, startIndex);

        return {
            startIndex,
            endIndex: index + 1,
            content,
            fullMatch,
            name,
            number: groupNumber
        };
    };

    /**
     * 提取组内容
     */
    private extractGroupContent(pattern: string, start: number, end: number): string {
        return pattern.slice(start + 1, end);
    };

    /**
     * 提取组名
     */
    private extractGroupName(pattern: string, startIndex: number): string | undefined {
        const namedGroupMatch = pattern.slice(startIndex).match(/^\(\?<([^>]+)>/);
        return namedGroupMatch ? namedGroupMatch[1] : undefined;
    };

    private findClosingParenthesis(pattern: string, start: number): { endIndex: number, content: string } {
        let count = 1;
        let i = start + 1;

        while (count > 0 && i < pattern.length) {
            if (this.isParenthesis(pattern, pattern[i], '(', i)) {
                count++;
            } else if (this.isParenthesis(pattern, pattern[i], ')', i)) {
                count--;
            };
            i++;
        };

        return {
            endIndex: i,
            content: pattern.slice(start + 1, i - 1)
        };
    };

    private isParenthesis(pattern: string, char: string, type: '(' | ')', index: number): boolean {
        return char === type && !this.isEscaped(pattern, index);
    };


    private findBackReferences(pattern: string): Array<{ index: number, value: string, isNamed: boolean }> {
        const cacheKey = `backRefs:${pattern}`;
        const cached = this.cache.get<'backReferences'>('regex', cacheKey);
        if (cached) {
            return cached;
        };

        const result = this.computeBackReferences(pattern);
        this.cache.set('regex', cacheKey, result);
        return result;
    };

    private computeBackReferences(pattern: string): Array<{ index: number, value: string, isNamed: boolean }> {
        const result: Array<{ index: number, value: string, isNamed: boolean }> = [];
        let inCharClass = false;

        for (let i = 0; i < pattern.length; i++) {
            if (this.shouldSkipCharacter(pattern[i], pattern, i, inCharClass)) {
                continue;
            };

            if (this.isCharClassBoundary(pattern[i], pattern, i)) {
                inCharClass = !inCharClass;
                continue;
            };

            if (!inCharClass && pattern[i] === '\\' && !this.isEscaped(pattern, i)) {
                const backRef = this.extractBackReference(pattern, i);
                if (backRef) {
                    result.push(backRef);
                    i += backRef.value.length - 1;
                };
            };
        };

        return result;
    };

    private shouldSkipCharacter(char: string, pattern: string, index: number, inCharClass: boolean): boolean {
        return inCharClass || (char === '\\' && this.isEscaped(pattern, index));
    };

    private isCharClassBoundary(char: string, pattern: string, index: number): boolean {
        return (char === '[' || char === ']') && !this.isEscaped(pattern, index);
    };

    private extractBackReference(pattern: string, index: number): { index: number, value: string, isNamed: boolean } | null {
        const next = pattern[index + 1];

        if (next === 'k') {
            const match = pattern.slice(index).match(/^\\k<([^>]+)>/);
            if (match) {
                return {
                    index,
                    value: match[0],
                    isNamed: true
                };
            };
        } else if (/\d/.test(next)) {
            const match = pattern.slice(index).match(/^\\(\d+)/);
            if (match) {
                return {
                    index,
                    value: match[0],
                    isNamed: false
                };
            };
        };

        return null;
    };

    private isEscaped(str: string, index: number): boolean {
        let count = 0;
        let i = index - 1;
        while (i >= 0 && str[i] === '\\') {
            count++;
            i--;
        };
        return count % 2 === 1;
    };

    /**
     * 检查是否为前向引用
     */
    private isForwardReference(group: CaptureGroupInfo, refIndex: number, pattern: string): boolean {
        // 1. 检查先行断言中的前向引用
        if (this.isForwardReferenceInLookahead(group, refIndex, pattern)) {
            return true;
        };

        // 2. 检查非先行断言中的前向引用
        return this.isForwardReferenceOutsideLookahead(group, refIndex, pattern);
    };

    /**
     * 检查先行断言中的前向引用
     */
    private isForwardReferenceInLookahead(
        group: CaptureGroupInfo,
        refIndex: number,
        pattern: string
    ): boolean {
        let currentIndex = 0;
        while (currentIndex < pattern.length) {
            const lookaheadMatch = this.findNextLookahead(pattern, currentIndex);
            if (!lookaheadMatch) {
                break;
            };

            const { startIndex, endIndex } = lookaheadMatch;
            if (this.isReferenceInLookahead(refIndex, group, startIndex, endIndex)) {
                // 如果在先行断言内且不在后行断言内，则可能是前向引用
                return !this.isInLookbehind(startIndex, pattern);
            };

            currentIndex = startIndex + 1;
        };
        return false;
    };

    /**
     * 查找下一个先行断言
     */
    private findNextLookahead(pattern: string, startFrom: number): { startIndex: number; endIndex: number } | null {
        const lookaheadIndex = pattern.indexOf('(?', startFrom);
        if (lookaheadIndex === -1) {
            return null;
        };

        // 检查是否是先行断言（正向或负向）
        if (pattern[lookaheadIndex + 2] === '=' || pattern[lookaheadIndex + 2] === '!') {
            const { endIndex } = this.findClosingParenthesis(pattern, lookaheadIndex);
            return { startIndex: lookaheadIndex, endIndex };
        };

        return null;
    };

    /**
     * 检查引用是否在先行断言范围内
     */
    private isReferenceInLookahead(
        refIndex: number,
        group: CaptureGroupInfo,
        lookaheadStart: number,
        lookaheadEnd: number
    ): boolean {
        const isRefInLookahead = refIndex > lookaheadStart && refIndex < lookaheadEnd;
        const isGroupInLookahead = group.startIndex > lookaheadStart && group.endIndex < lookaheadEnd;

        if (isRefInLookahead && isGroupInLookahead) {
            // 计算相对位置
            const relativeRefIndex = refIndex - lookaheadStart;
            const relativeGroupStart = group.startIndex - lookaheadStart;
            return relativeRefIndex < relativeGroupStart;
        };

        return false;
    };

    /**
     * 检查非先行断言中的前向引用
     */
    private isForwardReferenceOutsideLookahead(
        group: CaptureGroupInfo,
        refIndex: number,
        pattern: string
    ): boolean {
        // 如果引用在组之前，且不在后行断言内
        if (refIndex < group.startIndex && !this.isInAnyLookbehind(refIndex, pattern)) {
            // 检查是否在非捕获组中
            const nonCapturingGroupStart = this.findEnclosingNonCapturingGroup(refIndex, pattern);
            if (nonCapturingGroupStart !== -1) {
                // 如果组也在同一个非捕获组内，使用相对位置判断
                return group.startIndex > nonCapturingGroupStart;
            };
            // 不在非捕获组内，使用全局位置判断
            return true;
        };

        return false;
    };

    /**
     * 查找包含指定位置的非捕获组
     */
    private findEnclosingNonCapturingGroup(index: number, pattern: string): number {
        let currentIndex = 0;
        while (currentIndex < index) {
            const groupIndex = pattern.indexOf('(?:', currentIndex);
            if (groupIndex === -1 || groupIndex > index) break;

            const { endIndex } = this.findClosingParenthesis(pattern, groupIndex);
            if (index > groupIndex && index < endIndex) {
                return groupIndex;
            };
            currentIndex = groupIndex + 1;
        };
        return -1;
    };

    private isInLookbehind(index: number, pattern: string): boolean {
        let currentIndex = 0;
        while (currentIndex < index) {
            const lookbehindIndex = pattern.indexOf('(?<', currentIndex);
            if (lookbehindIndex === -1 || lookbehindIndex > index) break;

            if (pattern[lookbehindIndex + 3] === '=' || pattern[lookbehindIndex + 3] === '!') {
                const { endIndex } = this.findClosingParenthesis(pattern, lookbehindIndex);
                if (index > lookbehindIndex && index < endIndex) {
                    return true;
                };
            };
            currentIndex = lookbehindIndex + 1;
        };
        return false;
    };

    private isInAnyLookbehind(index: number, pattern: string): boolean {
        return this.isInLookbehind(index, pattern);
    };

    /**
 * 检查是否为后行断言中的后向引用
 */
    private isBackwardReferenceInLookbehind(
        group: CaptureGroupInfo,
        refIndex: number,
        pattern: string
    ): boolean {
        const lookbehinds = this.findAllLookbehinds(pattern);

        for (const lookbehind of lookbehinds) {
            if (this.isInvalidBackwardReference(group, refIndex, lookbehind, pattern)) {
                return true;
            };
        };

        return false;
    };

    /**
     * 查找所有后行断言
     */
    private findAllLookbehinds(pattern: string): LookbehindInfo[] {
        const lookbehinds: LookbehindInfo[] = [];
        const matches = Array.from(pattern.matchAll(/\(\?<[=!]/g));

        for (const match of matches) {
            const startIndex = match.index!;
            const { endIndex } = this.findClosingParenthesis(pattern, startIndex);
            lookbehinds.push({ startIndex, endIndex });
        };

        return lookbehinds;
    };

    /**
     * 检查是否为无效的后向引用
     */
    private isInvalidBackwardReference(
        group: CaptureGroupInfo,
        refIndex: number,
        lookbehind: LookbehindInfo,
        pattern: string
    ): boolean {
        const { startIndex: lookbehindStart, endIndex: lookbehindEnd } = lookbehind;

        // 如果引用不在当前后行断言内，跳过
        if (!this.isPositionInRange(refIndex, lookbehindStart, lookbehindEnd)) {
            return false;
        };

        // 检查组和引用的位置关系
        return this.checkGroupReferenceRelation(
            group,
            refIndex,
            lookbehindStart,
            lookbehindEnd,
            pattern
        );
    };

    /**
     * 检查组和引用的位置关系
     */
    private checkGroupReferenceRelation(
        group: CaptureGroupInfo,
        refIndex: number,
        lookbehindStart: number,
        lookbehindEnd: number,
        pattern: string
    ): boolean {
        // 情况1：组和引用都在同一个后行断言内
        if (this.isGroupInRange(group, { start: lookbehindStart, end: lookbehindEnd })) {
            return this.isInvalidReferenceInSameLookbehind(
                group,
                refIndex,
                lookbehindStart,
                pattern
            );
        };

        // 情况2：组在后行断言外
        return refIndex < group.startIndex;
    };

    /**
     * 检查同一后行断言内的引用是否无效
     */
    private isInvalidReferenceInSameLookbehind(
        group: CaptureGroupInfo,
        refIndex: number,
        lookbehindStart: number,
        pattern: string
    ): boolean {
        // 如果引用在组之后且不在同一个先行断言内
        return refIndex > group.startIndex &&
            !this.isInSameLookahead(
                group,
                refIndex,
                pattern.slice(lookbehindStart)
            );
    };

    // 检查是否在同一个先行断言内
    private isInSameLookahead(group: CaptureGroupInfo, refIndex: number, pattern: string): boolean {
        const lookAheads = Array.from(pattern.matchAll(/\(\?=/g));

        for (const lookAhead of lookAheads) {
            const start = lookAhead.index!;
            const { endIndex } = this.findClosingParenthesis(pattern, start);

            // 如果组和引用都在这个先行断言内
            if (group.startIndex >= start && group.endIndex <= endIndex &&
                refIndex >= start && refIndex <= endIndex) {
                return true;
            };
        };

        return false;
    };

    private hasRegExpSyntaxError(pattern: string, flags: string): boolean {
        try {
            // 尝试创建正则表达式对象
            if (flags) {
                new RegExp(pattern, flags);
            } else {
                new RegExp(pattern);
            };
            return false;
        } catch (e) {
            return true;
        };
    };

    /**
 * 获取正则表达式的标志位
 */
    private getRegExpFlags(node: ts.Node): string {
        if (!this.isRegExpNode(node)) {
            return '';
        };

        const flagsArg = this.getSecondArgument(node as ts.NewExpression | ts.CallExpression);
        if (!flagsArg) {
            return '';
        };

        return this.extractFlagsFromArgument(flagsArg);
    };

    /**
     * 检查节点是否为正则表达式节点
     */
    private isRegExpNode(node: ts.Node): boolean {
        return ts.isNewExpression(node) || ts.isCallExpression(node);
    };

    /**
     * 获取第二个参数
     */
    private getSecondArgument(node: ts.NewExpression | ts.CallExpression): ts.Node | undefined {
        if (!node.arguments || node.arguments.length < 2) {
            return undefined;
        };
        return node.arguments[1];
    };

    /**
     * 从参数中提取标志位
     */
    private extractFlagsFromArgument(flagsArg: ts.Node): string {
        if (ts.isStringLiteral(flagsArg)) {
            return flagsArg.text;
        };

        if (ts.isIdentifier(flagsArg)) {
            return this.getFlagsFromIdentifier(flagsArg);
        };

        return '';
    };

    /**
     * 从标识符中获取标志位
     */
    private getFlagsFromIdentifier(identifier: ts.Identifier): string {
        const flagsName = identifier.getText();
        // 简单处理一些常见的标志组合
        if (flagsName === 'flags' || flagsName.includes('u')) {
            // 保守处理，假设包含 'u' 标志
            return 'u';
        };
        return '';
    };

    private analyzeRegexPattern(pattern: string, node: ts.Node, sourceFile: ts.SourceFile): void {
        if (this.hasRegExpSyntaxError(pattern, this.getRegExpFlags(node))) {
            return;
        };

        const captureGroups = this.findCaptureGroups(pattern);
        const backReferences = this.findBackReferences(pattern);

        for (const backRef of backReferences) {
            const { index, value, isNamed } = backRef;
            const refNumber = isNamed ? -1 : parseInt(value.slice(1));
            const refName = isNamed ? value.slice(3, -1) : '';

            const referencedGroup = this.findReferencedGroup(captureGroups, isNamed, refNumber, refName);
            if (!referencedGroup) {
                continue;
            };

            this.validateBackReference(referencedGroup, index, value, pattern, node, sourceFile);
        };
    };

    private findReferencedGroup(
        captureGroups: CaptureGroupInfo[],
        isNamed: boolean,
        refNumber: number,
        refName: string
    ): CaptureGroupInfo | undefined {
        return isNamed
            ? captureGroups.find(g => g.name === refName)
            : captureGroups[refNumber - 1];
    };

    private validateBackReference(
        group: CaptureGroupInfo,
        refIndex: number,
        refValue: string,
        pattern: string,
        node: ts.Node,
        sourceFile: ts.SourceFile
    ): void {
        // 检查是否在组内
        const isInGroup = this.isReferenceInGroup(refIndex, group);

        // 检查循环引用
        if (isInGroup && this.isCircularReference(group, refIndex, pattern)) {
            this.reportViolation(node, sourceFile, group, refValue, 'nested');
            return;
        };

        // 执行所有其他检查
        this.performReferenceChecks(group, refIndex, refValue, pattern, node, sourceFile);
    };

    private isReferenceInGroup(refIndex: number, group: CaptureGroupInfo): boolean {
        return refIndex > group.startIndex && refIndex <= group.endIndex;
    };

    private isCircularReference(
        group: CaptureGroupInfo,
        refIndex: number,
        pattern: string
    ): boolean {
        const subPattern = pattern.slice(group.startIndex, refIndex);
        const groupsBeforeRef = this.findCaptureGroups(subPattern);
        return groupsBeforeRef.length === 0;
    };

    private performReferenceChecks(
        group: CaptureGroupInfo,
        refIndex: number,
        refValue: string,
        pattern: string,
        node: ts.Node,
        sourceFile: ts.SourceFile
    ): void {
        const checks: BackReferenceCheck[] = [
            {
                messageId: 'backward',
                check: (g, i, p) => this.isBackwardReferenceInLookbehind(g, i, p)
            },
            {
                messageId: 'forward',
                check: (g, i, p) => this.isForwardReference(g, i, p)
            },
            {
                messageId: 'disjunctive',
                check: (g, i, p) =>
                    this.isInDifferentAlternative(g, i, p) ||
                    this.isInDifferentOther(g, i, p)
            }
        ];

        // 检查负向环视
        if (!this.isInSameLookaround(group, refIndex, pattern) &&
            this.isInNegativeLookaround(group, refIndex, pattern)) {
            this.reportViolation(node, sourceFile, group, refValue, 'intoNegativeLookaround');
            return;
        };

        // 执行其他检查
        for (const { messageId, check } of checks) {
            if (check(group, refIndex, pattern)) {
                this.reportViolation(node, sourceFile, group, refValue, messageId);
                return;
            };
        };
    };

    private reportViolation(
        node: ts.Node,
        sourceFile: ts.SourceFile,
        group: CaptureGroupInfo,
        refValue: string,
        messageId: string
    ): void {
        this.messageId = messageId as MessageIds;
        this.backReferenceInfo = {
            backReference: refValue,
            groupContent: group.content
        };
        this.reportIssue(node, sourceFile, group, refValue);
    };

    // 检查位置是否在范围内
    private isPositionInRange(position: number, start: number, end: number): boolean {
        return position > start && position < end;
    };
    // 检查元素是否在环视范围内
    private isElementInLookaround(
        elementStart: number,
        elementEnd: number,
        lookaroundStart: number,
        lookaroundEnd: number
    ): boolean {
        return elementStart > lookaroundStart && elementEnd < lookaroundEnd;
    };
    // 计算相对索引 
    private calculateRelativeIndex(position: number, referencePoint: number): number {
        return position - referencePoint;
    };

    // 检查是否在同一个环视结构内（包括肯定/否定的前/后行断言）
    private isInSameLookaround(group: CaptureGroupInfo, refIndex: number, pattern: string): boolean {
        const lookarounds = this.findAllLookarounds(pattern);
        return this.checkLookaroundContainment(group, refIndex, lookarounds) ||
            this.checkNestedLookarounds(group, refIndex, pattern, lookarounds);
    };

    private findAllLookarounds(pattern: string): LookaroundInfo[] {
        const lookarounds: LookaroundInfo[] = [];
        const lookaroundMatches = Array.from(pattern.matchAll(/\(\?(?:[<])?[=!]/g));

        for (const match of lookaroundMatches) {
            const start = match.index!;
            const { endIndex } = this.findClosingParenthesis(pattern, start);
            const matchText = match[0];

            lookarounds.push({
                start,
                end: endIndex,
                type: this.getLookaroundType(matchText),
                isNegative: this.isNegativeLookaround(matchText)
            });
        }

        return lookarounds;
    };
    // 获取lookaround类型
    private getLookaroundType(matchText: string): 'lookahead' | 'lookbehind' {
        return matchText.includes('<') ? 'lookbehind' : 'lookahead';
    };

    private isNegativeLookaround(matchText: string): boolean {
        return matchText.endsWith('!');
    }
    // 检查捕获组是否在环视范围内
    private checkLookaroundContainment(
        group: CaptureGroupInfo,
        refIndex: number,
        lookarounds: LookaroundInfo[]
    ): boolean {
        return lookarounds.some(lookaround =>
            this.areElementsInSameLookaround(group, refIndex, lookaround)
        );
    }
    // 检查元素是否在环视范围内
    private areElementsInSameLookaround(
        group: CaptureGroupInfo,
        refIndex: number,
        lookaround: LookaroundInfo
    ): boolean {
        const isGroupInLookaround = this.isElementInLookaround(
            group.startIndex,
            group.endIndex,
            lookaround.start,
            lookaround.end
        );

        const isRefInLookaround = this.isPositionInRange(
            refIndex,
            lookaround.start,
            lookaround.end
        );

        return isGroupInLookaround && isRefInLookaround;
    };
    // 检查嵌套的环视结构
    private checkNestedLookarounds(
        group: CaptureGroupInfo,
        refIndex: number,
        pattern: string,
        parentLookarounds: LookaroundInfo[]
    ): boolean {
        for (const parent of parentLookarounds) {
            const subPattern = pattern.slice(parent.start, parent.end);
            const nestedResult = this.checkNestedLookaroundPattern(
                group,
                refIndex,
                subPattern,
                parent.start
            );

            if (nestedResult) {
                return true;
            };
        };

        return false;
    };

    private checkNestedLookaroundPattern(
        group: CaptureGroupInfo,
        refIndex: number,
        subPattern: string,
        parentStart: number
    ): boolean {
        const nestedLookarounds = this.findAllLookarounds(subPattern);

        for (const nested of nestedLookarounds) {
            // 跳过父级环视本身
            if (nested.start === 0) {
                continue;
            };

            const adjustedGroup = this.adjustGroupPositionForNested(group, parentStart);
            const adjustedRefIndex = this.calculateRelativeIndex(refIndex, parentStart);

            if (this.areElementsInSameLookaround(adjustedGroup, adjustedRefIndex, nested)) {
                return true;
            };
        };

        return false;
    };

    private adjustGroupPositionForNested(
        group: CaptureGroupInfo,
        parentStart: number
    ): CaptureGroupInfo {
        return {
            ...group,
            startIndex: this.calculateRelativeIndex(group.startIndex, parentStart),
            endIndex: this.calculateRelativeIndex(group.endIndex, parentStart)
        };
    };
    // 检查位置是否在范围内
    private isInRange(position: number, range: { start: number, end: number }): boolean {
        return this.isPositionInRange(position, range.start, range.end);
    }
    // 检查捕获组是否在范围内
    private isGroupInRange(group: CaptureGroupInfo, range: AlternativeRange): boolean {
        return this.isInRange(group.startIndex, range) && this.isInRange(group.endIndex, range);
    };

    private isInDifferentAlternative(group: CaptureGroupInfo, refIndex: number, pattern: string): boolean {
        const { topLevel, nested } = this.collectAlternatives(pattern);

        // 检查顶层分支
        if (this.hasConflictInAlternatives(group, refIndex, topLevel)) {
            return true;
        };

        // 检查嵌套分支
        return this.hasConflictInNestedAlternatives(pattern, group, refIndex, nested);
    };

    private collectAlternatives(pattern: string): {
        topLevel: AlternativeRange[];
        nested: AlternativeRange[];
    } {
        const topLevel: AlternativeRange[] = [];
        const nested: AlternativeRange[] = [];
        let depth = 0;
        let alternativeStart = 0;

        for (let i = 0; i < pattern.length; i++) {
            if (this.isParenthesis(pattern, pattern[i], '(', i)) {
                if (depth === 0) {
                    alternativeStart = i + 1;
                };
                depth++;
            } else if (this.isParenthesis(pattern, pattern[i], ')', i)) {
                depth--;
                if (depth === 0) {
                    this.addAlternative(nested, alternativeStart, i);
                };
            } else if (pattern[i] === '|' && !this.isEscaped(pattern, i)) {
                if (depth === 0) {
                    this.addAlternative(topLevel, alternativeStart, i);
                    alternativeStart = i + 1;
                };
            };
        };

        // 添加最后一个分支
        if (alternativeStart < pattern.length) {
            this.addAlternative(depth === 0 ? topLevel : nested, alternativeStart, pattern.length);
        };

        return { topLevel, nested };
    };

    private addAlternative(alternatives: AlternativeRange[], start: number, end: number): void {
        if (start < end) {
            alternatives.push({ start, end });
        };
    };

    private hasConflictInAlternatives(
        group: CaptureGroupInfo,
        refIndex: number,
        alternatives: AlternativeRange[]
    ): boolean {
        if (alternatives.length <= 1) {
            return false;
        };

        const groupAlt = alternatives.find(alt => this.isGroupInRange(group, alt));
        const refAlt = alternatives.find(alt => this.isInRange(refIndex, alt));

        return Boolean(groupAlt && refAlt && groupAlt !== refAlt);
    };

    private hasConflictInNestedAlternatives(
        pattern: string,
        group: CaptureGroupInfo,
        refIndex: number,
        nested: AlternativeRange[]
    ): boolean {
        for (const range of nested) {
            const subPattern = pattern.slice(range.start, range.end);
            const subAlternatives = this.collectAlternatives(subPattern).topLevel;

            // 调整相对位置
            const relativeGroup = this.adjustGroupPosition(group, range.start);
            const relativeRefIndex = refIndex - range.start;

            if (this.hasConflictInAlternatives(relativeGroup, relativeRefIndex, subAlternatives)) {
                return true;
            };
        };
        return false;
    };

    private adjustGroupPosition(group: CaptureGroupInfo, offset: number): CaptureGroupInfo {
        return {
            ...group,
            startIndex: group.startIndex - offset,
            endIndex: group.endIndex - offset
        };
    };

    private isInDifferentOther(group: CaptureGroupInfo, refIndex: number, pattern: string): boolean {
        const topLevelAlternatives = this.collectTopLevelAlternatives(pattern);
        return this.checkNestedGroupsAndBranches(group, refIndex, pattern, topLevelAlternatives);
    };

    private collectTopLevelAlternatives(pattern: string): Array<{ start: number; end: number }> {
        const alternatives: Array<{ start: number; end: number }> = [];
        let depth = 0;
        let alternativeStart = 0;

        for (let i = 0; i < pattern.length; i++) {
            if (this.isOpeningParenthesis(pattern, i)) {
                depth++;
            } else if (this.isClosingParenthesis(pattern, i)) {
                depth--;
            } else if (this.isTopLevelAlternative(pattern, i, depth)) {
                alternatives.push({
                    start: alternativeStart,
                    end: i
                });
                alternativeStart = i + 1;
            };
        };

        // 添加最后一个分支
        alternatives.push({
            start: alternativeStart,
            end: pattern.length
        });

        return alternatives;
    };

    private checkNestedGroupsAndBranches(
        group: CaptureGroupInfo,
        refIndex: number,
        pattern: string,
        topLevelAlternatives: Array<{ start: number; end: number }>
    ): boolean {
        const currentGroup = this.analyzeNestedGroups(pattern);
        if (!currentGroup) {
            return false;
        };

        return this.checkAlternativesForConflicts(currentGroup, group, refIndex);
    };

    private analyzeNestedGroups(pattern: string): {
        alternatives: Array<{ start: number; end: number }>;
        start: number;
        end: number;
    } | null {
        let depth = 0;
        let alternativeStart = -1;
        const currentGroup = {
            start: -1,
            end: -1,
            alternatives: [] as Array<{ start: number; end: number }>
        };

        for (let i = 0; i < pattern.length; i++) {
            if (this.isOpeningParenthesis(pattern, i)) {
                if (this.handleOpeningParenthesis(depth, alternativeStart, currentGroup, i)) {
                    alternativeStart = i + 1;
                };
                depth++;
            } else if (this.isClosingParenthesis(pattern, i)) {
                if (this.handleClosingParenthesis(depth, currentGroup, alternativeStart, i)) {
                    return currentGroup;
                };
                depth--;
            } else if (this.isAlternativeBoundary(pattern, i, currentGroup)) {
                this.handleAlternativeBoundary(currentGroup, alternativeStart, i);
                alternativeStart = i + 1;
            };
        };

        return null;
    };

    private checkAlternativesForConflicts(
        currentGroup: { alternatives: Array<{ start: number; end: number }> },
        group: CaptureGroupInfo,
        refIndex: number
    ): boolean {
        if (currentGroup.alternatives.length === 0) {
            return false;
        };

        const { refAltIndex, captureAltIndex } = this.findElementLocations(
            currentGroup.alternatives,
            group,
            refIndex
        );

        return this.hasConflictingLocations(refAltIndex, captureAltIndex);
    };

    private findElementLocations(
        alternatives: Array<{ start: number; end: number }>,
        group: CaptureGroupInfo,
        refIndex: number
    ): { refAltIndex: number; captureAltIndex: number } {
        let refAltIndex = -1;
        let captureAltIndex = -1;

        alternatives.forEach((alt, index) => {
            if (refIndex >= alt.start && refIndex <= alt.end) {
                refAltIndex = index;
            };
            if (group.startIndex >= alt.start && group.endIndex <= alt.end) {
                captureAltIndex = index;
            };
        });

        return { refAltIndex, captureAltIndex };
    };

    private isOpeningParenthesis(pattern: string, index: number): boolean {
        return pattern[index] === '(' && !this.isEscaped(pattern, index);
    };

    private isClosingParenthesis(pattern: string, index: number): boolean {
        return pattern[index] === ')' && !this.isEscaped(pattern, index);
    };

    private isTopLevelAlternative(pattern: string, index: number, depth: number): boolean {
        return pattern[index] === '|' && !this.isEscaped(pattern, index) && depth === 0;
    };

    private isAlternativeBoundary(
        pattern: string,
        index: number,
        currentGroup: { start: number }
    ): boolean {
        return pattern[index] === '|' &&
            !this.isEscaped(pattern, index) &&
            currentGroup.start !== -1;
    };

    private handleOpeningParenthesis(
        depth: number,
        alternativeStart: number,
        currentGroup: { start: number },
        index: number
    ): boolean {
        if (alternativeStart === -1) {
            currentGroup.start = index;
            return true;
        };
        return false;
    };

    private handleClosingParenthesis(
        depth: number,
        currentGroup: { end: number; alternatives: Array<{ start: number; end: number }> },
        alternativeStart: number,
        index: number
    ): boolean {
        if (depth === 1) {
            currentGroup.end = index;
            if (alternativeStart !== -1) {
                currentGroup.alternatives.push({
                    start: alternativeStart,
                    end: index
                });
            };
            return true;
        };
        return false;
    };

    private handleAlternativeBoundary(
        currentGroup: { alternatives: Array<{ start: number; end: number }> },
        alternativeStart: number,
        index: number
    ): void {
        currentGroup.alternatives.push({
            start: alternativeStart,
            end: index
        });
    };

    private hasConflictingLocations(refAltIndex: number, captureAltIndex: number): boolean {
        return refAltIndex !== -1 &&
            captureAltIndex !== -1 &&
            refAltIndex !== captureAltIndex;
    };

    private isInNegativeLookaround(group: CaptureGroupInfo, refIndex: number, pattern: string): boolean {
        if (this.originalNegativeLookaroundCheck(group, refIndex, pattern)) {
            return true;
        }
        return this.checkNestedNegativeLookarounds(group, refIndex, pattern);
    };

    private checkNestedNegativeLookarounds(group: CaptureGroupInfo, refIndex: number, pattern: string): boolean {
        let currentIndex = 0;
        const maxIndex = Math.max(refIndex, group.startIndex);

        while (currentIndex < maxIndex) {
            const lookAroundInfo = this.findNextLookAround(pattern, currentIndex);
            if (!lookAroundInfo) {
                break;
            };

            const { start, isNegative, endIndex } = lookAroundInfo;

            if (isNegative && this.isInvalidNegativeLookaround(group, refIndex, start, endIndex)) {
                return true;
            };

            currentIndex = start + 1;
        };
        return false;
    };

    private findNextLookAround(pattern: string, startIndex: number): { start: number, isNegative: boolean, endIndex: number } | null {
        const lookAroundStart = pattern.indexOf('(?', startIndex);
        if (lookAroundStart === -1) {
            return null;
        };

        const isNegativeLookbehind = pattern.slice(lookAroundStart, lookAroundStart + 4) === '(?<!';
        const isNegativeLookahead = pattern.slice(lookAroundStart, lookAroundStart + 3) === '(?!';

        if (!isNegativeLookahead && !isNegativeLookbehind) {
            return null;
        };

        const { endIndex } = this.findClosingParenthesis(pattern, lookAroundStart);
        return {
            start: lookAroundStart,
            isNegative: true,
            endIndex
        };
    };

    private isInvalidNegativeLookaround(group: CaptureGroupInfo, refIndex: number, start: number, end: number): boolean {
        const groupInLookaround = group.startIndex > start && group.endIndex < end;
        const refInLookaround = refIndex > start && refIndex < end;

        // 组在负向环视内部，引用在外部
        if (groupInLookaround && refIndex >= end) {
            return true;
        };

        // 引用在负向环视内部，组在外部或其他负向环视内
        if (refInLookaround && (group.startIndex < start || group.startIndex > end)) {
            return true;
        };

        return false;
    };

    private originalNegativeLookaroundCheck(group: CaptureGroupInfo, refIndex: number, pattern: string): boolean {
        // 匹配所有的负向环视（包括前瞻和后顾）
        const negativeLookarounds = Array.from(pattern.matchAll(/\(\?[<]?!/g));

        for (const lookaround of negativeLookarounds) {
            const start = lookaround.index!;
            const { endIndex } = this.findClosingParenthesis(pattern, start);

            // 情况1：组在负向环视内，引用在外部
            if (group.startIndex > start && group.endIndex < endIndex) {
                // 如果引用在负向环视外部
                if (refIndex >= endIndex) {
                    return true;
                };
            };

            // 情况2：引用在负向环视内，但引用了外部的组
            if (refIndex > start && refIndex < endIndex) {
                if (!(group.startIndex > start && group.endIndex < endIndex)) {
                    return true;
                };
            };

            // 情况3：检查嵌套的负向环视
            const subPattern = pattern.slice(start, endIndex);
            if (this.hasNestedNegativeLookaround(subPattern, group, refIndex - start)) {
                return true;
            };
        };

        return false;
    };

    private hasNestedNegativeLookaround(pattern: string, group: CaptureGroupInfo, relativeRefIndex: number): boolean {
        const nestedNegative = Array.from(pattern.matchAll(/\(\?[<]?!/g));

        for (const nested of nestedNegative) {
            if (nested.index === 0) {
                continue;
            }; // 跳过当前环视本身

            const nestedStart = nested.index!;
            const { endIndex: nestedEnd } = this.findClosingParenthesis(pattern, nestedStart);

            // 检查组是否在嵌套的负向环视内
            const relativeGroupStart = group.startIndex - (group.startIndex > nestedStart ? nestedStart : 0);
            const relativeGroupEnd = group.endIndex - (group.endIndex > nestedStart ? nestedStart : 0);

            if (relativeGroupStart > nestedStart && relativeGroupEnd < nestedEnd) {
                // 如果引用在嵌套的负向环视外部
                if (relativeRefIndex < nestedStart || relativeRefIndex >= nestedEnd) {
                    return true;
                };
            };
        };

        return false;
    }

    private reportIssue(node: ts.Node, sourceFile: ts.SourceFile, group: CaptureGroupInfo, backRef: string): void {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const startCol = character + 1;

        const warnInfo: WarnInfo = {
            line: line + 1,
            startCol: startCol,
            endCol: startCol + node.getWidth(),
            message: this.messages[this.messageId],
        };

        // 使用唯一键来避免重复报告
        const defect = this.addIssueReport(warnInfo);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };

    private addIssueReport(warnInfo: WarnInfo): Defects {
        this.metaData.description = warnInfo.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            this.filePath, this.metaData.ruleDocPath, true, false, false);
        return defect;
    };
}

// 定义缓存值的类型
interface RegexCache {
    captureGroups: CaptureGroupInfo[];
    backReferences: Array<{ index: number; value: string; isNamed: boolean }>;
};


type MessageIds =
    | 'nested'
    | 'forward'
    | 'backward'
    | 'disjunctive'
    | 'intoNegativeLookaround';

interface MessageInfo {
    nested: string;
    forward: string;
    backward: string;
    disjunctive: string;
    intoNegativeLookaround: string;
};

// 储存反向引用的信息
interface BackReferenceInfo {
    backReference: string;
    groupContent: string;
};

// 定义反向引用检查的接口
interface BackReferenceCheck {
    messageId: string;
    check: (group: CaptureGroupInfo, refIndex: number, pattern: string) => boolean;
};

// 定义捕获组信息的接口
interface CaptureGroupInfo extends CaptureGroupMatch {
    startIndex: number; // 捕获组在正则表达式中的起始索引
    endIndex: number;   // 捕获组在正则表达式中的结束索引
    content: string;    // 捕获组的内容
    fullMatch: string;  // 捕获组的完整匹配（包括括号）
    name?: string;      // 命名捕获组的名称
    number: number;     // 捕获组的编号
    parentAlternative?: any; // 记录捕获组所在的可选分支
};

interface CaptureGroupMatch {
    startIndex: number;
    endIndex: number;
    content: string;
    fullMatch: string;
    name?: string;
};

// 定义警告信息的接口
interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
    message: string;
};

// 定义lookaround信息的接口
interface LookaroundInfo {
    start: number;
    end: number;
    type: 'lookahead' | 'lookbehind';
    isNegative: boolean;
};

interface LookbehindInfo {
    startIndex: number;
    endIndex: number;
};

// 定义捕获组范围的接口
interface AlternativeRange {
    start: number;
    end: number;
};
// 缓存管理类
class CacheManager {
    private static instance: CacheManager;
    private caches: Map<string, Map<string, RegexCache[keyof RegexCache]>>;
    private readonly MAX_CACHE_SIZE = 1000;

    private constructor() {
        this.caches = new Map();
    };

    static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    };

    get<K extends keyof RegexCache>(namespace: string, key: string): RegexCache[K] | undefined {
        const cache = this.caches.get(namespace);
        return cache?.get(key) as RegexCache[K] | undefined;
    };

    set<K extends keyof RegexCache>(namespace: string, key: string, value: RegexCache[K]): void {
        if (!this.caches.has(namespace)) {
            this.caches.set(namespace, new Map());
        }
        const cache = this.caches.get(namespace)!;

        if (cache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = cache.keys().next().value;
            if (firstKey) {
                cache.delete(firstKey);
            };
        };

        cache.set(key, value);
    };

    clear(namespace?: string): void {
        if (namespace) {
            this.caches.delete(namespace);
        } else {
            this.caches.clear();
        };
    };
}