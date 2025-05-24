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
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { AstTreeUtils } from "arkanalyzer";
import { Rule } from "../../model/Rule";
import { Defects, IssueReport } from "../../model/Defects";
import { RuleFix } from '../../model/Fix';
const gMetaData: BaseMetaData = {
  severity: 3,
  ruleDocPath: "docs/prefer-regexp-exec.md",
  description: "Use the `RegExp#exec()` method instead.",
};

interface LocationInfo {
  fileName: string;
  line: number;
  startCol: number;
  endCol: number;
  Qualifier: string;
  object: string;
  argument: string;
  matchStartCol: number;
}

export class PreferRegexpExecCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private isQuotedStringRege = /^(['"]).*\1$/;
  public registerMatchers(): MatcherCallback[] {
    return [{
      matcher: { matcherType: MatcherTypes.FILE },
      callback: this.check,
    }];
  }

  public check = (target: ArkFile) => {
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    const filePath = target.getFilePath();
    this.checkForRegExpExec(sourceFile).forEach((loc) => {
      this.addIssueReportNodeFix(sourceFile, loc, filePath);
    });
  }
  private checkForRegExpExec(sourceFile: ts.SourceFile): LocationInfo[] {
    const issues: LocationInfo[] = [];
    this.traverseAST(sourceFile, (node) => {
      if (this.isMatchCall(node)) {
        this.processMatchCall(node, sourceFile, issues);
      }
    });
    return issues;
  }

  private traverseAST(sourceFile: ts.SourceFile, visitor: (node: ts.Node) => void): void {
    const visitNode = (node: ts.Node): void => {
      visitor(node);
      ts.forEachChild(node, visitNode);
    };
    visitNode(sourceFile);
  }

  private isMatchCall(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'match';
  }

  private processMatchCall(node: ts.CallExpression, sourceFile: ts.SourceFile, issues: LocationInfo[]): void {
    const expression = node.expression as ts.PropertyAccessExpression;
    if (!this.isStringType(expression.expression)) {
      return;
    }

    const regexArg = node.arguments[0];
    if (this.shouldReportIssue(regexArg)) {
      issues.push(this.createLocationInfo(node, expression, regexArg, sourceFile));
    }
  }

  private shouldReportIssue(regexArg: ts.Node): boolean {
    return this.isRegExpType(regexArg) && !this.checkGlobalFlag(regexArg);
  }

  private createLocationInfo(
    node: ts.CallExpression,
    expression: ts.PropertyAccessExpression,
    regexArg: ts.Node,
    sourceFile: ts.SourceFile
  ): LocationInfo {
    const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const endPos = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
    const matchPos = ts.getLineAndCharacterOfPosition(sourceFile, expression.name.getStart());

    return {
      fileName: sourceFile.fileName,
      line: pos.line + 1,
      startCol: pos.character + 1,
      endCol: endPos.character + 1,
      Qualifier: expression.name.text,
      object: expression.expression.getText(sourceFile),
      argument: regexArg.getText(sourceFile),
      matchStartCol: matchPos.character + 1
    };
  }


  private isRegExpType(argNode: ts.Node): boolean {
    if (ts.isStringLiteral(argNode)) {
      try {
        new RegExp(argNode.text);
        return true;
      } catch {
        return false;
      }
    }
    if (ts.isRegularExpressionLiteral(argNode)) return true;
    const resolveRegExpCreation = (node: ts.Node, depth = 0): boolean => {
      if (depth > 5) {
        return false;
      }

      if (ts.isNewExpression(node) && node.expression.getText() === 'RegExp') {
        return true;
      }

      if (ts.isIdentifier(node)) {
        const declaration = this.findVariableDeclaration(node.text, node);
        return declaration ? this.checkRegExpDeclaration(declaration, depth + 1) : false;
      }

      if (ts.isParenthesizedExpression(node)) {
        return resolveRegExpCreation(node.expression, depth + 1);
      }
      return false;
    };

    return resolveRegExpCreation(argNode);
  }

  private checkRegExpDeclaration(declaration: ts.Node, depth: number): boolean {
    if (ts.isVariableDeclaration(declaration)) {
      return declaration.initializer ?
        this.checkRegExpInitializer(declaration.initializer, depth) :
        declaration.type?.getText() === 'RegExp';
    }
    if (ts.isParameter(declaration)) {
      return false;
    }
    return false;
  }

  private checkRegExpInitializer(initializer: ts.Node, depth: number): boolean {
    if (ts.isRegularExpressionLiteral(initializer)) {
      return true;
    }

    if (ts.isNewExpression(initializer) &&
      initializer.expression.getText() === 'RegExp') {
      return true;
    }

    if (ts.isIdentifier(initializer)) {
      return this.checkRegExpDeclaration(initializer, depth + 1);
    }

    if (ts.isStringLiteral(initializer)) {
      return true;
    }

    return false;
  }


  private checkGlobalFlag(regexArg: ts.Node): boolean {
    // 处理正则表达式字面量
    if (ts.isRegularExpressionLiteral(regexArg)) {
      return this.checkFlags(regexArg);
    }

    // 处理变量声明的情况
    if (ts.isIdentifier(regexArg)) {
      return this.handleIdentifier(regexArg);
    }

    // 处理RegExp构造函数调用
    if (ts.isCallExpression(regexArg) && this.isRegExpConstructorCall(regexArg)) {
      return this.handleCallExpression(regexArg);
    }

    // 处理new RegExp的情况
    if (ts.isNewExpression(regexArg) && this.isRegExpNewExpression(regexArg)) {
      return this.handleNewExpression(regexArg);
    }
    return false;
  }

  private checkFlags(node: ts.Node): boolean {
    if (ts.isParameter(node)) {
      return true;
    }

    const extractFlags = (n: ts.Node): string => {
      if (ts.isRegularExpressionLiteral(n)) {
        const text = n.getText();
        return text.slice(text.lastIndexOf('/') + 1);
      }
      if (ts.isStringLiteral(n)) {
        try {
          const parts = n.text.split('/');
          return parts.length > 1 ? parts.pop()! : '';
        } catch {
          return '';
        }
      }
      return n.getText();
    };
    const hasG = ts.isStringLiteral(node) ?
      node.text.includes('g') :
      extractFlags(node).includes('g');
    return hasG;
  }
  private checkFlagsVariable(node: ts.Node): boolean {
    if (ts.isParameter(node)) {
      return true;
    }

    const extractFlags = (n: ts.Node): string => {
      if (ts.isRegularExpressionLiteral(n)) {
        const text = n.getText();
        return text.slice(text.lastIndexOf('/') + 1);
      }
      if (ts.isStringLiteral(n)) {
        try {
          const parts = n.text.split('/');
          return parts.length > 1 ? parts.pop()! : '';
        } catch {
          return '';
        }
      }
      return n.getText();
    };
    const hasV = ts.isStringLiteral(node) ?
      node.text.includes('g') :
      extractFlags(node).includes('g') || extractFlags(node).includes('v');
    return hasV;
  }



  private handleIdentifier(regexArg: ts.Identifier): boolean {
    const declaration = this.findVariableDeclaration(regexArg.text, regexArg);
    return declaration && ts.isVariableDeclaration(declaration) ?
      this.checkFlagsVariable(declaration.initializer ?? declaration) :
      false;
  }

  private handleCallExpression(expr: ts.CallExpression): boolean {
    const flagsNode = expr.arguments?.[1];
    return flagsNode ? this.checkFlags(flagsNode) : false;
  }

  private handleNewExpression(expr: ts.NewExpression): boolean {
    const flagsNode = expr.arguments?.[1];
    return flagsNode && ts.isStringLiteral(flagsNode) ?
      flagsNode.text.includes('g') :
      false;
  }

  private isRegExpConstructorCall(expr: ts.CallExpression): boolean {
    return ts.isIdentifier(expr.expression) &&
      expr.expression.text === 'RegExp';
  }

  private isRegExpNewExpression(expr: ts.NewExpression): boolean {
    return expr.expression.getText() === 'RegExp' &&
      (expr.arguments?.length ?? 0) >= 2;
  }

  private findVariableDeclaration(varName: string, currentNode: ts.Node): ts.Node | undefined {
    let scopeNode: ts.Node | undefined = currentNode;
    while (scopeNode) {
      const declaration = this.findInCurrentScope(varName, scopeNode);
      if (declaration) {
        return declaration;
      };
      scopeNode = this.getParentScope(scopeNode);
    }
    return undefined;
  }
  private findInCurrentScope(varName: string, scopeNode: ts.Node): ts.Node | undefined {
    let declaration: ts.Node | undefined;
    const deepSearch = (node: ts.Node): void => {
      this.checkFunctionParameters(node, varName, d => declaration = d);
      this.checkVariableDeclarations(node, varName, d => declaration = d);
      ts.forEachChild(node, deepSearch);
    };
    deepSearch(scopeNode);
    return declaration;
  }

  private checkFunctionParameters(
    node: ts.Node,
    varName: string,
    onFound: (param: ts.ParameterDeclaration) => void
  ): void {
    if (!ts.isFunctionLike(node)) {
      return;
    }

    node.parameters.forEach(param => {
      if (ts.isIdentifier(param.name) && param.name.text === varName) {
        onFound(param);
      }
    });
  }

  private checkVariableDeclarations(
    node: ts.Node,
    varName: string,
    onFound: (decl: ts.VariableDeclaration) => void
  ): void {
    if (!ts.isVariableStatement(node)) {
      return;
    }

    node.declarationList.declarations.forEach(decl => {
      if (ts.isIdentifier(decl.name) && decl.name.text === varName) {
        onFound(decl);
      }
    });
  }
  private getParentScope(node: ts.Node): ts.Node | undefined {
    let parent = node.parent;
    while (parent) {
      if (ts.isBlock(parent) ||
        ts.isFunctionLike(parent) ||
        ts.isSourceFile(parent)) {
        return parent;
      }
      parent = parent.parent;
    }
    return undefined;
  }

  private ruleFix(sourceFile: ts.SourceFile, loc: LocationInfo): RuleFix {
    const [start, end] = this.getFixRange(sourceFile, loc);
    let fixText: string = '';
    if (!this.isSlashWrappedString(loc.argument)) {
      if (this.isQuotedString(loc.argument)) {
        let arg = this.escapeSlashesInQuotedString(loc.argument);
        fixText = `/${arg}/.exec(${loc.object})`;
      } else {
        fixText = `${loc.argument}.exec(${loc.object})`;
      }
    } else if (this.isSlashWrappedString(loc.argument)) {
      fixText = `${loc.argument}.exec(${loc.object})`;
    }
    return { range: [start, end], text: fixText };
  }

  private escapeSlashesInQuotedString(str: string): string {
    const content = str.slice(1, -1);
    const escapedContent = content.replace(/(?<!\\)\//g, '\\/');
    return `${escapedContent}`;
  }


  private isSlashWrappedString(str: string): boolean {
    return /^\/.+\/$/.test(str);
  }

  private isQuotedString(str: string): boolean {
    let isQuotedString = this.isQuotedStringRege.test(str);
    return isQuotedString;
  }

  private getFixRange(sourceFile: ts.SourceFile, loc: LocationInfo): [number, number] {
    const startPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.startCol - 1);
    const endPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.endCol - 1);
    return [startPosition, endPosition];
  }

  private isStringType(expr: ts.Node): boolean {
    if (ts.isStringLiteral(expr)) {
      return true;
    }
    if (ts.isTemplateExpression(expr)) {
      return true;
    };
    if (ts.isIdentifier(expr)) {
      const declaration = this.findVariableDeclaration(expr.text, expr);
      return declaration ? this.checkStringDeclaration(declaration) : false;
    }
    return false;
  }

  private checkStringDeclaration(decl: ts.Node): boolean {
    if (ts.isVariableDeclaration(decl)) {
      return decl.initializer ?
        ts.isStringLiteral(decl.initializer) :
        /(^|&\s*)string($|\s*&)/.test(this.resolveTypeAlias(decl.type?.getText() || '', decl)) ||
        /^('.*'|".*")(\s*\|\s*('.*'|".*"))*$/.test(decl.type?.getText() || '');
    }
    if (ts.isParameter(decl)) {
      const typeText = decl.type?.getText() || '';
      const resolvedType = this.resolveTypeAlias(typeText, decl);
      return /(^|&\s*)string($|\s*&)/.test(resolvedType) ||
        /^(string|('.*'|".*")(\s*\|\s*('.*'|".*"))*)$/.test(resolvedType);
    }
    return false;
  }

  private resolveTypeAlias(typeName: string, node: ts.Node): string {
    let actualType = typeName;
    const sourceFile = node.getSourceFile();
    const findTypeDeclaration = (root: ts.Node): void => {
      ts.forEachChild(root, child => {
        if (ts.isTypeParameterDeclaration(child) && child.name.text === typeName) {
          actualType = child.constraint?.getText(sourceFile) || typeName;
        }
        else if (ts.isTypeAliasDeclaration(child) && child.name.text === typeName) {
          actualType = child.type.getText(sourceFile);
        }
        findTypeDeclaration(child);
      });
    };
    if (sourceFile) {
      findTypeDeclaration(sourceFile);
    }
    if (actualType !== typeName && !/\bstring\b/.test(actualType)) {
      return this.resolveTypeAlias(actualType, node);
    }
    return actualType;
  }

  private addIssueReportNodeFix(sourceFile: ts.SourceFile, loc: LocationInfo, filePath: string) {
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(loc.line, loc.matchStartCol, loc.endCol, this.metaData.description, severity,
      this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
    let fix: RuleFix = this.ruleFix(sourceFile, loc);
    this.issues.push(new IssueReport(defect, fix));
    RuleListUtil.push(defect);
  }
}

