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

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ConsistentTypeImportsCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/consistent-type-imports.md',
    description: 'Enforce consistent usage of type imports.'
};

enum TypeImportsFixStyle {
    inline = 0,
    separate = 1
}

enum TypeImportsPrefer {
    noType = 0,
    type = 1
}

type RuleOptions = {
    disallowTypeAnnotations: boolean,
    fixStyle: TypeImportsFixStyle,
    prefer: TypeImportsPrefer
}

type Options = {
    disallowTypeAnnotations: boolean,
    fixStyle: string,
    prefer: string
}

type CheckMember = {
    node: ts.Node,
    name: string,
    used: boolean
}

enum ImportUseType {
    all = 0,
    some = 1,
    none = 2
}

export class ConsistentTypeImportsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public issues: IssueReport[] = [];
    private issueMap: Map<string, IssueReport> = new Map();
    private typeMessage = 'All imports in the declaration are only used as types. Use `import type`.';
    private noTypeMessage = 'Use an `import` instead of an `import type`.';
    private disallowTypeAnnotationsMessage = '`import()` type annotations are forbidden.';
    private ruleOptions: RuleOptions = { disallowTypeAnnotations: true, fixStyle: TypeImportsFixStyle.separate, prefer: TypeImportsPrefer.type }
    private usedNodeList: CheckMember[] = [];
    private importTypeNodeList: string[] = [];
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
            const option = options[0] as Options;
            this.ruleOptions.disallowTypeAnnotations = option.disallowTypeAnnotations;
            if (option.fixStyle === 'inline-type-imports') {
                this.ruleOptions.fixStyle = TypeImportsFixStyle.inline;
            } else if (option.fixStyle === 'separate-type-imports') {
                this.ruleOptions.fixStyle = TypeImportsFixStyle.separate;
            }
            if (option.prefer === 'no-type-imports') {
                this.ruleOptions.prefer = TypeImportsPrefer.noType;
            } else if (option.prefer === 'type-imports') {
                this.ruleOptions.prefer = TypeImportsPrefer.type;
            }
        }

        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject === undefined) {
            return;
        }

        this.usedNodeList = [];
        this.loopNodeForIssue(targetFile, sourceFile, sourceFileObject);

        this.loopNode(targetFile, sourceFile, sourceFileObject);

        this.reportSortedIssues();
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isImportDeclaration(child)) { // prefer 规则
                this.checkImport(sourceFile, child, targetFile);
            } else if (ts.isTypeAliasDeclaration(child)) { // disallowTypeAnnotations 规则：type T = import('Foo').Foo;
                this.checkTypeAlias(sourceFile, child, targetFile);
            } else if (ts.isVariableStatement(child)) { // disallowTypeAnnotations 规则：let foo: import('foo');
                this.checkVariableStatement(sourceFile, child, targetFile);
            } else {
                this.loopNode(targetFile, sourceFile, child);
            }
        }
    }

    private checkImport(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile): void {
        const nodeList = node.getChildren();
        if (nodeList.length < 3 || this.containsAssert(nodeList)) {
            return;
        };
        const second = nodeList[1];
        if (!ts.isImportClause(second)) {
            return;
        };
        const secondNodeList = second.getChildren();
        if (secondNodeList.length < 1) {
            return;
        };
        const secondFirst = secondNodeList[0];
        const hasType = secondFirst.kind === ts.SyntaxKind.TypeKeyword;
        if ((this.ruleOptions.prefer === TypeImportsPrefer.noType && hasType) ||
            (this.ruleOptions.prefer === TypeImportsPrefer.type && !hasType)) {
            const { message, fix } = this.checkImportPreference(hasType, sourceFile, nodeList, second, secondFirst, secondNodeList, targetFile, node);
            if (message) {
                const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
                const defect = this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, message, fix);
                this.issueMap.set(defect.fixKey, { defect, fix });
            };
        };
    };
    private checkImportPreference(
        hasType: boolean,
        sourceFile: ts.SourceFileLike,
        nodeList: ts.Node[],
        second: ts.ImportClause,
        secondFirst: ts.Node,
        secondNodeList: ts.Node[],
        targetFile: ArkFile,
        node: ts.Node): { message: string | undefined; fix: RuleFix | undefined } {
        let message;
        let fix: RuleFix | undefined;
        const first = nodeList[0];
        if (this.ruleOptions.prefer === TypeImportsPrefer.noType && hasType) {
            message = this.noTypeMessage;
            fix = { range: [first.getStart(), secondFirst.getEnd()], text: first.getText() };
        } else {
            const msg = this.getImportMessage(secondNodeList);
            if (msg) {
                message = msg;
            } else {
                return { message: undefined, fix: undefined };
            };
            const secondText = second.getText();
            if (secondText.charAt(0) === '{' && this.ruleOptions.fixStyle === TypeImportsFixStyle.inline) {
                const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, second.getStart());
                const position = ts.getPositionOfLineAndCharacter(sourceFile, startPosition.line, startPosition.character + 1);
                fix = { range: [second.getStart(), position], text: '{ type ' };
            } else if (secondText.includes(',') && secondText.charAt(0) !== '{') {
                fix = this.handleComplexImport(nodeList, secondText, node);
            } else if (secondText.startsWith('{') && secondText.endsWith('}') && this.importTypeNodeList.length > 0) {
                fix = this.handleNamedImports(nodeList, secondText, node);
            } else {
                fix = { range: [first.getStart(), first.getEnd()], text: first.getText() + ' type' };
            };
        };
        return { message, fix };
    };

    private processImports(items: string[], sourceText: string): string {
        const typeImports: string[] = [];
        const valueImports: string[] = [];
        for (const item of items) {
            if (this.importTypeNodeList.includes(item)) {
                typeImports.push(item);
            } else {
                valueImports.push(item);
            };
        };
        let newText = '';
        if (typeImports.length > 0) {
            newText += `import type { ${typeImports.join(', ')} } from ${sourceText};\n`;
        };
        if (valueImports.length > 0) {
            newText += `import { ${valueImports.join(', ')} } from ${sourceText};`;
        } else if (typeImports.length > 0) {
            newText = newText.substring(0, newText.length - 1);
        };
        return newText;
    };

    //处理 import A3, { B3 } from 'foo' 情况的方法
    private handleComplexImport(nodeList: ts.Node[], secondText: string, node: ts.Node): RuleFix | undefined {
        const importSourceNode = nodeList[3];
        const sourceText = importSourceNode.getText();
        const commaIndex = secondText.indexOf(',');
        const defaultImport = secondText.substring(0, commaIndex).trim();
        const namedImports = secondText.substring(commaIndex + 1).trim();
        let newText = '';
        if (namedImports) {
            const isEmptyObject = namedImports === '{}' || namedImports.match(/^\{\s*\}$/);
            if (!isEmptyObject) {
                const importItems = namedImports.substring(1, namedImports.length - 1)
                    .split(',')
                    .map(item => item.trim());
                if (this.importTypeNodeList.length > 0) {
                    newText += this.processImports(importItems, sourceText);
                } else {
                    newText += `import type ${namedImports} from ${sourceText};`;
                };
            };
        };
        if (defaultImport) {
            if (newText && !newText.endsWith('\n')) {
                newText += '\n';
            };
            newText += `import type ${defaultImport} from ${sourceText};`;
        };
        return { range: [node.getStart(), node.getEnd()], text: newText };
    };

    private handleNamedImports(nodeList: ts.Node[], secondText: string, node: ts.Node): RuleFix {
        const importSourceNode = nodeList[3];
        const sourceText = importSourceNode.getText();
        const namedImportText = secondText.trim();
        // 去掉括号获取实际的导入项列表
        const importItems = namedImportText.substring(1, namedImportText.length - 1)
            .split(',')
            .map(item => item.trim());
        const newText = this.processImports(importItems, sourceText);
        return { range: [node.getStart(), node.getEnd()], text: newText };
    };

    // 语句中是否包含assert，例如 import * as Type4 from 'foo' assert { type: 'json' };
    private containsAssert(nodeList: ts.Node[]): boolean {
        for (const node of nodeList) {
            if (ts.isAssertClause(node)) {
                return true;
            }
        }
        return false;
    }

    private getImportMessage(nodeList: ts.Node[]): string | undefined {
        let message: string | undefined;
        let importNameNodes: (ts.NamedImports | ts.Identifier)[] = [];
        for (const importNameNode of nodeList) {
            const secondFirst = importNameNode;
            const namespaceChildren = secondFirst.getChildren();
            if (ts.isNamespaceImport(secondFirst) && namespaceChildren.length >= 2) { // import * as A2 from 'foo'; 中的 * as A2
                const lastNode = namespaceChildren[namespaceChildren.length - 1];
                if (namespaceChildren[namespaceChildren.length - 2].kind === ts.SyntaxKind.AsKeyword && ts.isIdentifier(lastNode)) {
                    importNameNodes.push(lastNode);
                }
            } else if (ts.isNamedImports(secondFirst) || ts.isIdentifier(secondFirst)) {
                importNameNodes.push(secondFirst);
            }
        }

        if (importNameNodes.length === 0) {
            return undefined;
        }
        const used = this.getImportNodeUsed(importNameNodes);
        if (used === ImportUseType.all) {
            message = this.typeMessage;
        } else if (used === ImportUseType.some) {
            const names = this.getUsedImportNames(importNameNodes);
            message = names + ' only used as types.';
        } else if (used === ImportUseType.none) {
            return undefined;
        }
        return message;
    }

    private checkTypeAlias(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile): void {
        const nodeList = node.getChildren();
        for (const child of nodeList) {
            let object = child;
            if (ts.isUnionTypeNode(child)) {
                const node = this.getSpecifyChild(child, ts.SyntaxKind.ImportType);
                if (node) {
                    object = node;
                }
            }
            if (ts.isImportTypeNode(object) && this.ruleOptions.disallowTypeAnnotations) {
                const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, object.getStart());
                let startCol = startPosition.character + 1;
                // 如下代码开始列需要去掉typeof: typeof import('foo')
                if (object.getChildren().length > 0 && object.getChildren()[0].kind === ts.SyntaxKind.TypeOfKeyword) {
                    startCol = startCol + 7;
                }
                this.addIssueReport(targetFile, startPosition.line + 1, startCol, 0, this.disallowTypeAnnotationsMessage, undefined);
                break;
            }
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
        return undefined;
    }

    private checkVariableStatement(sourceFile: ts.SourceFileLike, node: ts.Node, targetFile: ArkFile): void {
        const nodeList = node.getChildren();
        for (const child of nodeList) {
            if (ts.isImportTypeNode(child) && this.ruleOptions.disallowTypeAnnotations) {
                const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, child.getStart());
                this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, this.disallowTypeAnnotationsMessage, undefined);
                break;
            } else {
                this.checkVariableStatement(sourceFile, child, targetFile);
            }
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

    private loopNodeForIssue(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isTypeReferenceNode(child)) {
                this.saveEntityNameNodes(child.typeName);
            } else if (ts.isTypeQueryNode(child)) {
                this.saveEntityNameNodes(child.exprName);
            } else {
                this.loopNodeForIssue(targetFile, sourceFile, child);
            }
        }
    }

    // 保存文件内所有使用了的类的节点
    private saveEntityNameNodes(nameNode: ts.EntityName): void {
        let typeName;
        if (ts.isIdentifier(nameNode)) {
            typeName = nameNode.getText();
        } else if (ts.isQualifiedName(nameNode)) {
            typeName = nameNode.left.getText();
        }
        if (typeName) {
            this.usedNodeList.push({node: nameNode, name: typeName, used: false});
        }
    }

    // import的节点被使用的情况
    private getImportNodeUsed(nodes: (ts.NamedImports | ts.Identifier)[]): ImportUseType {
        let usedCount = 0;
        const importNodes = this.getObjectsInImport(nodes);
        for (const importNode of importNodes) {
            if (importNode.used) {
                usedCount++;
            }
        }
        let type: ImportUseType;
        if (usedCount === importNodes.length) {
            type = ImportUseType.all;
        } else if (usedCount > 0) {
            type = ImportUseType.some;
        } else {
            type = ImportUseType.none;
        }
        return type;
    }

    // 获取import内的节点
    private getObjectsInImport(nodes: (ts.NamedImports | ts.Identifier)[]): CheckMember[] {
        let nodeList: ts.Identifier[] = [];
        for (const aNode of nodes) {
            if (ts.isNamedImports(aNode)) {
                for (const element of aNode.elements) {
                    nodeList.push(element.name);
                }
            } else if (ts.isIdentifier(aNode)) {
                nodeList.push(aNode);
            }
        }

        let memberList: CheckMember[] = [];
        for (const node of nodeList) {
            const name = node.getText();
            let used = false;
            for (const object of this.usedNodeList) {
                if (object.name === name) {
                    used = true;
                    break;
                }
            }

            memberList.push({node: node, name: name, used: used});
        }

        return memberList;
    }

    // 获取所有使用了的import节点名称
    private getUsedImportNames(nodes: (ts.NamedImports | ts.Identifier)[]): string {
        const importNodes = this.getObjectsInImport(nodes);
        let nameList: string[] = [];
        for (const node of importNodes) {
            if (node.used) {
                this.importTypeNodeList.push(node.name);
                nameList.push(node.name);
            }
        }
        let message: string = '';
        if (nameList.length === 1) {
            message = 'Import "' + nameList[0] + '" is';
        } else if (nameList.length > 1) {
            message = 'Imports "' + nameList[0] + '"';
            for (let i = 1; i < nameList.length; i++) {
                if (i === nameList.length - 1) {
                    message = message + ' and "' + nameList[i] + '"';
                } else {
                    message = message + ', "' + nameList[i] + '"';
                }
            }
            message = message + ' are';
        }
        return message;
    }
}