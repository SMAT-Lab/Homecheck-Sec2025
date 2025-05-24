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
import { AstTreeUtils, ArkFile, ts } from "arkanalyzer";
import { BaseMetaData, BaseChecker } from "../BaseChecker";
import { Rule, Defects, FileMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { RuleListUtil } from '../../utils/common/DefectsList';
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-loop-func.md',
    description: 'Function declared in a loop contains unsafe references to variable(s)'
};
export class NoLoopFuncCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatcherCb];
    };
    public check = (target: ArkFile) => {
        const originPath = target.getFilePath();
        if (!this.isTsFile(originPath)) {
            return;
        };
        const sourceFile: ts.SourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
        this.checkNode(sourceFile, target);
    };
    private checkNode(node: ts.Node, arkFile: ArkFile): void {
        if (ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
            const checkFunction = (funcNode: ts.Node): void => {
                const unsafeRefs = this.findUnsafeReferences(funcNode, node);
                if (unsafeRefs.length > 0) {
                    this.reportIssue(funcNode, unsafeRefs, arkFile);
                };
            };
            const checkNodeForFunctions = (innerNode: ts.Node): void => {
                if (ts.isFunctionExpression(innerNode) || ts.isFunctionDeclaration(innerNode) || ts.isArrowFunction(innerNode)) {
                    checkFunction(innerNode);
                };
                ts.forEachChild(innerNode, checkNodeForFunctions);
            };
            if (ts.isForStatement(node)) {
                if (node.condition) {
                    checkNodeForFunctions(node.condition);
                };
                if (node.incrementor) {
                    checkNodeForFunctions(node.incrementor);
                };
            };
            const loopBody = node.statement;
            if (loopBody) {
                checkNodeForFunctions(loopBody);
            };
        };
        ts.forEachChild(node, child => this.checkNode(child, arkFile));
    };
    private findUnsafeReferences(funcNode: ts.Node, loopNode: ts.Node): string[] {
        const loopVars = this.collectLoopVariables(loopNode);
        const unsafeRefs: string[] = [];
        const isWhileLoop = ts.isWhileStatement(loopNode) || ts.isDoStatement(loopNode);
        const funcParams = new Set<string>();
        if (ts.isFunctionLike(funcNode)) {
            for (const param of funcNode.parameters) {
                if (ts.isIdentifier(param.name)) {
                    funcParams.add(param.name.text);
                };
            };
        };
        const referencedVars = new Set<string>();
        const collectReferences = (node: ts.Node): void => {
            if (this.isValidReference(node, funcParams) && ts.isIdentifier(node)) {
                referencedVars.add(node.text);
            };
            if (!(node !== funcNode && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)))) {
                ts.forEachChild(node, collectReferences);
            };
        };
        collectReferences(funcNode);
        referencedVars.forEach(varName => {
            if (this.isUnsafeReference(varName, loopVars, loopNode, isWhileLoop)) {
                unsafeRefs.push(varName);
            };
        });
        return unsafeRefs;
    };
    private isUnsafeReference(varName: string, loopVars: Set<string>, loopNode: ts.Node, isWhileLoop: boolean): boolean {
        if (loopVars.has(varName)) {
            const varDecl = this.findVariableDeclaration(varName, loopNode);
            if (varDecl && varDecl.parent && ts.isVariableDeclarationList(varDecl.parent)) {
                if (varDecl.parent.flags & ts.NodeFlags.Const) {
                    return false;
                };
                if ((varDecl.parent.flags & ts.NodeFlags.Let) && !isWhileLoop) {
                    return false;
                };
            };
            return true;
        };
        if (isWhileLoop) {
            return this.isVariableModifiedInLoop(varName, loopNode) || this.isVariableModifiedAfterLoop(varName, loopNode);
        };
        const isModified = this.isVariableModifiedInLoop(varName, loopNode) || this.isVariableModifiedAfterLoop(varName, loopNode);
        return isModified;
    };

    private isValidReference(node: ts.Node, funcParams: Set<string>): boolean {
        if (ts.isIdentifier(node)) {
            const parent = node.parent;
            return !(parent && ts.isPropertyAccessExpression(parent) && parent.name === node) &&
                !(parent && ts.isVariableDeclaration(parent) && parent.name === node) &&
                !(parent && ts.isParameter(parent)) &&
                !(parent && (ts.isTypeReferenceNode(parent) || parent.kind === ts.SyntaxKind.TypeReference)) &&
                !funcParams.has(node.text);
        };
        return false;
    };
    private isVariableModifiedAfterLoop(varName: string, loopNode: ts.Node): boolean {
        const parent = loopNode.parent;
        if (!parent) { 
            return false; 
        };
        let isModified = false;
        const checkAfterLoop = (node: ts.Node): void => {
            if (isModified) {
                return;
            };
            if (this.isVariableModified(node, varName)) {
                isModified = true;
                return;
            };
            ts.forEachChild(node, checkAfterLoop);
        };
        let root = loopNode;
        while (root.parent) {
            root = root.parent;
        };
        checkAfterLoop(root);
        return isModified;
    };
    private collectCapturedVariables(node: ts.Node, capturedVars: Set<string>): void {
        const funcParams = new Set<string>();
        if (ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isFunctionDeclaration(node)) {
            for (const param of node.parameters) {
                if (ts.isIdentifier(param.name)) {
                    funcParams.add(param.name.text);
                };
            };
        };
        if (node.kind === ts.SyntaxKind.Identifier) {
            const parent = node.parent;
            const identifier = node as ts.Identifier;
            if (!(parent && ts.isPropertyAccessExpression(parent) && parent.name === node) &&
                !(parent && ts.isVariableDeclaration(parent) && parent.name === node) &&
                !(parent && parent.kind === ts.SyntaxKind.TypeReference) &&
                !funcParams.has(identifier.text) &&
                !(parent && ts.isParameter(parent) && parent.name === node)) {
                capturedVars.add(identifier.text);
            };
        };
        ts.forEachChild(node, child => this.collectCapturedVariables(child, capturedVars));
    };
    private collectLoopVariables(loopNode: ts.Node): Set<string> {
        const loopVars = new Set<string>();
        if (ts.isForStatement(loopNode)) {
            if (loopNode.initializer) {
                this.handleInitializer(loopNode.initializer, loopVars);
            };
            if (loopNode.condition) {
                this.handleCondition(loopNode.condition, loopVars);
            };
            if (loopNode.incrementor) {
                this.handleIncrementor(loopNode.incrementor, loopVars);
            };
        } else if (ts.isForInStatement(loopNode) || ts.isForOfStatement(loopNode)) {
            this.processForInOfInitializer(loopNode.initializer, loopVars);
            this.collectIdentifiersFromNode(loopNode.expression, loopVars);
        } else if (ts.isWhileStatement(loopNode) || ts.isDoStatement(loopNode)) {
            this.collectIdentifiersFromNode(loopNode.expression, loopVars);
        };
        return loopVars;
    };
    private processForInOfInitializer(initializer: ts.Node, loopVars: Set<string>): void {
        if (ts.isVariableDeclarationList(initializer)) {
            initializer.declarations.forEach(decl => {
                if (ts.isIdentifier(decl.name)) {
                    loopVars.add(decl.name.text);
                };
            });
        } else if (initializer) {
            this.collectIdentifiersFromNode(initializer, loopVars);
        };
    };
    private handleInitializer = (initializer: ts.Node, loopVars: Set<string>): void => {
        if (ts.isVariableDeclarationList(initializer)) {
            initializer.declarations.forEach(decl => {
                if (ts.isIdentifier(decl.name)) {
                    loopVars.add(decl.name.text);
                };
            });
        } else {
            this.collectIdentifiersFromNode(initializer, loopVars);
        };
    };
    private handleCondition = (condition: ts.Node, loopVars: Set<string>): void => {
        this.collectIdentifiersFromNode(condition, loopVars);
    };
    private handleIncrementor = (incrementor: ts.Node, loopVars: Set<string>): void => {

        this.collectIdentifiersFromNode(incrementor, loopVars);

    };
    private collectIdentifiersFromNode(node: ts.Node, identifiers: Set<string>): void {
        if (ts.isIdentifier(node)) {
            identifiers.add(node.text);
        };
        ts.forEachChild(node, child => {
            this.collectIdentifiersFromNode(child, identifiers);
        });
    };
    /**
     * 检查变量是否在循环体内被修改
     * @param varName 变量名
     * @param loopNode 循环节点
     * @returns 是否在循环体内被修改
     */
    private isVariableModifiedInLoop(varName: string, loopNode: ts.Node): boolean {
        let isModified = false;
        let loopBody: ts.Node | undefined;
        if (ts.isForStatement(loopNode) ||
            ts.isForInStatement(loopNode) ||
            ts.isForOfStatement(loopNode) ||
            ts.isWhileStatement(loopNode) ||
            ts.isDoStatement(loopNode)) {
            loopBody = loopNode.statement;
        };
        if (!loopBody) {
            return false;
        };
        // 检查循环体内的变量修改
        const checkModification = (node: ts.Node): void => {
            this.checkNodeForModification(node, varName, isModified);
        };
        checkModification(loopBody);
        return isModified;
    };
    private checkNodeForModification(node: ts.Node, varName: string, isModified: boolean): void {
        if (isModified) {
            return;
        };
        if (this.isVariableModified(node, varName)) {
            isModified = true;
            return;
        };
        if (!(ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))) {
            ts.forEachChild(node, child => this.checkNodeForModification(child, varName, isModified));
        };
    };
    private isVariableModified(node: ts.Node, varName: string): boolean {
        if (ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isIdentifier(node.left) &&
            node.left.text === varName) {
            return true;
        };
        if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
            (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) &&
            ts.isIdentifier(node.operand) &&
            node.operand.text === varName) {
            return true;
        };
        if (ts.isBinaryExpression(node) &&
            [ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken,
            ts.SyntaxKind.AsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken].includes(node.operatorToken.kind) &&
            ts.isIdentifier(node.left) &&
            node.left.text === varName) {
            return true;
        };
        return false;
    };
    /**
     * 查找变量的声明节点
     * @param varName 变量名
     * @param scope 搜索范围
     * @returns 变量声明节点或null
     */
    private findVariableDeclaration(varName: string, scope: ts.Node): ts.VariableDeclaration | null {
        let result: ts.VariableDeclaration | null = null;
        const visit = (node: ts.Node): void => {
            if (ts.isVariableDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === varName) {
                result = node;
                return;
            };
            if (!(ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))) {
                ts.forEachChild(node, visit);
            };
        };
        let root = scope;
        while (root.parent) {
            root = root.parent;
        };
        visit(root);
        return result;
    };
    private reportIssue(node: ts.Node, unsafeRefs: string[], arkFile: ArkFile): void {
        const sourceFile = node.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const endCharacter = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).character;
        const description = `${this.metaData.description} '${unsafeRefs.join("', '")}'.`;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defect = new Defects(line + 1, character + 1, endCharacter + 1, description, severity, this.rule.ruleId,
            arkFile.getFilePath(), this.metaData.ruleDocPath, false, true, false, true);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };
    private isTsFile(filePath: string): boolean {
        return filePath.toLowerCase().endsWith('.ts');
    };
};