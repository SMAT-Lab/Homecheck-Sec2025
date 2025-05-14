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

import { RuleListUtil } from "../../utils/common/DefectsList";
import { ArkFile, ts } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects } from "../../model/Defects";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { AstTreeUtils } from "arkanalyzer";
import { Rule } from "../../model/Rule";
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoEmptyFunctionCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-empty-function.md",
    description: "Unexpected empty arrow function",
};

interface RuleResult {
    line: number;
    character: number;
    message: string;
    endCol: number;
}

type Options = Array<{ allow: string[] }>;

export class NoEmptyFunctionCheck implements BaseChecker {
    private defaultOptions: Options = [{
        allow: [],
    },];
    readonly metaData: BaseMetaData = gMetaData;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public rule: Rule;
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchfileBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchfileBuildCb];
    }

    public check = (targetField: ArkFile) => {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        const results = this.checkNoEmptyFunction(sourceFile);
        results.forEach(result => {
            this.addIssueReport(result.line, result.character, result.endCol, targetField.getFilePath(), result.message);
        });
    }

    private checkNoEmptyFunction(sourceFile: ts.SourceFile): RuleResult[] {
        const results: RuleResult[] = [];
        const visit = (node: ts.Node) => {
            if (
                (ts.isFunctionDeclaration(node) ||
                    ts.isFunctionExpression(node) ||
                    ts.isArrowFunction(node) ||
                    ts.isMethodDeclaration(node) ||
                    ts.isConstructorDeclaration(node) ||
                    ts.isGetAccessor(node) ||
                    ts.isSetAccessor(node))
                &&
                this.isMethodEmpty(node as ts.FunctionLikeDeclaration) &&
                !this.isAllowedEmptyFunction(node as ts.FunctionLikeDeclaration)
            ) {
                const bodyStartPos = node.body?.getStart();
                const bodyEndPos = node.body?.getEnd();
                if (!bodyStartPos) return;
                if (!bodyEndPos) return;
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(bodyStartPos);
                const { character: endChar } = sourceFile.getLineAndCharacterOfPosition(bodyEndPos);
                let message = 'Unexpected empty function';
                message = this.getErrorMessage(node);
                results.push({
                    line: line + 1,
                    character: character + 1,
                    message: message,
                    endCol: endChar + 1,
                });
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return results;
    }

    private isAsyncFunction(node: ts.Node): boolean | undefined {
        return (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
            node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword);
    }

    private isAsyncMethod(node: ts.Node): boolean | undefined {
        return ts.isMethodDeclaration(node) &&
            node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword);
    }

    private isMethodEmpty = (node: ts.FunctionLikeDeclaration): boolean | undefined => {
        if (!node.body) return true;
        const fullBodyText2 = node.body.getText();
        // 修改后的参数检查逻辑
        if (ts.isConstructorDeclaration(node) && node.parameters.length > 0) {
            const parameterString = node.parameters
                .map(param => param.getText())
                .join(', ');
            if (this.isStandaloneModifier(parameterString)) {
                return false;
            }
        }
        if (this.isCurlyBracketsEnclosed(fullBodyText2)) {
            const fullBodyText = node.body.getText();
            const startIndex = fullBodyText.indexOf('{');
            const endIndex = fullBodyText.lastIndexOf('}');
            if (startIndex === -1 || endIndex === -1) return true;
            const innerContent = fullBodyText.slice(startIndex + 1, endIndex);
            return innerContent.trim().length === 0 &&
                (ts.isBlock(node.body) ? node.body.statements.length === 0 : true);
        }
    }

    private isStandaloneModifier(str: string): boolean {
        // 使用单词边界匹配独立的关键字
        const modifierRegex = /\b(private|public|protected|readonly)\b/;
        return modifierRegex.test(str);
    }

    private isCurlyBracketsEnclosed(str: string): boolean {
        if (typeof str !== 'string' || str.length < 2) {
            return false;
        }
        return str.startsWith('{') && str.endsWith('}');
    }

    private isAllowedEmptyFunction = (node: ts.FunctionLikeDeclaration): boolean => {
        const options = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
        const allowed = options[0].allow || [];
        if (ts.isConstructorDeclaration(node)) {
            if (allowed.includes('constructors')) {
                return true;
            } else {
                const accessibility = node.modifiers?.find(modifier =>
                    modifier.kind === ts.SyntaxKind.PrivateKeyword ||
                    modifier.kind === ts.SyntaxKind.ProtectedKeyword
                );
                if (accessibility) {
                    if (
                        (accessibility.kind === ts.SyntaxKind.PrivateKeyword && allowed.includes('private-constructors')) ||
                        (accessibility.kind === ts.SyntaxKind.ProtectedKeyword && allowed.includes('protected-constructors'))
                    ) {
                        return true;
                    }
                }
            }
        }

        if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && !node.asteriskToken?.getText().includes('*') && !this.isAsyncFunction(node)) {
            if (allowed.includes('functions')) {
                return true;
            }
        }

        if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.asteriskToken?.getText().includes('*')) {
            if (allowed.includes('generatorFunctions')) {
                return true;
            }
        }

        if ((ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) && !node.asteriskToken?.getText().includes('*') && !this.isAsyncMethod(node)) {
            if (allowed.includes('methods')) {
                return true;
            }
        }

        if ((ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) && node.asteriskToken?.getText().includes('*')) {
            if (allowed.includes('generatorMethods')) {
                return true;
            }
        }

        if (ts.isMethodDeclaration(node)) {
            if (node.getText().startsWith("@") && allowed.includes('decoratedFunctions')) {
                return true;
            }
        }

        if (ts.isMethodDeclaration(node) && node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.OverrideKeyword) && allowed.includes('overrideMethods')) {
            return true;
        }

        if (this.isAsyncFunction(node)) {
            if (allowed.includes('asyncFunctions')) {
                return true;
            }
        }

        if (this.isAsyncMethod(node)) {
            if (allowed.includes('asyncMethods')) {
                return true;
            }
        }

        if (ts.isArrowFunction(node)) {
            if (allowed.includes('arrowFunctions')) {
                return true;
            }
        }

        if (ts.isGetAccessor(node)) {
            if (allowed.includes('getters')) {
                return true;
            }
        }

        if (ts.isSetAccessor(node)) {
            if (allowed.includes('setters')) {
                return true;
            }
        }
        return false;
    };

    private getErrorMessage(node: ts.Node): string {
        if (ts.isArrowFunction(node)) {
            return this.handleArrowFunction(node);
        }
        if (ts.isFunctionExpression(node)) {
            return this.handleFunctionExpression(node);
        }
        if (ts.isMethodDeclaration(node)) {
            return this.handleMethodDeclaration(node);
        }
        if (ts.isFunctionDeclaration(node)) {
            return this.handleFunctionDeclaration(node);
        }
        if (ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
            return this.handleAccessor(node);
        }
        if (ts.isConstructorDeclaration(node)) {
            return 'Unexpected empty constructor.';
        }
        return 'Unexpected empty function.';
    }

    // 辅助函数：获取静态前缀
    private getStaticPrefix(node: ts.Node): string {
        const isStatic = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword) ?? false;
        return isStatic ? 'static ' : '';
    }

    // 辅助函数：获取节点名称
    private getNameText(nameNode: ts.Node | undefined): string {
        if (!nameNode) {
            return '';
        }
        if (ts.isIdentifier(nameNode)) {
            return nameNode.text;
        }
        if (ts.isStringLiteralLike(nameNode)) {
            return nameNode.text;
        }
        if (ts.isNumericLiteral(nameNode)) {
            return nameNode.text;
        }
        if (ts.isComputedPropertyName(nameNode) && ts.isStringLiteralLike(nameNode.expression)) {
            return nameNode.expression.text;
        }
        return '';
    }

    // 处理箭头函数
    private handleArrowFunction(node: ts.ArrowFunction): string {
        const staticPrefix = this.getStaticPrefix(node);

        if (node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
            return `Unexpected empty ${staticPrefix}async arrow function.`;
        }

        if (ts.isPropertyDeclaration(node.parent) || ts.isPropertyAssignment(node.parent)) {
            const isStatic = ts.isPropertyDeclaration(node.parent)
                ? this.getStaticPrefix(node.parent)
                : '';
            const methodName = this.getNameText(node.parent.name);
            return methodName
                ? `Unexpected empty ${isStatic}method '${methodName}'.`
                : `Unexpected empty ${isStatic}method.`;
        }

        return `Unexpected empty ${staticPrefix}arrow function.`;
    }

    // 处理函数表达式
    private handleFunctionExpression(node: ts.FunctionExpression): string {
        const staticPrefix = this.getStaticPrefix(node);
        const funcName = this.getNameText(node.name);

        // 类属性中的函数表达式
        if (ts.isPropertyDeclaration(node.parent) && ts.isClassDeclaration(node.parent.parent)) {
            const isStatic = this.getStaticPrefix(node.parent);
            const methodName = this.getNameText(node.parent.name);
            return methodName
                ? `Unexpected empty ${isStatic}method '${methodName}'.`
                : `Unexpected empty ${isStatic}method.`;
        }

        // 对象字面量中的函数表达式
        if (ts.isPropertyAssignment(node.parent) && ts.isObjectLiteralExpression(node.parent.parent)) {
            const methodName = this.getNameText(node.parent.name);
            if (node.asteriskToken) {
                return methodName
                    ? `Unexpected empty generator method '${methodName}'.`
                    : `Unexpected empty generator method.`;
            }
            return methodName
                ? `Unexpected empty method '${methodName}'.`
                : `Unexpected empty method.`;
        }

        // 普通函数表达式
        if (node.asteriskToken) {
            return `Unexpected empty ${staticPrefix}generator function.`;
        }
        if (node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
            return funcName
                ? `Unexpected empty ${staticPrefix}async function '${funcName}'.`
                : `Unexpected empty ${staticPrefix}async function.`;
        }
        if (funcName) {
            return `Unexpected empty ${staticPrefix}function '${funcName}'.`;
        }

        return `Unexpected empty ${staticPrefix}function.`;
    }

    // 处理方法声明
    private handleMethodDeclaration(node: ts.MethodDeclaration): string {
        const staticPrefix = this.getStaticPrefix(node);
        const methodName = this.getNameText(node.name);

        if (node.asteriskToken) {
            return `Unexpected empty ${staticPrefix}generator method '${methodName}'.`;
        }
        if (node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
            return methodName
                ? `Unexpected empty ${staticPrefix}async method '${methodName}'.`
                : `Unexpected empty ${staticPrefix}async method.`;
        }
        return methodName
            ? `Unexpected empty ${staticPrefix}method '${methodName}'.`
            : `Unexpected empty ${staticPrefix}method.`;
    }

    // 处理函数声明
    private handleFunctionDeclaration(node: ts.FunctionDeclaration): string {
        const staticPrefix = this.getStaticPrefix(node);
        const funcName = this.getNameText(node.name);

        if (node.asteriskToken) {
            return funcName
                ? `Unexpected empty ${staticPrefix}generator function '${funcName}'.`
                : `Unexpected empty ${staticPrefix}generator function.`;
        }
        if (node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
            return funcName
                ? `Unexpected empty ${staticPrefix}async function '${funcName}'.`
                : `Unexpected empty ${staticPrefix}async function.`;
        }
        return funcName
            ? `Unexpected empty ${staticPrefix}function '${funcName}'.`
            : `Unexpected empty ${staticPrefix}function.`;
    }

    // 处理访问器
    private handleAccessor(node: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration): string {
        const staticPrefix = this.getStaticPrefix(node);
        const propertyName = this.getNameText(node.name);

        if (ts.isGetAccessor(node)) {
            return `Unexpected empty ${staticPrefix}getter '${propertyName}'.`;
        }
        return propertyName
            ? `Unexpected empty ${staticPrefix}setter '${propertyName}'.`
            : `Unexpected empty ${staticPrefix}setter.`;
    }


    private async addIssueReport(line: number, startCol: number, endCol: number, filePath: string, message: string) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const description = message;
        const defect = new Defects(line, startCol, endCol, description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined))
        RuleListUtil.push(defect);
    }
}