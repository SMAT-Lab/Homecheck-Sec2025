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

import { ArkField, Stmt, ArkAssignStmt } from 'arkanalyzer/lib';
import { ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseMetaData, BaseChecker } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import {
  ClassMatcher,
  MatcherCallback,
  MatcherTypes,
  FieldMatcher,
} from '../../matcher/Matchers';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { Rule } from '../../model/Rule';

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'PreferEnumInitializwersCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/prefer-literal-enum-member.md', // TODO: support url
  description:
    'Explicit enum value must only be a literal value (string, number, boolean, etc).',
};
class Options {
  allowBitwiseExpressions?: boolean;
}
const defaultOptions: Options = {
  allowBitwiseExpressions: false,
};
//接收rightOP返回类型
interface usedStmtOb {
  name?: string;
  classSignature?: classSignature;
}
interface classSignature {
  className: string;
}
const bitwiseOperationReg =
  /^\s*\d+(\.\d+)?\s*(&|\||\^|~|<<|>>|>>>)+\s*\d+(\.\d+)?\s*$/;
const bitwiseNotReg = /^~\d+$/; //特殊情况特殊处理
// 纯字符串的正则表达式，匹配被单引号或双引号包围的字符串
const pureStringRegex = /^(('null')|(['"]).*\3)$/;
// 纯数字的正则表达式，匹配仅包含数字的字符串
const pureNumberRegex = /^\d+$/;
// 以斜杠开头和结尾的正则表达式
const startsOrEndsWithSlashRegex = /^\/.*\/$/;
const originalTextReg = /(\{)|(\bnew\b)/;
const exceReg = /\.([0-9a-zA-Z]+)$/;
//推荐显式初始化每个枚举成员值。
export class PreferLiteralEnumMemberCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private clsMatcher: ClassMatcher = {
    matcherType: MatcherTypes.CLASS,
    category: [ClassCategory.ENUM],
  };

  private buildMatcher: FieldMatcher = {
    matcherType: MatcherTypes.FIELD,
    class: [this.clsMatcher],
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildTs: MatcherCallback = {
      matcher: this.buildMatcher,
      callback: this.check,
    };
    return [matchBuildTs];
  }

  //要求所有枚举成员都定义为字面量值。
  public check = (targetField: ArkField) => {
    const filePath = targetField
      ?.getDeclaringArkClass()
      ?.getDeclaringArkFile()
      ?.getFilePath();
    const isTs = this.getFileExtension(filePath, 'ts');
    if (!isTs) {
      return;
    }

    const severity = this.rule.alert ?? this.metaData.severity;
    const options: Options = this.rule.option[0] as unknown as Options;
    const mergedOptions = {
      ...defaultOptions,
      ...options,
    };
    //获取赋值语句
    const stmts = targetField.getInitializer() ?? [];
    this.process(stmts, severity, mergedOptions);
  };

  //判断是否是移位运算(1.符合运算格式，
  // 2.必须直接操作值)
  //公共--1.不能是引用 2.不能是对象，3.不能是tag,4.不能是实现构造方法5.不能是表达式
  //反推---->如果 只是数字 或者 ''(默认)
  /**
   * 检查字符串是否是纯字符串、纯数字或以斜杠开头和结尾。
   * 纯字符串：必须被单引号或双引号包围。
   * 纯数字：仅包含数字字符。
   * 以斜杠开头和结尾：字符串以斜杠开头和结尾(符合正则格式)。
   * @param input 要检查的字符串
   * @returns 如果字符串符合任一条件，则返回 true；否则返回 false
   */
  private isPureStringOrNumberOrStartsEndsWithSlash(
    input: string,
    allowBitwise: boolean
  ): boolean {
    if (allowBitwise) {
      // 检查输入字符串是否匹配任一正则表达式
      return (
        pureStringRegex.test(input) ||
        pureNumberRegex.test(input) ||
        startsOrEndsWithSlashRegex.test(input) ||
        this.isBitwiseOperationWithNumbers(input)
      );
    }
    // 检查输入字符串是否匹配任一正则表达式
    return (
      pureStringRegex.test(input) ||
      pureNumberRegex.test(input) ||
      startsOrEndsWithSlashRegex.test(input)
    );
  }

  /**
   * 检查字符串是否符合按位运算符的格式，并且操作数必须是数字类型（整数或浮点数）。
   * 按位运算符包括：&、|、^、~、<<、>>、>>>。
   * @param input 要检查的字符串
   * @returns 如果字符串符合按位运算符的格式，并且操作数是数字类型，则返回 true；否则返回 false
   */
  private isBitwiseOperationWithNumbers(input: string): boolean {
    return bitwiseOperationReg.test(input) || bitwiseNotReg.test(input);
  }

  private addIssueReport(stmt: Stmt, name: string, severity: number): void {
    const warnInfo = this.getLineAndColumn(stmt, name);
    let defect = new Defects(
      warnInfo.line,
      warnInfo.startCol,
      warnInfo.endCol,
      this.metaData.description,
      severity,
      this.rule.ruleId,
      warnInfo.filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }

  private getLineAndColumn(
    stmt: Stmt,
    name: string
  ): { line: number; startCol: number; endCol: number; filePath: string } {
    const originPosition = stmt.getOriginPositionInfo();
    const line = originPosition.getLineNo();
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
    if (arkFile) {
      const originText = stmt.getOriginalText() ?? '';
      let startCol = originPosition.getColNo();
      const pos = originText.indexOf(name);
      if (pos !== -1) {
        const endCol = startCol + name.length - 1;
        const originPath = arkFile.getFilePath();
        return { line, startCol, endCol, filePath: originPath };
      }
    } else {
      logger.debug('originStmt or arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }
  private getFileExtension(filePath: string, filetype: string): boolean {
    // 使用正则表达式匹配文件后缀
    const match = filePath.match(exceReg);

    // 如果匹配到了扩展名，且扩展名等于 filetype，则返回扩展名，否则返回空字符串
    if (match) {
      const extension = match[1];
      return extension === filetype;
    }

    return false;
  }
  private process(
    stmts: Stmt[],
    severity: number,
    mergedOptions: Options
  ): void {
    for (const stmt of stmts) {
      //说明有赋值(要进行判断)拿到赋值语句 进行匹配
      if (stmt instanceof ArkAssignStmt) {
        const rightOPTYPE = stmt.getRightOp().getType() as usedStmtOb;
        const originalText = stmt.getOriginalText();
        const rightOPSTR = originalText?.split('=')[1].trim() ?? '';
        let IssueCode = rightOPSTR.replace('\'', '').trim();
        //判定是不是对象(特殊处理)放掉
        if (
          rightOPTYPE.classSignature?.className &&
          !(rightOPTYPE.classSignature?.className === 'RegExp')
        ) {
          const matchResult = originalText
            ? originalText.match(originalTextReg)
            : null;
          IssueCode = matchResult ? matchResult[0] : '';
          this.addIssueReport(stmt, IssueCode, severity);
          break;
        }
        //判定字符类型是否是TagTemlet(默认转换为'')
        if (rightOPTYPE.name === 'string' && originalText?.includes('`')) {
          IssueCode = '`';
          this.addIssueReport(stmt, IssueCode, severity);
          break;
        }
        //推定按位运算rightOPTYPE.name==='literal' && 拿掉概括不全
        if (this.isBitwiseOperationWithNumbers(rightOPSTR)) {
          IssueCode = rightOPSTR.trim();
        }
        //判定是否合规
        if (
          !(rightOPSTR === 'null') &&
          !this.isPureStringOrNumberOrStartsEndsWithSlash(
            rightOPSTR,
            mergedOptions.allowBitwiseExpressions ?? false
          )
        ) {
          this.addIssueReport(stmt, IssueCode, severity);
          break; //禁止多余检索
        }
      }
    }
  }
}
