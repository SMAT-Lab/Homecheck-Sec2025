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
  Stmt,
  ArkClass,
  AbstractInvokeExpr,
  ArkInvokeStmt,
  ArkAssignStmt,
} from 'arkanalyzer/lib';
import { MethodParameter } from 'arkanalyzer/lib/core/model/builder/ArkMethodBuilder';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import {
  ClassMatcher,
  MatcherCallback,
  MatcherTypes,
} from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'NoUselessConstructorCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/no-useless-constructor-check.md', // TODO: support url
  description: 'Useless constructor.',
};
const constructorIndexReg = /\bconstructor\s*\(/;
const codeArgReg = /^...\s*/;
const modifierRegex = /\b(readonly|private|public|protected)\b/;
//不必要的构造函数包括：空的构造函数，或者构造函数中直接执行父类构造函数的逻辑。
export class NoUselessConstructorCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  readonly constructor_ = 'constructor';
  readonly super_ = 'super';
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private clsMatcher: ClassMatcher = {
    matcherType: MatcherTypes.CLASS,
  };
  public registerMatchers(): MatcherCallback[] {
    const matchBuildCb: MatcherCallback = {
      matcher: this.clsMatcher,
      callback: this.check,
    };
    return [matchBuildCb];
  }

  public check = (targetArkClass: ArkClass) => {
    const severity = this.rule.alert ?? this.metaData.severity;
    this.arkClassProcess(targetArkClass, severity);
  };

  private arkClassProcess(arkClass: ArkClass, severity: number): void {
    const arkMeths: ArkMethod[] = arkClass.getMethods();
    const superClassName: string = arkClass.getSuperClassName();
    for (const arkMethod of arkMeths) {
      const argsrt = arkMethod.getParameters();
      const code = arkMethod.getCode() ?? '';
      //不是构造方法直接跳过 
      const isConstructor = this.checkAccessibilityConstructor(code, superClassName);
      if (!isConstructor || (isConstructor && this.srgUsedModifiers(code, argsrt))) {
        continue;
      }
      let args = arkMethod.getParameters().map((param) => param.getName()); //由于构造函数的特殊性可以用长度推算出stmt的长度
      const stmts = arkMethod.getBody()?.getCfg().getStmts() ?? [];
      let lineCode = arkMethod.getLine() ?? 0;
      let lineColCode = arkMethod.getColumn() ?? 0;
      //记录构造方法头
      const headConstructStmt = stmts[0];
      const arkFilePath = arkMethod.getDeclaringArkFile().getFilePath();
      this.modifyArrayStmts(stmts, args.length); //获取构造方法内逻辑-----args.length为参数赋值stmts
      //1.构造函数方法体为空 && 没有继承其它class 2.迎合最新版去除参数条件
      if (stmts.length === 0 && superClassName === '') {
        this.addIssueReport_01([lineCode, lineColCode, code], arkFilePath, this.constructor_, severity);
        continue;
      }
      // 调用方法：
      let { stmtsNumber, superStmt, superaArgs } = this.getStartStmtNumber(
        stmts,
        headConstructStmt
      );
      //2.当只有super()并且都无参数 或者 参数相同(明字+数量)----->无奈之举:无法获到usedStmts[]
      if (stmts.length === 1 && stmtsNumber === 0) {
        //判断(明字+数量)---->明确条件逻辑拆分
        const arraysAreEqual = (arr1: string[], arr2: string[]) =>
          JSON.stringify(arr1.sort()) === JSON.stringify(arr2.sort());
        if (superaArgs.length === 0 && args.length === 0) {
          this.addIssueReport_01([lineCode, lineColCode, code], arkFilePath, this.constructor_, severity);
        }
        if (
          superaArgs.length > 0 &&
          superaArgs.length === args.length &&
          arraysAreEqual(superaArgs, args)
        ) {
          this.addIssueReport_01(
            [lineCode, lineColCode, code], arkFilePath, this.constructor_, severity);
        }
      }
    }
  }
  //判断构造方法参数是否是被 public private protect修饰
  private srgUsedModifiers(text: string, args: MethodParameter[]): boolean {
    const modifer = ['public', 'private', 'protected'];
    const argsNum = args.length;
    
    if (argsNum > 0) {
      const textreplace = text.replace(' ', '');
      const startIndex = textreplace.indexOf('constructor(');
      const lastName = args[argsNum - 1].getName();
      const lastArgName = lastName === 'ArrayBindingPattern' ? args[argsNum - 1].getArrayElements()[0].getName() : lastName;
      const lastIndex = text.lastIndexOf(lastArgName);
      const subString = text.substring(startIndex, lastIndex);
      return modifierRegex.test(subString);
    }
     return false;
  }

  //判定是否是符合要求的构造方法名
  private checkAccessibilityConstructor(
    text: string,
    superClassname: string
  ): boolean {
    const constructorIndex = text.search(constructorIndexReg);
    if (constructorIndex === -1 || constructorIndex > 15) {
      return false;
    }

    const startString = text.substring(0, constructorIndex).trim();
    switch (startString) {
      case 'protected':
      case 'private':
        return false;
      case 'public':
        if (superClassname !== '') {
          return false;
        }
        break;
    }
    return true;
  }

  // 获取构造方法体内的stmts和构造方法内的参数stmts
  modifyArrayStmts(arr: Stmt[], countToRemove: number): Stmt[] {
    // 确保 countToRemove 合理
    if (countToRemove < 0) {
      return arr;
    }

    // 删除前 countToRemove + 1 个元素
    arr.splice(0, countToRemove + 1);

    // 删除最后两个元素（如果数组长度允许）
    arr.length = Math.max(0, arr.length - 2);

    return arr; // 返回修改后的数组
}

  //是否是执行语句
  getInvokeExprFromStmt(stmt: Stmt): AbstractInvokeExpr | null {
    if (stmt instanceof ArkInvokeStmt) {
      return stmt.getInvokeExpr();
    } else if (stmt instanceof ArkAssignStmt) {
      const rightOp = stmt.getRightOp();
      if (rightOp instanceof AbstractInvokeExpr) {
        return rightOp;
      }
    }
    return null;
  }

  private addIssueReport(stmt: Stmt, name: string, severity: number): void {
    const warnInfo = this.getLineAndColumn(stmt, name);
    if (warnInfo.line > 0) {
      const defect = new Defects(
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
  }

  private addIssueReport_01(
    linePos: [x: number, y: number, label: string],
    filePath: string,
    name: string,
    severity: number
  ) {
    const warnInfo = this.getLineAndColumnMethod(linePos, filePath, name);
    if (warnInfo.line > 0) {
      const defect = new Defects(
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
        startCol += pos;
        const endCol = startCol + name.length - 1;
        const originPath = arkFile.getFilePath();
        return { line, startCol, endCol, filePath: originPath };
      }
    } else {
      logger.debug('originStmt or arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }

  private getLineAndColumnMethod(
    linePos: [line: number, col: number, code: string],
    arkFilePath: string,
    name: string
  ): { line: number; startCol: number; endCol: number; filePath: string } {
    const line = linePos[0];
    if (arkFilePath) {
      let startCol = linePos[1];
      const pos = linePos[2].indexOf(name);
      if (pos !== -1) {
        startCol += pos;
        const endCol = startCol + name.length - 1;
        const originPath = arkFilePath;
        return { line, startCol, endCol, filePath: originPath };
      }
    } else {
      logger.debug('originStmt or arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }

  private getStartStmtNumber(
    stmts: Stmt[],
    headConstructStmt: Stmt
  ): { stmtsNumber: number; superStmt: Stmt; superaArgs: string[] } {
    let stmtsNumber = 0;
    let superStmt: Stmt = headConstructStmt;
    let superaArgs: string[] = [];

    for (const stmt of stmts) {
      const invokeExpr = this.getInvokeExprFromStmt(stmt);
      if (!invokeExpr) {
        stmtsNumber++;
        continue;
      }
      const methodSign = invokeExpr.getMethodSignature();
      const methodName = methodSign.getMethodSubSignature().getMethodName();
      const args = invokeExpr.getArgs();
      if (methodName === this.super_) {
        superStmt = stmt;
        for (const arg of args) {
          let argcode = arg.toString().replace(codeArgReg, '');
          superaArgs.push(argcode);
        }
        break;
      }
      stmtsNumber++;
    }

    return { stmtsNumber, superStmt, superaArgs };
  }
}
