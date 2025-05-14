/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
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
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects } from '../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Rule } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoShadowCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-shadow.md',
    description: 'Disallow variable declarations from shadowing variables declared in the outer scope.'
};

type RuleOptions = {
    ignoreTypeValueShadow: boolean,
    ignoreFunctionTypeParameterNameValueShadow: boolean
}

enum CheckType {
    interface = 0,
    namespace = 1,
    class = 2,
    function = 3,
    enum = 4,
    typeAlias = 5,
    let = 6,
    var = 7,
    param = 8,
    import = 9,
    global = 10,
    globalLabel = 11,
    module = 12,
    const = 13
}

type CheckMember = {
    name: string,
    node: ts.Node,
    type: CheckType
};

export class NoShadowCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private ruleOptions: RuleOptions = { ignoreTypeValueShadow: true, ignoreFunctionTypeParameterNameValueShadow: true }

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    // 定义需要特殊处理的节点类型检查器
    private static readonly SPECIAL_NODE_CHECKS = [
        ts.isCatchClause,
        ts.isEnumMember,
        ts.isEnumDeclaration,
        ts.isGetAccessorDeclaration,
        ts.isSetAccessorDeclaration,
        ts.isForStatement,
    ] as const;

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile): void => {
        let options = this.rule.option;
        if (options.length > 0) {
            this.ruleOptions = options[0] as RuleOptions;
        }

        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject === undefined) {
            return;
        }

        this.loopNode(targetFile, sourceFile, sourceFileObject);
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (this.isObjectGlobal(child) || ts.isToken(child)) {
                continue;
            }
            this.checkObject(targetFile, sourceFile, child);

            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkObject(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const members = this.getCheckObject(targetFile, sourceFile, aNode);
        for (const member of members) {
            this.checkShadow(targetFile, sourceFile, member);
        }
    }

    // 获取需要检查的对象
    private getCheckObject(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): CheckMember[] {
        let members: CheckMember[] = [];

        if (ts.isParameter(aNode) || ts.isTypeParameterDeclaration(aNode)) {
            this.handleNamedNode(aNode, CheckType.param, members);
        } else if (ts.isTypeAliasDeclaration(aNode) || ts.isInterfaceDeclaration(aNode)) {
            members = members.concat(this.handleTypeNode(aNode));
        } else if (ts.isEnumMember(aNode)) {
            this.handleEnumMember(aNode, members);
        } else if (ts.isClassDeclaration(aNode) || ts.isClassExpression(aNode)) {
            this.handleNamedNode(aNode, CheckType.class, members);
        } else if (ts.isModuleDeclaration(aNode)) {
            this.handleNamedNode(aNode, CheckType.module, members);
        } else if (ts.isFunctionExpression(aNode) || ts.isFunctionDeclaration(aNode)) {
            this.handleNamedNode(aNode, CheckType.function, members);
        } else if (ts.isVariableDeclarationList(aNode)) {
            members = members.concat(this.getVariableDeclarationListNodes(aNode));
        } else if (ts.isTryStatement(aNode) || ts.isCatchClause(aNode)) {
            members = members.concat(this.getTryStatementNodes(aNode));
        } else if (ts.isEnumDeclaration(aNode)) {
            this.handleNamedNode(aNode, CheckType.enum, members);
        }

        return members;
    }

    // 处理单个命名节点
    private handleNamedNode(node: ts.Node & { name?: ts.Identifier | ts.StringLiteral | ts.BindingName }, type: CheckType, members: CheckMember[]): void {
        if (node.name) {
            const member = this.getBindingNameNode(node.name, type);
            if (member) {
                members.push(member);
            }
        }
    }

    // 处理枚举成员
    private handleEnumMember(node: ts.EnumMember, members: CheckMember[]): void {
        const member = this.getPropertyNameNode(node.name, CheckType.enum);
        if (member) {
            members.push(member);
        }
    }

    // 处理代码块中的变量声明
    private handleBlockStatements(block: ts.Block, members: CheckMember[]): void {
        if (!block?.statements?.length) {
            return;
        }

        // 使用 for...of 替代 for 循环，更简洁且性能更好
        for (const statement of block.statements) {
            if (ts.isVariableStatement(statement)) {
                members.push(...this.getVariableDeclarationListNodes(statement.declarationList));
            }
        }
    }

    private getTryStatementNodes(aNode: ts.TryStatement | ts.CatchClause): CheckMember[] {
        let members: CheckMember[] = [];

        // 提前进行类型检查
        if (!aNode) {
            return members;
        }
        if (ts.isTryStatement(aNode)) {
            // 处理 try 块
            if (aNode.tryBlock) {
                this.handleBlockStatements(aNode.tryBlock, members);
            }
            // 处理 finally 块
            if (aNode.finallyBlock) {
                this.handleBlockStatements(aNode.finallyBlock, members);
            }
        } else if (ts.isCatchClause(aNode)) {
            // 处理 catch 参数
            const { variableDeclaration, block } = aNode;
            if (variableDeclaration?.name) {
                this.handleNamedNode(variableDeclaration, CheckType.let, members);
            }
            // 处理 catch 块
            if (block) {
                this.handleBlockStatements(block, members);
            }
        }

        return members;
    }

    private handleTypeNode(aNode: ts.TypeAliasDeclaration | ts.InterfaceDeclaration): CheckMember[] {
        let members: CheckMember[] = [];
        let member: CheckMember | undefined = undefined;
        if (this.ruleOptions.ignoreTypeValueShadow) {
            if (ts.isTypeAliasDeclaration(aNode) && ts.isTypeQueryNode(aNode.type)) {
                member = this.getBindingNameNode(aNode.name, CheckType.typeAlias);
            }
        } else {
            member = this.getBindingNameNode(aNode.name, ts.isInterfaceDeclaration(aNode) ? CheckType.interface : CheckType.typeAlias);
        }
        if (member) {
            members.push(member);
        }
        return members;
    }

    private getVariableDeclarationListNodes(aNode: ts.VariableDeclarationList): CheckMember[] {
        let members: CheckMember[] = [];
        for (const declaration of aNode.declarations) {
            const member = this.getMember(aNode, declaration);
            if (member) {
                members.push(member);
            }
        }
        return members;
    }

    private getMember(child: ts.VariableDeclarationList, declaration: ts.VariableDeclaration): CheckMember | undefined {
        let member: CheckMember | undefined = undefined;
        const isVar = child.getText().startsWith('var');
        const isLet = child.getText().startsWith('let');
        const isConst = child.getText().startsWith('const');
        if (isVar) {
            member = this.getBindingNameNode(declaration.name, CheckType.var);
        } else if (isLet) {
            member = this.getBindingNameNode(declaration.name, CheckType.let);
        } else if (isConst) {
            member = this.getBindingNameNode(declaration.name, CheckType.const);
        }

        return member;
    }

    private getPropertyNameNode(nameNode: ts.PropertyName, type: CheckType): CheckMember | undefined {
        let member: CheckMember | undefined = undefined;

        if (ts.isIdentifier(nameNode)) {
            if (nameNode.escapedText) {
                if (nameNode.escapedText !== 'this') {
                    member = { name: nameNode.escapedText, node: nameNode, type: type };
                }
            }
        } else if (ts.isStringLiteral(nameNode)) {
            member = { name: nameNode.text, node: nameNode, type: type };
        } else if (ts.isNumericLiteral(nameNode)) {
            member = { name: nameNode.text, node: nameNode, type: type };
        } else if (ts.isComputedPropertyName(nameNode)) {
            member = { name: nameNode.getText(), node: nameNode, type: type };
        } else if (ts.isPrivateIdentifier(nameNode)) {
            if (nameNode.escapedText) {
                member = { name: nameNode.escapedText, node: nameNode, type: type };
            }
        }

        return member;
    }

    private getBindingNameNode(nameNode: ts.Identifier | ts.ArrayBindingPattern | ts.ObjectBindingPattern | ts.StringLiteral | ts.EnumDeclaration,
        type: CheckType): CheckMember | undefined {
        let member: CheckMember | undefined = undefined;

        if (ts.isIdentifier(nameNode)) {
            if (nameNode.escapedText) {
                if (nameNode.escapedText !== 'this') {
                    member = { name: nameNode.escapedText, node: nameNode, type: type };
                }
            }
        } else if (ts.isArrayBindingPattern(nameNode)) {
            for (const element of nameNode.elements) {
                if (ts.isBindingElement(element)) {
                    member = { name: element.name.getText(), node: element.name, type: type };
                }
            }
        } else if (ts.isObjectBindingPattern(nameNode)) {
            for (const element of nameNode.elements) {
                if (ts.isBindingElement(element)) {
                    member = { name: element.name.getText(), node: element.name, type: type };
                }
            }
        } else if (ts.isStringLiteral(nameNode)) {
            member = { name: nameNode.text, node: nameNode, type: type };
        }

        return member;
    }

    private isObjectGlobal(aNode: ts.Node): boolean {
        if (ts.isModuleDeclaration(aNode)) {
            const children = aNode.getChildren();
            if (children.length >= 2) {
                if (children[0].getText() === 'global' ||
                    (children[0].getText() === 'declare' && children[1].getText() === 'global')) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkShadow(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: CheckMember): void {
        const scopeNode = this.getNodeScopeNode(aNode.node, aNode.type);
        if (scopeNode) {
            this.checkShadowInParent(targetFile, sourceFile, aNode, scopeNode);
        }
    }

    private getNodeScopeNode(aNode: ts.Node, type: CheckType): ts.Node | undefined {
        let parentNode = aNode.parent;
        if (parentNode === undefined) {
            return undefined;
        }
        if (ts.isEnumMember(parentNode)) {
            return parentNode.parent;
        } else if ((parentNode.kind >= ts.SyntaxKind.ArrayLiteralExpression && parentNode.kind <= ts.SyntaxKind.DebuggerStatement) ||
            parentNode.kind === ts.SyntaxKind.SourceFile ||
            parentNode.kind === ts.SyntaxKind.FunctionDeclaration ||
            parentNode.kind === ts.SyntaxKind.TypeAliasDeclaration ||
            parentNode.kind === ts.SyntaxKind.InterfaceDeclaration ||
            parentNode.kind === ts.SyntaxKind.MethodDeclaration ||
            parentNode.kind === ts.SyntaxKind.Constructor ||
            parentNode.kind === ts.SyntaxKind.EnumDeclaration ||
            parentNode.kind === ts.SyntaxKind.ModuleDeclaration ||
            parentNode.kind === ts.SyntaxKind.ClassDeclaration) {
            const topScope = this.isTopScope(type);
            if ((ts.isForOfStatement(parentNode) ||
                ts.isFunctionDeclaration(parentNode) ||
                ts.isTypeAliasDeclaration(parentNode) ||
                ts.isInterfaceDeclaration(parentNode)) && !topScope) {
                parentNode = parentNode.getChildren()[0];
            }
            return parentNode;
        } else {
            return this.getNodeScopeNode(parentNode, type);
        }
    }

    private isTopScope(type: CheckType): boolean {
        return type === CheckType.function || type === CheckType.typeAlias || type === CheckType.interface || type === CheckType.module;
    }


    // 检查当前节点是否需要特殊处理
    private isSpecialNodeType(node: ts.Node): boolean {
        let current: ts.Node | undefined = node;

        // 向上遍历所有父节点
        while (current) {
            // 检查当前节点是否匹配任一特殊类型
            if (NoShadowCheck.SPECIAL_NODE_CHECKS.some(check => check(current!))) {
                return true;
            }
            current = current.parent;
        }

        return false;
    }

    // 修改后的 checkShadowInParent 方法
    private checkShadowInParent(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, currentNode: ts.Node): void {
        let parentNode: ts.Node | undefined = currentNode.parent;
        if (parentNode === undefined) {
            return;
        }

        let parentsNode: ts.Node[] = []; // 父节点和父节点的兄弟节点
        const parentParentNode = parentNode.parent;
        if (parentParentNode === undefined) {
            parentsNode.push(parentNode);
        } else {
            parentsNode = parentParentNode.getChildren();
        }

        let parents: ts.Node[] = this.getParentNodes(parentsNode, parentNode, sourceNode);

        for (const parent of parents) {
            // 如果找到同名的，则返回，避免找到多余的同名节点
            if (this.checkShadowInNodeChildren(targetFile, sourceFile, sourceNode, parent)) {
                return;
            }
        }

        this.checkShadowInParent(targetFile, sourceFile, sourceNode, parentNode);
    }

    private getParentNodes(parentsNode: ts.Node[], parentNode: ts.Node, sourceNode: CheckMember): ts.Node[] {
        let parents: ts.Node[] = [];
        for (const node of parentsNode) {
            if (ts.isToken(node)) {
                continue;
            }
            // 使用新的方法来判断特殊节点类型
            if (node.kind === ts.SyntaxKind.SourceFile && this.isSpecialNodeType(sourceNode.node)) {
                parents = this.getSourceFileChildren(node, parents);
                continue;
            }
            if (node.kind !== ts.SyntaxKind.SyntaxList) {
                parents.push(node);
                continue;
            }
            for (const nodeElement of node.getChildren()) {
                if (nodeElement !== parentNode || !this.isTopScope(sourceNode.type)) {
                    parents.push(nodeElement);
                }
            }
        }
        return parents;
    }

    private getSourceFileChildren(aNode: ts.Node, parents: ts.Node[]): ts.Node[] {
        let childrens = aNode.getChildren();
        for (const child of childrens) {
            if (ts.isToken(child)) {
                continue;
            }
            const childs = child.getChildren();
            for (const childElement of childs) {
                if (ts.isToken(childElement)) {
                    continue;
                }
                parents.push(childElement);
            }
        }
        return parents;
    }

    // 在这个节点的子节点内查找指定名称的节点
    private checkShadowInNodeChildren(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, currentNode: ts.Node): boolean {
        if (currentNode.kind === ts.SyntaxKind.SyntaxList || currentNode.kind === ts.SyntaxKind.SourceFile) {
            for (const child of currentNode.getChildren()) {
                if (this.checkShadowWithNode(targetFile, sourceFile, sourceNode, child)) {
                    return true;
                }
            }
        } else {
            if (this.checkShadowWithNode(targetFile, sourceFile, sourceNode, currentNode)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查当前节点是否与源节点同名
     * @param targetFile 目标文件
     * @param sourceFile 源文件
     * @param sourceNode 待上报的节点
     * @param aNode 遍历中的shadow节点
     * @returns 是否同名
     */
    private checkShadowWithNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, aNode: ts.Node): boolean {
        if (ts.isParameter(aNode)) {
            return this.checkParameter(targetFile, sourceFile, sourceNode, aNode);
        } else if (ts.isTypeAliasDeclaration(aNode) || ts.isInterfaceDeclaration(aNode) || ts.isVariableDeclaration(aNode) || ts.isClassDeclaration(aNode) ||
            ts.isFunctionExpression(aNode) || ts.isFunctionDeclaration(aNode) || ts.isModuleDeclaration(aNode) || ts.isEnumDeclaration(aNode)) {
            return this.checkCommon(targetFile, sourceFile, sourceNode, aNode);
        } else if (ts.isVariableStatement(aNode)) {
            return this.checkVariableStatement(targetFile, sourceFile, sourceNode, aNode);
        } else if (ts.isImportDeclaration(aNode)) {
            return this.checkImportDeclaration(targetFile, sourceFile, sourceNode, aNode);
        } else if (ts.isWhileStatement(aNode)) {
            return this.checkWhileStatement(targetFile, sourceFile, sourceNode, aNode);
        } else if (ts.isForStatement(aNode)) {
            return this.checkForStatement(targetFile, sourceFile, sourceNode, aNode);
        } else if (ts.isTypeParameterDeclaration(aNode)) {
            return this.checkTypeParameterDeclaration(targetFile, sourceFile, sourceNode, aNode);
        }
        return false;
    }

    private checkCommon(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember,
        aNode: ts.TypeAliasDeclaration | ts.InterfaceDeclaration | ts.VariableDeclaration | ts.ClassDeclaration |
            ts.FunctionExpression | ts.FunctionDeclaration | ts.ModuleDeclaration | ts.EnumDeclaration): boolean {
        if (aNode.name && aNode.name.getText() === sourceNode.name) {
            // 检查是否同级声明
            const isSameLevel = aNode.parent === sourceNode.node.parent?.parent;
            const parentIsInterface = this.isInInterfaceMethodOverload(sourceNode.node);
            const isOverloadImplementation = this.isOverloadImplementation(sourceNode.node, sourceNode);

            // 如果是同级的命名空间和枚举，或者是循环体内的函数，则不报错
            if (isSameLevel || parentIsInterface || isOverloadImplementation) {
                return false;
            }
            if (this.reportShadow(targetFile, sourceFile, sourceNode.node, aNode.name)) {
                return true;
            }
        }
        return false;
    }

    // 检查函数声明是否是重载实现或后续重载声明
    private isOverloadImplementation(node: ts.Node, sourceNode: CheckMember): boolean {
        if (sourceNode.type !== CheckType.function) {
            return false;
        }
        // 获取当前节点所在的函数作用域
        const functionDeclaration = this.getContainingFunction(node);
        if (!functionDeclaration) {
            return false;
        }
        // 获取函数所在的块级作用域
        const block: ts.Block = functionDeclaration.parent as ts.Block;
        if (!block) {
            return false;
        }

        let foundCurrentNode = false;
        let foundPreviousOverload = false;

        // 遍历块中的所有语句
        for (const statement of block.statements) {
            if (statement === functionDeclaration) {
                foundCurrentNode = true;
                // 如果在当前节点之前找到了同名函数声明，说明这是后续的重载声明
                return foundPreviousOverload;
            }
            // 检查是否是同名的函数声明
            if (!foundCurrentNode && ts.isFunctionDeclaration(statement) &&
                statement.name && statement.name.getText() === sourceNode.name) {
                foundPreviousOverload = true;
            }
        }
        return false;
    }

    private checkForStatement(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, aNode: ts.ForStatement): boolean {
        const members = this.getForStatementNodes(aNode.initializer);
        return this.memberReport(targetFile, sourceFile, sourceNode, members);
    }

    private memberReport(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, members: CheckMember[]): boolean {
        for (const member of members) {
            if (member.name === sourceNode.name) {
                return this.variableReport(targetFile, sourceFile, sourceNode, member);
            }
        }
        return false;
    }

    private variableReport(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, member: CheckMember): boolean {
        // 1. 检查是否在嵌套的循环中
        const isNestedLoop = this.isInNestedLoop(sourceNode.node);

        if (isNestedLoop) {
            // 在嵌套循环中，只有当内层不是 var 声明时才报错
            if (sourceNode.type !== CheckType.var) {
                if (this.reportShadow(targetFile, sourceFile, sourceNode.node, member.node)) {
                    return true;
                }
            }
        } else {
            // 在非嵌套循环中，当外层是 var 声明，内层是 let 或 const 时需要报错
            if (member.type === CheckType.var && (sourceNode.type === CheckType.let || sourceNode.type === CheckType.const)) {
                if (this.reportShadow(targetFile, sourceFile, sourceNode.node, member.node)) {
                    return true;
                }
            }
        }
        return false;
    }

    // 检查节点是否在嵌套循环中
    private isInNestedLoop(node: ts.Node): boolean {
        let loopCount = 0;
        let current = node;

        while (current.parent) {
            if (ts.isForStatement(current.parent) ||
                ts.isForInStatement(current.parent) ||
                ts.isForOfStatement(current.parent) ||
                ts.isWhileStatement(current.parent) ||
                ts.isDoStatement(current.parent)) {
                loopCount++;
                if (loopCount > 1) {
                    return true;
                }
            }
            current = current.parent;
        }

        return false;
    }

    private getForStatementNodes(aNode: ts.ForInitializer | undefined): CheckMember[] {
        const members: CheckMember[] = [];
        if (aNode === undefined) {
            return members;
        }
        if (ts.isVariableDeclarationList(aNode)) {
            members.push(...this.getVariableDeclarationListNodes(aNode));
        }
        return members;
    }

    private checkParameter(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, aNode: ts.ParameterDeclaration): boolean {
        const isInFunction = this.isInFunction(sourceNode.node);
        const isInFunctionMember = this.isInFunction(aNode);
        if (isInFunction && isInFunctionMember && isInFunction === isInFunctionMember) {
            return false;
        }
        if (aNode.name.getText() === sourceNode.name) {
            if (this.reportShadow(targetFile, sourceFile, sourceNode.node, aNode.name)) {
                return true;
            }
        }
        return false;
    }

    private checkTypeParameterDeclaration(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember,
        aNode: ts.TypeParameterDeclaration): boolean {
        const isTypeParameter = ts.isTypeParameterDeclaration(aNode);
        const isValueShadowing = !isTypeParameter && sourceNode.type !== CheckType.param;

        // 如果是类型参数与值变量重名，且配置为忽略，则不报错
        if (isValueShadowing && this.ruleOptions.ignoreFunctionTypeParameterNameValueShadow) {
            return false;
        }
        if (aNode.name.getText() === sourceNode.name) {
            if (this.reportShadow(targetFile, sourceFile, sourceNode.node, aNode.name)) {
                return true;
            }
        }
        return false;
    }

    // 检查参数是否在接口方法重载中 或者 函数重载的后续声明中
    private isInInterfaceMethodOverload(node: ts.Node): boolean {
        let current: ts.Node = node.parent;
        while (current) {
            // 检查是否在方法签名中
            if (ts.isMethodSignature(current) ||
                ts.isGetAccessorDeclaration(current) ||
                ts.isSetAccessorDeclaration(current)) {
                // 检查方法签名是否在接口声明中
                const parent = current.parent;
                if (parent && ts.isInterfaceDeclaration(parent)) {
                    return true;
                }
            }
            current = current.parent;
        }
        return false;
    }

    private checkImportDeclaration(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, aNode: ts.ImportDeclaration): boolean {
        if (aNode.importClause) {
            const ignoreNode = this.ruleOptions.ignoreTypeValueShadow && aNode.importClause.isTypeOnly;
            if (!ignoreNode) {
                const flag = this.handleImportDeclaration(targetFile, sourceFile, sourceNode, aNode);
                if (flag) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkVariableStatement(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, aNode: ts.VariableStatement): boolean {
        const members = this.getVariableDeclarationListNodes(aNode.declarationList);
        for (const member of members) {
            if (member.name === sourceNode.name) {
                const isSameScopeFlag = this.isSameScope(sourceNode.node, member.node);
                const isFunctionTypeParameter = this.isFunctionTypeParameter(sourceNode.node);
                // 检查是否在函数内部，以及是否存在同名参数
                const containingFunction = this.getContainingFunction(sourceNode.node);
                /**
                 *  如果是函数类型参数与值变量重名，且配置为忽略，则不报错
                 *  如果是同一个函数内，且sourceNode的type是 var 或者 enum ，则不报错
                 */
                if ((isSameScopeFlag && (sourceNode.type === CheckType.var || sourceNode.type === CheckType.enum)) ||
                    (isFunctionTypeParameter && this.ruleOptions.ignoreFunctionTypeParameterNameValueShadow) ||
                    ((sourceNode.type === CheckType.let || sourceNode.type === CheckType.const || sourceNode.type === CheckType.var) &&
                        containingFunction && this.hasSameNameParameter(containingFunction, sourceNode.name))) {
                    return false;
                }

                if (this.reportShadow(targetFile, sourceFile, sourceNode.node, member.node)) {
                    return true;
                }
            }
        }
        return false;
    }

    // 获取包含当前节点的最近的函数声明
    private getContainingFunction(node: ts.Node): ts.FunctionDeclaration | undefined {
        let current = node;
        while (current.parent) {
            current = current.parent;
            if (ts.isFunctionDeclaration(current)) {
                return current;
            }
        }
        return undefined;
    }

    // 检查函数是否有同名参数
    private hasSameNameParameter(func: ts.FunctionDeclaration, name: string): boolean {
        return func.parameters.some(param =>
            ts.isIdentifier(param.name) && param.name.text === name
        );
    }

    private isFunctionTypeParameter(node: ts.Node): boolean {
        let current = node;
        while (current.parent) {
            current = current.parent;
            if (current.kind === ts.SyntaxKind.FunctionType ||
                current.kind === ts.SyntaxKind.MethodSignature ||
                ts.isCallSignatureDeclaration(current)) {
                return true;
            }
        }
        return false;
    }

    private isInFunction(node: ts.Node): ts.Node | undefined {
        let current = node;
        while (current.parent) {
            current = current.parent;
            if (current.kind === ts.SyntaxKind.FunctionDeclaration ||
                current.kind === ts.SyntaxKind.FunctionExpression ||
                current.kind === ts.SyntaxKind.ArrowFunction) {
                return current;
            }
        }
        return undefined;
    }

    private checkWhileStatement(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember, aNode: ts.WhileStatement): boolean {
        const children = aNode.statement.getChildren();
        if (children.length !== 3) {
            return false;
        }
        for (const child of children[1].getChildren()) {
            const members = this.getVariableStatementNodes(child);
            for (const member of members) {
                if (member.name !== sourceNode.name) {
                    continue;
                }
                // 检查是否在循环体内的函数声明/表达式
                const isLoopFunction = this.isInLoop(member.node);
                if (isLoopFunction) {
                    continue;
                }
                if (this.reportShadow(targetFile, sourceFile, sourceNode.node, member.node)) {
                    return true;
                }
            }
        }
        return false;
    }

    private getVariableStatementNodes(aNode: ts.Node): CheckMember[] {
        if (!ts.isVariableStatement(aNode)) {
            return [];
        }
        let declarationList = aNode.declarationList;
        if (declarationList.declarations.length === 0) {
            return [];
        }

        let members: CheckMember[] = this.getVariableDeclarationListNodes(declarationList);
        return members;
    }

    private handleImportDeclaration(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: CheckMember,
        aNode: ts.ImportDeclaration): boolean | undefined {
        for (const child of aNode.importClause?.getChildren() ?? []) {
            if (ts.isToken(child)) {
                continue;
            }
            if (!ts.isNamedImports(child)) {
                continue;
            }
            for (const namedImport of child.elements) {
                if (this.ruleOptions.ignoreTypeValueShadow && namedImport.isTypeOnly) {
                    continue;
                }
                if (namedImport.name.getText() !== sourceNode.name) {
                    continue;
                }
                if (this.reportShadow(targetFile, sourceFile, sourceNode.node, namedImport.name)) {
                    return true;
                }
            }
        }
        return undefined;
    }

    private reportShadow(targetFile: ArkFile, sourceFile: ts.SourceFileLike, sourceNode: ts.Node, shadowNode: ts.Node): boolean {
        if (sourceNode === shadowNode) {
            return false;
        }

        const sourceStartPosition = ts.getLineAndCharacterOfPosition(sourceFile, sourceNode.getStart());
        const startLine = sourceStartPosition.line + 1;
        const startCol = sourceStartPosition.character + 1;

        const sourceEndPosition = ts.getLineAndCharacterOfPosition(sourceFile, sourceNode.getEnd());
        const sourceEnd = sourceEndPosition.character + 1;

        const shadowStartPosition = ts.getLineAndCharacterOfPosition(sourceFile, shadowNode.getStart());
        const shadowLine = shadowStartPosition.line + 1;
        const shadowCol = shadowStartPosition.character + 1;
        // 如果skipReportShadow返回true，则不报错
        if (this.skipReportShadow(sourceNode, shadowNode, startLine, startCol, shadowLine, shadowCol)) {
            return false;
        }

        const message = "'" + sourceNode.getText() + "' is already declared in the upper scope on line " + shadowLine + ' column ' + shadowCol + '.';

        this.addIssueReport(targetFile, startLine, startCol, sourceEnd, message);

        return true;
    }

    /**
     * 跳过报错
     * @param sourceNode 源节点
     * @param shadowNode 阴影节点
     * @param startLine 源节点开始行
     * @param startCol 源节点开始列
     * @param shadowLine 阴影节点开始行
     * @param shadowCol 阴影节点开始列
     * @returns 是否跳过报错
     */
    private skipReportShadow(sourceNode: ts.Node, shadowNode: ts.Node, startLine: number, startCol: number, shadowLine: number, shadowCol: number): boolean {
        const checkNodeStatic = this.isNodeInStatic(sourceNode);
        const shadowNodeFunction = this.isNodeInFunction(shadowNode);
        if (!checkNodeStatic || !shadowNodeFunction) {
            if (startLine < shadowLine || (startLine === shadowLine && startCol < shadowCol)) {
                return true;
            }
        }

        // 这种不报错：class S { static { var f; { var f; } } }
        const checkNodeVar = this.isNodeStartVar(sourceNode);
        const shadowNodeStatic = this.isNodeInStatic(shadowNode);
        const shadowNodeVar = this.isNodeStartVar(shadowNode);
        if (shadowNodeStatic && checkNodeStatic && shadowNodeStatic === checkNodeStatic && checkNodeVar && shadowNodeVar) {
            return true;
        }
        if (checkNodeStatic && checkNodeVar) {
            if (this.isStaticVarExist(sourceNode, checkNodeStatic)) {
                return true;
            }
        }
        return false;
    }

    // 检查静态代码块内的变量是否是同名的第一个：class S { static { var f; { var f; } } }
    private isStaticVarExist(aNode: ts.Node, staticNode: ts.Node): boolean {
        let nodes: ts.Node[] = [];
        this.getNodesForNode(staticNode, nodes);
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i] === aNode && i !== 0) {
                return true;
            }
        }
        return false;
    }

    private getNodesForNode(aNode: ts.Node, nodeList: ts.Node[]): void {
        for (const child of aNode.getChildren()) {
            if (!ts.isVariableDeclarationList(child)) {
                this.getNodesForNode(child, nodeList);
                continue;
            }
            for (const declaration of child.declarations) {
                const member = this.getMember(child, declaration);
                if (member) {
                    nodeList.push(member.node);
                }
            }
        }
    }

    private isNodeInStatic(aNode: ts.Node): ts.Node | undefined {
        return this.isNodeInKind(aNode, ts.SyntaxKind.ClassStaticBlockDeclaration);
    }

    private isNodeInFunction(aNode: ts.Node): ts.Node | undefined {
        return this.isNodeInKind(aNode, ts.SyntaxKind.FunctionDeclaration);
    }

    private isNodeInKind(aNode: ts.Node, kind: ts.SyntaxKind): ts.Node | undefined {
        const parent = aNode.parent;
        if (parent === undefined) {
            return undefined;
        }
        if (parent.kind === kind) {
            return parent;
        }
        return this.isNodeInStatic(parent);
    }

    private isNodeStartVar(aNode: ts.Node): boolean {
        const parent = aNode.parent;
        if (parent === undefined) {
            return false;
        }
        if (parent.kind === ts.SyntaxKind.VariableDeclarationList) {
            const children = parent.getChildren();
            const firstChild = children[0];
            if (firstChild.kind === ts.SyntaxKind.VarKeyword) {
                return true;
            }
        }
        return this.isNodeStartVar(parent);
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private isInLoop(node: ts.Node): boolean {
        let current = node;
        // 1. 首先向上查找到 VariableDeclaration 节点
        while (current && !ts.isVariableDeclaration(current)) {
            current = current.parent;
        }
        // 2. 如果找到了 VariableDeclaration，检查它的 initializer
        const initializer = current.initializer;
        if (initializer && (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer))) {
            // 3. 如果 initializer 是函数表达式，继续向上查找循环语句
            let parent: ts.Node | undefined = current.parent; // 明确声明类型
            while (parent) {
                if (ts.isWhileStatement(parent) ||
                    ts.isDoStatement(parent) ||
                    ts.isForStatement(parent) ||
                    ts.isForInStatement(parent) ||
                    ts.isForOfStatement(parent)) {
                    return true;
                }
                parent = parent.parent;
            }
        }

        return false;
    }

    // 获取最近的块级作用域父节点
    private getNearestScope(node: ts.Node): ts.Node | undefined {
        let current = node;
        while (current.parent) {
            current = current.parent;
            // 检查是否是块级作用域节点
            if (ts.isSourceFile(current) ||
                ts.isClassDeclaration(current) ||
                ts.isForStatement(current) ||
                ts.isForInStatement(current) ||
                ts.isForOfStatement(current) ||
                ts.isWhileStatement(current) ||
                ts.isDoStatement(current) ||
                ts.isFunctionDeclaration(current) ||
                ts.isModuleDeclaration(current) ||
                ts.isArrowFunction(current) ||
                ts.isFunctionExpression(current)) {
                return current;
            }
        }
        return undefined;
    }

    private isSameScope(node1: ts.Node, node2: ts.Node): boolean {
        const scope1 = this.getNearestScope(node1);
        const scope2 = this.getNearestScope(node2);

        // 如果两个节点都找到了作用域，且是同一个作用域
        return scope1 !== undefined &&
            scope2 !== undefined &&
            scope1 === scope2;
    }

}