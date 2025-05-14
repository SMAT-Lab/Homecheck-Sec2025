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
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, Utils } from '../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Rule } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ConsistentTypeDefinitionsCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/consistent-type-definitions.md',
    description: 'TypeScript provides two common ways to define an object type: interface and type.'
};

export class ConsistentTypeDefinitionsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private issueMap: Map<string, IssueReport> = new Map();
    private enforceInterfaceMessage = 'Use an `interface` instead of a `type`.';
    private enforceTypeMessage = 'Use a `type` instead of an `interface`.';
    private enforceInterface = true;
    private enforceType = false;

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
        if (!targetFile.getFilePath().endsWith('.ts')) {
            return;
        }

        let options = this.rule.option;
        if (options.length > 0) {
            const option = options[0] as string[];
            if (option.includes('interface')) {
                this.enforceInterface = true;
                this.enforceType = false;
            } else if (option.includes('type')) {
                this.enforceInterface = false;
                this.enforceType = true;
            }
        }

        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject === undefined) {
            return;
        }

        this.loopNode(targetFile, sourceFile, sourceFileObject);

        this.reportSortedIssues();
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isTypeAliasDeclaration(child)) {
                this.checkType(sourceFile, child, targetFile);
            } else if (ts.isInterfaceDeclaration(child)) {
                this.checkInterface(sourceFile, child, targetFile);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkType(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile): void {
        if (this.enforceType) {
            return;
        }

        const children = node.getChildren();
        if (children.length < 2) {
            return;
        }

        const last = this.getTypeNode(children[children.length - 1]);
        const penultimate = this.getTypeNode(children[children.length - 2]);
        const isType = (last.kind === ts.SyntaxKind.SemicolonToken && penultimate.kind === ts.SyntaxKind.TypeLiteral) ||
            (last.kind === ts.SyntaxKind.TypeLiteral);
        if (!isType) {
            return;
        }

        // 查找Type名称
        let nameNode = undefined;
        for (const child of children) {
            if (ts.isIdentifier(child)) {
                nameNode = child;
                break;
            }
        }
        if (nameNode === undefined) {
            return;
        }

        this.checkTypeFix(sourceFile, node, targetFile, children, nameNode);
    }

    private checkTypeFix(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile, children: ts.Node[], nameNode: ts.Identifier): void {
        // fix
        let fix: RuleFix | undefined;
        let typeKeywordNode: ts.Node | undefined;
        let equalsTokenNode: ts.Node | undefined;
        let typeLiteralNode: ts.Node | undefined;

        // 找到type关键字节点、等号节点和类型字面量节点
        for (const child of children) {
            if (child.kind === ts.SyntaxKind.TypeKeyword) {
                typeKeywordNode = child;
            } else if (child.kind === ts.SyntaxKind.EqualsToken) {
                equalsTokenNode = child;
            } else if (child.kind === ts.SyntaxKind.TypeLiteral) {
                typeLiteralNode = child;
            }

            if (typeKeywordNode && equalsTokenNode) {
                break;
            }
        }

        if (typeKeywordNode && equalsTokenNode) {
            // 获取等号后的第一个非空格字符的位置
            let endPos = equalsTokenNode.getEnd();
            const nodeText = node.getText();
            const equalsEndOffset = equalsTokenNode.getEnd() - node.getStart();

            // 查找等号后的第一个非空格字符
            let hasSpaceAfterEquals = false;
            for (let i = equalsEndOffset; i < nodeText.length; i++) {
                if (nodeText[i] !== ' ' && nodeText[i] !== '\t') {
                    endPos = node.getStart() + i;
                    break;
                }
                hasSpaceAfterEquals = true;
            }

            const prefix = node.getText().substring(0, typeKeywordNode.getStart() - node.getStart()); // 前缀（如export）
            const identifier = node.getText().substring(typeKeywordNode.getEnd() - node.getStart(),
                nameNode.getEnd() - node.getStart()).trim(); // 标识符，去除可能的前后空格

            // 如果等号后没有空格，添加一个空格
            const spaceAfterEquals = hasSpaceAfterEquals ? '' : ' ';

            fix = {
                range: [node.getStart(), endPos],
                text: prefix + 'interface ' + identifier + ' ' + spaceAfterEquals
            };
        }

        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, nameNode.getStart());
        const defect = this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, this.enforceInterfaceMessage, fix);
        this.issueMap.set(defect.fixKey, { defect, fix });
    }

    // 去掉代码外层的括号
    private getTypeNode(aNode: ts.Node): ts.Node {
        if (aNode.kind === ts.SyntaxKind.ParenthesizedType) {
            const children = aNode.getChildren();
            if (children.length === 3) {
                return this.getTypeNode(children[1]);
            }
        }
        return aNode;
    }

    private checkInterface(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile): void {
        if (this.enforceInterface) {
            return;
        }

        // 查找Type名称
        let nameNode = undefined;
        for (const child of node.getChildren()) {
            if (ts.isIdentifier(child)) {
                nameNode = child;
                break;
            }
        }
        if (nameNode === undefined) {
            return;
        }

        this.checkInterfaceFix(sourceFile, node, targetFile, nameNode);
    }

    private checkInterfaceFix(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile, nameNode: ts.Identifier): void {
        // fix
        let fix: RuleFix | undefined;
        const inDeclareGlobal = this.isInDeclareGlobal(node);
        if (inDeclareGlobal) {
            // 不处理declare global中的接口
            return;
        }

        let interfaceKeywordNode: ts.Node | undefined;

        // 找到interface关键字节点
        for (const child of node.getChildren()) {
            if (child.kind === ts.SyntaxKind.InterfaceKeyword) {
                interfaceKeywordNode = child;
                break;
            }
        }

        if (!interfaceKeywordNode) {
            return;
        }

        const fullText = node.getText();
        const firstNodeText = node.getChildren()[0].getText();

        if (firstNodeText.startsWith('export') && firstNodeText.endsWith('default')) {
            // 处理export default情况
            const nameIndex = fullText.indexOf(nameNode.getText());

            // 查找接口体
            const bodyStart = fullText.indexOf('{');
            const bodyEnd = fullText.lastIndexOf('}') + 1;
            const bodyText = bodyStart >= 0 && bodyEnd > bodyStart ?
                fullText.substring(bodyStart, bodyEnd) :
                '{}';

            const fixText = 'type ' + fullText.substring(nameIndex, bodyStart).trim() + ' = ' + bodyText + '\r\n' + firstNodeText + ' ' + nameNode.getText();
            fix = { range: [node.getStart(), node.getEnd()], text: fixText };
        } else {
            // 普通接口转换
            // 获取interface前面的修饰符部分（如export）
            const prefix = fullText.substring(0, interfaceKeywordNode.getStart() - node.getStart());

            // 获取标识符及其后面到大括号前的所有内容
            const identifierText = fullText.substring(
                interfaceKeywordNode.getEnd() - node.getStart(),
                fullText.indexOf('{')
            ).trim();

            // 获取接口体部分
            const bodyStart = fullText.indexOf('{');
            const bodyEnd = fullText.lastIndexOf('}') + 1;
            const bodyText = bodyStart >= 0 && bodyEnd > bodyStart ?
                fullText.substring(bodyStart, bodyEnd) :
                '{}';

            // 构建修复文本
            fix = {
                range: [node.getStart(), node.getEnd()],
                text: prefix + 'type ' + identifierText + ' = ' + bodyText
            };
        }

        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, nameNode.getStart());
        const defect = this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, this.enforceTypeMessage, fix);
        this.issueMap.set(defect.fixKey, { defect, fix });
    }

    private isInDeclareGlobal(aNode: ts.Node): boolean {
        const parentNode = aNode.parent;
        if (!parentNode) {
            return false;
        }

        const reg = /declare[^\S\r\n]+global/g;
        if (parentNode.getText().match(reg)) {
            return true;
        }

        return this.isInDeclareGlobal(parentNode);
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string, fix: RuleFix | undefined): Defects {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
        return defect;
    }

    private reportSortedIssues(): void {
        if (this.issueMap.size === 0) {
            return;
        }

        const sortedIssues = Array.from(this.issueMap.entries())
            .sort(([keyA], [keyB]) => Utils.sortByLineAndColumn(keyA, keyB));

        this.issues = [];

        sortedIssues.forEach(([_, issue]) => {
            RuleListUtil.push(issue.defect);
            this.issues.push(issue);
        });
    }
}