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
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Rule, Defects, FileMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from "../../model/Defects";

interface RuleOption {
    includeExports?: boolean;
};
const NAMED_TYPES: string[] = ["ImportSpecifier", "ExportSpecifier"];
const NAMESPACE_TYPES: string[] = [
    "ImportNamespaceSpecifier",
    "ExportNamespaceSpecifier",
];
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-duplicate-imports-check.md',
    description: '"module" import is duplicated.'
};
let filePath = '';

function isImportExportSpecifier(importExportType: string, type: 'named' | 'namespace'): boolean {
    const arrayToCheck = type === 'named' ? NAMED_TYPES : NAMESPACE_TYPES;
    return arrayToCheck.includes(importExportType);
};

function getImportExportType(node: ts.Node): string {
    if (ts.isImportDeclaration(node)) {
        const namedBindings = node.importClause?.namedBindings;
        if (namedBindings) {
            if (ts.isNamespaceImport(namedBindings)) {
                return 'ImportNamespaceSpecifier';
            }
            return 'ImportSpecifier';
        }
        if (node.importClause?.name) {
            return 'ImportDefaultSpecifier';
        }
        return 'SideEffectImport';
    } else if (ts.isExportDeclaration(node)) {
        if (node.exportClause) {
            if (ts.isNamespaceExport(node.exportClause)) {
                return 'ExportNamespaceSpecifier';
            }
            return 'ExportSpecifier';
        }
        return 'ExportAll';
    }
    return 'SideEffectImport';
};

function hasDefaultImport(node: ts.Node): boolean {
    if (ts.isImportDeclaration(node)) {
        return !!node.importClause?.name;
    };
    return false;
};

function hasNamedImports(node: ts.Node): boolean {
    if (ts.isImportDeclaration(node)) {
        return ts.isNamedImports(node.importClause?.namedBindings || ({} as any));
    };
    return false;
};

function hasInlineTypeModifier(node: ts.Node): boolean {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        return node.importClause.namedBindings.elements.some(element => {
            return element.isTypeOnly;
        });
    };
    return false;
};

function isComplementaryTypeImports(node1: ts.Node, node2: ts.Node): boolean {
    if (!ts.isImportDeclaration(node1) || !ts.isImportDeclaration(node2)) {
        return false;
    };
    const node1IsTypeOnly = node1.importClause?.isTypeOnly === true;
    const node2IsTypeOnly = node2.importClause?.isTypeOnly === true;
    const node1HasInlineType = hasInlineTypeModifier(node1);
    const node2HasInlineType = hasInlineTypeModifier(node2);
    if ((node1IsTypeOnly && !node1HasInlineType && !node2IsTypeOnly && node2HasInlineType) ||
        (node2IsTypeOnly && !node2HasInlineType && !node1IsTypeOnly && node1HasInlineType)) {
        return true;
    };
    return false;
};

function isImportExportCanBeMerged(nodeOne: ts.Node, nodeTwo: ts.Node): boolean {
    const importExportTypeOne = getImportExportType(nodeOne);
    const importExportTypeTwo = getImportExportType(nodeTwo);
    const isExportAllConflict =
        (importExportTypeOne === 'ExportAll' && importExportTypeTwo !== 'ExportAll' && importExportTypeTwo !== 'SideEffectImport') ||
        (importExportTypeOne !== 'ExportAll' && importExportTypeOne !== 'SideEffectImport' && importExportTypeTwo === 'ExportAll');
    if (isExportAllConflict) {
        return false;
    };
    const isNamespaceNamedConflict =
        (isImportExportSpecifier(importExportTypeOne, 'namespace') && isImportExportSpecifier(importExportTypeTwo, 'named')) ||
        (isImportExportSpecifier(importExportTypeTwo, 'namespace') && isImportExportSpecifier(importExportTypeOne, 'named'));
    if (ts.isImportDeclaration(nodeOne) && ts.isImportDeclaration(nodeTwo)) {
        const bothTypeOnly = nodeOne.importClause?.isTypeOnly && nodeTwo.importClause?.isTypeOnly;
        if (bothTypeOnly &&
            ((hasDefaultImport(nodeOne) && hasNamedImports(nodeTwo)) ||
                (hasDefaultImport(nodeTwo) && hasNamedImports(nodeOne)))) {
            return false;
        };
        if (isComplementaryTypeImports(nodeOne, nodeTwo)) {
            return false;
        };
    };
    if (isNamespaceNamedConflict) {
        return false;
    };
    return true;
};

function shouldReportImportExportDeclarations(node: ts.Node, previousNodes: ts.Node[]): boolean {
    let j = 0;
    while (j < previousNodes.length) {
        if (isImportExportCanBeMerged(node, previousNodes[j])) {
            return true;
        };
        j++;
    }
    return false;
};

function filterNodesByDeclarationType(nodeEntries: Array<{ node: ts.Node, declarationType: string }>, targetType: string): ts.Node[] {
    return nodeEntries
        .filter(({ declarationType }) => declarationType === targetType)
        .map(({ node }) => node);
};

function getModule(node: ts.Node): string {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
            return moduleSpecifier.text.trim();
        };
    };
    return '';
};

/**
 * Returns a boolean if the node is an import type.
 * @param {ASTNode} node A node to check.
 * @returns {boolean} True if the node is an import type, false if it's not.
 */
function isTypeImport(node: ts.Node): boolean {
    if (ts.isImportDeclaration(node)) {
        return node.importClause?.isTypeOnly === true;
    };
    return false;
};

export class NoDuplicateImportsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public issues: IssueReport[] = [];
    private modules: Map<string, Array<{ node: ts.Node, declarationType: string }>> = new Map();
    private includeExports: boolean = false;
    private buildMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check.bind(this)
        };
        return [matchBuildCb];
    };

    public check = (arkFile: ArkFile) => {
        filePath = arkFile.getFilePath();
        const ruleOption = this.rule.option?.[0] as RuleOption | undefined;
        this.includeExports = ruleOption?.includeExports !== undefined ? ruleOption.includeExports : false;
        this.modules.clear();
        const astRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        for (let child of astRoot.statements) {
            this.checkImportExportDeclaration(child);
        };
    };

    private checkImportExportDeclaration(node: ts.Node): void {
        if (ts.isImportDeclaration(node)) {
            this.handleImportExports(node, 'import');
        } else if (this.includeExports && ts.isExportDeclaration(node)) {
            this.handleImportExports(node, 'export');
        };
        ts.forEachChild(node, this.checkImportExportDeclaration.bind(this));
    };

    private handleImportExports(node: ts.Node, declarationType: string): void {
        const module = getModule(node);
        if (module) {
            this.checkAndReport(node, declarationType);
            const currentNode = { node, declarationType };
            let nodes = [currentNode];
            if (this.modules.has(module)) {
                const previousNodes = this.modules.get(module) || [];
                nodes = [...previousNodes, currentNode];
            };
            this.modules.set(module, nodes);
        };
    };

    private checkAndReport(node: ts.Node, declarationType: string): void {
        const module = getModule(node);
        if (!this.modules.has(module)) {
            return;
        };
        const previousNodes = this.modules.get(module) || [];
        const importNodes = filterNodesByDeclarationType(previousNodes, 'import');
        const exportNodes = this.includeExports ? filterNodesByDeclarationType(previousNodes, 'export') : [];
        const errorMessages = this.collectErrorMessages(node, declarationType, importNodes, exportNodes);
        this.reportErrors(node, errorMessages);
    };

    private collectErrorMessages(node: ts.Node, declarationType: string,
        importNodes: ts.Node[], exportNodes: ts.Node[]): string[] {
        const errorMessages: string[] = [];
        const module = getModule(node);
        if (declarationType === 'import') {
            this.collectImportErrorMessages(node, module, importNodes, exportNodes, errorMessages);
        } else if (declarationType === 'export') {
            this.collectExportErrorMessages(node, module, importNodes, exportNodes, errorMessages);
        };
        return errorMessages;
    };

    private collectImportErrorMessages(node: ts.Node, module: string,
        importNodes: ts.Node[], exportNodes: ts.Node[], errorMessages: string[]): void {
        if (shouldReportImportExportDeclarations(node, importNodes)) {
            const message = this.formatImportDuplicateMessage(node, module);
            errorMessages.push(message);
        };
        if (this.includeExports && shouldReportImportExportDeclarations(node, exportNodes)) {
            const message = this.formatImportExportDuplicateMessage(node, module);
            errorMessages.push(message);
        };
    };

    private collectExportErrorMessages(node: ts.Node, module: string,
        importNodes: ts.Node[], exportNodes: ts.Node[], errorMessages: string[]): void {
        if (shouldReportImportExportDeclarations(node, exportNodes)) {
            errorMessages.push(`'${module}' export is duplicated.`);
        };
        if (shouldReportImportExportDeclarations(node, importNodes)) {
            errorMessages.push(`'${module}' export is duplicated as import.`);
        };
    };
    private formatImportDuplicateMessage(node: ts.Node, module: string): string {
        const isType = isTypeImport(node);
        return isType ? `${module} type import is duplicated.` : `'${module}' import is duplicated.`;
    };

    private formatImportExportDuplicateMessage(node: ts.Node, module: string): string {
        const isType = isTypeImport(node);
        return isType ? `${module} type import is duplicated as export.` : `'${module}' import is duplicated as export.`;
    };

    private reportErrors(node: ts.Node, errorMessages: string[]): void {
        errorMessages.forEach(errorMessage => {
            this.addIssueReport(node, errorMessage, this.metaData.severity);
        });
    };
    private addIssueReport(node: ts.Node, description: string, severity: number): void {
        const warnInfo = this.getLineAndColumn(node);
        const defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, description, severity,
            this.rule.ruleId, warnInfo.filePath, this.metaData.ruleDocPath, true, false, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };
    private getLineAndColumn(node: ts.Node): { line: number; startCol: number; endCol: number; filePath: string } {
        const sourceFile = node.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const endCharacter = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).character;
        return {
            line: line + 1,
            startCol: character + 1,
            endCol: endCharacter + 1,
            filePath: filePath
        };
    };
};
