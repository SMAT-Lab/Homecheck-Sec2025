/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'BraceStyleCheck');

enum BraceStyle {
    TBS1 = '1tbs',
    STROUSTRUP = 'stroustrup',
    ALLMAN = 'allman'
}

type Options = [
    BraceStyle,
    {
        /* true（默认 false）允许块的开始和结束括号位于同一行 */
        allowSingleLine: boolean;
    }
];

interface WarnInfo {
    line: number;
    startCol: number;
    endCol: number;
    message: string;
};

type MessageInfo = {
    nextLineIsOpen: string,
    sameLineIsOpen: string,
    blockIsSameLine: string,
    nextLineIsClose: string,
    singleLineIsClose: string,
    sameLineIsClose: string
};

// 用于存储遍历状态的接口
interface TraverseState {
    prevToken: ts.Node | null;
    closingCurly: ts.Node;
    sourceFile: ts.SourceFile;
}

interface NodeInfo {
    node: ts.Node; // 当前节点
    openingCurlyToken: ts.Node; // 左花括号
    closingCurlyToken: ts.Node; // 右花括号
    tokenBeforeOpeningCurly: ts.Node | null; // 左花括号 之前的 token
    tokenAfterOpeningCurly: ts.Node | null; // 左花括号 之后的 token
    tokenBeforeClosingCurly: ts.Node | null; // 右花括号 之前的 token
    tokenAfterClosingCurly: ts.Node | null; // 右花括号 之后的 token
}

export class BraceStyleCheck implements BaseChecker {
    public rule: Rule;
    private defaultOptions: Options = [BraceStyle.TBS1, { allowSingleLine: false }];
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private filePath: string = '';
    // 缓存常用的 SyntaxKind 判断结果
    private readonly specialBlockKinds = new Set([
        ts.SyntaxKind.ElseKeyword,
        ts.SyntaxKind.CatchKeyword,
        ts.SyntaxKind.FinallyKeyword
    ]);

    // 使用 WeakMap 缓存节点的行号信息，避免重复计算
    private readonly lineCache = new WeakMap<ts.Node, number>();

    public metaData: BaseMetaData = {
        severity: 1,
        ruleDocPath: 'docs/brace-style.md',
        description: 'Enforce consistent brace style for blocks.',
    };

    public messages: MessageInfo = {
        nextLineIsOpen: 'Opening curly brace does not appear on the same line as controlling statement.',
        sameLineIsOpen: 'Opening curly brace appears on the same line as controlling statement.',
        blockIsSameLine: 'Statement inside of curly braces should be on next line.',
        nextLineIsClose: 'Closing curly brace does not appear on the same line as the subsequent block.',
        singleLineIsClose: 'Closing curly brace should be on the same line as opening curly brace or on the line after the previous block.',
        sameLineIsClose: 'Closing curly brace appears on the same line as the subsequent block.'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };

        return [fileMatcherCb];
    };

    private getDefaultOption(): Options {
        if (this.rule && this.rule.option && this.rule.option.length > 0) {
            if (this.rule.option.length === 1) {
                this.rule.option.push({ allowSingleLine: false });
            }
            return this.rule.option as Options;
        }
        return [BraceStyle.TBS1, { allowSingleLine: false }];
    };

    public check = (target: ArkFile): void => {
        try {
            this.defaultOptions = this.getDefaultOption();
            let code = target.getCode();
            if (!code) {
                return;
            };
            this.filePath = target.getFilePath();

            if (this.filePath.endsWith('.ets')) {
                //   如果是ets文件需要将'struct ' 关键字替换为 ' class '在进行检查
                code = code.replace('struct ', ' class ');
            };

            const sourceFile = AstTreeUtils.getASTNode(target.getName(), code);
            this.checkAllBlocks(sourceFile);

        } catch (error) {
            logger.error(`Error occurred while checking file: ${target.getFilePath()}, Error: ${error}`);
        };
    };

    /**
     * AST 节点遍历函数，通过剪枝策略减少不必要的节点遍历
     * @param sourceFile 源文件
     * @param callback 遍历每个节点时执行的回调函数
     */
    private traverseAST(sourceFile: ts.SourceFile, callback: (node: ts.Node) => void): void {
        const nodesToCheck = new Set([
            ts.SyntaxKind.Block,
            ts.SyntaxKind.SourceFile,
            ts.SyntaxKind.CaseClause,
            ts.SyntaxKind.DefaultClause,
            ts.SyntaxKind.ClassDeclaration,
            ts.SyntaxKind.ClassExpression,
            ts.SyntaxKind.InterfaceDeclaration,
            ts.SyntaxKind.EnumDeclaration,
            ts.SyntaxKind.ModuleDeclaration,
            ts.SyntaxKind.NamespaceExportDeclaration,
            ts.SyntaxKind.ModuleBlock,
            ts.SyntaxKind.CaseBlock,
            ts.SyntaxKind.SwitchStatement
        ]);
        const traverse = (node: ts.Node): void => {
            if (nodesToCheck.has(node.kind)) {
                callback(node);
            }
            // 递归遍历子节点
            ts.forEachChild(node, traverse);
        };
        traverse(sourceFile);
    };

    private findBraceTokens(node: ts.Node, sourceFile: ts.SourceFile): [ts.Node | null, ts.Node | null] {
        let openBrace: ts.Node | null = null;
        let closeBrace: ts.Node | null = null;

        // 遍历所有子token
        const tokens = node.getChildren(sourceFile);
        for (const token of tokens) {
            if (token.kind === ts.SyntaxKind.OpenBraceToken) {
                openBrace = token;
            };
            if (token.kind === ts.SyntaxKind.CloseBraceToken) {
                closeBrace = token;
            };
        };

        return [openBrace, closeBrace];
    };

    // 检查所有花括号的位置
    checkAllBlocks(sourceFile: ts.SourceFile): void {
        this.traverseAST(sourceFile, (node): void => {
            if (ts.isBlock(node)) {
                const parent = node.parent;
                // 如果父节点不存在，或者父节点是源文件，说明这是一个独立代码块
                if (!parent ||
                    ts.isSourceFile(parent) ||
                    ts.isCaseClause(parent) ||
                    ts.isDefaultClause(parent) ||
                    ts.isBlock(parent)) {
                    return;
                };
            };

            if (ts.isBlock(node) ||
                ts.isClassDeclaration(node) ||
                ts.isClassExpression(node) ||
                ts.isInterfaceDeclaration(node) ||
                ts.isEnumDeclaration(node) ||
                ts.isModuleDeclaration(node) ||
                ts.isNamespaceExportDeclaration(node) ||
                ts.isModuleBlock(node) ||
                ts.isCaseBlock(node) ||
                ts.isSwitchStatement(node)) {
                // 获取左右花括号位置
                this.checkBraceExits(node, sourceFile);
            };
        });
    };

    checkBraceExits(node: ts.Node, sourceFile: ts.SourceFile): void {
        try {
            const [openBrace, closeBrace] = this.findBraceTokens(node, sourceFile);
            if (openBrace && closeBrace) {
                let nodeInfo: NodeInfo = {
                    node,
                    openingCurlyToken: openBrace,
                    closingCurlyToken: closeBrace,
                    tokenBeforeOpeningCurly: null,
                    tokenAfterOpeningCurly: null,
                    tokenBeforeClosingCurly: null,
                    tokenAfterClosingCurly: null,
                };
                this.validateCurlyPair(nodeInfo, sourceFile);
            }
        } catch (error) {
            logger.error(`Error checking block at position ${node.getStart()}:`, error);
        };
    };

    // 节点类型判断
    private nodeKindIsSpecialBlock(node: ts.Node): boolean {
        return this.specialBlockKinds.has(node.kind);
    };

    // 同行判断，使用缓存
    private isTokenOnSameLine(left: ts.Node | null, right: ts.Node | null): boolean {
        if (!left || !right) {
            logger.error(`Token node is null, please check.`);
            return false;
        };

        const getLineNumber = (node: ts.Node): number => {
            let line = this.lineCache.get(node);
            if (line === undefined) {
                line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line;
                this.lineCache.set(node, line);
            };
            return line;
        };

        return getLineNumber(left) === getLineNumber(right);
    };

    private validateCurlyPair(
        nodeInfo: NodeInfo,
        sourceFile: ts.SourceFile
    ): void {
        // 确保所有token都有效
        if (!nodeInfo.openingCurlyToken || !nodeInfo.closingCurlyToken) {
            return;
        };

        const style = this.defaultOptions[0] as BraceStyle;
        const allowSingleLine = this.defaultOptions[1].allowSingleLine;
        const isSingleLine = this.isTokenOnSameLine(nodeInfo.openingCurlyToken, nodeInfo.closingCurlyToken);


        // 获取左花括号前的token 
        nodeInfo.tokenBeforeOpeningCurly = this.findTokenBeforeOpeningCurly(nodeInfo.openingCurlyToken, sourceFile);
        // 获取右花括号前的token 
        nodeInfo.tokenBeforeClosingCurly = this.findTokenBeforeClosingCurly(nodeInfo.closingCurlyToken, sourceFile);
        // 获取左花括号后的token 
        nodeInfo.tokenAfterOpeningCurly = this.findTokenAfterOpeningCurly(nodeInfo.openingCurlyToken, sourceFile);
        // 获取右花括号后的token 
        nodeInfo.tokenAfterClosingCurly = this.findTokenAfterClosingCurly(nodeInfo.closingCurlyToken, sourceFile);

        // 检查是否是特殊块（else 或 catch 或 finally）
        const isSpecialBlock = nodeInfo.tokenAfterClosingCurly && this.nodeKindIsSpecialBlock(nodeInfo.tokenAfterClosingCurly);

        // 检查是否是完全单行的情况
        const isCompletelyOneLine = allowSingleLine &&
            ((style === BraceStyle.TBS1 && (!isSpecialBlock || this.isTokenOnSameLine(nodeInfo.closingCurlyToken, nodeInfo.tokenAfterClosingCurly))) ||
                (style === BraceStyle.STROUSTRUP && !isSpecialBlock)) &&
            isSingleLine && nodeInfo.tokenBeforeOpeningCurly && this.isTokenOnSameLine(nodeInfo.tokenBeforeOpeningCurly, nodeInfo.openingCurlyToken);

        // 如果是允许的单行情况，跳过检查
        if (isCompletelyOneLine) {
            return;
        };

        // 检查类声明和静态块
        if (ts.isClassDeclaration(nodeInfo.node) || ts.isClassStaticBlockDeclaration(nodeInfo.node)) {
            this.validateClassBraces(nodeInfo, style, allowSingleLine, isSingleLine, sourceFile);
            return;
        };

        // 检查左花括号位置
        this.validateOpeningBrace(nodeInfo, style, allowSingleLine, isSingleLine, sourceFile);

        // 检查块内语句
        this.validateBlockStatements(nodeInfo, style, allowSingleLine, isSingleLine, sourceFile);

        // 检查右花括号
        this.validateClosingBrace(nodeInfo, style, allowSingleLine, isSingleLine, isSpecialBlock, sourceFile);
    };

    private validateClassBraces(
        nodeInfo: NodeInfo,
        style: BraceStyle,
        allowSingleLine: boolean,
        isSingleLine: boolean,
        sourceFile: ts.SourceFile
    ): void {
        // 如果是允许单行且确实是单行的情况，跳过检查
        if (nodeInfo.tokenBeforeOpeningCurly &&
            this.shouldSkipClassValidation(allowSingleLine, isSingleLine, nodeInfo.tokenBeforeOpeningCurly, nodeInfo.openingCurlyToken)) {
            return;
        }

        // 检查开始花括号位置
        this.validateClassOpeningBrace(style, nodeInfo, sourceFile, isSingleLine, allowSingleLine);
        // 检查结束花括号位置
        this.validateClassClosingBrace(allowSingleLine, nodeInfo, sourceFile);
    };

    private shouldSkipClassValidation(
        allowSingleLine: boolean,
        isSingleLine: boolean,
        tokenBeforeOpeningCurly: ts.Node,
        openingCurlyToken: ts.Node
    ): boolean {
        return allowSingleLine && isSingleLine && this.isTokenOnSameLine(tokenBeforeOpeningCurly, openingCurlyToken);
    };

    private validateClassOpeningBrace(
        style: BraceStyle,
        nodeInfo: NodeInfo,
        sourceFile: ts.SourceFile,
        isSingleLine: boolean,
        allowSingleLine: boolean
    ): void {
        if (style === BraceStyle.ALLMAN) {
            this.handleAllmanOpeningBrace(nodeInfo, sourceFile, isSingleLine, allowSingleLine);
        } else {
            this.handleOtherStyleOpeningBrace(nodeInfo, sourceFile, isSingleLine, allowSingleLine);
        }
    }

    private handleAllmanOpeningBrace(
        nodeInfo: NodeInfo,
        sourceFile: ts.SourceFile,
        isSingleLine: boolean,
        allowSingleLine: boolean
    ): void {
        if (nodeInfo.tokenBeforeOpeningCurly && this.isTokenOnSameLine(nodeInfo.tokenBeforeOpeningCurly, nodeInfo.openingCurlyToken)) {
            this.addBraceStyleIssue(nodeInfo.openingCurlyToken, this.messages.sameLineIsOpen, sourceFile, nodeInfo.node);
        }
        if (this.skipSpecialBlockCheck(nodeInfo, allowSingleLine, isSingleLine)) {
            return;
        }
        if (nodeInfo.tokenAfterOpeningCurly && this.isTokenOnSameLine(nodeInfo.tokenAfterOpeningCurly, nodeInfo.openingCurlyToken)) {
            this.addBraceStyleIssue(nodeInfo.openingCurlyToken, this.messages.blockIsSameLine, sourceFile, nodeInfo.node);
        }

    }

    private handleOtherStyleOpeningBrace(
        nodeInfo: NodeInfo,
        sourceFile: ts.SourceFile,
        isSingleLine: boolean,
        allowSingleLine: boolean
    ): void {
        if (nodeInfo.tokenBeforeOpeningCurly && !this.isTokenOnSameLine(nodeInfo.tokenBeforeOpeningCurly, nodeInfo.openingCurlyToken)) {
            this.addBraceStyleIssue(nodeInfo.openingCurlyToken, this.messages.nextLineIsOpen, sourceFile, nodeInfo.node);
        }
        if (this.skipSpecialBlockCheck(nodeInfo, allowSingleLine, isSingleLine)) {
            return;
        }
        if (nodeInfo.tokenAfterOpeningCurly && this.isTokenOnSameLine(nodeInfo.tokenAfterOpeningCurly, nodeInfo.openingCurlyToken)) {
            this.addBraceStyleIssue(nodeInfo.openingCurlyToken, this.messages.blockIsSameLine, sourceFile, nodeInfo.node);
        }
    }

    private skipSpecialBlockCheck(
        nodeInfo: NodeInfo,
        allowSingleLine: boolean,
        isSingleLine: boolean,
    ): boolean {
        return (isSingleLine && allowSingleLine) && !this.isTokenOnSameLine(nodeInfo.tokenBeforeOpeningCurly, nodeInfo.openingCurlyToken);
    }

    private validateClassClosingBrace(
        allowSingleLine: boolean,
        nodeInfo: NodeInfo,
        sourceFile: ts.SourceFile
    ): void {
        if (!allowSingleLine || !this.isTokenOnSameLine(nodeInfo.openingCurlyToken, nodeInfo.closingCurlyToken)) {
            if (nodeInfo.tokenBeforeClosingCurly && this.isTokenOnSameLine(nodeInfo.tokenBeforeClosingCurly, nodeInfo.closingCurlyToken) &&
                nodeInfo.openingCurlyToken.end !== nodeInfo.closingCurlyToken.pos) {
                this.addBraceStyleIssue(nodeInfo.closingCurlyToken, this.messages.singleLineIsClose, sourceFile, nodeInfo.node);
            }
        }
    }

    private validateOpeningBrace(
        nodeInfo: NodeInfo,
        style: BraceStyle,
        allowSingleLine: boolean,
        isSingleLine: boolean,
        sourceFile: ts.SourceFile
    ): void {
        if (style === BraceStyle.ALLMAN) {
            this.validateAllManOpeningBrace(
                nodeInfo,
                allowSingleLine,
                isSingleLine,
                sourceFile
            );
        } else {
            this.validateNoAllManOpeningBrace(
                nodeInfo,
                style,
                allowSingleLine,
                isSingleLine,
                sourceFile
            );
        };
    };

    validateAllManOpeningBrace(
        nodeInfo: NodeInfo,
        allowSingleLine: boolean,
        isSingleLine: boolean,
        sourceFile: ts.SourceFile
    ): void {
        const flag = nodeInfo.tokenBeforeOpeningCurly && this.isTokenOnSameLine(nodeInfo.tokenBeforeOpeningCurly, nodeInfo.openingCurlyToken);
        if (flag && nodeInfo.tokenBeforeOpeningCurly === nodeInfo.openingCurlyToken) {
            this.addBraceStyleIssue(
                nodeInfo.openingCurlyToken,
                this.messages.sameLineIsOpen,
                sourceFile,
                nodeInfo.node
            );
        };
        // allman 风格：所有花括号都应该在新行，除非是允许的单行情况
        if (!allowSingleLine || !isSingleLine) {
            if (flag && nodeInfo.tokenBeforeOpeningCurly !== nodeInfo.openingCurlyToken) {
                this.addBraceStyleIssue(
                    nodeInfo.openingCurlyToken,
                    this.messages.sameLineIsOpen,
                    sourceFile,
                    nodeInfo.node
                );
            };
        };
    }

    private validateNoAllManOpeningBrace(
        nodeInfo: NodeInfo,
        style: BraceStyle,
        allowSingleLine: boolean,
        isSingleLine: boolean,
        sourceFile: ts.SourceFile
    ): void {
        // 1tbs和stroustrup风格的处理
        const isBlockWithParent = ts.isBlock(nodeInfo.node) &&
            (ts.isClassStaticBlockDeclaration(nodeInfo.node.parent) || ts.isIfStatement(nodeInfo.node.parent) ||
                ts.isFunctionDeclaration(nodeInfo.node.parent) || ts.isArrowFunction(nodeInfo.node.parent) ||
                ts.isMethodDeclaration(nodeInfo.node.parent));

        const needsNewLine = !allowSingleLine || !isSingleLine || (isBlockWithParent &&
            nodeInfo.tokenBeforeOpeningCurly && !this.isTokenOnSameLine(nodeInfo.tokenBeforeOpeningCurly, nodeInfo.openingCurlyToken));

        const isStroustrupException = style === BraceStyle.STROUSTRUP &&
            nodeInfo.tokenBeforeOpeningCurly?.kind === ts.SyntaxKind.CloseBraceToken;

        if (needsNewLine && !isStroustrupException && nodeInfo.tokenBeforeOpeningCurly &&
            (!this.isTokenOnSameLine(nodeInfo.tokenBeforeOpeningCurly, nodeInfo.openingCurlyToken) ||
                nodeInfo.tokenBeforeOpeningCurly === nodeInfo.openingCurlyToken)) {
            this.addBraceStyleIssue(
                nodeInfo.openingCurlyToken,
                this.messages.nextLineIsOpen,
                sourceFile,
                nodeInfo.node
            );
        }
    }

    private validateBlockStatements(
        nodeInfo: NodeInfo,
        style: BraceStyle,
        allowSingleLine: boolean,
        isSingleLine: boolean,
        sourceFile: ts.SourceFile
    ): void {
        // allman 风格需要特殊处理
        if (style === BraceStyle.ALLMAN && (!allowSingleLine || !isSingleLine)) {
            if (nodeInfo.tokenAfterOpeningCurly &&
                this.isTokenOnSameLine(nodeInfo.tokenAfterOpeningCurly, nodeInfo.openingCurlyToken)) {
                this.addBraceStyleIssue(
                    nodeInfo.openingCurlyToken,
                    this.messages.blockIsSameLine,
                    sourceFile,
                    nodeInfo.node
                );
            };
        } else if (style === BraceStyle.TBS1 && (!allowSingleLine || !isSingleLine)) {
            // 1tbs 风格：在不允许单行或是特殊块时检查
            if (nodeInfo.tokenAfterOpeningCurly &&
                this.isTokenOnSameLine(nodeInfo.tokenAfterOpeningCurly, nodeInfo.openingCurlyToken)) {
                this.addBraceStyleIssue(
                    nodeInfo.openingCurlyToken,
                    this.messages.blockIsSameLine,
                    sourceFile,
                    nodeInfo.node
                );
            };
        } else if (style === BraceStyle.STROUSTRUP && (!allowSingleLine || !isSingleLine)) {
            // stroustrup 风格且不允许单行时，检查块内语句位置
            if (nodeInfo.tokenAfterOpeningCurly &&
                this.isTokenOnSameLine(nodeInfo.tokenAfterOpeningCurly, nodeInfo.openingCurlyToken)) {
                this.addBraceStyleIssue(
                    nodeInfo.openingCurlyToken,
                    this.messages.blockIsSameLine,
                    sourceFile,
                    nodeInfo.node
                );
            };
        };
    };

    // 检查右花括号
    private validateClosingBrace(
        nodeInfo: NodeInfo,
        style: BraceStyle,
        allowSingleLine: boolean,
        isSingleLine: boolean,
        isSpecialBlock: boolean | null,
        sourceFile: ts.SourceFile
    ): void {
        // 检查右花括号与前一个token的关系
        this.validateClosingBraceSameLine(nodeInfo, allowSingleLine, sourceFile);

        // 检查右花括号与后续块的关系
        if (nodeInfo.tokenAfterClosingCurly && (!allowSingleLine || !isSingleLine || isSpecialBlock)) {
            this.validateClosingBraceAfterToken(style, isSpecialBlock, nodeInfo, sourceFile);
        };
    };

    private validateClosingBraceSameLine(
        nodeInfo: NodeInfo,
        allowSingleLine: boolean,
        sourceFile: ts.SourceFile
    ): void {
        const isAllmanWithSingleLine = allowSingleLine &&
            this.isTokenOnSameLine(nodeInfo.openingCurlyToken, nodeInfo.closingCurlyToken);

        if (nodeInfo.tokenBeforeClosingCurly &&
            (nodeInfo.tokenBeforeClosingCurly !== nodeInfo.openingCurlyToken) &&
            !isAllmanWithSingleLine &&
            this.isTokenOnSameLine(nodeInfo.tokenBeforeClosingCurly, nodeInfo.closingCurlyToken) &&
            nodeInfo.openingCurlyToken.end !== nodeInfo.closingCurlyToken.pos) {
            this.addBraceStyleIssue(
                nodeInfo.closingCurlyToken,
                this.messages.singleLineIsClose,
                sourceFile,
                nodeInfo.node
            );
        }
    }

    private validateClosingBraceAfterToken(
        style: BraceStyle,
        isSpecialBlock: boolean | null,
        nodeInfo: NodeInfo,
        sourceFile: ts.SourceFile
    ): void {
        if (style === BraceStyle.ALLMAN && isSpecialBlock &&
            this.isTokenOnSameLine(nodeInfo.closingCurlyToken, nodeInfo.tokenAfterClosingCurly)) {
            this.addBraceStyleIssue(
                nodeInfo.closingCurlyToken,
                this.messages.sameLineIsClose,
                sourceFile,
                nodeInfo.tokenAfterClosingCurly
            );
        } else if (style === BraceStyle.TBS1 && isSpecialBlock !== this.isTokenOnSameLine(nodeInfo.closingCurlyToken, nodeInfo.tokenAfterClosingCurly)) {
            this.addBraceStyleIssue(
                nodeInfo.closingCurlyToken,
                this.messages.nextLineIsClose,
                sourceFile,
                nodeInfo.tokenAfterClosingCurly
            );
        } else if (style === BraceStyle.STROUSTRUP && this.isTokenOnSameLine(nodeInfo.closingCurlyToken, nodeInfo.tokenAfterClosingCurly)) {
            this.addBraceStyleIssue(
                nodeInfo.closingCurlyToken,
                this.messages.sameLineIsClose,
                sourceFile,
                nodeInfo.tokenAfterClosingCurly
            );
        }
    }

    /**
     * 获取左花括号前的token
     */
    private findTokenBeforeOpeningCurly(openingCurly: ts.Node, sourceFile: ts.SourceFile): ts.Node | null {
        // 获取父节点的所有子节点
        const siblings = openingCurly.parent.getChildren(sourceFile);

        // 找到左花括号的位置
        let curlyIndex = siblings.findIndex(node => node === openingCurly);

        if (!curlyIndex) {
            // 获取父节点的父节点的所有子节点
            const parentSiblings = openingCurly.parent.parent?.getChildren(sourceFile);
            if (parentSiblings) {
                // 在父层级中查找包含左花括号的节点
                curlyIndex = parentSiblings.findIndex(node =>
                    node.getChildren(sourceFile).some(child => child === openingCurly)
                );
                if (curlyIndex > 0) {
                    return parentSiblings[curlyIndex - 1];
                };
            };
            return openingCurly;
        };

        // 返回左花括号前的节点
        return siblings[curlyIndex - 1];
    };

    // 遍历节点，找到右花括号前的token
    private traverseNodeForClosingCurly(node: ts.Node, state: TraverseState): void {
        if (node === state.closingCurly) {
            return;
        }

        const lastToken = node.getLastToken(state.sourceFile);
        if (!lastToken && (ts.isCaseClause(node) || ts.isDefaultClause(node))) {
            const colonToken = node.getChildren(state.sourceFile).find(child =>
                child.kind === ts.SyntaxKind.ColonToken
            );
            if (colonToken &&
                colonToken.end < state.closingCurly.getStart() &&
                (!state.prevToken || colonToken.end > state.prevToken.end)) {
                state.prevToken = colonToken;
                return;
            }
        }

        const tokens = node.getChildren(state.sourceFile);
        for (const child of tokens) {
            if (child === state.closingCurly) {
                continue;
            }

            if (child.end < state.closingCurly.getStart() &&
                (!state.prevToken || child.end >= state.prevToken.end - 1)) {
                state.prevToken = child;
                // 处理 块中有且只有 ; 的情况
                state.prevToken = this.handleSpecialNode(node, state.prevToken);
            }
        }

        // 递归遍历子节点
        ts.forEachChild(node, child => this.traverseNodeForClosingCurly(child, state));
    }

    // 优化后的 findTokenBeforeClosingCurly 方法
    private findTokenBeforeClosingCurly(closingCurly: ts.Node, sourceFile: ts.SourceFile): ts.Node | null {
        const startNode = closingCurly.parent;
        if (!startNode) {
            return null;
        }

        const state: TraverseState = {
            prevToken: null,
            closingCurly,
            sourceFile
        };


        this.traverseNodeForClosingCurly(startNode, state);
        return state.prevToken;
    }

    /**
     * 处理特殊节点
     * @param node 当前节点
     * @param prevToken 前一个token
     * @param child 遍历到的token节点
     * @returns 
     */
    private handleSpecialNode(
        node: ts.Node,
        prevToken: ts.Node
    ): ts.Node {
        if (ts.isBlock(node) && node.statements.length === 1 &&
            node.statements[0].kind === ts.SyntaxKind.EmptyStatement &&
            node.statements[0].getText() === ';') {
            return node.statements[0];
        };
        return prevToken;
    }

    /**
     * 获取左花括号后的token
     */
    private findTokenAfterOpeningCurly(openingCurly: ts.Node, sourceFile: ts.SourceFile): ts.Node | null {
        const parent = openingCurly.parent;
        if (!parent) {
            return null;
        }

        // 直接遍历父节点的子节点，避免使用 findIndex
        const children = parent.getChildren(sourceFile);
        for (let i = 0; i < children.length; i++) {
            if (children[i] === openingCurly) {
                // 如果找到左花括号且不是最后一个节点
                if (i < children.length - 1) {
                    // 获取下一个节点的第一个有效token
                    const nextNode = children[i + 1];
                    return nextNode?.getFirstToken(sourceFile) || null;
                }
                break;
            }
        }

        return null;
    };

    // 获取父级if语句
    private getParentIfStatement(node: ts.Node): ts.IfStatement | null {
        let current = node.parent;
        while (current) {
            if (ts.isIfStatement(current)) {
                return current;
            };
            current = current.parent;
        };
        return null;
    };

    private handleIfStatement(ifStmt: ts.IfStatement, closingCurlyParent: ts.Node, sourceFile: ts.SourceFile): ts.Node | null {
        // 如果当前块是if的then块
        if (ifStmt.thenStatement && closingCurlyParent === ifStmt.thenStatement) {
            // 检查是否有else或else if
            if (ifStmt.elseStatement) {
                // 查找else关键字
                const elseToken = ifStmt.getChildren(sourceFile).find(child =>
                    child.kind === ts.SyntaxKind.ElseKeyword);
                return elseToken || null;
            };
        }
        // 如果当前块是else if的then块
        else if (ifStmt.elseStatement && ts.isIfStatement(ifStmt.elseStatement) &&
            closingCurlyParent === ifStmt.elseStatement.thenStatement) {
            // 检查后续是否还有else或else if
            if (ifStmt.elseStatement.elseStatement) {
                const elseToken = ifStmt.elseStatement.getChildren(sourceFile).find(child =>
                    child.kind === ts.SyntaxKind.ElseKeyword);
                return elseToken || null;
            };
        };
        return null;
    };

    private getParentTryStatement(node: ts.Node): ts.TryStatement | null {
        let current = node.parent;
        while (current) {
            if (ts.isTryStatement(current)) {
                return current;
            };
            current = current.parent;
        };
        return null;
    };

    private handleTryStatement(tryStmt: ts.TryStatement, closingCurlyParent: ts.Node, sourceFile: ts.SourceFile): ts.Node | null {
        // 如果当前块是try块
        if (closingCurlyParent === tryStmt.tryBlock) {
            if (tryStmt.catchClause) {
                const token = tryStmt.catchClause.getFirstToken(sourceFile);
                return token || null;
            } else if (tryStmt.finallyBlock) {
                const finallyToken = tryStmt.getChildren(sourceFile).find(child =>
                    child.kind === ts.SyntaxKind.FinallyKeyword);
                return finallyToken || null;
            };
        }
        // 如果当前块是catch块
        else if (tryStmt.catchClause && closingCurlyParent === tryStmt.catchClause.block) {
            if (tryStmt.finallyBlock) {
                const finallyToken = tryStmt.getChildren(sourceFile).find(child =>
                    child.kind === ts.SyntaxKind.FinallyKeyword);
                return finallyToken || null;
            };
        };
        return null;
    };

    /**
     * 获取右花括号后的token
     */
    private findTokenAfterClosingCurly(closingCurly: ts.Node, sourceFile: ts.SourceFile): ts.Node | null {
        // 缓存父节点，避免重复访问
        const parent = closingCurly.parent;
        if (!parent) {
            return null;
        }

        // 优先处理常见情况，避免不必要的复杂逻辑调用
        const siblings = parent.getChildren(sourceFile);
        const curlyIndex = siblings.findIndex(node => node === closingCurly);
        if (curlyIndex < siblings.length - 1) {
            return siblings[curlyIndex + 1];
        }

        // 特殊情况处理，减少不必要的递归调用
        const parentIfStmt = this.getParentIfStatement(closingCurly);
        if (parentIfStmt) {
            const nextNode = this.handleIfStatement(parentIfStmt, parent, sourceFile);
            if (nextNode) {
                return nextNode;
            }
        }

        const parentTryStmt = this.getParentTryStatement(closingCurly);
        if (parentTryStmt) {
            const nextNode = this.handleTryStatement(parentTryStmt, parent, sourceFile);
            if (nextNode) {
                return nextNode;
            }
        }

        return null;
    };

    private handleNextLineOpen(pos: number, end: number, braceStyle: BraceStyle, baseIndent: string,
        sourceFile: ts.SourceFile): RuleFix {
        if (braceStyle === BraceStyle.TBS1 || braceStyle === BraceStyle.STROUSTRUP) {
            const prevTokenEnd = sourceFile.text.lastIndexOf('\n', pos);
            // 左花括号应该和控制语句在同一行
            // 需要删除从上一行末尾到当前花括号位置的所有内容（包括换行和空白）
            return {
                range: [prevTokenEnd, end],
                text: ' {'
            };
        };
        return {
            range: [pos, end],
            // 对于类声明，保持与类名对齐
            text: baseIndent + '{'
        };
    };

    private handleNextLineClose(pos: number, end: number, braceStyle: BraceStyle, baseIndent: string,
        afterToken: ts.Node | null): RuleFix {
        if (braceStyle === BraceStyle.TBS1 && afterToken && this.nodeKindIsSpecialBlock(afterToken)) {
            return { range: [end, afterToken.getStart()], text: ' ' };
        };
        return {
            range: [pos, end],
            text: '\n' + baseIndent + '}'
        };
    };

    private handleSameLineOpen(pos: number, end: number, braceStyle: BraceStyle): RuleFix {
        if (braceStyle === BraceStyle.TBS1 || braceStyle === BraceStyle.STROUSTRUP) {
            return { range: [pos, end], text: ' {' };
        };
        return { range: [pos, pos], text: '\n' };
    };

    private handleSingleLineClose(pos: number, end: number, braceStyle: BraceStyle, afterToken: ts.Node | null): RuleFix {
        // 处理块内容与右花括号在同一行的情况
        if (braceStyle === BraceStyle.STROUSTRUP && afterToken && this.nodeKindIsSpecialBlock(afterToken)) {
            return {
                range: [pos, pos],
                text: '\n'
            };
        };
        return { range: [pos, end], text: '\n' + '}' };
    };

    private handleSameLineClose(pos: number, end: number, braceStyle: BraceStyle, baseIndent: string,
        newLineIndent: string, afterToken: ts.Node | null): RuleFix {
        // 处理右花括号与后续语句在同一行的情况
        if (braceStyle === BraceStyle.STROUSTRUP && afterToken && this.nodeKindIsSpecialBlock(afterToken)) {
            return {
                range: [end, end],
                text: '\n' + baseIndent
            };
        };
        return {
            range: [pos, end],
            text: baseIndent + '}\n' + newLineIndent
        };
    };

    private handleBlockSameLine(pos: number, end: number, braceStyle: BraceStyle): RuleFix {
        // 处理左花括号与语句在同一行的情况
        if (braceStyle === BraceStyle.ALLMAN) {
            return { range: [pos, pos], text: '\n' };
        };
        return {
            range: [end, end],
            text: '\n'
        };
    };

    private ruleFix(pos: number, end: number, message: string, sourceFile: ts.SourceFile, tokenNode: ts.Node, afterToken: ts.Node | null): RuleFix {
        const braceStyle = this.defaultOptions[0] as BraceStyle;
        // 基础缩进
        const baseIndent = '';
        // 换行后的缩进
        const newLineIndent = '  ';

        switch (message) {
            case this.messages.nextLineIsOpen:
                return this.handleNextLineOpen(pos, end, braceStyle, baseIndent, sourceFile);
            case this.messages.nextLineIsClose:
                return this.handleNextLineClose(pos, end, braceStyle, baseIndent, afterToken);
            case this.messages.sameLineIsOpen:
                return this.handleSameLineOpen(pos, end, braceStyle);
            case this.messages.singleLineIsClose:
                return this.handleSingleLineClose(pos, end, braceStyle, afterToken);
            case this.messages.sameLineIsClose:
                return this.handleSameLineClose(pos, end, braceStyle, baseIndent, newLineIndent, afterToken);
            case this.messages.blockIsSameLine:
                return this.handleBlockSameLine(pos, end, braceStyle);
            default:
                return { range: [-1, -1], text: '' };
        };
    };

    private addBraceStyleIssue(
        tokenNode: ts.Node,
        message: string,
        sourceFile: ts.SourceFile,
        afterToken: ts.Node | null,
    ): void {
        let pos = tokenNode.getStart();
        let end = tokenNode.getEnd();
        const position = sourceFile.getLineAndCharacterOfPosition(pos);
        const startCol = position.character + 1;
        let defect = this.addIssueReport({
            line: position.line + 1,
            startCol: startCol,
            endCol: startCol,
            message,
        });
        let fix: RuleFix = this.ruleFix(pos, end, message, sourceFile, tokenNode, afterToken);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    };

    private addIssueReport(warnInfo: WarnInfo): Defects {
        this.metaData.description = warnInfo.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        // 创建缺陷报告
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            this.filePath, this.metaData.ruleDocPath, true, false, true);
        return defect;
    };
}
