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
import { ts, AstTreeUtils, MethodSubSignature, MethodSignature, ArkPtrInvokeExpr, FieldSignature, ArkMethod, ArkInstanceFieldRef, ArkInstanceInvokeExpr, Local, ArkInvokeStmt, Stmt, FunctionType, NumberType, UnknownType, ArkAssignStmt, ArkStaticFieldRef, ArkStaticInvokeExpr, ClassSignature, ArkNormalBinopExpr, ArkNewExpr } from 'arkanalyzer';
import { MatcherCallback, MatcherTypes, MethodMatcher } from '../../matcher/Matchers';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { Scene } from 'arkanalyzer';

const G_META_DATA: BaseMetaData = {
  severity: 2,
  ruleDocPath: 'docs/no-implied-eval.md',
  description: 'Implied eval. Consider passing a function.',
};
const FUNCTION_CONSTRUCTOR = 'Function';
const GLOBAL_CANDIDATES = new Set(['global', 'window', 'globalThis']);
const EVAL_LIKE_METHODS = new Set(['setImmediate', 'setInterval', 'setTimeout', 'execScript']);

export class NoImpliedEvalCheck implements BaseChecker {
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  readonly metaData: BaseMetaData = G_META_DATA;
  public rule: Rule;
  private buildMatcher: MethodMatcher = {
    matcherType: MatcherTypes.METHOD,
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildCallback: MatcherCallback = {
      matcher: this.buildMatcher,
      callback: this.check
    };
    return [matchBuildCallback];
  };
  public check = (arkMethod: ArkMethod): void => {
    const scene = arkMethod.getDeclaringArkFile().getScene();
    const statements = arkMethod.getBody()?.getCfg().getStmts() ?? [];
    for (const statement of statements) {
      if (statement instanceof ArkInvokeStmt) {
        this.handleArkInvokeStmt(statement, scene);
      } else if (statement instanceof ArkAssignStmt) {
        this.handleArkAssignStmt(statement);
      };
    };
  };
  private handleArkInvokeStmt(statement: ArkInvokeStmt, scene: Scene): void {
    const originalText = statement.getOriginalText();
    if (!originalText) {
      return;
    };
    const filteredEvalLikeMethods = this.filterEvalLikeMethods(statement);
    const hasEvalLikeMethod = this.hasEvalLikeMethod(originalText, filteredEvalLikeMethods);
    const invokeExpression = statement.getInvokeExpr();
    if (hasEvalLikeMethod) {
      if (this.shouldSkipInvokeExpression(invokeExpression)) {
        return;
      }
      const argumentsList = invokeExpression.getArgs();
      if (this.hasInvalidArgsTypes(argumentsList, scene, originalText)) {
        this.handleInvalidArgs(statement, originalText);
      }
    } else if (originalText.includes(FUNCTION_CONSTRUCTOR)) {
      if (!this.isValidFunctionCall(originalText)) {
        return;
      };
      this.handleFunctionConstructorInInvoke(statement, invokeExpression);
    };
  };
  private handleInvalidArgs(statement: ArkInvokeStmt, originalText: string): void {
    let regex = /(?:setTimeout|setInterval|setImmediate|execScript)\((.*?)(?:,|\))/;
    const match = originalText.match(regex);
    let text = match ? match[1].trim() : originalText;
    const isGlobalCandidate = this.hasGlobalCandidate(originalText);
    if (isGlobalCandidate) {
      text = this.getValueAst(originalText);
    };
    const finalText = text !== undefined ? text : originalText;
    this.addIssueReport(statement, finalText, this.metaData.description);
  };
  private handleFunctionConstructorInInvoke(statement: ArkInvokeStmt, invokeExpression: any): void {
    if (!(invokeExpression instanceof ArkInstanceInvokeExpr)) {
      return;
    };
    const baseType = invokeExpression.getBase()?.getType()?.getTypeString();
    if (!baseType || !this.isFunctionConstructor(baseType)) {
      return;
    };
    const base = invokeExpression.getBase();
    if (!(base instanceof Local)) {
      return;
    };
    const baseDeclaringStatement = base.getDeclaringStmt();
    if (!(baseDeclaringStatement instanceof ArkAssignStmt)) {
      return;
    };
    const rightOperand = baseDeclaringStatement.getRightOp();
    if (rightOperand instanceof ArkNewExpr) {
      const errorMessage = 'Implied eval. Do not use the Function constructor to create functions.';
      this.addIssueReport(statement, 'new', errorMessage);
    };
  };
  private handleArkAssignStmt(statement: ArkAssignStmt): void {
    const originalText = statement.getOriginalText();
    if (!originalText) {
      return;
    };
    if (originalText.includes(FUNCTION_CONSTRUCTOR)) {
      if (!this.isValidFunctionCall(originalText)) {
        return;
      };
      const errorMessage = 'Implied eval. Do not use the Function constructor to create functions.';
      const rightValue = statement.getRightOp();
      if (rightValue instanceof ArkInstanceInvokeExpr) {
        this.handleInstanceInvokeInAssign(statement, rightValue, errorMessage);
      } else if (rightValue instanceof ArkStaticInvokeExpr) {
        this.handleStaticInvokeInAssign(statement, rightValue, errorMessage);
      };
    };
  };
  private isValidFunctionCall(originalText: string): boolean {
    const validPatterns = [
      // 处理 Function() 形式
      /\s*(?:let|var|const)?\s+\w+\s*=\s*Function\(\)/,
      // 处理 new Function(...) 形式
      /\s*(?:let|var|const)?\s+\w+\s*=\s*new\s+Function\([^)]*\)/,
      // 处理 window.Function() 形式
      /\s*(?:let|var|const)?\s+\w+\s*=\s*window.Function\(\)/,
      // 处理 new window.Function() 形式
      /\s*(?:let|var|const)?\s+\w+\s*=\s*new\s+window.Function\(\)/,
      // 处理 window['Function']() 形式
      /\s*(?:let|var|const)?\s+\w+\s*=\s*window\['Function']\(\)/,
      // 处理 new window['Function']() 形式
      /\s*(?:let|var|const)?\s+\w+\s*=\s*new\s+window\['Function']\(\)/
    ];
    return validPatterns.some(pattern => pattern.test(originalText));
  };
  private handleInstanceInvokeInAssign(statement: ArkAssignStmt, rightValue: ArkInstanceInvokeExpr, errorMessage: string): void {
    const base = rightValue.getBase();
    if (base instanceof Local) {
      const baseType = rightValue.getBase().getType();
      if (baseType instanceof FunctionType || baseType instanceof UnknownType) {
        this.addIssueReport(statement, base.getName(), errorMessage);
      };
    };
  };
  private handleStaticInvokeInAssign(statement: ArkAssignStmt, rightValue: ArkStaticInvokeExpr, errorMessage: string): void {
    const methodName = rightValue.getMethodSignature()?.getMethodSubSignature()?.getMethodName();
    if (methodName) {
      this.addIssueReport(statement, methodName, errorMessage);
    };
  };
  private filterEvalLikeMethods(statement: ArkInvokeStmt): Set<string> {
    const methods = new Set(EVAL_LIKE_METHODS);
    const file = statement.getCfg().getDeclaringMethod().getDeclaringArkClass().getDeclaringArkFile();
    file.getImportInfos().forEach(importInfo => {
      const importName = importInfo.getImportClauseName();
      if (methods.has(importName)) {
        methods.delete(importName);
      };
    });
    const classMethods = statement.getCfg().getDeclaringMethod().getDeclaringArkClass().getMethods();
    classMethods.forEach(method => {
      const methodName = method.getName();
      if (methods.has(methodName)) {
        methods.delete(methodName);
      };
    });
    return methods;
  };
  private hasGlobalCandidate(originalText: string): boolean {
    return Array.from(GLOBAL_CANDIDATES).some(method => originalText.includes(method));
  };
  private hasEvalLikeMethod(originalText: string, methods: Set<string>): boolean {
    return Array.from(methods).some(method => originalText.includes(method));
  };
  private shouldSkipInvokeExpression(invokeExpression: any): boolean {
    if (invokeExpression instanceof ArkInstanceInvokeExpr) {
      const base = invokeExpression.getBase();
      if (base instanceof Local) {
        const name = base.getName();
        const hasGlobalCandidate = Array.from(GLOBAL_CANDIDATES).some(method => name === method);
        return !hasGlobalCandidate;
      };
    };
    return false;
  };
  private hasInvalidArgsTypes(argumentsList: any[], scene: Scene, originalText: string): boolean {
    const argsMax = argumentsList.length;
    const leftType = argumentsList[0]?.getType();
    const rightType = argumentsList[1]?.getType();

    const isInvalidBasicTypes = argsMax === 1
      ? !(leftType instanceof FunctionType)
      : !(leftType instanceof FunctionType) || !(rightType instanceof NumberType);

    if (!isInvalidBasicTypes) {
      return false;
    };

    const leftTypeValue = leftType?.getTypeString();
    if (leftTypeValue === 'Function') {
      return false;
    };

    if (argumentsList[0] instanceof Local) {
      if (this.isValidBinopExpr(argumentsList[0])) {
        return false;
      };
      if (leftType instanceof UnknownType) {
        return !this.handleUnknownType(argumentsList[0], scene, originalText);
      };
    };
    return true;
  };
  private isValidBinopExpr(leftValue: Local): boolean {
    const declaringStatement = leftValue.getDeclaringStmt();
    if (declaringStatement instanceof ArkAssignStmt) {
      const declaringRightValue = declaringStatement.getRightOp();
      if (declaringRightValue instanceof ArkNormalBinopExpr) {
        const rightOp1 = declaringRightValue.getOp1();
        const rightOp2 = declaringRightValue.getOp2();
        if (rightOp1 && rightOp2) {
          const type1 = rightOp1.getType();
          const type2 = rightOp2.getType();
          return type1 instanceof FunctionType && type2 instanceof FunctionType;
        };
      };
    };
    return false;
  };
  private handleUnknownType(leftValue: Local, scene: Scene, originalText: string): boolean {
    const declaringStatement = leftValue.getDeclaringStmt();
    if (declaringStatement instanceof ArkAssignStmt) {
      const declaringRightValue = declaringStatement.getRightOp();
      if (declaringRightValue instanceof ArkStaticFieldRef) {
        return this.isFunctionType(declaringRightValue.getFieldSignature().getType());
      } else if (declaringRightValue instanceof ArkInstanceInvokeExpr) {
        const base = declaringRightValue.getBase();
        if (base instanceof Local) {
          return base.getType() instanceof UnknownType
            ? this.handleBaseUnknownType(base, scene, originalText)
            : this.isFunctionType(base.getType());
        };
      } else if (declaringRightValue instanceof ArkInstanceFieldRef) {
        return this.handleInstanceFieldRef(declaringRightValue, scene, originalText);
      } else if (declaringRightValue instanceof ArkPtrInvokeExpr) {
        return this.handlePtrInvokeExpr(declaringRightValue);
      };
    };
    return false;
  };
  private handleBaseUnknownType(base: Local, scene: Scene, originalText: string): boolean {
    const declaringStmt = base.getDeclaringStmt();
    if (declaringStmt instanceof ArkAssignStmt) {
      const right = declaringStmt.getRightOp();
      if (right instanceof ArkInstanceFieldRef) {
        return this.handleInstanceFieldRef(right, scene, originalText);
      };
    };
    return false;
  };
  private handleInstanceFieldRef(declaringRightValue: ArkInstanceFieldRef, scene: Scene, originalText: string): boolean {
    const mFieldSignature = declaringRightValue.getFieldSignature();
    if (mFieldSignature instanceof FieldSignature) {
      const getDeclaringSignature = mFieldSignature.getDeclaringSignature();
      if (getDeclaringSignature instanceof ClassSignature) {
        const mClass = scene.getClass(getDeclaringSignature);
        const mFields = mClass?.getFields();
        if (mFields && mFields.length > 0) {
          return this.checkFields(mFields);
        } else {
          return this.checkBase(declaringRightValue, originalText);
        };
      };
    };
    return false;
  };
  private checkInitializerForFunctionType(initializer: any[]): boolean {
    for (const minitializer of initializer) {
      if (minitializer instanceof ArkAssignStmt) {
        const type = minitializer.getRightOp().getType();
        if (type instanceof FunctionType) {
          return true;
        };
      };
    };
    return false;
  };
  private checkFields(mFields: any[]): boolean {
    for (const field of mFields) {
      const initializer = field.getInitializer();
      if (!initializer) {
        continue;
      };
      if (this.checkInitializerForFunctionType(initializer)) {
        return true;
      };
    };
    return false;
  };
  private checkBase(declaringRightValue: ArkInstanceFieldRef, originalText: string): boolean {
    const base = declaringRightValue.getBase();
    if (base instanceof Local) {
      const baseDeclaringStatement = base.getDeclaringStmt();
      if (baseDeclaringStatement instanceof ArkAssignStmt) {
        const baseDeclaringStmtText = baseDeclaringStatement.getOriginalText();
        if (baseDeclaringStmtText) {
          return this.checkTypeAst(baseDeclaringStmtText, originalText);
        };
      };
    };
    return false;
  };
  private handlePtrInvokeExpr(declaringRightValue: ArkPtrInvokeExpr): boolean {
    const funcPtrLocal = declaringRightValue.getFuncPtrLocal();
    if (funcPtrLocal instanceof Local) {
      const type = funcPtrLocal.getType();
      if (type instanceof FunctionType) {
        const methodSignature = type.getMethodSignature();
        if (methodSignature instanceof MethodSignature) {
          return this.isReturnTypeFunctionType(methodSignature);
        };
      };
    };
    return false;
  };
  private isReturnTypeFunctionType(methodSignature: MethodSignature): boolean {
    const getMethodSubSignature = methodSignature.getMethodSubSignature();
    if (getMethodSubSignature instanceof MethodSubSignature) {
      const returnType = getMethodSubSignature.getReturnType();
      return returnType instanceof FunctionType;
    };
    return false;
  };
  private isFunctionType(type: any): boolean {
    return type instanceof FunctionType;
  };
  private isFunctionConstructor(baseType: string): boolean {
    return baseType.includes('Function') || baseType.includes('window.Function') || baseType.includes('window[\'Function\']');
  };
  private checkTypeAst(baseDeclaringStmtText: string, originalText: string): boolean {
    const ast = AstTreeUtils.getASTNode('checkTypeAst.ts', baseDeclaringStmtText);
    const visit = (node: ts.Node): boolean => {
      return this.checkMethodDeclaration(node, originalText);
    };
    return visit(ast);
  };

  private checkMethodDeclaration(node: ts.Node, originalText: string): boolean {
    if (ts.isMethodDeclaration(node)) {
      if (ts.isIdentifier(node.name)) {
        const name = node.name.text;
        if (originalText.includes(name)) {
          return true;
        };
      };
    };
    return ts.forEachChild(node, (childNode) => this.checkMethodDeclaration(childNode, originalText)) || false;
  };
  private getValueAst(originalText: string): string {
    const ast = AstTreeUtils.getASTNode('getValueAst.ts', originalText);
    const visit = (node: ts.Node): string => {
      if (ts.isCallExpression(node)) {
        if (node.arguments.length > 0) {
          const text = node.arguments[0].getText();
          return text;
        };
      };
      const result = ts.forEachChild(node, visit);
      return result || originalText;
    };
    return visit(ast);
  };
  private addIssueReport(statement: Stmt, name: string, errorMessage: string): void {
    const warnInfo = this.getLineAndColumn(statement, name);
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = (new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, errorMessage, severity, this.rule.ruleId,
      warnInfo.filePath, this.metaData.ruleDocPath, true, false, false));
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  };
  private getLineAndColumn(statement: Stmt, name: string): { line: number; startCol: number; endCol: number; filePath: string } {
    const arkFile = statement.getCfg()?.getDeclaringMethod().getDeclaringArkClass().getDeclaringArkFile();
    if (arkFile) {
      const originText = statement.getOriginalText() ?? '';
      const pos = originText.indexOf(name);
      if (pos !== -1) {
        const originPosition = statement.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        let startCol = originPosition.getColNo();
        startCol += pos;
        const endCol = startCol + name.length - 1;
        const originPath = arkFile.getFilePath();
        return { line, startCol, endCol, filePath: originPath };
      };
    };
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  };
};