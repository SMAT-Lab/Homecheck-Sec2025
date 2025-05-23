/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import { Rule } from '../../model/Rule';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import {
  FileMatcher,
  MatcherCallback,
  MatcherTypes,
} from '../../matcher/Matchers';
import { RuleListUtil } from '../../utils/common/DefectsList';

interface MessageInfo {
  return: string;
  break: string;
  throw: string;
  continue: string;
}

interface Violation {
  line: number;
  character: number;
  type: MessageType;
  filePath?: string;
}
enum MessageType {
  return = 'return',
  break = 'break',
  throw = 'throw',
  continue = 'continue',
}

export class NoUnsafeFinallyCheck implements BaseChecker {
  public issues: IssueReport[] = [];
  private messages: MessageInfo = {
    return: 'Unsafe usage of ReturnStatement',
    break: 'Unsafe usage of BreakStatement',
    throw: 'Unsafe usage of ThrowStatement',
    continue: 'Unsafe usage of ContinueStatement',
  };
  public rule: Rule;
  public defects: Defects[] = [];
  private sourceFile: ts.SourceFile;
  private violations: Violation[] = [];

  public metaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-unsafe-finally.md',
    description: 'Unsafe usage of ReturnStatement',
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
    if (target instanceof ArkFile) {
      const myInvalidPositions = this.checkNoUnsafeFinally(target);
      myInvalidPositions.forEach((pos) => {
        pos.filePath = target.getFilePath();
        this.addIssueReport(pos);
      });
    }
  };

  // 判断为函数声明、函数表达式、箭头函数、箭头函数表达式、类声明
  private isFunctionOrClassNode(node: ts.Node): boolean {
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isClassDeclaration(node)
    );
  }

  // 判断为循环节点
  private isLoopNode(node: ts.Node): boolean {
    return (
      ts.isDoStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForStatement(node)
    );
  }

  // 判断为switch...case节点
  private isSwitchNode(node: ts.Node): boolean {
    return ts.isSwitchStatement(node);
  }

  public checkNoUnsafeFinally(target: ArkFile): Violation[] {
    this.sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    this.violations = [];
    this.checkNode(this.sourceFile);
    return this.violations;
  }

  // 递归检查代码块
  private checkNode(node: ts.Node): void {
    if (ts.isLabeledStatement(node)) {
      this.checkLabeledStatement(node);
    } else if (ts.isTryStatement(node)) {
      this.checkTryStatement(node);
    }

    // 继续递归检查其他节点
    ts.forEachChild(node, child => this.checkNode(child));
  }

  // 检查带标签的语句
  private checkLabeledStatement(node: ts.LabeledStatement): void {
    const label = node.label.text;

    if (ts.isWhileStatement(node.statement)) {
      this.checkLabeledWhileStatement(node.statement, label);
    } else if (ts.isSwitchStatement(node.statement)) {
      this.checkLabeledSwitchStatement(node.statement, label);
    }
  }

  // 检查带标签的while语句
  private checkLabeledWhileStatement(whileStatement: ts.WhileStatement, label: string): void {
    if (!ts.isTryStatement(whileStatement.statement)) {
      return;
    }

    const tryStatement = whileStatement.statement;
    const finallyBlock = tryStatement.finallyBlock;
    if (!finallyBlock) {
      return;
    }

    const switchStatement = finallyBlock.statements.find(stmt =>
      ts.isSwitchStatement(stmt)
    ) as ts.SwitchStatement | undefined;

    if (!switchStatement || !switchStatement.caseBlock) {
      return;
    }

    this.checkSwitchCasesForUnsafeBreak(switchStatement.caseBlock, label);
  }

  // 检查带标签的switch语句
  private checkLabeledSwitchStatement(switchStatement: ts.SwitchStatement, label: string): void {
    const caseBlock = switchStatement.caseBlock;
    if (!caseBlock) {
      return;
    }

    // 遍历case子句
    ts.forEachChild(caseBlock, child => {
      if (!ts.isCaseClause(child)) {
        return;
      }

      // 遍历case子句中的节点
      ts.forEachChild(child, childNode => {
        if (!ts.isTryStatement(childNode)) {
          return;
        }

        const finallyBlock = childNode.finallyBlock;
        if (!finallyBlock) {
          return;
        }

        const switchStmt = finallyBlock.statements.find(stmt =>
          ts.isSwitchStatement(stmt)
        ) as ts.SwitchStatement | undefined;

        if (!switchStmt || !switchStmt.caseBlock) {
          return;
        }

        this.checkSwitchCasesForBreak(switchStmt.caseBlock, label);
      });
    });
  }

  // 检查switch case中的break语句(针对while里的switch)
  private checkSwitchCasesForUnsafeBreak(caseBlock: ts.CaseBlock, label: string): void {
    ts.forEachChild(caseBlock, child => {
      if (!ts.isCaseClause(child)) {
        return;
      }

      ts.forEachChild(child, childNode => {
        this.checkForUnsafeBreakOrContinue(childNode, label);
      });
    });
  }

  // 检查switch case中的break语句(针对switch里的switch)
  private checkSwitchCasesForBreak(caseBlock: ts.CaseBlock, label: string): void {
    // 获取所有case子句
    const caseClauses = this.getCaseClauses(caseBlock);

    // 检查每个case子句中的break语句
    for (const caseClause of caseClauses) {
      this.checkCaseClauseForLabeledBreak(caseClause, label);
    }
  }

  // 获取switch中的所有case子句
  private getCaseClauses(caseBlock: ts.CaseBlock): ts.CaseClause[] {
    const caseClauses: ts.CaseClause[] = [];

    ts.forEachChild(caseBlock, child => {
      if (ts.isCaseClause(child)) {
        caseClauses.push(child);
      }
    });

    return caseClauses;
  }

  // 检查case子句中的break语句
  private checkCaseClauseForLabeledBreak(caseClause: ts.CaseClause, label: string): void {
    ts.forEachChild(caseClause, childNode => {
      this.checkNodeForLabeledBreak(childNode, label);
    });
  }

  // 检查节点是否是带标签的break语句
  private checkNodeForLabeledBreak(node: ts.Node, label: string): void {
    if (!ts.isBreakStatement(node) || !node.label) {
      return;
    }

    if (node.label.text === label) {
      this.addViolation(node, MessageType.break);
    }
  }

  // 检查unsafe break或continue
  private checkForUnsafeBreakOrContinue(node: ts.Node, label: string): void {
    if (ts.isBreakStatement(node) && node.label) {
      if (node.label.text === label) {
        this.addViolation(node, MessageType.break);
      }
    } else if (ts.isContinueStatement(node)) {
      this.addViolation(node, MessageType.continue);
    }
  }

  // 检查try语句的finally块
  private checkTryStatement(node: ts.TryStatement): void {
    const finallyBlock = node.finallyBlock;
    if (!finallyBlock) {
      return;
    }

    // 遍历finally块中的语句
    ts.forEachChild(finallyBlock, child => {
      this.checkFinallyBlockChild(child);
    });
  }

  // 检查finally块中的子节点
  private checkFinallyBlockChild(child: ts.Node): void {
    // 获取位置信息，用于记录违规
    const position = this.sourceFile.getLineAndCharacterOfPosition(child.getStart());

    let skipCheck = false;

    // 检查return或throw语句
    if (ts.isReturnStatement(child) || ts.isThrowStatement(child)) {
      skipCheck = this.isFunctionOrClassNode(child);

      if (!skipCheck) {
        const type = ts.isReturnStatement(child) ? MessageType.return : MessageType.throw;
        this.addViolation(child, type);
      }
      return;
    }

    // 检查break语句
    if (ts.isBreakStatement(child)) {
      skipCheck = this.isFunctionOrClassNode(child) || this.isLoopNode(child);

      if (!skipCheck) {
        this.addViolation(child, MessageType.break);
      }
      return;
    }

    // 检查continue语句
    if (ts.isContinueStatement(child)) {
      skipCheck = this.isFunctionOrClassNode(child) ||
        this.isLoopNode(child) ||
        this.isSwitchNode(child);

      if (!skipCheck) {
        this.addViolation(child, MessageType.continue);
      }
      return;
    }

    // 检查if语句
    if (ts.isIfStatement(child) && !this.isFunctionOrClassNode(child)) {
      this.checkIfStatement(child);
    }
  }

  // 检查if语句中的return语句
  private checkIfStatement(node: ts.IfStatement): void {
    // 检查then分支
    this.checkStatementForReturns(node.thenStatement);

    // 检查else分支
    if (node.elseStatement) {
      this.checkStatementForReturns(node.elseStatement);

      // 检查else-if语句
      if (ts.isIfStatement(node.elseStatement)) {
        const elseIfNode = node.elseStatement;
        this.checkStatementForReturns(elseIfNode.thenStatement);
        if (elseIfNode.elseStatement) {
          this.checkStatementForReturns(elseIfNode.elseStatement);
        }
      }
    }
  }

  // 检查语句中的return语句
  private checkStatementForReturns(statement: ts.Statement | undefined): void {
    if (!statement) {
      return;
    }

    ts.forEachChild(statement, child => {
      if (ts.isReturnStatement(child)) {
        this.addViolation(child, MessageType.return);
      }
    });
  }

  // 添加违规记录
  private addViolation(node: ts.Node, type: MessageType): void {
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    this.violations.push({
      line: line + 1,
      character: character + 1,
      type: type
    });
  }

  private addIssueReport(pos: Violation) {
    this.metaData.description = this.messages[pos.type];
    const severity = this.rule.alert ?? this.metaData.severity;
    if (pos.filePath === undefined) {
      return;
    }
    const defect = new Defects(
      pos.line,
      pos.character,
      pos.character,
      this.metaData.description,
      severity,
      this.rule.ruleId,
      pos.filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false

    );
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }
}
