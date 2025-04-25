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

import { ArkFile, ts, AstTreeUtils, ArkAssignStmt, Stmt, ArkNewExpr, ArkCastExpr } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnnecessaryTypeAssertionCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-unnecessary-type-assertion-check.md",
    description: "Disallow type assertions that do not change the type of an expression.",
};

interface Options {
    typesToIgnore?: string[]
}
const defaultOptions: Options = {};

// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
    fileName: string;
    line: number;
    startCol: number;
    endCol: number;
    start: number;
    end: number;
    assertionName: string;
    description: string;
}

export class NoUnnecessaryTypeAssertionCheck implements BaseChecker {

    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private options: Options = defaultOptions;
    private asRoot: ts.SourceFile;
    private filePath: string;
    private symbolTable: Map<string, ts.TypeNode> = new Map();
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }

        return [fileMatcherCb];
    }

    public check = (target: ArkFile) => {
        if (target instanceof ArkFile) {
            const code = target.getCode();
            if (!code) {
                return;
            }
            this.filePath = target.getFilePath();
            this.asRoot = AstTreeUtils.getSourceFileFromArkFile(target);
            // 构建符号表
            this.buildSymbolTable(this.asRoot);
            this.options = this.rule && this.rule.option && this.rule.option[0] ? this.rule.option[0] as Options : defaultOptions;
            const LocationInfos = this.checksNonNullExpression(this.asRoot, target);

            // 输出结果
            LocationInfos.forEach(loc => {
                this.addIssueReportNodeFix(loc, this.filePath);
            });

            const stmts = target.getDefaultClass().getDefaultArkMethod()?.getCfg()?.getStmts();
            if (!stmts) {
                return;
            }
            for (const stmt of stmts) {
                const origText = stmt.getOriginalText() ?? '';
                const sourceFile = AstTreeUtils.getASTNode('methodName', origText);
                const LocationInfos = this.checkTypeAssertion(sourceFile, stmt);

                // 输出结果
                LocationInfos.forEach(loc => {
                    this.addIssueReportNodeFix(loc, this.filePath);
                });
            }
        }
    }

    private buildSymbolTable(sourceFile: ts.SourceFile): void {
        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            if (ts.isTypeAliasDeclaration(node)) {
                const name = node.name.getText();
                const type = node.type;
                // 存储类型别名定义
                this.symbolTable.set(name, type);
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    }

    private checkTypeAssertion(sourceFile: ts.SourceFile, stmt: Stmt): LocationInfo[] {
        const locationInfos: LocationInfo[] = [];
        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            if (ts.isTypeAssertionExpression(node) || ts.isAsExpression(node)) {
                this.checkExpression(stmt, node, locationInfos);
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return locationInfos;
    }

    private checkExpression(stmt: Stmt, node: ts.Node, results: LocationInfo[]): void {
        if (stmt instanceof ArkAssignStmt) {
            const isRedundant = this.getConstrainedTypeOfArkAssignStmt(stmt, node);
            if (isRedundant) {
                this.addUnnecessaryAssertion(results, node);
            }
        }
    }

    private getConstrainedTypeOfArkAssignStmt(stmt: ArkAssignStmt, node: ts.Node): boolean {
        let nodeType = null;
        if (ts.isTypeAssertionExpression(node) || ts.isAsExpression(node)) {
            const { type } = node;
            nodeType = this.symbolTable.get(type.getText());
        }
        if (stmt.getRightOp() instanceof ArkNewExpr) {
            return false;
        }
        if (stmt.getRightOp() instanceof ArkCastExpr) {
            return false;
        }
        const rightOpType = stmt.getRightOp().getType();

        if (this.options.typesToIgnore &&
            (!this.options.typesToIgnore.includes(rightOpType.getTypeString()) ||
                !this.options.typesToIgnore.includes(nodeType?.getText() || ''))) {
            return false;
        }
        if (rightOpType.getTypeString() === 'unknown') {
            return false;
        }
        if (rightOpType.getTypeString() === 'any') {
            return false;
        }

        if (nodeType) {
            if (nodeType.getText() === rightOpType.getTypeString()) {
                return true;
            }
        }
        return false;
    }

    private checksNonNullExpression(sourceFile: ts.SourceFile, arkFile: ArkFile): LocationInfo[] {
        const locationInfos: LocationInfo[] = [];

        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            // 检查非空断言表达式
            if (ts.isNonNullExpression(node)) {
                // 首先尝试我们的全面检查方法
                this.checkAllTypesOfNonNullAssertions(node, sourceFile, locationInfos);

                //  嵌套非空断言和可选链与非空断言组合
                this.checkNestedNonNullExpression(node, sourceFile, arkFile, locationInfos);
                this.checkParenthesizedNonNullExpression(node, sourceFile, arkFile, locationInfos);
                this.checkOptionalChainingWithNonNull(node, sourceFile, arkFile, locationInfos);
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return locationInfos;
    }

    private addUnnecessaryAssertion(locationInfos: LocationInfo[], node: ts.Node): void {
        let start = 0;
        let end = 0;
        const fileText = this.asRoot.getFullText();
        const index = fileText.indexOf(node.getText());
        if (index === -1) {
            return;
        }
        const { line, character } = this.asRoot.getLineAndCharacterOfPosition(index);
        const leftKeywordLength = node.getChildAt(0).getText().length;
        const endCharacter = character + node.getText().length;

        if (ts.isAsExpression(node)) {
            start = index + leftKeywordLength;
            end = start + node.getText().length - leftKeywordLength;
        }
        if (ts.isTypeAssertionExpression(node)) {
            const typeNode = node.type;
            start = index;
            end = start + typeNode.getEnd() - typeNode.getStart() + 2;
        }

        locationInfos.push({
            fileName: this.asRoot.fileName,
            line: line + 1,
            startCol: character + 1,
            endCol: endCharacter + 1,
            start: start,
            end: end,
            assertionName: 'as',
            description: 'This assertion is unnecessary since it does not change the type of the expression.'
        });
    }
    private addNonNullExpression(locationInfos: LocationInfo[], sourceFile: ts.SourceFile, exclamationNode: ts.Expression): void {
        if (this.options.typesToIgnore && this.options.typesToIgnore.includes(exclamationNode.getText())) {
            return;
        }
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(exclamationNode.getStart());
        const endCharacter = character + exclamationNode.getWidth();
        locationInfos.push({
            fileName: sourceFile.fileName,
            line: line + 1,
            startCol: character + 1,
            endCol: endCharacter + 1,
            start: exclamationNode.getEnd(),
            end: exclamationNode.getEnd() + 1,
            assertionName: exclamationNode.getText(),
            description: 'This assertion is unnecessary since it does not change the type of the expression.'
        });
    }


    private checkNestedNonNullExpression(node: ts.NonNullExpression, sourceFile: ts.SourceFile, target: ArkFile, locationInfos: LocationInfo[]): void {
        if (ts.isNonNullExpression(node.expression)) {
            // 只有当表达式不可能为null/undefined时，才报告嵌套的非空断言错误
            // 例如：如果变量类型为 number | null，那么第一个!是必须的，但第二个!就是多余的
            // 获取最内层的表达式
            let innerExpression = node.expression.expression;
            while (ts.isNonNullExpression(innerExpression)) {
                innerExpression = innerExpression.expression;
            }

            // 检查最内层表达式是否可能为null/undefined
            if (this.isNullableExpression(innerExpression)) {
                // 如果可能为null/undefined，那么第一个!是必要的，但后续的!是多余的
                this.addNonNullExpression(locationInfos, sourceFile, node.expression);
            } else {
                // 如果不可能为null/undefined，那么所有的!都是多余的
                this.addNonNullExpression(locationInfos, sourceFile, node.expression);
            }
        }
    }

    private checkParenthesizedNonNullExpression(node: ts.NonNullExpression, sourceFile: ts.SourceFile, target: ArkFile, locationInfos: LocationInfo[]): void {
        if (ts.isParenthesizedExpression(node.expression) &&
            ts.isNonNullExpression(node.expression.expression)) {
            // 获取括号内非空断言的表达式
            let innerExpression = node.expression.expression.expression;
            while (ts.isNonNullExpression(innerExpression)) {
                innerExpression = innerExpression.expression;
            }

            // 检查最内层表达式是否可能为null/undefined
            if (this.isNullableExpression(innerExpression)) {
                // 如果可能为null/undefined，那么第一个!是必要的，但后续的!是多余的
                this.addNonNullExpression(locationInfos, sourceFile, node.expression);
            } else {
                // 如果不可能为null/undefined，那么所有的!都是多余的
                this.addNonNullExpression(locationInfos, sourceFile, node.expression);
            }
        }
    }

    private checkOptionalChainingWithNonNull(node: ts.NonNullExpression, sourceFile: ts.SourceFile, target: ArkFile, locationInfos: LocationInfo[]): void {
        let parent = node.parent;

        // 检查是否是可选参数（带有?:）的非空断言
        if (this.isOptionalParameterNonNullAssertion(node)) {
            // 如果是可选参数上的非空断言，则不报错
            return;
        }

        // 检查是否是属性访问表达式的一部分，且前面有可选链
        // 针对 obj?.bar!?.n 这种情况
        if (this.isPropertyAfterOptionalChain(node)) {
            return;
        }

        // 获取最内层表达式
        let innerExpr = node.expression;
        while (ts.isNonNullExpression(innerExpr)) {
            innerExpr = innerExpr.expression;
        }

        // 检查表达式是否可能为null/undefined
        const isNullable = this.isNullableExpression(innerExpr);

        // 对于非可选链情况，检查非空断言是否是应用在不可能为null/undefined的表达式上
        // 如果是普通非空断言（如 x!），且x不是可选参数或可空类型，则报错
        if (!isNullable) {
            this.addNonNullExpression(locationInfos, sourceFile, node.expression);
        }
    }

    // 检查表达式是否可能为null或undefined
    private isNullableExpression(expression: ts.Expression): boolean {
        // 处理括号表达式
        if (ts.isParenthesizedExpression(expression)) {
            return this.isNullableExpression(expression.expression);
        }

        // 处理非空断言表达式 - 递归检查内部表达式
        if (ts.isNonNullExpression(expression)) {
            return this.isNullableExpression(expression.expression);
        }

        // 字面量表达式（数字、字符串、布尔值）不可能为null/undefined
        if (ts.isLiteralExpression(expression)) {
            // 除了null字面量，其他字面量都不可能为null/undefined
            return expression.kind === ts.SyntaxKind.NullKeyword ||
                expression.kind === ts.SyntaxKind.UndefinedKeyword;
        }

        // 对象字面量和数组字面量不可能为null/undefined
        if (ts.isObjectLiteralExpression(expression) ||
            ts.isArrayLiteralExpression(expression)) {
            return false;
        }

        // 对于标识符，查找其声明
        if (ts.isIdentifier(expression)) {
            const identifier = expression;

            // 查找此标识符的声明
            let current: ts.Node | undefined = expression;
            while (current && current.parent) {
                current = current.parent;
                if (this.isNullableIdentifier(current, identifier)) {
                    return true;
                }
            }
        }

        // 检查属性访问表达式
        if (ts.isPropertyAccessExpression(expression)) {
            // 如果基对象可能为null/undefined，属性访问也可能为null/undefined
            return this.isNullableExpression(expression.expression);
        }

        // 默认情况，保守地认为可能为null/undefined
        return true;
    }


    private isNullableIdentifier(current: ts.Node, identifier: ts.Identifier): boolean {
        // 检查变量声明
        if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name) && current.name.text === identifier.text) {
            // 检查变量声明的类型
            if (current.type) {
                const typeText = current.type.getText();
                // 如果类型包含null、undefined或是联合类型，认为可能为null
                return typeText.includes('null') || typeText.includes('undefined') || typeText.includes('|');
            }
            // 如果没有显式类型，看初始值
            if (current.initializer) {
                // 数字、字符串、布尔值、对象字面量、数组字面量不可能为null/undefined
                if (ts.isLiteralExpression(current.initializer) && current.initializer.kind !== ts.SyntaxKind.NullKeyword &&
                    current.initializer.kind !== ts.SyntaxKind.UndefinedKeyword) {
                    return false;
                }
                // 对象字面量和数组字面量不可能为null/undefined
                if (ts.isObjectLiteralExpression(current.initializer) || ts.isArrayLiteralExpression(current.initializer)) {
                    return false;
                }
                // 检查初始值是否为null或undefined
                return current.initializer.kind === ts.SyntaxKind.NullKeyword ||
                    (ts.isIdentifier(current.initializer) && current.initializer.text === 'undefined');
            }

            // 没有类型和初始值的情况（例如：let x;）
            // 可能是undefined，因为没有初始化
            if (!current.type && !current.initializer) {
                return true;
            }

            // 如果是const声明但没有类型标注，检查初始值
            if (ts.isVariableDeclarationList(current.parent) &&
                current.parent.flags & ts.NodeFlags.Const) {
                // const变量必须有初始值，所以如果运行到这里，
                // 说明initializer的类型不是我们检查的那几种
                // 保守地认为仍然可能是nullable的
                return true;
            }
        }
        return this.isNullableIdentifierOther(current, identifier);
    }

    private isNullableIdentifierOther(current: ts.Node, identifier: ts.Identifier): boolean {
        // 检查参数声明
        if (ts.isParameter(current) && ts.isIdentifier(current.name) && current.name.text === identifier.text) {
            // 如果是可选参数，认为可能为null
            if (current.questionToken) {
                return true;
            }
            // 如果有类型标注，检查类型
            if (current.type) {
                const typeText = current.type.getText();
                return typeText.includes('null') || typeText.includes('undefined') || typeText.includes('|');
            }
        }

        // 检查导入声明
        if (ts.isImportSpecifier(current) && ts.isIdentifier(current.name) && current.name.text === identifier.text) {
            // 导入的标识符，无法确定类型，保守地认为可能为null
            return true;
        }
        return false;
    }

    // 新增方法：检查是否是可选链访问后的属性上的非空断言
    private isPropertyAfterOptionalChain(node: ts.NonNullExpression): boolean {
        // 处理node.expression是括号表达式的情况
        if (ts.isParenthesizedExpression(node.expression)) {
            // 创建一个新的非空断言节点，使用括号内的表达式
            return this.isPropertyAfterOptionalChain({
                kind: ts.SyntaxKind.NonNullExpression,
                expression: node.expression.expression
            } as ts.NonNullExpression);
        }

        // 检查表达式是否是属性访问
        if (ts.isPropertyAccessExpression(node.expression)) {
            const propAccess = node.expression;

            // 检查表达式的对象是否是括号表达式
            if (ts.isParenthesizedExpression(propAccess.expression)) {
                // 如果是括号表达式，递归检查括号内的表达式
                const innerExpr = propAccess.expression.expression;
                if (ts.isPropertyAccessExpression(innerExpr) && innerExpr.questionDotToken) {
                    return true;
                }
            }

            // 检查属性访问的对象是否有可选链
            if (ts.isPropertyAccessExpression(propAccess.expression) && propAccess.expression.questionDotToken) {
                return true;
            }
        }
        return false;
    }

    // 新增一个辅助方法来检查是否是可选参数（带有?:）上的非空断言
    private isOptionalParameterNonNullAssertion(node: ts.NonNullExpression): boolean {
        // 检查表达式是否是标识符（变量名）或者是括号表达式
        const expression = node.expression;

        // 处理括号表达式 (bar)!
        if (ts.isParenthesizedExpression(expression)) {
            // 创建一个新的NonNullExpression节点，使用括号内的表达式
            const innerExpression = expression.expression;
            // 递归检查括号内的表达式
            return this.isParameterOptional(innerExpression);
        }

        return this.isParameterOptional(expression);
    }

    // 检查表达式是否是可选参数
    private isParameterOptional(expression: ts.Expression): boolean {
        // 处理括号表达式，递归检查内部表达式
        if (ts.isParenthesizedExpression(expression)) {
            return this.isParameterOptional(expression.expression);
        }

        // 检查是否是标识符（变量名）
        if (ts.isIdentifier(expression)) {
            const identifier = expression;

            // 查找此标识符的声明
            // 遍历所有祖先节点，查找可能的参数声明
            let current: ts.Node | undefined = expression;
            while (current) {
                if (this.isParameterOptionalIdentifier(current, identifier)) {
                    return true;
                }
                current = current.parent;
            }
        }

        // 检查属性访问的情况，例如 obj.prop!?.something
        if (ts.isPropertyAccessExpression(expression)) {
            const propAccess = expression;
            if (ts.isIdentifier(propAccess.expression)) {
                // 如果属性的基对象是可选参数，也应该允许这种组合
                // 检查标识符是否是可选参数
                return this.isParameterOptional(propAccess.expression);
            }
        }

        return false;
    }

    private isParameterOptionalIdentifier(current: ts.Node, identifier: ts.Identifier): boolean {
        // 检查函数声明/表达式等
        if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) ||
            ts.isMethodDeclaration(current) || ts.isArrowFunction(current)) {
            // 检查参数列表
            for (const param of current.parameters) {
                // 检查是否是可选参数（有问号标记）
                if (param.questionToken &&
                    ts.isIdentifier(param.name) &&
                    param.name.text === identifier.text) {
                    return true;
                }

                // 检查是否有默认值（也视为可选）
                if (param.initializer &&
                    ts.isIdentifier(param.name) &&
                    param.name.text === identifier.text) {
                    return true;
                }

                // 添加对解构参数的检查
                if (ts.isObjectBindingPattern(param.name) || ts.isArrayBindingPattern(param.name)) {
                    return this.isParameterOptionalBindingPattern(param, param.name, identifier);
                }
            }
        }
        return false;
    }

    private isParameterOptionalBindingPattern(param: ts.ParameterDeclaration,
        paramName: ts.ObjectBindingPattern | ts.ArrayBindingPattern, identifier: ts.Identifier): boolean {
        for (const element of paramName.elements) {
            if (ts.isBindingElement(element) &&
                ts.isIdentifier(element.name) &&
                element.name.text === identifier.text) {
                // 如果是解构参数中的元素，并且父参数有questionToken或者有默认值，则认为是可选的
                if (param.questionToken || element.initializer || param.initializer) {
                    return true;
                }
            }
        }
        return false;
    }

    // 综合检查所有类型的非空断言
    private checkAllTypesOfNonNullAssertions(node: ts.NonNullExpression, sourceFile: ts.SourceFile,
        locationInfos: LocationInfo[]): void {
        const expression = node.expression;

        // 检查是否是可选参数加可选链的组合
        const isOptionalParamWithChaining = this.isOptionalParameterWithChaining(node);
        if (isOptionalParamWithChaining) {
            // 如果是，不报错，这是有效的组合
            return;
        }

        // 1. 直接检查各种字面量
        if (ts.isLiteralExpression(expression) &&
            expression.kind !== ts.SyntaxKind.NullKeyword &&
            expression.kind !== ts.SyntaxKind.UndefinedKeyword) {
            // 字面量上的非空断言是不必要的
            this.addNonNullExpression(locationInfos, sourceFile, expression);
            return;
        }

        // 2. 检查对象和数组字面量
        if (ts.isObjectLiteralExpression(expression) ||
            ts.isArrayLiteralExpression(expression)) {
            // 对象和数组字面量上的非空断言是不必要的
            this.addNonNullExpression(locationInfos, sourceFile, expression);
            return;
        }

        // 3. 检查二元表达式
        if (ts.isBinaryExpression(expression)) {
            // 二元表达式上的非空断言是不必要的
            this.addNonNullExpression(locationInfos, sourceFile, expression);
            return;
        }

        // 4. 检查标识符（变量名）
        if (ts.isIdentifier(expression)) {
            this.checkAllTypesOfNonNullAssertionsIdentifier(node, expression, sourceFile, locationInfos);
        }
    }

    private checkAllTypesOfNonNullAssertionsIdentifier(node: ts.NonNullExpression, expression: ts.Identifier,
        sourceFile: ts.SourceFile, locationInfos: LocationInfo[]): void {
        const identifier = expression;
        // 4.1 检查函数参数
        const paramInfo = this.findParameterInfo(identifier, sourceFile);
        if (paramInfo) {
            const { parameter, hasNonNullableType, isOptional } = paramInfo;
            // 如果是可选参数，非空断言可能是必要的，检查父节点
            if (isOptional) {
                // 如果父节点有可选链，这是一个有效的组合
                const parent = node.parent;
                const hasOptionalChaining = parent && (
                    (ts.isPropertyAccessExpression(parent) && !!parent.questionDotToken) ||
                    (ts.isElementAccessExpression(parent) && !!parent.questionDotToken) ||
                    (ts.isCallExpression(parent) && !!parent.questionDotToken)
                );
                if (hasOptionalChaining) {
                    return; // 不报错
                }
                // 即使没有可选链，可选参数上的非空断言也是有效的
                return;
            }
            // 如果参数类型不可能为 null 或 undefined，且不是可选参数，那么非空断言是不必要的
            if (hasNonNullableType) {
                this.addNonNullExpression(locationInfos, sourceFile, expression);
                return;
            }
        }
        // 4.2 检查变量声明
        const declarationInfo = this.findVariableDeclarationInfo(identifier, sourceFile);
        if (declarationInfo) {
            const { declaration, isConst, hasLiteralInitializer } = declarationInfo;
            // 如果是常量且初始化为字面量，那么非空断言是不必要的
            if (isConst && hasLiteralInitializer) {
                this.addNonNullExpression(locationInfos, sourceFile, expression);
                return;
            }
            // 如果变量有类型标注，但不包含null或undefined，那么非空断言也是不必要的
            if (declaration.type) {
                const typeText = declaration.type.getText();
                if (!typeText.includes('null') && !typeText.includes('undefined') && !typeText.includes('|')) {
                    this.addNonNullExpression(locationInfos, sourceFile, expression);
                    return;
                }
            }
        }
    }

    // 新增辅助方法：检查是否是可选参数与可选链结合的情况
    private isOptionalParameterWithChaining(node: ts.NonNullExpression): boolean {
        // 获取表达式
        let expr = node.expression;
        let identifier: ts.Identifier | null = null;

        // 处理带括号的情况，如 (bar!)?.n
        if (ts.isParenthesizedExpression(expr)) {
            expr = expr.expression;
        }

        // 获取标识符
        if (ts.isIdentifier(expr)) {
            identifier = expr;
        }

        if (!identifier) {
            return false;
        }

        // 检查是否是可选参数
        const paramInfo = this.findParameterInfo(identifier, node.getSourceFile());
        if (!paramInfo || !paramInfo.isOptional) {
            return false;
        }

        // 检查父节点是否有可选链
        const parent = node.parent;
        const hasOptionalChaining = parent && (
            (ts.isPropertyAccessExpression(parent) && !!parent.questionDotToken) ||
            (ts.isElementAccessExpression(parent) && !!parent.questionDotToken) ||
            (ts.isCallExpression(parent) && !!parent.questionDotToken)
        );

        return !!hasOptionalChaining; // 确保返回布尔值
    }


    private findParameterInfoDeclaration(node: ts.Node, current: ts.Node): boolean {
        let found = false;
        // 向上查找，确认当前标识符是否在参数的函数体内
        while (current) {
            if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) ||
                ts.isMethodDeclaration(current) || ts.isArrowFunction(current)) {
                found = this.findParameterInfoDeclarationParam(node, current);
                if (found) {
                    break;
                }
            }
            current = current.parent;
        }

        return found;
    }

    private findParameterInfoDeclarationParam(node: ts.Node,
        current: ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration | ts.ArrowFunction): boolean {
        let found = false;
        // 检查这个函数的参数中是否包含我们找到的参数
        for (const param of current.parameters) {
            if (param === node) {
                found = true;
                break;
            }
        }
        return found;
    }
    // 查找参数信息
    private findParameterInfo(identifier: ts.Identifier, sourceFile: ts.SourceFile): {
        parameter: ts.ParameterDeclaration,
        hasNonNullableType: boolean,
        isOptional: boolean
    } | null {
        // 遍历整个源文件查找参数声明
        const visit = (node: ts.Node): ts.ParameterDeclaration | undefined => {
            // 如果是参数，检查名称是否匹配
            if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === identifier.text) {

                // 检查这个参数是否属于当前的上下文
                let current: ts.Node | undefined = identifier;
                if (this.findParameterInfoDeclaration(node, current)) {
                    return node;
                }
            }

            return ts.forEachChild(node, visit);
        };

        const parameter = visit(sourceFile);

        if (!parameter) {
            return null;
        }

        // 检查参数是否是可选的
        const isOptional = !!parameter.questionToken || !!parameter.initializer;

        // 检查参数类型是否可能为 null 或 undefined
        let hasNonNullableType = false;
        if (parameter.type) {
            const typeText = parameter.type.getText();

            // 如果类型不包含 null、undefined 或联合类型，则认为是不可为空的类型
            hasNonNullableType = !typeText.includes('null') && !typeText.includes('undefined') && !typeText.includes('|');
        }

        return { parameter, hasNonNullableType, isOptional };
    }

    // 查找变量声明信息
    private findVariableDeclarationInfo(identifier: ts.Identifier, sourceFile: ts.SourceFile): {
        declaration: ts.VariableDeclaration, isConst: boolean, hasLiteralInitializer: boolean
    } | null {
        // 遍历整个源文件查找声明
        const visit = (node: ts.Node): ts.VariableDeclaration | undefined => {
            if (ts.isVariableDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === identifier.text) {
                return node;
            }

            return ts.forEachChild(node, visit);
        };

        const declaration = visit(sourceFile);

        if (!declaration) {
            return null;
        }

        // 检查是否是const声明
        const isConst = ts.isVariableDeclarationList(declaration.parent) &&
            (declaration.parent.flags & ts.NodeFlags.Const) !== 0;

        // 检查初始化器是否是字面量
        let hasLiteralInitializer = this.infoHasLiteralInitializer(declaration, sourceFile);

        return { declaration, isConst, hasLiteralInitializer };
    }

    private infoHasLiteralInitializer(declaration: ts.VariableDeclaration, sourceFile: ts.SourceFile): boolean {
        if (!declaration.initializer) {
            return false;
        }
        // 直接是字面量
        if (ts.isLiteralExpression(declaration.initializer) &&
            declaration.initializer.kind !== ts.SyntaxKind.NullKeyword &&
            declaration.initializer.kind !== ts.SyntaxKind.UndefinedKeyword) {
            return true;
        }
        // 对象或数组字面量
        else if (ts.isObjectLiteralExpression(declaration.initializer) ||
            ts.isArrayLiteralExpression(declaration.initializer)) {
            return true;
        }
        // 是另一个标识符
        else if (ts.isIdentifier(declaration.initializer)) {
            // 递归查找这个标识符的声明
            const nestedInfo = this.findVariableDeclarationInfo(declaration.initializer, sourceFile);
            if (nestedInfo && nestedInfo.isConst && nestedInfo.hasLiteralInitializer) {
                return true;
            }
        }
        return false;
    }


    // 创建修复对象 
    private ruleFix(loc: LocationInfo): RuleFix {
        return { range: [loc.start, loc.end], text: '' };
    }

    private addIssueReportNodeFix(loc: LocationInfo, filePath: string) {
        const severity = this.rule.alert ?? this.metaData.severity;
        if (loc.description) {
            this.metaData.description = loc.description;
        }
        let defect = new Defects(loc.line, loc.startCol, loc.endCol, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
        const fixKey = loc.line + ':' + loc.startCol + ':' + loc.endCol + ':' + loc.start + ':' + loc.end;
        let fix: RuleFix = this.ruleFix(loc);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    }
}