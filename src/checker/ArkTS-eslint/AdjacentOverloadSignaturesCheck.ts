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

import { RuleListUtil } from "../../utils/common/DefectsList";
import { ArkFile, ts } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects } from "../../model/Defects";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { AstTreeUtils } from "arkanalyzer";
import { Rule } from "../../model/Rule";
import { IssueReport } from "../../model/Defects";
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AdjacentOverloadSignaturesCheck');
type Member = ts.Node;
type Method = {
  name: string;
  static: boolean;
  line: number;
  endCol: number;
  character: number;
  fileName?: string;
  filePath?: string;
};

export class AdjacentOverloadSignaturesCheck implements BaseChecker {
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  public metaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/adjacent-overload-signatures-check.md',
    description: 'All ${methodName} signatures should be adjacent.',
  };

  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };
  public registerMatchers(): MatcherCallback[] {
    const fileMatcher: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    }
    return [fileMatcher];
  }
  public check = (target: ArkFile) => {
    const filePath = target.getFilePath();
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
    this.checkBodyForOverloadMethods(sourceFile).forEach((item) => {
      this.addIssueReport(item.line, item.character, item.endCol, filePath, item.name);
    })
  }

  private checkBodyForOverloadMethods(sourceFile: ts.SourceFile): Method[] {
    const lineAndersonColumn: any[] = [];
    this.visit(sourceFile, lineAndersonColumn, sourceFile);
    return lineAndersonColumn;
  }

  private visit(node: ts.Node, lineAndersonColumn: any[], sourceFile: ts.SourceFile): void {
    let members = this.getNodeMembers(node);
    if (members) {
      let lastMethod: Method | null = null;
      const seenMethods: Method[] = [];
      members.forEach((member: Member) => {
        const method = this.getMemberMethod(member, sourceFile);
        if (method == null) {
          lastMethod = null;
          return;
        }
        const index = seenMethods.findIndex(seenMethod =>
          this.isSameMethod(method, seenMethod),
        );
        if (index > -1 && !this.isSameMethod(method, lastMethod!)) {
          lineAndersonColumn.push({ line: method.line, character: method.character, endCol: method.endCol, name: method.name });
        } else if (index === -1) {
          seenMethods.push(method);
        }
        lastMethod = method;
      });
    }
    ts.forEachChild(node, (n) => this.visit(n, lineAndersonColumn, sourceFile));
  }

  private getMemberMethod(member: ts.Node, sourceFile: ts.SourceFile): Method | null {
    const position = member.getStart();
    const endPosition = member.getEnd();
    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, position);
    const { line: endLine, character: endChar } = ts.getLineAndCharacterOfPosition(sourceFile, endPosition);
    if (ts.isCallSignatureDeclaration(member)) {
      return { name: ' call ', static: false, line: line + 1, character: character + 1, endCol: endChar + 1 };
    }
    if (ts.isConstructorDeclaration(member)) {
      return { name: ' construct ', static: false, line: line + 1, character: character + 1, endCol: endChar + 1 };
    }
    let name: string | null = null;
    let isStatic = false;
    if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {

      if (member.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword)) {
        return null;
      }
      if (member.name && ts.isComputedPropertyName(member.name)) {
        const expr = member.name.expression;
        if (ts.isStringLiteral(expr)) {
          name = expr.text;
        } else if (ts.isIdentifier(expr)) {
          name = expr.text;
        }
      } else if (member.name && ts.isIdentifier(member.name)) {
        name = member.name.text;
      } else if (ts.isPrivateIdentifier(member.name)) {
        name = `#${member.name.text}`;
      }
      isStatic = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword) ?? false;
    } else if (ts.isFunctionDeclaration(member)) {
      name = member.name?.text ?? null;
    }
    if (!name) {
      return null;
    }
    return { name, static: isStatic, line: line + 1, character: character + 1, endCol: endChar + 1 };
  }
  private isSameMethod(method1: Method, method2: Method): boolean {
    if (method1 === null || method2 === null) {
      return false;
    }
    if (method1.name === ' call ' && method2.name === ' call ') {
      return true;
    }
    if (method1.name === ' construct ' && method2.name === ' construct ') {
      return true;
    }
    return method1.name === method2.name && method1.static === method2.static;
  }

  private getNodeMembers(node: ts.Node): Member[] | undefined {
    let members: Member[] | undefined;
    if (ts.isModuleDeclaration(node)) {
      members = (node.body && ts.isModuleBlock(node.body)) ? (node.body.statements as unknown as Member[]) : undefined;
    } else if (ts.isInterfaceDeclaration(node)) {
      members = node.members as unknown as Member[];
    } else if (ts.isClassDeclaration(node)) {
      members = node.members as unknown as Member[];
    } else if (ts.isTypeLiteralNode(node)) {
      members = node.members as unknown as Member[];
    } else if (ts.isSourceFile(node)) {
      members = node.statements as unknown as Member[];
    } else if (ts.isBlock(node)) {
      members = node.statements as unknown as Member[];
    }
    return members;
  }
  private async addIssueReport(line: number, startCol: number, endCol: number, filePath: string, methodName: string) {
    const severity = this.rule.alert ?? this.metaData.severity;
    const description = `All ${methodName} signatures should be adjacent.`;
    const defect = new Defects(line, startCol, endCol, description, severity,
      this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
    this.issues.push(new IssueReport(defect, undefined))
    RuleListUtil.push(defect);
  }
}
