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
import { ts, ArkFile, AstTreeUtils } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import {
  FileMatcher,
  MatcherCallback,
  MatcherTypes,
} from '../../matcher/Matchers';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { Utils } from '../../utils/common/Utils';
import { RuleFix } from '../../model/Fix';
//methodParams
//结果类型
type Options = [
  'always' | 'never',
  {
    allowNewlines?: boolean;
  }?
];
type RangNum = [charCount: number, newlineCount: number];
const defaultOptions: Options = ['never', {allowNewlines: false}]; //默认never
const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'FuncCallSpacingCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/func-call-spacing-check.md',
  description: ' Unexpected whitespace between function name and paren.',
};
//要求或不允许函数标识符和它们的调用之间有空格
export class FuncCallSpacingCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private issueMap: Map<string, IssueReport> = new Map();
  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  public registerMatchers(): MatcherCallback[] {
    const fileMatchBuildCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check,
    };
    return [fileMatchBuildCb];
  }

  public check = (targetFile: ArkFile) => {
    let options = (this.rule.option as Options) || defaultOptions;
    let mergedOptions: Options = [
      options[0] || defaultOptions[0], // 合并第一个部分
      { ...defaultOptions[1], ...options[1] }, // 合并第二个部分，使用 defaultOptions 和 options[1]
    ]; //处理参数
    const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
    this.issueMap.clear();
    const sourceFileObject = ts.getParseTreeNode(sourceFile);
    if (sourceFileObject === undefined) {
      return;
    }
    const targetFilePath = targetFile.getFilePath();
    this.loopNode(targetFilePath, sourceFile, sourceFileObject, mergedOptions);
    this.reportSortedIssues();
  };

  public loopNode(
    targetFilePath: string,
    sourceFile: ts.SourceFile,
    aNode: ts.Node,
    mergedOptions: Options
  ) {
    const children = aNode.getChildren();
   
    for (const child of children) {
      const callExpr = ts.isCallExpression(child);
      const newExpr = ts.isNewExpression(child);
      const chdLength = child.getChildren().length;
      if ((callExpr || newExpr) && (chdLength === 4 || chdLength === 5)) {
             
        const { nameConcent, openParenToken, syntaxList, closeParenToken } = this.extractCallExpressionParts(child);
        if (nameConcent) {
          const methodName = nameConcent.getText();
          const nodeText = child.getText();
          const rangeNum = this.countCharactersAndNewlines(sourceFile, child, nameConcent, openParenToken); //获取空格数和换行符数
          const startPosition = ts.getLineAndCharacterOfPosition(
            sourceFile,
            nameConcent.getEnd()
          ); //获取位置信息
          const rangeStart = child.getStart();
          const rangeEnd = child.getEnd();
          this.exceFix(
            nodeText,
            rangeStart,
            rangeEnd,
            mergedOptions,
            rangeNum,
            startPosition,
            targetFilePath,
            methodName
          );
        }
      }
      if (child.getChildCount() > 0) {
        this.loopNode(targetFilePath, sourceFile, child, mergedOptions);
      }
    }
  }

  private extractCallExpressionParts(child: ts.Node): { 
    nameConcent: ts.Node; 
    openParenToken: ts.Node; 
    syntaxList: ts.Node; 
    closeParenToken: ts.Node 
} {
    const children = child.getChildren();
    let newKeyWord: ts.Node;
    let nameConcent: ts.Node;
    let openParenToken: ts.Node;
    let syntaxList: ts.Node;
    let closeParenToken: ts.Node;
    const callExpr = ts.isCallExpression(child);
    const cdLength = children.length;
    if (callExpr) {
        // 情况 1: 没有 new 关键
        nameConcent = children[0];
        openParenToken = children[cdLength - 3];
        syntaxList = children[cdLength - 2];
        closeParenToken = children[cdLength - 1];
    } else {
        // 情况 2: 有 new 关键字
        newKeyWord = children[0];
        nameConcent = children[1];
        openParenToken = children[cdLength - 3];
        syntaxList = children[cdLength - 2];
        closeParenToken = children[cdLength - 1];
    }
    return { nameConcent, openParenToken, syntaxList, closeParenToken };
}

  private countCharactersAndNewlines(sourceFile: ts.SourceFile, child: ts.Node, nameConcent: ts.Node, openParenToken: ts.Node): RangNum {
    // 确保范围有效
    const startIndex = sourceFile.getLineAndCharacterOfPosition(nameConcent.getEnd()); // 获取 nameConcent 的结束位置
    const endIndex = sourceFile.getLineAndCharacterOfPosition(openParenToken.getStart()); // 获取 openParenToken 的开始位置
    const newlineCount = endIndex.line - startIndex.line;
    const nameConcentText = nameConcent.getText();
    const fullText = child.getText();
    const startdex = fullText.lastIndexOf(nameConcentText) + nameConcentText.length;
    let charCount = 0;
    if (newlineCount > 0) {
      charCount = newlineCount + endIndex.character;
    } else {
      charCount = endIndex.character - startIndex.character;
    }
    // 统计字符数和换行符数
   const subString = fullText.substring(startdex, startdex + charCount).replace('?', '').replace('.', '');
    return [subString.length, newlineCount];
}


  private addIssueReport(
    arkFilePath: string,
    line: number,
    startCol: number,
    endCol: number,
    name: string,
    message: string
  ): Defects {
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(
      line,
      endCol,
      endCol,
      message,
      severity,
      this.rule.ruleId,
      arkFilePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    this.defects.push(defect);
    return defect;
  }

  //处理格式化问题
  private formatFnCall(code: string, addSpace: boolean): string {
    if (addSpace) {
      // 在函数名和 '(' 之间添加空格，考虑换行符
      return code.replace(/(\w+)\s*\(\s*/g, '$1 (');
    } else {
      // 去除函数名和 '(' 之间的空格和换行符
      return code.replace(/(\w+)\s*\(\s*/g, '$1(');
    }
  }

  private ruleFix(pos: number, end: number, text: string): RuleFix {
    return { range: [pos, end], text: text };
  }

  private reportSortedIssues(): void {
    if (this.issueMap.size === 0) {
      return;
    }
    const sortedIssues = Array.from(this.issueMap.entries()).sort(
      ([keyA], [keyB]) => Utils.sortByLineAndColumn(keyA, keyB)
    );

    this.issues = [];

    sortedIssues.forEach(([_, issue]) => {
      RuleListUtil.push(issue.defect);
      this.issues.push(issue);
    });
  }

  private exceFix(
    nodeText: string,
    rangeStart: number,
    rangeEnd: number,
    mergedOptions: Options,
    rangeNum: RangNum,
    startPosition: ts.LineAndCharacter,
    filePath: string,
    methodName: string
  ): void {
    if (
      mergedOptions.length > 0 &&
      mergedOptions[0] === 'never' &&
      rangeNum[0] > 0
    ) {
      const defect = this.addIssueReport(
        filePath,
        startPosition.line + 1,
        startPosition.character,
        startPosition.character,
        methodName,
        'Unexpected whitespace between function name and paren.'
      );
      //1.修复含有空格
      if (rangeNum[1] === 0) {
        defect.fixable = true;
        this.addFixByText(nodeText, rangeStart, rangeEnd, defect, false);
      } else {
        this.issueMap.set(defect.fixKey, new IssueReport(defect, undefined));
      }
      
    } else if (
      mergedOptions.length > 0 &&
      mergedOptions[0] === 'always' &&
      rangeNum[0] === 0
    ) {
      const defect = this.addIssueReport(
        filePath,
        startPosition.line + 1,
        startPosition.character + 1,
        startPosition.character + 1,
        methodName,
        'Missing space between function name and paren.'
      );
      this.addFixByText(nodeText, rangeStart, rangeEnd, defect, false);
    } else if (
      mergedOptions.length > 0 &&
      !mergedOptions[1]?.allowNewlines &&
      mergedOptions[0] === 'always' &&
      rangeNum[1] > 0
    ) {
      const defect = this.addIssueReport(
        filePath,
        startPosition.line + 1,
        startPosition.character + 1,
        startPosition.character + 1,
        methodName,
        'Unexpected newline between function name and paren.'
      );
      this.addFixByText(nodeText, rangeStart, rangeEnd, defect, true);
    } 
  }

  private addFixByText(
    nodeText: string,
    rangeStart: number,
    rangeEnd: number,
    defect: Defects,
    format: boolean
  ): void {
    const fixText = this.formatFnCall(nodeText, format);
    let fix: RuleFix = this.ruleFix(rangeStart, rangeEnd, fixText);
    this.issueMap.set(defect.fixKey, { defect, fix });
  }
}
