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

import { AnyType, ArkArrayRef, ArkAssignStmt, ArkCastExpr, ArkClass, ArkField, ArkFile, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkMethod, ArkNewArrayExpr, ArkNormalBinopExpr, ArkStaticFieldRef, ArkStaticInvokeExpr, ArrayType, AstTreeUtils, ClassType, Local, Stmt, StringType, ts, Type, UnknownType, Value } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { isAppointType } from "../../utils/checker/TypeUtils";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { NumberConstant } from "arkanalyzer/lib/core/base/Constant";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnsafeAssignmentCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/no-unsafe-assignment.md",
  description: "Disallow assigning a value with type `any` to variables and properties.",
};

type AnyPosition = { line: number, startCol: number, endCol: number };

export class NoUnsafeAssignmentCheck implements BaseChecker {
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  public registerMatchers(): MatcherCallback[] {
    const fileMatcherCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    }
    return [fileMatcherCb];
  }

  private arkFile: ArkFile;

  public check = (target: ArkFile) => {
    this.arkFile = target;
    const originPath = target.getName();
    if (!this.isTsFile(originPath)) {
      return;
    }

    target.getNamespaces().forEach((namespace) => {
      this.checkClass(namespace.getClasses());
    });

    this.checkClass(target.getClasses());
  }

  private checkClass(mClasses: ArkClass[]): void {
    mClasses.forEach((clazz: ArkClass) => {
      const mFields = clazz.getFields();
      this.checkFields(mFields);

      const mMethods = clazz.getMethods();
      this.checkMethod(mMethods);
    });
  }

  private checkMethod(mMethods: ArkMethod[]): void {
    mMethods.forEach((method: ArkMethod) => {
      const blocks = method.getCfg()?.getBlocks();
      if (!blocks) {
        return;
      }
      blocks.forEach((block) => {
        const stmts = block.getStmts();
        this.checkStmts(stmts);
      });
    });
  }

  private checkStmts(stmts: Stmt[]): void {
    stmts.forEach((stmt) => {
      const originalText = stmt.getOriginalText();
      if (!(stmt instanceof ArkAssignStmt) || !this.isHasAssignment(originalText ?? '')) {
        return;
      }
      if (originalText?.includes('catch')) {
        return;
      }
      let leftText = '';
      const leftOp = stmt.getLeftOp();
      if (leftOp instanceof Local && !leftOp.getName().startsWith('%')) {
        leftText = leftOp.getName();
      } else if (leftOp instanceof ArkStaticFieldRef || leftOp instanceof ArkInstanceFieldRef) {
        leftText = leftOp.getFieldName();
      } else if (leftOp instanceof ArkNormalBinopExpr) {
        leftText = this.getLeftTextByAst(stmt.getOriginalText() ?? '');
      }

      if (this.shouldSaveError(stmt) && leftText.length > 0) {
        this.saveError(stmt, leftText);
      }
    });
  }

  private shouldSaveError(stmt: ArkAssignStmt): boolean {
    const rightOp = stmt.getRightOp();
    const leftOp = stmt.getLeftOp();
    const originalText = stmt.getOriginalText() ?? '';

    // 提取判断逻辑为辅助函数
    if (this.isInvalidRightOp(rightOp)) {
      return false;
    }

    if (this.isContainsCompoundAssignmentOperators(originalText)) {
      return false;
    }

    if (this.isInvalidTypeCombination(leftOp, rightOp, originalText)) {
      return false;
    }

    if (this.isSafeInvokeExpression(rightOp)) {
      return false;
    }

    return true;
  }

  // 辅助函数：检查右操作数是否无效
  private isInvalidRightOp(rightOp: Value): boolean {
    let isInvalid = false;
    if (rightOp instanceof Local) {
      const type = rightOp.getType();
      if (type instanceof ArrayType) {
        const declaringStmt = rightOp.getDeclaringStmt();
        if (declaringStmt instanceof ArkAssignStmt) {
          const rightOp = declaringStmt.getRightOp();
          isInvalid = this.isInvalidRightOp(rightOp);
        }
      }
      if (rightOp.getName() === 'this' && rightOp.getType() instanceof ClassType) {
        isInvalid = true;
      }
    } else if (rightOp instanceof ArkNewArrayExpr) {
      const size = rightOp.getSize();
      if (size instanceof NumberConstant && Number(size.getValue()) === 0) {
        return true;
      }
    }
    return isInvalid;
  }

  // 辅助函数：检查类型组合是否无效
  private isInvalidTypeCombination(leftOp: Value, rightOp: Value, originalText: string): boolean {
    const rightType = this.getType(rightOp);
    const leftType = this.getType(leftOp);

    if (!this.isAnyType(rightType) && !this.isUnknowType(rightType)) {
      return true;
    }

    if (this.isLeftHasDeclarationType(originalText) && this.isUnknowType(leftType)) {
      return true;
    }

    return false;
  }

  // 辅助函数：检查是否为安全的调用表达式
  private isSafeInvokeExpression(rightOp: Value): boolean {
    return (rightOp instanceof ArkStaticInvokeExpr && this.isArkStaticInvokeExprSafe(rightOp)) ||
      (rightOp instanceof ArkInstanceInvokeExpr && this.isArkInstanceInvokeExprSafe(rightOp));
  }

  /**
   * 判断代码中是否包含复合赋值运算符
   * 复合赋值运算符包括：+=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>=, >>>=
   * 
   * @param sourceCode 
   * @returns 
   */
  private isContainsCompoundAssignmentOperators(sourceCode: string): boolean {
    const sourceFile = AstTreeUtils.getASTNode('source', sourceCode);

    let containsOperator = false;

    const visitNode = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node)) {
        const operator = node.operatorToken.kind;
        if (
          operator === ts.SyntaxKind.PlusEqualsToken || // +=
          operator === ts.SyntaxKind.AsteriskEqualsToken || // *=
          operator === ts.SyntaxKind.MinusEqualsToken || // -=
          operator === ts.SyntaxKind.SlashEqualsToken || // /=
          operator === ts.SyntaxKind.PercentEqualsToken || // %=
          operator === ts.SyntaxKind.AmpersandEqualsToken || // &=
          operator === ts.SyntaxKind.BarEqualsToken || // |=
          operator === ts.SyntaxKind.CaretEqualsToken || // ^=
          operator === ts.SyntaxKind.LessThanLessThanEqualsToken || // <<=
          operator === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken || // >>=
          operator === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken // >>>=
        ) {
          containsOperator = true;
          return;
        }
      }
      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return containsOperator;
  }

  private checkFields(mFields: ArkField[]): void {
    mFields.forEach((field: ArkField) => {
      const fieldInitializer = field.getInitializer();

      this.checkStmts(fieldInitializer);
    });
  }

  private getType(value: Value): Type | undefined {
    if (value instanceof Local) {
      let type: Type | undefined = value.getType();
      if (type instanceof ClassType) {
        type = this.checkClassTypeHasAnyOrUnknown(type);
      }
      return type;
    } else if (value instanceof ArkArrayRef) {
      return value.getBase().getType();
    } else if (value instanceof ArkInstanceFieldRef) {
      if (value.getFieldSignature() && value.getFieldSignature().getType()) {
        return value.getFieldSignature().getType();
      }
    } else if (value instanceof ArkNormalBinopExpr) {
      return this.getArkNormalBinopExprRealType(value);
    } else if (value instanceof ArkStaticFieldRef) {
      return value.getFieldSignature().getType();
    } else if (value instanceof ArkStaticInvokeExpr) {
      const args = value.getArgs();
      const arg = args.find((arg) => {
        if (this.isAnyType(arg.getType()) || this.isUnknowType(arg.getType())) {
          arg;
        }
      });
      return arg ? arg.getType() : value.getMethodSignature().getMethodSubSignature().getReturnType();
    } else if (value instanceof ArkInstanceInvokeExpr) {
      const args = value.getArgs();
      const arg = args.find((arg) => {
        if (this.isAnyType(arg.getType()) || this.isUnknowType(arg.getType())) {
          arg;
        }
      });
      return arg ? arg.getType() : value.getMethodSignature().getMethodSubSignature().getReturnType();
    } else if (value instanceof ArkCastExpr) {
      return value.getType();
    }
    return undefined;
  }

  private checkClassTypeHasAnyOrUnknown(type: ClassType): Type | undefined {
    let mType: Type | undefined = type;
    const classSignature = type.getClassSignature();
    const className = classSignature.getClassName();
    const realGenericTypes = type.getRealGenericTypes();
    const declaringFileSignature = classSignature.getDeclaringFileSignature();
    const fileName = declaringFileSignature.getFileName();
    if (className === 'RegExp' ||
      className === 'Array' ||
      className === 'Map' ||
      className === 'Set' ||
      className === 'Boolean' ||
      className === 'String' ||
      className === 'Number' ||
      className === 'Promise' ||
      fileName !== '%unk'
    ) {
      realGenericTypes?.forEach((genericType) => {
        if (this.isAnyType(genericType)) {
          mType = AnyType.getInstance();
        } else if (this.isUnknowType(genericType)) {
          mType = UnknownType.getInstance();
        }
      });
    } else if (fileName === '%unk') {
      mType = UnknownType.getInstance();
    }
    return type;
  }

  private getArkNormalBinopExprRealType(data: ArkNormalBinopExpr): Type | undefined {
    const op1 = data.getOp1();
    const op2 = data.getOp2();

    // 检查是否为字符串类型
    if (this.isStringTypeOperation(data, op1, op2)) {
      return StringType.getInstance();
    }

    // 检查是否为 Any 或 Unknown 类型
    const anyOrUnknownType = this.getAnyOrUnknownType(op1, op2);
    if (anyOrUnknownType) {
      return anyOrUnknownType;
    }

    // 检查操作数是否为 Local 类型并获取其声明的类型
    const op1Type = this.getTypeFromLocal(op1);
    if (op1Type) {
      return op1Type;
    }

    const op2Type = this.getTypeFromLocal(op2);
    if (op2Type) {
      return op2Type;
    }

    return undefined;
  }

  // 辅助函数：检查是否为字符串类型操作
  private isStringTypeOperation(data: ArkNormalBinopExpr, op1: Value, op2: Value): boolean {
    return data.getOperator() === '+' &&
      (op1.getType() instanceof StringType || op2.getType() instanceof StringType);
  }

  // 辅助函数：检查是否为 Any 或 Unknown 类型
  private getAnyOrUnknownType(op1: Value, op2: Value): Type | undefined {
    if (this.isAnyType(op1.getType()) || this.isAnyType(op2.getType())) {
      return AnyType.getInstance();
    }
    if (this.isUnknowType(op1.getType()) || this.isUnknowType(op2.getType())) {
      return UnknownType.getInstance();
    }
    return undefined;
  }

  // 辅助函数：从 Local 类型中获取声明的类型
  private getTypeFromLocal(op: Value): Type | undefined {
    if (op instanceof Local && op.getName().startsWith('%')) {
      const stmt = op.getDeclaringStmt();
      if (stmt && stmt instanceof ArkAssignStmt) {
        return this.getType(stmt.getRightOp());
      }
    }
    return undefined;
  }

  private isArkInstanceInvokeExprSafe(data: ArkInstanceInvokeExpr): boolean {
    let isSafe = true;
    const methodInfo = data.getMethodSignature()?.getMethodSubSignature();
    if (methodInfo.getReturnType() && this.isAnyType(methodInfo.getReturnType())) {
      isSafe = false;
    }
    const args = data.getArgs();
    args.forEach((arg) => {
      if (arg.getType() && this.isAnyType(arg.getType())) {
        isSafe = false;
      }
    });
    return isSafe;
  }

  private isArkStaticInvokeExprSafe(data: ArkStaticInvokeExpr): boolean {
    let isSafe = true;
    const methodInfo = data.getMethodSignature()?.getMethodSubSignature();
    const methodName = methodInfo.getMethodName();
    if (methodName === 'RegExp' || methodName === 'Boolean' || methodName === 'Number' || methodName === '"parseInt"') {
      return isSafe;
    }
    if (methodInfo.getReturnType() && this.isAnyType(methodInfo.getReturnType())) {
      isSafe = false;
    }
    const args = data.getArgs();
    args.forEach((arg) => {
      if (arg.getType() && this.isAnyType(arg.getType())) {
        isSafe = false;
      }
    });
    return isSafe;
  }

  private saveError(stmt: ArkAssignStmt, leftText: string = ''): void {
    let posArr = this.getLineAndColumnByAst(stmt, leftText);
    if (posArr.size <= 0) {
      posArr = this.getLineAndColumnFromStmt(stmt, leftText);
    }
    posArr.forEach((pos) => {
      if (pos) {
        const message = 'Unsafe assignment of an `any` value.';
        this.addIssueReport(pos, message);
      }
    });
  }

  private getLineAndColumnFromStmt(stmt: ArkAssignStmt, leftText: string = ''): Set<AnyPosition> {
    const set = new Set<AnyPosition>();
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();

    if (!stmt.getOriginalText()) {
      return set;
    }

    if (this.isFieldRefAssignment(stmt)) {
      this.addFieldRefPosition(stmt, leftText, set);
    } else {
      this.addOperandPosition(stmt, arkFile, set);
    }

    return set;
  }

  // 辅助函数：检查是否为字段引用赋值
  private isFieldRefAssignment(stmt: ArkAssignStmt): boolean {
    return stmt instanceof ArkAssignStmt &&
      (stmt.getLeftOp() instanceof ArkInstanceFieldRef || stmt.getLeftOp() instanceof ArkStaticFieldRef);
  }

  // 辅助函数：添加字段引用的位置信息
  private addFieldRefPosition(stmt: ArkAssignStmt, leftText: string, set: Set<AnyPosition>): void {
    const originPosition = stmt.getOriginPositionInfo();
    const line = originPosition.getLineNo();
    const startCol = originPosition.getColNo();
    const endCol = startCol + leftText.length;

    set.add({ line, startCol, endCol });
  }

  // 辅助函数：添加操作数的位置信息
  private addOperandPosition(stmt: ArkAssignStmt, arkFile: ArkFile | undefined, set: Set<AnyPosition>): void {
    const positions = stmt.getOperandOriginalPositions();
    if (!positions || positions.length < 1) {
      logger.debug('positions is empty');
      return;
    }

    const index = this.getOperandIndex(stmt);
    const position = positions[index];

    if (!arkFile) {
      logger.debug('originStmt or arkFile is null');
      return;
    }

    const line = position.getFirstLine();
    const startCol = position.getFirstCol();
    const endCol = position.getLastCol();

    set.add({ line, startCol, endCol });
  }

  // 辅助函数：获取操作数索引
  private getOperandIndex(stmt: ArkAssignStmt): number {
    return stmt instanceof ArkAssignStmt && stmt.getRightOp() instanceof ArkArrayRef ? 1 : 0;
  }

  private isAnyType(type: Type | undefined): boolean {
    if (!type) {
      return false;
    }
    return isAppointType(AnyType.getInstance(), type);
  }

  private isUnknowType(type: Type | undefined): boolean {
    if (!type) {
      return false;
    }
    return isAppointType(UnknownType.getInstance(), type);
  }

  private addIssueReport(pos: AnyPosition, message: string) {
    const severity = this.rule.alert ?? this.metaData.severity;
    let defects = new Defects(pos.line, pos.startCol, pos.endCol, message, severity, this.rule.ruleId,
      this.arkFile.getFilePath(), this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defects, undefined));
    RuleListUtil.push(defects);
  }

  /**
   * 获取指定文本在 ArkMethod 或 Stmt 对象中的行号和起始列号信息
   * @param data ArkMethod 或 Stmt 对象，需要在其中查找指定文本
   * @param text 需要查找的文本内容
   * @returns 包含行号和起始列号信息的数组，每个元素是一个包含 line 和 start 属性的对象
   */
  private getLineAndColumnByAst(data: ArkMethod | Stmt | ArkField | ArkClass, text: string): Set<AnyPosition> {
    const set: Set<AnyPosition> = new Set();
    if (data instanceof ArkMethod) {
      this.processArkMethod(data, text, set);
    } else if (data instanceof Stmt) {
      this.processStmt(data, text, set);
    } else if (data instanceof ArkField) {
      this.processArkField(data, text, set);
    } else if (data instanceof ArkClass) {
      this.processArkClass(data, text, set);
    }
    return set;
  }
  private processArkClass(data: ArkClass, text: string, set: Set<AnyPosition>): void {
    const line = data.getLine();
    const col = data.getColumn();
    let code = data.getCode() ?? '';
    const posArr = this.getAllIndices(code, text);
    posArr.forEach((pos) => {
      pos.line += line;
      pos.startCol = pos.startCol + (pos.line === line ? col : 1);
      pos.endCol = pos.endCol + (pos.line === line ? col : 1);
      set.add(pos);
    });
  }

  /**
   * 处理 ArkField 对象，查找指定文本在方法代码中的位置，并将位置信息添加到数组中
   * @param data ArkField 对象，包含方法的相关信息
   * @param text 需要在方法代码中查找的文本
   * @param arr 用于存储找到的文本位置信息的数组，每个元素是一个包含行号和起始列号的对象
   */
  private processArkField(data: ArkField, text: string, set: Set<AnyPosition>): void {
    const originPosition = data.getOriginPosition();
    const line = originPosition.getLineNo();
    const col = originPosition.getColNo();
    const posArr = this.getAllIndices(data.getCode() ?? '', text);
    posArr.forEach((pos) => {
      pos.line += line;
      pos.startCol += col;
      pos.endCol += col;
      set.add(pos);
    });
  }

  /**
   * 处理 ArkMethod 对象，查找指定文本在方法代码中的位置，并将位置信息添加到数组中
   * @param data ArkMethod 对象，包含方法的相关信息
   * @param text 需要在方法代码中查找的文本
   * @param set 用于存储找到的文本位置信息的数组，每个元素是一个包含行号和起始列号的对象
   */
  private processArkMethod(data: ArkMethod, text: string, set: Set<AnyPosition>): void {
    let line = data.getLine() ?? this.getFirstDeclareLine(data);
    const col = data.getColumn() ?? this.getFirstDeclareColumns(data);
    const posArr = this.getAllIndices(data.getCode() ?? '', text);
    posArr.forEach((pos) => {
      pos.line += line;
      pos.startCol = pos.startCol + (pos.line === line ? col : 1);
      pos.endCol = pos.endCol + (pos.line === line ? col : 1);
      set.add(pos);
    });
  }

  /**
   * 处理语句对象，查找指定文本在语句中的位置，并将位置信息添加到数组中
   * @param data 语句对象，包含语句的相关信息
   * @param text 需要在语句中查找的文本
   * @param arr 用于存储找到的文本位置信息的数组，每个元素是一个包含行号和起始列号的对象
   */
  private processStmt(data: Stmt, text: string, set: Set<AnyPosition>): void {
    const originPosition = data.getOriginPositionInfo();
    const line = originPosition.getLineNo();
    const col = originPosition.getColNo();
    let code = data.getOriginalText() ?? '';
    const posArr = this.getAllIndices(code, text);
    posArr.forEach((pos) => {
      pos.line += line;
      pos.startCol = pos.startCol + (pos.line === line ? col : 1);
      pos.endCol = pos.endCol + (pos.line === line ? col : 1);
      set.add(pos);
    });
  }

  /**
   * 获取 ArkMethod 对象中第一个声明的行位置
   * @param data ArkMethod 对象，包含方法声明信息
   * @returns 第一个声明行的数值位置。如果无法获取行信息，返回默认值 0
   */
  private getFirstDeclareLine(data: ArkMethod): number {
    const declareLines = data.getDeclareLines();
    if (declareLines) {
      return declareLines[0];
    }
    logger.debug('declareLines is null');
    return 0;
  }

  /**
   * 获取 ArkMethod 对象中第一个声明的行位置
   * @param data ArkMethod 对象，包含方法声明信息
   * @returns 第一个声明行的数值位置。如果无法获取行信息，返回默认值 0
   */
  private getFirstDeclareColumns(data: ArkMethod): number {
    const declareColumns = data.getDeclareColumns();
    if (declareColumns) {
      return declareColumns[0];
    }
    logger.debug('declareColumns is null');
    return 0;
  }

  /**
   * 获取目标字符在源字符串中所有出现位置的索引
   * @param source 源字符串，用于查找目标字符
   * @param targetChar 目标字符，需要在源字符串中查找的字符
   * @returns 包含所有匹配索引的数组，如果没有匹配则返回空数组
   */
  private getAllIndices(source: string, targetChar: string): Set<AnyPosition> {
    const set: Set<AnyPosition> = new Set();
    const sourceFile = AstTreeUtils.getASTNode('source', source);
  
    const isTargetNode = (node: ts.Node): boolean => {
      return (
        (ts.isLabeledStatement(node) && node.label.getText() === targetChar) ||
        (ts.isVariableDeclaration(node) && node.name.getText() === targetChar) ||
        (ts.isBindingElement(node) && !ts.isArrayBindingPattern(node.parent) && node.name.getText() === targetChar) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText() === targetChar)
      );
    };
  
    const isPartialMatchNode = (node: ts.Node): boolean => {
      return (
        (ts.isLabeledStatement(node) && node.label.getText().includes(targetChar)) ||
        (ts.isVariableDeclaration(node) && node.name.getText().includes(targetChar)) ||
        (ts.isBindingElement(node) && !ts.isArrayBindingPattern(node.parent) && node.name.getText().includes(targetChar)) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText().includes(targetChar))
      );
    };
  
    const addPositionToSet = (node: ts.Node): void => {
      const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      set.add({ line: startLine, startCol: startCol, endCol: endCol });
    };
  
    const visitNode = (node: ts.Node): void => {
      if (isTargetNode(node) || isPartialMatchNode(node)) {
        addPositionToSet(node);
        return;
      }
      ts.forEachChild(node, visitNode);
    };
  
    visitNode(sourceFile);
    return set;
  }

  /**
   * 是否包含赋值运算
   * @param source 源字符串，用于查找目标字符
   * @returns 
   */
  private isHasAssignment(source: string): boolean {
    let isHasAssignment = false;
    const sourceFile = AstTreeUtils.getASTNode('source', source);
    const visitNode = (node: ts.Node): void => {
      if (ts.isLabeledStatement(node) ||
        ts.isVariableDeclaration(node) ||
        ts.isBindingElement(node) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken)) {
        isHasAssignment = true;
        return;
      }
      // 递归遍历子节点
      ts.forEachChild(node, visitNode);
    };
    visitNode(sourceFile);
    return isHasAssignment;
  }

  /**
   * 获取赋值表达式左侧的文本内容
   * @param source 源字符串，用于查找目标字符
   * @returns 左侧内容
   */
  private getLeftTextByAst(source: string): string {
    let leftText = '';
    const sourceFile = AstTreeUtils.getASTNode('source', source);
    const visitNode = (node: ts.Node): void => {
      if (ts.isLabeledStatement(node)) {
        leftText = node.label.getText();
        return;
      }
      if (ts.isVariableDeclaration(node)) {
        leftText = node.name.getText();
        return;
      }
      if (ts.isBindingElement(node)) {
        leftText = node.name.getText();
        return;
      }
      if (ts.isBinaryExpression(node)) {
        leftText = node.left.getText();
        return;
      }
      ts.forEachChild(node, visitNode);
    };
    visitNode(sourceFile);
    return leftText;
  }

  /**
   * 获取表达式左侧是否有类型申明
   * @param source 源字符串，用于查找目标字符
   * @returns 包含所有匹配索引的数组，如果没有匹配则返回空数组
   */
  private isLeftHasDeclarationType(source: string): boolean {
    let isLeftHasDeclarationType = false;
    const sourceFile = AstTreeUtils.getASTNode('source', source);
    const visitNode = (node: ts.Node): void => {
      // 检查变量声明是否有显式类型
      if (ts.isVariableDeclaration(node)) {
        isLeftHasDeclarationType = node.type !== undefined;
      }

      // 检查函数参数是否有显式类型
      if (ts.isParameter(node)) {
        isLeftHasDeclarationType = node.type !== undefined;
      }

      // 检查函数返回值是否有显式类型
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
        isLeftHasDeclarationType = node.type !== undefined;
      }

      // 检查属性声明是否有显式类型
      if (ts.isPropertyDeclaration(node)) {
        isLeftHasDeclarationType = node.type !== undefined;
      }
      ts.forEachChild(node, visitNode);
    };
    visitNode(sourceFile);
    return isLeftHasDeclarationType;
  }

  private isTsFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.ts');
  }
}
