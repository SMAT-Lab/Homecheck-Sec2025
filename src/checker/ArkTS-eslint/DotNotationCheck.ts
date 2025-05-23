/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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
import {
  ts, AstTreeUtils, ArkFile, Local, ArkAssignStmt, AbstractFieldRef, ClassSignature, ArkClass, Scene, ArkField,
  LineColPosition, Value, Stmt, ArkInvokeStmt, ArkArrayRef
} from 'arkanalyzer/lib';
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
type Options = {
  allowPrivateClassPropertyAccess: boolean;
  allowProtectedClassPropertyAccess: boolean;
  allowIndexSignaturePropertyAccess: boolean;
  allowKeywords: boolean;
  allowPattern: string;
};

const defaultOptions1: Options = {
  allowPrivateClassPropertyAccess: false,
  allowProtectedClassPropertyAccess: false, //默认fail
  allowIndexSignaturePropertyAccess: false, //默认fail
  allowKeywords: true,
  allowPattern: '',
};
const stringStart = /^[\d+\-*]/;
const codeStringReg = /^['"](.*)['"]$/;
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/dot-notation.md',
  description: 'is better written in dot notation.',
};
//要求或不允许函数标识符和它们的调用之间有空格
export class DotNotationCheck implements BaseChecker {
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
    const filePath = targetFile.getName();
    const isTs = this.getFileExtension(filePath, 'ts');
    if (!isTs) {
      return;
    }
    let options = (this.rule.option[0] as Options) || defaultOptions1;
    let mergedOptions: Options = {
      ...defaultOptions1,
      ...options,
    };
    const scene = targetFile.getScene();
    const classes = targetFile.getClasses();
    let arfileCode = targetFile.getCode();
    const arkfilePath = targetFile.getFilePath();
    this.issueMap.clear();
    this.checkClassforMethod(scene, arfileCode, arkfilePath, classes, mergedOptions);
    this.reportSortedIssues();
  };

  // 判断一个字符串是否为关键字或操作符
  private isKeyword(str: string): boolean {
    const keywords = [
      'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'return', 'function',
      'class', 'const', 'let', 'var', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super',
      'import', 'export', 'default', 'void', 'undefined', 'null', 'true', 'false', 'await', 'async',
      'instanceof', 'typeof', 'in', 'debugger', 'yield', 'eval', 'arguments', 'delete', 'any',
      'unknown', 'never', 'type', 'interface', 'enum', 'as', 'extends', 'implements', 'infer', 'declare',
      'module', 'namespace', 'public', 'private', 'protected', 'readonly'
    ];
    return keywords.includes(str);
  };

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
      startCol,
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

  private getFileExtension(filePath: string, filetype: string): boolean {
    // 使用正则表达式匹配文件后缀
    const match = filePath.match(/\.([0-9a-zA-Z]+)$/);
    // 如果匹配到了扩展名，且扩展名等于 filetype，则返回扩展名，否则返回空字符串
    if (match) {
      const extension = match[1];
      return extension === filetype;
    }
    return false;
  }

  private addFixByDot(
    filePath: string,
    declareOrigtext: string,
    fieldName: string,
    start: number,
    lineStartNo: number,
    lineStartCol: number
  ): void {
    if (!this.isKeyword(fieldName)) {
      return;
    } // 先检查是否为关键词，避免不必要遍历
    const astRoot = AstTreeUtils.getASTNode(fieldName, declareOrigtext);
    const matchingNodes = this.collectMatchingNodes(astRoot);
    for (const chd of matchingNodes) {
      if (!ts.isPropertyAccessExpression(chd)) {
        continue;
      } // 只处理 `obj.key` 形式
      for (const node of chd.getChildren()) {
        if (node.getText() !== fieldName) {
          continue;
        } // 过滤掉非匹配字段名
        const startOffset = start + node.getStart();
        const endOffset = start + node.getEnd();
        const startColOffset = lineStartCol; //+ posionFields.startCol;
        const defect = this.addIssueReport(
          filePath,
          lineStartNo,
          startColOffset,
          startColOffset + fieldName.length,
          `.${fieldName}`,
          `.${fieldName} ` + this.metaData.description
        );
        const fix: RuleFix = this.ruleFix(
          startOffset,
          endOffset,
          `['${fieldName}']`
        );
        defect.fixable = true;
        this.issueMap.set(defect.fixKey, { defect, fix });
      }
    }
  }

  private addFix(
    filePath: string,
    declareOrigtext: string,
    fieldName: string,
    start: number,
    lineStartNo: number,
    lineStartCol: number
  ): void {
    const astRoot = AstTreeUtils.getASTNode(fieldName, declareOrigtext);
    const matchingNodes = this.collectMatchingNodes(astRoot);
    for (const chd of matchingNodes) {
      if (!ts.isElementAccessExpression(chd)) {
        continue;
      } // 只处理 obj['key'] 形式
      const chdren = chd.getChildren();
      const argumentIndex = (chdren.length - 2) > 0 ? (chdren.length - 2) : 0;
      const openBracketToken = chdren[chdren.length - 3];
      const argumentExpression = chdren[argumentIndex];
      const closeBracketToken = chdren[chdren.length - 1];
      const stringLiteral = argumentExpression.getText().replace(codeStringReg, '$1');
      const fieldNameString = fieldName.replace(codeStringReg, '$1');
      const startCol = astRoot.getLineAndCharacterOfPosition(argumentExpression.getStart()).character + 1;
      const startLine = astRoot.getLineAndCharacterOfPosition(argumentExpression.getEnd()).line;
      //ts没有判定NullKeyword
      if (!(ts.isStringLiteral(argumentExpression) || fieldNameString === 'null') ||
        stringLiteral !== fieldNameString || stringStart.test(fieldNameString)) {
        continue;
      } // 确保是字符串字面量
      const defect = this.addIssueReport(
        filePath,
        lineStartNo + startLine,
        lineStartCol + startCol - 1,
        lineStartCol + startCol + fieldName.length - 1,
        `[${fieldNameString}]`,
        `['${fieldNameString}'] ` + this.metaData.description
      );
      const fix: RuleFix = this.ruleFix(
        start + openBracketToken.getStart(),
        start + closeBracketToken.getEnd(),
        `${fieldNameString}`
      );
      defect.fixable = true;
      this.issueMap.set(defect.fixKey, { defect, fix });
    }
  }

  private collectMatchingNodes(astRoot: ts.Node): ts.Node[] {
    const matchingNodes: ts.Node[] = [];
    astRoot.forEachChild((child) =>
      matchingNodes.push(...this.collectNodes(child))
    );
    return matchingNodes;
  }

  //检查所有的节点
  private collectNodes(node: ts.Node): ts.Node[] {
    const matchingNodes: ts.Node[] = [];
    // 如果节点是 ElementAccessExpression，添加到数组
    if (ts.isElementAccessExpression(node)) {
      matchingNodes.push(node);
    }
    // 如果节点是 PropertyAccessExpression，添加到数组
    if (ts.isPropertyAccessExpression(node)) {
      matchingNodes.push(node);
    }
    // 递归遍历所有子节点
    ts.forEachChild(node, (childNode) => {
      // 将子节点符合条件的节点合并到当前匹配节点数组
      matchingNodes.push(...this.collectNodes(childNode));
    });
    return matchingNodes;
  }

  //获取分割符
  private getLineBreak(text: string): string {
    if (text.includes('\r\n')) {
      return '\r\n';
    } else if (text.includes('\n')) {
      return '\n';
    } else {
      return '\r';
    }
  }

  private checkClassforMethod(
    scene: Scene,
    arfilecode: string,
    arkfilePath: string,
    classes: ArkClass[],
    mergedOptions: Options
  ): void {
    for (const clas of classes) {
      const methods = clas.getMethods();
      for (const med of methods) {
        const varLocal: Map<string, Local> =
          med.getBody()?.getLocals() ?? new Map<string, Local>();
        this.checkLocal(
          varLocal,
          scene,
          arfilecode,
          arkfilePath,
          mergedOptions
        );
        //处理执行函数 
        const stmts = med.getBody()?.getCfg().getStmts() ?? [];
        this.infunCallElementAccessExpression(stmts, arkfilePath, mergedOptions);
      }
    }
  }

  //处理执行函数
  private infunCallElementAccessExpression(stmts: Stmt[], arkFilePath: string, mereOptions: Options): void {
    for (const stmt of stmts) {
      if (stmt instanceof ArkInvokeStmt) {
        this.exceFunctionCall(stmt, arkFilePath, mereOptions);
      }
    }
  }

  private checkLocal(
    varLocal: Map<string, Local>,
    scene: Scene,
    arfilecode: string,
    arkfilePath: string,
    mergedOptions: Options
  ): void {
    const regex = new RegExp(mergedOptions.allowPattern);
    // 找到当前分割符所在行
    let lineBreak = this.getLineBreak(arfilecode);
    for (const [key, local] of varLocal) {
      if (key === 'this') {
        continue;
      } else if (key.startsWith('%')) {
        const declareStmt = local.getDeclaringStmt();
        const position = declareStmt?.getOriginPositionInfo();
        if (declareStmt instanceof ArkAssignStmt && position) { //合成stmts
          const rightOp = declareStmt.getRightOp();
          this.exceRightOp(rightOp, declareStmt, scene, position, arfilecode, arkfilePath, lineBreak, mergedOptions, regex);
        }
      } else {
        //处理赋值中存在的情况
        this.processAssignmentStatements(local, scene, arfilecode, arkfilePath, lineBreak, mergedOptions, regex);
      }
    }
  }

  private processAssignmentStatements(
    local: Local,
    scene: Scene,
    arfilecode: string,
    arkfilePath: string,
    lineBreak: string,
    mergedOptions: Options,
    regex: RegExp
  ): void {
    // 获取所有的使用语句
    const declareStmt = local.getDeclaringStmt();
    let usedStmts: Stmt[] = local.getUsedStmts();
    usedStmts = declareStmt ? [...usedStmts, declareStmt] : usedStmts;
    for (const useStmt of usedStmts) {
      const position = useStmt?.getOriginPositionInfo();
      // 确保 useStmt 是 ArkAssignStmt，并且 position 存在
      if (useStmt instanceof ArkAssignStmt && position) {
        const leftOp = useStmt.getLeftOp();
        const rightOp = useStmt.getRightOp();
        // 处理左侧操作数
        this.exceLeftOp(leftOp, useStmt, scene, position, arfilecode, arkfilePath, lineBreak, mergedOptions, regex);
        // 处理右侧操作数
        this.exceRightOp(rightOp, useStmt, scene, position, arfilecode, arkfilePath, lineBreak, mergedOptions, regex);
      }
    }
  }

  private addCollectaboutClass(
    arfilecode: string,
    arkfilePath: string,
    arkField: ArkField,
    declareOrigtext: string,
    position: LineColPosition,
    lineBreak: string,
    mergedOptions: Options,
    regex: RegExp
  ): void {
    const allowKeywords = mergedOptions.allowKeywords;
    const fieldName = arkField?.getName();
    const isPrivate = arkField?.isPrivate();
    const isProtected = arkField?.isProtected();
    const lineStartNo = position?.getLineNo() ?? - 1;
    const lineStartCol = position?.getColNo() ?? - 1;
    let cnt = 0;
    for (let index = 1; index < lineStartNo; index++) {
      cnt = arfilecode.indexOf(lineBreak, cnt + 1);
    }
    const start = cnt === 0 && lineStartNo === 1 ? 0 : cnt + lineStartCol + 1;
    if (allowKeywords) {
      if (mergedOptions.allowPrivateClassPropertyAccess && isPrivate) {
        return;
      }
      else if (mergedOptions.allowProtectedClassPropertyAccess && isProtected) {
        return;
      }
      else if (!(mergedOptions.allowPattern !== '' && regex.test(fieldName))) {
        this.addFix(arkfilePath,
          declareOrigtext,
          fieldName,
          start,
          lineStartNo,
          lineStartCol
        );
      }
    } else {
      this.addFixByDot(arkfilePath,
        declareOrigtext,
        fieldName,
        start,
        lineStartNo,
        lineStartCol
      );
    }
  }

  private addCollectOther(
    arfilecode: string,
    declareOrigtext: string,
    arkfilePath: string,
    lineBreak: string,
    position: LineColPosition,
    mergedOptions: Options,
    regex: RegExp,
    fieldName: string,
    clas: boolean
  ): void {
    const allowKeywords = mergedOptions.allowKeywords;
    const allowIndexSignaturePropertyAccess = mergedOptions.allowIndexSignaturePropertyAccess;
    const lineStartNot = position?.getLineNo() ?? - 1;
    const lineStartColt = position?.getColNo() ?? - 1;
    let cntt = 0;
    for (let index = 1; index < lineStartNot; index++) {
      cntt = arfilecode.indexOf(lineBreak, cntt + 1);
    }
    //对第一行第一列特殊处理，后续代码都是以0为起始偏移，所以需要+1
    const start = cntt === 0 && lineStartNot === 1 ? 0 : cntt + lineStartColt + 1;
    if (allowKeywords) {
      if (allowIndexSignaturePropertyAccess && clas) {
        return;
      } else if (!(mergedOptions.allowPattern !== '' && regex.test(fieldName))) {
        this.addFix(
          arkfilePath,
          declareOrigtext,
          fieldName,
          start,
          lineStartNot,
          lineStartColt
        );
      }
    } else {
      this.addFixByDot(arkfilePath, declareOrigtext, fieldName, start, lineStartNot, lineStartColt);
    }
  }

  private exceRightOp(
    rightOp: Value,
    declareStmt: Stmt,
    scene: Scene,
    position: LineColPosition,
    arfilecode: string,
    arkfilePath: string,
    lineBreak: string,
    mergedOptions: Options,
    regex: RegExp
  ): void {
    const rightOpField = rightOp as unknown as { field: AbstractFieldRef };
    const declareOrigtext = declareStmt.getOriginalText() ?? '';
    if (rightOpField.field || rightOp instanceof AbstractFieldRef) {
      const rightOpF = (rightOpField.field ? rightOpField.field : rightOp as AbstractFieldRef);
      const fieldsign = rightOpF.getFieldSignature();
      const classSign = fieldsign.getDeclaringSignature();
      if (classSign instanceof ClassSignature) {
        const clas = scene.getClass(classSign);
        const arkField = clas?.getField(fieldsign);
        //有定义class的
        if (arkField && position) {
          this.addCollectaboutClass(arfilecode, arkfilePath, arkField,
            declareOrigtext,
            position,
            lineBreak,
            mergedOptions,
            regex
          );
        } else {
          //没有class类的
          const isclass = clas ? true : false;
          const fieldName = rightOpF.getFieldName();
          this.addCollectOther(arfilecode, declareOrigtext, arkfilePath, lineBreak, position, mergedOptions, regex, fieldName, isclass);
        }
      }
    } else if (rightOp instanceof ArkArrayRef) {
      const fieldName = rightOp.getIndex().toString();
      this.addCollectOther(arfilecode, declareOrigtext, arkfilePath, lineBreak, position, mergedOptions, regex, fieldName, false);
    }
  }

  private exceLeftOp(
    leftOp: Value,
    declareStmt: Stmt,
    scene: Scene,
    position: LineColPosition,
    arfilecode: string,
    arkfilePath: string,
    lineBreak: string,
    mergedOptions: Options,
    regex: RegExp
  ): void {
    if (leftOp instanceof AbstractFieldRef) {
      const fieldsign = leftOp.getFieldSignature();
      const classSign = fieldsign.getDeclaringSignature();
      const declareOrigtext = declareStmt.getOriginalText() ?? '';
      if (classSign instanceof ClassSignature) {
        const clas = scene.getClass(classSign);
        const arkField = clas?.getField(fieldsign);
        //有定义class的
        if (arkField && position) {
          this.addCollectaboutClass(
            arfilecode,
            arkfilePath,
            arkField,
            declareOrigtext,
            position,
            lineBreak,
            mergedOptions,
            regex
          );
        } else {
          //没有class类的
          const isclass = clas ? true : false;
          const fieldName = leftOp.getFieldName();
          this.addCollectOther(
            arfilecode,
            declareOrigtext,
            arkfilePath,
            lineBreak,
            position,
            mergedOptions,
            regex,
            fieldName,
            isclass
          );
        }
      }
    }
  }

  private exceFunctionCall(
    stmt: Stmt,
    arkfilePath: string,
    mergedOptions: Options,
  ): void {
    const allowKeywords = mergedOptions.allowKeywords;
    const origText = stmt.getOriginalText() ?? '';
    const position = stmt.getOriginPositionInfo();
    if (allowKeywords && !origText.startsWith('delete')) {
      const origText = stmt.getOriginalText() ?? '';
      const astRoot = AstTreeUtils.getASTNode('fieldName', origText);
      const matchingNodes = this.collectMatchingNodes(astRoot);
      for (const chd of matchingNodes) {
        if (!ts.isElementAccessExpression(chd)) {
          continue;
        } // 只处理 obj['key'] 形式
        const chdren = chd.getChildren();
        const argumentIndex = (chdren.length - 2) > 0 ? (chdren.length - 2) : 0;
        const argumentExpression = chdren[argumentIndex];
        const stringLiteral = argumentExpression.getText().replace(codeStringReg, '$1');
        if (!ts.isStringLiteral(argumentExpression)) {
          continue;
        } // 确保是字符串字面量
        const lineStartNo = position?.getLineNo() ?? - 1;
        const startColOffset = astRoot.getLineAndCharacterOfPosition(argumentExpression.getStart()).character + 1;
        //对第一行第一列特殊处理，后续代码都是以0为起始偏移，所以需要+1
        const defect = this.addIssueReport(
          arkfilePath,
          lineStartNo,
          startColOffset,
          startColOffset + stringLiteral.length + 2,
          `[${stringLiteral}]`,
          `['${stringLiteral}'] ` + this.metaData.description
        );
        if (!this.issueMap.has(defect.fixKey)) {
          this.issueMap.set(defect.fixKey, { defect, fix: undefined });
        }
      }
    }
  }
}
