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

import {
    ArkFile,
    AstTreeUtils,
    ts,
} from 'arkanalyzer';
import { Rule } from '../../Index';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects } from '../../Index';
import {
    FileMatcher,
    MatcherCallback,
    MatcherTypes,
} from '../../Index';
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from '../../model/Defects';

interface RestrictedRule {
    selector: string;
    message: string;
}

interface ParsedRule {
    type: string;
    attributes: AttributeCondition[];
    parent: ParsedRule | null;
    message: string;
}

interface AttributeCondition {
    path: string[];
    operator: string;
    value: any;
}

interface MessageInfo {
    line: number;
    character: number;
    endCol: number;
    message: string
}

type Options = Array<string | { selector: string; message?: string }>;
const compareVal = /^['"]|['"]$/g;
export class NoRestrictedSyntaxCheck implements BaseChecker {
    public issues: IssueReport[] = [];
    public rule: Rule;
    public defects: Defects[] = [];
    private defaultOptions: Options = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-restricted-syntax.md',
        description: 'Disallow specified syntax',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchFileCb];
    }

    public check = (targetField: ArkFile) => {
        this.defaultOptions = this.getDefaultOption();
        if (this.defaultOptions.length > 0) { //不配置option不做检测
            const severity = this.rule.alert ?? this.metaData.severity;
            const filePath = targetField.getFilePath();
            const myInvalidPositions = this.checkRestrictedSyntax(targetField, this.defaultOptions);
            myInvalidPositions.forEach(pos => {
                this.addIssueReport(filePath, pos, severity);
            });
        }
    }

    private getDefaultOption(): Options {
        let tmpOption: Options = [];
        if (this.rule && this.rule.option) {
            for (let index = 0; index < this.rule.option.length; index++) {
                const element = this.rule.option[index];
                if (typeof element === 'string') {
                    tmpOption.push(element);
                } else {
                    const elem = element as { selector: string; message?: string };
                    tmpOption.push({ selector: elem.selector, message: elem.message });
                }
            }
        }
        return tmpOption;
    }

    private addIssueReport(filePath: string, pos: MessageInfo, severity: number) {
        let defect = new Defects(pos.line, pos.character, pos.endCol, pos.message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private checkRestrictedSyntax(targetField: ArkFile, options: Array<string | { selector: string; message?: string }>): MessageInfo[] {
        const errors: MessageInfo[] = [];
        const rules = this.normalizeOptions(options);
        const parsedRules = rules.map(rule => this.parseRule(rule));
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        const nodeStack: ts.Node[] = [];

        const visit = (node: ts.Node) => {
            nodeStack.push(node);
            this.checkArrayLiteralTildeOperator(node, parsedRules, sourceFile, errors);
            this.checkNodeAgainstRules(node, parsedRules, nodeStack, sourceFile, errors);
            ts.forEachChild(node, visit);
            nodeStack.pop();
        };

        ts.forEachChild(sourceFile, visit);
        return errors;
    }

    private checkArrayLiteralTildeOperator(
        node: ts.Node,
        parsedRules: ParsedRule[],
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        if (!ts.isArrayLiteralExpression(node)) {
            return;
        }

        const elements = node.elements;
        for (let i = 0; i < elements.length - 1; i++) {
            const currentElement = elements[i];
            const nextElement = elements[i + 1];

            if (!currentElement || !nextElement) {
                continue;
            }

            const matchingRule = this.findTildeOperatorRule(parsedRules);
            if (matchingRule) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(nextElement.getStart());
                this.addErrorForTildeOperator(errors, line, character, node, matchingRule);
            }
        }
    }

    private findTildeOperatorRule(parsedRules: ParsedRule[]): ParsedRule | undefined {
        return parsedRules.find(rule =>
            rule.type === 'BinaryExpression' &&
            rule.attributes.some(attr =>
                attr.path[0] === 'operatorToken' &&
                attr.path[1] === 'kind' &&
                attr.value === ts.SyntaxKind.TildeToken
            )
        );
    }

    private addErrorForTildeOperator(
        errors: MessageInfo[],
        line: number,
        character: number,
        node: ts.Node,
        rule: ParsedRule
    ): void {
        errors.push({
            line: line + 1,
            character: character + 1,
            endCol: character + node.getText().length + 1,
            message: rule.message
        });
    }

    private checkNodeAgainstRules(
        node: ts.Node,
        parsedRules: ParsedRule[],
        nodeStack: ts.Node[],
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        for (const rule of parsedRules) {
            if (this.shouldSkipNodeCheck(node, rule, nodeStack)) {
                continue;
            }

            if (this.matchRule(node, rule, nodeStack)) {
                this.addErrorForMatchedRule(node, rule, sourceFile, errors);
            }
        }
    }

    private shouldSkipNodeCheck(
        node: ts.Node,
        rule: ParsedRule,
        nodeStack: ts.Node[]
    ): boolean {
        if (rule.type === 'VariableDeclaration' &&
            nodeStack.some(n => ts.isCatchClause(n.parent))) {
            return true;
        }
        return false;
    }

    private addErrorForMatchedRule(
        node: ts.Node,
        rule: ParsedRule,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        const targetNode = this.getTargetNodeForError(node);
        const startPos = this.getErrorStartPosition(targetNode, rule, sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(startPos);

        errors.push({
            line: line + 1,
            character: character + 1,
            endCol: character + node.getText().length + 1,
            message: rule.message
        });
    }

    private getTargetNodeForError(node: ts.Node): ts.Node {
        if (ts.isVariableDeclaration(node)) {
            const parent = node.parent;
            if (ts.isVariableDeclarationList(parent)) {
                return parent;
            }
        }
        return node;
    }

    private getErrorStartPosition(
        node: ts.Node,
        rule: ParsedRule,
        sourceFile: ts.SourceFile
    ): number {
        if (rule.type === 'ClassDeclaration' && ts.isClassDeclaration(node) && node.name) {
            const fullText = sourceFile.getFullText();
            const classKeywordPos = fullText.indexOf('class', node.getStart());
            if (classKeywordPos !== -1) {
                return classKeywordPos;
            }
        }
        return node.getStart();
    }

    private checkAttribute(node: ts.Node, condition: AttributeCondition): boolean {
        const specialResult = this.checkSpecialCases(node, condition);
        if (specialResult !== undefined) {
            return specialResult;
        }

        let value = this.getValueForAttribute(node, condition);
        if (value === undefined) {
            return false;
        }

        return this.compareValues(value, condition);
    }

    private checkSpecialCases(node: ts.Node, condition: AttributeCondition): boolean | undefined {
        if (ts.isCallExpression(node) && condition.path[0] === 'arguments') {
            if (condition.path[1] === 'length') {
                return this.compareNumericValues(node.arguments.length, condition.value, condition.operator);
            }
        }
        if (ts.isCallExpression(node) && condition.path[0] === 'expression') {
            if (condition.path[1] === 'text') {
                return node.expression.getText() === condition.value;
            }
        }
        if (ts.isBreakStatement(node) && condition.path[0] === 'label') {
            return node.label !== undefined;
        }
        if (ts.isRegularExpressionLiteral(node) && condition.operator === '~=') {
            return condition.value.test(node.getText());
        }

        return undefined;
    }

    private getValueForAttribute(node: ts.Node, condition: AttributeCondition): any {
        if (condition.path[0] === 'operator' && ts.isBinaryExpression(node)) {
            return this.getBinaryExpressionOperator(node);
        }
        if (ts.isIdentifier(node) && condition.path[0] === 'name') {
            return node.text;
        }
        return this.traversePath(node, condition.path);
    }

    private getBinaryExpressionOperator(node: ts.BinaryExpression): string {
        if (node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
            return 'in';
        }
        return node.operatorToken.getText().trim();
    }

    private traversePath(value: any, path: string[]): any {
        for (const prop of path) {
            if (!(prop in value)) {
                return undefined;
            }
            value = value[prop];
        }
        return value;
    }

    private compareValues(value: any, condition: AttributeCondition): boolean {
        const expectedValue = typeof condition.value === 'string'
            ? condition.value.replace(compareVal, '').trim()
            : condition.value;
        const actualValue = typeof value === 'string'
            ? value.trim()
            : value;

        return actualValue === expectedValue;
    }

    private compareNumericValues(actual: number, expected: number, operator: string): boolean {
        switch (operator) {
            case '!=': return actual !== expected;
            case '==': return actual === expected;
            case '>': return actual > expected;
            case '>=': return actual >= expected;
            case '<': return actual < expected;
            case '<=': return actual <= expected;
            default: return false;
        }
    }

    private matchRule(node: ts.Node, rule: ParsedRule, stack: ts.Node[]): boolean {
        // Handle special cases first
        const specialResult = this.handleSpecialRuleMatching(node, rule, stack);
        if (specialResult !== undefined) {
            return specialResult;
        }

        // Handle function declarations
        if (rule.type === 'FunctionDeclaration') {
            return this.matchRuleForFunctionDeclaration(node, rule, stack);
        }

        return this.matchStandardRule(node, rule, stack);
    }

    private handleSpecialRuleMatching(node: ts.Node, rule: ParsedRule, stack: ts.Node[]): boolean | undefined {
        // Handle ChainExpression
        if (rule.type === 'ChainExpression') {
            return this.matchChainExpression(node);
        }

        // Handle Node type with special attributes
        if (rule.type === 'Node') {
            return this.matchNodeWithAttributes(node, rule);
        }

        return undefined;
    }

    private matchChainExpression(node: ts.Node): boolean {
        const isChain = ts.isPropertyAccessChain(node) ||
            ts.isElementAccessChain(node) ||
            ts.isCallChain(node);
        if (!isChain) {
            return false;
        }

        const parent = node.parent;
        const parentIsChain = parent && (
            ts.isPropertyAccessChain(parent) ||
            ts.isElementAccessChain(parent) ||
            ts.isCallChain(parent)
        );

        return !parentIsChain;
    }

    private matchNodeWithAttributes(node: ts.Node, rule: ParsedRule): boolean {
        // Handle :nth-child(n) selector
        if (rule.attributes.some(attr => attr.path[0] === 'index')) {
            return this.matchNthChild(node, rule);
        }

        // Handle optional chain expression
        if (rule.attributes.some(attr =>
            attr.path[0] === 'optional' &&
            attr.value === true
        )) {
            return this.matchOptionalChain(node);
        }

        return false;
    }

    private matchNthChild(node: ts.Node, rule: ParsedRule): boolean {
        const sourceFile = node.getSourceFile();
        const statements = sourceFile.statements;
        const targetIndex = rule.attributes.find(attr =>
            attr.path[0] === 'index'
        )?.value || 0;

        return statements[targetIndex] === node;
    }

    private matchOptionalChain(node: ts.Node): boolean {
        return ts.isPropertyAccessChain(node) ||
            ts.isElementAccessChain(node) ||
            ts.isCallChain(node);
    }

    private matchStandardRule(node: ts.Node, rule: ParsedRule, stack: ts.Node[]): boolean {
        let currentRule: ParsedRule | null = rule;
        let currentDepth = stack.length - 1;

        while (currentRule && currentDepth >= 0) {
            if (!this.matchCurrentNode(stack[currentDepth], currentRule)) {
                return false;
            }
            currentRule = currentRule.parent;
            currentDepth--;
        }

        return currentRule === null;
    }

    private matchCurrentNode(currentNode: ts.Node, currentRule: ParsedRule): boolean {
        const nodeTypeName = ts.SyntaxKind[currentNode.kind];
        if (nodeTypeName !== currentRule.type) {
            return false;
        }

        return currentRule.attributes.every(attr =>
            this.checkAttribute(currentNode, attr)
        );
    }

    private matchRuleForFunctionDeclaration(node: ts.Node, rule: ParsedRule, stack: ts.Node[]): boolean {
        // Find the deepest rule (first part of the rule chain)
        const firstRule = this.findDeepestRule(rule);

        // Check if the node matches the rule
        return this.checkNodeAgainstFunctionRule(node, firstRule);
    }

    private findDeepestRule(rule: ParsedRule): ParsedRule {
        let firstRule: ParsedRule = rule;
        while (firstRule.parent) {
            firstRule = firstRule.parent;
        }
        return firstRule;
    }

    private checkNodeAgainstFunctionRule(node: ts.Node, rule: ParsedRule): boolean {
        if (ts.SyntaxKind[node.kind] !== rule.type) {
            return false;
        }
        if (rule.attributes.length === 0) {
            return true;
        }
        if (ts.isFunctionDeclaration(node)) {
            return this.checkFunctionParameters(node, rule.attributes[0]);
        }

        return rule.attributes.every(attr => this.checkAttribute(node, attr));
    }

    private checkFunctionParameters(node: ts.FunctionDeclaration, attr: AttributeCondition): boolean {
        if (attr.path[0] !== 'params' || attr.path[1] !== 'length') {
            return false;
        }
        const paramsLength = node.parameters.length;
        const expectedValue = parseInt(attr.value);

        return this.compareParameterLength(paramsLength, expectedValue, attr.operator);
    }

    private compareParameterLength(actual: number, expected: number, operator: string): boolean {
        switch (operator) {
            case '>':
                return actual > expected;
            case '>=':
                return actual >= expected;
            case '<':
                return actual < expected;
            case '<=':
                return actual <= expected;
            case '=':
            case '==':
                return actual === expected;
            case '!=':
                return actual !== expected;
            default:
                return false;
        }
    }

    // 在 NoRestrictedSyntaxCheck 类中添加映射表
    private eslintToTsNodeMap: { [eslintType: string]: string } = {
        'ArrowFunctionExpression': 'ArrowFunction',
        'BlockStatement': 'Block',
        'VariableDeclaration': 'VariableDeclaration',
        'FunctionExpression': 'FunctionExpression',
        'WithStatement': 'WithStatement',
        'BinaryExpression': 'BinaryExpression',
        'Identifier': 'Identifier',
        'VariableStatement': 'VariableStatement',
        'CatchClause': 'CatchClause',
        'Property': 'PropertyAssignment',
        'Literal': 'StringLiteral',
        'ChainExpression': 'ChainExpression',
        'BreakStatement': 'BreakStatement'
    };

    // Helper functions
    private normalizeOptions(
        options: Array<string | { selector: string; message?: string }>
    ): RestrictedRule[] {
        return options.map(opt => ({
            selector: typeof opt === 'string' ? opt : opt.selector,
            message: typeof opt === 'string' ? `Using '${opt}' is not allowed.` :
                (opt.message || `Using '${opt.selector}' is not allowed.`)
        }));
    }

    private parseRule(rule: RestrictedRule): ParsedRule {
        // 处理特殊规则
        const specialRule = this.handleSpecialRule(rule);
        if (specialRule) {
            return specialRule;
        }

        // 处理 CallExpression 的参数长度检查
        const callExpressionRule = this.handleCallExpressionRule(rule);
        if (callExpressionRule) {
            return callExpressionRule;
        }

        return this.parseStandardRule(rule);
    }

    // 处理特殊规则
    private handleSpecialRule(rule: RestrictedRule): ParsedRule | null {
        // 特殊处理通配符语法
        if (rule.selector === '* ~ *') {
            return {
                type: 'BinaryExpression',
                attributes: [{
                    path: ['operatorToken', 'kind'],
                    operator: '=',
                    value: ts.SyntaxKind.TildeToken
                }],
                parent: null,
                message: rule.message
            };
        }
        return null;
    }

    // 处理 CallExpression 规则
    private handleCallExpressionRule(rule: RestrictedRule): ParsedRule | null {
        if (rule.selector.includes('CallExpression') && rule.selector.includes('arguments.length')) {
            const calleeName = rule.selector.match(/callee\.name='([^']+)'/)?.[1];
            const argsCondition = rule.selector.match(/arguments\.length([!<>=]+)(\d+)/);

            if (calleeName && argsCondition) {
                return {
                    type: 'CallExpression',
                    attributes: [
                        {
                            path: ['expression', 'text'],
                            operator: '=',
                            value: calleeName
                        },
                        {
                            path: ['arguments', 'length'],
                            operator: argsCondition[1],
                            value: parseInt(argsCondition[2])
                        }
                    ],
                    parent: null,
                    message: rule.message
                };
            }
        }
        return null;
    }

    // 解析标准规则
    private parseStandardRule(rule: RestrictedRule): ParsedRule {
        // 使用正则表达式分割选择器，排除属性条件中的 '>'
        const parts = rule.selector.split(/(?![^[]*\])\s*>\s*/) as string[];
        let parent: ParsedRule | null = null;

        for (let i = 0; i < parts.length; i++) {
            parent = this.processSelectorPart(parts[i], parent, rule.message);
        }

        return parent!;
    }

    // 处理选择器的每个部分
    private processSelectorPart(part: string, parent: ParsedRule | null, message: string): ParsedRule {
        const [type, attributes] = this.parseSelectorPart(part);

        // 特殊处理 ChainExpression
        if (type === 'ChainExpression') {
            return {
                type,
                attributes,
                parent,
                message
            };
        }
        // 特殊处理纯属性选择器返回的 Node 类型
        if (type === 'Node') {
            return {
                type,
                attributes,
                parent,
                message
            };
        }
        return this.createParsedRule(type, attributes, parent, message);
    }

    // 创建解析后的规则
    private createParsedRule(type: string, attributes: AttributeCondition[], parent: ParsedRule | null, message: string): ParsedRule {
        // 使用映射表获取 TypeScript 类型
        const tsType = this.eslintToTsNodeMap[type] || type;

        // 确保类型名称与 TypeScript AST 节点类型完全匹配
        const validType = Object.values(ts.SyntaxKind)
            .find(kind => typeof kind === 'string' && kind === tsType);

        if (!validType) {
            throw new Error(`Invalid node type: ${type}`);
        }

        return {
            type: tsType,
            attributes,
            parent,
            message
        };
    }

    private parseSelectorPart(selector: string): [string, AttributeCondition[]] {
        // 处理特殊选择器
        const specialResult = this.handleSpecialSelectors(selector);
        if (specialResult) {
            return specialResult;
        }

        // 解析常规选择器
        return this.parseRegularSelector(selector);
    }

    // 处理特殊选择器
    private handleSpecialSelectors(selector: string): [string, AttributeCondition[]] | null {
        // 处理通配符语法
        if (selector === '* ~ *') {
            return ['BinaryExpression', [{
                path: ['operatorToken', 'kind'],
                operator: '=',
                value: ts.SyntaxKind.TildeToken
            }]];
        }

        // 处理 :nth-child(n) 选择器
        if (selector.startsWith(':nth-child')) {
            return ['Node', [{
                path: ['index'],
                operator: '=',
                value: parseInt(selector.match(/\((\d+)\)/)?.[1] || '1') - 1
            }]];
        }

        // 处理纯属性条件的选择器
        if (selector.startsWith('[') && selector.endsWith(']')) {
            return this.parseAttributeOnlySelector(selector);
        }

        return null;
    }

    // 解析纯属性条件的选择器
    private parseAttributeOnlySelector(selector: string): [string, AttributeCondition[]] {
        const attrContent = selector.slice(1, -1);
        const [path, value] = attrContent.split('=').map(s => s.trim());
        return ['Node', [{
            path: path.split('.'),
            operator: '=',
            value: value === 'true' ? true : value === 'false' ? false : value
        }]];
    }

    // 解析常规选择器
    private parseRegularSelector(selector: string): [string, AttributeCondition[]] {
        const selectorMatch = selector.match(/^([^[]+)(?:\[(.*)\])?/);
        if (!selectorMatch) {
            throw new Error(`Invalid selector: ${selector}`);
        }

        let [_, typePart, attrStr] = selectorMatch;
        const attributes: AttributeCondition[] = [];
        typePart = this.normalizeTypePart(typePart.trim());

        if (attrStr) {
            this.parseAttributes(attrStr, attributes);
        }

        return [typePart, attributes];
    }

    // 规范化类型部分
    private normalizeTypePart(typePart: string): string {
        if (typePart === 'Literal.key') {
            return 'StringLiteral';
        } else if (typePart === 'Property') {
            return 'PropertyAssignment';
        } else if (typePart === 'Literal') {
            return 'RegularExpressionLiteral';
        }

        return this.eslintToTsNodeMap[typePart] || typePart;
    }

    // 解析属性
    private parseAttributes(attrStr: string, attributes: AttributeCondition[]): void {
        // 处理单个属性名的情况
        if (/^[\w.]+$/.test(attrStr)) {
            attributes.push({
                path: attrStr.split('.'),
                operator: 'exists',
                value: true
            });
            return;
        }

        // 处理正则表达式标志
        const regexMatch = attrStr.match(/regex\.flags\s*=\s*\/(.+)\/$/);
        if (regexMatch) {
            attributes.push({
                path: ['text'],
                operator: '~=',
                value: new RegExp(`/${regexMatch[1]}$`)
            });
            return;
        }

        // 处理其他属性
        this.parseRegularAttributes(attrStr, attributes);
    }

    // 解析常规属性
    private parseRegularAttributes(attrStr: string, attributes: AttributeCondition[]): void {
        const attrRegex = /([\w.]+)\s*(=|!=|>=|<=|>|<|~=|in)\s*(?:'([^']*)'|"([^"]*)"|(\S+))/g;
        let attrMatch: RegExpExecArray | null;

        while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
            const [_, path, op, value1, value2, value3] = attrMatch;
            const value = value1 ?? value2 ?? value3;

            attributes.push({
                path: path.split('.'),
                operator: op,
                value: this.parseValue(value, op)
            });
        }
    }

    // 增强的值解析方法
    private parseValue(rawValue: string, operator: string): any {
        // 处理正则表达式
        if (operator === '~=') {
            return new RegExp(rawValue);
        }

        // 处理布尔值
        if (rawValue === 'true') {
            return true;
        }
        if (rawValue === 'false') {
            return false;
        }

        // 处理null/undefined
        if (rawValue === 'null') {
            return null;
        }
        if (rawValue === 'undefined') {
            return undefined;
        }

        // 处理数字
        const numericValue = Number(rawValue);
        if (!isNaN(numericValue)) {
            return numericValue;
        }

        // 默认返回字符串
        return rawValue;
    }
}