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

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoCaseDeclarationsCheck');
const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/no-case-declarations-check.md",
  description: "Disallow lexical declarations in case clauses.",
};

const errMessage = "Unexpected lexical declaration in case block";

export class NoCaseDeclarationsCheck implements BaseChecker {
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  public registerMatchers(): MatcherCallback[] {
      const matchFileCb: MatcherCallback = {
          matcher: this.fileMatcher,
          callback: this.check
      }
      return [matchFileCb];
  }

  /**
   * 检查 TypeScript 代码中是否在 case/default 子句中使用词法声明，返回报错位置
   * @param sourceFile 要检查的 TypeScript 代码
   * @returns 包含词法声明错误位置的对象数组
   */
  public checkLexicalDeclarationsInSwitch(sourceFile: ts.SourceFile): { line: number, startCol: number, endCol: number }[] {
    const invalidPositions: { line: number, startCol: number, endCol: number }[] = [];

    function processStatement(statement: ts.Statement): void {
        if (ts.isVariableStatement(statement)) {
            processVariableStatement(statement);
        } else if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
            processDeclaration(statement);
        }
    }

    function processVariableStatement(statement: ts.VariableStatement): void {
        const declarationList = statement.declarationList;
        if (declarationList.flags & ts.NodeFlags.Let || declarationList.flags & ts.NodeFlags.Const) {
            addInvalidPosition(statement);
        }
    }

    function processDeclaration(statement: ts.FunctionDeclaration | ts.ClassDeclaration): void {
        addInvalidPosition(statement);
    }

    function addInvalidPosition(node: ts.Node): void {
        const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        invalidPositions.push({ line: startLine + 1, startCol: startCol + 1, endCol: endCol + 1 });
    }

    function checkNode(node: ts.Node): void {
        if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
            node.statements.forEach(processStatement);
        }
        ts.forEachChild(node, checkNode);
    }

    checkNode(sourceFile);
    return invalidPositions;
}

  public check = (target: ArkFile) => {
    const severity = this.rule.alert ?? this.metaData.severity;
    const sourceFile: ts.SourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    const myInvalidPositions = this.checkLexicalDeclarationsInSwitch(sourceFile);
    myInvalidPositions.forEach(pos => {
        this.addIssueReport(pos, severity, target.getFilePath());
    });
  }
  
  private addIssueReport(pos: { line: number, startCol: number, endCol: number }, severity: number, filePath: string): void {
    let defects = new Defects(pos.line, pos.startCol, pos.endCol, errMessage, severity, this.rule.ruleId,
      filePath, this.metaData.ruleDocPath, true, false, true);
    this.issues.push(new IssueReport(defects, undefined));
    RuleListUtil.push(defects);
  }
}
