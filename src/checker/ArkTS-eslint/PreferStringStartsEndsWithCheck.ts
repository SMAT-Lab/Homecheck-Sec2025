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
import { ArkAssignStmt, ArkFile, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkInvokeStmt, Constant, Local, Stmt, ts, Value } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects, IssueReport } from "../../model/Defects";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { AstTreeUtils } from "arkanalyzer";
import { Rule } from "../../model/Rule";
import { RuleFix } from '../../model/Fix';
import { StringConstant } from "arkanalyzer/lib/core/base/Constant";
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PreferStringStartsRndsWith');

interface LocationInfo {
    line: number;
    character: number;
    startCol: number;
    endCol: number;
    isStartWith: boolean,
    methodName: string,
    testObjectText?: string;
    textEExpectedStr?: string;
}

export class PreferStringStartsEndsWithCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public filePath: string;
    public fileSourceFile: ts.SourceFile;
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/prefer-string-starts-ends-with.md',
        description: "Use 'String#startsWith' method instead.",
    };
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private stmts: Stmt[] = [];
    private processedLocations: Set<string> = new Set();
    private astCache: Map<string, ts.SourceFile> = new Map();
    private methodNameCache: Map<ts.Expression, string | undefined> = new Map();
    private stringContextCache: Map<string, boolean> = new Map();

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatcher];
    }

    public check = (target: ArkFile) => {
        this.initializeCheckContext(target);
        const [validStmts, record] = this.collectValidStatements(target);
        this.processValidStatements(validStmts, record);
    }

    private initializeCheckContext(target: ArkFile): void {
        if (target instanceof ArkFile) {
            this.filePath = target.getFilePath();
            this.fileSourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
        }
        this.processedLocations.clear();
        this.astCache.clear();
        this.methodNameCache.clear();
        this.stringContextCache.clear();
    }

    private collectValidStatements(target: ArkFile): [Set<Stmt>, Map<string, string>] {
        const record = new Map<string, string>();
        const validStmts = new Set<Stmt>();

        target.getClasses().flatMap(clazz =>
            clazz.getMethods().flatMap(method =>
                method?.getBody()?.getCfg().getStmts() ?? []
            )
        ).filter(stmt => {
            if (stmt === undefined) {
                return false;
            }
            this.stmts.push(stmt);
            const originText = stmt.getOriginalText() ?? '';
            return this.shouldCheckStatement(originText);
        }).forEach(stmt => {
            const position = stmt.getOriginPositionInfo();
            const key = `${position.getLineNo()}:${position.getColNo()}`;
            if (!record.has(key)) {
                validStmts.add(stmt);
                record.set(key, stmt.getOriginalText() ?? '');
            }
        });

        return [validStmts, record];
    }


    private processValidStatements(validStmts: Set<Stmt>, record: Map<string, string>): void {
        validStmts.forEach(stmt => {
            const position = stmt.getOriginPositionInfo();
            const originText = record.get(`${position.getLineNo()}:${position.getColNo()}`);
            originText && this.PreferStringStartsEndsWithCheck(originText, stmt);
        });
    }
    private shouldCheckStatement(text: string): boolean {
        const keywords = [
            'charAt', 'indexOf', 'lastIndexOf', 'slice',
            'substring', 'match', 'test', 'startsWith',
            'endsWith', '[0]', 'length - 1'
        ];
        return keywords.some(keyword => text.includes(keyword));
    }

    private getMethodName(expression: ts.LeftHandSideExpression): string | undefined {
        if (this.methodNameCache.has(expression)) {
            return this.methodNameCache.get(expression);
        }
        let result: string | undefined;
        if (expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const propertyAccess = expression as ts.PropertyAccessExpression;
            result = propertyAccess.name.getText();
        } else if (expression.kind === ts.SyntaxKind.ElementAccessExpression) {
            const elementAccess = expression as ts.ElementAccessExpression;
            const argument = elementAccess.argumentExpression;
            if (argument.kind === ts.SyntaxKind.NumericLiteral) {
                result = (argument as ts.NumericLiteral).text;
            }
        }
        this.methodNameCache.set(expression, result);
        return result;
    }

    private isStringContext(node: ts.Expression | undefined, stmt: Stmt, methodName: string): boolean {
        if (!node) {
            return false;
        }
        const cacheKey = `${node.getText()}_${methodName}_${stmt.getOriginalText()}`;
        if (this.stringContextCache.has(cacheKey)) {
            return this.stringContextCache.get(cacheKey)!;
        }
        let isString = false;
        if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp();
            if (rightOp instanceof ArkInstanceFieldRef) {
                if (rightOp.getBase().getType().getTypeString() === ('string'))
                    isString = true;
            }
        }

        if (methodName === 'charAt' || methodName === 'indexOf' || methodName === 'lastIndexOf' ||
            methodName === 'slice' || methodName === 'substring' || methodName === 'match') {
            let retuenValue = this.getObjectExpressionType(stmt);

            isString = retuenValue === ('string') || this.isAllQuotedSegments(retuenValue);
        }

        if (stmt.getOriginalText()?.startsWith('this')) {
            if (stmt instanceof ArkAssignStmt) {
                let leftOp = stmt.getLeftOp().getType().getTypeString();
                if (leftOp === ('string') || this.isAllQuotedSegments(leftOp)) {
                    isString = true;
                }
            }
        }
        this.stringContextCache.set(cacheKey, isString);
        return isString;
    }

    private isAllQuotedSegments(input: string): boolean {
        return input.split('|')
            .map(s => s.trim())
            .every(segment => {
                return (segment.startsWith('"') && segment.endsWith('"')) ||
                    (segment.startsWith("'") && segment.endsWith("'"));
            });
    }
    getObjectExpressionType(stmt: Stmt): string {
        if (stmt instanceof ArkAssignStmt) {
            let leftOp = stmt.getLeftOp();
            let rightOp = stmt.getRightOp();
            if (rightOp instanceof ArkInstanceInvokeExpr) {
                let invokeExpr = rightOp.getBase();
                if (invokeExpr instanceof Local) {
                    let type = invokeExpr.getType().getTypeString();
                    return type;
                }
            } else {
                return this.getType(leftOp);
            }
        }
        return 'unknown';
    }
    getType(stmt: Stmt | Value, count: number = 0): string {
        if (count > 10 || !(stmt instanceof Local)) {
            return 'unknown';
        }
        count++;
        const used = stmt.getUsedStmts()[0];
        if (!(used instanceof ArkAssignStmt)) {
            return 'unknown';
        }

        // 处理右操作数中的调用表达式
        const rightOpType = this.checkRightOp(used.getRightOp());
        if (rightOpType !== 'unknown') {
            return rightOpType;
        }

        // 递归处理左操作数
        return this.getType(used.getLeftOp(), count);
    }

    private checkRightOp(rightOp: Value): string {
        if (!(rightOp instanceof ArkInstanceInvokeExpr)) {
            return 'unknown';
        }

        const base = rightOp.getBase();
        return base instanceof Local ?
            base.getType().getTypeString() :
            'unknown';
    }

    private checkLeftOp(leftOp: Value): string {
        return this.getType(leftOp);
    }
    public PreferStringStartsEndsWithCheck(string: string, stmt: Stmt): LocationInfo[] {
        if (!string || string.length === 0) {
            return [];
        }
        const sourceFile = this.getOrCreateAstSourceFile(string);
        const results: LocationInfo[] = [];
        const visitedNodes = new Set<ts.Node>();
        const visit = (node: ts.Node): void => {
            if (visitedNodes.has(node)) {
                return;
            }
            visitedNodes.add(node);
            if (ts.isCallExpression(node)) {
                this.processCallExpression(node, stmt);
            }
            if (ts.isBinaryExpression(node)) {
                this.processBinaryExpression(node, stmt, sourceFile);
            }
            ts.forEachChild(node, visit);
        };

        ts.forEachChild(sourceFile, visit);
        return results;
    }

    private getOrCreateAstSourceFile(string: string): ts.SourceFile {
        const cacheKey = string;
        let sourceFile: ts.SourceFile;
        if (this.astCache.has(cacheKey)) {
            sourceFile = this.astCache.get(cacheKey)!;
        } else {
            sourceFile = AstTreeUtils.getASTNode('', string);
            this.astCache.set(cacheKey, sourceFile);
            if (this.astCache.size > 1000) {
                const firstKey = Array.from(this.astCache.keys())[0];
                if (firstKey) {
                    this.astCache.delete(firstKey);
                }
            }
        }
        return sourceFile;
    }

    private processCallExpression(node: ts.CallExpression, stmt: Stmt): void {
        const expression = node.expression;
        if (this.isStartsWithOrEndsWithCall(expression)) {
            const object = this.getObjectExpression(expression);
            if (this.isStringContext(object, stmt, '')) {
                return;
            }
        }
        const methodName = this.getMethodName(expression);
        if (methodName === 'test') {
            this.processTestMethod(node, stmt);
        }
    }

    private processTestMethod(node: ts.CallExpression, stmt: Stmt): void {
        const expression = node.expression;
        const args = node.arguments;
        if (args.length === 0) {
            return;
        }
        const testCallObject = args[0].getText();
        if (!ts.isPropertyAccessExpression(expression)) {
            return;
        }
        const propertyAccess = expression as ts.PropertyAccessExpression;
        if (ts.isRegularExpressionLiteral(propertyAccess.expression)) {
            this.processRegexLiteral(node, propertyAccess.expression, stmt, testCallObject);
        } else if (ts.isIdentifier(propertyAccess.expression)) {
            this.processRegexVariable(node, propertyAccess.expression, stmt, testCallObject);
        }
    }

    private processRegexLiteral(node: ts.CallExpression, regexLiteral: ts.RegularExpressionLiteral, stmt: Stmt, testCallObject: string): void {
        const regexText = regexLiteral.getText().slice(1, -1);
        const isSimplePattern = this.isSimpleStartsWithOrEndsWithPattern(regexText);

        if (isSimplePattern.isStartsWith) {
            const expectedStr = regexText
                .replace(/^\^/, '')
                .replace(/\\\//g, '/')
                .replace(/\\/g, '');
            this.addResult(node, true, 'test', stmt, testCallObject, expectedStr);
        }
        else if (isSimplePattern.isEndsWith) {
            const expectedStr = regexText
                .replace(/\$$/, '')
                .replace(/\\\//g, '/')
                .replace(/\\/g, '');
            this.addResult(node, false, 'test', stmt, testCallObject, expectedStr);
        }
    }

    private isSimpleStartsWithOrEndsWithPattern(pattern: string): { isStartsWith: boolean; isEndsWith: boolean } {
        const isStartsWith = pattern.startsWith('^') &&
            !pattern.includes('$') &&
            !this.containsComplexRegexSyntax(pattern.slice(1));

        const isEndsWith = pattern.endsWith('$') &&
            !pattern.includes('^') &&
            !this.containsComplexRegexSyntax(pattern.slice(0, -1));

        return { isStartsWith, isEndsWith };
    }

    private containsComplexRegexSyntax(pattern: string): boolean {
        // 检查是否包含任何正则表达式特殊语法
        return /[\\[\]|()*+?{}.]/.test(pattern);
    }
    private processRegexVariable(node: ts.CallExpression, regexVar: ts.Identifier, stmt: Stmt, testCallObject: string): void {
        let currentBlock = regexVar.parent;
        while (currentBlock && !ts.isBlock(currentBlock) && !ts.isSourceFile(currentBlock)) {
            currentBlock = currentBlock.parent;
        }
        const resolved = this.resolveVariableInitializer(regexVar.text, currentBlock);
        if (resolved.value) {
            const regexText = resolved.value
                .replace(/^\/|\/$/g, '')
                .replace(/\\\//g, '/');

            const isSimplePattern = this.isSimpleStartsWithOrEndsWithPattern(regexText);

            if (isSimplePattern.isStartsWith) {
                const expectedStr = regexText
                    .replace(/^\^/, '')
                    .replace(/\\\//g, '/')
                    .replace(/\\/g, '');
                this.addResult(node, true, 'test', stmt, testCallObject, expectedStr);
            }
            else if (isSimplePattern.isEndsWith) {
                const expectedStr = regexText
                    .replace(/\$$/, '')
                    .replace(/\\\//g, '/')
                    .replace(/\\/g, '');
                this.addResult(node, false, 'test', stmt, testCallObject, expectedStr);
            }
        }
    }

    private processBinaryExpression(node: ts.BinaryExpression, stmt: Stmt, sourceFile: ts.SourceFile): void {
        const left = node.left;
        const right = node.right;
        this.processElementAccessExpression(node, left, right, stmt);
        if (ts.isCallExpression(left)) {
            this.processCallExpressionInBinary(node, left, right, stmt, sourceFile);
        }
    }

    private processElementAccessExpression(node: ts.BinaryExpression, left: ts.Expression, right: ts.Expression, stmt: Stmt): void {
        const validOperators = [
            ts.SyntaxKind.EqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            ts.SyntaxKind.ExclamationEqualsToken,
            ts.SyntaxKind.ExclamationEqualsEqualsToken
        ];

        if (validOperators.includes(node.operatorToken.kind) && ts.isElementAccessExpression(left)) {
            const elementAccess = left as ts.ElementAccessExpression;
            const object = this.getObjectExpression(elementAccess);
            const indexArgument = elementAccess.argumentExpression;
            if (ts.isNumericLiteral(indexArgument) && indexArgument.text === '0') {
                if (this.isStringContext(object, stmt, 'noName')) {
                    this.addResult(node, true, 'noName', stmt, object?.getText(), right.getText());
                }
            }
            else if (ts.isBinaryExpression(indexArgument)) {
                this.processLengthMinusOneExpression(node, indexArgument, object, stmt, right);
            }
        }
    }

    private processLengthMinusOneExpression(node: ts.BinaryExpression, indexExpr: ts.BinaryExpression,
        object: ts.Expression | undefined, stmt: Stmt, right: ts.Expression): void {
        if (indexExpr.operatorToken.kind === ts.SyntaxKind.MinusToken &&
            ts.isPropertyAccessExpression(indexExpr.left) &&
            indexExpr.left.name.text === 'length' &&
            ts.isIdentifier(indexExpr.left.expression) &&
            indexExpr.left.expression.text === object?.getText() &&
            ts.isNumericLiteral(indexExpr.right) &&
            indexExpr.right.text === '1') {
            if (this.isStringContext(object, stmt, 'noName')) {
                this.addResult(node, false, 'noName', stmt, object?.getText(), right.getText());
            }
        }
    }

    private processCallExpressionInBinary(node: ts.BinaryExpression, left: ts.CallExpression,
        right: ts.Expression, stmt: Stmt, sourceFile: ts.SourceFile): void {
        const callExpression = left;
        if (callExpression.arguments.length < 1) {
            return;
        }
        const expression = callExpression.expression;
        const objExpression = this.getObjectExpression(expression);
        const methodName = this.getMethodName(expression);
        switch (methodName) {
            case 'charAt':
                this.processCharAtMethod(node, callExpression, objExpression, right, stmt, sourceFile);
                break;
            case 'indexOf':
                this.processIndexOfMethod(node, callExpression, objExpression, stmt);
                break;
            case 'lastIndexOf':
                this.processLastIndexOfMethod(node, callExpression, objExpression, stmt);
                break;
            case 'slice':
                this.processSliceMethod(node, callExpression, objExpression, right, stmt);
                break;
            case 'substring':
                this.processSubstringMethod(node, callExpression, objExpression, right, stmt);
                break;
            case 'match':
                this.processMatchMethod(node, callExpression, objExpression, stmt);
                break;
        }
    }

    private processCharAtMethod(node: ts.BinaryExpression, callExpression: ts.CallExpression,
        objExpression: ts.Expression | undefined, right: ts.Expression, stmt: Stmt, sourceFile: ts.SourceFile): void {
        if (!this.isStringContext(objExpression, stmt, 'charAt')) {
            return;
        }
        const isComparison = [
            ts.SyntaxKind.EqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            ts.SyntaxKind.ExclamationEqualsToken,
            ts.SyntaxKind.ExclamationEqualsEqualsToken
        ].includes(node.operatorToken.kind);
        const indexArgument = callExpression.arguments[0];
        if (isComparison && indexArgument && ts.isNumericLiteral(indexArgument) && indexArgument.text === '0') {
            this.addResult(node, true, 'charAt', stmt, objExpression?.getText(), right.getText());
        }
        else if (isComparison && indexArgument && this.isLastCharacterCheck(callExpression.expression, indexArgument, sourceFile)) {
            this.addResult(node, false, 'charAt', stmt, objExpression?.getText(), right.getText());
        }
    }

    private processIndexOfMethod(node: ts.BinaryExpression, callExpr: ts.CallExpression,
        objExpression: ts.Expression | undefined, stmt: Stmt): void {
        if (!objExpression || !this.isStringContext(objExpression, stmt, 'indexOf')) {
            return;
        }
        let artString = callExpr.arguments[0].getText();
        const parent = callExpr.parent;
        if (parent && ts.isBinaryExpression(parent)) {
            const operatorToken = parent.operatorToken.kind;
            const validOperators = [
                ts.SyntaxKind.EqualsEqualsToken,
                ts.SyntaxKind.EqualsEqualsEqualsToken,
                ts.SyntaxKind.ExclamationEqualsToken,
                ts.SyntaxKind.ExclamationEqualsEqualsToken
            ];
            const isZero = ts.isNumericLiteral(parent.right) && parent.right.text === '0';
            if (validOperators.includes(operatorToken) && isZero) {
                this.addResult(node, true, 'indexOf', stmt, objExpression?.getText(), artString);
            }
        }
    }

    private processLastIndexOfMethod(node: ts.BinaryExpression, callExpr: ts.CallExpression,
        objExpression: ts.Expression | undefined, stmt: Stmt): void {
        if (!objExpression || !this.isStringContext(objExpression, stmt, 'lastIndexOf')) {
            return;
        }
        let artString = callExpr.arguments[0].getText();
        const parent = callExpr.parent;
        if (!parent || !ts.isBinaryExpression(parent)) {
            return;
        }
        const operatorToken = parent.operatorToken.kind;
        const validOperators = [
            ts.SyntaxKind.EqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            ts.SyntaxKind.ExclamationEqualsToken,
            ts.SyntaxKind.ExclamationEqualsEqualsToken
        ];
        const searchStr = callExpr.arguments[0];
        if (!searchStr) {
            return;
        }
        const { targetLength, textEExpectedStr } = this.getStringInfo(searchStr);
        if (targetLength === undefined || !textEExpectedStr) {
            return;
        }
        const isLengthComparison =
            ts.isBinaryExpression(parent.right) &&
            parent.right.operatorToken.kind === ts.SyntaxKind.MinusToken &&
            ts.isPropertyAccessExpression(parent.right.left) &&
            parent.right.left.name.text === 'length' &&
            this.getExpressionValue(parent.right.right) === targetLength;
        if (validOperators.includes(operatorToken) && isLengthComparison) {
            this.addResult(node, false, 'lastIndexOf', stmt, objExpression?.getText(), artString);
        }
    }

    // 新增辅助方法
    private getExpressionValue(node: ts.Expression): number | undefined {
        // 处理数字字面量
        if (ts.isNumericLiteral(node)) {
            return parseInt(node.text);
        }

        // 处理字符串字面量的.length
        if (ts.isPropertyAccessExpression(node) &&
            node.name.text === 'length') {

            // 处理 "bar".length 的情况
            if (ts.isStringLiteral(node.expression)) {
                return node.expression.text.length;
            }

            // 处理变量.length 的情况（需要解析变量值）
            if (ts.isIdentifier(node.expression)) {
                const resolved = this.resolveVariableInitializer(node.expression.text, node);
                if (resolved.value && typeof resolved.value === 'string') {
                    return resolved.value.length;
                }
            }
        }

        return undefined;
    }

    private getStringInfo(searchStr: ts.Expression): { targetLength?: number, textEExpectedStr?: string } {
        if (ts.isStringLiteral(searchStr)) {
            return {
                targetLength: searchStr.text.length,
                textEExpectedStr: `"${searchStr.text}"`
            };
        } else if (ts.isIdentifier(searchStr)) {
            let currentBlock = searchStr.parent;
            while (currentBlock && !ts.isBlock(currentBlock) && !ts.isSourceFile(currentBlock)) {
                currentBlock = currentBlock.parent;
            }
            const resolved = this.resolveVariableInitializer(searchStr.text, currentBlock);
            if (resolved.value !== undefined) {
                return {
                    targetLength: resolved.value.length,
                    textEExpectedStr: searchStr.text
                };
            }
        }
        return { targetLength: undefined, textEExpectedStr: undefined };
    }

    private processSliceMethod(node: ts.BinaryExpression, callExpr: ts.CallExpression, objExpression: ts.Expression | undefined,
        rightExpression: ts.Expression, stmt: Stmt): void {
        if (!objExpression || !this.isStringContext(objExpression, stmt, 'slice')) {
            return;
        }
        const args = callExpr.arguments;
        const parent = callExpr.parent;
        if (!ts.isBinaryExpression(parent)) {
            return;
        }
        const operatorToken = parent.operatorToken.kind;
        const validOperators = [
            ts.SyntaxKind.EqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            ts.SyntaxKind.ExclamationEqualsToken,
            ts.SyntaxKind.ExclamationEqualsEqualsToken
        ];
        if (!validOperators.includes(operatorToken)) {
            return;
        }
        const { targetValue, targetExpression } = this.getTargetValueAndExpression(rightExpression);
        // 修改条件判断，允许targetValue为undefined但targetExpression存在的情况
        if (!targetExpression) {
            return;
        }
        // 添加对动态标识符的特殊处理
        const shouldProcess = targetValue ? true :
            (ts.isIdentifier(rightExpression) &&
                callExpr.arguments.length >= 2 &&
                ts.isPropertyAccessExpression(callExpr.arguments[1]) &&
                callExpr.arguments[1].expression.getText() === targetExpression);
        if (!shouldProcess) {
            return;
        }
        this.processSliceArguments(node, args, targetValue, targetExpression, objExpression, stmt);
    }

    private getTargetValueAndExpression(rightExpression: ts.Expression): { targetValue?: string; targetExpression?: string } {
        if (ts.isStringLiteral(rightExpression)) {
            return {
                targetExpression: `"${rightExpression.text}"`,
                targetValue: rightExpression.text
            };
        }
        else if (ts.isNoSubstitutionTemplateLiteral(rightExpression)) {
            return {
                targetExpression: `\`${rightExpression.text}\``,
                targetValue: rightExpression.text
            };
        }
        else if (ts.isIdentifier(rightExpression)) {
            let currentBlock = rightExpression.parent;
            while (currentBlock && !ts.isBlock(currentBlock) && !ts.isSourceFile(currentBlock)) {
                currentBlock = currentBlock.parent;
            }
            const resolved = this.resolveVariableInitializer(rightExpression.text, currentBlock);

            if (resolved.value !== undefined) {
                return {
                    targetExpression: rightExpression.text,
                    targetValue: resolved.value
                };
            }
        }
        return { targetValue: undefined, targetExpression: undefined };
    }


    private processSliceArguments(node: ts.BinaryExpression, args: readonly ts.Expression[], targetValue: string | undefined, targetExpression: string,
        objExpression: ts.Expression, stmt: Stmt): void {
        if (targetValue !== undefined) {
            this.handleTargetValueDefined(node, args, targetValue, targetExpression, objExpression, stmt);
        } else {
            this.handleTargetValueUndefined(node, args, targetExpression, objExpression, stmt);
        }
    }

    private handleTargetValueDefined(node: ts.BinaryExpression, args: readonly ts.Expression[], targetValue: string, targetExpression: string,
        objExpression: ts.Expression, stmt: Stmt): void {
        if (this.isValidSliceStartAndLength(args, targetValue)) {
            this.addResult(node, true, 'slice', stmt, objExpression?.getText(), targetExpression);
        }

        if (this.isValidNegativeSliceLength(args, targetValue)) {
            this.addResult(node, false, 'slice', stmt, objExpression?.getText(), targetExpression);
        }
    }

    private isValidSliceStartAndLength(args: readonly ts.Expression[], targetValue: string): boolean {
        return args.length >= 2 &&
            ts.isNumericLiteral(args[0]) &&
            args[0].text === '0' &&
            ts.isNumericLiteral(args[1]) &&
            parseInt(args[1].text) === targetValue.length;
    }

    private isValidNegativeSliceLength(args: readonly ts.Expression[], targetValue: string): boolean {
        return args.length === 1 &&
            ts.isPrefixUnaryExpression(args[0]) &&
            args[0].operator === ts.SyntaxKind.MinusToken &&
            ts.isNumericLiteral(args[0].operand) &&
            parseInt(args[0].operand.text) === targetValue.length;
    }

    private handleTargetValueUndefined(node: ts.BinaryExpression, args: readonly ts.Expression[], targetExpression: string,
        objExpression: ts.Expression, stmt: Stmt): void {
        if (this.isValidSliceStartAndLengthProperty(args, targetExpression)) {
            this.addResult(node, true, 'slice', stmt, objExpression?.getText(), targetExpression);
        }
    }

    private isValidSliceStartAndLengthProperty(args: readonly ts.Expression[], targetExpression: string): boolean {
        return args.length >= 2 &&
            ts.isNumericLiteral(args[0]) &&
            args[0].text === '0' &&
            ts.isPropertyAccessExpression(args[1]) &&
            args[1].name.text === 'length' &&
            ts.isIdentifier(args[1].expression) &&
            args[1].expression.text === targetExpression;
    }


    private processSubstringMethod(node: ts.BinaryExpression, callExpr: ts.CallExpression,
        objExpression: ts.Expression | undefined, rightExpression: ts.Expression, stmt: Stmt): void {
        if (!objExpression || !this.isStringContext(objExpression, stmt, 'substring')) {
            return;
        }
        const args = callExpr.arguments;
        const parent = callExpr.parent;

        if (!ts.isBinaryExpression(parent)) {
            return;
        }
        const operatorToken = parent.operatorToken.kind;
        const validOperators = [
            ts.SyntaxKind.EqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsEqualsToken
        ];
        if (!validOperators.includes(operatorToken)) {
            return;
        }

        const { targetValue, targetExpression } = this.getTargetValueAndExpression(rightExpression);
        if (!targetValue || !targetExpression) {
            return;
        }

        this.processSubstringArguments(node, args, targetValue, targetExpression, objExpression, stmt);
    }



    private processSubstringArguments(node: ts.BinaryExpression, args: readonly ts.Expression[],
        targetValue: string, targetExpression: string, objExpression: ts.Expression, stmt: Stmt): void {
        if (this.isValidStartAndLength(args, targetValue)) {
            this.addResult(node, true, 'substring', stmt, objExpression?.getText(), targetExpression);
        }

        if (this.isValidNegativeLengthBinary(args, targetValue, objExpression)) {
            this.addResult(node, false, 'substring', stmt, objExpression?.getText(), targetExpression);
        }

        if (this.isValidNegativeLengthUnary(args, targetValue)) {
            this.addResult(node, false, 'substring', stmt, objExpression?.getText(), targetExpression);
        }
    }

    private isValidStartAndLength(args: readonly ts.Expression[], targetValue: string): boolean {
        return args.length >= 2 &&
            ts.isNumericLiteral(args[0]) &&
            args[0].text === '0' &&
            ts.isNumericLiteral(args[1]) &&
            parseInt(args[1].text) === targetValue.length;
    }

    private isValidNegativeLengthBinary(args: readonly ts.Expression[], targetValue: string, objExpression: ts.Expression): boolean {
        return args.length === 1 &&
            ts.isBinaryExpression(args[0]) &&
            args[0].operatorToken.kind === ts.SyntaxKind.MinusToken &&
            ts.isPropertyAccessExpression(args[0].left) &&
            args[0].left.name.text === 'length' &&
            ts.isIdentifier(args[0].left.expression) &&
            args[0].left.expression.text === objExpression.getText() &&
            ts.isNumericLiteral(args[0].right) &&
            parseInt(args[0].right.text) === targetValue.length;
    }

    private isValidNegativeLengthUnary(args: readonly ts.Expression[], targetValue: string): boolean {
        return args.length === 1 &&
            ts.isPrefixUnaryExpression(args[0]) &&
            args[0].operator === ts.SyntaxKind.MinusToken &&
            ts.isNumericLiteral(args[0].operand) &&
            parseInt(args[0].operand.text) === targetValue.length;
    }

    private processMatchMethod(node: ts.BinaryExpression, callExpr: ts.CallExpression,
        objExpression: ts.Expression | undefined, stmt: Stmt): void {
        const methodExpr = callExpr.expression;
        if (!ts.isPropertyAccessExpression(methodExpr)) {
            return;
        }
        if (callExpr.arguments.length === 0) {
            return;
        }
        if (!objExpression || !this.isStringContext(objExpression, stmt, 'match')) {
            return;
        }
        const [regexArg] = callExpr.arguments;

        const regexText = this.getRegexText(regexArg);

        if (!regexText) {
            return;
        }
        this.processMatchRegex(node, callExpr, regexText, objExpression, stmt);
    }

    private getRegexText(regexArg: ts.Expression): string | undefined {
        if (ts.isIdentifier(regexArg)) {
            let currentBlock = regexArg.parent;
            while (currentBlock && !ts.isBlock(currentBlock) && !ts.isSourceFile(currentBlock)) {
                currentBlock = currentBlock.parent;
            }
            const resolved = this.resolveVariableInitializer(regexArg.text, currentBlock);
            if (resolved.value) {
                return resolved.value;
            }
        }
        else if (ts.isRegularExpressionLiteral(regexArg)) {
            return regexArg.getText();
        }

        return undefined;
    }
    private processMatchRegex(node: ts.BinaryExpression, callExpr: ts.CallExpression,
        regexText: string, objExpression: ts.Expression, stmt: Stmt): void {
        const isRegexLiteral = regexText.startsWith('/') && regexText.endsWith('/');
        const pattern = isRegexLiteral ?
            regexText.slice(1, -1).replace(/\\\//g, '/') :
            regexText;
        const parent = callExpr.parent;

        if (!ts.isBinaryExpression(parent)) {
            return;
        }

        // 扩展null/undefined比较检测
        const isNullComparison = [
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsToken,
            ts.SyntaxKind.ExclamationEqualsToken,
            ts.SyntaxKind.ExclamationEqualsEqualsToken
        ].includes(parent.operatorToken.kind) && (
                parent.right.kind === ts.SyntaxKind.NullKeyword ||
                (ts.isIdentifier(parent.right) && parent.right.text === 'undefined')
            );

        if (isNullComparison) {
            const isStartsWithPattern = pattern.startsWith('^') &&
                !pattern.includes('$') &&
                !this.containsComplexRegexSyntax(pattern.slice(1));

            const isEndsWithPattern = pattern.endsWith('$') &&
                !pattern.includes('^') &&
                !this.containsComplexRegexSyntax(pattern.slice(0, -1));

            if (isStartsWithPattern) {
                const expectedStr = pattern.substring(1).replace(/\\/g, '');
                this.addResult(node, true, 'match', stmt, objExpression.getText(), expectedStr);
            }
            else if (isEndsWithPattern) {
                const expectedStr = pattern.slice(0, -1).replace(/\\/g, '');
                this.addResult(node, false, 'match', stmt, objExpression.getText(), expectedStr);
            }
        }
    }
    private isStartsWithOrEndsWithCall(expression: ts.LeftHandSideExpression): boolean {
        const methodName = this.getMethodName(expression);
        return methodName === 'startsWith' || methodName === 'endsWith';
    }

    private getObjectExpression(expression: ts.Expression): ts.Expression | undefined {
        if (ts.isPropertyAccessExpression(expression)) {
            const propertyAccess = expression as ts.PropertyAccessExpression;
            return propertyAccess.expression;
        } else if (ts.isElementAccessExpression(expression)) {
            const elementAccess = expression as ts.ElementAccessExpression;
            return elementAccess.expression;
        } else if (ts.isCallExpression(expression)) {
            return this.getObjectExpression(expression.expression);
        }
        return undefined;
    }

    private resolveVariableInitializer(varName: string, block: ts.Node, depth: number = 0): {
        value?: string;
    } {
        if (depth > 8) {
            return {};
        }
        const declaration = this.findVariableDeclarationInBlock(varName, block);
        if (declaration === undefined) {
            let rightStmtValue = this.getRightStmt(varName);
            let leftStmtValue = this.getArkName(varName);
            if (rightStmtValue !== undefined) {
                return rightStmtValue;
            }
            if (leftStmtValue !== undefined) {
                return leftStmtValue;
            }
        }


        if (!declaration?.initializer) {
            return {};
        }
        const initializer = declaration.initializer;
        if (ts.isStringLiteral(initializer)) {
            return { value: initializer.text };
        }
        else if (ts.isNoSubstitutionTemplateLiteral(initializer)) {
            return { value: initializer.text };
        }  // 新增正则表达式字面量处理
        else if (ts.isRegularExpressionLiteral(initializer)) {
            return { value: initializer.getText() };
        }
        else if (ts.isIdentifier(initializer)) {
            return this.resolveVariableInitializer(initializer.text, block, depth + 1);
        }

        return {};
    }
    private getRightStmt(varName: string): { value: string } | undefined {
        for (const stmt of this.stmts) {
            if (!(stmt instanceof ArkAssignStmt)) {
                continue;
            }

            const leftOp = stmt.getLeftOp();
            if (!(leftOp instanceof Local && leftOp.getName() === varName)) {
                continue;
            }

            const decl = leftOp.getDeclaringStmt();
            if (!(decl instanceof ArkAssignStmt)) {
                continue;
            }

            const rightOp = decl.getRightOp();
            if (rightOp instanceof Constant) {
                return { value: rightOp.getValue() };
            }
        }

        return undefined;
    }


    private getArkName(varName: string): { value: string } | undefined {
        let returnValue = undefined;
        this.stmts.forEach(stmt => {
            if (stmt instanceof ArkAssignStmt) {
                stmt?.getCfg()?.getDeclaringMethod()?.getBody()?.getLocals()?.forEach(local => {
                    if (local?.getName() === varName) {
                        // 修改后的代码片段
                        returnValue = this.checkLeftOpUsage(stmt.getLeftOp());
                    }
                });
            }
        });
        return returnValue;
    }

    // 新增方法
    private checkLeftOpUsage(leftOp: any): { value: string } | undefined {
        if (!(leftOp instanceof Local)) {
            return undefined;
        }

        for (const item of leftOp.getUsedStmts()) {
            if (!(item instanceof ArkInvokeStmt)) {
                continue;
            }

            const invokeExpr = item.getInvokeExpr();
            if (!(invokeExpr instanceof ArkInstanceInvokeExpr)) {
                continue;
            }

            const [firstArg] = invokeExpr.getArgs();
            if (firstArg instanceof StringConstant) {
                return { value: firstArg.getValue() };
            }
        }
        return undefined;
    }

    private findVariableDeclarationInBlock(varName: string, block: ts.Node): ts.VariableDeclaration | undefined {
        let result: ts.VariableDeclaration | undefined;
        const visit = (node: ts.Node) => {
            if (ts.isVariableStatement(node)) {
                node.declarationList.declarations.forEach(decl => {
                    if (ts.isIdentifier(decl.name) && decl.name.text === varName) {
                        result = decl;
                    }
                });
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(block, visit);
        return result;
    }

    private isLastCharacterCheck(expression: ts.Expression, indexArg: ts.Expression, sourceFile: ts.SourceFile): boolean {
        if (!ts.isPropertyAccessExpression(expression)) return false;
        if (ts.isBinaryExpression(indexArg) &&
            ts.isPropertyAccessExpression(indexArg.left) &&
            ts.isIdentifier(indexArg.left.expression) &&
            indexArg.left.name.text === 'length' &&
            indexArg.operatorToken.kind === ts.SyntaxKind.MinusToken &&
            ts.isNumericLiteral(indexArg.right) &&
            indexArg.right.text === '1') {
            return true
        }
        return false;
    }

    private ruleFix(sourceFile: ts.SourceFile, loc: LocationInfo): RuleFix {
        const startPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.startCol - 1);
        const endPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.endCol - 1);
        return this.handleTestFix(loc, startPosition, endPosition) ||
            this.handleNoNameFix(loc, startPosition, endPosition) ||
            this.handleCharAtFix(loc, startPosition, endPosition) ||
            this.handleMatchFix(loc, startPosition, endPosition) ||
            this.handleSliceFix(loc, startPosition, endPosition) ||
            this.handleSubstringFix(loc, startPosition, endPosition) ||
            this.handleIndexOfFix(loc, startPosition, endPosition) ||
            { range: [0, 0], text: "" };
    }

    private handleTestFix(loc: LocationInfo, start: number, end: number): RuleFix | null {
        if (loc.methodName !== 'test') {
            return null;
        }
        const method = loc.isStartWith ? 'startsWith' : 'endsWith';
        const quote = loc.isStartWith ? '"' : '"';
        return {
            range: [start, end],
            text: `${loc.testObjectText}.${method}(${quote}${loc.textEExpectedStr}${quote})`
        };
    }

    private handleNoNameFix(loc: LocationInfo, start: number, end: number): RuleFix | null {
        if (loc.methodName !== 'noName') {
            return null;
        }
        const method = loc.isStartWith ? 'startsWith' : 'endsWith';
        return {
            range: [start, end],
            text: `${loc.testObjectText}.${method}(${loc.textEExpectedStr})`
        };
    }

    private handleCharAtFix(loc: LocationInfo, start: number, end: number): RuleFix | null {
        if (loc.methodName !== 'charAt') {
            return null;
        }
        const method = loc.isStartWith ? 'startsWith' : 'endsWith';
        return {
            range: [start, end],
            text: `${loc.testObjectText}.${method}(${loc.textEExpectedStr})`
        };
    }

    private handleMatchFix(loc: LocationInfo, start: number, end: number): RuleFix | null {
        if (loc.methodName !== 'match') {
            return null;
        }
        const method = loc.isStartWith ? 'startsWith' : 'endsWith';
        const quote = loc.isStartWith ? '"' : '"';
        return {
            range: [start, end],
            text: `${loc.testObjectText}.${method}(${quote}${loc.textEExpectedStr}${quote})`
        };
    }

    private handleSliceFix(loc: LocationInfo, start: number, end: number): RuleFix | null {
        if (loc.methodName !== 'slice') {
            return null;
        }
        const method = loc.isStartWith ? 'startsWith' : 'endsWith';
        let textEExpectedStr = '';
        if (loc.textEExpectedStr) {
            textEExpectedStr = this.changeDoubleQuotesToSingleQuotes(loc.textEExpectedStr);
        }
        return {
            range: [start, end],
            text: `${loc.testObjectText}.${method}(${textEExpectedStr})`
        };
    }

    private changeDoubleQuotesToSingleQuotes(str: string): string {
        if (str.startsWith('"') && str.endsWith('"')) {
            return `'${str.slice(1, -1)}'`;
        }
        return str;
    }

    private handleSubstringFix(loc: LocationInfo, start: number, end: number): RuleFix | null {
        if (loc.methodName !== 'substring') {
            return null;
        }
        const method = loc.isStartWith ? 'startsWith' : 'endsWith';
        let textEExpectedStr = '';
        if (loc.textEExpectedStr) {
            textEExpectedStr = this.changeDoubleQuotesToSingleQuotes(loc.textEExpectedStr);
        }
        return {
            range: [start, end],
            text: `${loc.testObjectText}.${method}(${textEExpectedStr})`
        };
    }

    private handleIndexOfFix(loc: LocationInfo, start: number, end: number): RuleFix | null {
        let fixText = '';
        if (loc.methodName === 'indexOf') {
            fixText = `${loc.testObjectText}.startsWith(${loc.textEExpectedStr})`;
        }
        else if (loc.methodName === 'lastIndexOf') {
            fixText = `${loc.testObjectText}.endsWith(${loc.textEExpectedStr})`;
        }
        return {
            range: [start, end],
            text: fixText
        };
    }

    private addIssueReportNodeFix(loc: LocationInfo) {
        const severity = this.rule.alert ?? this.metaData.severity;
        let message = '';
        if (loc.isStartWith) {
            message = `Use 'String#startsWith' method instead.`;
        } else {
            message = `Use the 'String#endsWith' method instead.`;
        }
        const defect = new Defects(loc.line, loc.character, loc.endCol, message, severity, this.rule.ruleId,
            this.filePath, this.metaData.ruleDocPath, true, false, true);
        let fix: RuleFix = this.ruleFix(this.fileSourceFile, loc);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    }
    private getLineAndCharacterInfo(node: ts.Node, stmt: Stmt): { line: number; character: number; startCol: number; endCol: number } {
        let checkText = node.getText();
        const text = stmt.getOriginalText();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (!arkFile || !text || text.length === 0) {
            return { line: -1, character: 0, startCol: -1, endCol: -1 };
        }
        let lineCount = - 1;
        let startColum = - 1;
        let originalPosition = stmt.getOriginPositionInfo();
        const sparse = originalPosition.getColNo();
        const originalTexts = text.split('\n');
        for (let originalText of originalTexts) {
            lineCount++;
            if (originalText.includes(checkText)) {
                if (lineCount === 0) {
                    startColum = originalText.indexOf(checkText) + sparse;
                } else {
                    startColum = originalText.indexOf(checkText) + 1;
                }
                break;
            }
        }
        if (startColum === -1) {
            return { line: -1, character: 0, startCol: -1, endCol: -1 };
        }
        let lineNo = originalPosition.getLineNo() + lineCount;
        const startCol = startColum;
        const endCol = startColum + checkText.length;
        const filePath = arkFile.getFilePath();
        return { line: lineNo, character: startCol, startCol: startCol, endCol: endCol };
    }

    private createLocationInfo(node: ts.Node, isStartWith: boolean, methodName: string,
        stmt: Stmt, testObjectText?: string, textEExpectedStr?: string): LocationInfo {
        const { line, character, startCol, endCol } = this.getLineAndCharacterInfo(node, stmt);
        return {
            line,
            character,
            startCol,
            endCol,
            isStartWith,
            methodName,
            testObjectText,
            textEExpectedStr
        };
    }

    private addResult(node: ts.Expression, isStartWith: boolean, methodName: string,
        stmt: Stmt, testObjectText?: string, textEExpectedStr?: string): void {
        const loc = stmt.getOriginPositionInfo();
        const locationKey = `${loc.getLineNo()}:${loc.getColNo()}`;
        if (this.processedLocations.has(locationKey)) {
            return;
        }
        this.processedLocations.add(locationKey);
        const locationInfo = this.createLocationInfo(node, isStartWith, methodName, stmt, testObjectText, textEExpectedStr);
        this.addIssueReportNodeFix(locationInfo);
    }
}