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

import { RuleListUtil } from '../../utils/common/DefectsList';
import { ArkFile, ts } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { AstTreeUtils } from 'arkanalyzer';
import { Rule } from '../../model/Rule';
import { IssueReport } from '../../model/Defects';

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/no-magic-numbers-check.md',
    description: 'Magic number found: ${magicNumber}. Consider using a named constant'
};

interface MagicNumberCheckResult {
    line: number;
    character: number;
    endcode: number;
    message: string;
};

export type Option = {
    ignoreEnums?: boolean;
    ignoreNumericLiteralTypes?: boolean;
    ignoreReadonlyClassProperties?: boolean;
    ignoreTypeIndexes?: boolean;
    /** 是否检测对象属性值中的魔法数字 */
    detectObjects?: boolean;
    /** 是否强制魔法数字常量使用const声明 */
    enforceConst?: boolean;
    /** 需要忽略的特定数字数组 */
    ignore?: (number | string)[];
    /** 是否忽略数组索引 */
    ignoreArrayIndexes?: boolean;
    /** 是否忽略默认值 */
    ignoreDefaultValues?: boolean;
    /** 是否忽略类字段初始值 */
    ignoreClassFieldInitialValues?: boolean;
};

// 最大数组长度常量
const MAX_ARRAY_LENGTH = Math.pow(2, 32) - 1;

export class NoMagicNumbersCheck implements BaseChecker {

    private defaultOption: Option = {
        ignoreEnums: false,
        ignoreNumericLiteralTypes: false,
        ignoreReadonlyClassProperties: false,
        ignoreTypeIndexes: false,
        detectObjects: false,
        enforceConst: false,
        ignore: [],
        ignoreArrayIndexes: false,
        ignoreDefaultValues: false,
        ignoreClassFieldInitialValues: false
    };
    private option: Option = { ...this.defaultOption };
    readonly metaData: BaseMetaData = gMetaData;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public rule: Rule;
    private ignoreSet: Set<number> = new Set();
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    public registerMatchers(): MatcherCallback[] {
        const matchfileBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchfileBuildCb];
    };

    public check = (targetFile: ArkFile): void => {
        if (this.rule && this.rule.option && this.rule.option[0]) {
            const ruleOption = this.rule.option[0] as Option;
            this.option = { ...this.defaultOption, ...ruleOption };
        }
        // 处理ignore配置项
        this.ignoreSet = new Set((this.option.ignore || []).map(this.normalizeIgnoreValue));
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const results = this.checkMagicNumbers(sourceFile);
        results.forEach(result => {
            this.addIssueReport(result.line, result.character, result.endcode, targetFile.getFilePath(), result.message);
        });
    };

    private normalizeIgnoreValue(value: number | string): number {
        if (typeof value === 'string' && value.endsWith('n')) {
            return Number(value.slice(0, -1));
        };
        return Number(value);
    };

    private isIgnoredValue(value: number): boolean {
        return this.ignoreSet.has(value);
    };

    private checkMagicNumbers(sourceFile: ts.SourceFile): MagicNumberCheckResult[] {
        const results: MagicNumberCheckResult[] = [];
        const visitNode = (node: ts.Node): void => {
            if (ts.isNumericLiteral(node) || ts.isBigIntLiteral(node)) {
                this.processNumericNode(node, sourceFile, results);
            };
            ts.forEachChild(node, visitNode);
        };
        visitNode(sourceFile);
        return results;
    };

    private processNumericNode(node: ts.Node, sourceFile: ts.SourceFile, results: MagicNumberCheckResult[]): void {
        const { fullNumberNode, value, raw } = this.getFullNumberNodeInfo(node, sourceFile);
        let parent = fullNumberNode.parent;
        // 处理括号表达式
        const isInParenthesizedExpr = this.checkParenthesizedExpr(parent);
        parent = this.getParentAfterParenthesis(parent);
        // 检查是否需要跳过
        if (this.shouldSkipNumberCheck(fullNumberNode, value)) {
            return;
        };
        // 检查变量声明
        if (ts.isVariableDeclaration(parent)) {
            this.checkVariableDeclaration(parent, fullNumberNode, raw, sourceFile, results);
            return;
        };
        if (this.shouldReportMagicNumber(parent, isInParenthesizedExpr)) {
            this.reportMagicNumber(fullNumberNode, raw, sourceFile, results);
        };
    };

    // 检查是否在括号表达式中
    private checkParenthesizedExpr(parent: ts.Node): boolean {
        let isInParenthesizedExpr = false;
        while (parent && ts.isParenthesizedExpression(parent)) {
            isInParenthesizedExpr = true;
            parent = parent.parent;
        };
        return isInParenthesizedExpr;
    };

    // 获取括号表达式之后的父节点
    private getParentAfterParenthesis(parent: ts.Node): ts.Node {
        while (parent && ts.isParenthesizedExpression(parent)) {
            parent = parent.parent;
        };
        return parent;
    };

    // 检查是否应该跳过数字检查
    private shouldSkipNumberCheck(node: ts.Node, value: number): boolean {
        return !!(this.isIgnoredValue(value) ||
            (this.option.ignoreDefaultValues && this.isDefaultValue(node)) ||
            (this.option.ignoreClassFieldInitialValues && this.isClassFieldInitialValue(node)) ||
            (this.option.ignoreEnums && this.isEnumMember(node)) ||
            (this.option.ignoreNumericLiteralTypes && this.isNumericLiteralType(node)) ||
            (this.option.ignoreReadonlyClassProperties && this.isReadonlyClassProperty(node)) ||
            (this.option.ignoreTypeIndexes && this.isTypeIndex(node)) ||
            this.isParseIntRadix(node) ||
            this.isJSXNumber(node) ||
            (this.isPropertyAccessCompoundAssignment(node) && !this.option.detectObjects) ||
            (this.option.ignoreArrayIndexes && this.isArrayIndex(node, value)));
    };

    private checkVariableDeclaration(parent: ts.Node, node: ts.Node, raw: string, sourceFile: ts.SourceFile, results: MagicNumberCheckResult[]): void {
        const variableDeclarationList = parent.parent;
        if (this.option.enforceConst && variableDeclarationList &&
            ts.isVariableDeclarationList(variableDeclarationList) &&
            !(variableDeclarationList.flags & ts.NodeFlags.Const)) {
            this.reportConstError(node, sourceFile, results);
        };
    };

    private reportConstError(node: ts.Node, sourceFile: ts.SourceFile, results: MagicNumberCheckResult[]): void {
        const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
        results.push({
            line: line + 1,
            character: character + 1,
            endcode: node.getEnd(),
            message: `Number constants declarations must use 'const'.`
        });
    };

    // 检查是否应该报告魔法数字
    private shouldReportMagicNumber(parent: ts.Node, isInParenthesizedExpr: boolean): boolean {
        let shouldReport = true;
        if (!this.option.detectObjects &&
            (ts.isPropertyAssignment(parent) || ts.isObjectLiteralExpression(parent))) {
            shouldReport = false;
        };
        if (!this.option.detectObjects && ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            !ts.isIdentifier(parent.left)) {
            shouldReport = false;
        };
        if (isInParenthesizedExpr) {
            shouldReport = true;
        };
        return shouldReport;
    };

    private getFullNumberNodeInfo(node: ts.Node, sourceFile: ts.SourceFile): { fullNumberNode: ts.Node, value: number, raw: string } {
        let fullNumberNode = node;
        let value: number;
        let raw: string;
        // 处理负数（一元表达式）
        if (ts.isNumericLiteral(node) && node.parent &&
            ts.isPrefixUnaryExpression(node.parent) &&
            node.parent.operator === ts.SyntaxKind.MinusToken) {
            fullNumberNode = node.parent;
            value = -Number(node.text);
            raw = `-${node.getText(sourceFile)}`;
        } else if (ts.isNumericLiteral(node)) {
            value = Number(node.text);
            raw = node.getText(sourceFile);
        } else if (ts.isBigIntLiteral(node)) {
            value = Number(node.text.slice(0, -1));
            raw = node.getText(sourceFile);
        } else {
            value = 0;
            raw = node.getText(sourceFile);
        };
        return { fullNumberNode, value, raw };
    };

    private isDefaultValue(node: ts.Node): boolean {
        let fullNumberNode = node;
        // 处理一元表达式（+/-前缀）
        if (fullNumberNode.parent && ts.isPrefixUnaryExpression(fullNumberNode.parent) &&
            (fullNumberNode.parent.operator === ts.SyntaxKind.PlusToken ||
                fullNumberNode.parent.operator === ts.SyntaxKind.MinusToken)) {
            fullNumberNode = fullNumberNode.parent;
        };
        const parent = fullNumberNode.parent;
        // 检查函数参数默认值
        if (!!parent && ts.isParameter(parent) && parent.initializer === fullNumberNode) {
            return true;
        };
        //AssignmentPatter
        if (!!parent && ts.isBindingElement(parent) && parent.initializer === fullNumberNode) {
            return true;
        };
        // 处理复杂解构赋值中的默认值
        if (!!parent && ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            parent.right === fullNumberNode) {
            const left = parent.left;
            if (ts.isIdentifier(left)) {
                if (this.isInDestructuringPropertyAssignment(parent)) {
                    return true;
                };
            };
        };
        return false;
    };
    // 检查当前节点是否在解构赋值模式的属性赋值中
    private isInDestructuringPropertyAssignment(parent: ts.Node): boolean {
        let currentNode: ts.Node = parent;
        while (currentNode.parent) {
            if (!ts.isPropertyAssignment(currentNode.parent)) {
                currentNode = currentNode.parent;
                continue;
            };
            const propParent = currentNode.parent.parent;
            if (!propParent || !ts.isObjectLiteralExpression(propParent)) {
                break;
            };
            const objParent = propParent.parent;
            if (objParent && ts.isBinaryExpression(objParent) && objParent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                return true;
            };
            break;
        };
        return false;
    };

    private isClassFieldInitialValue(node: ts.Node): boolean {
        if (this.isReadonlyClassProperty(node)) {
            return false;
        };
        let fullNumberNode = node;
        // 处理一元表达式（+/-前缀）
        if (fullNumberNode.parent && ts.isPrefixUnaryExpression(fullNumberNode.parent) &&
            (fullNumberNode.parent.operator === ts.SyntaxKind.PlusToken ||
                fullNumberNode.parent.operator === ts.SyntaxKind.MinusToken)) {
            fullNumberNode = fullNumberNode.parent;
        }
        const parent = fullNumberNode.parent;
        // 在TypeScript AST中，PropertyDefinition对应于ts.isPropertyDeclaration
        return !!parent &&
            ts.isPropertyDeclaration(parent) &&
            parent.initializer === fullNumberNode;
    };

    private isParseIntRadix(node: ts.Node): boolean {
        const parent = node.parent;

        if (!parent || !ts.isCallExpression(parent) || parent.arguments.length < 2) {
            return false;
        };
        if (parent.arguments[1] !== node) {
            return false;
        };
        // 检查是直接调用parseInt
        if (ts.isIdentifier(parent.expression) && parent.expression.text === 'parseInt') {
            return true;
        };
        // 检查是Number.parseInt
        if (ts.isPropertyAccessExpression(parent.expression) &&
            ts.isIdentifier(parent.expression.expression) &&
            parent.expression.expression.text === 'Number' &&
            ts.isIdentifier(parent.expression.name) &&
            parent.expression.name.text === 'parseInt') {
            return true;
        };
        return false;
    };

    private isJSXNumber(node: ts.Node): boolean {
        const parent = node.parent;
        if (!parent) {
            return false;
        };
        const kindName = ts.SyntaxKind[parent.kind];
        return !!(kindName && kindName.indexOf('JSX') === 0);
    };

    private isArrayIndex(node: ts.Node, value: number): boolean {
        const parent = node.parent;
        return !!parent &&
            ts.isElementAccessExpression(parent) &&
            parent.argumentExpression === node &&
            Number.isInteger(value) &&
            value >= 0 &&
            value < MAX_ARRAY_LENGTH;
    };
    // 检查是否是枚举成员
    private isEnumMember(node: ts.Node): boolean {
        let current = node;
        // 处理一元表达式（+/-前缀）
        if (current.parent && ts.isPrefixUnaryExpression(current.parent) &&
            (current.parent.operator === ts.SyntaxKind.PlusToken ||
                current.parent.operator === ts.SyntaxKind.MinusToken)) {
            current = current.parent;
        }
        const parent = current.parent;
        return !!parent && ts.isEnumMember(parent) && parent.initializer === current;
    };

    private isParentTSLiteralType(node: ts.Node): boolean {
        return !!node.parent && ts.isLiteralTypeNode(node.parent);
    };

    private isGrandparentTSTypeAliasDeclaration(node: ts.Node): boolean {
        return !!node.parent?.parent && ts.isTypeAliasDeclaration(node.parent.parent);
    };

    private isGrandparentTSUnionType(node: ts.Node): boolean {
        if (!!node.parent?.parent && ts.isUnionTypeNode(node.parent.parent)) {
            return this.isGrandparentTSTypeAliasDeclaration(node.parent);
        }
        return false;
    };

    // 检查是否是数字字面量类型
    private isNumericLiteralType(node: ts.Node): boolean {
        if (
            node.parent &&
            ts.isPrefixUnaryExpression(node.parent) &&
            node.parent.operator === ts.SyntaxKind.MinusToken
        ) {
            node = node.parent;
        };
        if (!this.isParentTSLiteralType(node)) {
            return false;
        };
        if (this.isGrandparentTSTypeAliasDeclaration(node)) {
            return true;
        };
        if (this.isGrandparentTSUnionType(node)) {
            return true;
        };
        return false;
    };

    // 检查是否是只读类属性
    private isReadonlyClassProperty(node: ts.Node): boolean {
        // 检查当前节点是否在只读属性的初始化表达式中
        let current = node;
        let parent = current.parent;
        // 处理一元表达式（+/-前缀）
        if (parent && ts.isPrefixUnaryExpression(parent) &&
            (parent.operator === ts.SyntaxKind.PlusToken ||
                parent.operator === ts.SyntaxKind.MinusToken)) {
            current = parent;
            parent = current.parent;
        };
        // 检查父节点是否是属性声明且当前节点是其初始化值
        if (!parent || !ts.isPropertyDeclaration(parent) || parent.initializer !== current) {
            return false;
        };
        // 检查是否有readonly修饰符
        return parent.modifiers?.some(mod =>
            mod.kind === ts.SyntaxKind.ReadonlyKeyword
        ) || false;
    };

    // 检查是否是类型索引
    private isTypeIndex(node: ts.Node): boolean {
        // 获取真正的父节点(处理一元表达式)
        let ancestor = this.getLiteralParent(node);
        if (!ancestor) {
            return false;
        };
        const checkForIndexedAccess = (current: ts.Node): boolean => {
            if (!current.parent) {
                return false;
            };
            if (ts.isIndexedAccessTypeNode(current.parent)) {
                return true;
            };
            if (ts.isUnionTypeNode(current.parent) ||
                ts.isIntersectionTypeNode(current.parent) ||
                ts.isParenthesizedTypeNode(current.parent)) {
                return checkForIndexedAccess(current.parent);
            };
            return false;
        };
        return checkForIndexedAccess(ancestor);
    };
    //获取字面量的真正父节点(处理一元表达式)
    private getLiteralParent(node: ts.Node): ts.Node | undefined {
        if (node.parent &&
            ts.isPrefixUnaryExpression(node.parent) &&
            (node.parent.operator === ts.SyntaxKind.MinusToken ||
                node.parent.operator === ts.SyntaxKind.PlusToken)) {
            return node.parent.parent;
        };
        return node.parent;
    };

    private addIssueReport(line: number, startCol: number, endcode: number, filePath: string, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const description = message;
        const defect = new Defects(line, startCol, endcode, description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };

    private reportMagicNumber(node: ts.Node, raw: string, sourceFile: ts.SourceFile, results: MagicNumberCheckResult[]): void {
        const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
        results.push({
            line: line + 1,
            character: character + 1,
            endcode: node.getEnd(),
            message: `No magic number: ${raw}.`
        });
    };

    // 检查数字是否在属性访问表达式的复合赋值中（如 obj.prop += 1 或 Class.staticProp += 1）
    private isPropertyAccessCompoundAssignment(node: ts.Node): boolean {
        // 获取父节点，处理可能的一元表达式
        let current = node;
        let parent = current.parent;
        // 处理一元表达式（+/-前缀）
        if (parent && ts.isPrefixUnaryExpression(parent) &&
            (parent.operator === ts.SyntaxKind.PlusToken ||
                parent.operator === ts.SyntaxKind.MinusToken)) {
            current = parent;
            parent = current.parent;
        };
        // 检查是否是二元表达式
        if (!parent || !ts.isBinaryExpression(parent)) {
            return false;
        };
        // 检查是否是复合赋值操作符（+=, -=, *=, /=等）
        const isCompoundAssignment =
            parent.operatorToken.kind >= ts.SyntaxKind.PlusEqualsToken &&
            parent.operatorToken.kind <= ts.SyntaxKind.CaretEqualsToken;

        if (!isCompoundAssignment) {
            return false;
        };
        // 检查左侧是否是属性访问表达式
        return ts.isPropertyAccessExpression(parent.left);
    };
};