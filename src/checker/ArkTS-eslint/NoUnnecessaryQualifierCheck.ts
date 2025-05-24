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

import { ArkFile, AstTreeUtils, ts } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnnecessaryQualifierCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-unnecessary-qualifier.md",
    description: "Disallow unnecessary namespace qualifiers.",
};

// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
    fileName: string;
    line: number;
    startCol: number;
    endCol: number;
    Qualifier: string;
}

export class NoUnnecessaryQualifierCheck implements BaseChecker {
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
    }

    public check = (arkFile: ArkFile) => {
        if (arkFile instanceof ArkFile) {
            const code = arkFile.getCode();
            if (!code) {
                return;
            }
            const filePath = arkFile.getFilePath();
            const asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
            // 检查命名空间限定符
            const locations = this.checkUnnecessaryQualifiers(asRoot);
            this.filteredLocations(locations).forEach((loc) => {
                this.addIssueReportNodeFix(asRoot, loc, filePath);
            });
        }
    }

    // 检查不必要的限定符
    private checkUnnecessaryQualifiers(sourceFile: ts.SourceFile): LocationInfo[] {
        const results: LocationInfo[] = [];

        // 遍历所有源文件
        const visit = (node: ts.Node, currentNamespace?: string[]) => {
            // 检查 QualifiedName 和 PropertyAccessExpression
            if (ts.isQualifiedName(node) || ts.isPropertyAccessExpression(node)) {
                this.isQualifiedNameAndPropertyAccess(node, sourceFile, results, currentNamespace);

            }

            // 处理命名空间
            if (ts.isModuleDeclaration(node) || ts.isEnumDeclaration(node)) {
                const namespaceName = node.name.getText(sourceFile);
                const newNamespace = currentNamespace ? [...currentNamespace, namespaceName] : [namespaceName];
                ts.forEachChild(node, child => visit(child, newNamespace));
            } else {
                ts.forEachChild(node, child => visit(child, currentNamespace));
            }
        };
        visit(sourceFile);
        return results;
    }

    private isQualifiedNameAndPropertyAccess(node: ts.Node, sourceFile: ts.SourceFile, results: LocationInfo[],
        currentNamespace?: string[]): void {
        let leftName: string | undefined;
        let rightName: string | undefined;

        if (ts.isQualifiedName(node)) {
            leftName = node.left.getText(sourceFile);
            rightName = node.right.getText(sourceFile);
        } else if (ts.isPropertyAccessExpression(node)) {
            leftName = node.expression.getText(sourceFile);
            rightName = node.name.getText();
        }
        if (!leftName || !rightName || !currentNamespace) {
            return;
        }

        // 检查 leftName 是否是当前命名空间路径的前缀
        const leftNamespaceParts = leftName.split('.');
        let isPartOfCurrentNamespace = true;
        for (let i = 0; i < leftNamespaceParts.length; i++) {
            if (currentNamespace[i] !== leftNamespaceParts[i]) {
                isPartOfCurrentNamespace = false;
                break;
            }
        }

        if (!isPartOfCurrentNamespace) {
            return;
        }
        if (leftName && rightName) {
            // 获取当前作用域内的所有符号
            const currentScopeSymbols = this.getSymbolsInCurrentScope(node, sourceFile, currentNamespace);

            // 检查右侧符号是否可以在当前作用域直接访问
            if (currentScopeSymbols.has(rightName)) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                const endCharacter = character + leftName.length;
                results.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    startCol: character + 1,
                    endCol: endCharacter + 1,
                    Qualifier: rightName
                });
            }
        }
    }

    private getSymbolsInCurrentScope(node: ts.Node, sourceFile: ts.SourceFile, currentNamespace?: string[]): Set<string> {
        const symbols = new Set<string>();
        const scopeStack: ts.Node[] = [];
        let currentNode: ts.Node | undefined = node;

        // 构建作用域栈
        while (currentNode) {
            scopeStack.push(currentNode);
            currentNode = currentNode.parent;
        }
        this.getScopeStack(scopeStack, symbols);
        // 添加当前命名空间及其父级命名空间内的符号
        if (currentNamespace) {
            for (let i = 0; i < currentNamespace.length; i++) {
                const nsName = currentNamespace[i];
                const nsNode = this.findNamespace(sourceFile, nsName);
                if (nsNode) {
                    this.collectSymbolsFromNamespace(nsNode, symbols);
                }
            }
        }
        return symbols;
    }

    private getScopeStack(scopeStack: ts.Node[], symbols: Set<string>): void {
        // 遍历作用域栈，收集符号
        scopeStack.reverse().forEach((scopeNode) => {
            if (ts.isVariableStatement(scopeNode)) {
                this.collectSymbolsFromVariableStatement(scopeNode, symbols);
            } else if (ts.isFunctionDeclaration(scopeNode) && scopeNode.name) {
                symbols.add(scopeNode.name.text);
            } else if (ts.isTypeAliasDeclaration(scopeNode) && scopeNode.name) {
                symbols.add(scopeNode.name.text);
            } else if (ts.isEnumDeclaration(scopeNode)) {
                symbols.add(scopeNode.name.text);
                this.collectSymbolsFromEnumDeclaration(scopeNode, symbols);
            } else if (ts.isModuleBlock(scopeNode)) {
                this.collectSymbolsFromModuleBlock(scopeNode, symbols);
            }
        });
    }

    private collectSymbolsFromVariableStatement(scopeNode: ts.VariableStatement, symbols: Set<string>): void {
        scopeNode.declarationList.declarations.forEach((declaration) => {
            if (ts.isIdentifier(declaration.name)) {
                symbols.add(declaration.name.text);
            }
        });
    }

    private collectSymbolsFromEnumDeclaration(scopeNode: ts.EnumDeclaration, symbols: Set<string>): void {
        scopeNode.members.forEach((member) => {
            if (ts.isIdentifier(member.name)) {
                symbols.add(member.name.text);
            }
        });
    }

    private collectSymbolsFromModuleBlock(scopeNode: ts.Node, symbols: Set<string>): void {
        // 处理模块块内的声明
        ts.forEachChild(scopeNode, (child) => {
            if (ts.isVariableStatement(child)) {
                this.collectSymbolsFromVariableStatement(child, symbols);
            } else if (ts.isFunctionDeclaration(child) && child.name) {
                symbols.add(child.name.text);
            } else if (ts.isTypeAliasDeclaration(child) && child.name) {
                symbols.add(child.name.text);
            } else if (ts.isEnumDeclaration(child)) {
                symbols.add(child.name.text);
                this.collectSymbolsFromEnumDeclaration(child, symbols);
            }
        });
    }

    private findNamespace(sourceFile: ts.SourceFile, namespaceName: string): ts.ModuleDeclaration | undefined {
        let result: ts.ModuleDeclaration | undefined = undefined;
        const visit = (node: ts.Node): void => {
            if (ts.isModuleDeclaration(node) && node.name.getText(sourceFile) === namespaceName) {
                result = node;
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return result;
    }

    private collectSymbolsFromNamespace(namespaceNode: ts.ModuleDeclaration, symbols: Set<string>): void {
        const visit = (node: ts.Node): void => {
            this.collectSymbolsFromNode(node, symbols);
            ts.forEachChild(node, visit);
        };
        visit(namespaceNode);
    }

    private collectSymbolsFromNode(node: ts.Node, symbols: Set<string>): void {
        if (ts.isVariableStatement(node)) {
            node.declarationList.declarations.forEach((declaration) => {
                if (ts.isIdentifier(declaration.name)) {
                    symbols.add(declaration.name.text);
                }
            });
        } else if (ts.isFunctionDeclaration(node) && node.name) {
            symbols.add(node.name.text);
        } else if (ts.isTypeAliasDeclaration(node) && node.name) {
            symbols.add(node.name.text);
        } else if (ts.isEnumDeclaration(node)) {
            symbols.add(node.name.text);
            node.members.forEach((member) => {
                if (ts.isIdentifier(member.name)) {
                    symbols.add(member.name.text);
                }
            });
        }
    }

    // 遍历过滤后的 locations 并执行 addIssueReportNodeFix
    private filteredLocations(locations: LocationInfo[]): LocationInfo[] {
        // 过滤 locations，保留 line 和 startCol 相同但 endCol 最大的 LocationInfo 对象
        const filteredLocations: LocationInfo[] = [];
        locations.forEach((loc) => {
            let found = this.filteredFound(filteredLocations, loc);
            if (!found) {
                filteredLocations.push(loc); // 添加新记录
            }
        });
        return filteredLocations;
    }

    private filteredFound(filteredLocations: LocationInfo[], loc: LocationInfo): boolean {
        let found = false;
        for (let i = 0; i < filteredLocations.length; i++) {
            const existingLoc = filteredLocations[i];
            if (existingLoc.line === loc.line && existingLoc.startCol === loc.startCol) {
                if (loc.endCol > existingLoc.endCol) {
                    filteredLocations[i] = loc; // 更新记录
                }
                found = true;
                break;
            }
        }
        return found;
    }

    // 创建修复对象 
    private ruleFix(sourceFile: ts.SourceFile, loc: LocationInfo): RuleFix {
        const [start, end] = this.getFixRange(sourceFile, loc);
        return { range: [start, end], text: '' };
    }

    // 获取起始位置和结束位置
    private getFixRange(sourceFile: ts.SourceFile, loc: LocationInfo): [number, number] {
        const startPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.startCol) - 1;
        const endPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.endCol);
        return [startPosition, endPosition];
    }
    private addIssueReportNodeFix(sourceFile: ts.SourceFile, loc: LocationInfo, filePath: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        this.metaData.description = `Qualifier is unnecessary since '${loc.Qualifier}' is in scope.`;
        let defect = new Defects(loc.line, loc.startCol, loc.endCol, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
        let fix: RuleFix = this.ruleFix(sourceFile, loc);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    }
}