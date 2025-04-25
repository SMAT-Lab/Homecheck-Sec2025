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

import {
  ArkFile,
  ArkMethod,
  AstTreeUtils,
  Stmt,
  ts
} from 'arkanalyzer';

import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import {
  FileMatcher,
  MatcherCallback,
  MatcherTypes,
} from '../../matcher/Matchers';
import { Defects, IssueReport } from '../../model/Defects';
import { ALERT_LEVEL, Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { RuleFix } from '../../model/Fix';
import { FixUtils } from '../../utils/common/FixUtils';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PreferOptionalChainCheck');
export type Options = [
  {
    /** Allow autofixers that will change the return type of the expression. This option is considered unsafe as it may break the build. */
    allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing?: boolean;
    /** Check operands that are typed as `any` when inspecting "loose boolean" operands. */
    checkAny?: boolean;
    /** Check operands that are typed as `bigint` when inspecting "loose boolean" operands. */
    checkBigInt?: boolean;
    /** Check operands that are typed as `boolean` when inspecting "loose boolean" operands. */
    checkBoolean?: boolean;
    /** Check operands that are typed as `number` when inspecting "loose boolean" operands. */
    checkNumber?: boolean;
    /** Check operands that are typed as `string` when inspecting "loose boolean" operands. */
    checkString?: boolean;
    /** Check operands that are typed as `unknown` when inspecting "loose boolean" operands. */
    checkUnknown?: boolean;
    /** Skip operands that are not typed with `null` and/or `undefined` when inspecting "loose boolean" operands. */
    requireNullish?: boolean;
  },
];
interface Diagnostic {
  startLine: number;
  startColumn: number;
  errorType: string;
  fixRange?: { start: number; end: number };
  fixMessage?: string;
  suffix?: string
}

export class PreferOptionalChainCheck implements BaseChecker {
  private defaultOptions: Options = [
    {
      checkAny: true,
      checkUnknown: true,
      checkString: true,
      checkNumber: true,
      checkBoolean: true,
      checkBigInt: true,
      requireNullish: false,
      allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing: false,
    },
  ];
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  public sourceFile: ts.SourceFile;
  public diagnostics: Diagnostic[] = [];
  public variableTypes = new Map<string, string>();

  public metaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/prefer-optional-chain-check.md',
    description: `Prefer using an optional chain expression instead, as it's more concise and easier to read.`,
  };

  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  private executeNode(node: ts.Node): void {
    this.checkNestedLogicalOr(node); // 新增嵌套检查
    if (ts.isBinaryExpression(node)) {
      this.checkLogicalExpression(node, this.variableTypes);
    }
    ts.forEachChild(node, n => {
      this.executeNode(n);
    });
  };

  public registerMatchers(): MatcherCallback[] {
    const matchFileCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    }
    return [matchFileCb];
  }

  public check = (targetField: ArkFile): void => {
    this.defaultOptions = this.getOption();
    const severity = this.rule.alert ?? this.metaData.severity;
    const filePath = targetField.getFilePath();
    const classes = targetField.getClasses();
    let record: Map<string, string> = new Map();
    classes.forEach(clazz => {
      const methods = clazz.getMethods();
      methods.forEach(method => {
        this.execute(method, record, filePath, severity, targetField);
      })
    })

  }

  private execute(method: ArkMethod, record: Map<string, string>, filePath: string, severity: ALERT_LEVEL, targetField: ArkFile): void {
    const stmts = method?.getBody()?.getCfg().getStmts() ?? [];
    stmts.forEach(stmt => {
      const originText = stmt.getOriginalText() ?? '';
      const position = stmt.getOriginPositionInfo();
      const key = `${position.getLineNo()}:${position.getColNo()}`;
      if (!record.has(key) && originText && (originText.includes('&&') || originText.includes('||'))) {
        this.executeCheck(originText, filePath, severity, stmt, targetField);
        record.set(key, originText);
      }
    });
  }

  private executeCheck(code: string, filePath: string, severity: ALERT_LEVEL, stmt: Stmt, arkFile: ArkFile) {
    const myInvalidPositions = this.checkOptionalChain(code, arkFile);
    this.filterResult(myInvalidPositions, filePath, severity, stmt, arkFile);
  }

  private filterResult(myInvalidPositions: Diagnostic[], filePath: string, severity: ALERT_LEVEL, stmt: Stmt, arkFile: ArkFile) {
    let map: Map<String, Diagnostic> = new Map();
    myInvalidPositions.forEach((pos) => {
      const key = `${pos.startLine}:${pos.startColumn}`;
      if (map.has(key)) {
        const fixMessage = map.get(key)?.fixMessage ?? '';
        const currFixMessage = pos.fixMessage ?? '';
        if (currFixMessage.length > fixMessage.length) {
          map.set(key, pos);
        }
      } else {
        map.set(key, pos);
      }
    });
    map.forEach((pos) => {
      pos.fixMessage += pos.suffix ?? '';
      if (pos.errorType === 'always') {
        pos.fixRange = undefined;
        this.addIssueReport(filePath, pos, severity, stmt, arkFile);
      } else {
        this.executeReport(pos, filePath, severity, stmt, arkFile);
      }
    });
  }

  private executeReport(pos: Diagnostic, filePath: string, severity: ALERT_LEVEL, stmt: Stmt, arkFile: ArkFile): void {
    const config = this.defaultOptions[0];
    if (!config.requireNullish) {
      if (config.checkAny && pos.errorType === 'any') {
        this.addIssueReport(filePath, pos, severity, stmt, arkFile);
      } else if (config.checkString) {
        this.executeOtherReport(pos, config, filePath, severity, stmt, arkFile);
      }
    }
  }

  private executeOtherReport(pos: Diagnostic, config: {
    allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing?: boolean;
    checkAny?: boolean;
    checkBigInt?: boolean;
    checkBoolean?: boolean;
    checkNumber?: boolean;
    checkString?: boolean;
    checkUnknown?: boolean;
    requireNullish?: boolean;
  }, filePath: string, severity: ALERT_LEVEL, stmt: Stmt, arkFile: ArkFile) : void {
    if (pos.errorType === 'string') {
      if (!config.allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing) {
        pos.fixRange = undefined;
      }
      this.addIssueReport(filePath, pos, severity, stmt, arkFile);
    }
    if (config.checkUnknown && pos.errorType === 'unknown') {
      this.addIssueReport(filePath, pos, severity, stmt, arkFile);
    } else if (config.checkBigInt && pos.errorType === 'bigint') {
      if (!config.allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing) {
        pos.fixRange = undefined;
      }
      this.addIssueReport(filePath, pos, severity, stmt, arkFile);
    } else if (config.checkNumber && pos.errorType === 'number') {
      if (!config.allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing) {
        pos.fixRange = undefined;
      }
      this.addIssueReport(filePath, pos, severity, stmt, arkFile);
    }
  }

  private addIssueReport(filePath: string, pos: Diagnostic, severity: number, stmt: Stmt, arkFile: ArkFile) {
    const startLine = pos.startLine + stmt.getOriginPositionInfo().getLineNo() - 1;
    const startCol = pos.startColumn + (pos.startLine === 1 ? (stmt.getOriginPositionInfo().getColNo() - 1) : 0);
    const description = `Prefer using an optional chain expression instead, as it's more concise and easier to read.`;
    const ruleFix = this.createFix(pos, stmt, arkFile);
    const fixable = ruleFix !== undefined;
    const defect = new Defects(
      startLine,
      startCol,
      startCol,
      description,
      severity,
      this.rule.ruleId,
      filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      fixable
    );
    this.issues.push(new IssueReport(defect, ruleFix));
    RuleListUtil.push(defect);
  }

  private createFix(pos: Diagnostic, stmt: Stmt, arkFile: ArkFile): RuleFix | undefined {
    if (pos.fixRange) {
      const startVerify = FixUtils.getRangeStart(arkFile, stmt);
      return { range: [pos.fixRange.start + startVerify, pos.fixRange.end + startVerify], text: pos.fixMessage ?? '' };
    }
    return undefined;

  }

  private getOption(): Options {
    let option: Options;
    if (this.rule && this.rule.option) {
      option = this.rule.option as Options;
      if (option[0]) {
        if (option[0]?.allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing === undefined) {
          option[0].allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing = false;
        }
        if (option[0]?.checkAny === undefined) {
          option[0].checkAny = true;
        }
        if (option[0]?.checkUnknown === undefined) {
          option[0].checkUnknown = true;
        }
        if (option[0]?.checkString === undefined) {
          option[0].checkString = true;
        }
        if (option[0]?.checkNumber === undefined) {
          option[0].checkNumber = true;
        }
        if (option[0]?.checkBoolean === undefined) {
          option[0].checkBoolean = true;
        }
        if (option[0]?.checkBigInt === undefined) {
          option[0].checkBigInt = true;
        }
        if (option[0]?.requireNullish === undefined) {
          option[0].requireNullish = false;
        }
        return option;
      }
    }
    return this.defaultOptions;
  }

  private getTypeText(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): string {
    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types[0].getText(sourceFile);
    }
    return typeNode.getText(sourceFile);
  }

  private getErrorType(identifier: ts.Identifier, variableTypes: Map<string, string>): string {
    return variableTypes.get(identifier.text) || 'any';
  }

  private addDiagnostic(
    node: ts.Node,
    errorType: string,
    fixMessage?: string,
    fixRange?: [number, number],
    suffix?: string,
  ): void {
    const start = node.getStart(this.sourceFile);
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
    const diagnostic: Diagnostic = {
      startLine: line + 1,
      startColumn: character + 1,
      errorType,
    };
    if (fixMessage && fixRange) {
      diagnostic.fixRange = { start: fixRange[0], end: fixRange[1] };
      diagnostic.fixMessage = fixMessage;
      diagnostic.suffix = suffix;
    }
    this.diagnostics.push(diagnostic);
  }

  private checkLogicalExpression(node: ts.BinaryExpression, variableTypes: Map<string, string>): void {
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      this.checkLogicalAnd(node, variableTypes);
    } else if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      this.checkLogicalOr(node, variableTypes);
      this.checkLogicalOr1(node, variableTypes);
    }
  }

  private checkLogicalAnd(node: ts.BinaryExpression, variableTypes: Map<string, string>): void {
    const chain = this.flattenLogicalAnd(node);
    if (chain.length < 2) {
      return;
    }
    // 检查是否连续的属性访问链
    let isValid = true;
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1];
      const current = chain[i];
      if (!this.isPropertyAccessChain(prev, current)) {
        isValid = false;
        break;
      }
    }
    if (isValid) {
      const fixMessage = this.buildOptionalChain(chain);
      if (fixMessage) {
        this.addReport(chain, node, fixMessage);
      }
      return;
    }
    // 检查每个单独的 && 表达式
    let current: ts.Node = node;
    while (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      const left = current.left;
      const right = current.right;
      if (this.isReplaceableRight(left, right)) {
        const fixMessage = this.buildRightReplacement(left, right);
        if (fixMessage) {
          const start = current.getStart(this.sourceFile);
          const end = current.getEnd();
          this.addDiagnostic(current, this.getErrorTypeForExpression(left, variableTypes), fixMessage, [start, end]);
        }
      }
      current = current.left;
    }
  }

  private addReport(chain: ts.Expression[], node: ts.BinaryExpression, fixMessage: string): void {
    const last = chain[chain.length - 1];
    let suffix = '';
    if (ts.isBinaryExpression(last)) {
      const left = this.buildOptionalChain([last.left]);
      if (left) {
        const right = `${last.operatorToken.getText(this.sourceFile)} ${last.right.getText(this.sourceFile)}`;
        if (this.isNullOrUndefined(right)) {
          suffix = ` ${last.operatorToken.getText(this.sourceFile)} ${last.right.getText(this.sourceFile)}`;
        }
      }
    }
    const start = node.getStart(this.sourceFile);
    const end = node.getEnd();
    this.addDiagnostic(node, 'any', fixMessage, [start, end], suffix);
  }

  private buildRightReplacement1(left: ts.Expression, right: ts.Expression): string | undefined {
    // 解包逻辑非表达式
    const unwrappedLeft = this.unwrapLogicalNot(left);
    const unwrappedRight = this.unwrapLogicalNot(right);

    // 生成可选链核心部分
    let coreReplacement: string | undefined;
    if (ts.isPropertyAccessExpression(unwrappedRight)) {
      coreReplacement = `${unwrappedLeft?.getText(this.sourceFile)}?.${unwrappedRight.name.text}`;
    } else if (ts.isElementAccessExpression(unwrappedRight)) {
      const index = unwrappedRight.argumentExpression.getText(this.sourceFile);
      coreReplacement = `${unwrappedLeft?.getText(this.sourceFile)}?.[${index}]`;
    } else if (ts.isCallExpression(unwrappedRight)) {
      coreReplacement = `${unwrappedLeft?.getText(this.sourceFile)}?.()`;
    }

    // 保留外层的逻辑非
    if (coreReplacement) {
      const hasLeftNot = ts.isPrefixUnaryExpression(left);
      const hasRightNot = ts.isPrefixUnaryExpression(right);
      return (hasLeftNot || hasRightNot) ? `!${coreReplacement}` : coreReplacement;
    }
    return undefined;
  }

  private isReplaceableRight1(left: ts.Expression, right: ts.Expression): boolean {
    // 解包逻辑非表达式
    const unwrappedLeft = this.unwrapLogicalNot(left);
    const unwrappedRight = this.unwrapLogicalNot(right);

    // 核心逻辑：检查右侧表达式是否基于左侧表达式的属性链
    if (
      ts.isPropertyAccessExpression(unwrappedRight) &&
      this.areEquivalent(unwrappedRight.expression, unwrappedLeft)
    ) {
      return true;
    }

    if (
      ts.isElementAccessExpression(unwrappedRight) &&
      this.areEquivalent(unwrappedRight.expression, unwrappedLeft)
    ) {
      return true;
    }

    if (
      ts.isCallExpression(unwrappedRight) &&
      this.areEquivalent(unwrappedRight.expression, unwrappedLeft)
    ) {
      return true;
    }

    return false;
  }

  private checkLogicalOr1(node: ts.BinaryExpression, variableTypes: Map<string, string>): void {
    let current: ts.Node = node;
    while (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      const left = current.left;
      const right = current.right;

      // 关键修改：直接检查左右表达式的关系，不依赖 flatten 链
      if (this.isReplaceableRight1(left, right)) {
        const fixMessage = this.buildRightReplacement1(left, right);
        if (fixMessage) {
          const start = current.getStart(this.sourceFile);
          const end = current.getEnd();
          this.addDiagnostic(
            current,
            this.getErrorTypeForExpression(this.unwrapLogicalNot(left), variableTypes),
            fixMessage,
            [start, end]
          );
        }
      }
      current = current.left; // 继续向左侧递归检测
    }
  }

  private checkLogicalOr(node: ts.BinaryExpression, variableTypes: Map<string, string>): void {
    let current: ts.Node = node;
    while (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      const left = current.left;
      const right = current.right;

      // 关键修改：直接检查左右表达式的关系，不依赖 flatten 链
      if (this.isReplaceableRight(left, right)) {
        const fixMessage = this.buildRightReplacement(left, right);
        if (fixMessage) {
          const start = current.getStart(this.sourceFile);
          const end = current.getEnd();
          this.addDiagnostic(
            current,
            this.getErrorTypeForExpression(this.unwrapLogicalNot(left), variableTypes),
            fixMessage,
            [start, end]
          );
        }
      }
      current = current.left; // 继续向左侧递归检测
    }
  }

  private getErrorTypeForExpression(expr: ts.Expression, variableTypes: Map<string, string>): string {
    if (ts.isIdentifier(expr)) {
      return this.getErrorType(expr, variableTypes);
    } else if (ts.isPropertyAccessExpression(expr)) {
      return this.getErrorTypeForExpression(expr.expression, variableTypes);
    }
    return 'any';
  }

  private buildRightReplacement(left: ts.Expression, right: ts.Expression): string | undefined {
    if (ts.isPropertyAccessExpression(right)) {
      return `${left.getText(this.sourceFile)}?.${right.name.text}`;
    } else if (ts.isElementAccessExpression(right)) {
      const index = right.argumentExpression.getText(this.sourceFile);
      return `${left.getText(this.sourceFile)}?.[${index}]`;
    } else if (ts.isCallExpression(right)) {
      const expr = right.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        return `${left.getText(this.sourceFile)}?.${expr.name.text}()`;
      } else if (ts.isElementAccessExpression(expr)) {
        const index = expr.argumentExpression.getText(this.sourceFile);
        return `${left.getText(this.sourceFile)}?.[${index}]()`;
      } else if (this.areEquivalent(expr, left)) {
        return `${left.getText(this.sourceFile)}?.()`;
      }
    } else if (ts.isBinaryExpression(right)) {
      const leftReplacement = this.buildRightReplacement(left, right.left);
      if (leftReplacement) {
        return `${leftReplacement} ${right.operatorToken.getText(this.sourceFile)} ${right.right.getText(this.sourceFile)}`;
      }
    }
    return undefined;
  }

  private isReplaceableRight(left: ts.Expression, right: ts.Expression): boolean {
    // 处理属性访问：a && a.b
    if (ts.isPropertyAccessExpression(right) && this.areEquivalent(right.expression, left)) {
      return true;
    }

    // 处理元素访问：a && a['b']
    if (ts.isElementAccessExpression(right) && this.areEquivalent(right.expression, left)) {
      return true;
    }

    // 处理方法调用：a && a.method()
    if (ts.isCallExpression(right)) {
      const expr = right.expression;
      // 检查调用表达式的主体是否与 left 一致（如 a.method() 中的 a.method）
      if (
        (ts.isPropertyAccessExpression(expr) ||
          ts.isElementAccessExpression(expr)
        ) && this.areEquivalent(expr.expression, left)) {
        return true;
      }
      // 直接调用：a && a()
      if (this.areEquivalent(expr, left)) {
        return true;
      }
    }

    // 处理空值检查：a && a.b != null
    if (ts.isBinaryExpression(right) && this.isNullCheck(right)) {
      const leftExpr = right.left;
      if (
        (ts.isPropertyAccessExpression(leftExpr) ||
          ts.isElementAccessExpression(leftExpr) ||
          ts.isCallExpression(leftExpr)
        ) && this.areEquivalent(leftExpr.expression, left)) {
        return true;
      }
    }

    return false;
  }

  private isNullCheck(node: ts.BinaryExpression): boolean {
    const nullUndefined = [ts.SyntaxKind.NullKeyword, ts.SyntaxKind.UndefinedKeyword];
    return (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
      node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken ||
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
      (nullUndefined.includes(node.right.kind) || nullUndefined.includes(node.left.kind));
  }

  private flattenLogicalAnd(node: ts.Expression): ts.Expression[] {
    const chain: ts.Expression[] = [];
    while (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      chain.unshift(node.right);
      node = node.left;
    }
    chain.unshift(node);
    return chain;
  }

  private isPropertyAccessChain(prev: ts.Expression, current: ts.Expression): boolean {
    if (ts.isPropertyAccessExpression(current) && this.areEquivalent(current.expression, prev)) {
      return true;
    }
    if (ts.isElementAccessExpression(current) && this.areEquivalent(current.expression, prev)) {
      return true;
    }
    if (ts.isCallExpression(current) && this.areEquivalent(current.expression, prev)) {
      return true;
    }
    const code = current.getText(this.sourceFile).trim();
    if (ts.isBinaryExpression(current)) {
      // 检查 right.left 是否是 PropertyAccessExpression、ElementAccessExpression 或 CallExpression
      const right = `${current.operatorToken.getText(this.sourceFile)} ${current.right.getText(this.sourceFile)}`;
      if (this.isNullCheckAndCodeCheck(current, code)) {
        if (ts.isPropertyAccessExpression(current.left) && this.areEquivalent(current.left.expression, prev)) {
          return true;
        }
        if (ts.isElementAccessExpression(current.left) && this.areEquivalent(current.left.expression, prev)) {
          return true;
        }
        if (ts.isCallExpression(current.left) && this.areEquivalent(current.left.expression, prev)) {
          return true;
        }
      }
    }
    return false;
  }

  private isNullCheckAndCodeCheck(current: ts.BinaryExpression, code: string): boolean {
    return this.isNullCheck(current) ||
      code.endsWith('!= undefined') ||
      code.endsWith('!== undefined') ||
      code.endsWith('!= null') ||
      code.endsWith('!== null');
  }

  private buildOptionalChain(chain: ts.Expression[]): string | undefined {
    let result = chain[0].getText(this.sourceFile);
    for (let i = 1; i < chain.length; i++) {
      const expr = chain[i];
      const preExpr = chain[i - 1];
      if (ts.isPropertyAccessExpression(expr)) {
        const curr = expr.getText(this.sourceFile);
        let pre = chain[i - 1].getText(this.sourceFile);
        if (ts.isBinaryExpression(preExpr)) {
          pre = this.buildOptionalChain([preExpr.left]) ?? '';
        }
        const nail = curr.substring(curr.indexOf(pre) + pre.length);
        if (nail) {
          result += `${nail.startsWith('?') ? '' : '?'}${nail.startsWith('[') ? '.' : ''}${nail}`;
        }
      } else if (ts.isElementAccessExpression(expr)) {
        const index = expr.argumentExpression.getText(this.sourceFile);
        result += `?.[${index}]`;
      } else if (ts.isCallExpression(expr)) {
        const curr = expr.getText(this.sourceFile);
        const pre = chain[i - 1].getText(this.sourceFile);
        const nail = curr.substring(curr.indexOf(pre) + pre.length);
        result += `${nail === '()' ? '?.()' : `${nail.startsWith('?') ? '' : '?'}${nail.startsWith('[') ? '.' : ''}${nail}`}`;
      } else if (ts.isBinaryExpression(expr)) {
        const left = this.buildOptionalChain([expr.left]);
        if (left) {
          result = this.executeBinaryExpression(expr, left, chain, i, preExpr, result);
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
    return result;
  }

  private executeBinaryExpression(
    expr: ts.BinaryExpression, 
    left: string, 
    chain: ts.Expression[], 
    i: number, 
    preExpr: ts.Expression, 
    result: string
  ): string {
    const right = `${expr.operatorToken.getText(this.sourceFile)} ${expr.right.getText(this.sourceFile)}`;
    if (this.isNullOrUndefined(right)) {
      const curr = left;
      let pre = chain[i - 1].getText(this.sourceFile);
      if (ts.isBinaryExpression(preExpr)) {
        pre = this.buildOptionalChain([preExpr.left]) ?? '';
      }
      const nail = curr.substring(curr.indexOf(pre) + pre.length);
      if (nail) {
        result += `${nail.startsWith('?') ? '' : '?'}${nail.startsWith('[') ? '.' : ''}${nail}`;
      }

    } else {
      result = `${left} ${expr.operatorToken.getText(this.sourceFile)} ${expr.right.getText(this.sourceFile)}`;
    }
    return result;
  }

  private isNullOrUndefined(right: string): boolean {
    return right === '!= null' || right === '!== null' || right === '!= undefined' || right === '!== undefined';
  }

  private areEquivalent(a: ts.Expression, b: ts.Expression): boolean {
    const aText = a.getText(this.sourceFile);
    let bText = b.getText(this.sourceFile);
    const aParentText = a.parent.getText(this.sourceFile);
    if (bText.trim().endsWith('!= null')) {
      bText = bText.trim().substring(0, bText.trim().length - 7).trim();
    } else if (bText.trim().endsWith('!=null')) {
      bText = bText.trim().substring(0, bText.trim().length - 6).trim();
    } else if (bText.trim().endsWith('!== undefined')) {
      bText = bText.trim().substring(0, bText.trim().length - 13).trim();
    } else if (bText.trim().endsWith('!==undefined')) {
      bText = bText.trim().substring(0, bText.trim().length - 12).trim();
    }
    return aText.includes(bText) || aParentText === bText;
  }

  private unwrapLogicalNot(node: ts.Expression): ts.Expression {
    return ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.ExclamationToken
      ? node.operand
      : node;
  }


  // 新增：检测 (expr || {}).property 模式
  private checkLogicalOrWithDefault(node: ts.Expression): ts.Expression | null {
    if (
      ts.isParenthesizedExpression(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.BarBarToken
    ) {
      const left = node.expression.left;
      const right = node.expression.right;
      if (
        ts.isObjectLiteralExpression(right) &&
        right.properties.length === 0
      ) {
        return left;
      }
    }
    return null;
  }

  // 新增：递归检查嵌套结构
  private checkNestedLogicalOr(node: ts.Node): void {
    // 处理属性访问和元素访问
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const expression = node.expression;
      const convertedExpr = this.checkLogicalOrWithDefault(expression);
      if (convertedExpr) {
        // 生成诊断信息（不提供修复建议）
        this.addDiagnostic(
          node,
          'always',
          undefined,
          undefined
        );
      }
    }

    // 递归检查所有子节点
    ts.forEachChild(node, n => {
      this.checkNestedLogicalOr(n);
    });
  }

  private checkOptionalChain(code: string, arkFile: ArkFile): Diagnostic[] {
    this.sourceFile = AstTreeUtils.getASTNode(arkFile.getName(), code);
    this.diagnostics = [];
    // 收集所有变量声明的类型信息
    this.variableTypes.clear();
    ts.forEachChild(this.sourceFile, node => {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(decl => {
          this.executeDeclaration(decl, this.variableTypes);
        });
      }
    });

    // 遍历AST
    ts.forEachChild(this.sourceFile, node => {
      this.executeNode(node);
    });

    return this.diagnostics;
  }

  private executeDeclaration(decl: ts.VariableDeclaration, variableTypes: Map<string, string>): void {
    if (ts.isIdentifier(decl.name)) {
      const varName = decl.name.text;
      let type = 'any';
      if (decl.type) {
        type = this.getTypeText(decl.type, this.sourceFile);
      }
      variableTypes.set(varName, type);
    }
  }
}