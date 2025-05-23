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
import {Defects, Utils} from '../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../Index';
import {Rule} from '../../Index';
import {RuleListUtil} from '../../utils/common/DefectsList';
import {IssueReport} from '../../model/Defects';
import {RuleFix} from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ConsistentIndexedObjectStyleCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/consistent-indexed-object-style.md',
    description: 'Require or disallow the Record type.'
};

export class ConsistentIndexedObjectStyleCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private issueMap: Map<string, IssueReport> = new Map();
    private indexMessage = 'An index signature is preferred over a record.';
    private recordMessage = 'A record is preferred over an index signature.';
    private allowIndexSignature = false;
    private allowRecord = true;

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
        if (options.includes('index-signature')) {
            this.allowIndexSignature = true;
            this.allowRecord = false;
        } else if (options.includes('record')) {
            this.allowIndexSignature = false;
            this.allowRecord = true;
        } else {
            this.allowIndexSignature = false;
            this.allowRecord = true;
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
                this.checkRecord(sourceFile, child, targetFile);
                this.checkIndexSignature(sourceFile, child, targetFile);
            } else if (ts.isInterfaceDeclaration(child)) {
                this.checkIndexSignature(sourceFile, child, targetFile);
            } else if (ts.isFunctionDeclaration(child)) {
                this.checkRecord(sourceFile, child, targetFile);
                this.checkIndexSignature(sourceFile, child, targetFile);
            } else {
                this.loopNode(targetFile, sourceFile, child);
            }
        }
    }

    // 检查 IndexSignature
    private checkIndexSignature(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile): void {
        let contentList = this.getIndexSignatureContentList(sourceFile, node, targetFile);

        let indexSignature = contentList.length > 0;
        for (const child of contentList) {
            if (!ts.isIndexSignatureDeclaration(child)) {
                indexSignature = false;
                break;
            }
        }

        if (indexSignature && !this.allowIndexSignature) {
            let startPosition = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());

            // fix
            const result = this.getIndexSignatureFix(sourceFile, node, contentList);
            const fix = result.fix;
            if (result.startPosition) {
                startPosition = result.startPosition;
            }

            const defect = this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, this.recordMessage, fix);
            this.issueMap.set(defect.fixKey, {defect, fix});
        }
    }

    private getIndexSignatureFix(sourceFile: ts.SourceFileLike, node: ts.Node,
                                 contentList: ts.Node[]): {fix: RuleFix | undefined, startPosition: ts.LineAndCharacter | undefined} {
        let fix: RuleFix | undefined;
        let startPosition: ts.LineAndCharacter | undefined;
        if (ts.isTypeLiteralNode(node)) { // TypeAliasDeclaration | FunctionDeclaration
            // type Foo5 = { [key5: string]: string | Foo }; 改成 type Foo5 = Record<string, string | Foo>;
            const contentChildren = contentList[0].getChildren();
            const keyNode = contentChildren[1].getChildren()[0];
            if (ts.isParameter(keyNode)) {
                const keyType = keyNode.type;
                if (keyType) {
                    const keyTypeName = keyType.getText();
                    const value = contentChildren[4].getText();
                    const fixText = 'Record<' + keyTypeName + ', ' + value + '>';
                    fix = {range: [node.getStart(), node.getEnd()], text: fixText};
                }
            }
        } else if (ts.isInterfaceDeclaration(node)) { // interface Foo<T> { [key: string]: unknown; } 改成 type Foo<T> = Record<string, unknown>;
            const contentChildren = contentList[0].getChildren();
            const keyNode = contentChildren[1].getChildren()[0];
            if (ts.isParameter(keyNode) && keyNode.type) {
                const keyTypeName = keyNode.type.getText();
                const value = contentChildren[4].getText();
                // 类名
                let className = node.name.getText();
                let startName = false;
                const nodeList = node.getChildren();
                for (let i = 0; i < nodeList.length; i++) {
                    const obj = nodeList[i];
                    if (obj.kind === ts.SyntaxKind.LessThanToken) {
                        startName = true;
                    }
                    if (startName) {
                        className = className + obj.getText();
                    }
                    if (obj.kind === ts.SyntaxKind.GreaterThanToken) {
                        break;
                    }
                }
                let exportText: string = '';
                if (node.modifiers && node.modifiers.length > 0) {
                    exportText = node.modifiers[0].getText() + ' ';
                    startPosition = ts.getLineAndCharacterOfPosition(sourceFile, node.getChildren()[1].getStart());
                }
                const fixText = exportText + 'type ' + className + ' = Record<' + keyTypeName + ', ' + value + '>;';
                fix = {range: [node.getStart(), node.getEnd()], text: fixText};
            }
        }
        return {fix, startPosition};
    }

    private getIndexSignatureContentList(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile): ts.Node[] {
        let startContent = false;
        let contentList: ts.Node[] = [];
        for (const child of node.getChildren()) {
            // 将 { 和 } 之间的内容放入数组
            if (startContent && child.kind === ts.SyntaxKind.SyntaxList) {
                for (const obj of child.getChildren()) {
                    contentList.push(obj);
                }
            }

            if (child.kind === ts.SyntaxKind.OpenBraceToken) {
                startContent = true;
            } else if (child.kind === ts.SyntaxKind.CloseBraceToken) {
                startContent = false;
            }
            this.checkIndexSignature(sourceFile, child, targetFile);
        }
        return contentList;
    }

    // 检查 Record
    private checkRecord(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile): void {
        for (const child of node.getChildren()) {
            this.checkRecord(sourceFile, child, targetFile)

            if (!ts.isTypeReferenceNode(child)) {
                continue;
            }

            if (!ts.isIdentifier(child.typeName)) {
                continue;
            }

            const name = child.typeName.escapedText;
            if (name === 'Record' || this.allowRecord) {
                continue;
            }

            // fix
            let fix: RuleFix | undefined;
            if (child.getChildren().length !== 4) {
                continue;
            }
            const contentNode = child.getChildren()[2];
            if (contentNode.kind === ts.SyntaxKind.SyntaxList) {
                const children = contentNode.getChildren();
                if (children.length === 3) {
                    const key = children[0].getText();
                    const type = children[2].getText();
                    const fixText = '{ [key: ' + key + ']: ' + type + ' }';
                    fix = {range: [child.getStart(), child.getEnd()], text: fixText};
                }
            }

            const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, child.getStart());
            const defect = this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, this.indexMessage, fix);
            this.issueMap.set(defect.fixKey, {defect, fix});
        }
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