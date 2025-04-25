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
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { RuleListUtil } from "../../utils/common/DefectsList";

interface Violation {
    line: number;
    character: number;
    endCharacter: number;
    message: string;
    filePath?: string;
}

export class NoExAssignCheck implements BaseChecker {
    readonly CATCH_NAME = 'catch';
    readonly THROW_NAME = 'throw ';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-ex-assign-check.md',
        description: 'Disallow reassigning exceptions in `catch` clauses.',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    }

    public check = (target: ArkFile) => {
        if (target instanceof ArkFile) {
            const myInvalidPositions = this.checkAction(target);
            myInvalidPositions.forEach((violation) => {
                violation.filePath = target.getFilePath();
                this.addIssueReport(violation);
            });
        }
    };

    private checkAction(target: ArkFile): Violation[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
        const violations: Violation[] = [];
        this.traverseNodes(sourceFile, (node: ts.Node) => {
            this.processCatchClause(node, violations, sourceFile);
        });
        return violations;
    };

    private traverseNodes(node: ts.Node, callback: (node: ts.Node) => void): void {
        if (!node) {
            return;
        };
        callback(node);
        ts.forEachChild(node, (child) => {
            this.traverseNodes(child, callback);
        });
    };

    private processCatchClause(node: ts.Node, violations: Violation[], sourceFile: ts.SourceFile): void {
        if (ts.isCatchClause(node)) {
            const { catchVariableText, destructuredVariables } = this.extractCatchVariables(node);
            node.block.statements.forEach((statement: ts.Statement) => {
                this.checkStatement(statement, catchVariableText, destructuredVariables, sourceFile, violations);
            });
        }
    };

    private extractCatchVariables(node: ts.CatchClause): { catchVariableText: string | null; destructuredVariables: Set<string> } {
        const catchVariable = node.variableDeclaration?.name;
        const catchVariableText = catchVariable ? catchVariable.getText() : null;
        const destructuredVariables = new Set<string>();
        if (catchVariable && ts.isObjectBindingPattern(catchVariable)) {
            for (const element of catchVariable.elements) {
                if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                    destructuredVariables.add(element.name.text);
                }
            }
        } else if (catchVariable && ts.isArrayBindingPattern(catchVariable)) {
            for (const element of catchVariable.elements) {
                if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                    destructuredVariables.add(element.name.text);
                }
            }
        }
        return { catchVariableText, destructuredVariables };
    };

    private checkStatement(
        statement: ts.Statement,
        catchVariableText: string | null,
        destructuredVariables: Set<string>,
        sourceFile: ts.SourceFile,
        violations: Violation[]
    ): void {
        if (ts.isExpressionStatement(statement)) {
            const expression = statement.expression;

            let innerExpression: ts.Expression = expression;
            if (ts.isParenthesizedExpression(expression)) {
                innerExpression = expression.expression;
            }
            // 例如：(e.g., ex = 0)
            this.checkIsExpression(innerExpression, catchVariableText, destructuredVariables, sourceFile, violations);
            // 例如： (e.g., [ex] = [])
            this.checkArrayDestructuring(innerExpression, catchVariableText, destructuredVariables, sourceFile, violations);
            //例如：({ x: ex = 0 } = {})
            this.checkObjectDestructuring(innerExpression, catchVariableText, destructuredVariables, sourceFile, violations);
        }
    };

    private checkIsExpression(
        innerExpression: ts.Expression,
        catchVariableText: string | null,
        destructuredVariables: Set<string>,
        sourceFile: ts.SourceFile,
        violations: Violation[]
    ): void {
        if (ts.isBinaryExpression(innerExpression) && innerExpression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = innerExpression.left;
            if (ts.isIdentifier(left) && (left.text === catchVariableText || destructuredVariables.has(left.text))) {
                this.addViolation(left, sourceFile, violations);
            }
        }
    };

    private checkArrayDestructuring(
        innerExpression: ts.Expression,
        catchVariableText: string | null,
        destructuredVariables: Set<string>,
        sourceFile: ts.SourceFile,
        violations: Violation[]
    ): void {
        if (ts.isBinaryExpression(innerExpression) && innerExpression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = innerExpression.left;
            this.checkArrayLiteralExpression(left, catchVariableText, destructuredVariables, sourceFile, violations);
        }
    };

    private checkArrayLiteralExpression(
        left: ts.Expression,
        catchVariableText: string | null,
        destructuredVariables: Set<string>,
        sourceFile: ts.SourceFile,
        violations: Violation[]
    ): void {
        if (ts.isArrayLiteralExpression(left)) {
            left.elements.forEach((element: ts.Expression) => {
                if (ts.isIdentifier(element) && (element.text === catchVariableText || destructuredVariables.has(element.text))) {
                    this.addViolation(element, sourceFile, violations);
                }
            });
        }
    };

    private checkObjectDestructuring(
        innerExpression: ts.Expression,
        catchVariableText: string | null,
        destructuredVariables: Set<string>,
        sourceFile: ts.SourceFile,
        violations: Violation[]
    ): void {
        if (ts.isBinaryExpression(innerExpression) && innerExpression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = innerExpression.left;
            if (ts.isObjectLiteralExpression(left)) {
                left.properties.forEach((property: ts.ObjectLiteralElementLike) => {
                    this.checkObjectLiteralExpression(property, catchVariableText, destructuredVariables, sourceFile, violations);
                });
            }
        }
    };

    private checkObjectLiteralExpression(
        property: ts.ObjectLiteralElementLike,
        catchVariableText: string | null,
        destructuredVariables: Set<string>,
        sourceFile: ts.SourceFile,
        violations: Violation[]
    ): void {
        if (ts.isPropertyAssignment(property)) {
            const initializer = property.initializer;
            if (ts.isBinaryExpression(initializer) && initializer.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                const leftIdentifier = initializer.left;
                if (ts.isIdentifier(leftIdentifier) && (leftIdentifier.text === catchVariableText ||
                    destructuredVariables.has(leftIdentifier.text))) {
                    this.addViolation(leftIdentifier, sourceFile, violations);
                }
            }
        }
    };

    private addViolation(node: ts.Node, sourceFile: ts.SourceFile, violations: Violation[]): void {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const endCharacter = node.getEnd();
        const endPosition = sourceFile.getLineAndCharacterOfPosition(endCharacter);
        violations.push({
            message: `Do not assign to the exception parameter`,
            line: line + 1,
            character: character + 1,
            endCharacter: endPosition.character + 1
        });
    };

    private addIssueReport(violation: Violation) {
        this.metaData.description = violation.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(
            violation.line,
            violation.character,
            violation.endCharacter,
            this.metaData.description,
            severity, this.rule.ruleId,
            violation.filePath as string,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}