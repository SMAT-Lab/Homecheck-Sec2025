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
type SpaceOption = 'always' | 'never' | 'ignore';
type Options = [
    {
        anonymous: SpaceOption;
        named: SpaceOption;
        asyncArrow: SpaceOption;
    }
];

interface MessageInfo {
    line: number;
    character: number;
    endCol: number;
    message: string;
    node: ts.Node;
    optionType: SpaceOption
}

export class SpaceBeforeFunctionParenCheck implements BaseChecker {
    public issues: IssueReport[] = [];
    public rule: Rule;
    public defects: Defects[] = [];
    public sourceFile: ts.SourceFile;
    private defaultOptions: Options = [
        {
            anonymous: 'never',
            named: 'never',
            asyncArrow: 'never',
        }
    ];
    private errors: MessageInfo[] = [];

    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/space-before-function-paren.md',
        description: 'Enforce consistent spacing before function parenthesis',
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
      * 检测函数括号前的空格问题
      * @param code 代码字符串
      * @param options 规则配置选项
      * @returns 错误信息数组，包含行列号和消息
    */
    private checkSpaceBeforeFunctionParen(targetField: ArkFile, options: Options[0]): MessageInfo[] {
        this.errors = [];
        let code = targetField.getCode();
        this.sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        const visitNode = (node: ts.Node) => {
            if (ts.isFunctionDeclaration(node)) {
                this.checkNamedFunction(node, code, options);
            } else if (ts.isFunctionExpression(node)) {
                this.checkFunctionExpression(node, !!node.name, code, options);
            } else if (ts.isArrowFunction(node)) {
                this.checkAsyncArrowFunction(node, code, options);
            } else if (ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
                this.checkMethod(node, code, options);
            } else if (ts.isConstructorDeclaration(node)) {
                this.checkConstructor(node, code, options);
            }
            ts.forEachChild(node, visitNode);
        };

        ts.forEachChild(this.sourceFile, visitNode);
        return this.errors;
    }

    private getParenPosition(node: ts.FunctionLikeDeclaration): number | null {
        const openParen = node.getChildren().find(c => c.kind === ts.SyntaxKind.OpenParenToken);
        return openParen?.getStart() || null;
    }

    private checkNamedFunction(node: ts.FunctionDeclaration, code: string, options: Options[0]): void {
        if (!node.name?.getText() && this.isGeneratorFunction(node)) {
            return;
        }
        if (options.named === 'ignore') {
            return;
        }
        if (!node.name) {
            const isExportDefault = node.modifiers?.some(m => 
                m.kind === ts.SyntaxKind.ExportKeyword && 
                node.modifiers?.some(m2 => m2.kind === ts.SyntaxKind.DefaultKeyword)
            );
            if (!isExportDefault) {
                return;
            }
            const functionKeyword = node.getChildren().find(c => c.kind === ts.SyntaxKind.FunctionKeyword);
            if (!functionKeyword) {
                return;
            }
            const checkStart = functionKeyword.end;
            const parenPos = this.getParenPosition(node);
            if (!parenPos) {
                return;
            }
            const errorMessage = options.named === 'always'
                ? 'Missing space before function parentheses.'
                : 'Unexpected space before function parentheses.';
            this.checkSpace(node, code, checkStart, parenPos, options.named, errorMessage);
            return;
        }
        let checkStart;
        if (node.typeParameters && node.typeParameters.length > 0) {
            const lastTypeParam = node.typeParameters[node.typeParameters.length - 1];
            checkStart = lastTypeParam.getEnd();
            const closingAngle = this.findClosingAngleBracket(code, checkStart);
            if (closingAngle !== -1) {
                checkStart = closingAngle + 1;
            }
        } else {
            checkStart = node.name.end;
        }
        const parenPos = this.getParenPosition(node);
        if (!parenPos) {
            return;
        }
        const errorMessage = options.named === 'always'
            ? 'Missing space before function parentheses.'
            : 'Unexpected space before function parentheses.';

        this.checkSpace(node, code, checkStart, parenPos, options.named, errorMessage);
    }

    // 查找泛型参数后的右尖括号
    private findClosingAngleBracket(code: string, startPos: number): number {
        let pos = startPos;
        while (pos < code.length) {
            if (code[pos] === '>') {
                return pos;
            }
            pos++;
        }
        return -1;
    }

    private checkAsyncArrowFunction(node: ts.ArrowFunction, code: string, options: Options[0]): void {
        if (options.asyncArrow === 'ignore') {
            return;
        }
        const asyncKeyword = node.modifiers?.find(m => m.kind === ts.SyntaxKind.AsyncKeyword);
        if (!asyncKeyword) {
            return;
        }
        const parenPos = this.getParenPosition(node);
        if (!parenPos) {
            return;
        }
        const errorMessage = options.asyncArrow === 'always'
            ? 'Missing space before function parentheses.'
            : 'Unexpected space before function parentheses.';

        this.checkSpace(node, code, asyncKeyword.end, parenPos, options.asyncArrow, errorMessage);
    }

    private checkMethod(node: ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
        code: string, options: Options[0]): void {
        if (options.named === 'ignore') {
            return;
        }
    
        let checkStart = node.name.end;
    
        // 新增：处理泛型参数
        if (node.typeParameters && node.typeParameters.length > 0) {
            const lastTypeParam = node.typeParameters[node.typeParameters.length - 1];
            checkStart = lastTypeParam.getEnd();
            const closingAngle = this.findClosingAngleBracketForMethod(code, checkStart);
            if (closingAngle !== -1) {
                checkStart = closingAngle + 1; // 调整检查起点到泛型闭合后
            }
        }
    
        const parenPos = this.getParenPosition(node);
        if (!parenPos) {
            return;
        }
    
        const errorMessage = options.named === 'always'
            ? 'Missing space before function parentheses.'
            : 'Unexpected space before function parentheses.';
    
        this.checkSpace(node, code, checkStart, parenPos, options.named, errorMessage);
    }

    private findClosingAngleBracketForMethod(code: string, startPos: number): number {
        let pos = startPos;
        let stack = 1; // 初始栈为1，匹配外层泛型
        while (pos < code.length) {
            const char = code[pos];
            if (char === '<') {
                stack++;
            } else if (char === '>') {
                stack--;
                if (stack === 0) {
                    return pos; // 返回最外层闭合的 '>'
                }
            }
            pos++;
        }
        return -1;
    }

    private checkConstructor(node: ts.ConstructorDeclaration, code: string, options: Options[0]): void {
        if (options.named === 'ignore') {
            return;
        }

        const constructorKeyword = node.getChildren().find(c => c.kind === ts.SyntaxKind.ConstructorKeyword);
        if (!constructorKeyword) {
            return;
        }

        const checkStart = node.typeParameters?.end || constructorKeyword.end;
        const parenPos = this.getParenPosition(node);
        if (!parenPos) {
            return;
        }

        const errorMessage = options.named === 'always'
            ? 'Missing space before function parentheses.'
            : 'Unexpected space before function parentheses.';

        this.checkSpace(node, code, checkStart, parenPos, options.named, errorMessage);
    }

    private isGeneratorFunction(node: ts.FunctionLikeDeclaration): boolean {
        return node.asteriskToken !== undefined;
    }

    private checkFunctionExpression(node: ts.FunctionExpression, isNamed: boolean,
        code: string, options: Options[0]): void {
        if (!isNamed && this.isGeneratorFunction(node)) {
            return;
        }

        const option = isNamed ? options.named : options.anonymous;
        if (option === 'ignore') {
            return;
        }

        const checkStart = node.typeParameters?.end || (isNamed && node.name?.end) ||
            node.getChildren().find(c => c.kind === ts.SyntaxKind.FunctionKeyword)?.end;

        if (!checkStart) {
            return;
        }

        const parenPos = this.getParenPosition(node);
        if (!parenPos) {
            return;
        }

        const errorMessage = option === 'always'
            ? 'Missing space before function parentheses.'
            : 'Unexpected space before function parentheses.';

        this.checkSpace(node, code, checkStart, parenPos, option, errorMessage);
    }

    private checkSpace(
        node: ts.Node,
        code: string,
        checkStart: number,
        parenPos: number,
        optionType: SpaceOption,
        errorMessage: string
    ): void {
        if (optionType === 'ignore' || parenPos === -1) {
            return;
        }

        const spaceCheckStart = Math.max(checkStart, 0);
        const spaceCheckEnd = parenPos - 1;

        if (optionType === 'never') {
            this.checkNeverSpace(node, code, spaceCheckStart, spaceCheckEnd, errorMessage, optionType);
        } else if (optionType === 'always') {
            this.checkAlwaysSpace(node, code, spaceCheckStart, spaceCheckEnd, parenPos, errorMessage, optionType);
        }
    }

    private checkNeverSpace(
        node: ts.Node,
        code: string,
        spaceCheckStart: number,
        spaceCheckEnd: number,
        errorMessage: string,
        optionType: SpaceOption
    ): void {
        let hasInvalidSpace = false;
        let pos = spaceCheckStart;
        let firstSpacePos = -1;

        while (pos <= spaceCheckEnd) {
            const char = code[pos];

            // Check for whitespace
            if (/\s/.test(char)) {
                if (firstSpacePos === -1) {
                    firstSpacePos = pos;
                }
                hasInvalidSpace = true;
            }

            if (char === '/' && code[pos + 1] === '*') {
                if (firstSpacePos === -1) {
                    firstSpacePos = pos;
                }
                hasInvalidSpace = true;
                const commentEnd = code.indexOf('*/', pos + 2);
                if (commentEnd === -1) {
                    break;
                }
                pos = commentEnd + 2;
                continue;
            }

            if (char === '/' && code[pos + 1] === '/') {
                if (firstSpacePos === -1) {
                    firstSpacePos = pos;
                }
                hasInvalidSpace = true;
                const lineEnd = code.indexOf('\n', pos);
                pos = lineEnd === -1 ? spaceCheckEnd + 1 : lineEnd;
                continue;
            }

            pos++;
        }
        if (hasInvalidSpace && firstSpacePos !== -1) {
            this.addError(firstSpacePos, errorMessage, node, optionType);
        }
    }

    private checkAlwaysSpace(
        node: ts.Node,
        code: string,
        spaceCheckStart: number,
        spaceCheckEnd: number,
        parenPos: number,
        errorMessage: string,
        optionType: SpaceOption
    ): void {
        let hasWhitespace = false;
        let pos = spaceCheckStart;
        while (pos <= spaceCheckEnd) {
            const char = code[pos];
            if (/\s/.test(char)) {
                hasWhitespace = true;
                pos++;
                continue;
            }
            if (char === '/' && code[pos + 1] === '*') {
                const commentEnd = code.indexOf('*/', pos + 2);
                if (commentEnd === -1) {
                    break;
                }
                pos = commentEnd + 2;
                continue;
            }
            if (char === '/' && code[pos + 1] === '/') {
                const lineEnd = code.indexOf('\n', pos);
                pos = lineEnd === -1 ? spaceCheckEnd + 1 : lineEnd;
                continue;
            }
            break;
        }

        if (!hasWhitespace) {
            this.addError(parenPos, errorMessage, node, optionType);
        }
    }

    private addError(pos: number, message: string, node: ts.Node, optionType: SpaceOption): void {
        const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(pos);
        this.errors.push({
            line: line + 1,
            character: character + 1,
            endCol: character + node.getText().length + 1,
            message,
            node,
            optionType
        });
    }

    public check = (targetField: ArkFile) => {
        this.defaultOptions = this.getDefaultOption();
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = targetField.getFilePath();
        const myInvalidPositions = this.checkSpaceBeforeFunctionParen(targetField, this.defaultOptions[0]);
        const myInvalidPositionsNew = this.sortMyInvalidPositions(myInvalidPositions);
        myInvalidPositionsNew.forEach(pos => {
            this.addIssueReport(filePath, pos, severity);
        });
    }

    // 对错误位置进行排序并去重
    private sortMyInvalidPositions(myInvalidPositions: MessageInfo[]) {
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

    private getDefaultOption(): Options {
        let option: Options;
        if (this.rule && this.rule.option && this.rule.option[0]) {
            if (typeof this.rule.option[0] === 'string') {
                let optionVal = this.rule.option[0] as SpaceOption;
                return [{ anonymous: optionVal, named: optionVal, asyncArrow: optionVal }];
            } else {
                option = this.rule.option as Options;
                if (!option[0].anonymous) {
                    option[0].anonymous = 'never';
                }
                if (!option[0].named) {
                    option[0].named = 'never';
                }
                if (!option[0].asyncArrow) {
                    option[0].asyncArrow = 'never';
                }
                return option;
            }
        }
        return [{ anonymous: 'never', named: 'never', asyncArrow: 'never' }];
    }

    // 创建修复对象 
    private ruleFix(pos: number, end: number, optionType: SpaceOption): RuleFix {
        let textStr = '';
        if (optionType === 'always') {
            textStr = ' (';
        } else if (optionType === 'never') {
            let textNew = this.sourceFile.getFullText().slice(pos, end);
            if (textNew.includes('\r\n')) {
                textStr = '';
            } else {
                textStr = textNew.trim();
            }
        }
        return { range: [pos, end], text: textStr }
    }

    private addIssueReport(filePath: string, pos: MessageInfo, severity: number): void {
        // Create defect
        const defect = new Defects(
            pos.line, 
            pos.character, 
            pos.endCol, 
            pos.message, 
            severity, 
            this.rule.ruleId,
            filePath, 
            this.metaData.ruleDocPath, 
            true, 
            false, 
            true
        );
        
        // Generate fix
        const fix = this.generateFix(pos);
        
        // Add to issues collection
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    }

    private generateFix(pos: MessageInfo): RuleFix | undefined {
        // Check if the node is a function-like declaration
        if (!this.isFunctionLikeDeclaration(pos.node)) {
            return undefined;
        }
        
        // Get the positions for the fix based on option type
        const { stPos, stEnd } = pos.optionType === 'always' 
            ? this.getAlwaysFixPositions(pos.node) 
            : this.getNeverFixPositions(pos.node);
        
        // Create and return the fix
        return this.ruleFix(stPos, stEnd, pos.optionType);
    }

    private isFunctionLikeDeclaration(node: ts.Node): boolean {
        return ts.isFunctionDeclaration(node) || 
               ts.isFunctionExpression(node) || 
               ts.isArrowFunction(node) ||
               ts.isMethodDeclaration(node) || 
               ts.isGetAccessor(node) || 
               ts.isSetAccessor(node) ||
               ts.isConstructorDeclaration(node);
    }

    private getAlwaysFixPositions(node: ts.Node & { parameters?: ts.NodeArray<ts.ParameterDeclaration> }): { stPos: number, stEnd: number } {
        if (node.parameters && node.parameters.length > 0) {
            return {
                stPos: node.parameters.pos - 1,
                stEnd: node.parameters.pos
            };
        } else {
            return {
                stPos: node.parameters ? node.parameters.pos - 1 : 0,
                stEnd: node.parameters ? node.parameters.end : 0
            };
        }
    }

    private getNeverFixPositions(node: ts.Node & { 
        name?: ts.Identifier, 
        parameters?: ts.NodeArray<ts.ParameterDeclaration>,
        kind?: ts.SyntaxKind 
    }): { stPos: number, stEnd: number } {
        if (node.name) {
            return {
                stPos: node.name.end,
                stEnd: node.parameters ? node.parameters.pos - 1 : 0
            };
        } else if (node.kind === ts.SyntaxKind.Constructor) {
            return {
                stPos: node.getStart() + 'constructor'.length,
                stEnd: node.parameters ? node.parameters.pos - 1 : 0
            };
        } else if (node.getText().startsWith('async')) {
            return {
                stPos: node.getStart() + 'async'.length,
                stEnd: node.parameters ? node.parameters.pos - 1 : 0
            };
        } else if (node.kind === ts.SyntaxKind.FunctionExpression) {
            return {
                stPos: node.getStart() + 'function'.length,
                stEnd: node.parameters ? node.parameters.pos - 1 : 0
            };
        } else {
            return {
                stPos: node.parameters ? node.parameters.pos - 1 : 0,
                stEnd: node.parameters ? node.parameters.pos - 1 : 0
            };
        }
    }
}