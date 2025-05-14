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

import {
  ArkMethod,
  ClassSignature,
  MethodSignature,
  Stmt,
} from 'arkanalyzer/lib';
import { RuleListUtil } from '../../utils/common/DefectsList';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import {
  ClassMatcher,
  MatcherCallback,
  MatcherTypes,
  MethodMatcher,
} from '../../matcher/Matchers';
import { CheckerUtils } from '../../utils/checker/CheckerUtils';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
type Scene_base = {
  base?: {
    constFlag?: boolean;
    name?: string;
    type?: {
      classSignature?: ClassSignature;
      baseType?: string;
      dimension?: number;
    };
  };
  args?: {
    name?: string;
    type?: {
      classSignature?: ClassSignature;
      methodSignature?: MethodSignature;
    };
  }[];
};
type Options = {
  /** Whether to ignore arrays in which all elements are strings. */
  ignoreStringArrays?: boolean;
};

const defaultOptions: Options = {
  ignoreStringArrays: true,
};

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'RequireArraySortCompareCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/require-array-sort-compare.md',
  description: `Require 'compare' argument.`,
};
//此规则旨在确保本机排序方法的所有调用都提供 ，同时忽略对用户定义方法的调用
export class RequireArraySortCompareCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  readonly SHORT_STR: string = 'sort';
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private clsMatcher: ClassMatcher = {
    matcherType: MatcherTypes.CLASS,
  };
  private buildMatcher: MethodMatcher = {
    matcherType: MatcherTypes.METHOD,
    class: [this.clsMatcher],
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildCb: MatcherCallback = {
      matcher: this.buildMatcher,
      callback: this.check,
    };
    return [matchBuildCb];
  }

  public check = (targetMtd: ArkMethod) => {
    const stmts = targetMtd.getBody()?.getCfg().getStmts() ?? [];
    const options: Options = this.rule.option[0] as unknown as Options;
    const mergedOptions: Options = {
      ...defaultOptions,
      ...options,
    };
    for (const stmt of stmts) { 
      const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
      if (!invokeExpr) {
        continue;
      }
      const methodSign = invokeExpr.getMethodSignature();
      const methodDetails = invokeExpr as unknown as Scene_base;
      const methodName = methodSign.getMethodSubSignature().getMethodName(); //被调用方法名
      const args = invokeExpr.getArgs(); //参数是否为空判断compare函数依据>0;
      const invokeType = methodDetails.base?.type
        ? methodDetails.base.type.toString()
        : ''; //调用方类型
      const invokeObject = methodDetails.base?.type?.classSignature; //是否是对象
      //判断short调用方是否是对象，是否是string数组，short内是否实现compare函数:
      if (
        methodName === this.SHORT_STR &&
        !invokeObject &&
        this.isRegularArray(invokeType)
      ) {
        if (mergedOptions.ignoreStringArrays) {
          if (!(args.length > 0 || invokeType.includes('string[]'))) {
            this.addIssueReport(stmt);
          }
        } else {
          if (!(args.length > 0)) {
            this.addIssueReport(stmt);
          }
        }
      }
    }
  };

  //是否是常规数组
  private isRegularArray(type: string): boolean {
    const regularArrayTypes = [
      'string[]',
      'number[]',
      'any[]',
      'boolean[]',
      'object[]',
      'undefined[]',
      'null[]',
      'Array<any>'
    ];
    //填坑最新ast 解析会将any 类型具体解析
    return regularArrayTypes.includes(type) || type.includes('|');
  }

  private addIssueReport(stmt: Stmt): void {
    const severity = this.rule.alert ?? this.metaData.severity;
    const warnInfo = this.getLineAndColumn(stmt);
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

  private getLineAndColumn(stmt: Stmt): {
    line: number;
    startCol: number;
    endCol: number;
    filePath: string;
  } {
    const originPosition = stmt.getOriginPositionInfo();
    const line = originPosition.getLineNo();
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
    if (arkFile) {
      const originText = stmt.getOriginalText() ?? '';
      const startCol = originPosition.getColNo();
      const pos = originText.indexOf(this.SHORT_STR);
      if (pos !== -1) {
        const startColOffset = startCol + pos;
        const endCol = startColOffset + this.SHORT_STR.length - 1;
        const originPath = arkFile.getFilePath();
        return { line, startCol, endCol, filePath: originPath };
      }
    } else {
      logger.debug('arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }
}
