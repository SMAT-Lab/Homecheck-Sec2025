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

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, "NoExtraNonNullAssertionCheck");

const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/no-extra-non-null-assertion.md",
  description: "Disallow extra non-null assertions",
};

export class NoExtraNonNullAssertionCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private issueMap: Map<string, IssueReport> = new Map();
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  public registerMatchers(): MatcherCallback[] {
    const fileMatchCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check,
    };
    return [fileMatchCb];
  }

  public check = (target: ArkFile): void => {
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    this.issueMap.clear();
    this.visitNodes(sourceFile, target);
    this.reportSortedIssues();
  };

  private visitNodes(sourceFile: ts.SourceFile, target: ArkFile): void {
    const visit = (node: ts.Node):void => {
      if (ts.isNonNullExpression(node)) {
        this.checkNestedNonNullExpression(node, sourceFile, target);
        this.checkParenthesizedNonNullExpression(node, sourceFile, target);
        this.checkOptionalChainingWithNonNull(node, sourceFile, target);
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }

  private checkNestedNonNullExpression(node: ts.NonNullExpression, sourceFile: ts.SourceFile, target: ArkFile): void {
    if (ts.isNonNullExpression(node.expression)) {
      const pos = node.getStart();
      const pos2 = node.getEnd();
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      this.addIssueReport(
        target,
        line + 1,
        character + 1,
        pos2,
        'Forbidden extra non-null assertion.'
      );
    }
  }

  private checkParenthesizedNonNullExpression(node: ts.NonNullExpression, sourceFile: ts.SourceFile, target: ArkFile): void {
    if (ts.isParenthesizedExpression(node.expression) && 
        ts.isNonNullExpression(node.expression.expression)) {
      const pos = node.expression.expression.getStart();
      const pos2 = node.expression.expression.getEnd();
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      this.addIssueReport(
        target,
        line + 1,
        character + 1,
        pos2, 
        'Forbidden extra non-null assertion.'
      );
    }
  }

  private checkOptionalChainingWithNonNull(node: ts.NonNullExpression, sourceFile: ts.SourceFile, target: ArkFile): void {
    let parent = node.parent;
    if (
      (ts.isPropertyAccessExpression(parent) && parent.questionDotToken) ||
      (ts.isCallExpression(parent) && parent.questionDotToken) ||
      (ts.isParenthesizedExpression(parent) && (
        (ts.isPropertyAccessExpression(parent.parent) && parent.parent.questionDotToken) ||
        (ts.isCallExpression(parent.parent) && parent.parent.questionDotToken)
      )) ||
      (ts.isElementAccessExpression(parent) && 
       parent.questionDotToken && 
       parent.expression === node)
    ) {
      const pos = node.getStart();
      const pos2 = node.getEnd();
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      this.addIssueReport(
        target,
        line + 1,
        character + 1,
        pos2,
        'Forbidden extra non-null assertion.'
      );
    }
  }

  private reportSortedIssues(): void {
    if (this.issueMap.size === 0) {
      return;
    }

    const sortedIssues = Array.from(this.issueMap.entries())
      .sort(([keyA], [keyB]) => {
        const [lineA, colA] = keyA.split('%');
        const [lineB, colB] = keyB.split('%');
        if (lineA !== lineB) {
          return Number(lineA) - Number(lineB);
        }
        return Number(colA) - Number(colB);
      });

    this.issues = [];
    sortedIssues.forEach(([_, issue]) => {
      RuleListUtil.push(issue.defect);
      this.issues.push(issue);
    });
  }

  private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string): void {
    const severity = this.rule.alert ?? this.metaData.severity;
    const filePath = arkFile.getFilePath();
    const issueKey = `${line}%${startCol}%${endCol}%${this.rule.ruleId}`;

    const defect = new Defects(
      line,
      startCol,
      endCol,
      message,
      severity,
      this.rule.ruleId,
      filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      true
    );

    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);

    const visit = (node: ts.Node): ts.Node | undefined => {
      if (ts.isNonNullExpression(node)) {
        const { line: nodeLine, character: nodeChar } = 
          sourceFile.getLineAndCharacterOfPosition(node.getStart());
        if (nodeLine + 1 === line && nodeChar + 1 === startCol) {
          return node;
        }
      }
      return ts.forEachChild(node, visit);
    };

    const targetNode = ts.forEachChild(sourceFile, visit);
    if (targetNode && ts.isNonNullExpression(targetNode)) {
      let fix: RuleFix;
      
      if (ts.isNonNullExpression(targetNode.expression)) {
        let current = targetNode;
        while (ts.isNonNullExpression(current.expression)) {
          current = current.expression;
        }
        fix = {
          range: [current.end, targetNode.end],
          text: ''
        };
      } else {
        fix = {
          range: [targetNode.end - 1, targetNode.end],
          text: ''
        };
      }
      
      this.issueMap.set(issueKey, { defect, fix });
    }
  }
}