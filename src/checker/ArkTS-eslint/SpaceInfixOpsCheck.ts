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
import { RuleFix } from '../../model/Fix';
type Options = [
    {
        int32Hint: boolean;
    }
];

interface MessageInfo {
    line: number;
    character: number;
    endCol: number;
    message: string;
    node: ts.Node;
    optionValue: boolean
}

export class SpaceInfixOpsCheck implements BaseChecker {
    public issues: IssueReport[] = [];
    public rule: Rule;
    public defects: Defects[] = [];
    public sourceFile: ts.SourceFile;
    public firstDealFlag: boolean = false;
    public countTypeColumnFlag: number = 0;
    public firstEqualsFlag: boolean = false;
    public isConditionalTypeFlag: boolean = false;
    public specialTypeAliasDeclarationFlag: boolean = false;
    private defaultOptions: Options = [
        { int32Hint: false },
    ];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/space-infix-ops-check.md',
        description: 'Require spacing around infix operators',
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

    /**
     * 检测代码中的 space-infix-ops 规则错误
     * @param code 需要检测的代码字符串
     * @param int32Hint 是否强制要求 |0 操作符周围有空格
     */
    private checkSpaceInfixOps(targetField: ArkFile, int32Hint: boolean) {
        let code = targetField.getCode();
        this.sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        const errors: MessageInfo[] = [];

        // 保存 this 引用，方便在内部函数中使用
        const self = this;
        ts.forEachChild(this.sourceFile, visitNode);
        function visitNode(node: ts.Node) {
            // 使用提取出的方法处理不同类型的节点
            if (self.processExpressionNodes(code, node, errors, int32Hint)) {
            } else if (self.processDeclarationNodes(code, node, errors, int32Hint)) {
            } else if (self.processTypeNodes(code, node, errors, int32Hint, visitNode)) {
            }

            ts.forEachChild(node, visitNode);
        }
        return errors;
    }

    // 处理二元表达式、条件表达式和属性赋值相关节点
    private processExpressionNodes(code: string, node: ts.Node, errors: MessageInfo[], int32Hint: boolean): boolean {
        if (ts.isBinaryExpression(node)) {
            if (node.operatorToken.kind === ts.SyntaxKind.BarToken &&
                ts.isNumericLiteral(node.right) && node.right.text === '0') {
                this.checkOperatorSpacing(code, '|', node.operatorToken.getStart(),
                    node.operatorToken.getEnd(), node, true, false, errors, int32Hint);
            } else {
                if (node.operatorToken.kind !== ts.SyntaxKind.CommaToken) {
                    this.checkOperatorSpacing(code, node.operatorToken.getText(), node.operatorToken.getStart(),
                    node.operatorToken.getEnd(), node, false, false, errors, int32Hint);
                }
            }
            return true;
        } else if (ts.isConditionalExpression(node)) {
            this.checkOperatorSpacing(code, '?', node.questionToken.getStart(), node.questionToken.getEnd(),
                node, false, false, errors, int32Hint);
            this.checkOperatorSpacing(code, ':', node.colonToken.getStart(), node.colonToken.getEnd(),
                node, false, false, errors, int32Hint);
            return true;
        } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            this.checkOperatorSpacing(code, '=', node.operatorToken.getStart(), node.operatorToken.getEnd(),
                node, false, false, errors, int32Hint);
            return true;
        } else if (ts.isParameter(node) && node.initializer) {
            const equalsRange = code.slice(node.name.end, node.initializer.getStart());
            const equalsPos = equalsRange.indexOf('=');
            if (equalsPos !== -1) {
                const equalsStart = node.name.end + equalsPos;
                this.checkOperatorSpacing(code, '=', equalsStart, equalsStart + 1, node, false, false, errors, int32Hint);
            }
            return true;
        } else if (ts.isVariableDeclaration(node) && node.initializer) {
            const typeEnd = node.type ? node.type.getEnd() : node.name.end;
            const operatorRange = code.slice(typeEnd, node.initializer.getStart());
            const operatorPos = operatorRange.search(/=(?!>)/); // 排除=>
            if (operatorPos !== -1) {
                const equalsStart = typeEnd + operatorPos;
                this.checkOperatorSpacing(code, '=', equalsStart, equalsStart + 1, node, false, false, errors, int32Hint);
            }
            return true;
        }
        return false;
    }

    // 处理绑定元素、枚举成员、属性声明、属性签名等
    private processDeclarationNodes(code: string, node: ts.Node, errors: MessageInfo[], int32Hint: boolean): boolean {
        if (ts.isBindingElement(node) && node.initializer) {
            const equalsRange = code.slice(node.name.end, node.initializer.getStart());
            const equalsPos = equalsRange.indexOf('=');
            if (equalsPos !== -1) {
                const equalsStart = node.name.end + equalsPos;
                this.checkOperatorSpacing(code, '=', equalsStart, equalsStart + 1, node, false, true, errors, int32Hint); // 允许左侧换行
            }
            return true;
        } else if (ts.isEnumMember(node) && node.initializer) {
            const operatorRange = code.slice(node.name.end, node.initializer.getStart());
            const operatorPos = operatorRange.indexOf('=');
            if (operatorPos !== -1) {
                const equalsStart = node.name.end + operatorPos;
                this.checkOperatorSpacing(code, '=', equalsStart, equalsStart + 1, node, false, false, errors, int32Hint);
            }
            return true;
        } else if (ts.isPropertyDeclaration(node) && node.initializer) {
            const typeEnd = node.type ? node.type.getEnd() : node.name.end;
            const operatorRange = code.slice(typeEnd, node.initializer.getStart());
            const operatorPos = operatorRange.search(/=(?!>)/);
            if (operatorPos !== -1) {
                const equalsStart = typeEnd + operatorPos;
                this.checkOperatorSpacing(code, '=', equalsStart, equalsStart + 1, node, false, false, errors, int32Hint);
            }
            return true;
        } else if (ts.isPropertySignature(node) && node.initializer) {
            this.checkOperatorSpacing(code, '=', node.name.end, node.initializer.getStart(), node, false, false, errors, int32Hint);
            return true;
        } else if (ts.isTypeAliasDeclaration(node)) {
            this.handleTypeAliasDeclaration(code, node, int32Hint, errors, int32Hint);
            return true;
        } else if (ts.isConditionalTypeNode(node)) {
            const afterExtends = node.extendsType.getEnd();// 处理条件类型中的 ? 和 :
            const questionPos = code.indexOf('?', afterExtends);
            if (questionPos !== -1) {
                this.checkOperatorSpacing(code, '?', questionPos, questionPos + 1, node, false, false, errors, int32Hint);
            }
            const afterTrueType = node.trueType.getEnd();
            const colonPos = code.indexOf(':', afterTrueType);
            if (colonPos !== -1) {
                this.checkOperatorSpacing(code, ':', colonPos, colonPos + 1, node, false, false, errors, int32Hint);
            }
            return true;
        }
        return false;
    }

    // 处理类型相关节点
    private processTypeNodes(
        code: string,
        node: ts.Node,
        errors: MessageInfo[],
        int32Hint: boolean,
        visitNodeFn: (node: ts.Node) => void
    ): boolean {
        if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) { // 对交叉类型节点的直接处理
            this.handleUnionOrIntersectionType(code, node, node, int32Hint, errors, int32Hint);
            return true;
        } else if (ts.isParenthesizedTypeNode(node)) { // 增强括号类型处理
            visitNodeFn(node.type);
            // 检查括号内可能存在的操作符（如 (A&B) 中的 &）
            this.handleParenthesizedOperators(code, node, errors, int32Hint);
            return true;
        } else if (ts.isInterfaceDeclaration(node)) { // 新增接口声明处理
            node.members.forEach(member => {
                if (ts.isPropertySignature(member) && member.type) {
                    this.checkNestedType(code, member.type, node, int32Hint, true, errors, int32Hint);// 特殊标记接口属性上下文
                }
            });
            return true;
        }
        return false;
    }

    // 检查操作符间距的函数
    private checkOperatorSpacing(
        code: string,
        operator: string,
        start: number,
        end: number,
        node: ts.Node,
        isInt32Hint: boolean = false,
        allowLeftNewline: boolean = false,
        errors: MessageInfo[],
        int32Hint: boolean
    ): void {
        // 处理特殊情况：bar2| 0（左侧无空格，右侧有空格）
        if (isInt32Hint && operator === '|') {
            this.handleInt32HintOperator(code, start, end, node, allowLeftNewline, errors, int32Hint, operator);
            // 如果启用int32Hint并且是|0操作，则允许无空格
            if (int32Hint) {
                return;
            }
        }
        // 排除箭头函数的等号（=>）
        if (operator === '=' && code.slice(end, end + 1) === '>') {
            return;
        }
        const textBefore = code.slice(Math.max(0, start - 1), start);
        const textAfter = code.slice(end, end + 1);
        const validBefore = allowLeftNewline ?
            /[\s\r\n]/.test(textBefore) :
            /^[ \t]$/.test(textBefore);
        // 增加特殊字符过滤
        const validAfter = operator === ':' ? /[\s\r\n]/.test(textAfter) :
            /[\s\r\n]/.test(textAfter) && !/[.,;)]/.test(textAfter);

        if (!validBefore || !validAfter) {
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
            errors.push({
                line: line + 1,
                character: character + 1,
                endCol: character + node.getText().length + 1,
                message: `Operator '${operator}' must be spaced.`,
                node: node,
                optionValue: int32Hint
            });
        }
    }

    // 处理int32Hint操作符的特殊情况
    private handleInt32HintOperator(
        code: string,
        start: number,
        end: number,
        node: ts.Node,
        allowLeftNewline: boolean,
        errors: MessageInfo[],
        int32Hint: boolean,
        operator: string
    ): void {
        // 检查是否是 bar| 0 这种模式
        const textBefore = code.slice(Math.max(0, start - 1), start);
        const textAfter = code.slice(end, end + 2); // 获取两个字符，包括可能的空格和0

        // 检测 "| 0" 模式（右侧有空格）
        if (/^\s0/.test(textAfter)) {
            // 如果左侧没有空格但右侧有空格，报错
            const validBefore = allowLeftNewline ?
                /[\s\r\n]/.test(textBefore) :
                /^[ \t]$/.test(textBefore);
            if (!validBefore) {
                const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
                errors.push({
                    line: line + 1,
                    character: character + 1,
                    endCol: character + node.getText().length + 1,
                    message: `Operator '${operator}' must be spaced.`,
                    node: node,
                    optionValue: int32Hint
                });
            }
        }
    }

    // 统一处理联合/交叉类型操作符
    private handleUnionOrIntersectionType(
        code: string,
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        node: ts.Node,
        optionValue: boolean,
        errors: MessageInfo[],
        int32Hint: boolean
    ): void {
        const operator = ts.isUnionTypeNode(typeNode) ? '|' : '&';

        // 处理首字符操作符检测
        this.checkFirstTypeOperator(code, typeNode, node, operator, errors, int32Hint);

        // 处理类型之间的操作符
        this.checkBetweenTypesOperators(code, typeNode, node, operator, optionValue, errors);
    }

    // 检查首字符操作符的间距
    private checkFirstTypeOperator(
        code: string,
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        node: ts.Node,
        operator: string,
        errors: MessageInfo[],
        int32Hint: boolean
    ): void {
        if (typeNode.types.length <= 0) {
            return;
        }

        const firstType = typeNode.types[0];
        const startPos = typeNode.getStart();
        const firstTypeStart = firstType.getStart();
        const leadingRange = code.slice(startPos, firstTypeStart);

        if (leadingRange.includes(operator)) {
            const opStart = startPos + leadingRange.indexOf(operator);
            this.checkOperatorSpacing(code, operator, opStart, opStart + 1, node, false, true, errors, int32Hint);
        }
    }

    // 检查类型之间操作符的间距
    private checkBetweenTypesOperators(
        code: string,
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        node: ts.Node,
        operator: string,
        optionValue: boolean,
        errors: MessageInfo[]
    ): void {
        for (let index = 1; index < typeNode.types.length; index++) {
            this.checkTypesPairOperator(
                code,
                typeNode.types[index - 1],
                typeNode.types[index],
                node,
                operator,
                optionValue,
                errors
            );
        }
    }

    // 检查一对类型之间的操作符
    private checkTypesPairOperator(
        code: string,
        prevType: ts.TypeNode,
        currentType: ts.TypeNode,
        node: ts.Node,
        operator: string,
        optionValue: boolean,
        errors: MessageInfo[]
    ): void {
        const startSearchPos = prevType.getEnd();
        const endSearchPos = currentType.getStart();
        const operatorRange = code.slice(startSearchPos, endSearchPos);

        // 使用正则精准定位操作符
        const match = this.findOperatorMatch(operatorRange, operator);

        if (match) {
            this.validateOperatorSpacing(
                code,
                match,
                startSearchPos,
                operator,
                node,
                optionValue,
                errors
            );
        }
    }

    // 查找操作符的匹配
    private findOperatorMatch(
        operatorRange: string,
        operator: string
    ): RegExpMatchArray | null {
        const operatorRegex = new RegExp(String.raw`(\S*)${operator}(\S*)`);
        return operatorRange.match(operatorRegex);
    }

    // 验证操作符的间距并添加错误
    private validateOperatorSpacing(
        code: string,
        match: RegExpMatchArray,
        startSearchPos: number,
        operator: string,
        node: ts.Node,
        optionValue: boolean,
        errors: MessageInfo[]
    ): void {
        const operatorPos = match.index! + match[0].indexOf(operator);
        const opStart = startSearchPos + operatorPos;
        const opEnd = opStart + 1;

        // 检查右侧空格
        const textAfter = code.slice(opEnd, opEnd + 1);
        const validAfter = /[\s\r\n]/.test(textAfter);

        if (!validAfter) {
            this.addOperatorSpacingError(opStart, node, operator, optionValue, errors);
        }
    }

    // 添加操作符间距错误
    private addOperatorSpacingError(
        opStart: number,
        node: ts.Node,
        operator: string,
        optionValue: boolean,
        errors: MessageInfo[]
    ): void {
        const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(opStart);
        errors.push({
            line: line + 1,
            character: character + 1,
            endCol: character + node.getText().length + 1,
            message: `Operator '${operator}' must be spaced.`,
            node: node,
            optionValue: optionValue
        });
    }

    // 带上下文处理方法
    private handleUnionOrIntersectionTypeWithContext(
        code: string,
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        isInterfaceContext: boolean,
        node: ts.Node,
        optionValue: boolean,
        errors: MessageInfo[],
        int32Hint: boolean
    ): void {
        const operator = ts.isUnionTypeNode(typeNode) ? '|' : '&';

        typeNode.types.forEach((type, index) => {
            if (index === 0) {
                return;
            }

            const prevType = typeNode.types[index - 1];
            const startSearchPos = prevType.getEnd();
            const endSearchPos = type.getStart();
            const operatorRange = code.slice(startSearchPos, endSearchPos);

            const operatorPos = operatorRange.indexOf(operator);
            if (operatorPos === -1) {
                return;
            }
            const opStart = startSearchPos + operatorPos;
            const opEnd = opStart + 1;

            // 接口属性特殊规则：左侧必须空格（不允许换行）
            const textBefore = code[opStart - 1] || '';
            const textAfter = code[opEnd] || '';

            const validBefore = isInterfaceContext ? textBefore === ' ' : /[\s\r\n]/.test(textBefore);

            const validAfter = /[\s\r\n]/.test(textAfter);

            if (!validBefore || !validAfter) {
                const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(opStart);
                errors.push({
                    line: line + 1,
                    character: character + 1,
                    endCol: character + node.getText().length + 1,
                    message: `Operator '${operator}' must be spaced.`,
                    node: node,
                    optionValue: int32Hint
                });
            }
        });
    }

    // 处理接口中的联合或交叉类型
    private handleUnionOrIntersectionTypeForInterface(
        code: string,
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        node: ts.Node,
        optionValue: boolean,
        errors: MessageInfo[]
    ): void {
        const operator = ts.isUnionTypeNode(typeNode) ? '|' : '&';

        // 处理每个类型节点之间的操作符
        typeNode.types.forEach((type, index) => {
            if (index === 0) {
                return;
            }
            const prevType = typeNode.types[index - 1];
            const startSearchPos = prevType.getEnd();
            const endSearchPos = type.getStart();
            const operatorRange = code.slice(startSearchPos, endSearchPos);

            // 精确查找操作符位置
            const operatorPos = operatorRange.indexOf(operator);
            if (operatorPos === -1) {
                return;
            }
            const opStart = startSearchPos + operatorPos;
            const opEnd = opStart + 1;

            // 获取操作符前后字符（包含换行符处理）
            const textBefore = code.slice(opStart - 1, opStart);
            const textAfter = code.slice(opEnd, opEnd + 1);

            // 特殊处理接口属性中的联合类型（强制要求左侧空格）
            const isInterfaceContext = typeNode.parent?.parent?.kind === ts.SyntaxKind.PropertySignature;
            const allowLeftNewline = !isInterfaceContext; // 接口属性中不允许左侧换行代替空格

            // 验证规则： 1. 左侧：允许换行或空格（接口属性中不允许换行） 2. 右侧：必须空格或换行
            const validBefore = allowLeftNewline ?
                /[\s\r\n]/.test(textBefore) :
                textBefore === ' ';

            const validAfter = /[\s\r\n]/.test(textAfter);
            if (!validBefore || !validAfter) {
                const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(opStart);
                errors.push({
                    line: line + 1,
                    character: character + 1,
                    endCol: character + node.getText().length + 1,
                    message: `Operator '${operator}' must be spaced.`,
                    node: node,
                    optionValue: optionValue
                });
            }
        });
    }

    // 递归检测方法
    private checkNestedType(
        code: string,
        typeNode: ts.TypeNode,
        node: ts.Node,
        optionValue: boolean,
        isInterfaceContext: boolean = false,
        errors: MessageInfo[],
        int32Hint: boolean
    ): void {
        if (ts.isUnionTypeNode(typeNode)) {
            this.handleUnionOrIntersectionTypeWithContext(code, typeNode, isInterfaceContext, node, optionValue, errors, int32Hint);
            typeNode.types.forEach(t => this.checkNestedType(code, t, node, optionValue, isInterfaceContext, errors, int32Hint));
        } else if (ts.isIntersectionTypeNode(typeNode)) {
            this.handleUnionOrIntersectionTypeForInterface(code, typeNode, node, optionValue, errors);
            typeNode.types.forEach(t => this.checkNestedType(code, t, node, optionValue, isInterfaceContext, errors, int32Hint));
        } else if (ts.isParenthesizedTypeNode(typeNode)) {
            this.checkNestedType(code, typeNode.type, node, optionValue, isInterfaceContext, errors, int32Hint);
        }
    }

    // 处理类型别名声明
    private handleTypeAliasDeclaration(
        code: string,
        node: ts.TypeAliasDeclaration,
        optionValue: boolean,
        errors: MessageInfo[],
        int32Hint: boolean
    ): void {
        const typeNode = node.type;
        const operatorRange = code.slice(node.name.end, typeNode.getStart());
        const operatorPos = operatorRange.indexOf('=');

        if (operatorPos !== -1) {
            const equalsStart = node.name.end + operatorPos;
            this.checkOperatorSpacing(code, '=', equalsStart, equalsStart + 1, node, false, false, errors, int32Hint);
        }

        // 增强：处理嵌套的联合/交叉类型
        if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
            this.handleUnionOrIntersectionType(code, typeNode as ts.UnionTypeNode | ts.IntersectionTypeNode, node, optionValue, errors, int32Hint);
        }

        if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
            typeNode.types.forEach((type, index) => {
                if (index === 0) {
                    return;
                }
                const prevType = typeNode.types[index - 1];
                const operator = ts.isUnionTypeNode(typeNode) ? '|' : '&';
                const operatorRange = code.slice(prevType.getEnd(), type.getStart());
                const operatorPos = operatorRange.indexOf(operator);
                if (operatorPos !== -1) {
                    const opStart = prevType.getEnd() + operatorPos;
                    this.checkOperatorSpacing(code, operator, opStart, opStart + 1, node, false, false, errors, int32Hint);
                }
            });
        }
    }

    // 处理括号内的操作符（如 (A&B)）
    private handleParenthesizedOperators(
        code: string,
        node: ts.ParenthesizedTypeNode,
        errors: MessageInfo[],
        int32Hint: boolean
    ): void {
        // 跳过已被联合/交叉类型处理的括号
        if (ts.isUnionTypeNode(node.parent) || ts.isIntersectionTypeNode(node.parent)) {
            return;
        }

        const fullText = node.getText().slice(1, -1); // 去除外围括号
        const operators = ['|', '&'];

        operators.forEach(op => {
            let pos = -1;
            while ((pos = fullText.indexOf(op, pos + 1)) !== -1) {
                // 计算在源代码中的绝对位置
                const absolutePos = node.getStart() + pos + 1; // +1 跳过开括号
                this.checkOperatorSpacing(code, op, absolutePos, absolutePos + 1, node, false, false, errors, int32Hint);
            }
        });
    }

    public check = (targetField: ArkFile) => {
        this.defaultOptions = this.rule && this.rule.option && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = targetField.getFilePath();
        const myInvalidPositions = this.checkSpaceInfixOps(targetField, this.defaultOptions[0].int32Hint);
        const myInvalidPositionsNew = this.sortMyInvalidPositions(myInvalidPositions);
        myInvalidPositionsNew.forEach(pos => {
            this.addIssueReport(filePath, pos, severity)
        });
    }

    // 对错误位置进行排序并去重
    private sortMyInvalidPositions(myInvalidPositions: Array<MessageInfo>) {
        // 1. 先进行排序
        myInvalidPositions.sort((a, b) => a.line - b.line || a.character - b.character);

        // 2. 使用 reduce 进行去重
        const uniqueArrays = myInvalidPositions.reduce((acc, current) => {
            const lastItem = acc[acc.length - 1];

            // 检查是否与最后一个元素的三要素相同
            if (!lastItem ||
                lastItem.line !== current.line ||
                lastItem.character !== current.character ||
                lastItem.message !== current.message) {
                acc.push(current);
            }
            return acc;
        }, [] as typeof myInvalidPositions);

        return uniqueArrays;
    }

    // 创建修复对象 
    private ruleFix(pos: number, end: number, optionValue: boolean): RuleFix {
        let textStr = '';
        let textNew = this.sourceFile.getFullText().slice(pos, end);
        textStr = textNew.trim();
        textStr = ' ' + textStr + ' ';
        return { range: [pos, end], text: textStr }
    }

    private ruleFixForTypeColumn(pos: number, end: number, optionValue: boolean): RuleFix {
        let textStr = '';
        let textNew = this.sourceFile.getFullText().slice(pos, end);
        textStr = textNew.trim();
        textStr = textStr + ' ';
        return { range: [pos, end], text: textStr }
    }

    private ruleFixForConditionalTypeNode(pos: number, end: number, optionValue: boolean): RuleFix {
        let textStr = '';
        let textNew = this.sourceFile.getFullText().slice(pos, end);
        textStr = textNew.trim();
        textStr = ' ' + textStr;
        return { range: [pos, end], text: textStr }
    }

    private addIssueReport(filePath: string, pos: MessageInfo, severity: number) {
        let defect = new Defects(pos.line, pos.character, pos.endCol, pos.message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, true);

        let fix: RuleFix | undefined = this.getFixForNode(pos.node, pos.optionValue);

        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    }

    private getFixForNode(node: ts.Node, optionValue: boolean): RuleFix | undefined {
        return this.getExpressionFix(node, optionValue) ||
            this.getDeclarationFix(node, optionValue) ||
            this.getTypeFix(node, optionValue);
    }

    private getExpressionFix(node: ts.Node, optionValue: boolean): RuleFix | undefined {
        if (ts.isBinaryExpression(node)) {
            return this.handleBinaryExpressionFix(node, optionValue);
        } else if (ts.isConditionalExpression(node)) {
            return this.handleConditionalExpressionFix(node, optionValue);
        } else if (ts.isPropertyAssignment(node)) {
            return this.handlePropertyAssignmentFix(node, optionValue);
        }
        return undefined;
    }

    private getDeclarationFix(node: ts.Node, optionValue: boolean): RuleFix | undefined {
        if (ts.isParameter(node) && node.initializer) {
            return this.handleParameterInitializerFix(node, optionValue);
        } else if (ts.isEnumMember(node) && node.initializer) {
            return this.handleEnumMemberInitializerFix(node, optionValue);
        } else if (ts.isVariableDeclaration(node) && node.initializer) {
            return this.handleVariableDeclarationFix(node, optionValue);
        } else if (ts.isBindingElement(node) && node.initializer) {
            return this.handleBindingElementFix(node, optionValue);
        } else if (ts.isPropertyDeclaration(node) && node.initializer) {
            return this.handlePropertyDeclarationFix(node, optionValue);
        } else if (ts.isPropertySignature(node) && node.initializer) {
            return this.handlePropertySignatureFix(node, optionValue);
        } else if (ts.isTypeAliasDeclaration(node)) {
            return this.handleTypeAliasDeclarationFix(node, optionValue);
        }
        return undefined;
    }

    private getTypeFix(node: ts.Node, optionValue: boolean): RuleFix | undefined {
        if (ts.isConditionalTypeNode(node)) {
            return this.handleConditionalTypeNodeFix(node, optionValue);
        } else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
            return this.handleUnionOrIntersectionTypeFix(node, optionValue);
        } else if (ts.isInterfaceDeclaration(node)) {
            return this.handleInterfaceDeclarationFix(node, optionValue);
        }
        return undefined;
    }

    private handleBinaryExpressionFix(node: ts.BinaryExpression, optionValue: boolean): RuleFix {
        const stPos = node.left.end;
        const stEnd = node.right.end - node.right.getText().length;
        return this.ruleFix(stPos, stEnd, optionValue);
    }

    private handleConditionalExpressionFix(node: ts.ConditionalExpression, optionValue: boolean): RuleFix {
        const stPos = node.condition.end;
        const stEnd = node.whenTrue.end - node.whenTrue.getText().length;
        let qTextStr = this.sourceFile.getFullText().slice(stPos, stEnd);
        let qNewTextStr = ' ' + qTextStr.trim() + ' ';

        let stFenPos = node.whenTrue.end;
        let stFenEnd = node.whenFalse.end - node.whenFalse.getText().length;

        if (qTextStr === qNewTextStr || this.firstDealFlag) {
            this.firstDealFlag = false;
            return this.ruleFix(stFenPos, stFenEnd, optionValue);
        } else {
            this.firstDealFlag = true;
            return this.ruleFix(stPos, stEnd, optionValue);
        }
    }

    private handlePropertyAssignmentFix(node: ts.PropertyAssignment, optionValue: boolean): RuleFix {
        const stPos = node.name.end;
        const stEnd = node.initializer.end - node.initializer.getText().length;
        return this.ruleFix(stPos, stEnd, optionValue);
    }

    private handleParameterInitializerFix(node: ts.ParameterDeclaration, optionValue: boolean): RuleFix | undefined {
        if (ts.isParameter(node) && node.initializer) {
            const stPos = node.name.end;
            const stEnd = node.initializer.end - node.initializer.getText().length;
            return this.ruleFix(stPos, stEnd, optionValue);
        }
        return undefined;
    }

    private handleEnumMemberInitializerFix(node: ts.EnumMember, optionValue: boolean): RuleFix | undefined {
        if (ts.isEnumMember(node) && node.initializer) {
            const stPos = node.name.end;
            const stEnd = node.initializer.end - node.initializer.getText().length;
            return this.ruleFix(stPos, stEnd, optionValue);
        }
        return undefined;
    }

    private handleVariableDeclarationFix(node: ts.VariableDeclaration, optionValue: boolean): RuleFix | undefined {
        if (ts.isVariableDeclaration(node) && node.initializer) {
            const stPos = node.name.end;
            const stEnd = node.initializer.end - node.initializer.getText().length;
            return this.ruleFix(stPos, stEnd, optionValue);
        }
        return undefined;
    }

    private handleBindingElementFix(node: ts.BindingElement, optionValue: boolean): RuleFix | undefined {
        if (ts.isBindingElement(node) && node.initializer) {
            const stPos = node.name.end;
            const stEnd = node.initializer.end - node.initializer.getText().length;
            return this.ruleFix(stPos, stEnd, optionValue);
        }
        return undefined;
    }

    private handlePropertyDeclarationFix(node: ts.PropertyDeclaration, optionValue: boolean): RuleFix | undefined {
        if (ts.isPropertyDeclaration(node) && node.initializer) {
            const stPos = node.type ? node.type.end : node.name.end;
            const stEnd = node.initializer.end - node.initializer.getText().length;
            return this.ruleFix(stPos, stEnd, optionValue);
        }
        return undefined;
    }

    private handlePropertySignatureFix(node: ts.PropertySignature, optionValue: boolean): RuleFix | undefined {
        const stPos = node.name.end;
        const stEnd = node.type ? node.type.pos : node.name.end;
        return this.ruleFix(stPos, stEnd, optionValue);
    }

    private handleTypeAliasDeclarationFix(node: ts.TypeAliasDeclaration, optionValue: boolean): RuleFix | undefined {
        if (!node.type) {
            return undefined;
        }

        const stPos = node.name.end;
        const stEnd = node.type.end - node.type.getText().length;
        let textStr = this.sourceFile.getFullText().slice(stPos, stEnd);
        let textNewStr = ' ' + textStr.trim() + ' ';

        if (textStr === textNewStr || this.firstEqualsFlag) {
            return this.handleTypeAliasWithEqualSpace(node, optionValue);
        } else if (textStr.includes('=\r\n')) {
            return this.handleTypeAliasWithNewline(node, optionValue);
        } else {
            return this.handleTypeAliasWithoutEqualSpace(node, optionValue);
        }
    }

    private handleTypeAliasWithEqualSpace(node: ts.TypeAliasDeclaration, optionValue: boolean): RuleFix | undefined {
        let typeNode = node.type;
        if (!ts.isUnionTypeNode(typeNode) && !ts.isIntersectionTypeNode(typeNode)) {
            return undefined;
        }

        if (typeNode.types.length === 2) {
            return this.handleTypeAliasTwoTypes(typeNode, optionValue);
        } else if (typeNode.types.length === 3) {
            return this.handleTypeAliasThreeTypes(typeNode, optionValue);
        }

        return undefined;
    }

    private handleTypeAliasTwoTypes(typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode, optionValue: boolean): RuleFix | undefined {
        const prevType = typeNode.types[0];
        const nextType = typeNode.types[1];
        const operator = ts.isUnionTypeNode(typeNode) ? '|' : '&';
        let operatorStrNew = ' ' + operator + ' ';
        let textNew = this.sourceFile.getFullText().slice(prevType.getEnd(), nextType.getStart());

        if (operatorStrNew !== textNew) {
            this.firstEqualsFlag = false;
            return this.ruleFix(prevType.getEnd(), nextType.getStart(), optionValue);
        }

        return undefined;
    }

    private handleTypeAliasThreeTypes(typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode, optionValue: boolean): RuleFix | undefined {
        const prevType = typeNode.types[0];
        const nextType = typeNode.types[1];
        const lastType = typeNode.types[2];
        const operator = ts.isUnionTypeNode(typeNode) ? '|' : '&';
        let operatorStrNew = operator + ' ';
        let firstTextStr = this.sourceFile.getFullText().slice(typeNode.getStart(), prevType.getStart());
        let secondTextStr = this.sourceFile.getFullText().slice(prevType.getEnd(), nextType.getStart());
        let threeTextStr = this.sourceFile.getFullText().slice(nextType.getEnd(), lastType.getStart());
        let operatorStrLastNew = ' ' + operator + ' ';

        if (firstTextStr === '') {
            return this.handleTypeAliasThreeTypesEmptyFirst(prevType, nextType, lastType,
                secondTextStr, threeTextStr, operatorStrLastNew, optionValue);
        } else {
            return this.handleTypeAliasThreeTypesWithFirst(typeNode, prevType, nextType, lastType,
                firstTextStr, secondTextStr, threeTextStr, operatorStrNew, operatorStrLastNew, optionValue);
        }
    }

    private handleTypeAliasThreeTypesEmptyFirst(
        prevType: ts.TypeNode,
        nextType: ts.TypeNode,
        lastType: ts.TypeNode,
        secondTextStr: string,
        threeTextStr: string,
        operatorStrLastNew: string,
        optionValue: boolean
    ): RuleFix | undefined {
        if (this.countTypeColumnFlag === 0 && secondTextStr !== '' && secondTextStr !== operatorStrLastNew) {
            let operatorStart = prevType.getEnd();
            let operatorEnd = nextType.getStart();
            this.countTypeColumnFlag = 2;
            return this.ruleFix(operatorStart, operatorEnd, optionValue);
        } else if (this.countTypeColumnFlag === 2 && threeTextStr !== '' && threeTextStr !== operatorStrLastNew) {
            let operatorStart = nextType.getEnd();
            let operatorEnd = lastType.getStart();
            this.countTypeColumnFlag = 0;
            this.firstEqualsFlag = false;
            return this.ruleFix(operatorStart, operatorEnd, optionValue);
        }
        return undefined;
    }

    private handleTypeAliasThreeTypesWithFirst(
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        prevType: ts.TypeNode,
        nextType: ts.TypeNode,
        lastType: ts.TypeNode,
        firstTextStr: string,
        secondTextStr: string,
        threeTextStr: string,
        operatorStrNew: string,
        operatorStrLastNew: string,
        optionValue: boolean
    ): RuleFix | undefined {
        if (firstTextStr !== operatorStrNew && this.countTypeColumnFlag === 0) {
            this.countTypeColumnFlag = 1;
            return this.ruleFixForTypeColumn(typeNode.getStart(), prevType.getStart(), optionValue);
        } else if (this.countTypeColumnFlag === 1 && secondTextStr !== '' && secondTextStr !== operatorStrLastNew) {
            let operatorStart = prevType.getEnd();
            let operatorEnd = nextType.getStart();
            this.countTypeColumnFlag = 2;
            return this.ruleFix(operatorStart, operatorEnd, optionValue);
        } else if (this.countTypeColumnFlag === 2 && threeTextStr !== '' && threeTextStr !== operatorStrLastNew) {
            let operatorStart = nextType.getEnd();
            let operatorEnd = lastType.getStart();
            this.countTypeColumnFlag = 0;
            this.firstEqualsFlag = false;
            this.specialTypeAliasDeclarationFlag = false;
            return this.ruleFix(operatorStart, operatorEnd, optionValue);
        }
        return undefined;
    }

    private handleTypeAliasWithNewline(node: ts.TypeAliasDeclaration, optionValue: boolean): RuleFix | undefined {
        let typeNode = node.type;
        if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
            if (typeNode.types.length > 0) {
                const firstType = typeNode.types[0];
                const startPos = typeNode.getStart();
                const firstTypeStart = firstType.getStart();
                const leadingRange = this.sourceFile.getFullText().slice(startPos, firstTypeStart);
                let leadingRangeNew = leadingRange.trim() + ' ';
                if (leadingRange !== leadingRangeNew) {
                    return this.ruleFixForTypeColumn(startPos, firstTypeStart, optionValue);
                }
            }
        }
        return undefined;
    }

    private handleTypeAliasWithoutEqualSpace(node: ts.TypeAliasDeclaration, optionValue: boolean): RuleFix | undefined {
        const typeNode = node.type;
        if (!ts.isUnionTypeNode(typeNode) && !ts.isIntersectionTypeNode(typeNode)) {
            return undefined;
        }

        if (typeNode.types.length === 2) {
            return this.handleTypeAliasWithoutEqualSpaceTwoTypes(node, typeNode, optionValue);
        } else if (typeNode.types.length > 2) {
            return this.handleTypeAliasWithoutEqualSpaceMultiTypes(node, typeNode, optionValue);
        }

        return undefined;
    }

    private handleTypeAliasWithoutEqualSpaceTwoTypes(
        node: ts.TypeAliasDeclaration,
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        optionValue: boolean
    ): RuleFix | undefined {
        const prevType = typeNode.types[0];
        const nextType = typeNode.types[1];
        const operator = ts.isUnionTypeNode(typeNode) ? '|' : '&';
        let operatorStrNew = ' ' + operator + ' ';
        let textNew = this.sourceFile.getFullText().slice(prevType.getEnd(), nextType.getStart());

        if (operatorStrNew !== textNew) {
            this.firstEqualsFlag = true;
            return undefined;
        } else {
            this.firstEqualsFlag = false;
            let equTextStr = this.sourceFile.getFullText().slice(node.name.end, typeNode.getStart());
            let equTextNewStr = ' ' + equTextStr.trim() + ' ';
            if (equTextStr !== equTextNewStr) {
                return this.ruleFix(node.name.end, typeNode.getStart(), optionValue);
            }
        }

        return undefined;
    }

    private handleTypeAliasWithoutEqualSpaceMultiTypes(
        node: ts.TypeAliasDeclaration,
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        optionValue: boolean
    ): RuleFix | undefined {
        if (typeNode.types.length < 3) {
            return undefined;
        }

        const prevType = typeNode.types[0];
        const nextType = typeNode.types[1];
        const lastType = typeNode.types[2];

        let equTextStr = this.sourceFile.getFullText().slice(node.name.end, typeNode.getStart());
        let equTextNewStr = ' ' + equTextStr.trim() + ' ';
        let firstTextStr = this.sourceFile.getFullText().slice(typeNode.getStart(), prevType.getStart());
        let secondTextStr = this.sourceFile.getFullText().slice(prevType.getEnd(), nextType.getStart());
        let threeTextStr = this.sourceFile.getFullText().slice(nextType.getEnd(), lastType.getStart());

        let x = firstTextStr.trim() + ' ';
        let y = ' ' + secondTextStr.trim() + ' ';
        let z = ' ' + threeTextStr.trim() + ' ';

        if (equTextStr !== equTextNewStr && !this.specialTypeAliasDeclarationFlag) {
            return this.handleMultiTypesEqualsCheck(node, typeNode, firstTextStr,
                secondTextStr, threeTextStr, x, y, z, optionValue);
        } else {
            return this.handleMultiTypesSpacingCheck(typeNode, prevType, nextType, lastType,
                firstTextStr, secondTextStr, threeTextStr, y, z, optionValue);
        }
    }

    private handleMultiTypesEqualsCheck(
        node: ts.TypeAliasDeclaration,
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        firstTextStr: string,
        secondTextStr: string,
        threeTextStr: string,
        x: string,
        y: string,
        z: string,
        optionValue: boolean
    ): RuleFix {
        if (firstTextStr !== '') {
            if (firstTextStr !== x || secondTextStr !== y || threeTextStr !== z) {
                this.specialTypeAliasDeclarationFlag = true;
            } else {
                this.specialTypeAliasDeclarationFlag = false;
            }
        } else {
            if (secondTextStr !== y || threeTextStr !== z) {
                this.specialTypeAliasDeclarationFlag = true;
            } else {
                this.specialTypeAliasDeclarationFlag = false;
            }
        }
        return this.ruleFix(node.name.end, typeNode.getStart(), optionValue);
    }

    private handleMultiTypesSpacingCheck(
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        prevType: ts.TypeNode,
        nextType: ts.TypeNode,
        lastType: ts.TypeNode,
        firstTextStr: string,
        secondTextStr: string,
        threeTextStr: string,
        y: string,
        z: string,
        optionValue: boolean
    ): RuleFix | undefined {
        const operator = ts.isUnionTypeNode(typeNode) ? '|' : '&';
        let operatorStrNew = ' ' + operator + ' ';

        if (firstTextStr !== '') {
            return this.handleMultiTypesWithFirstText(typeNode, prevType, nextType, lastType,
                firstTextStr, secondTextStr, threeTextStr, operatorStrNew, optionValue);
        } else {
            return this.handleMultiTypesWithEmptyFirst(prevType, nextType, lastType, secondTextStr, threeTextStr, y, z, optionValue);
        }
    }

    private handleMultiTypesWithFirstText(
        typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode,
        prevType: ts.TypeNode,
        nextType: ts.TypeNode,
        lastType: ts.TypeNode,
        firstTextStr: string,
        secondTextStr: string,
        threeTextStr: string,
        operatorStrNew: string,
        optionValue: boolean
    ): RuleFix | undefined {
        if (firstTextStr !== operatorStrNew && this.countTypeColumnFlag === 0) {
            this.countTypeColumnFlag = 1;
            return this.ruleFixForTypeColumn(typeNode.getStart(), prevType.getStart(), optionValue);
        } else if (this.countTypeColumnFlag === 1 && secondTextStr !== '' && secondTextStr !== operatorStrNew) {
            let operatorStart = prevType.getEnd();
            let operatorEnd = nextType.getStart();
            this.countTypeColumnFlag = 2;
            return this.ruleFix(operatorStart, operatorEnd, optionValue);
        } else if (this.countTypeColumnFlag === 2 && threeTextStr !== '' && threeTextStr !== operatorStrNew) {
            let operatorStart = nextType.getEnd();
            let operatorEnd = lastType.getStart();
            this.countTypeColumnFlag = 0;
            this.firstEqualsFlag = false;
            this.specialTypeAliasDeclarationFlag = false;
            return this.ruleFix(operatorStart, operatorEnd, optionValue);
        }
        return undefined;
    }

    private handleMultiTypesWithEmptyFirst(
        prevType: ts.TypeNode,
        nextType: ts.TypeNode,
        lastType: ts.TypeNode,
        secondTextStr: string,
        threeTextStr: string,
        y: string,
        z: string,
        optionValue: boolean
    ): RuleFix | undefined {
        if (this.countTypeColumnFlag === 0 && secondTextStr !== '' && secondTextStr !== y) {
            let operatorStart = prevType.getEnd();
            let operatorEnd = nextType.getStart();
            this.countTypeColumnFlag = 2;
            return this.ruleFix(operatorStart, operatorEnd, optionValue);
        } else if (this.countTypeColumnFlag === 2 && threeTextStr !== '' && threeTextStr !== z) {
            let operatorStart = nextType.getEnd();
            let operatorEnd = lastType.getStart();
            this.countTypeColumnFlag = 0;
            this.firstEqualsFlag = false;
            this.specialTypeAliasDeclarationFlag = false;
            return this.ruleFix(operatorStart, operatorEnd, optionValue);
        }
        return undefined;
    }

    private handleConditionalTypeNodeFix(node: ts.ConditionalTypeNode, optionValue: boolean): RuleFix | undefined {
        const stPos = node.extendsType.getEnd();
        const stEnd = node.trueType.getStart();
        let queStr = this.sourceFile.getFullText().slice(stPos, stEnd);

        if (!queStr.includes('?\r\n') && !queStr.startsWith('\r\n')) {
            return this.handleSimpleConditionalType(node, queStr, optionValue);
        } else if (queStr.startsWith('\r\n')) {
            return this.handleNewlineStartConditionalType(node, optionValue);
        } else {
            return this.handleMidNewlineConditionalType(node, queStr, optionValue);
        }
    }

    private handleSimpleConditionalType(
        node: ts.ConditionalTypeNode,
        queStr: string,
        optionValue: boolean
    ): RuleFix | undefined {
        let queNewStr = ' ' + queStr.trim() + ' ';
        let stStart = node.trueType.getEnd();
        let stLast = node.falseType.getStart();
        let maoStr = this.sourceFile.getFullText().slice(stStart, stLast);
        let maoNewStr = ' ' + maoStr.trim() + ' ';

        if (queStr !== queNewStr && !this.isConditionalTypeFlag) {
            if (maoStr !== maoNewStr) {
                this.isConditionalTypeFlag = true;
            } else {
                this.isConditionalTypeFlag = false;
            }
            return this.ruleFix(node.extendsType.getEnd(), node.trueType.getStart(), optionValue);
        } else {
            if (maoStr !== maoNewStr) {
                this.isConditionalTypeFlag = false;
                return this.ruleFix(stStart, stLast, optionValue);
            }
        }
        return undefined;
    }

    private handleNewlineStartConditionalType(
        node: ts.ConditionalTypeNode,
        optionValue: boolean
    ): RuleFix | undefined {
        let speStartPos = node.extendsType.getEnd();
        let speTrueStart = node.trueType.getStart();
        let speTrueEnd = node.trueType.getEnd();
        let speFalseStart = node.falseType.getStart();
        let aStr = this.sourceFile.getFullText().slice(speStartPos, speTrueStart);
        let bStr = this.sourceFile.getFullText().slice(speTrueEnd, speFalseStart);

        if (aStr.startsWith('\r\n') && aStr.endsWith('?') && !this.isConditionalTypeFlag) {
            this.isConditionalTypeFlag = true;
            return this.ruleFixForTypeColumn(speTrueStart - 1, speTrueStart, optionValue);
        } else if (bStr.startsWith(':') && bStr.includes('\r\n')) {
            this.isConditionalTypeFlag = false;
            return this.ruleFixForConditionalTypeNode(speTrueEnd, speTrueEnd + 1, optionValue);
        }
        return undefined;
    }

    private handleMidNewlineConditionalType(
        node: ts.ConditionalTypeNode,
        queStr: string,
        optionValue: boolean
    ): RuleFix | undefined {
        let xPos = node.extendsType.getEnd();
        let stStart = node.trueType.getEnd();
        let stLast = node.falseType.getStart();
        let maoStr = this.sourceFile.getFullText().slice(stStart, stLast);

        if (!queStr.startsWith(' ') && !this.isConditionalTypeFlag) {
            if (maoStr !== ' ' + maoStr.trim() + ' ') {
                this.isConditionalTypeFlag = true;
            } else {
                this.isConditionalTypeFlag = false;
            }
            return this.ruleFixForConditionalTypeNode(xPos, xPos + 1, optionValue);
        } else {
            return this.handleMidNewlineColonFix(node, maoStr, optionValue);
        }
    }

    private handleMidNewlineColonFix(
        node: ts.ConditionalTypeNode,
        maoStr: string,
        optionValue: boolean
    ): RuleFix | undefined {
        let maoNewStr = ' ' + maoStr.trim() + ' ';

        if (maoStr !== maoNewStr && !maoStr.includes('\r\n')) {
            this.isConditionalTypeFlag = false;
            return this.ruleFix(node.trueType.getEnd(), node.falseType.getStart(), optionValue);
        } else {
            let topMaoFlag = maoStr.startsWith(':');
            if (!maoStr.includes('\r\n')) {
                this.isConditionalTypeFlag = false;
                return this.ruleFixForConditionalTypeNode(node.trueType.getEnd(), node.falseType.getStart(), optionValue);
            } else {
                if (topMaoFlag) {
                    this.isConditionalTypeFlag = false;
                    return this.ruleFix(node.trueType.getEnd(), node.trueType.getEnd() + 1, optionValue);
                } else {
                    this.isConditionalTypeFlag = false;
                    return this.ruleFixForTypeColumn(node.falseType.getStart() - 1, node.falseType.getStart(), optionValue);
                }
            }
        }
    }

    private handleUnionOrIntersectionTypeFix(
        node: ts.UnionTypeNode | ts.IntersectionTypeNode,
        optionValue: boolean
    ): RuleFix | undefined {
        if (node.types.length > 1) {
            const firstType = node.types[0];
            const nextType = node.types[1];
            const leadingRange = this.sourceFile.getFullText().slice(firstType.getEnd(), nextType.getStart());
            let leadingRangeNew = ' ' + leadingRange.trim() + ' ';
            if (leadingRange !== leadingRangeNew) {
                return this.ruleFix(firstType.getEnd(), nextType.getStart(), optionValue);
            }
        }
        return undefined;
    }

    private handleInterfaceDeclarationFix(node: ts.InterfaceDeclaration, optionValue: boolean): RuleFix | undefined {
        for (const member of node.members) {
            if (ts.isPropertySignature(member) && member.type && ts.isUnionTypeNode(member.type)) {
                const fix = this.handleInterfacePropertyUnionTypeFix(member.type, optionValue);
                if (fix) {
                    return fix;
                }
            }
        }
        return undefined;
    }

    private handleInterfacePropertyUnionTypeFix(
        typeNode: ts.UnionTypeNode,
        optionValue: boolean
    ): RuleFix | undefined {
        for (let index = 1; index < typeNode.types.length; index++) {
            const prevType = typeNode.types[index - 1];
            const currentType = typeNode.types[index];
            const startPos = prevType.getEnd();
            const endPos = currentType.getStart();
            const operatorRange = this.sourceFile.getFullText().slice(startPos, endPos);
            let operatorRangeNew = ' ' + operatorRange.trim() + ' ';
            let beFlag = operatorRange.startsWith(' ');
            let afFlag = operatorRange.endsWith(' ');
            if (operatorRange !== operatorRangeNew && !beFlag && afFlag) {
                return this.ruleFix(startPos, endPos, optionValue);
            } else if (operatorRange !== operatorRangeNew && beFlag && !afFlag) {
                return this.ruleFix(startPos, endPos, optionValue);
            }
        }
        return undefined;
    }
}