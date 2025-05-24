/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
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

import { ArkFile, ts, AstTreeUtils } from "arkanalyzer/lib";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../Index";
import { RuleFix } from "../../model/Fix";

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  "SemiCheck"
);

const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/semi.md",
  description: "Require or disallow semicolons instead of ASI"
};

export class SemiCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private arkFile: ArkFile;
  private sourceFile: ts.SourceFile;
  private sourceCode: string;
  private sourceCodeLength: number;
  private static readonly whitespaceRegex = /\s/;
  private static readonly commentRegex = /\/\*[\s\S]*?\*\/|\/\/.*/g;
  private static readonly statementContinuationChars = new Set(['[', '(', '/', '+', '-', ',', '.', '*', '`']);

  private options = {
    semi: 'always',
    omitLastInOneLineBlock: false,
    omitLastInOneLineClassBody: false,
    beforeStatementContinuationChars: 'any'
  };

  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE
  };

  private nodeCache: Map<ts.Node, {
    isOneLineBlock?: boolean,
    lineInfo?: { line: number, character: number },
    hasSemicolon?: boolean
  }> = new Map();
  
  private visitedNodes: Set<ts.Node> = new Set();
  private blockCache: Map<ts.Node, boolean> = new Map();
  private lineCache: Map<number, number> = new Map();

  registerMatchers(): MatcherCallback[] {
    const matchFileCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check.bind(this)
    };

    return [matchFileCb];
  }

  public check(arkFile: ArkFile): void {
    this.arkFile = arkFile;
    this.sourceCode = arkFile.getCode();
    this.sourceCodeLength = this.sourceCode.length;
    this.sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);

    this.nodeCache.clear();
    this.visitedNodes.clear();
    this.blockCache.clear();
    this.lineCache.clear();

    if (this.rule && this.rule.option) {
      if (typeof this.rule.option[0] === 'string') {
        this.options.semi = this.rule.option[0];
      }
      if (typeof this.rule.option[1] === 'object') {
        this.options = { ...this.options, ...this.rule.option[1] };
      }
    }
    this.preProcessSemiAtLineStart();
    this.findAndCheckAllFunctions(this.sourceFile);
    this.visitNode(this.sourceFile);
  }
  
  private preProcessSemiAtLineStart(): void {
    const lines = this.sourceCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineStartPos = this.sourceFile.getLineStarts()[i];
      const line = lines[i].trimLeft();
      if (line.startsWith(';')) {
        const indexOfSemi = lines[i].indexOf(';');
        const semiPos = lineStartPos + indexOfSemi;
        const node = this.findNodeAtPosition(semiPos);
        if (node) {
          this.visitedNodes.add(node);
        }
      }
    }
  }

  private findNodeAtPosition(position: number): ts.Node | undefined {
    let result: ts.Node | undefined;
    
    const visit = (node: ts.Node): void => {
      const start = node.getStart();
      const end = node.getEnd();
      
      if (position >= start && position <= end) {
        if (!result || (end - start < result.getEnd() - result.getStart())) {
          result = node;
        }
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(this.sourceFile);
    return result;
  }

  private getNodeInfo(node: ts.Node): {
    isOneLineBlock?: boolean;
    lineInfo?: {
        line: number;
        character: number;
    };
    hasSemicolon?: boolean;
} | undefined {
    let info = this.nodeCache.get(node);
    if (!info) {
      info = {};
      this.nodeCache.set(node, info);
    }
    return info;
  }

  private getLineAndCharacter(pos: number): { line: number, character: number } {
    const cached = this.lineCache.get(pos);
    if (cached !== undefined) {
      return { line: cached, character: pos - this.getLineStart(cached) };
    }
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(pos);
    this.lineCache.set(pos, line);
    return { line, character };
  }

  private getLineStart(line: number): number {
    return this.sourceFile.getLineStarts()[line];
  }

  private visitNode(node: ts.Node): void {
    if (this.visitedNodes.has(node)) {
      return;
    }
    if (this.processDeclarationNodes(node)) {
      return;
    }
    if (this.processStatementNodes(node)) {
      return;
    }
    if (this.processClassAndInterfaceNodes(node)) {
      return;
    }
    this.processBlockAndFunctionNodes(node);
    if (this.processExpressionNodes(node)) {
      return;
    }
    ts.forEachChild(node, child => this.visitNode(child));
  }
  
  private processDeclarationNodes(node: ts.Node): boolean {
    if (ts.isImportDeclaration(node)) {
      this.handleImportDeclaration(node);
      return true;
    }
    
    if (ts.isTypeAliasDeclaration(node)) {
      this.handleTypeAliasDeclaration(node);
      return true;
    }
    
    return false;
  }
  
  private processStatementNodes(node: ts.Node): boolean {
    if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
      this.handleBreakContinueStatement(node);
      this.visitedNodes.add(node);
    }
    
    if (ts.isTryStatement(node)) {
      this.handleTryStatement(node);
      ts.forEachChild(node, child => this.visitNode(child));
      return true;
    }
    
    if (ts.isIfStatement(node)) {
      this.handleIfStatementNodes(node);
      return true;
    }
    
    if (ts.isWhileStatement(node)) {
      this.handleWhileStatementNodes(node);
      return true;
    }
    
    if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
      this.handleForStatement(node);
      return false;
    }
    
    if (ts.isVariableStatement(node)) {
      this.handleVariableStatementNodes(node);
      return true;
    }
    
    return false;
  }
  
  private processClassAndInterfaceNodes(node: ts.Node): boolean {
    if (ts.isInterfaceDeclaration(node) || ts.isModuleDeclaration(node) || ts.isEnumDeclaration(node)) {
      this.handleInterfaceAndModuleNodes(node);
      return true;
    }
    
    if (ts.isClassDeclaration(node)) {
      if (this.handleClassDeclarationNodes(node)) {
        return true;
      }
      this.handleClassDeclaration(node);
      return true;
    }
    
    return false;
  }
  
  private processBlockAndFunctionNodes(node: ts.Node): void {
    if (ts.isBlock(node)) {
      this.handleBlockNodes(node);
    }
    
    if (ts.isReturnStatement(node)) {
      this.handleReturnStatement(node);
      this.visitedNodes.add(node);
    } else if (ts.isThrowStatement(node)) {
      this.handleThrowStatement(node);
      this.visitedNodes.add(node);
    } else if (ts.isDoStatement(node)) {
      this.handleDoWhileStatement(node);
      this.visitedNodes.add(node);
    } else if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
      this.handleArrowFunctionExpression(node);
      this.visitedNodes.add(node);
    }
    
    if (ts.isFunctionDeclaration(node)) {
      this.handleFunctionDeclaration(node);
    } else if (ts.isMethodDeclaration(node)) {
      this.handleMethodDeclaration(node);
    } else if (ts.isClassStaticBlockDeclaration(node)) {
      this.handleClassStaticBlock(node);
    } else if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      this.handleFunctionExpression(node);
    } else if (this.isStatement(node)) {
      this.checkSemicolon(node);
    }
    
    if (ts.isVariableDeclaration(node) && node.initializer && 
        (ts.isClassExpression(node.initializer) || ts.isClassDeclaration(node.initializer))) {
      this.handleVariableDeclarationWithClass(node);
    }
  }
  
  private processExpressionNodes(node: ts.Node): boolean {
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      this.checkFunctionCallSemicolon(node);
      return true;
    }
    
    if (ts.isExpressionStatement(node)) {
      this.handleExpressionStatementNodes(node);
      return true;
    }
    
    if (ts.isCallExpression(node)) {
      this.handleCallExpressionNodes(node);
    }
    
    if (ts.isObjectLiteralExpression(node)) {
      this.handleObjectLiteralExpressions(node);
    }
    
    return false;
  }

  private handleImportDeclaration(node: ts.ImportDeclaration): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      this.report(node, 'Extra semicolon.');
    }
    
    this.visitedNodes.add(node);
  }

  private handleTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      this.report(node, 'Extra semicolon.');
    }
    this.visitedNodes.add(node);
  }

  private handleIfStatementNodes(node: ts.IfStatement): void {
    if (ts.isBlock(node.thenStatement)) {
      this.deepVisitBlockStatements(node.thenStatement);
    } else {
      this.visitNode(node.thenStatement);
    }
    
    if (node.elseStatement) {
      if (ts.isBlock(node.elseStatement)) {
        this.deepVisitBlockStatements(node.elseStatement);
      } else {
        this.visitNode(node.elseStatement);
      }
    }
  }

  private handleWhileStatementNodes(node: ts.WhileStatement): void {
    const statement = node.statement;
    if (ts.isBlock(statement)) {
      this.deepVisitBlockStatements(statement);
    } else {
      this.visitNode(statement);
    }
  }

  private handleInterfaceAndModuleNodes(node: ts.InterfaceDeclaration | ts.ModuleDeclaration | ts.EnumDeclaration): void {
    this.visitedNodes.add(node);
    ts.forEachChild(node, child => this.visitNode(child));
  }

  private handleClassDeclarationNodes(node: ts.ClassDeclaration): boolean {
    const parent = node.parent;
    if (ts.isBlock(parent)) {
      const grandParent = parent.parent;
      if (ts.isIfStatement(grandParent) || 
          ts.isWhileStatement(grandParent) || 
          ts.isForStatement(grandParent) || 
          ts.isForInStatement(grandParent) || 
          ts.isForOfStatement(grandParent) ||
          ts.isDoStatement(grandParent) ||
          ts.isClassStaticBlockDeclaration(grandParent)) {
        this.visitedNodes.add(node);
        this.handleClassDeclaration(node);
        return true;
      }
    }
    return false;
  }

  private handleBlockNodes(node: ts.Block): void {
    const parent = node.parent;
    if (ts.isIfStatement(parent) || 
        ts.isWhileStatement(parent) || 
        ts.isForStatement(parent) || 
        ts.isForInStatement(parent) || 
        ts.isForOfStatement(parent) ||
        ts.isDoStatement(parent)) {
      this.visitedNodes.add(node);
    }
  }

  private handleVariableStatementNodes(node: ts.VariableStatement): void {
    this.checkVariableDeclaration(node);
    ts.forEachChild(node, child => this.visitNode(child));
  }

  private handleExpressionStatementNodes(node: ts.ExpressionStatement): void {
    const nodeStart = node.getStart();
    if (this.isSemiAtLineStart(nodeStart)) {
      this.visitedNodes.add(node);
      return;
    }

    const expression = node.expression;
    if (ts.isObjectLiteralExpression(expression) || 
        ts.isNumericLiteral(expression) || 
        ts.isStringLiteral(expression)) {
      const nodeEnd = node.getEnd();
      const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
      if (this.options.semi === 'always' && !hasSemicolon) {
        this.report(node, 'Missing semicolon.');
      } else if (this.options.semi === 'never' && hasSemicolon) {
        this.report(node, 'Extra semicolon.');
      }
      this.visitedNodes.add(node);
      ts.forEachChild(node, child => this.visitNode(child));
    } else {
      this.checkSemicolon(node);
      ts.forEachChild(node, child => this.visitNode(child));
    }
  }

  private handleCallExpressionNodes(node: ts.CallExpression): void {
    this.checkParentNodeContext(node);
    this.checkFunctionArguments(node);
  }

  private checkParentNodeContext(node: ts.CallExpression): void {
    const parent = node.parent;
    if (ts.isExpressionStatement(parent)) {
      // 已经在其他地方处理
      return;
    }
    
    if (ts.isCallExpression(parent)) {
      return;
    }
    
    const grandParent = parent?.parent;
    if (!grandParent || !ts.isBlock(grandParent)) {
      return;
    }
    
    const statements = grandParent.statements;
    const lastStatement = statements[statements.length - 1];
    
    if (lastStatement && 
        ts.isExpressionStatement(lastStatement) && 
        lastStatement.expression === parent) {
      this.checkCallExpressionSemicolon(lastStatement);
    }
  }

  private checkFunctionArguments(node: ts.CallExpression): void {
    node.arguments.forEach(arg => {
      if (!(ts.isFunctionExpression(arg) || ts.isArrowFunction(arg)) || !arg.body) {
        return;
      }
      
      if (ts.isBlock(arg.body)) {
        this.checkFunctionBodyStatements(arg.body);
      }
    });
  }
  
  private checkFunctionBodyStatements(body: ts.Block): void {
    body.statements.forEach(stmt => {
      if (ts.isExpressionStatement(stmt)) {
        const stmtEnd = stmt.getEnd();
        const hasSemicolon = this.sourceCode[stmtEnd - 1] === ';';
        if (this.options.semi === 'always' && !hasSemicolon) {
          this.report(stmt, 'Missing semicolon.');
        } else if (this.options.semi === 'never' && hasSemicolon) {
          this.report(stmt, 'Extra semicolon.');
        }
      } else {
        this.visitNode(stmt);
      }
    });
  }

  private handleObjectLiteralExpressions(node: ts.ObjectLiteralExpression): void {
    const parent = node.parent;
    if (ts.isExpressionStatement(parent)) {
      // 已经在其他地方处理
    } else {
      this.checkParentContextForLiteral(node);
    }
  }

  private handleClassDeclaration(node: ts.ClassDeclaration): void {
    node.members.forEach(member => {
      if (ts.isPropertyDeclaration(member)) {
        this.handlePropertyDeclaration(member);
      } else if (ts.isMethodDeclaration(member) && !member.body) {
        this.checkSemicolon(member);
      } else if (ts.isMethodDeclaration(member)) {
        this.handleMethodWithBody(member);
      } else if (ts.isClassStaticBlockDeclaration(member)) {
        this.handleStaticBlockDeclaration(member);
      }
    });
  }

  private handlePropertyDeclaration(member: ts.PropertyDeclaration): void {
    const nodeEnd = member.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(member, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      this.report(member, 'Extra semicolon.');
    }
  }

  private handleMethodWithBody(member: ts.MethodDeclaration): void {
    if (member.body) {
      member.body.statements.forEach(stmt => {
        this.visitNode(stmt);
      });
    }
  }

  private handleStaticBlockDeclaration(member: ts.ClassStaticBlockDeclaration): void {
    if (member.body && member.body.statements) {
      member.body.statements.forEach(stmt => {
        this.visitNode(stmt);
      });
    }
  }

  private handleFunctionDeclaration(node: ts.FunctionDeclaration): void {
    const modifiers = node.modifiers;
    if (modifiers && modifiers.some(mod => mod.kind === ts.SyntaxKind.DeclareKeyword)) {
      this.checkSemicolon(node);
    } else if (node.body) {
      this.visitNode(node.body);
    }
  }

  private handleMethodDeclaration(node: ts.MethodDeclaration): void {
    if (node.body) {
      node.body.statements.forEach(stmt => {
        this.visitNode(stmt);
      });
    }
  }

  private handleClassStaticBlock(node: ts.ClassStaticBlockDeclaration): void {
    if (node.body && node.body.statements) {
      node.body.statements.forEach(stmt => {
        this.visitNode(stmt);
      });
    }
  }

  private handleFunctionExpression(node: ts.FunctionExpression | ts.ArrowFunction): void {
    if (!node.body || !ts.isBlock(node.body)) {
      return;
    }
    
    node.body.statements.forEach(stmt => {
      if (ts.isExpressionStatement(stmt)) {
        this.checkExpressionStatementSemicolon(stmt);
      } else {
        this.visitNode(stmt);
      }
    });
  }

  private checkExpressionStatementSemicolon(stmt: ts.ExpressionStatement): void {
    const stmtEnd = stmt.getEnd();
    const hasSemicolon = this.sourceCode[stmtEnd - 1] === ';';
    
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(stmt, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      this.report(stmt, 'Extra semicolon.');
    }
  }

  private handleVariableDeclarationWithClass(node: ts.VariableDeclaration): void {
    if (node.parent && node.parent.parent) {
      this.checkSemicolon(node.parent.parent);
    }
  }

  private checkVariableDeclaration(node: ts.VariableStatement): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      this.report(node, 'Extra semicolon.');
    }
  }

  private isStatement(node: ts.Node): boolean {
    if (this.isBlockInControlFlow(node) || this.isClassInSpecialContext(node)) {
      return false;
    }

    if (this.isInterfaceOrModuleOrEnum(node)) {
      return false;
    }

    if (this.isControlFlowStatement(node)) {
      return false;
    }

    if (this.isExportedInterface(node)) {
      return false;
    }

    if (this.isFunctionOrMethodWithDeclare(node)) {
      return true;
    }

    return this.isCommonStatementType(node);
  }
  
  private isBlockInControlFlow(node: ts.Node): boolean {
    if (!ts.isBlock(node)) {
      return false;
    }
    
    const parent = node.parent;
    return ts.isWhileStatement(parent) || 
           ts.isIfStatement(parent) || 
           ts.isForStatement(parent) || 
           ts.isForInStatement(parent) || 
           ts.isForOfStatement(parent) ||
           ts.isDoStatement(parent);
  }
  
  private isClassInSpecialContext(node: ts.Node): boolean {
    if (!ts.isClassDeclaration(node)) {
      return false;
    }
    
    const parent = node.parent;
    if (ts.isBlock(parent)) {
      const grandParent = parent.parent;
      return ts.isIfStatement(grandParent) || 
             ts.isWhileStatement(grandParent) || 
             ts.isForStatement(grandParent) || 
             ts.isForInStatement(grandParent) || 
             ts.isForOfStatement(grandParent) ||
             ts.isDoStatement(grandParent) ||
             ts.isClassStaticBlockDeclaration(grandParent);
    }
    
    return false;
  }
  
  private isInterfaceOrModuleOrEnum(node: ts.Node): boolean {
    return ts.isInterfaceDeclaration(node) || 
           ts.isModuleDeclaration(node) || 
           ts.isEnumDeclaration(node);
  }
  
  private isControlFlowStatement(node: ts.Node): boolean {
    return ts.isWhileStatement(node) || 
           ts.isIfStatement(node) || 
           (ts.isClassDeclaration(node) && !ts.isVariableDeclaration(node.parent));
  }
  
  private isExportedInterface(node: ts.Node): boolean {
    if (!ts.isInterfaceDeclaration(node)) {
      return false;
    }
    
    const modifiers = node.modifiers;
    return modifiers !== undefined && 
           modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) && 
           modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
  }
  
  private isFunctionOrMethodWithDeclare(node: ts.Node): boolean {
    if (!ts.isFunctionDeclaration(node) && !ts.isMethodDeclaration(node)) {
      return false;
    }
    
    const modifiers = node.modifiers;
    return modifiers !== undefined && 
           modifiers.some(mod => mod.kind === ts.SyntaxKind.DeclareKeyword);
  }
  
  private isCommonStatementType(node: ts.Node): boolean {
    return ts.isExpressionStatement(node) || 
           ts.isVariableStatement(node) || 
           ts.isReturnStatement(node) ||
           ts.isBreakStatement(node) || 
           ts.isContinueStatement(node) || 
           ts.isThrowStatement(node) ||
           ts.isImportDeclaration(node) || 
           ts.isExportDeclaration(node) || 
           ts.isDebuggerStatement(node) ||
           ts.isEmptyStatement(node) || 
           ts.isDoStatement(node) || 
           ts.isWhileStatement(node) ||
           ts.isExportAssignment(node) || 
           ts.isImportEqualsDeclaration(node) || 
           ts.isTypeAliasDeclaration(node) ||
           (ts.isMethodDeclaration(node) && !node.body) || 
           (ts.isPropertyDeclaration(node) && !node.initializer);
  }

  private handleIncrementDecrementExpression(node: ts.Node, nodeEnd: number, hasSemicolon: boolean): boolean {
    if (!ts.isExpressionStatement(node)) {
      return false;
    }
  
    const expr = node.expression;
    if (!((ts.isPrefixUnaryExpression(expr) || ts.isPostfixUnaryExpression(expr)) &&
        (expr.operator === ts.SyntaxKind.PlusPlusToken || expr.operator === ts.SyntaxKind.MinusMinusToken))) {
      return false;
    }
  
    const operatorText = expr.operator === ts.SyntaxKind.PlusPlusToken ? '++' : '--';
    const nodeText = this.sourceCode.substring(node.getStart(), nodeEnd);
    const hasOperandBefore = nodeText.indexOf(operatorText) > 0;
    const hasOperandAfter = nodeText.indexOf(operatorText) < nodeText.length - 2;
    
    if (!hasOperandBefore && !hasOperandAfter) {
      return false;
    }
  
    const nextChar = this.getNextCharacter(nodeEnd, this.sourceCode);
    if (!nextChar || SemiCheck.whitespaceRegex.test(nextChar)) {
      this.handleSemicolonRule(node, hasSemicolon);
      return true;
    }
  
    return false;
  }
  
  private handleWhileStatementBlock(node: ts.Node, hasSemicolon: boolean): boolean {
    if (!ts.isBlock(node.parent) || !ts.isWhileStatement(node.parent.parent)) {
      return false;
    }
  
    const blockText = this.sourceCode.substring(node.parent.getStart(), node.parent.getEnd());
    if (!blockText.includes('\n')) {
      if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
        this.handleSemicolonRule(node, hasSemicolon);
        return true;
      }
    }
    return false;
  }
  
  private handleOneLineBlock(node: ts.Node, hasSemicolon: boolean): boolean {
    if (!ts.isBlock(node.parent)) {
      return false;
    }
  
    const blockText = this.sourceCode.substring(node.parent.getStart(), node.parent.getEnd());
    if (!blockText.includes('\n')) {
      const parentParent = node.parent.parent;
      if (parentParent && (
        ts.isForStatement(parentParent) ||
        ts.isForInStatement(parentParent) ||
        ts.isForOfStatement(parentParent) ||
        ts.isWhileStatement(parentParent) ||
        ts.isIfStatement(parentParent) ||
        ts.isFunctionDeclaration(parentParent)
      )) {
        this.handleSemicolonRule(node, hasSemicolon);
        return true;
      }
    }
    return false;
  }
  
  private handleSemicolonRule(node: ts.Node, hasSemicolon: boolean, isASIDangerous?: boolean): void {
    const nodeStart = node.getStart();
    if (this.isSemiAtLineStart(nodeStart)) {
      return;
    }
    
    if (this.options.semi === 'always') {
      if (!hasSemicolon) {
        if (this.options.omitLastInOneLineBlock && this.isLastInOneLineBlock(node)) {
          return;
        }
        if (this.options.omitLastInOneLineClassBody && this.isLastInOneLineClassBody(node)) {
          return;
        }
        this.report(node, 'Missing semicolon.');
      }
    } else if (this.options.semi === 'never') {
      if (hasSemicolon) {
        if (this.options.beforeStatementContinuationChars === 'always' && isASIDangerous) {
          return;
        }
        if (this.options.beforeStatementContinuationChars === 'never' ||
            (this.options.beforeStatementContinuationChars === 'any' && !isASIDangerous)) {
          this.report(node, 'Extra semicolon.');
        }
      } else if (isASIDangerous && this.options.beforeStatementContinuationChars === 'always') {
        this.report(node, 'Missing semicolon.');
      }
    }
  }
  
  private checkSemicolon(node: ts.Node): void {
    if (this.visitedNodes.has(node)) {
      return;
    }
    this.visitedNodes.add(node);
    if (this.isExpressionInClassStaticBlock(node)) {
      this.checkStaticBlockExpression(node);
      return;
    }
    const nodeStart = node.getStart();
    if (this.isSemiAtLineStart(nodeStart)) {
      return;
    }
    if (this.shouldSkipNodeCheck(node)) {
      return;
    }
    const nodeEnd = node.getEnd();
    const info = this.getNodeInfo(node);
    if (!info) {
      return;
    }
    if (info.hasSemicolon === undefined) {
      info.hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    }
    const hasSemicolon = info.hasSemicolon;
    if (this.handleWhileStatementBlock(node, hasSemicolon) ||
        this.handleOneLineBlock(node, hasSemicolon) ||
        this.handleIncrementDecrementExpression(node, nodeEnd, hasSemicolon)) {
      return;
    }
    this.processSemicolonForNode(node, nodeEnd, info, hasSemicolon);
  }
  
  private isExpressionInClassStaticBlock(node: ts.Node): boolean {
    return ts.isExpressionStatement(node) && 
           node.parent && 
           ts.isBlock(node.parent) && 
           node.parent.parent && 
           ts.isClassStaticBlockDeclaration(node.parent.parent);
  }
  
  private checkStaticBlockExpression(node: ts.Node): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    }
  }
  
  private shouldSkipNodeCheck(node: ts.Node): boolean {
    if (this.isControlFlowStatementWithoutSemicolon(node)) {
      return true;
    }
    if (ts.isInterfaceDeclaration(node) || ts.isModuleDeclaration(node) || ts.isEnumDeclaration(node)) {
      return true;
    }
    if (this.isBlockInSpecialContext(node)) {
      return true;
    }
    return false;
  }
  
  private isControlFlowStatementWithoutSemicolon(node: ts.Node): boolean {
    return ts.isWhileStatement(node) || 
           ts.isIfStatement(node) || 
           ts.isForStatement(node) || 
           ts.isForInStatement(node) || 
           ts.isForOfStatement(node) || 
           ts.isDoStatement(node) ||
           (ts.isClassDeclaration(node) && !this.isExpressionPartOfVariableDeclaration(node));
  }
  
  private isBlockInSpecialContext(node: ts.Node): boolean {
    if (!ts.isBlock(node)) {
      return false;
    }
    const parent = node.parent;
    if (ts.isWhileStatement(parent) || 
        ts.isIfStatement(parent) || 
        ts.isForStatement(parent) ||
        ts.isForInStatement(parent) || 
        ts.isForOfStatement(parent) || 
        ts.isDoStatement(parent)) {
      return true;
    }
    if (node.statements && node.statements.length > 0) {
      const lastStmt = node.statements[node.statements.length - 1];
      return ts.isIfStatement(lastStmt) || 
             ts.isWhileStatement(lastStmt) || 
             ts.isForStatement(lastStmt) ||
             ts.isForInStatement(lastStmt) || 
             ts.isForOfStatement(lastStmt) || 
             ts.isDoStatement(lastStmt);
    }
    
    return false;
  }
  
  private processSemicolonForNode(node: ts.Node, nodeEnd: number, info: any, hasSemicolon: boolean): void {
    const nextCharacter = this.getNextCharacter(nodeEnd, this.sourceCode);
    const isASIDangerous = this.isStatementContinuationChar(nextCharacter);
    
    if (!info.lineInfo) {
      info.lineInfo = this.getLineAndCharacter(nodeEnd);
    }
    const currentLine = info.lineInfo.line;
    const nextNonWhitespace = this.getNextNonWhitespaceChar(nodeEnd, this.sourceCode);
    const nextCharPos = this.sourceCode.indexOf(nextNonWhitespace, nodeEnd);
    
    if (nextCharPos !== -1) {
      const nextLine = this.getLineAndCharacter(nextCharPos).line;
      if (this.isSameLineNonComment(currentLine, nextLine, nextNonWhitespace, nextCharPos) && 
          !this.isStatementContinuationChar(nextNonWhitespace)) {
        if (!ts.isExpressionStatement(node) || 
            (nextNonWhitespace !== '' && !SemiCheck.whitespaceRegex.test(nextNonWhitespace))) {
          return;
        }
      }
    }
    
    this.handleSemicolonRule(node, hasSemicolon, isASIDangerous);
  }
  
  private isSameLineNonComment(currentLine: number, nextLine: number, nextChar: string, nextCharPos: number): boolean {
    return currentLine === nextLine && 
           !this.isCommentStart(nextChar, this.sourceCode.charAt(nextCharPos + 1));
  }

  private isLastInOneLineBlock(node: ts.Node): boolean {
    const parent = node.parent;
    if (!parent) {
      return false;
    }

    if (!ts.isBlock(parent) && !(ts.isClassStaticBlockDeclaration && ts.isClassStaticBlockDeclaration(parent))) {
      return false;
    }

    let statements: ts.NodeArray<ts.Statement> | undefined;
    if (ts.isBlock(parent)) {
      statements = parent.statements;
    } else if (ts.isClassStaticBlockDeclaration(parent)) {
      statements = parent.body.statements;
    }

    if (!statements || statements[statements.length - 1] !== node) {
      return false;
    }

    const blockStart = parent.getStart();
    const blockEnd = parent.getEnd();
    const blockText = this.sourceCode.slice(blockStart, blockEnd);
    
    return !blockText.replace(SemiCheck.commentRegex, '').trim().includes('\n');
  }

  private isLastInOneLineClassBody(node: ts.Node): boolean {
    const parent = node.parent;
    if (!parent || !ts.isClassDeclaration(parent)) {
      return false;
    }

    const members = parent.members;
    if (members[members.length - 1] !== node) {
      return false;
    }

    const classStart = parent.getStart();
    const classEnd = parent.getEnd();
    const classText = this.sourceCode.slice(classStart, classEnd);
    
    return !classText.replace(SemiCheck.commentRegex, '').trim().includes('\n');
  }

  private getNextCharacter(position: number, sourceCode: string): string {
    let i = position;
    
    i = this.skipWhitespaceChars(i, sourceCode);
    if (i >= this.sourceCodeLength) {
      return '';
    }
    
    const commentResult = this.trySkipComment(i, sourceCode);
    if (commentResult.isComment) {
      return this.getNextCharacter(commentResult.newPosition, sourceCode);
    }
    
    return i < this.sourceCodeLength ? sourceCode[i] : '';
  }
  
  private skipWhitespaceChars(position: number, sourceCode: string): number {
    let i = position;
    while (i < this.sourceCodeLength && SemiCheck.whitespaceRegex.test(sourceCode[i])) {
      i++;
    }
    return i;
  }
  
  private trySkipComment(position: number, sourceCode: string): { isComment: boolean; newPosition: number } {
    if (position >= this.sourceCodeLength - 1) {
      return { isComment: false, newPosition: position };
    }
    
    const char = sourceCode[position];
    const nextChar = sourceCode[position + 1];
    
    if (char !== '/' || (nextChar !== '/' && nextChar !== '*')) {
      return { isComment: false, newPosition: position };
    }
    
    return this.handleCommentSkip(position, nextChar, sourceCode);
  }
  
  private handleCommentSkip(position: number, commentType: string, sourceCode: string): { isComment: boolean; newPosition: number } {
    if (commentType === '/') {
      return this.skipLineComment(position, sourceCode);
    }
    
    return this.skipBlockComment(position, sourceCode);
  }
  
  private skipLineComment(position: number, sourceCode: string): { isComment: boolean; newPosition: number } {
    const newlinePos = sourceCode.indexOf('\n', position);
    if (newlinePos === -1) {
      return { isComment: true, newPosition: this.sourceCodeLength };
    }
    return { isComment: true, newPosition: newlinePos + 1 };
  }
  
  private skipBlockComment(position: number, sourceCode: string): { isComment: boolean; newPosition: number } {
    const commentEndPos = sourceCode.indexOf('*/', position + 2);
    if (commentEndPos === -1) {
      return { isComment: true, newPosition: this.sourceCodeLength };
    }
    return { isComment: true, newPosition: commentEndPos + 2 };
  }

  private isStatementContinuationChar(char: string): boolean {
    if (!char) {
      return false;
    }
    
    if (char === '+' || char === '-') {
      const charIndex = this.sourceCode.indexOf(char);
      const nextChar = this.sourceCode[charIndex + 1];
      if ((char === '+' && nextChar === '+') || (char === '-' && nextChar === '-')) {
        const prevChar = this.sourceCode[charIndex - 1];
        const afterChar = this.sourceCode[charIndex + 2];
        
        return (!prevChar || SemiCheck.whitespaceRegex.test(prevChar)) && 
               (!afterChar || SemiCheck.whitespaceRegex.test(afterChar));
      }
    }
    
    return SemiCheck.statementContinuationChars.has(char);
  }

  private isCommentStart(char: string, nextChar: string): boolean {
    return (char === '/' && (nextChar === '/' || nextChar === '*'));
  }

  private getNextNonWhitespaceChar(position: number, sourceCode: string): string {
    let i = position;
    while (i < this.sourceCodeLength && SemiCheck.whitespaceRegex.test(sourceCode[i])) {
      i++;
    }
    return sourceCode[i] || '';
  }

  private report(node: ts.Node, message: string): void {
    const endPos = node.getEnd();
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(endPos);
    let column = character;
    
    if (this.options.semi === 'always' || this.options.beforeStatementContinuationChars === 'always') {
      if (message.includes('Missing')) {
        column = character + 1;
      }
    } else if (this.options.semi === 'never') {
      if (message.includes('Extra')) {
        column = character;
      }
    }
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(
      line + 1,
      column,
      column + 1,
      message,
      severity,
      this.rule.ruleId,
      this.arkFile.getFilePath(),
      this.metaData.ruleDocPath,
      true, 
      false,
      true 
    );

    let fix: RuleFix | undefined;
    if (message.includes('Missing')) {
      fix = { range: [endPos, endPos], text: ';' };
    } else if (message.includes('Extra')) {
      fix = { range: [endPos - 1, endPos], text: '' };
    }

    const issue = new IssueReport(defect, fix);
    this.issues.push(issue);
    RuleListUtil.push(defect);
  }

  private isExpressionPartOfVariableDeclaration(node: ts.Node): boolean {
    if (!node.parent) {
      return false;
    }

    if (ts.isVariableDeclaration(node.parent)) {
      return true;
    }

    const parent = node.parent;
    if (ts.isExpressionStatement(parent) && parent.expression === node) {
      return true;
    }
    
    return ts.isPropertyAssignment(node.parent) || 
           ts.isBinaryExpression(node.parent) ||
           ts.isReturnStatement(node.parent);
  }

  private checkFunctionCallSemicolon(node: ts.ExpressionStatement): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      const nextChar = this.getNextCharacter(nodeEnd, this.sourceCode);
      const isASIDangerous = this.isStatementContinuationChar(nextChar);
      
      if (this.options.beforeStatementContinuationChars === 'always' && isASIDangerous) {
        return;
      }
      
      if (this.options.beforeStatementContinuationChars === 'never' ||
          (this.options.beforeStatementContinuationChars === 'any' && !isASIDangerous)) {
        this.report(node, 'Extra semicolon.');
      }
    }
  }

  private handleReturnStatement(node: ts.ReturnStatement): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      const nextChar = this.getNextCharacter(nodeEnd, this.sourceCode);
      const isASIDangerous = this.isStatementContinuationChar(nextChar);
      
      if (this.options.beforeStatementContinuationChars === 'always' && isASIDangerous) {
        return;
      }
      
      if (this.options.beforeStatementContinuationChars === 'never' ||
          (this.options.beforeStatementContinuationChars === 'any' && !isASIDangerous)) {
        this.report(node, 'Extra semicolon.');
      }
    }
  }
  
  private handleTryStatement(node: ts.TryStatement): void {
    const visitBlock = (block: ts.Block): void => {
      if (block && block.statements) {
        block.statements.forEach(stmt => {
          this.visitNode(stmt);
        });
      }
    };
    
    if (node.tryBlock) {
      visitBlock(node.tryBlock);
    }
    
    if (node.catchClause && node.catchClause.block) {
      visitBlock(node.catchClause.block);
    }
    
    if (node.finallyBlock) {
      visitBlock(node.finallyBlock);
    }
  }

  private handleBreakContinueStatement(node: ts.BreakOrContinueStatement): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      const nextChar = this.getNextCharacter(nodeEnd, this.sourceCode);
      const isASIDangerous = this.isStatementContinuationChar(nextChar);
      if (this.options.beforeStatementContinuationChars === 'always' && isASIDangerous) {
        return;
      }
      if (this.options.beforeStatementContinuationChars === 'never' ||
          (this.options.beforeStatementContinuationChars === 'any' && !isASIDangerous)) {
        this.report(node, 'Extra semicolon.');
      }
    }
  }

  private handleThrowStatement(node: ts.ThrowStatement): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      const nextChar = this.getNextCharacter(nodeEnd, this.sourceCode);
      const isASIDangerous = this.isStatementContinuationChar(nextChar);
      
      if (this.options.beforeStatementContinuationChars === 'always' && isASIDangerous) {
        return;
      }
      
      if (this.options.beforeStatementContinuationChars === 'never' ||
          (this.options.beforeStatementContinuationChars === 'any' && !isASIDangerous)) {
        this.report(node, 'Extra semicolon.');
      }
    }
  }

  private handleDoWhileStatement(node: ts.DoStatement): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      const nextChar = this.getNextCharacter(nodeEnd, this.sourceCode);
      const isASIDangerous = this.isStatementContinuationChar(nextChar);
      
      if (this.options.beforeStatementContinuationChars === 'always' && isASIDangerous) {
        return;
      }
      
      if (this.options.beforeStatementContinuationChars === 'never' ||
          (this.options.beforeStatementContinuationChars === 'any' && !isASIDangerous)) {
        this.report(node, 'Extra semicolon.');
      }
    }
  }
  
  private handleArrowFunctionExpression(node: ts.ArrowFunction): void {
    const parent = node.parent;
    if (ts.isExpressionStatement(parent)) {
      const nodeEnd = parent.getEnd();
      const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
      if (this.options.semi === 'always' && !hasSemicolon) {
        this.report(parent, 'Missing semicolon.');
      } else if (this.options.semi === 'never' && hasSemicolon) {
        const nextChar = this.getNextCharacter(nodeEnd, this.sourceCode);
        const isASIDangerous = this.isStatementContinuationChar(nextChar);
        if (this.options.beforeStatementContinuationChars === 'always' && isASIDangerous) {
          return;
        }
        if (this.options.beforeStatementContinuationChars === 'never' ||
            (this.options.beforeStatementContinuationChars === 'any' && !isASIDangerous)) {
          this.report(parent, 'Extra semicolon.');
        }
      }
    }
  }

  private checkCallExpressionSemicolon(node: ts.ExpressionStatement): void {
    const nodeEnd = node.getEnd();
    const hasSemicolon = this.sourceCode[nodeEnd - 1] === ';';
    if (this.options.semi === 'always' && !hasSemicolon) {
      this.report(node, 'Missing semicolon.');
    } else if (this.options.semi === 'never' && hasSemicolon) {
      this.report(node, 'Extra semicolon.');
    }
  }

  private deepVisitBlockStatements(block: ts.Block): void {
    block.statements.forEach(stmt => {
      this.visitNode(stmt);
      if (ts.isIfStatement(stmt)) {
        this.processIfStatementBranches(stmt);
      } else if (ts.isWhileStatement(stmt)) {
        this.processWhileStatement(stmt);
      } else if (ts.isTryStatement(stmt)) {
        this.processTryStatement(stmt);
      } else if (ts.isVariableStatement(stmt)) {
        this.processVariableDeclarations(stmt);
      }
    });
  }

  private processIfStatementBranches(stmt: ts.IfStatement): void {
    if (ts.isBlock(stmt.thenStatement)) {
      this.deepVisitBlockStatements(stmt.thenStatement);
    } else {
      this.visitNode(stmt.thenStatement);
    }
    
    if (stmt.elseStatement) {
      if (ts.isBlock(stmt.elseStatement)) {
        this.deepVisitBlockStatements(stmt.elseStatement);
      } else {
        this.visitNode(stmt.elseStatement);
      }
    }
  }

  private processWhileStatement(stmt: ts.WhileStatement): void {
    const statement = stmt.statement;
    if (ts.isBlock(statement)) {
      this.deepVisitBlockStatements(statement);
    } else {
      this.visitNode(statement);
    }
  }

  private processTryStatement(stmt: ts.TryStatement): void {
    if (stmt.tryBlock) {
      this.deepVisitBlockStatements(stmt.tryBlock);
    }
    
    if (stmt.catchClause && stmt.catchClause.block) {
      this.deepVisitBlockStatements(stmt.catchClause.block);
    }
    
    if (stmt.finallyBlock) {
      this.deepVisitBlockStatements(stmt.finallyBlock);
    }
  }

  private processVariableDeclarations(stmt: ts.VariableStatement): void {
    stmt.declarationList.declarations.forEach(decl => {
      if (decl.initializer && 
          (ts.isFunctionExpression(decl.initializer) || ts.isArrowFunction(decl.initializer)) && 
          ts.isBlock(decl.initializer.body)) {
        this.deepVisitBlockStatements(decl.initializer.body);
      }
    });
  }

  private checkParentContextForLiteral(node: ts.Node): void {
    const parent = node.parent;
    if (!parent) {
      return;
    }
    if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
      const grandParent = parent.parent?.parent;
      if (grandParent && ts.isVariableStatement(grandParent)) {
        this.checkSemicolon(grandParent);
      }
    } else if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
      this.findExpressionStatementAncestor(parent);
    } else if (ts.isBinaryExpression(parent) &&
               (parent.left === node || parent.right === node)) {
      this.findExpressionStatementAncestor(parent);
    }
  }

  private findExpressionStatementAncestor(node: ts.Node): void {
    let current: ts.Node | undefined = node;
    while (current && current.parent) {
      if (ts.isExpressionStatement(current.parent)) {
        this.checkSemicolon(current.parent);
        break;
      }
      current = current.parent;
    }
  }

  private findAndCheckAllFunctions(node: ts.Node): void {
    if ((ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && node.body) {
      if (ts.isBlock(node.body)) {
        this.checkFunctionBlockStatements(node.body);
      } else if (!ts.isBlock(node.body) && ts.isIdentifier(node.body)) {
        this.checkIdentifierFunctionBody(node);
      }
    }
    
    if (ts.isCallExpression(node)) {
      this.checkFunctionCallArguments(node);
    }
    
    ts.forEachChild(node, child => this.findAndCheckAllFunctions(child));
  }
  
  private checkFunctionBlockStatements(block: ts.Block): void {
    block.statements.forEach(stmt => {
      if (ts.isExpressionStatement(stmt)) {
        this.checkExpressionStatementSemicolon(stmt);
        this.visitedNodes.add(stmt);
      } else {
        this.visitNode(stmt);
      }
    });
  }
  
  private checkIdentifierFunctionBody(node: ts.ArrowFunction | ts.FunctionExpression): void {
    const parent = node.parent;
    if (parent && ts.isExpressionStatement(parent)) {
      const parentEnd = parent.getEnd();
      const hasSemicolon = this.sourceCode[parentEnd - 1] === ';';
      
      if (this.options.semi === 'always' && !hasSemicolon) {
        this.report(parent, 'Missing semicolon.');
      } else if (this.options.semi === 'never' && hasSemicolon) {
        this.report(parent, 'Extra semicolon.');
      }
    }
  }
  
  private checkFunctionCallArguments(node: ts.CallExpression): void {
    node.arguments.forEach(arg => {
      if ((ts.isFunctionExpression(arg) || ts.isArrowFunction(arg)) && arg.body) {
        if (ts.isBlock(arg.body)) {
          this.checkFunctionArgumentBlockStatements(arg.body);
        }
      }
    });
  }
  
  private checkFunctionArgumentBlockStatements(body: ts.Block): void {
    body.statements.forEach(stmt => {
      if (ts.isExpressionStatement(stmt)) {
        this.checkExpressionStatementSemicolon(stmt);
        this.visitedNodes.add(stmt);
      }
    });
  }

  private isSemiAtLineStart(position: number): boolean {
    const { line } = this.sourceFile.getLineAndCharacterOfPosition(position);
    const lineStartPos = this.sourceFile.getLineStarts()[line];
    for (let i = lineStartPos; i < position; i++) {
      if (!SemiCheck.whitespaceRegex.test(this.sourceCode[i])) {
        return false;
      }
    }
    return this.sourceCode[position] === ';';
  }

  private handleForStatement(node: ts.ForStatement | ts.ForInStatement | ts.ForOfStatement): void {
    const statement = node.statement;
    if (ts.isBlock(statement)) {
      statement.statements.forEach(stmt => {
        if (this.isStatement(stmt)) {
          this.checkSemicolon(stmt);
        }
      });
    } else if (this.isStatement(statement)) {
      this.checkSemicolon(statement);
    }
    this.visitNode(statement);
  }
}