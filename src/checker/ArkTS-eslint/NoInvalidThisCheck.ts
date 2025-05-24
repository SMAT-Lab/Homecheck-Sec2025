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
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { BaseChecker, BaseMetaData } from "../BaseChecker";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoInvalidThisCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/no-invalid-this.md",
  description: "Disallow `this` keywords outside of classes or class-like objects",
};

export class NoInvalidThisCheck implements BaseChecker {
  codeFix?(arkFile: ArkFile, fixKey: string): boolean {
    throw new Error("Method not implemented.");
  }
  issues: IssueReport[] = [];
  public defects: Defects[] = [];
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  private defaultOption = { "capIsConstructor": true }
  private option = this.defaultOption;
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

  public check = (target: ArkFile) => {
    const severity = this.rule.alert ?? this.metaData.severity;
    if (this.rule && this.rule.option && this.rule.option[0]) {
      this.option = this.rule.option[0] as { capIsConstructor: boolean; };
      if (this.option.capIsConstructor === undefined) {
        this.option.capIsConstructor = true;
      }
    }

    const sourceFile: ts.SourceFile = AstTreeUtils.getSourceFileFromArkFile(target);

    const findThisReturnNode = (node: ts.Node) => {

      if (this.nodeContainsThisKeyword(node)) {
        if (!this.isThisValid(node)) {
          const pos = this.getLineAndColumn(node, 'this');
          const message = "Unexpected 'this'.";
          this.addIssueReport(pos, severity, message);
        }
      }

      ts.forEachChild(node, findThisReturnNode);
    }

    ts.forEachChild(sourceFile, findThisReturnNode);
  }

  /**
   * this关键字是否在有效的上下文中
   * @param node 
   * @returns 
   */
  private isThisValid(node: ts.Node): boolean {
    if (this.isNodeInTopLevel(node.parent)) {
      return true;
    }
    if (this.isNodeInClassFieldInitializer(node)) {
      return true;
    }
    if (this.isNodeInClassStaticBlock(node)) {
      return true;
    }
    if (this.isValidFunctionContext(node)) {
      return true;
    }
    if (this.isConstructorFunction(node)) {
      return true;
    }
    if (this.isThisInFunctionWithThisParam(node)) {
      return true;
    }
    if (this.isNodeInObjectMethod(node)) {
      return true;
    }
    if (this.isNodeInTryCatchInTopLevel(node)) {
      return true;
    }
    return false;
  }

  // 在try...catch...,在顶层作用域中
  private isNodeInTryCatchInTopLevel(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    while (current) {
      if ((ts.isTryStatement(current) ||
        ts.isForStatement(current) ||
        ts.isForOfStatement(current) ||
        ts.isForInStatement(current)) &&
        this.isNodeInTopLevel(current)) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  // 在顶层作用域中
  private isNodeInTopLevel(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isBlock(current)) {
        return false;
      }
      current = current.parent;
    }
    return true;
  }

  // 在类字段初始化器中
  private isNodeInClassFieldInitializer(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isPropertyDeclaration(current) && current.initializer === node) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  // 在类静态块中
  private isNodeInClassStaticBlock(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isClassStaticBlockDeclaration(current)) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  // 在类方法中
  private isValidFunctionContext(node: ts.Node): boolean {
    if (!node.parent) {
      return false;
    }

    if (this.checkCallApplyBindContext(node)) {
      return true;
    }
    if (this.checkArrayMethodContext(node)) {
      return true;
    }
    if (this.checkJsDocThisTag(node)) {
      return true;
    }

    return this.isValidFunctionContext(node.parent);
  }

  // 提取 call/apply/bind 逻辑
  private checkCallApplyBindContext(node: ts.Node): boolean {
    if (!ts.isCallExpression(node)) {
      return false;
    }

    const propAccess = node.expression as ts.PropertyAccessExpression;
    if (!['call', 'apply', 'bind'].includes(propAccess?.name?.escapedText?.toString() ?? '')) {
      return false;
    }

    return !this.isNullOrUndefinedArg(node.arguments[0]);
  }

  // 提取数组方法逻辑
  private checkArrayMethodContext(node: ts.Node): boolean {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
      return false;
    }

    const arrayMethods = ['forEach', 'map', 'filter', 'reduce', 'some', 'every', 'from', 'find', 'findIndex'];
    const methodName = node.expression.name.escapedText?.toString();

    if (!arrayMethods.includes(methodName ?? '') || node.arguments.length <= 1) {
      return false;
    }
    if (methodName === 'from' && node.arguments.length < 3) {
      return false;
    }

    return !this.isNullOrUndefinedArg(node.arguments[node.arguments.length - 1]);
  }

  // 提取 JSDoc 检查逻辑
  private checkJsDocThisTag(node: ts.Node): boolean {
    if (!ts.isFunctionDeclaration(node) && !ts.isFunctionExpression(node)) {
      return false;
    }

    // 官方 JSDoc 标签检查
    const hasOfficialTag = ts.getJSDocTags(node).some(tag =>
      tag.tagName?.kind === ts.SyntaxKind.Identifier && tag.tagName.escapedText === 'this'
    );
    if (hasOfficialTag) {
      return true;
    }

    // 非标准注释检查
    return this.checkNonStandardThisTag(node);
  }

  // 通用参数校验方法
  private isNullOrUndefinedArg(arg: ts.Node): boolean {
    return arg?.kind === ts.SyntaxKind.NullKeyword ||
      arg?.kind === ts.SyntaxKind.UndefinedKeyword ||
      arg?.getText() === 'undefined' ||
      arg?.kind === ts.SyntaxKind.VoidKeyword ||
      ts.isVoidExpression(arg);
  }

  // 非标准注释检查方法
  private checkNonStandardThisTag(node: ts.Node): boolean {
    const leadingComments = ts.getLeadingCommentRanges(node.getSourceFile().text, node.pos);
    return leadingComments?.some(comment =>
      node.getSourceFile().text.substring(comment.pos, comment.end).includes('@this')
    ) ?? false;
  }

  /**
   * 判断 ts.Node 是否在对象的方法中
   * @param {ts.Node} node - 要检查的节点
   * @returns {boolean} 如果 node 在对象的方法中，则返回 true；否则返回 false
   */
  private isNodeInObjectMethod(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    let isInMethod = false;
    let isArrowFunction = false;
    while (current) {
      // 检查是否为对象的方法
      if (ts.isMethodDeclaration(current) || ts.isMethodSignature(current)) {
        return true;
      }

      // 检查是否为 getter 或 setter
      if (ts.isGetAccessor(current) || ts.isSetAccessor(current)) {
        return true;
      }

      if (ts.isPropertyAssignment(current) && ts.isArrowFunction(current.initializer)) {
        isInMethod = true;
      }

      if (ts.isPropertyDeclaration(current) && current.initializer && ts.isArrowFunction(current.initializer)) {
        isInMethod = true;
      }

      // 检查是否为函数表达式
      if (ts.isFunctionExpression(current) || ts.isFunctionDeclaration(current)) {
        if (ts.isBlock(current.parent)) {
          return false;
        }
        if (ts.isReturnStatement(current.parent)) {
          if (!this.isNodeType(current.parent, ts.SyntaxKind.ParenthesizedExpression)) {
            return false;
          }
        }
        if (ts.isNewExpression(current.parent)) {
          return false;
        }
        isInMethod = true;
      }

      if (ts.isArrowFunction(current)) {
        if (ts.isBlock(current.parent)) {
          return false;
        }
        if (ts.isReturnStatement(current.parent)) {
          return false;
        }
        isArrowFunction = true;
      }

      // 检查是否为对象的属性赋值或属性声明
      if (ts.isPropertyAssignment(current) || ts.isPropertyDeclaration(current)) {
        if (isArrowFunction || isInMethod) {
          return true;
        }
      }

      // 检查是否为二进制表达式，且左边为对象的属性
      if (ts.isBinaryExpression(current) && ts.isPropertyAccessExpression(current.left)) {
        if (isArrowFunction || isInMethod) {
          return true;
        }
      }

      current = current.parent;
    }
    return false;
  }

  private isNodeType(node: ts.Node, kind: number): boolean {
    if (!node) {
      return false;
    }

    if (node?.kind === kind) {
      return true;
    } else {
      return this.isNodeType(node.parent, kind);
    }
  }

  /**
   * 判断 this 关键字是否在函数中，且函数的参数中有 this 参数
   * @param node 
   * @returns 
   */
  private isThisInFunctionWithThisParam(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isFunctionLike(current)) {
        const parameters = current.parameters;
        for (const param of parameters) {
          if (param.name.getText() === 'this') {
            return true;
          }
        }
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 是否构造函数声明
   * @param node 
   * @returns 
   */
  private isConstructorFunction(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isConstructorDeclaration(current)) {
        return true;
      }
      if (this.option.capIsConstructor && (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current))) {
        const name = (current.name && current.name.text) || '';
        const parent = current.parent;
        if (name && /^[A-Z]/.test(name)) {
          return true;
        }
        if (parent && ts.isVariableDeclaration(parent) && parent.name && /^[A-Z]/.test(parent.name.getText())) {
          return true;
        }
        if (parent && ts.isBinaryExpression(parent) && parent.left && /^[A-Z]/.test(parent.left.getText())) {
          return true;
        }
        if (parent && ts.isParameter(parent) && parent.name && /^[A-Z]/.test(parent.name.getText())) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  }

  private nodeContainsThisKeyword(node: ts.Node | undefined): boolean {
    if (node && node?.kind === ts.SyntaxKind.ThisKeyword) {
      return true;
    }
    return false;
  }

  private addIssueReport(pos: { line: number, startCol: number, filePath: string }, severity: number, message: string) {
    let defects = new Defects(pos.line, pos.startCol, pos.startCol + 4, message, severity, this.rule.ruleId,
      pos.filePath, this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defects, undefined));
    RuleListUtil.push(defects);
  }

  private getLineAndColumn(node: ts.Node, text: string) {
    const sourceFile = node.getSourceFile();

    const nodeText = node.getText();
    const textIndex = nodeText.indexOf(text);
    if (textIndex !== -1) {
      const { line: textLine, character: textCharacter } = sourceFile.getLineAndCharacterOfPosition(node.getStart() + textIndex);
      return {
        line: textLine + 1, // 行号从1开始
        startCol: textCharacter + 1, // 列号从1开始
        filePath: sourceFile.fileName
      };
    }

    return { line: -1, startCol: -1, filePath: '' };
  }
}
