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

import { ArkFile, ts } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { AstTreeUtils } from 'arkanalyzer';
import { Rule } from '../../model/Rule';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ModuleLoadingOptimization');
type Member = ts.Node;

export class ModuleTopLevelCodeCheck implements BaseChecker {
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  public metaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/module-loading-optimization-check.md',
    description: 'May have side effects',
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

  public check = (target: ArkFile): void => {
    if (target.getExportInfos().length === 0) {
      return;
    }
    const filePath = target.getFilePath();
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    this.visitNode(sourceFile, sourceFile, filePath);
  };

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile, filePath: string): void {
    if (!ts.isSourceFile(node)) {
      return;
    }
    const members = node.statements as unknown as Member[];
    members.forEach(member => {
      const nodes = member.getChildren(sourceFile);
      if (this.isWarningMember(member, nodes)) {
        this.reportIssue(member, sourceFile, filePath);
      }
    });
  }

  private reportIssue(member: ts.Node, sourceFile: ts.SourceFile, filePath: string): void {
    // 获取AST位置信息
    const startAST = member.getStart(sourceFile);
    const { line: lineAST, character: startColAST } = ts.getLineAndCharacterOfPosition(sourceFile, startAST);

    // 计算实际位置
    const lineNum = lineAST + 1;
    const startColum = startColAST + 1;
    const endColum = startColAST + 1;
    const severity = this.rule.alert ?? this.metaData.severity;
    let defects = new Defects(lineNum, startColum, endColum, this.metaData.description, severity, this.rule.ruleId,
      filePath, this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defects, undefined));
  }

  private isWarningMember(member: ts.Node, childNodes: ts.Node[]): boolean {
    const hasSpecificChildInBlock = (blockNode: ts.Node, checkNodeTypes: (node: ts.Node) => boolean): boolean => {
      const blockNodeChildren = blockNode.getChildren();
      const syntaxListNodes = blockNodeChildren.filter(child => child.kind === ts.SyntaxKind.SyntaxList);
  
      return syntaxListNodes.some(syntaxListNode => {
        const syntaxListChildren = syntaxListNode.getChildren();
        return syntaxListChildren.some(checkNodeTypes);
      });
    };
  
    switch (member.kind) {
      case ts.SyntaxKind.ExpressionStatement:
        return childNodes.some(this.isSpecificExpression);
  
      case ts.SyntaxKind.IfStatement: {
        const blockNodes = childNodes.filter(child => ts.isBlock(child));
        return blockNodes.some(blockNode =>
          hasSpecificChildInBlock(blockNode, child =>
            ts.isVariableStatement(child) || ts.isExpressionStatement(child)
          )
        );}
  
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.SwitchStatement:
      case ts.SyntaxKind.TryStatement:
        return true;
  
      case ts.SyntaxKind.Block: {
        const blockSyntaxListNodes = childNodes.filter(child => child.kind === ts.SyntaxKind.SyntaxList);
        return blockSyntaxListNodes.some(syntaxListNode =>
          syntaxListNode.getChildren().some(child => ts.isExpressionStatement(child))
        );}
  
      case ts.SyntaxKind.VariableStatement: {
        const variableDeclarationListNodes = childNodes.filter(child => ts.isVariableDeclarationList(child));
        return variableDeclarationListNodes.some(this.isVariableDeclarationWithCall);
      }
  
      default:
        return false;
    }
  }

  private isSpecificExpression(node: ts.Node): boolean {
    return (
      ts.isCallExpression(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isBinaryExpression(node) ||
      ts.isNewExpression(node)
    );
  };

  private isVariableDeclarationWithCall(variableDeclarationListNode: ts.Node): boolean {
    const varNodeChildren = variableDeclarationListNode.getChildren();
    const syntaxListNodes = varNodeChildren.filter(child => child.kind === ts.SyntaxKind.SyntaxList);

    return syntaxListNodes.some(syntaxListNode => {
      const syntaxListChildren = syntaxListNode.getChildren();
      const varNodes = syntaxListChildren.filter(child => ts.isVariableDeclaration(child));

      return varNodes.some(varNode => {
        const varNodeChildrens = varNode.getChildren();
        return varNodeChildrens.some(child => ts.isCallExpression(child));
      });
    });
  };
}