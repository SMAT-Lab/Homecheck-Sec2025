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
import { IssueReport } from "../../model/Defects";
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ClassLiteralPropertyStyleCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/class-literal-property-style.md",
  description: "Literals should be exposed using readonly fields..",
};

type Options = ['fields' | 'getters'];

export class ClassLiteralPropertyStyleCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  private defaultOptions: Options = ['fields'];
  public rule: Rule;
  public defects: Defects[] = [];
  public filePath: string = "";
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };
  public issues: IssueReport[] = [];
  public registerMatchers(): MatcherCallback[] {
    const fileMatcher: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    }
    return [fileMatcher];
  }

  public check = (target: ArkFile) => {
    this.filePath = target.getFilePath();
    this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    this.checkClassLiterals(sourceFile, this.defaultOptions[0]);
  }

  public checkClassLiterals(sourceFile: ts.SourceFile, style: string) {
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isClassDeclaration(node)) {
        const classBody = node.members as ts.NodeArray<ts.ClassElement>;
        classBody.forEach((element) => {
          if (style === "fields" && ts.isGetAccessorDeclaration(element) && element.name) {
            const method = element;
            this.checkGetterMethodForFieldStyle(method);
          } else if (style === "getters" && ts.isPropertyDeclaration(element)) {
            const property = element;
            this.checkReadonlyPropertyForGetterStyle(property);
          }
        });
      }
    });
  }
  private checkGetterMethodForFieldStyle(method: ts.GetAccessorDeclaration) {
    if (!ts.isGetAccessorDeclaration(method)) {
      return;
    }
    const parent = method.parent as ts.ClassDeclaration;
    const hasSetMethod = parent.members.some(
      member => ts.isSetAccessorDeclaration(member) && member.name.getText().replace(/\/\*.*?\*\//g, '').replace(/^\[['"`]|['"`]\]$/g, '').trim() === method.name.getText().replace(/\/\*.*?\*\//g, '').replace(/^\[['"`]|['"`]\]$/g, '').trim()
    );

    if (hasSetMethod) {
      return;
    }

    const body = method.body;
    if (!body || body.statements.length === 0) {
      return;
    }

    const [firstStatement] = body.statements;
    if (firstStatement.kind !== ts.SyntaxKind.ReturnStatement) {
      return;
    }

    const returnStmt = firstStatement as ts.ReturnStatement;
    const { expression } = returnStmt;
    if (!expression || !this.isSupportedLiteral(expression)) {
      return;
    }

    const methodNameStart = method.name.getStart();
    const methodNameEnd = method.name.getEnd();
    const { line, character } = this.getPosition(methodNameStart, method.getSourceFile());
    const { character: endChar } = this.getPosition(methodNameEnd, method.getSourceFile());
    this.addIssueReport(line + 1, character + 1, endChar + 1, "Literals should be exposed using readonly fields.", this.filePath)
  }

  private checkReadonlyPropertyForGetterStyle(property: ts.PropertyDeclaration) {
    const modifiers = property.modifiers;
    if (!modifiers || !modifiers.some(mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword)) {
      return;
    }

    const initializer = property.initializer;
    if (!initializer || !this.isSupportedLiteral(initializer)) {
      return;
    }

    const propertyNameStart = property.name.getStart();
    const propertyNameEnd = property.name.getEnd();
    const { line, character } = this.getPosition(propertyNameStart, property.getSourceFile());
    const { character: endChar } = this.getPosition(propertyNameEnd, property.getSourceFile());
    this.addIssueReport(line + 1, character + 1, endChar + 1, "Literals should be exposed using getters.", this.filePath)
  }

  private getPosition(pos: number, sourceFile: ts.SourceFile): { line: number; character: number } {
    return sourceFile.getLineAndCharacterOfPosition(pos);
  }

  private isSupportedLiteral(node: ts.Node): boolean {
    return (
      ts.isStringLiteral(node) ||
      ts.isNumericLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      (ts.isTemplateExpression(node) && node.templateSpans.length === 0) ||
      node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.BigIntLiteral ||
      node.kind === ts.SyntaxKind.NullKeyword ||
      node.kind === ts.SyntaxKind.UndefinedKeyword ||
      ts.isObjectLiteralExpression(node) ||
      ts.isArrayLiteralExpression(node)
    );
  }

  private async addIssueReport(line: number, startCol: number, endCol: number, message: string, filePath: string) {
    const severity = this.rule.alert ?? this.metaData.severity;
    const description = message;
    const defect = new Defects(line, startCol, endCol, description, severity,
      this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defect, undefined))
    RuleListUtil.push(defect);
  }
}
