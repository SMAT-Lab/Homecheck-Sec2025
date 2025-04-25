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
import {ArkFile, AstTreeUtils, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../BaseChecker';
import {Defects} from '../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../Index';
import {Rule} from '../../Index';
import {RuleListUtil} from '../../utils/common/DefectsList';
import {IssueReport} from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoRedeclareCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-redeclare-check.md',
    description: 'Disallow variable redeclaration.'
};

type Options = [{
    builtinGlobals: boolean,
    ignoreDeclarationMerge: boolean
}];

enum CheckType {
    interface = 0,
    namespace = 1,
    class = 2,
    function = 3,
    enum = 4,
    typeAlias = 5,
    variable = 6, // var
    vars = 7, // const, let 等
    param = 8,
    import = 9,
    global = 10,
    globalLabel = 11
}

type CheckMember = {
    name: string;
    node: ts.Node,
    nameNode: ts.Node,
    forParentNode: ts.Node,
    type: CheckType,
    scopeNode?: ts.Node
};

type GlobalMember = {
    node: ts.Node,
    sourceFile: ts.SourceFile,
    position: ts.LineAndCharacter,
    contentIndex: number
};

export class NoRedeclareCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private readonly defaultTypes = ['Array', 'Object', 'Function', 'Boolean', 'String', 'Number', 'Symbol', 'Date', 'RegExp', 'Promise', 'Proxy', 'Map', 'Set', 'WeakMap',
        'WeakSet', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'decodeURI',
        'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'Infinity', 'NaN', 'undefined', 'JSON', 'Math', 'Intl', 'Atomics', 'Reflect', 'WebAssembly', 'BigInt', 'toString'];
    private builtinGlobals = true;
    private ignoreDeclarationMerge = true;
    private readonly globalKeyword = 'global';
    private readonly globalsKeyword = 'globals';
    private readonly keywordList = [this.globalKeyword, this.globalsKeyword];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        if (this.rule && this.rule.option) {
            const option = this.rule.option as Options;
            if (option.length > 0) {
                this.builtinGlobals = option[0].builtinGlobals;
                this.ignoreDeclarationMerge = option[0].ignoreDeclarationMerge;
            }
        }

        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject === undefined) {
            return;
        }

        this.checkGlobals(sourceFile, targetFile);

        this.loopNode(targetFile, sourceFile, sourceFileObject);
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (child.kind === ts.SyntaxKind.SyntaxList) {
                if (!ts.isSourceFile(child.parent)) {
                    this.checkSyntaxListRedeclare(targetFile, sourceFile, child);
                }
            } else if (child.kind === ts.SyntaxKind.Block) {
                this.checkBlockRedeclare(targetFile, sourceFile, child);
            } else if (ts.isImportDeclaration(child)) {
                this.checkImportRedeclare(targetFile, sourceFile, child);
            } else {
                const memberList = this.objectNeedCheck(child, child);
                for (const member of memberList) {
                    this.checkRedeclare(targetFile, sourceFile, member);
                }
            }

            this.loopNode(targetFile, sourceFile, child);
        }
    }

    // 检测参数和代码块内的变量是否重定义，例如 function A(p) { var p; }
    private checkBlockRedeclare(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const parent = aNode.parent;
        if (!parent) {
            return;
        }

        if (ts.isFunctionDeclaration(parent)) {
            const paramList: CheckMember[] = [];
            for (const parameter of parent.parameters) {
                const obj = { name: parameter.name.getText(), nameNode: parameter, node: parameter, forParentNode: aNode, type: CheckType.vars };
                paramList.push(obj);
            }

            if (paramList.length === 0) {
                return;
            }

            const syntaxNodeList = this.objectNeedCheck(aNode, aNode.parent);
            for (const node of syntaxNodeList) {
                this.checkRedeclareInMembers(targetFile, sourceFile, node, paramList);
            }
        } else {
            const memberList = this.objectNeedCheck(aNode, aNode.parent);
            for (const member of memberList) {
                this.checkRedeclare(targetFile, sourceFile, member);
            }
        }
    }

    // 检测导入的变量，例如 import foo4 from 'bar'
    private checkImportRedeclare(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.ImportDeclaration): void {
        const memberList = this.objectNeedCheck(aNode, aNode);
        for (const member of memberList) {
            this.checkRedeclare(targetFile, sourceFile, member);
        }
    }

    private checkSyntaxListRedeclare(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const memberList = this.getSyntaxListNodes(aNode, aNode);
        for (const checkMember of memberList) {
            this.checkRedeclareInMembers(targetFile, sourceFile, checkMember, memberList);
        }
    }

    private getSpecifyChild(aNode: ts.Node, kind: ts.SyntaxKind): ts.Node | undefined {
        for (const child of aNode.getChildren()) {
            if (child.kind === kind) {
                return child;
            }
            let result = this.getSpecifyChild(child, kind);
            if (result) {
                return result;
            }
        }
    }

    private checkRedeclare(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: CheckMember): void {
        let parent = aNode.forParentNode.parent;
        if (!parent) {
            return;
        }

        if (ts.isBlock(parent)) {
            parent = parent.getChildren()[1];
        }
        let children = parent.getChildren();
        if (children.length === 0) {
            return;
        }

        if (parent.kind === ts.SyntaxKind.SourceFile) {
            children = children[0].getChildren();
        }

        this.checkRedeclareInNodes(targetFile, sourceFile, aNode, children);
    }

    private checkRedeclareInMembers(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: CheckMember, memberList: CheckMember[]):void {
        let nodeList: ts.Node[] = [];
        for (const checkMember of memberList) {
            nodeList.push(checkMember.node);
        }
        this.checkRedeclareInNodes(targetFile, sourceFile, aNode, nodeList);
    }

    private checkBuiltIn(targetFile: ArkFile, sourceFile: ts.SourceFileLike, name: string, startLine: number,
                         startCol: number, type: CheckType, aNode: ts.Node): boolean {
        if (type === CheckType.param || type === CheckType.globalLabel) {
            return false;
        }
        if (this.checkNodeInBlock(aNode)) {
            return false;
        }
        if (this.isBuiltinKeyword(name)) {
            const message = "'" + name + "' is already defined as a built-in global variable.";
            this.addIssueReport(targetFile, startLine, startCol, 0, message);
            return true;
        }
        return false;
    }

    // 检查节点是否在block内: const { weight, toString } = this;
    private checkNodeInBlock(aNode: ts.Node): boolean {
        if (aNode.kind === ts.SyntaxKind.VariableDeclarationList) {
            if (aNode.parent.parent && aNode.parent.parent.kind === ts.SyntaxKind.SourceFile) {
                return false;
            }
        }

        const parent = aNode.parent;
        if (!parent) {
            return false;
        }

        const children = parent.getChildren();
        if (children[0].kind === ts.SyntaxKind.OpenBraceToken) {
            return true;
        }

        return this.checkNodeInBlock(parent);
    }

    private checkRedeclareInNodes(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: CheckMember, nodeList: ts.Node[]): void {
        const originStartPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.nameNode.getStart());
        const startLine = originStartPosition.line + 1;
        const startCol = originStartPosition.character + 1;
        if (this.checkBuiltIn(targetFile, sourceFile, aNode.name, startLine, startCol, aNode.type, aNode.forParentNode)) {
            return;
        }

        for (const child of nodeList) {
            const memberList = this.objectNeedCheck(child, aNode.forParentNode);
            for (const member of memberList) {
                if (member.node.pos === aNode.node.pos && member.node.kind === aNode.node.kind) {
                    continue;
                }

                if (member.name !== aNode.name) {
                    continue;
                }

                const targetStartPosition = ts.getLineAndCharacterOfPosition(sourceFile, member.nameNode.getStart());
                if (targetStartPosition.line > originStartPosition.line ||
                    (targetStartPosition.line === originStartPosition.line && targetStartPosition.character > originStartPosition.character)) {
                    continue;
                }

                if (this.isNodeChecked(sourceFile, member.nameNode)) {
                    continue;
                }

                if (!this.needCheckIgnoreDeclarationMerge(aNode, member)) {
                    continue;
                }

                let reportIssue = false;
                // 如果两个都是变量，且都是用var声明的，报错
                if (member.type === CheckType.variable && aNode.type === CheckType.variable) {
                    reportIssue = true;
                } else {
                    // 在同一作用域，报错
                    reportIssue = (member.node.parent.getText() === aNode.node.parent.getText()) ||
                        (member.node.parent.getText() === aNode.forParentNode.getText() ||
                            (member.scopeNode?.getText() === aNode.scopeNode?.getText()));
                }
                if (reportIssue) {
                    const message = "'" + aNode.name + "' is already defined.";
                    this.addIssueReport(targetFile, startLine, startCol, 0, message);
                }
            }
        }
    }

    // 要检测的节点是否已经在错误列表中
    private isNodeChecked(sourceFile: ts.SourceFileLike, aNode: ts.Node): boolean {
        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
        const startLine = startPosition.line + 1;
        const startCol = startPosition.character + 1;
        for (const issue of this.issues) {
            if (issue.defect.reportLine === startLine && issue.defect.reportColumn === startCol) {
                return true;
            }
        }
        return false;
    }

    private objectNeedCheck(node: ts.Node, forParentNode: ts.Node, scopeNode?: ts.Node): CheckMember[] {
        if (ts.isModuleDeclaration(node)) {
            if (node.name?.text) {
                return [{ name: node.name?.text, node: node, nameNode: node.name, forParentNode: forParentNode, type: CheckType.namespace}];
            }
        } else if (ts.isClassDeclaration(node)) {
            if (node.name?.text) {
                return [{ name: node.name?.text, node: node, nameNode: node.name, forParentNode: forParentNode, type: CheckType.class}];
            }
        } else if (ts.isInterfaceDeclaration(node)) {
            if (node.name?.text) {
                return [{ name: node.name?.text, node: node, nameNode: node.name, forParentNode: forParentNode, type: CheckType.interface}];
            }
        } else if (ts.isTypeAliasDeclaration(node)) {
            if (node.name?.text) {
                return [{ name: node.name?.text, node: node, nameNode: node.name, forParentNode: forParentNode, type: CheckType.typeAlias}];
            }
        } else if (ts.isVariableStatement(node)) {
            return this.getVariableStatementNodes(node, forParentNode);
        } else { // 太长，分成两个函数
            return this.objectNeedCheckContinuous(node, forParentNode, scopeNode);
        }
        return [];
    }

    private objectNeedCheckContinuous(node: ts.Node, forParentNode: ts.Node, scopeNode?: ts.Node): CheckMember[] {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
            return this.getFunctionNodes(node, node);
        } else if (ts.isEnumDeclaration(node)) {
            if (node.name?.text) {
                return [{ name: node.name?.text, nameNode: node.name, node: node, forParentNode: forParentNode, type: CheckType.enum }];
            }
        } else if (ts.isSwitchStatement(node)) {
            return this.getSwitchCaseNodes(node, forParentNode);
        } else if (ts.isIfStatement(node)) {
            return this.getIfNodes(node, forParentNode);
        } else if (ts.isBlock(node)) {
            return (node.getChildren().length === 3) ? this.getSyntaxListNodes(node.getChildren()[1], forParentNode) : [];
        } else if (ts.isParameter(node)) {
            return [{ name: node.name.getText(), nameNode: node.name, node: node, forParentNode: forParentNode, type: CheckType.param }];
        } else if (ts.isVariableDeclarationList(node)) {
            return this.getVariableDeclarationListNode(node, forParentNode);
        } else if (ts.isForStatement(node)) {
            return this.getForStatementNodes(node);
        } else if (ts.isImportDeclaration(node)) {
            return this.getImportDeclarationNodes(node, node);
        } else if (ts.isWhileStatement(node)) {
            return this.getWhileNodesImplement(node, node);
        } else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
            return this.getForNodes(node, node);
        } else if (ts.isImportEqualsDeclaration(node)) {
            return this.getImportEqualsDeclarationNode(node);
        }
        return [];
    }

    private getVariableDeclarationListNode(node: ts.VariableDeclarationList, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        let onlyAllowVar = false;
        if (forParentNode.kind === ts.SyntaxKind.ForStatement) {
            onlyAllowVar = true;
        } else if (node.parent.kind === ts.SyntaxKind.ForStatement) {
            onlyAllowVar = true;
        }
        // 如果是for循环，只检查var声明的变量
        for (const declaration of node.declarations) {
            const nameNode = declaration.name;
            if (ts.isArrayBindingPattern(nameNode)) {
                members = members.concat(this.getBindNameNodeMember(nameNode, forParentNode));
            } else if (ts.isObjectBindingPattern(nameNode)) {
                for (const element of nameNode.elements) {
                    members.push({ name: element.name.getText(), nameNode: element.name, node: element,
                        forParentNode: forParentNode.parent, type: CheckType.vars, scopeNode: node.parent.parent });
                }
            } else {
                const varDeclare = node.getText().startsWith('var ');
                if (!(onlyAllowVar && !varDeclare)) {
                    members.push({ name: declaration.name.getText(), nameNode: declaration.name, node: declaration,
                        forParentNode: forParentNode, type: (varDeclare ? CheckType.variable : CheckType.vars), scopeNode: node.parent.parent });
                }
            }
        }

        return members;
    }

    private getBindNameNodeMember(nameNode: ts.ArrayBindingPattern, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        for (const element of nameNode.elements) {
            if (ts.isBindingElement(element)) {
                members.push({ name: element.name.getText(), nameNode: element.name, node: element,
                    forParentNode: forParentNode.parent, type: CheckType.vars });
            }
        }
        return members;
    }

    private getImportEqualsDeclarationNode(aNode: ts.ImportEqualsDeclaration): CheckMember[] {
        let members: CheckMember[] = [];
        const children = aNode.getChildren();
        if (children.length > 1 && children[1].kind === ts.SyntaxKind.Identifier) {
            const idNode = children[1];
            if (ts.isIdentifier(idNode)) {
                members.push({ name: idNode.getText(), nameNode: idNode, node: aNode, forParentNode: aNode, type: CheckType.import });
            }
        }
        return members;
    }

    private getFunctionNodes(node: ts.FunctionDeclaration | ts.FunctionExpression, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        if (!node.body) {
            return members;
        }
        if (node.getChildren()[0].getText() === 'declare') {
            return members;
        }
        if (node.name?.text) {
            members.push({ name: node.name?.text, nameNode: node.name, node: node, forParentNode: forParentNode, type: CheckType.function });
        }
        return members;
    }

    private getImportDeclarationNodes(node: ts.ImportDeclaration, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        if (node.importClause?.name?.text) { // import Type from 'foo';
            members.push({ name: node.importClause?.name?.text, nameNode: node.importClause?.name, node: node,
                forParentNode: forParentNode, type: CheckType.import, scopeNode: forParentNode.parent });
        }

        // 对如下样例代码的检查：import type { Type } from 'foo';
        const namedBindings = node.importClause?.namedBindings;
        if (!namedBindings) {
            return members;
        }
        const children = namedBindings.getChildren();
        for (const child of children) {
            if (child.kind === ts.SyntaxKind.SyntaxList) {
                members = members.concat(this.getImportNodes(node, children[1], forParentNode));
            } else if (ts.isIdentifier(child)) {
                members.push({ name: child.getText(), nameNode: child, node: node, forParentNode: forParentNode, type: CheckType.import });
            }
        }

        return members;
    }

    private getImportNodes(node: ts.Node, aNode: ts.Node, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        for (const child of aNode.getChildren()) {
            if (ts.isImportSpecifier(child)) {
                members.push({ name: child.name.text, nameNode: child.name, node: node, forParentNode: forParentNode, type: CheckType.import });
            }
        }
        return members;
    }

    private getVariableStatementNodes(aNode: ts.VariableStatement, forParentNode: ts.Node): CheckMember[] {
        let declarationList = aNode.declarationList.declarations;
        if (declarationList.length === 0) {
            return [];
        }
        let members: CheckMember[] = [];
        for (const variableDeclarator of declarationList) {
            let varName = variableDeclarator.name;
            if (ts.isIdentifier(varName)) {
                const varDeclare = aNode.getText().startsWith('var ');
                members.push({ name: varName.text, nameNode: varName, node: aNode, forParentNode: forParentNode,
                    type: (varDeclare ? CheckType.variable : CheckType.vars), scopeNode: aNode.parent });
            } else if (ts.isObjectBindingPattern(varName)) {
                for (const element of varName.elements) {
                    const obj = {name: element.name.getText(), nameNode: element.name, node: element,
                        forParentNode: forParentNode.parent, type: CheckType.variable, scopeNode: aNode.parent};
                    members.push(obj);
                }
            } else if (ts.isArrayBindingPattern(varName)) {
                members = members.concat(this.getArrayBindingPatternNode(varName, aNode, forParentNode));
            }
        }
        return members;
    }

    private getArrayBindingPatternNode(varName: ts.ArrayBindingPattern, aNode: ts.Node, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        for (const element of varName.elements) {
            if (ts.isBindingElement(element)) {
                members.push({ name: element.name.getText(), nameNode: element.name, node: element,
                    forParentNode: forParentNode.parent, type: CheckType.vars, scopeNode: aNode.parent });
            }
        }
        return members;
    }

    private getIfNodes(aNode: ts.IfStatement, forParentNode: ts.Node): CheckMember[] {
        return this.getIfNodesImplement(aNode, forParentNode);
    }

    private getIfNodesImplement(aNode: ts.IfStatement, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        const thenStatement = aNode.thenStatement;
        if (ts.isBlock(thenStatement)) {
            if (thenStatement.getChildren().length === 3) {
                const syntaxNode = thenStatement.getChildren()[1];
                members = members.concat(this.getSyntaxListNodes(syntaxNode, forParentNode));
            }
        } else {
            members = members.concat(this.objectNeedCheck(thenStatement, forParentNode));
        }

        const elseStatement = aNode.elseStatement;
        if (elseStatement) {
            if (ts.isIfStatement(elseStatement)) {
                members = members.concat(this.getIfNodesImplement(elseStatement, forParentNode));
            } else if (ts.isBlock(elseStatement)) {
                if (thenStatement.getChildren().length === 3) {
                    const syntaxNode = thenStatement.getChildren()[1];
                    members = members.concat(this.getSyntaxListNodes(syntaxNode, forParentNode));
                }
            } else {
                members = members.concat(this.objectNeedCheck(elseStatement, forParentNode));
            }
        }
        return members;
    }

    private getWhileNodesImplement(aNode: ts.WhileStatement, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        const children = aNode.statement.getChildren();
        if (children.length === 3) {
            for (const child of children[1].getChildren()) {
                members = members.concat(this.objectNeedCheck(child, aNode));
            }
        }
        return members;
    }

    private getForNodes(aNode: ts.ForInOrOfStatement, forParentNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];
        if (ts.isVariableDeclarationList(aNode.initializer)) {
            const list = members.concat(this.objectNeedCheck(aNode.initializer, aNode));
            for (const checkMember of list) {
                if (checkMember.type === CheckType.variable) {
                    members.push(checkMember);
                }
            }
        }

        const contents = aNode.statement.getChildren();
        if (contents.length === 3) {
            const content = contents[1];
            for (const child of content.getChildren()) {
                members = members.concat(this.objectNeedCheck(child, aNode, aNode.parent));
            }
        } else {
            const content = aNode.statement;
            members = members.concat(this.objectNeedCheck(content, aNode, aNode.parent));
        }

        return members;
    }

    private getForStatementNodes(aNode: ts.ForStatement): CheckMember[] {
        let members: CheckMember[] = [];
        const contents = aNode.statement.getChildren();
        if (contents.length === 3) {
            const content = contents[1];
            for (const child of content.getChildren()) {
                members = members.concat(this.objectNeedCheck(child, aNode, aNode.parent));
            }
        } else {
            const content = aNode.statement;
            members = members.concat(this.objectNeedCheck(content, aNode, aNode.parent));
        }
        if (aNode.initializer && ts.isVariableDeclarationList(aNode.initializer)) {
            const list = this.objectNeedCheck(aNode.initializer, aNode, aNode.parent);
            for (const member of list) {
                if (member.type === CheckType.variable) {
                    members.push(member);
                }
            }
        }
        return members;
    }

    private getSwitchCaseNodes(aNode: ts.Node, forParentNode: ts.Node): CheckMember[] {
        const caseNode = this.getSpecifyChild(aNode, ts.SyntaxKind.CaseBlock);
        if (!caseNode) {
            return [];
        }

        const syntaxNode = this.getSpecifyChild(caseNode, ts.SyntaxKind.SyntaxList);
        if (!syntaxNode) {
            return [];
        }

        let memberList: CheckMember[] = [];
        for (const child of syntaxNode.getChildren()) {
            if (!ts.isCaseOrDefaultClause(child)) {
                continue;
            }
            memberList = memberList.concat(this.getCaseOrDefaultClauseNodes(child, forParentNode));
        }

        return memberList;
    }

    private getCaseOrDefaultClauseNodes(child: ts.CaseOrDefaultClause, forParentNode: ts.Node): CheckMember[] {
        let memberList: CheckMember[] = [];
        for (const childElement of child.statements) {
            const members = this.objectNeedCheck(childElement, forParentNode);
            for (const member of members) {
                if (member.type === CheckType.variable) {
                    memberList.push(member);
                }
            }
        }
        return memberList;
    }

    private getSyntaxListNodes(aNode: ts.Node, forParentNode: ts.Node): CheckMember[] {
        let memberList: CheckMember[] = [];
        for (const child of aNode.getChildren()) {
            if (ts.isVariableStatement(child)) {
                const member = this.objectNeedCheck(child, forParentNode);
                memberList = memberList.concat(member);
            }
        }
        return memberList;
    }

    private isBuiltinKeyword(keyword: string): boolean {
        if (this.builtinGlobals) {
            if (this.defaultTypes.includes(keyword)) {
                return true;
            }
        }
        return false;
    }

    private needCheckIgnoreDeclarationMerge(firstNode: CheckMember, secondNode: CheckMember): boolean {
        if (this.ignoreDeclarationMerge) {
            if ((firstNode.type === CheckType.interface && secondNode.type === CheckType.interface) ||
                (firstNode.type === CheckType.namespace && secondNode.type === CheckType.namespace) ||
                (firstNode.type === CheckType.class && secondNode.type === CheckType.interface) ||
                (firstNode.type === CheckType.interface && secondNode.type === CheckType.class) ||
                (firstNode.type === CheckType.class && secondNode.type === CheckType.namespace) ||
                (firstNode.type === CheckType.namespace && secondNode.type === CheckType.class) ||
                (firstNode.type === CheckType.interface && secondNode.type === CheckType.namespace) ||
                (firstNode.type === CheckType.namespace && secondNode.type === CheckType.interface) ||
                (firstNode.type === CheckType.enum && secondNode.type === CheckType.namespace) ||
                (firstNode.type === CheckType.namespace && secondNode.type === CheckType.enum))
            {
                return false;
            }
        }
        return true;
    }

    private checkGlobals(sourceFile: ts.SourceFile, targetFile: ArkFile): void {
        let commentsListList: GlobalMember[][] = [];
        const comments = this.getComments(sourceFile, targetFile.getFilePath());
        for (const comment of comments) {
            let position = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos);

            const commentText = sourceFile.getFullText().substring(comment.pos, comment.end);
            if (comment.kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
                continue;
            }

            if (commentText.length < 5) {
                continue;
            }

            let content = commentText.substring(2, commentText.length - 2);
            if (this.isGlobal(content)) {
                continue;
            }

            // 找出前面空格数
            let spaceCount = this.getLeftSpace(content);
            content = content.substring(spaceCount);

            const contentIndex = 2 + spaceCount;
            const aSourceFile = AstTreeUtils.getASTNode(targetFile.getName(), content);
            const sourceFileObject = ts.getParseTreeNode(aSourceFile);
            if (sourceFileObject === undefined) {
                continue;
            }

            let children = sourceFileObject.getChildren();
            if (children.length !== 2) {
                continue;
            }

            children = children[0].getChildren();
            const commentsList = this.getCommonList(sourceFile, targetFile, aSourceFile, position, contentIndex, children);
            if (commentsList.length > 0) {
                commentsListList.push(commentsList);
            }

        }

        this.handleCommonListList(commentsListList, targetFile);
    }

    private getCommonList(sourceFile: ts.SourceFile, targetFile: ArkFile, aSourceFile: ts.SourceFile, position: ts.LineAndCharacter,
                          contentIndex:number, children: ts.Node[]): GlobalMember[] {
        let commentsList: GlobalMember[] = [];
        let previousGlobals = false;
        for (let idx = 0; idx < children.length; idx++) {
            const child = children[idx];
            if (this.keywordList.includes(child.getText())) {
                previousGlobals = true;
                continue;
            }
            if (ts.isLabeledStatement(child)) {
                const result = this.getLabeledStatement(sourceFile, targetFile, aSourceFile, position, contentIndex, child, previousGlobals);
                if (!result.needContinue && result.member) {
                    commentsList.push(result.member);
                }
            } else if (ts.isExpressionStatement(child)) {
                const result = this.handleExpressStatement(sourceFile, targetFile, aSourceFile, position, contentIndex, child, previousGlobals, idx);
                commentsList = commentsList.concat(result.members);
                previousGlobals = result.previousGlobals;
            }
        }
        return commentsList;
    }

    private handleExpressStatement(sourceFile: ts.SourceFile, targetFile: ArkFile, aSourceFile: ts.SourceFile,
                                   position: ts.LineAndCharacter, contentIndex: number, child: ts.ExpressionStatement, previousGlobals: boolean,
                                   idx: number): {previousGlobals: boolean, members: GlobalMember[] } {
        let commentsList: GlobalMember[] = [];
        for (const nodeElement of child.getChildren()) {
            let inPreviousGlobals = false;
            if (ts.isBinaryExpression(nodeElement)) {
                const result = this.handleBinaryExpression(sourceFile, targetFile, aSourceFile,
                    position, contentIndex, nodeElement, previousGlobals, inPreviousGlobals);
                commentsList = commentsList.concat(result.members);
                previousGlobals = result.previousGlobals;
                inPreviousGlobals = result.inPreviousGlobals;
            }
            if (ts.isIdentifier(nodeElement)) {
                if (this.keywordList.includes(nodeElement.getText())) {
                    previousGlobals = true;
                } else {
                    const pos = this.getNodePosition(aSourceFile, nodeElement, position.line, position.character + contentIndex);
                    if (this.checkBuiltIn(targetFile, sourceFile, nodeElement.getText(), pos.line, pos.character, CheckType.global, nodeElement)) {
                        continue;
                    }
                    if (idx === 1 && previousGlobals) {
                        commentsList.push({
                            sourceFile: aSourceFile,
                            node: nodeElement,
                            position: position,
                            contentIndex: contentIndex
                        });
                        previousGlobals = false;
                        inPreviousGlobals = false;
                    }
                }
            }
            previousGlobals = inPreviousGlobals || (ts.isIdentifier(nodeElement) && this.keywordList.includes(nodeElement.getText()));
        }
        return {previousGlobals: previousGlobals, members: commentsList};
    }

    private handleBinaryExpression(sourceFile: ts.SourceFile, targetFile: ArkFile, aSourceFile: ts.SourceFile, position: ts.LineAndCharacter,
                                   contentIndex:number, nodeElement: ts.BinaryExpression, previousGlobals: boolean,
                                   inPreviousGlobals: boolean): {previousGlobals: boolean, inPreviousGlobals: boolean, members: GlobalMember[] } {
        let commentsList: GlobalMember[] = [];
        const nodeElementChildren = this.getBinaryExpressionChildren(nodeElement);
        for (let i = 0; i < nodeElementChildren.length; i++) {
            const element = nodeElementChildren[i];
            const pos = this.getNodePosition(aSourceFile, element, position.line, position.character + contentIndex);
            if (!this.checkBuiltIn(targetFile, sourceFile, element.getText(), pos.line, pos.character, CheckType.global, nodeElement)) {
                if (ts.isIdentifier(element) && (previousGlobals && i === 0)) {
                    commentsList.push({sourceFile: aSourceFile, node: element, position: position, contentIndex: contentIndex});
                    previousGlobals = false;
                }
                inPreviousGlobals = ts.isIdentifier(element) && this.keywordList.includes(element.getText());
            }
        }
        return {previousGlobals: previousGlobals, inPreviousGlobals: inPreviousGlobals, members: commentsList};
    }

    private getLabeledStatement(sourceFile: ts.SourceFile, targetFile: ArkFile, aSourceFile: ts.SourceFile, position: ts.LineAndCharacter, contentIndex:number,
                                child: ts.LabeledStatement, previousGlobals: boolean): {needContinue: boolean, member: GlobalMember | undefined } {
        let continueFlag = false;
        const pos = this.getNodePosition(sourceFile, child, position.line, position.character + contentIndex);
        if (this.checkBuiltIn(targetFile, aSourceFile, child.label.getText(), pos.line, pos.character, CheckType.globalLabel, child)) {
            continueFlag = true;
        }

        let member: GlobalMember | undefined;
        if (previousGlobals) {
            const element = child.label;
            member = {sourceFile: aSourceFile, node: element, position: position, contentIndex: contentIndex};
        }
        return {needContinue: continueFlag, member: member};
    }

    // 找出字符串前面空格数
    private getLeftSpace(content: string): number {
        let spaceCount = 0;
        for (const contentKey of content) {
            if (contentKey === ' ') {
                spaceCount = spaceCount + 1;
            } else if (contentKey === '\r\n') {
                spaceCount = spaceCount + 4;
            } else {
                break;
            }
        }
        return spaceCount;
    }

    private isGlobal(content: string): boolean {
        const globalKeyword = this.globalKeyword;
        const globalsKeyword = this.globalsKeyword;
        return (!content.startsWith(' ' + globalKeyword) && !content.startsWith('\r\n' + globalKeyword) &&
            !content.startsWith(' ' + globalsKeyword) && !content.startsWith('\r\n' + globalsKeyword) &&
            !content.startsWith(globalKeyword) && !content.startsWith('\r\n' + globalKeyword) &&
            !content.startsWith(globalsKeyword) && !content.startsWith('\r\n' + globalsKeyword));
    }

    private handleCommonListList(commentsListList: GlobalMember[][], targetFile: ArkFile): void {
        for (let i = 0; i < commentsListList.length; i++) {
            const list = commentsListList[i];
            for (let j = 0; j < list.length; j++) {
                const sourceNode = list[j];
                this.compareCommon(commentsListList, targetFile, i, sourceNode);
            }
        }
    }

    private compareCommon(commentsListList: GlobalMember[][], targetFile: ArkFile, index: number, sourceNode: GlobalMember): void {
        for (let m = 0; m < commentsListList.length; m++) {
            const listObject = commentsListList[m];
            if (m === index) {
                continue;
            }
            for (let n = 0; n < listObject.length; n++) {
                const nodeObject = listObject[n];
                if (nodeObject.node.getText() !== sourceNode.node.getText()) {
                    continue;
                }

                const sourceLine = sourceNode.position.line;
                const sourceCol = sourceNode.position.character + nodeObject.contentIndex;

                const line = nodeObject.position.line;
                const col = nodeObject.position.character + nodeObject.contentIndex;

                if (sourceLine < line || (sourceLine === line && sourceCol < col)) {
                    this.addGlobalNode(nodeObject.sourceFile, targetFile, nodeObject.node, line, col);
                }
            }
        }
    }

    private getBinaryExpressionChildren(aNode: ts.Node): ts.Node[] {
        let children: ts.Node[] = [];
        const nodeList = aNode.getChildren();
        for (const element of nodeList) {
            if (ts.isBinaryExpression(element)) {
                children = children.concat(this.getBinaryExpressionChildren(element));
            } else {
                if (ts.isIdentifier(element)) {
                    children.push(element);
                }
            }
        }
        return children;
    }

    private getNodePosition(sourceFile: ts.SourceFileLike, aNode: ts.Node, line: number, col: number): ts.LineAndCharacter {
        const originStartPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
        let startLine = originStartPosition.line + line;
        let startCol = 0;
        if (originStartPosition.line > 0) {
            startCol = originStartPosition.character;
        } else {
            startCol = originStartPosition.character + col;
        }
        startLine = startLine + 1;
        startCol = startCol + 1;
        return {line: startLine, character: startCol};
    }

    private addGlobalNode(sourceFile: ts.SourceFileLike, targetFile: ArkFile, aNode: ts.Node, line: number, col: number) {
        const position = this.getNodePosition(sourceFile, aNode, line, col);
        const message = "'" + aNode.getText() + "' is already defined.";
        this.addIssueReport(targetFile, position.line, position.character, 0, message);
    }

    // 获取文件中所有注释（包括前导、尾随和未附着的注释）
    private getComments(sourceFile: ts.SourceFile, filePath: string): ts.CommentRange[] {
        const text = sourceFile.text;
        const commentRanges: ts.CommentRange[] = [];
        const seenComments = new Set<string>(); // 用于去重

        const visitNode = (node: ts.Node) => {
            const processCommentRanges = (ranges: ts.CommentRange[] | undefined) => {
                if (!ranges) return;
                ranges.forEach((commentRange) => {
                    const key = `${commentRange.pos}-${commentRange.end}`;
                    if (!seenComments.has(key)) {
                        commentRanges.push(commentRange);
                        seenComments.add(key);
                    }
                });
            };

            const leadingComments = ts.getLeadingCommentRanges(text, node.pos);
            processCommentRanges(leadingComments);

            const trailingComments = ts.getTrailingCommentRanges(text, node.end);
            processCommentRanges(trailingComments);

            ts.forEachChild(node, visitNode);
        };

        visitNode(sourceFile);
        return commentRanges;
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);

        for (const issue of this.issues) {
            if (issue.defect.reportLine === line && issue.defect.reportColumn === startCol) {
                return;
            }
        }

        this.issues.push(new IssueReport(defect, undefined));

        // 对 issues 进行排序
        this.issues.sort((a, b) => {
            if (a.defect.reportLine === b.defect.reportLine) {
                return a.defect.reportColumn - b.defect.reportColumn;
            }
            return a.defect.reportLine - b.defect.reportLine;
        });

        RuleListUtil.push(defect);
    }
}