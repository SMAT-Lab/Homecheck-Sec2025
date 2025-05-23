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

import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { RuleFix } from '../../model/Fix';
import { RuleListUtil } from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PreferReadonly');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: 'docs/prefer-readonly.md',
  description: 'Require private members to be marked as `readonly` if they are never modified outside of the constructor'
};
export type Option = {
  onlyInlineLambdas?: boolean;
};
export class PreferReadonlyCheck implements BaseChecker {
  private defaultOption: Option = { onlyInlineLambdas: false };
  private option: Option = this.defaultOption;
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private buildMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildCb: MatcherCallback = {
      matcher: this.buildMatcher,
      callback: this.check
    };
    return [matchBuildCb];
  };
  public check = (arkFile: ArkFile) => {
    if (this.rule?.option?.[0]) {
      const ruleOption = this.rule.option[0] as Option;
      this.option.onlyInlineLambdas = ruleOption.onlyInlineLambdas ?? this.defaultOption.onlyInlineLambdas;
    }
    const astRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
    const processClassNode = (node: ts.ClassDeclaration | ts.ClassExpression) => {
      const classScope = new ClassScope(node);
      this.processClassAst(node, arkFile, classScope);
      this.checkUnmodifiedMembers(classScope, arkFile);
    };
    const processVariableStatement = (statement: ts.VariableStatement) => {
      statement.declarationList.declarations.forEach(declaration => {
        if (declaration.initializer && ts.isClassExpression(declaration.initializer)) {
          processClassNode(declaration.initializer);
        }
      });
    };
    const processFunctionDeclaration = (declaration: ts.FunctionDeclaration) => {
      this.visitFunctionDeclaration(declaration, arkFile);
    };
    astRoot.statements.forEach(child => {
      if (ts.isClassDeclaration(child) || ts.isClassExpression(child)) {
        processClassNode(child);
      } else if (ts.isVariableStatement(child)) {
        processVariableStatement(child);
      } else if (ts.isFunctionDeclaration(child)) {
        processFunctionDeclaration(child);
      }
    });
  };
  private visitFunctionDeclaration(node: ts.FunctionDeclaration, arkFile: ArkFile): void {
    if (node.body) {
      for (let statement of node.body.statements) {
        this.visitStatement(statement, arkFile);
      };
    };
  };
  private processClassAst(node: ts.ClassDeclaration | ts.ClassExpression, arkFile: ArkFile, classScope: ClassScope): void {
    // 循环遍历class的成员
    for (let member of node.members) {
      if (ts.isPropertyDeclaration(member)) {
        this.processPropertyDeclaration(member, classScope, arkFile);
      } else if (ts.isConstructorDeclaration(member)) {
        this.processConstructorDeclaration(member, classScope);
      } else if (ts.isMethodDeclaration(member)) {
        this.visitMethodDeclaration(member, classScope, arkFile);
      } else if (ts.isClassExpression(member)) {
        // 为嵌套类创建新的作用域
        let nestedClassScope = new ClassScope(member);
        this.processClassAst(member, arkFile, nestedClassScope);
        // 立即检查嵌套类的未修改成员
        this.checkUnmodifiedMembers(nestedClassScope, arkFile);
      } else if (ts.isSetAccessor(member)) {
        // 处理 setter 中的修改
        this.visitSetAccessor(member, classScope);
      };
    };
  };
  private checkUnmodifiedMembers(classScope: ClassScope, arkFile: ArkFile): void {
    classScope.finalizeUnmodifiedPrivateNonReadonlys().forEach(violatingNode => {
      try {
        this.processViolatingNode(violatingNode, arkFile);
      } catch (error) {
        logger.error(`Error processing violating node: ${error}`);
      }
    });
  };
  private processViolatingNode(violatingNode: ts.Node, arkFile: ArkFile): void {
    const { esNode, nameNode } = this.getEsNodesFromViolatingNode(violatingNode, arkFile);
    const isConstructorParam = this.isConstructorParameter(violatingNode);
    const { memberName, typeInfo } = this.getMemberInfo(violatingNode, nameNode, isConstructorParam);
    const errorMessager = `Member '${memberName}${typeInfo}' is never reassigned; mark it as \`readonly\`.`;
    const defect = isConstructorParam
      ? this.createDefect(nameNode, memberName, errorMessager)
      : this.createDefect(esNode, memberName, errorMessager);
    const fixValue = this.generateFixCode(esNode, nameNode.getText());
    const ruleFix = this.createFix(nameNode, fixValue);
    this.issues.push(new IssueReport(defect, ruleFix));
  };
  /**判断节点是否是构造函数参数*/
  private isConstructorParameter(node: ts.Node): boolean {
    return ts.isParameter(node) && ts.isConstructorDeclaration(node.parent);
  };
  /** 获取成员名称和类型信息*/
  private getMemberInfo(node: ts.Node, nameNode: ts.Node, isConstructorParam: boolean): { memberName: string; typeInfo: string } {
    let typeInfo = '';
    let optionalMark = '';
    // 获取类型信息和可选标记
    if (ts.isPropertyDeclaration(node)) {
      if (node.questionToken) {
        optionalMark = '?';
      };
    } else if (ts.isParameterPropertyDeclaration(node, node.parent)) {
      if (node.type && isConstructorParam) {
        typeInfo = ': ' + node.type.getText();
      };
      if (node.questionToken) {
        optionalMark = '?';
      };
    };
    // 处理成员名称
    let memberName = nameNode.getText();
    if (ts.isArrayBindingPattern(nameNode)) {
      memberName = `[${nameNode.elements.map(el => el.getText()).join(', ')}]`;
    };
    // 添加可选标记
    memberName = memberName + optionalMark;
    return { memberName, typeInfo };
  };
  private generateFixCode(esNode: ts.Node, code: string): string {
    let fixKeyword = '';
    if (ts.isPropertyDeclaration(esNode) || esNode.getText().startsWith('private ')) {
      // 普通属性声明情况
      fixKeyword = 'readonly ' + code;
    } else if (ts.isParameter(esNode)) {
      // 参数属性情况
      const modifiers = esNode.modifiers || [];
      let hasPrivate = false;
      let hasReadonly = false;
      for (const mod of modifiers) {
        if (mod.kind === ts.SyntaxKind.PrivateKeyword) {
          hasPrivate = true;
        } else if (mod.kind === ts.SyntaxKind.ReadonlyKeyword) {
          hasReadonly = true;
        };
      };
      if (hasPrivate && !hasReadonly) {
        // 替换第一个 private 关键字为 private readonly
        fixKeyword = esNode.getText().replace(/private\s+/, 'private readonly ');
      };
    };
    return fixKeyword;
  };
  /*** 处理class 中嵌套Method的语句*/
  private visitMethodDeclaration(node: ts.MethodDeclaration, classScope: ClassScope, arkFile: ArkFile): void {
    if (node.body) {
      for (let statement of node.body.statements) {
        if (ts.isReturnStatement(statement)) {
          if (statement.expression && ts.isClassExpression(statement.expression)) {
            // 为返回语句中的类创建新的作用域
            let nestedClassScope = new ClassScope(statement.expression);
            this.processClassAst(statement.expression, arkFile, nestedClassScope);
            // 立即检查嵌套类的未修改成员
            this.checkUnmodifiedMembers(nestedClassScope, arkFile);
          };
        } else if (ts.isClassExpression(statement)) {
          // 为嵌套类创建新的作用域
          let nestedClassScope = new ClassScope(statement);
          this.processClassAst(statement, arkFile, nestedClassScope);
          // 立即检查嵌套类的未修改成员
          this.checkUnmodifiedMembers(nestedClassScope, arkFile);
        } else if (ts.isExpressionStatement(statement)) {
          this.processMethodBody(statement, classScope);
        };
      };
    };
  };
  private processMethodBody(statement: ts.ExpressionStatement, classScope: ClassScope): void {
    this.checkCallbackDepth(statement, classScope);
  };
  private checkCallbackDepth(methodAst: ts.Node, classScope: ClassScope) {
    this.checkNode(methodAst, classScope);
  };
  private isInConstructorScope = (node: ts.Node): boolean => {
    let current = node;
    while (current) {
      if (ts.isConstructorDeclaration(current)) {
        return true;
      };
      // 检查是否在构造函数中的函数表达式、箭头函数或访问器中
      if (ts.isFunctionExpression(current) || ts.isArrowFunction(current) ||
        ts.isGetAccessor(current) || ts.isSetAccessor(current)) {
        const parent = this.findConstructorParent(current);
        return !!parent;
      };
      current = current.parent;
    };
    return false;
  };
  /**检查节点是否在 setter 上下文中*/
  private isInSetterContext = (node: ts.Node): boolean => {
    let current = node;
    while (current) {
      if (ts.isSetAccessor(current)) {
        return true;
      };
      current = current.parent;
    };
    return false;
  };
  private checkNode = (node: ts.Node, classScope: ClassScope): void => {
    // 处理 setter 中的赋值
    this.handleSetterAssignment(node, classScope);
    // 处理一元运算符
    if (this.isNonModifyingUnaryExpression(node)) {
      return;
    };
    // 处理赋值表达式
    if (ts.isBinaryExpression(node) && this.isAssignmentExpression(node)) {
      this.handleAssignmentExpression(node, classScope);
      return;
    };
    // 处理删除操作
    this.handleDeleteExpression(node, classScope);
    // 处理前置或后置递增/递减操作
    this.handleUnaryIncrementExpression(node, classScope);

    // 递归处理子节点
    ts.forEachChild(node, (childNode) => this.checkNode(childNode, classScope));
  };
  /**
   * 处理 setter 中的赋值表达式
   */
  private handleSetterAssignment(node: ts.Node, classScope: ClassScope): void {
    if (this.isInSetterContext(node) && ts.isBinaryExpression(node) && this.isAssignmentExpression(node)) {
      if (ts.isPropertyAccessExpression(node.left) &&
        node.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
        classScope.addMutateModification(node.left);
      };
    };
  };
  /** 检查是否是非修改性的一元表达式*/
  private isNonModifyingUnaryExpression(node: ts.Node): boolean {
    if (ts.isPrefixUnaryExpression(node)) {
      const operand = node.operand;
      // 一元运算符不会修改值，所以不需要标记为修改
      if (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) {
        return true;
      };
    };
    return false;
  };
  /**
   * 处理赋值表达式
   */
  private handleAssignmentExpression(node: ts.BinaryExpression, classScope: ClassScope): void {
    // 处理数组解构赋值
    if (ts.isArrayLiteralExpression(node.left)) {
      this.processArrayDestructuring(node.left, classScope, this.isInConstructorScope(node));
      return;
    };
    if (ts.isPropertyAccessExpression(node.left)) {
      this.handlePropertyAccessAssignment(node.left, classScope);
    }
    // 处理对象解构赋值
    else if (ts.isObjectLiteralExpression(node.left)) {
      this.processObjectLiteralProperties(node.left.properties, classScope, this.isInConstructorScope(node));
    };
  };
  /**
   * 处理属性访问赋值
   */
  private handlePropertyAccessAssignment(leftExpr: ts.PropertyAccessExpression, classScope: ClassScope): void {
    // 检查是否是对象属性的修改
    if (this.isObjectPropertyAccess(leftExpr)) {
      return;
    };
    // 检查是否是静态成员访问
    if (this.isStaticMemberAccess(leftExpr)) {
      classScope.addMutateModification(leftExpr);
      return;
    };
    // 检查是否是当前类的属性访问
    if (this.isInConstructorScope(leftExpr)) {
      classScope.addConstructorModification(leftExpr);
    } else {
      // 在 setter 中的修改也应该被标记为修改
      classScope.addMutateModification(leftExpr);
    };
  };
  /**
   * 处理删除表达式
   */
  private handleDeleteExpression(node: ts.Node, classScope: ClassScope): void {
    if (ts.isDeleteExpression(node)) {
      const deleteExpression = node.expression;
      if (ts.isPropertyAccessExpression(deleteExpression)) {
        classScope.addMutateModification(deleteExpression);
      };
    };
  };
  /**
   * 处理前置或后置递增/递减操作
   */
  private handleUnaryIncrementExpression(node: ts.Node, classScope: ClassScope): void {
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      if ('operand' in node && ts.isPropertyAccessExpression(node.operand)) {
        if (this.isInConstructorScope(node)) {
          classScope.addConstructorModification(node.operand);
        } else {
          classScope.addMutateModification(node.operand);
        };
      };
    };
  };
  private processObjectLiteralProperties(properties: ts.NodeArray<ts.ObjectLiteralElementLike>, classScope: ClassScope, isInConstructor: boolean): void {
    properties.forEach(property => {
      if (ts.isSpreadAssignment(property)) {
        this.handleSpreadAssignment(property, classScope, isInConstructor);
      } else if (ts.isPropertyAssignment(property)) {
        this.handlePropertyAssignment(property, classScope, isInConstructor);
      };
    });
  };
  private handleSpreadAssignment(property: ts.SpreadAssignment, classScope: ClassScope, isInConstructor: boolean): void {
    const spreadExpression = property.expression;
    if (ts.isPropertyAccessExpression(spreadExpression)) {
      if (isInConstructor) {
        classScope.addConstructorModification(spreadExpression);
      } else {
        classScope.addMutateModification(spreadExpression);
      };
    };
  };
  private handlePropertyAssignment(property: ts.PropertyAssignment, classScope: ClassScope, isInConstructor: boolean): void {
    const initializer = property.initializer;
    if (ts.isPropertyAccessExpression(initializer)) {
      if (isInConstructor) {
        classScope.addConstructorModification(initializer);
      } else {
        classScope.addMutateModification(initializer);
      };
    };
  };
  private processArrayDestructuring(arrayLiteral: ts.ArrayLiteralExpression, classScope: ClassScope, isInConstructor: boolean): void {
    arrayLiteral.elements.forEach(element => {
      if (ts.isSpreadElement(element)) {
        // 处理展开运算符 [...this.value]
        const spreadExpression = element.expression;
        if (ts.isPropertyAccessExpression(spreadExpression)) {
          if (isInConstructor) {
            classScope.addConstructorModification(spreadExpression);
          } else {
            classScope.addMutateModification(spreadExpression);
          };
        };
      } else if (ts.isPropertyAccessExpression(element)) {
        // 处理普通数组解构 [this.value]
        if (isInConstructor) {
          classScope.addConstructorModification(element);
        } else {
          classScope.addMutateModification(element);
        };
      };
    });
  };
  private isObjectPropertyAccess(node: ts.PropertyAccessExpression): boolean {
    return node.expression.kind !== ts.SyntaxKind.ThisKeyword && ts.isPropertyAccessExpression(node.expression);
  };
  private findConstructorParent(node: ts.Node): ts.Node | undefined {
    let current = node;
    while (current) {
      if (ts.isConstructorDeclaration(current)) {
        return current;
      };
      current = current.parent;
    };
    return undefined;
  };
  private visitStatement(statement: ts.Statement, arkFile: ArkFile): void {
    if (ts.isReturnStatement(statement)) {
      if (statement.expression && ts.isClassExpression(statement.expression)) {
        let nestedClassScope = new ClassScope(statement.expression);
        this.processClassAst(statement.expression, arkFile, nestedClassScope);
        this.checkUnmodifiedMembers(nestedClassScope, arkFile);
      };
    } else if (ts.isClassExpression(statement)) {
      let nestedClassScope = new ClassScope(statement);
      this.processClassAst(statement, arkFile, nestedClassScope);
      this.checkUnmodifiedMembers(nestedClassScope, arkFile);
    };
  };
  private getEsNodesFromViolatingNode(violatingNode: ts.Node, arkFile: ArkFile): { esNode: ts.Node; nameNode: ts.Node } {
    if (ts.isPropertyDeclaration(violatingNode)) {
      return {
        esNode: violatingNode,
        nameNode: violatingNode.name
      };
    } else if (ts.isParameterPropertyDeclaration(violatingNode, violatingNode.parent)) {
      return {
        esNode: violatingNode,
        nameNode: violatingNode.name
      };
    } else if (ts.isVariableDeclaration(violatingNode)) {
      return {
        esNode: violatingNode,
        nameNode: violatingNode.name
      };
    } else {
      // 如果不是上述类型，可以抛出错误或处理其他情况
      throw new Error('Unexpected node type in getEsNodesFromViolatingNode');
    };
  };
  private processPropertyDeclaration(node: ts.PropertyDeclaration, classScope: ClassScope, arkFile: ArkFile): void {
    // 检查是否是私有成员（包括 private 修饰符和私有标识符 #）
    const isPrivate = ts.isPrivateIdentifier(node.name) || this.checkModifiers(node, 'private');
    //const isStatic = this.checkModifiers(node, 'static');
    // 如果既不是私有成员也不是静态私有成员，则返回
    if (!isPrivate) {
      return;
    };
    //配置options
    const initializer = node.initializer;
    if (initializer) {
      if (this.option.onlyInlineLambdas && !ts.isArrowFunction(initializer)) {
        return;
      };
    };
    //如果private 让 Readonly修饰了直接抛弃掉
    if (this.checkModifiers(node, 'Readonly')) {
      return;
    };
    // 如果字段带有 accessor 修饰符，则跳过处理
    if (this.checkModifiers(node, 'accessor')) {
      return;
    };
    classScope.addDeclaredVariable(node);
  };
  private processConstructorDeclaration(node: ts.ConstructorDeclaration | ts.ExpressionStatement, classScope: ClassScope): void {
    if (ts.isConstructorDeclaration(node)) {
      //循环遍历构造成员，检查里面是不是有 private 或者#
      for (let parameter of node.parameters) {
        // 检查是否是参数属性声明（带有访问修饰符的参数）
        if (ts.isParameterPropertyDeclaration(parameter, parameter.parent)) {
          const initializer = parameter.initializer;
          if (this.option.onlyInlineLambdas && initializer && !ts.isArrowFunction(initializer)) {
            continue;
          };
          // 检查参数是否有 private 修饰符
          if (this.checkModifiers(parameter, 'private')) {
            // 添加到声明变量中，无论是否为数组绑定模式
            classScope.addDeclaredVariable(parameter);
          };
        };
      };
      //循环遍历构造成员，检查里面是不是有 this.#xxx = xxx;
      if (node.body) {
        this.processConstructorStatements(node.body.statements, classScope);
      };
    };
  };
  private processConstructorStatements(statements: ts.NodeArray<ts.Statement>, classScope: ClassScope): void {
    for (const statement of statements) {
      // 处理函数表达式和箭头函数
      if (ts.isExpressionStatement(statement)) {
        const expr = statement.expression;
        if (ts.isCallExpression(expr) &&
          (ts.isFunctionExpression(expr.expression) || ts.isArrowFunction(expr.expression))) {
          this.processConstructorBody(expr.expression.body, classScope);
        };
      }
      // 处理对象字面量中的访问器和方法
      else if (ts.isVariableStatement(statement)) {
        const declarations = statement.declarationList.declarations;
        for (const decl of declarations) {
          if (decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
            for (const prop of decl.initializer.properties) {
              if (ts.isGetAccessorDeclaration(prop) || ts.isSetAccessorDeclaration(prop) ||
                ts.isMethodDeclaration(prop)) {
                this.processConstructorBody(prop.body!, classScope);
              };
            };
          };
        };
      };
      // 处理其他语句
      this.processConstructorBody(statement, classScope);
    };
  };
  private processConstructorBody(node: ts.Node, classScope: ClassScope): void {
    this.checkCallbackDepth(node, classScope);
  };
  /**判断是不是有修改语句符号 */
  private isAssignmentExpression(node: ts.Node): boolean {
    return (
      ts.isBinaryExpression(node) && ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.SlashEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.PercentEqualsToken)
    );
  };
  private checkModifiers(node: ts.Node, flag: string): boolean {
    const nodeModifiers = ts.canHaveModifiers(node)
      ? ts.getModifiers(node)
      : undefined;
    const modifierKinds = new Set(
      nodeModifiers?.map((modifier) => modifier.kind)
    );
    if (flag === 'private' && modifierKinds.has(ts.SyntaxKind.PrivateKeyword)) {
      return true;
    };
    if (flag === 'Readonly' && modifierKinds.has(ts.SyntaxKind.ReadonlyKeyword)) {
      return true;
    };
    if (flag === 'accessor' && modifierKinds.has(ts.SyntaxKind.AccessorKeyword)) {
      return true;
    };
    return false;
  };
  private isStaticMemberAccess(node: ts.PropertyAccessExpression): boolean {
    const expr = node.expression;
    if (!ts.isIdentifier(expr)) {
      return false;
    };
    // 获取标识符的声明
    const symbol = expr.getSourceFile().locals?.get(ts.escapeLeadingUnderscores(expr.text));
    if (!symbol) {
      return false;
    };
    // 检查是否是类声明
    const declarations = symbol.declarations;
    if (!declarations || declarations.length === 0) {
      return false;
    };
    // 检查是否是类名访问
    const isClass = declarations.some(decl => ts.isClassDeclaration(decl) || ts.isClassExpression(decl));
    if (!isClass) {
      return false;
    };
    // 检查访问的属性是否是静态成员
    const propertyName = node.name.text;
    for (const decl of declarations) {
      if (ts.isClassLike(decl)) {
        for (const member of decl.members) {
          if (ts.isPropertyDeclaration(member) &&
            member.name &&
            (ts.isIdentifier(member.name) && member.name.text === propertyName ||
              ts.isPrivateIdentifier(member.name) && member.name.text === propertyName) &&
            this.checkModifiers(member, 'static')) {
            return true;
          };
        };
      };
    };
    return false;
  };
  private createDefect(node: ts.Node, keyword: string, errMesaging: string): Defects {
    const warnInfo = this.getLineAndColumn(node);
    const filePath = warnInfo.filePath;
    let lineNum = warnInfo.line;
    let startColum = warnInfo.startCol;
    let endColumn = warnInfo.endCol;
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(lineNum, startColum, endColumn, errMesaging, severity,
      this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
    this.defects.push(defect);
    RuleListUtil.push(defect);
    return defect;
  };
  private createFix(child: ts.Node, code: string): RuleFix {
    return { range: [child.getStart(), child.getEnd()], text: code };
  };
  private getLineAndColumn(node: ts.Node): { line: number; startCol: number; endCol: number; filePath: string } {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const endCharacter = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).character;
    return {
      line: line + 1,
      startCol: character + 1,
      endCol: endCharacter + 1,
      filePath: sourceFile.fileName
    };
  };
  /** 处理 setter 中的修改情况*/
  private visitSetAccessor(node: ts.SetAccessorDeclaration, classScope: ClassScope): void {
    if (node.body) {
      // 遍历 setter 中的语句，检查是否有对类成员的修改
      for (const statement of node.body.statements) {
        this.checkNode(statement, classScope);
      };
    };
  };
};
class ClassScope {
  private readonly privateModifiableMembers = new Map<string, ts.Node>(); // 私有可修改成员
  private readonly constructorModifications = new Set<string>(); // 构造函数中的修改
  private readonly mutateModifications = new Set<string>(); // mutate 方法中的修改
  private readonly memberInitialValues = new Map<string, string>(); // 存储成员初始值
  constructor(private classDeclaration: ts.ClassDeclaration | ts.ClassExpression) { }
  public addDeclaredVariable(node: ts.Node): void {
    // 处理普通的属性声明
    if (ts.isPropertyDeclaration(node)) {
      const { name, modifiers, initializer } = node;
      if (!name || !(ts.isIdentifier(name) || ts.isPrivateIdentifier(name))) {
        return;
      }
      const hasReadonly = modifiers?.some(mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword);
      if (hasReadonly) {
        return;
      };
      const memberName = name.text;
      this.privateModifiableMembers.set(node.getText(), node);
      if (initializer) {
        this.memberInitialValues.set(memberName, initializer.getText());
      };
      return;
    };
    // 处理构造函数参数属性
    if (ts.isParameter(node) && ts.isConstructorDeclaration(node.parent)) {
      const { modifiers, name, initializer } = node;
      const isPrivate = modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword);
      const hasReadonly = modifiers?.some(mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword);
      if (!isPrivate || hasReadonly) {
        return;
      };
      if (ts.isIdentifier(name)) {
        const memberName = name.text;
        this.privateModifiableMembers.set(node.getText(), node);
        if (initializer) {
          this.memberInitialValues.set(memberName, initializer.getText());
        };
      } else if (ts.isArrayBindingPattern(name)) {
        this.privateModifiableMembers.set(node.getText(), node);
      };
    };
  };
  public addConstructorModification(node: ts.PropertyAccessExpression): void {
    if (node.name && (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name))) {
      const memberName = node.name.text;
      // 检查是否在方法声明、对象字面量方法或函数表达式内部
      let current: ts.Node = node;
      while (current.parent) {
        if (ts.isMethodDeclaration(current.parent) ||
          ts.isFunctionExpression(current.parent) ||
          ts.isArrowFunction(current.parent) ||
          ts.isMethodDeclaration(current.parent) ||
          ts.isObjectLiteralExpression(current.parent)) {
          // 如果在这些位置内部，将其视为构造函数外的修改
          this.mutateModifications.add(memberName);
          return;
        };
        current = current.parent;
      };
      // 获取赋值表达式的右侧值
      let parent = node.parent;
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const newValue = parent.right.getText();
        const initialValue = this.memberInitialValues.get(memberName);
        // 即使值相同，也不认为是真正的修改，这样可以上报建议使用 readonly
        if (initialValue === undefined || (initialValue !== undefined && newValue === initialValue)) {
          // 不添加到 constructorModifications，这样就会被认为是未修改的
          return;
        };
        this.constructorModifications.add(memberName);
      } else {
        // 如果不是简单的赋值，保守起见认为是修改
        this.constructorModifications.add(memberName);
      };
    };
  };
  public addMutateModification(node: ts.PropertyAccessExpression): void {
    if (node.name && (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name))) {
      const memberName = node.name.text;
      // 检查表达式是否是this关键字访问
      const isThisAccess = ts.isPropertyAccessExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ThisKeyword;
      // 如果是通过this访问的属性，则标记为修改
      if (isThisAccess) {
        this.mutateModifications.add(memberName);
        return;
      };
      // 检查是否是修改其他类实例的属性
      const expression = node.expression;
      if (ts.isIdentifier(expression)) {
        // 查找最近的方法声明
        let current: ts.Node | undefined = node;
        while (current) {
          if (ts.isMethodDeclaration(current)) {
            // 检查是否是参数
            const isParameter = current.parameters.some(param =>
              ts.isIdentifier(param.name) && param.name.text === expression.text &&
              param.type && ts.isTypeReferenceNode(param.type) &&
              ts.isIdentifier(param.type.typeName) &&
              param.type.typeName.text !== this.classDeclaration.name?.text
            );
            if (isParameter) {
              return; // 如果是其他类型的参数，不记录这个修改
            };
          };
          current = current.parent;
        };
      };
      this.mutateModifications.add(memberName);
    };
  };
  public isStaticMember(node: ts.Node): boolean {
    const nodeModifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const modifierKinds = new Set(nodeModifiers?.map((modifier) => modifier.kind));
    return modifierKinds.has(ts.SyntaxKind.StaticKeyword);
  };
  public finalizeUnmodifiedPrivateNonReadonlys(): ts.Node[] {
    // 创建一个结果集合，用于存储未修改的成员
    const result: ts.Node[] = [];
    // 遍历所有私有可修改成员
    this.privateModifiableMembers.forEach((node) => {
      if (this.shouldIncludeNode(node)) {
        result.push(node);
      };
    });
    return result;
  };

  private shouldIncludeNode(node: ts.Node): boolean {
    let shouldInclude = true;
    if (ts.isPropertyDeclaration(node) && (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name))) {
      const memberName = node.name.text;
      shouldInclude = !this.isMemberModified(memberName);
    } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const memberName = node.name.text;
      shouldInclude = !this.isMemberModified(memberName);
    } else if (ts.isParameter(node) && ts.isArrayBindingPattern(node.name)) {
      shouldInclude = this.checkArrayBindingPattern(node.name);
    };
    return shouldInclude;
  };
  private isMemberModified(memberName: string): boolean {
    return this.constructorModifications.has(memberName) || this.mutateModifications.has(memberName);
  };
  private checkArrayBindingPattern(name: ts.ArrayBindingPattern): boolean {
    for (const element of name.elements) {
      if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
        const elementName = element.name.text;
        if (this.isMemberModified(elementName)) {
          return false;
        };
      };
    };
    return true;
  };
};