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
import { ArkFile, AstTreeUtils, LineColPosition, ts } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { RuleFix } from '../../model/Fix';
import { Rule } from '../../model/Rule';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { RuleListUtil } from "../../utils/common/DefectsList";

const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: 'docs/prefer-namespace-keyword.md',
  description: "Use 'namespace' instead of 'module' to declare custom TypeScript modules.",
};

export class PreferNamespaceKeywordCheck implements BaseChecker {
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
    const isTsFile = this.isTsFile(arkFile.getFilePath());
    if (!isTsFile) {
      return;
    };
    const namespaces = arkFile.getNamespaces()
    if (!namespaces) return;
    let astRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
    for (let child of astRoot.statements) {
      if (ts.isModuleDeclaration(child)) {
        this.processModuleDeclaration(child, arkFile, astRoot, false);
      };
    };
  };

  private processModuleDeclaration(node: ts.ModuleDeclaration, arkFile: ArkFile, astRoot: ts.SourceFile, moduleBlock: boolean): void {
    const isInternalModule = ts.isIdentifier(node.name); // 内部模块名称是标识符
    const isExternalModule = ts.isStringLiteral(node.name); // 外部模块名称是字符串字面量
    if (isExternalModule) {// 外部模块声明，不需要处理
      return;
    };
    if (isInternalModule) {
      let text = node.getText();
      if (moduleBlock) {
        text = node.getFullText();
      };
      if (ts.isModuleDeclaration(node) || moduleBlock) {
        const moduleTokens = Array.from(node.getChildren());
        const moduleKeywordNode = moduleTokens.find(token =>
          token.kind === ts.SyntaxKind.ModuleKeyword
        );
        if (moduleKeywordNode && moduleKeywordNode.getText() === "module") {
          // 创建缺陷报告和修复建议
          let sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
          const originTsPosition = LineColPosition.buildFromNode(node, sourceFile);
          let defect = this.createDefect(arkFile, originTsPosition, text, moduleBlock);
          const fixKeyword = "namespace";
          let ruleFix = this.createFix(moduleKeywordNode, fixKeyword);
          this.issues.push(new IssueReport(defect, ruleFix));
        };
      };
    };
    // 递归处理嵌套的模块声明
    if (node.body && ts.isModuleBlock(node.body)) {
      for (const statement of node.body.statements) {
        if (ts.isModuleDeclaration(statement)) {
          this.processModuleDeclaration(statement, arkFile, astRoot, true);
        };
      };
    };
  };
  private createDefect(arkFile: ArkFile, originTsPosition: LineColPosition, keyword: string, moduleBlock: boolean): Defects {
    if (moduleBlock) {
      const containsNewline = keyword.includes('\r\n') || keyword.includes('\n');
      if (containsNewline) {
        keyword = keyword.replace('\r\n', '').replace('\n', '')
      };
    };
    const filePath = arkFile.getFilePath();
    let lineNum = originTsPosition.getLineNo();
    let startColum = keyword.indexOf("module") + 1;
    let endColumn = startColum + "module".length;
    if (keyword.includes("declare")) {
      startColum = keyword.indexOf("declare") + 1;
      endColumn = keyword.indexOf("module") + "declare".length;
    };
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(lineNum, startColum, endColumn, this.metaData.description, severity,
      this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
    this.defects.push(defect);
    RuleListUtil.push(defect);
    return defect;
  };
  private createFix(child: ts.Node, code: string): RuleFix {
    return { range: [child.getStart(), child.getEnd()], text: code };
  };
  private isTsFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.ts');
  };
};