/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License");
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
import { ts, LineColPosition, AstTreeUtils, ArkFile } from 'arkanalyzer/lib';
import { RuleFix } from '../../model/Fix';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import {
  FileMatcher,
  MatcherCallback,
  MatcherTypes,
} from '../../matcher/Matchers';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { Utils } from '../../utils/common/Utils';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
//methodParams
//结果类型
type AccessibilityLevel =
  | 'explicit' // require an accessor (including public)
  | 'no-public' // don't require public
  | 'off'; // don't check

type Options = {
  accessibility?: AccessibilityLevel;
  ignoredMethodNames?: string[];
  overrides?: {
    accessors?: AccessibilityLevel; //对应 get/set
    constructors?: AccessibilityLevel; //构造方法
    methods?: AccessibilityLevel; //方法名称
    properties?: AccessibilityLevel; //class属性
    parameterProperties?: AccessibilityLevel; //构造函数中的参数属性
  };
};
const defaultText = 'explicit';
const defaultOptions: Options = { accessibility:  defaultText};
const docsPath = 'docs/explicit-member-accessibility-check.md';
const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'KeywordSpacingCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: docsPath,
  description: 'is better written in dot notation.',
};
//强制或禁止在 TypeScript 类的成员（属性、方法）上使用显式的访问修饰符
export class ExplicitMemberAccessibilityCheck implements BaseChecker {
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
    let options = (this.rule.option[0] as Options) || defaultOptions;
    let mergedOptions: Options = {
      ...defaultOptions,
      ...options,
    };
    this.issueMap.clear();
    const targetFilePath = targetFile.getFilePath();
    const astRoot = AstTreeUtils.getSourceFileFromArkFile(targetFile);
    for (let child of astRoot.statements) {
      this.loopNode(targetFilePath, astRoot, child, mergedOptions, []);
    }
    this.reportSortedIssues();
  };

  public loopNode(
    targetFilePath: string,
    sourceFile: ts.SourceFile,
    aNode: ts.Node,
    mergedOptions: Options,
    alloct: string[] = []
  ): string[] {
    const defaultText = 'explicit';
    const baseCheck: AccessibilityLevel = mergedOptions.accessibility ?? defaultText;
    const overrides = mergedOptions.overrides ?? {};
    const ctorCheck = overrides.constructors ?? baseCheck;
    const accessorCheck = overrides.accessors ?? baseCheck;
    const methodCheck = overrides.methods ?? baseCheck;
    const propCheck = overrides.properties ?? baseCheck;
    const paramPropCheck = overrides.parameterProperties ?? baseCheck;
    const ignoredMethodNames = new Set(mergedOptions.ignoredMethodNames ?? []);
    const children = aNode.getChildren();
    for (const child of children) {
      if (
        ts.isMethodDeclaration(child) ||
        ts.isConstructorDeclaration(child) ||
        ts.isGetAccessorDeclaration(child) ||
        ts.isSetAccessorDeclaration(child)
      ) {
        this.checkMethodAccessibilityModifier(
          targetFilePath,
          sourceFile,
          child,
          baseCheck,
          ignoredMethodNames,
          methodCheck,
          ctorCheck,
          accessorCheck
        );
      }
      if (ts.isParameterPropertyDeclaration(child, child.parent)) {
        //处理构造方法参数属性
        this.checkParameterPropertyAccessibilityModifier(targetFilePath, sourceFile, child, paramPropCheck);
      }
      if (ts.isPropertyDeclaration(child)) {
        this.checkPropertyAccessibilityModifier(targetFilePath, sourceFile, child, propCheck);
      }
      if (child.getChildren().length > 0) {
        this.loopNode(targetFilePath, sourceFile, child, mergedOptions, alloct); // 递归时传递 alloct
      }
    }
    return alloct;
  }

  private addIssueReport(
    targetFilePath: string,
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
      targetFilePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    this.defects.push(defect);
    return defect;
  }

  //辅助函数1  检查 函数或方法的参数 是否具有合适的访问权限修饰符。
  private checkParameterPropertyAccessibilityModifier(
    targetFilePath: string,
    sourceFile: ts.SourceFile,
    node: ts.ParameterPropertyDeclaration,
    paramPropCheck: AccessibilityLevel
  ): void {
    const nodeName = node.name.getText();
    if (
      paramPropCheck === 'explicit' &&
      !node.modifiers?.some((modifier) =>
          modifier.kind === ts.SyntaxKind.PublicKeyword ||
          modifier.kind === ts.SyntaxKind.PrivateKeyword ||
          modifier.kind === ts.SyntaxKind.ProtectedKeyword
      )
    ) {
      const position = LineColPosition.buildFromNode(node, sourceFile);
      const message = `Missing accessibility modifier on parameter property ${nodeName}.`;
      const defect = this.addIssueReport(
        targetFilePath,
        position.getLineNo(),
        position.getColNo(),
        position.getColNo() + nodeName.length,
        nodeName,
        message
      );
      defect.fixable = false;
      this.issueMap.set(defect.fixKey, { defect, fix: undefined });
    } else if (
      paramPropCheck === 'no-public' &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PublicKeyword) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
    ) {
      const position = LineColPosition.buildFromNode(node, sourceFile);
      const message = `Public accessibility modifier on parameter property ${nodeName}.`;
      const defect = this.addIssueReport(
        targetFilePath,
        position.getLineNo(),
        position.getColNo(),
        position.getColNo() + nodeName.length,
        nodeName,
        message
      );
      const fixText = node.getText().substring(6);
      let fix: RuleFix = this.ruleFix(node.getStart(), node.getEnd(), fixText);
      defect.fixable = true;
      this.issueMap.set(defect.fixKey, { defect, fix });
    }
  }

  //辅助函数2 检查 方法 的访问权限修饰符。
  private checkMethodAccessibilityModifier(
    targetFilePath: string,
    sourceFile: ts.SourceFile,
    methodDefinition: | ts.MethodDeclaration | ts.ConstructorDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
    baseCheck: AccessibilityLevel,
    ignoredMethodNames: Set<string>,
    methodCheck: AccessibilityLevel,
    ctorCheck: AccessibilityLevel,
    accessorCheck: AccessibilityLevel
  ): void {
    // 跳过私有方法 (检查 methodDefinition 的修饰符)
    const hasPrivateModifier = methodDefinition.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword);
    if (hasPrivateModifier) {
      return;
    }
    let check = baseCheck;
    let message = `err`;
    // 获取方法名称
    let methodName = '';
    const isComputedPropertyName = methodDefinition.name?.kind === ts.SyntaxKind.ComputedPropertyName;
    isComputedPropertyName ? methodName = methodDefinition.name.expression.getText() : methodName = (methodDefinition.name as ts.Identifier)?.text ?? 'constructor';
    // 根据 methodDefinition.kind 判断方法类型
    const checkRsult = this.getAccessibilityCheckAndMessage(methodDefinition, methodName, baseCheck, methodCheck, ctorCheck, accessorCheck);
    check = checkRsult.check;
    message = checkRsult.message;
    if (check === 'off' || methodName.startsWith('#') || ignoredMethodNames.has(methodName) || 
    ts.isObjectLiteralExpression(methodDefinition.parent) || ts.isInterfaceDeclaration(methodDefinition.parent)) {
      return;
    }
    const hasPublicModifier = methodDefinition.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PublicKeyword);
    const hascModifier = methodDefinition.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PublicKeyword || mod.kind === ts.SyntaxKind.ProtectedKeyword ||
        mod.kind === ts.SyntaxKind.PrivateKeyword
    );
    if (check === 'no-public' && hasPublicModifier) {
      const position = LineColPosition.buildFromNode(methodDefinition, sourceFile);
      message = message.replace('Missing', 'Public');
      const fixText = methodDefinition.getText().substring(6);
      this.execFix(position, targetFilePath, message, fixText, methodName, methodDefinition, '');
    } else if (check === 'explicit' && !hascModifier) {
      const position = LineColPosition.buildFromNode(methodDefinition, sourceFile);
      const fixText = 'public ';
      this.execFix(position, targetFilePath, message, fixText, methodName, methodDefinition, undefined);
    }
  }

  private getAccessibilityCheckAndMessage(
    methodDefinition: ts.Node, 
    methodName: string, 
    baseCheck: AccessibilityLevel,
    methodCheck: AccessibilityLevel,
    ctorCheck: AccessibilityLevel,
    accessorCheck: AccessibilityLevel
  ): {check: AccessibilityLevel, message: string} {
    let check = baseCheck;
    let message;
    switch (methodDefinition.kind) {
      case ts.SyntaxKind.MethodDeclaration:
        check = methodCheck;
        message = `Missing accessibility modifier on method definition ${methodName}.`;
        break;
        
      case ts.SyntaxKind.Constructor:
        check = ctorCheck;
        message = `Missing accessibility modifier on method definition constructor.`;
        break;
        
      case ts.SyntaxKind.GetAccessor:
        check = accessorCheck;
        message = `Missing accessibility modifier on get property accessor ${methodName}.`;
        break;
      case ts.SyntaxKind.SetAccessor:
        check = accessorCheck;
        message = `Missing accessibility modifier on set property accessor ${methodName}.`;
        break;
        
      default:
        check = baseCheck;
        message = '';
    }
  
    return { check, message };
  }
   

  // 辅助函数3 类的属性 的访问权限修饰符
  private checkPropertyAccessibilityModifier(
    targetFilePath: string,
    sourceFile: ts.SourceFile,
    propertyDefinition: ts.PropertyDeclaration,
    propCheck: string // 假定 propCheck 作为参数传递
  ): void {
    const propertyName = this.getNameFromMember1(propertyDefinition); // 使用辅助函数提取属性名称
    if (!propertyName || propertyName.startsWith('#') || propertyDefinition.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword)
    ) {
      return;
    }
    const type = propertyDefinition.type;
    const hasPublicModifier = propertyDefinition.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PublicKeyword);
    const hasPrivateModifier = propertyDefinition.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword);
    const hasProtectedModifier = propertyDefinition.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ProtectedKeyword);
    if (propCheck === 'no-public' && hasPublicModifier) {
      const position = LineColPosition.buildFromNode(propertyDefinition, sourceFile);
      const message = `Public accessibility modifier on class property ${propertyName}.`;
      const fixText = propertyDefinition.getText().substring(6);
      this.execFix(position, targetFilePath, message, fixText, propertyName, propertyDefinition, type);
    } else if (
      propCheck === 'explicit' &&
      !hasPublicModifier &&
      !hasPrivateModifier &&
      !hasProtectedModifier
    ) {
      const position = LineColPosition.buildFromNode(propertyDefinition, sourceFile);
      const message = `Missing accessibility modifier on class property ${propertyName}.`;
      const fixText = 'public ';
      this.execFix(position, targetFilePath, message, fixText, propertyName, propertyDefinition, undefined);
    }
  }

  private getNameFromMember1(
    propertyDefinition:
      | ts.PropertyDeclaration
      | ts.MethodDeclaration
      | ts.GetAccessorDeclaration
      | ts.SetAccessorDeclaration
  ): string {
    let name = '';
    // 判断属性类型
    if (
      ts.isPropertyDeclaration(propertyDefinition) ||
      ts.isMethodDeclaration(propertyDefinition)
    ) {
      // 如果是属性声明或者方法声明，直接访问name
      const isComputedPropertyName = propertyDefinition.name.kind === ts.SyntaxKind.ComputedPropertyName;
      isComputedPropertyName ? name = propertyDefinition.name.expression.getText() : name = (propertyDefinition.name as ts.Identifier).text;
    } else if (
      ts.isGetAccessorDeclaration(propertyDefinition) ||
      ts.isSetAccessorDeclaration(propertyDefinition)
    ) {
      // 如果是获取器或设置器，直接访问name
      name = (propertyDefinition.name as ts.Identifier).text;
    }
    // 处理计算属性（例如 [key]）
    else if (
      propertyDefinition &&
      ts.isComputedPropertyName(propertyDefinition)
    ) {
      name = (
        propertyDefinition as ts.ComputedPropertyName
      ).expression.getText(); // 获取计算属性的名称
    } else {
      // 如果没有匹配到任何类型，可以抛出一个错误或处理其它情况
      throw new Error('Unexpected property or method type');
    }
    return name;
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

  private execFix(
    position: LineColPosition,
    targetFilePath: string, 
    message: string,
    fixText: string,
    propertyName: string,
    propertyDefinition: ts.Node,
    type: ts.TypeNode | string | undefined,
  ): void {
    const defect = this.addIssueReport(
      targetFilePath,
      position.getLineNo(),
      position.getColNo(),
      position.getColNo() + propertyName?.length,
      propertyName,
      message
    );
    let fix: RuleFix | undefined = this.ruleFix(
      propertyDefinition.getStart(),
      propertyDefinition.getStart(),
      fixText
    );
    defect.fixable = true;
    if (type === undefined) {
      fix = undefined;
      defect.fixable = false;
    };
    this.issueMap.set(defect.fixKey, { defect, fix });
  }
}
