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


import { ts, ArkFile, AstTreeUtils } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects, IssueReport } from '../../model/Defects';
import { ClassMatcher, FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher } from "../../matcher/Matchers";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { RuleFix } from '../../model/Fix';
import { Utils } from '../../Index';

interface lineColumnInfo {
    line: number,
    character: number
};
interface lineColumn {
    line: number,
    startCol: number,
    endCol: number,
    filePath: string
};
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoDynamicDeleteCheck');
const gmetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-dynamic-delete-check.md", // TODO: support url
    description: "Do not delete dynamically computed property keys."
};
export class NoDynamicDeleteCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gmetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private classMatcher: ClassMatcher = {
        file: [this.fileMatcher],
        matcherType: MatcherTypes.CLASS
    };
    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.classMatcher]
    };
    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    }
    private issueMap: Map<string, IssueReport> = new Map();
    public check = (targetField: ArkFile) => {
        if (this.getFileExtension(targetField.getName()) !== '.ets') {
            this.processNonEtsFile(targetField);
        }
    }
    private getFileExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }
        return filePath.substring(lastDotIndex);
    }
    private processNonEtsFile(targetField: ArkFile): void {
        const variableNameArray = this.checkVariableName(targetField);
        const deleteExpressions = this.findDeleteExpressions(targetField);
        this.processMatchingExpressions(targetField, variableNameArray, deleteExpressions);
    }
    private findDeleteExpressions(targetField: ArkFile): string[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        const deleteExpressions: string[] = [];

        function traverse(node: ts.Node): void {
            if (ts.isDeleteExpression(node)) {
                const text = node.getText();
                if (text) {
                    deleteExpressions.push(text);
                }
            }
            ts.forEachChild(node, childNode => traverse(childNode));
        }

        traverse(sourceFile);
        return deleteExpressions;
    }
    private processMatchingExpressions(targetField: ArkFile, variableNames: string[], deleteExpressions: string[]): void {
        if (variableNames.length === 0 || deleteExpressions.length === 0) { return };

        for (const deleteExpression of deleteExpressions) {
            this.processSingleExpression(targetField, variableNames, deleteExpression);
        }
        this.reportSortedIssues();
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
    private processSingleExpression(targetField: ArkFile, variableNames: string[], expression: string): void {
        for (const variableName of variableNames) {
            if (expression.includes(variableName) || this.dynamicDeletePattern(expression)) {
                this.processMatchingVariables(targetField, expression, variableName);
            }

        }
    }
    private dynamicDeletePattern(code: string): boolean {
        return /delete\s+[\w.]+(\[.*?\])+/g.test(code);
    }
    private processMatchingVariables(targetField: ArkFile, expression: string, variableName: string): void {
        const deleteProperties = this.extractPropertyKeysFromDeleteExpressions(expression);
        if (deleteProperties.length === 0) { return };

        for (const deleteProperty of deleteProperties) {
            this.getDeletePropertyPosition(targetField, expression, deleteProperty);
        }
    }
    private getDeletePropertyPosition(targetFile: ArkFile, deleteExpressionText: string, propertyName: string): lineColumnInfo[] | null {
        const sourceFile = this.getSourceFile(targetFile);
        const foundPositions: { line: number, character: number }[] = [];

        this.traverseAST(sourceFile, (node) => {
            const position = this.handleDeleteExpression(node, targetFile, deleteExpressionText, propertyName);
            position && foundPositions.push(position);
        });

        return foundPositions.length > 0 ? foundPositions : null;
    }

    private getSourceFile(targetFile: ArkFile): ts.SourceFile {
        const code = targetFile.getCode();
        return AstTreeUtils.getASTNode('temp.ts', code);
    }

    private traverseAST(sourceFile: ts.Node, callback: (node: ts.Node) => void): void {
        const visitor = (node: ts.Node): void => {
            callback(node);
            ts.forEachChild(node, visitor);
        };
        visitor(sourceFile);
    }

    private handleDeleteExpression(node: ts.Node, targetFile: ArkFile,
        deleteExpressionText: string, propertyName: string): lineColumnInfo | null {
        if (!ts.isDeleteExpression(node) || node.getText() !== deleteExpressionText) {
            return null;
        }

        const expression = node.expression;
        if (ts.isElementAccessExpression(expression)) {
            return this.processElementAccess(expression, targetFile, propertyName);
        }
        return null;
    }

    private processElementAccess(expression: ts.ElementAccessExpression,
        targetFile: ArkFile, propertyName: string): lineColumnInfo | null {
        const argumentExpression = expression.argumentExpression;
        const { pos, end, fixText } = this.calculateFixPosition(argumentExpression, propertyName);

        return this.reportAndCreateFix(argumentExpression, targetFile, propertyName, pos, end, fixText);
    }

    private calculateFixPosition(argumentExpression: ts.Expression, propertyName: string): { pos: number; end: number; fixText: string; } {
        const argText = argumentExpression.getText();
        const index = propertyName.indexOf(argText);

        if (index === 0) {
            return {
                pos: argumentExpression.getStart(),
                end: argumentExpression.getEnd(),
                fixText: propertyName
            };
        }

        return this.handleComplexFixCase(argumentExpression, propertyName);
    }

    private handleComplexFixCase(argumentExpression: ts.Expression, propertyName: string): { pos: number; end: number; fixText: string; } {
        if (ts.isBinaryExpression(argumentExpression)) {
            return {
                pos: argumentExpression.getStart(),
                end: argumentExpression.getEnd(),
                fixText: propertyName
            };
        }
        return {
            pos: argumentExpression.getStart() - 1,
            end: argumentExpression.getEnd() + 1,
            fixText: `.${propertyName}`
        };
    }

    private reportAndCreateFix(argumentExpression: ts.Expression, targetFile: ArkFile,
        propertyName: string, pos: number, end: number, fixText: string): lineColumnInfo | null {
        const propertyNameStart = this.getPropertyNameStart(argumentExpression, propertyName);
        if (propertyNameStart === -1) { return null };

        const positionInfo = this.getPositionInfo(argumentExpression, propertyNameStart);
        const defect = this.addIssueReport(targetFile, positionInfo);

        if (defect) {
            const fix = this.ruleFix(pos, end, fixText);
            this.issueMap.set(defect.fixKey, { defect, fix });
        }
        return { line: positionInfo.line, character: positionInfo.character };
    }

    private getPropertyNameStart(argumentExpression: ts.Expression, propertyName: string): number {
        const argText = argumentExpression.getText();
        const position = ts.isStringLiteral(argumentExpression) ?
            argText.indexOf(propertyName) :
            argText.indexOf(propertyName) + 1;
        return position !== -1 ? argumentExpression.getStart() + position : -1;
    }
    private getPositionInfo(argumentExpression: ts.Expression, propertyNameStart: number): lineColumnInfo {
        const sourceFile = argumentExpression.getSourceFile();
        const position = ts.getLineAndCharacterOfPosition(sourceFile, propertyNameStart);
        return { line: position.line + 1, character: position.character };
    }
    private extractPropertyKeysFromDeleteExpressions(code: string): string[] {
        const sourceFile = AstTreeUtils.getASTNode('temp.ts', code);
        const propertyKeys: string[] = [];
        const isAlphabetic = this.createAlphabeticChecker();

        const visit = (node: ts.Node): void => {
            if (ts.isDeleteExpression(node)) {
                this.processDeleteExpression(node, propertyKeys, isAlphabetic);
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return propertyKeys;
    }
    private createAlphabeticChecker(): (str: string) => boolean {
        return (str: string) => {
            return /^[A-Za-z]+$/.test(str);
        };
    }
    private processDeleteExpression(node: ts.DeleteExpression, propertyKeys: string[], isAlphabetic: (s: string) => boolean): void {
        const expression = node.expression;
        if (ts.isElementAccessExpression(expression)) {
            this.handleElementAccess(expression.argumentExpression, propertyKeys, isAlphabetic);
        }
    }
    private handleElementAccess(argument: ts.Expression, propertyKeys: string[], isAlphabetic: (s: string) => boolean): void {
        if (ts.isStringLiteral(argument)) {
            this.handleStringLiteral(argument, propertyKeys, isAlphabetic);
        } else if (ts.isIdentifier(argument)) {
            this.handleIdentifier(argument, propertyKeys, isAlphabetic);
        } else if (ts.isPropertyAccessExpression(argument)) {
            propertyKeys.push(argument.getText());
        } else {
            this.handleComplexExpression(argument, propertyKeys, isAlphabetic);
        }
    }
    private handleComplexExpression(expr: ts.Expression, propertyKeys: string[], isAlphabetic: (s: string) => boolean): void {
        const text = expr.getText();
        if (ts.isCallExpression(expr) || ts.isBinaryExpression(expr) || this.strictArrayPattern(text)) {
            propertyKeys.push(text);
        } else if (/^[+-]/.test(text)) {
            this.handleSpecialPrefix(text, propertyKeys, isAlphabetic);
        }
    }
    private strictArrayPattern(code: string): boolean {
        return /\[([a-zA-Z_$][\w$]*)\]/g.test(code);
    }
    private handleSpecialPrefix(text: string, propertyKeys: string[], isAlphabetic: (s: string) => boolean): void {
        const target = text.substring(1);
        if (isAlphabetic(target)) {
            propertyKeys.push(text);
        }
    }
    private createTraverseHandler(variableNames: string[]): (node: ts.Node) => void {
        return (node: ts.Node) => {
            if (!ts.isVariableStatement(node)) { return };

            for (const declaration of node.declarationList.declarations) {
                const name = declaration.name.getText().trim();
                if (name) { variableNames.push(name) };
            }
        };
    }

    public checkVariableName(targetField: ArkFile): string[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        const variableNames: string[] = [];

        const traverse = this.createTraverseHandler(variableNames);
        ts.forEachChild(sourceFile, child => this.deepTraverse(child, traverse));
        return variableNames;
    }

    private deepTraverse(node: ts.Node, callback: (node: ts.Node) => void): void {
        callback(node);
        ts.forEachChild(node, child => this.deepTraverse(child, callback));
    }
    private ruleFix(pos: number, end: number, fixText: string): RuleFix {
        return { range: [pos, end], text: fixText };
    }
    private handleStringLiteral(node: ts.StringLiteral, propertyKeys: string[], isAlphabetic: (str: string) => boolean): void {
        if (isAlphabetic(node.text) && !node.text.includes('+') && !node.text.includes('-')) {
            propertyKeys.push(node.text);
        }
    }

    private handleIdentifier(node: ts.Identifier, propertyKeys: string[], isAlphabetic: (str: string) => boolean): void {
        if (isAlphabetic(node.getText())) {
            propertyKeys.push(node.getText());
        }
    }
    private getLineAndColumn(arkfile: ArkFile, lineColumn: lineColumnInfo): lineColumn | null {
        if (arkfile) {
            const originPath = arkfile.getFilePath();
            return { line: lineColumn.line, startCol: lineColumn.character, endCol: lineColumn.character, filePath: originPath };
        } else {
            logger.debug('arkFile is null');
        }
        return null;
    }
    private addIssueReport(arkFile: ArkFile, lineAndColumn: lineColumnInfo): Defects | null {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(arkFile, lineAndColumn);
        this.metaData.description = this.metaData.description;
        if (warnInfo) {
            const filePath = arkFile.getFilePath();
            let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId, filePath,
                this.metaData.ruleDocPath, true, false, true);
            this.defects.push(defects);
            return defects;
        }
        return null;
    }
}