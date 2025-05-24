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
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { RuleFix } from '../../model/Fix';

interface Violation {
    line: number;
    character: number;
    message: string;
    suggestion: string;
    node: ts.Node
};

type Option = [{
    allowNamedFunctions?: boolean;
    allowUnboundThis?: boolean;
}];

export class PreferArrowCallbackCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/prefer-arrow-callback.md',
        description: 'Prefer arrow functions for callbacks.',
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

    private defaultOptions: Option = [{}];

    public check = (target: ArkFile): void => {
        if (target instanceof ArkFile) {
            const myInvalidPositions = this.checkAction(target);
            myInvalidPositions.forEach((violation) => {
                const filePath = target.getFilePath() ?? '';
                let defect = this.addIssueReport(violation, filePath);
                let ruleFix = this.createFix(violation?.node, violation?.suggestion);
                this.issues.push(new IssueReport(defect, ruleFix));
            });
        }
    };

    private checkAction(arkFile: ArkFile): Violation[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile); // 获取AST节点
        const violations: Violation[] = [];
        // 确保默认值不被覆盖
        const defaultOption = { allowUnboundThis: true };
        this.defaultOptions = [{
            ...defaultOption,
            ...(this.rule && this.rule.option[0] ? this.rule.option[0] : {})
        }];
        const allowNamedFunctions = this.defaultOptions[0].allowNamedFunctions === true;
        const allowUnboundThis = this.defaultOptions[0].allowUnboundThis !== false;
        // 添加对特定节点的检查日志
        this.checkNode(sourceFile, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        return violations; // 返回所有违规信息
    };

    private checkNode(
        node: ts.Node,
        violations: Violation[],
        sourceFile: ts.SourceFile,
        allowNamedFunctions: boolean,
        allowUnboundThis: boolean
    ): void {
        if (!node) {
            return;
        };

        // 特别检查Array构造函数
        if (ts.isNewExpression(node) &&
            node.expression.getText() === 'Array' &&
            node.arguments) {
            for (const arg of node.arguments) {
                if (ts.isFunctionExpression(arg)) {
                    canBeReplacedWithArrowFunction(arg, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
                }
            }
        }

        if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments) {
            for (const arg of node.arguments) {
                if (ts.isArrowFunction(arg)) {
                    continue; // 跳过箭头函数
                }
                if (ts.isConditionalExpression(arg)) {
                    // 检测三元表达式的 true 和 false 分支
                    this.checkConditionalExpression(arg, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
                } else if (ts.isBinaryExpression(arg) &&
                    (arg.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
                        arg.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) {
                    // 检测逻辑或和逻辑与表达式的左右两边
                    this.checkBinaryExpression(arg, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
                } else if (ts.isFunctionExpression(arg) || ts.isCallExpression(arg)) {
                    canBeReplacedWithArrowFunction(arg, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
                }
            }
        };
        // 递归检查子节点
        ts.forEachChild(node, (child) => {
            this.checkNode(child, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        });
    };

    private checkConditionalExpression(
        expression: ts.ConditionalExpression,
        violations: Violation[],
        sourceFile: ts.SourceFile,
        allowNamedFunctions: boolean,
        allowUnboundThis: boolean
    ): void {
        if (ts.isFunctionExpression(expression.whenTrue) || ts.isCallExpression(expression.whenTrue)) {
            canBeReplacedWithArrowFunction(expression.whenTrue, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
        if (ts.isFunctionExpression(expression.whenFalse) || ts.isCallExpression(expression.whenFalse)) {
            canBeReplacedWithArrowFunction(expression.whenFalse, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
    };

    private checkBinaryExpression(
        expression: ts.BinaryExpression,
        violations: Violation[],
        sourceFile: ts.SourceFile,
        allowNamedFunctions: boolean,
        allowUnboundThis: boolean
    ): void {
        if (ts.isFunctionExpression(expression.left) || ts.isCallExpression(expression.left)) {
            canBeReplacedWithArrowFunction(expression.left, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
        if (ts.isFunctionExpression(expression.right) || ts.isCallExpression(expression.right)) {
            canBeReplacedWithArrowFunction(expression.right, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
    };

    private addIssueReport(violation: Violation, filePath: string): Defects {
        this.metaData.description = violation.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const endCharacter = violation.node ? violation.node.getSourceFile().getLineAndCharacterOfPosition(violation.node.getEnd()).character : 0;
        const defect = new Defects(
            violation.line,
            violation.character,
            endCharacter + 1,
            this.metaData.description,
            severity,
            this.rule.ruleId,
            filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            true);
        RuleListUtil.push(defect);
        return defect;
    }

    private createFix(child: ts.Node, code: string): RuleFix {
        if (!code || code.trim() === '') {
            return { range: [child.getStart(), child.getEnd()], text: '' };
        }
        // 如果是函数表达式，使用专门的函数处理
        if (ts.isFunctionExpression(child)) {
            return this.createFixForFunctionExpression(child as ts.FunctionExpression);
        }
        // 如果不是函数表达式或无法精确定位，返回原始修复
        return { range: [child.getStart(), child.getEnd()], text: code };
    };

    /**
     * 为函数表达式创建修复
     */
    private createFixForFunctionExpression(functionExpr: ts.FunctionExpression): RuleFix {
        // 找到"function"关键字的位置
        const nodeText = functionExpr.getText();
        const functionKeywordIndex = nodeText.indexOf('function');

        if (functionKeywordIndex < 0) {
            // 如果找不到function关键字，返回空修复
            return { range: [functionExpr.getStart(), functionExpr.getEnd()], text: '' };
        }
        // 找到参数右括号的位置
        const paramsStart = nodeText.indexOf('(', functionKeywordIndex);
        const paramsEnd = nodeText.indexOf(')', paramsStart);

        if (paramsEnd <= 0) {
            // 如果找不到参数括号，返回空修复
            return { range: [functionExpr.getStart(), functionExpr.getEnd()], text: '' };
        }
        // 检查是否需要额外括号
        const needsParentheses = this.needsParenthesesForBinaryExpression(functionExpr);

        // 获取参数文本
        const params = this.extractParamsText(functionExpr);

        // 根据是否需要括号生成不同的修复
        if (needsParentheses) {
            // 提取函数体文本
            const bodyText = functionExpr.body.getText();

            // 返回完整的替换，包括外层括号
            return {
                range: [functionExpr.getStart(), functionExpr.getEnd()],
                text: `((${params}) => ${bodyText})`
            };
        } else {
            // 只替换function和参数部分
            const startPos = functionExpr.getStart() + functionKeywordIndex;
            const endPos = functionExpr.getStart() + paramsEnd + 1; // +1 包括右括号
            return { range: [startPos, endPos], text: `(${params}) =>` };
        }
    };

    /**
     * 提取函数参数文本
     */
    private extractParamsText(functionExpr: ts.FunctionExpression): string {
        return functionExpr.parameters.map(p => p.name.getText()).join(', ');
    };

    /**
     * 检查函数表达式是否在二元表达式中需要额外括号
     */
    private needsParenthesesForBinaryExpression(node: ts.Node): boolean {
        let parent = node.parent;
        // 检查父节点是否为二元表达式（如 ||、&&）
        if (parent && ts.isBinaryExpression(parent)) {
            return true;
        }
        // 其他情况不需要括号
        return false;
    };
}

// 检查函数是否可以替换为箭头函数
function canBeReplacedWithArrowFunction(
    node: ts.FunctionExpression | ts.CallExpression,
    violations: Violation[],
    sourceFile: ts.SourceFile,
    allowNamedFunctions: boolean,
    allowUnboundThis: boolean): void {
    if (ts.isFunctionExpression(node)) {
        const paramNames = node.parameters.map(param => param.name.getText());
        if (new Set(paramNames).size !== paramNames.length) {
            return;
        }
        if (allowNamedFunctions && node.name) {
            return;
        }

        if (hasArgumentsOrNewTarget(node) || node.asteriskToken !== undefined || isRecursiveFunction(node)) {
            return;
        }
        // 检查函数体中的 this 使用情况
        checkFunctionBody(node, allowUnboundThis, sourceFile, violations, node.body);

        // 递归检查函数体中的函数表达式
        if (node.body) {
            checkNestedFunctionsInBody(node.body, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
    }
    if (ts.isCallExpression(node)) {
        // 检查是否是 .bind() 调用
        checkBindCall(node, allowUnboundThis, sourceFile, violations, allowNamedFunctions);

        // 检查参数中的函数表达式
        if (node.arguments) {
            checkFunctionsInArguments(node.arguments, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
    }
};

/**
 * 递归检查函数体中的函数表达式
 */
function checkNestedFunctionsInBody(
    body: ts.Block,
    violations: Violation[],
    sourceFile: ts.SourceFile,
    allowNamedFunctions: boolean,
    allowUnboundThis: boolean
): void {
    ts.forEachChild(body, (child) => {
        if (ts.isCallExpression(child) && child.arguments) {
            processCallExpressionArguments(child.arguments, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
    });
}

/**
 * 处理调用表达式中的参数
 */
function processCallExpressionArguments(
    args: readonly ts.Expression[],
    violations: Violation[],
    sourceFile: ts.SourceFile,
    allowNamedFunctions: boolean,
    allowUnboundThis: boolean
): void {
    for (const arg of args) {
        if (ts.isFunctionExpression(arg)) {
            canBeReplacedWithArrowFunction(arg, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
    }
}

/**
 * 检查参数数组中的函数表达式
 */
function checkFunctionsInArguments(
    args: readonly ts.Expression[],
    violations: Violation[],
    sourceFile: ts.SourceFile,
    allowNamedFunctions: boolean,
    allowUnboundThis: boolean
): void {
    for (const arg of args) {
        if (ts.isFunctionExpression(arg)) {
            canBeReplacedWithArrowFunction(arg, violations, sourceFile, allowNamedFunctions, allowUnboundThis);
        }
    }
}

// 检查 .bind() 调用的逻辑
function checkBindCall(
    node: ts.CallExpression,
    allowUnboundThis: boolean,
    sourceFile: ts.SourceFile,
    violations: Violation[],
    allowNamedFunctions: boolean
): void {
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'bind') {
        const functionExpression = node.expression.expression;
        const originalFunctionExpression = findOriginalFunctionExpression(functionExpression);
        if (!originalFunctionExpression) {
            return;
        }
        if (hasArgumentsOrNewTarget(node)) {
            return;
        }
        if (ts.isPropertyAccessExpression(node.expression.name.parent)) {
            if (node.expression.name.parent) {
                isProperty(
                    node,
                    node.expression.name.parent,
                    functionExpression,
                    sourceFile, violations,
                    allowUnboundThis,
                    originalFunctionExpression,
                    allowNamedFunctions);
            }
        }
    }
};

function isProperty(
    node: ts.CallExpression,
    aa: ts.PropertyAccessExpression,
    functionExpression: ts.Node,
    sourceFile: ts.SourceFile,
    violations: Violation[],
    allowUnboundThis: boolean,
    originalFunctionExpression: ts.FunctionExpression | ts.ArrowFunction,
    allowNamedFunctions: boolean
): void {
    let bindArguments = (aa.expression as ts.CallExpression).arguments ?? [];
    if (bindArguments[0] === undefined) {
        if (node.arguments.length > 1) {
            if (ts.isFunctionExpression(functionExpression)) {
                checkCallExpressionBody(node, sourceFile, violations, allowUnboundThis, functionExpression);
            }
        } else {
            handleBindArgument(node, sourceFile, violations, allowUnboundThis, originalFunctionExpression, functionExpression, allowNamedFunctions);
        }
    } else {
        handleSingleBindArgument(node, sourceFile, violations, allowUnboundThis, originalFunctionExpression, bindArguments[0], allowNamedFunctions);
    }
}

// 处理单个 bind 参数的情况
function handleSingleBindArgument(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    violations: Violation[],
    allowUnboundThis: boolean,
    originalFunctionExpression: ts.FunctionExpression | ts.ArrowFunction,
    bindArguments: ts.Expression,
    allowNamedFunctions: boolean
): void {
    // 检查原始函数是否为命名函数，如果允许命名函数且当前函数有名称，则跳过告警
    if (allowNamedFunctions && originalFunctionExpression && ts.isFunctionExpression(originalFunctionExpression) && originalFunctionExpression.name) {
        return;
    }

    if (bindArguments?.getText().includes('this')) {
        addViolation(node, sourceFile, violations, convertToArrowFunction(originalFunctionExpression, node));
    } else {
        if (originalFunctionExpression && ts.isFunctionExpression(originalFunctionExpression)) {
            checkCallExpressionBody(node, sourceFile, violations, allowUnboundThis, originalFunctionExpression);
        }
    }
}

// 检查函数体中的 this 使用情况
function checkFunctionBody(
    node: ts.FunctionExpression,
    allowUnboundThis: boolean,
    sourceFile: ts.SourceFile,
    violations: Violation[],
    functionBody: ts.Block
): void {
    if (functionBody === undefined) {
        addViolation(node, sourceFile, violations, convertToFunction(node));
        return;
    } else {
        const thisUsage = findThisUsage(functionBody);
        if (!thisUsage) {
            // 函数体中没有使用 `this`，告警
            addViolation(node, sourceFile, violations, convertToFunction(node));
            return;
        } else {
            handleThisUsage(node, thisUsage, allowUnboundThis, sourceFile, violations);
        }
    };
};

// 检查函数体中的 this 使用情况
function checkCallExpressionBody(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    violations: Violation[],
    allowUnboundThis: boolean,
    functionExpression: ts.FunctionExpression | ts.ArrowFunction
): void {
    const functionBody = functionExpression.body;
    if (functionBody === undefined) {
        addViolation(node, sourceFile, violations, convertToArrowFunction(functionExpression, node));
    } else {
        const thisUsage = findThisUsage(functionBody);
        if (!thisUsage) {
            addViolation(node, sourceFile, violations, convertToArrowFunction(functionExpression, node));
        } else {
            handleCallThisUsage(node, allowUnboundThis, sourceFile, violations, thisUsage, functionExpression);
        }
    }
};

// 处理 this 使用情况的逻辑
function handleThisUsage(
    node: ts.FunctionExpression,
    thisUsage: { type: string; node?: ts.Node },
    allowUnboundThis: boolean,
    sourceFile: ts.SourceFile,
    violations: Violation[]
): void {
    // 函数体中使用了 `this`，根据 `this` 的类型判断是否告警
    if (thisUsage.type === 'ArrowFunction' || thisUsage.type === 'ReturnStatement' || thisUsage.type === 'DirectThis') {
        if (allowUnboundThis) {
            // 如果 `this` 在箭头函数或 return 语句中，不告警 // 如果 `this` 是直接在函数体中使用的，不告警
            return;
        } else {
            // 如果 `this` 在普通函数表达式中，告警
            addViolation(node, sourceFile, violations, convertToFunction(node));
        }
    } else if (thisUsage.type === 'FunctionExpression') {
        // 如果 `this` 在普通函数表达式中，告警
        addViolation(node, sourceFile, violations, convertToFunction(node));
    } else if (thisUsage.type === 'CallExpression') {
        // 当allowUnboundThis为false时，应该告警
        if (!allowUnboundThis) {
            addViolation(node, sourceFile, violations, convertToFunction(node));
            return;
        }

        // 检查是否绑定了this 
        const hasBindWithThis = (thisUsage.node as ts.CallExpression)?.arguments.some((arg: ts.Node) => arg.kind === ts.SyntaxKind.ThisKeyword);
        if (!hasBindWithThis) {
            // 如果没有绑定 this，告警
            addViolation(node, sourceFile, violations, convertToFunction(node));
        }
    }
};

// 处理 this 使用情况的逻辑
function handleCallThisUsage(
    node: ts.CallExpression,
    allowUnboundThis: boolean,
    sourceFile: ts.SourceFile,
    violations: Violation[],
    thisUsage: { type: string; node?: ts.Node },
    functionExpression: ts.FunctionExpression | ts.ArrowFunction
): void {
    // 函数体中使用了 `this`，根据 `this` 的类型判断是否告警
    if (thisUsage.type === 'ArrowFunction' || thisUsage.type === 'ReturnStatement' || thisUsage.type === 'DirectThis') {
        if (allowUnboundThis) {
            // 如果 `this` 在箭头函数或 return 语句中，不告警 // 如果 `this` 是直接在函数体中使用的，不告警
            return;
        } else {
            // 如果 `this` 在普通函数表达式中，告警
            addViolation(node, sourceFile, violations, convertToArrowFunction(functionExpression, node));
        }
    } else if (thisUsage.type === 'FunctionExpression') {
        // 如果 `this` 在普通函数表达式中，告警
        addViolation(node, sourceFile, violations, convertToArrowFunction(functionExpression, node));
    } else if (thisUsage.type === 'CallExpression') {
        // 如果 `this` 在 CallExpression 中，检查是否绑定了 this
        const hasBindWithThis = (thisUsage.node as ts.CallExpression)?.arguments.some((arg: ts.Node) => arg.kind === ts.SyntaxKind.ThisKeyword);
        if (!hasBindWithThis) {
            // 如果没有绑定 this，告警
            addViolation(node, sourceFile, violations, convertToArrowFunction(functionExpression, node));
        }
    }
};

// 查找函数体中 this 的使用情况
function findThisUsage(node: ts.Node): { type: string; node?: ts.Node } | null {
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
        return { type: 'DirectThis', node };
    }

    // 先检查子节点，递归查找直接 this 使用
    for (const child of node.getChildren()) {
        if (child.kind === ts.SyntaxKind.ThisKeyword) {
            return { type: 'DirectThis', node: child };
        }
    }

    if (ts.isArrowFunction(node)) {
        const thisUsage = ts.forEachChild(node, findThisUsage);
        if (thisUsage) {
            return { type: 'ArrowFunction', node };
        }
    }
    if (ts.isReturnStatement(node)) {
        const thisUsage = node.expression ? findThisUsage(node.expression) : null;
        if (thisUsage) {
            return { type: 'ReturnStatement', node };
        }
    }
    if (ts.isFunctionExpression(node)) {
        return { type: 'FunctionExpression', node };
    }
    if (ts.isCallExpression(node)) {
        const thisUsage = ts.forEachChild(node, findThisUsage);
        if (thisUsage) {
            return { type: 'CallExpression', node };
        }
    }
    if (ts.isBlock(node)) {
        for (const child of node.statements) {
            const thisUsage = findThisUsage(child);
            if (thisUsage) {
                return thisUsage;
            }
        }
    }
    return ts.forEachChild(node, findThisUsage) ?? null;
};

// 转换为普通函数的字符串表示
function convertToFunction(node: ts.FunctionExpression): string {
    const paramsText = node.parameters.map(param => {
        if (ts.isParameterPropertyDeclaration(param, node.parent)) {
            return param.getText();
        } else {
            return param.name.getText() + (param.initializer ? ` = ${param.initializer.getText()}` : '');
        }
    }).join(', ');

    let bodyText = `${node.body.getText()}`;
    return `(${paramsText}) => ${bodyText}`;
};

// 转换为箭头函数的字符串表示
function convertToArrowFunction(node: ts.FunctionExpression | ts.ArrowFunction, originNode: ts.Node): string {
    // 提取函数参数
    const paramsText = node.parameters.map(param => {
        if (ts.isParameterPropertyDeclaration(param, node.parent)) {
            return param.getText();
        } else {
            return param.name.getText() + (param.initializer ? ` = ${param.initializer.getText()}` : '');
        }
    }).join(', ');
    // 提取函数体 - 但不处理函数体内的嵌套函数
    let bodyText = node.body.getText();
    // 处理可能存在的.bind调用
    const bindRegex = /\.bind\([^)]+\)/g;
    const bindMatches = originNode.getText().match(bindRegex);
    const isInBinaryExpression = originNode.parent && ts.isBinaryExpression(originNode.parent);

    // 生成箭头函数字符串
    let result;
    if (bindMatches) {
        const firstBind = bindMatches[0];
        const isFirstBindThis = firstBind.includes('.bind(this)');
        const bindParts = isFirstBindThis ? bindMatches.slice(1) : bindMatches;
        const bindString = bindParts.join('');
        result = `(${paramsText}) => ${bodyText}${bindString}`;
    } else {
        result = `(${paramsText}) => ${bodyText}`;
    }
    if (isInBinaryExpression) {
        result = `(${result})`;
    }

    return result;
}

// 只检查是否包含 arguments 或 new.target，不检查 this
function hasArgumentsOrNewTarget(node: ts.Node): boolean {
    if (ts.isIdentifier(node) && node.text === 'arguments') {
        return true;
    }
    if (ts.isMetaProperty(node) && node.getText() === 'new.target') {
        return true;
    }
    return ts.forEachChild(node, hasArgumentsOrNewTarget) ?? false;
};

// 检查是否是递归函数
function isRecursiveFunction(node: ts.FunctionExpression): boolean {
    const functionName = node.name?.getText();
    if (!functionName) {
        return false;
    }
    const bodyText = node.body?.getText();
    return bodyText?.includes(functionName);
};

// 解析嵌套的 .bind() 调用，找到最初的函数表达式
function findOriginalFunctionExpression(node: ts.Node): ts.FunctionExpression | ts.ArrowFunction | undefined {
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        return node;
    } else if (ts.isCallExpression(node)) {
        return findOriginalFunctionExpression(node.expression);
    } else if (ts.isPropertyAccessExpression(node)) {
        return findOriginalFunctionExpression(node.expression);
    } else if (ts.isParenthesizedExpression(node)) {
        return findOriginalFunctionExpression(node.expression);
    } else {
        return undefined;
    }
};

// 添加违规记录
function addViolation(
    node: ts.FunctionExpression | ts.CallExpression,
    sourceFile: ts.SourceFile,
    violations: Violation[],
    suggestion?: string
): void {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    // 如果没有提供建议或建议为空，尝试生成一个有效的建议
    if (!suggestion || suggestion.trim() === '') {
        if (ts.isFunctionExpression(node)) {
            // 检查是否在二元表达式中 - 只有二元表达式需要额外括号
            let needsParentheses = false;
            let parent = node.parent;
            // 检查父节点是否为二元表达式（如 ||、&&）
            if (parent && ts.isBinaryExpression(parent)) {
                needsParentheses = true;
            }
            // 条件表达式（三元运算符）不需要额外的括号
            // 提取参数
            const params = node.parameters.map(p => p.name.getText()).join(', ');
            // 生成建议文本
            if (needsParentheses) {
                // 需要额外括号的情况 - 二元表达式
                const bodyText = node.body.getText();
                suggestion = `((${params}) => ${bodyText})`;
            } else {
                // 基本情况
                suggestion = `(${params}) =>`;
            }
        }
    }
    const violation: Violation = {
        message: 'Unexpected function expression',
        line: line + 1,
        character: character + 1,
        suggestion: suggestion || '',
        node: node
    };
    violations.push(violation);
};

// 处理单个 bind 参数的情况
function handleBindArgument(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    violations: Violation[],
    allowUnboundThis: boolean,
    originalFunctionExpression: ts.FunctionExpression | ts.ArrowFunction,
    functionExpression: ts.Node,
    allowNamedFunctions: boolean
): void {
    // 检查原始函数是否为命名函数，如果允许命名函数且当前函数有名称，则跳过告警
    if (allowNamedFunctions && originalFunctionExpression && ts.isFunctionExpression(originalFunctionExpression) && originalFunctionExpression.name) {
        return;
    }
    if (node.arguments[0].getText().includes('this')) {
        addViolation(node, sourceFile, violations, convertToArrowFunction(originalFunctionExpression, node));
    } else {
        if (ts.isFunctionExpression(functionExpression)) {
            // 检查函数体中是否使用了 `this`
            checkCallExpressionBody(node, sourceFile, violations, allowUnboundThis, functionExpression);
        }
    }
}
