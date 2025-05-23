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
import { ArkFile, ts } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects } from "../../model/Defects";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { AstTreeUtils } from "arkanalyzer";
import { Rule } from "../../model/Rule";
import { IssueReport } from '../../model/Defects';
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PreferForOfCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/prefer-for-of.md",
    description: "Enforce the use of `for-of` loop over the standard `for` loop where possible",
};

interface ForOfCheckResult {
    line: number;
    character: number;
    endCol: number;
    message: string;
}

export class PreferForOfCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public rule: Rule;
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private filePath: string = "";

    public registerMatchers(): MatcherCallback[] {
        const matchfileBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchfileBuildCb];
    }

    public check = (targetField: ArkFile) => {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        this.filePath = targetField.getFilePath();
        this.checkForOfUsage(sourceFile);
    }
    private checkForOfUsage(sourceFile: ts.SourceFile): ForOfCheckResult[] {
        const results: ForOfCheckResult[] = [];
        const visitNode: (node: ts.Node) => void = (node: ts.Node) => {
            if (ts.isForStatement(node)) {
                this.checkForStatement(node, sourceFile);
            }
            ts.forEachChild(node, visitNode);
        };
        visitNode(sourceFile);
        return results;
    }

    private isSingleVariableDeclaration(node: ts.Node): node is ts.VariableDeclarationList {
        return (
            ts.isVariableDeclarationList(node) &&
            node.declarations.length === 1 &&
            ts.isIdentifier(node.declarations[0].name)
        );
    }

    private isZeroInitialized(node: ts.VariableDeclaration): boolean {
        return (
            node.initializer !== undefined &&
            ts.isNumericLiteral(node.initializer) &&
            node.initializer.text === '0'
        );
    }

    private isLessThanLengthExpression(node: ts.Expression, indexName: string): ts.Expression | null {
        if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.LessThanToken &&
            ts.isIdentifier(node.left) &&
            node.left.text === indexName &&
            ts.isPropertyAccessExpression(node.right) &&
            ts.isIdentifier(node.right.name) &&
            node.right.name.text === 'length'
        ) {
            return node.right.expression;
        }
        return null;
    }

    private isIncrement(node: ts.Expression, indexName: string): boolean {
        return this.checkPlusPlusIncrement(node, indexName) ||
            this.checkCompoundAssignment(node, indexName);
    }

    private checkPlusPlusIncrement(node: ts.Expression, indexName: string): boolean {
        return (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
            node.operator === ts.SyntaxKind.PlusPlusToken &&
            ts.isIdentifier(node.operand) &&
            node.operand.text === indexName;
    }

    private checkCompoundAssignment(node: ts.Expression, indexName: string): boolean {
        if (!ts.isBinaryExpression(node)) {
            return false;
        }

        return this.checkPlusEquals(node, indexName) ||
            this.checkAssignmentWithBinaryExpression(node, indexName);
    }

    private checkPlusEquals(node: ts.BinaryExpression, indexName: string): boolean {
        return node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken &&
            ts.isIdentifier(node.left) &&
            node.left.text === indexName &&
            ts.isNumericLiteral(node.right) &&
            node.right.text === '1';
    }

    private checkAssignmentWithBinaryExpression(node: ts.BinaryExpression, indexName: string): boolean {
        if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
            return false;
        }
        if (!ts.isBinaryExpression(node.right)) {
            return false;
        }
        const { left, right, operatorToken } = node.right;
        return operatorToken.kind === ts.SyntaxKind.PlusToken && (
            (ts.isIdentifier(left) && left.text === indexName &&
                ts.isNumericLiteral(right) && right.text === '1') ||
            (ts.isNumericLiteral(left) && left.text === '1' &&
                ts.isIdentifier(right) && right.text === indexName)
        );
    }

    private isIndexOnlyUsedWithArray(body: ts.Statement, indexName: string, arrayExpression: ts.Expression, sourceFile: ts.SourceFile): boolean {
        const arrayText = arrayExpression.getText(sourceFile);
        let indexUsedOutsideArrayAccess = false;
        const checkNode = (node: ts.Node, outerScope: Set<string>): void => {
            this.handleVariableDeclaration(node, indexName, outerScope);
            if (this.handleElementAccess(node, arrayText, indexName, sourceFile)) {
                return;
            }
            indexUsedOutsideArrayAccess ||= this.handleAssignment(node, arrayText, indexName, sourceFile);
            indexUsedOutsideArrayAccess ||= this.checkIdentifierUsage(node, indexName, outerScope);
            const parentScope = new Set(outerScope);
            ts.forEachChild(node, (childNode) => checkNode(childNode, parentScope));
        };
        checkNode(body, new Set());
        return !indexUsedOutsideArrayAccess;
    }

    private handleVariableDeclaration(
        node: ts.Node,
        indexName: string,
        outerScope: Set<string>
    ): void {
        if (ts.isVariableDeclarationList(node)) {
            for (const declaration of node.declarations) {
                if (ts.isIdentifier(declaration.name) && declaration.name.text === indexName) {
                    outerScope.add(indexName);
                }
            }
        }
    }

    private handleElementAccess(node: ts.Node, arrayText: string, indexName: string, sourceFile: ts.SourceFile): boolean {
        if (ts.isElementAccessExpression(node)) {
            if (ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                return true;
            }
            const objectText = node.expression.getText(sourceFile);
            return objectText === arrayText &&
                ts.isIdentifier(node.argumentExpression) &&
                node.argumentExpression.text === indexName;
        }
        return false;
    }

    private handleAssignment(node: ts.Node, arrayText: string, indexName: string, sourceFile: ts.SourceFile): boolean {
        if (ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isElementAccessExpression(node.left)) {
            const objectText = node.left.expression.getText(sourceFile);
            return objectText === arrayText &&
                ts.isIdentifier(node.left.argumentExpression) &&
                node.left.argumentExpression.text === indexName;
        }
        return false;
    }

    private checkIdentifierUsage(node: ts.Node, indexName: string, outerScope: Set<string>): boolean {
        return ts.isIdentifier(node) &&
            node.text === indexName &&
            !outerScope.has(indexName);
    }

    private checkForStatement(node: ts.ForStatement, sourceFile: ts.SourceFile): void {
        if (!this.isValidInitializer(node.initializer)) {
            return;
        }
        const indexName = this.getIndexNameFromDeclaration(node.initializer);
        if (!indexName) {
            return;
        }

        const { isValidCondition, arrayExpression } = this.checkCondition(node.condition, indexName);
        if (!isValidCondition || !this.checkIncrementor(node.incrementor, indexName)) {
            return;
        }

        if (this.shouldReportIssue(node.statement, indexName, arrayExpression, sourceFile)) {
            this.generateIssueReport(node, sourceFile);
        }
    }

    private isValidInitializer(initializer?: ts.ForInitializer): initializer is ts.VariableDeclarationList {
        return !!initializer &&
            ts.isVariableDeclarationList(initializer) &&
            this.isSingleVariableDeclaration(initializer) &&
            this.isZeroInitialized(initializer.declarations[0]);
    }

    private getIndexNameFromDeclaration(initializer: ts.VariableDeclarationList): string | null {
        const name = initializer.declarations[0].name;
        return ts.isIdentifier(name) ? name.text : null;
    }

    private checkCondition(
        condition: ts.Expression | undefined,
        indexName: string
    ): { isValidCondition: boolean; arrayExpression: ts.Expression | null } {
        return {
            isValidCondition: condition !== undefined,
            arrayExpression: condition ? this.isLessThanLengthExpression(condition, indexName) : null
        };
    }


    private checkIncrementor(incrementor: ts.Expression | undefined, indexName: string): boolean {
        return !!incrementor && this.isIncrement(incrementor, indexName);
    }

    private shouldReportIssue(
        statement: ts.Statement,
        indexName: string,
        arrayExpression: ts.Expression | null,
        sourceFile: ts.SourceFile
    ): boolean {
        return !!arrayExpression &&
            this.isIndexOnlyUsedWithArray(statement, indexName, arrayExpression, sourceFile);
    }

    private generateIssueReport(node: ts.ForStatement, sourceFile: ts.SourceFile): void {
        const startPos = node.getStart(sourceFile, true);
        const endPos = node.getEnd();
        const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, startPos);
        const { character: endChar } = ts.getLineAndCharacterOfPosition(sourceFile, endPos);
        const message = 'Expected a `for-of` loop instead of a `for` loop with this simple iteration.';
        this.addIssueReport(line + 1, character + 1, endChar + 1, this.filePath, message);
    }
    private async addIssueReport(line: number, startCol: number, endCol: number, filePath: string, message: string): Promise<void> {
        const severity = this.rule.alert ?? this.metaData.severity;
        const description = message;
        const defect = new Defects(line, startCol, endCol, description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined))
        RuleListUtil.push(defect);
    }
}