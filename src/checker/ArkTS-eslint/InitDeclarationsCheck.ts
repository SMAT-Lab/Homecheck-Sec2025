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

import { ArkFile, ts, AstTreeUtils } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'InitDeclarationsCheck');
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: "docs/init-declarations.md",
  description: "equire or disallow initialization in variable declarations.",
};

// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
  fileName: string;
  line: number;
  character: number;
  description: string;
}

interface RuleOptions {
  ignoreForLoopInit?: boolean;
}

export class InitDeclarationsCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private defaultOptions = ['always'];
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

  public check = (arkFile: ArkFile) => {
    if (arkFile instanceof ArkFile) {
      const code = arkFile.getCode();
      if (!code) {
        return;
      }
      const filePath = arkFile.getFilePath();
      const asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);

      // 检查变量声明时进行初始化
      const LocationInfos = this.checkInitDeclarations(asRoot);

      // 输出结果
      LocationInfos.forEach(loc => {
        this.addIssueReportNode(loc, filePath);
      });
    }
  }

  private checkInitDeclarations(sourceFile: ts.SourceFile): LocationInfo[] {
    const option = this.rule && this.rule.option[0] ? this.rule.option : this.defaultOptions;
    const ruleConfig = option[0] ? option[0] : 'always';
    const params: RuleOptions = (this.rule && this.rule.option[1]) ? this.rule.option[1] as RuleOptions : {};
    const ignoreForLoopInit = params.ignoreForLoopInit;
    const locationInfos: LocationInfo[] = [];
    // 跟踪是否在已声明的命名空间内
    let insideDeclaredNamespace = false;
    const visit = (node: ts.Node) => {

      if (ruleConfig === 'always') {
        if (this.specialTreatment(node)) {
          return;
        }
        this.checkAlwaysExpression(node, sourceFile, locationInfos);
      } else if (ruleConfig === 'never') {
        this.checkNeverExpressionModule(node, sourceFile, locationInfos, insideDeclaredNamespace, ignoreForLoopInit);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return locationInfos;
  }

  private specialTreatment(node: ts.Node): boolean {
    // 检测是否是 declare namespace
    if (ts.isModuleDeclaration(node)) {
      const { name, flags } = node;
      if (name && ts.isIdentifier(name) && (flags & ts.NodeFlags.Namespace) && this.isDeclare(node)) {
        return true; // 如果是 declare namespace，则跳过
      }
      if (name && name.text === 'global' && this.isDeclare(node)) {
        return true; // 如果是 declare global，则跳过
      }
    }
    // 使用类型守卫确保 node 是 VariableDeclarationList 类型
    if (ts.isVariableDeclarationList(node)) {
      // 检查父节点是否为声明文件或 declare 声明
      const parentNode = node.parent as ts.Node;
      if (this.isDeclare(parentNode)) {
        return true; // 如果是 declare 声明，则跳过
      }
    }

    return false;
  }

  private checkAlwaysExpression(node: ts.Node, sourceFile: ts.SourceFile, locationInfos: LocationInfo[]): void {
    if (!ts.isVariableDeclarationList(node)) {
      return;
    }
    node.declarations.forEach((declarator) => {
      if (ts.isForInStatement(declarator.parent?.parent) || ts.isForOfStatement(declarator.parent?.parent) ||
        ts.isForStatement(declarator.parent?.parent)) {
        return;
      }
      if (!declarator.initializer) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(declarator.getStart());
        locationInfos.push({
          fileName: sourceFile.fileName,
          line: line + 1,
          character: character + 1,
          description: `Variable '${declarator.name.getText()}' should be initialized on declaration.`
        });
      }

    });
  }


  private checkNeverExpressionModule(node: ts.Node, sourceFile: ts.SourceFile, locationInfos: LocationInfo[],
    insideDeclaredNamespace: boolean, ignoreForLoopInit?: boolean): void {
    // 检查是否是命名空间声明
    if (ts.isModuleDeclaration(node)) {
      const moduleDecl = node as ts.ModuleDeclaration;
      if (moduleDecl.flags & ts.NodeFlags.Namespace) {
        insideDeclaredNamespace = true;
      }
    }
    this.checkNeverExpression(node, sourceFile, locationInfos, insideDeclaredNamespace, ignoreForLoopInit);
    // 退出命名空间
    if (ts.isModuleDeclaration(node)) {
      const moduleDecl = node as ts.ModuleDeclaration;
      if (moduleDecl.flags & ts.NodeFlags.Namespace) {
        insideDeclaredNamespace = false;
      }
    }
  }
  private checkNeverExpression(node: ts.Node, sourceFile: ts.SourceFile, locationInfos: LocationInfo[],
    insideDeclaredNamespace: boolean, ignoreForLoopInit?: boolean): void {

    if (this.isForLoop(node) && !insideDeclaredNamespace) {
      this.checkIsForLoop(node, sourceFile, locationInfos, ignoreForLoopInit);
    }

    // 检查变量声明
    if (node.kind === ts.SyntaxKind.VariableStatement && !insideDeclaredNamespace) {
      const varStatement = node as ts.VariableStatement;
      const declarations = varStatement.declarationList.declarations;
      const isConst = (varStatement.declarationList.flags & ts.NodeFlags.Const) !== 0;

      // 检查是否在for循环中
      const isInForLoop = varStatement.parent && this.isForLoop(varStatement.parent);
      if (isInForLoop && ignoreForLoopInit) {
        return;
      }

      for (const declaration of declarations) {
        const id = declaration.name;
        const initialized = Boolean(declaration.initializer);
        let description = '';
        if (!isConst && initialized) {
          description = `Variable '${id.getText()}' should not be initialized on declaration.`;
        }

        if (id.kind === ts.SyntaxKind.Identifier && description) {
          const position = id.getSourceFile().getLineAndCharacterOfPosition(id.getStart());
          locationInfos.push({
            fileName: sourceFile.fileName,
            line: position.line + 1,
            character: position.character + 1,
            description
          });
        }
      }
    }
  }
  /**
   * 检查节点是否为循环语句
   * @param node 要检查的节点
   * @returns 是否为循环语句
   */
  private isForLoop(node: ts.Node): boolean {
    return (
      node.kind === ts.SyntaxKind.ForInStatement ||
      node.kind === ts.SyntaxKind.ForOfStatement ||
      node.kind === ts.SyntaxKind.ForStatement
    );
  }
  private checkIsForLoop(node: ts.Node, sourceFile: ts.SourceFile,
    locationInfos: LocationInfo[], ignoreForLoopInit?: boolean): void {
    if (node.kind === ts.SyntaxKind.ForStatement) {
      this.checkIsForStatement(node, sourceFile, locationInfos, ignoreForLoopInit);
    }
    // 处理 ForInStatement 和 ForOfStatement
    if (node.kind === ts.SyntaxKind.ForInStatement || node.kind === ts.SyntaxKind.ForOfStatement) {
      this.checkIsForOfInStatement(node, sourceFile, locationInfos, ignoreForLoopInit);
    }
  }

  private checkIsForOfInStatement(node: ts.Node, sourceFile: ts.SourceFile,
    locationInfos: LocationInfo[], ignoreForLoopInit?: boolean): void {
    let initializer: ts.VariableDeclarationList | undefined;

    if (node.kind === ts.SyntaxKind.ForInStatement) {
      const forInStatement = node as ts.ForInStatement;
      if (forInStatement.initializer &&
        forInStatement.initializer.kind === ts.SyntaxKind.VariableDeclarationList) {
        initializer = forInStatement.initializer as ts.VariableDeclarationList;
      }
    } else {
      const forOfStatement = node as ts.ForOfStatement;
      if (forOfStatement.initializer &&
        forOfStatement.initializer.kind === ts.SyntaxKind.VariableDeclarationList) {
        initializer = forOfStatement.initializer as ts.VariableDeclarationList;
      }
    }

    if (initializer) {
      const declarations = initializer.declarations;
      const isConst = (initializer.flags & ts.NodeFlags.Const) !== 0;

      for (const declaration of declarations) {
        const id = declaration.name;
        let description = '';
        if (!isConst && !ignoreForLoopInit) {
          description = `Variable '${id.getText()}' should not be initialized on declaration.`;
        }

        if (id.kind === ts.SyntaxKind.Identifier && description) {
          const position = id.getSourceFile().getLineAndCharacterOfPosition(id.getStart());
          locationInfos.push({
            fileName: sourceFile.fileName,
            line: position.line + 1,
            character: position.character + 1,
            description
          });
        }
      }
    }
  }

  private checkIsForStatement(node: ts.Node, sourceFile: ts.SourceFile,
    locationInfos: LocationInfo[], ignoreForLoopInit?: boolean): void {
    const forStatement = node as ts.ForStatement;
    if (forStatement.initializer &&
      forStatement.initializer.kind === ts.SyntaxKind.VariableDeclarationList) {
      const declarationList = forStatement.initializer as ts.VariableDeclarationList;
      const declarations = declarationList.declarations;
      const isConst = (declarationList.flags & ts.NodeFlags.Const) !== 0;

      for (const declaration of declarations) {
        const id = declaration.name;
        const initialized = Boolean(declaration.initializer);
        let description = '';
        if (!isConst && initialized && !ignoreForLoopInit) {
          description = `Variable '${id.getText()}' should not be initialized on declaration.`;
        }

        if (id.kind === ts.SyntaxKind.Identifier && description) {
          const position = id.getSourceFile().getLineAndCharacterOfPosition(id.getStart());
          locationInfos.push({
            fileName: sourceFile.fileName,
            line: position.line + 1,
            character: position.character + 1,
            description
          });
        }
      }
    }
  }

  private hasModifiers(node: ts.Node): node is ts.HasModifiers {
    return 'modifiers' in node;
  }

  private isDeclare(node: ts.Node): boolean {
    if (this.hasModifiers(node)) {
      return !!ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword);
    }
    // 特别处理 ModuleDeclaration 节点
    if (ts.isModuleDeclaration(node)) {
      // 检查是否有 'declare' 修饰符
      if (this.hasModifiers(node)) {
        return !!ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword);
      }
    }
    return false;
  }

  private addIssueReportNode(info: LocationInfo, filePath: string): void {
    const severity = this.rule.alert ?? this.metaData.severity;
    if (info.description) {
      this.metaData.description = info.description;
    }
    let defect = new Defects(info.line, info.character, info.character, this.metaData.description, severity,
      this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }
}
