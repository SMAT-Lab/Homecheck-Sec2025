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
import { ArkFile, AstTreeUtils, ts, ArkClass } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { RuleFix } from '../../model/Fix';
import { Rule } from '../../model/Rule';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { RuleListUtil } from "../../utils/common/DefectsList";
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, "PreferFunctionTypeCheck");
const gMetaData: BaseMetaData = {
  severity: 3,
  ruleDocPath: 'docs/prefer-function-type-check.md',
  description: 'Type literal only has a call signature, you should use a function type instead.',
};
export class PreferFunctionTypeCheck implements BaseChecker {
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
  private filepatch = '';
  public check = (arkFile: ArkFile) => {
    let astRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
    this.filepatch = arkFile.getFilePath();
    for (let child of astRoot.statements) {
      if (ts.isInterfaceDeclaration(child) || (ts.isTypeAliasDeclaration(child) && child.type) || ts.isFunctionDeclaration(child)) {
        this.checkPreferFunctionType(arkFile, child, astRoot);
      };
    };
  };
  private checkPreferFunctionType(arkFile: ArkFile, node: ts.Node, sourceFile: ts.SourceFile): void {
    try {
      if (ts.isInterfaceDeclaration(node)) {
        const { isHasHeritageProperty, isExtendsFunction, isExtendsDefult } = this.checkHeritageClauses(node, arkFile, sourceFile);
        if (isHasHeritageProperty) {
          return;
        };
        this.checkInterfaceOrTypeAlias(arkFile, node, sourceFile, isExtendsFunction, isExtendsDefult);
      } else if (ts.isTypeAliasDeclaration(node)) {
        this.checkTypeAliasDeclaration(node, sourceFile);
      } else if (ts.isFunctionDeclaration(node)) {
        this.checkFunctionOrVariableDeclaration(node, sourceFile);
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`Error processing node: ${error.message}`);
      } else {
        logger.warn('An unknown error occurred while processing node.');
      };
    };
  };
  private checkHeritageClauses(node: ts.InterfaceDeclaration, arkFile: ArkFile, sourceFile: ts.SourceFile): {
    isHasHeritageProperty: boolean, isExtendsFunction: boolean, isExtendsDefult: boolean
  } {
    const hasHeritageClauses = node.heritageClauses;
    let isHasHeritageProperty = false;
    let isExtendsFunction = false;
    let isExtendsDefult = false;
    if (node.modifiers && node.modifiers.length === 2 && node.modifiers[0].kind === ts.SyntaxKind.ExportKeyword) {
      const isDefaultKeyword = node.modifiers[1]?.kind === ts.SyntaxKind.DefaultKeyword;
      if (isDefaultKeyword) {
        isExtendsDefult = true;
        return { isHasHeritageProperty, isExtendsFunction, isExtendsDefult };
      };
    };
    if (!hasHeritageClauses) {
      return { isHasHeritageProperty, isExtendsFunction, isExtendsDefult };
    };
    for (const clause of hasHeritageClauses) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) {
        continue;
      };
      for (const type of clause.types) {
        const typeName = type.expression.getText(sourceFile);
        if (typeName === 'Function') {
          isExtendsFunction = true;
        };
        const aliasCls = arkFile.getClassWithName(typeName) as ArkClass;
        if (!aliasCls) {
          continue;
        };
        const classCode = aliasCls.getCode();
        if (classCode && this.hasPropertySignature(classCode)) {
          isHasHeritageProperty = true;
          break;
        };
      };
      if (isHasHeritageProperty) {
        break;
      };
    };
    return { isHasHeritageProperty, isExtendsFunction, isExtendsDefult };
  };
  private hasPropertySignature(code: string): boolean {
    const sourceFile = AstTreeUtils.getASTNode('PreferFunctionTypeCheck.ts', code);
    for (const statement of sourceFile.statements) {
      if (this.isInterfaceOrClass(statement)) {
        return this.hasPropertyInMembers(statement.members);
      };
    };
    return false;
  };
  private isInterfaceOrClass(statement: ts.Node): statement is ts.InterfaceDeclaration | ts.ClassDeclaration {
    return ts.isInterfaceDeclaration(statement) || ts.isClassDeclaration(statement);
  };
  private hasPropertyInMembers(members: ts.NodeArray<ts.ClassElement | ts.TypeElement>): boolean {
    for (const member of members) {
      if (ts.isPropertySignature(member)) {
        return true;
      };
    };
    return false;
  };
  private checkInterfaceOrTypeAlias(arkFile: ArkFile, node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile, isExtendsFunction: boolean, isExtendsDefult: boolean): void {
    const name = node.name?.getText(sourceFile);
    if (!name) {
      return;
    };
    const { callSignatures, constructSignatures, usesThisType, hasOnlyCallSignature, hasOnlyConstructSignature } = this.processNodeMembers(node, sourceFile);
    if (callSignatures.length > 1 || constructSignatures.length > 1) {
      return;
    };
    if (hasOnlyCallSignature && callSignatures.length > 0) {
      this.handleSingleCallSignature(node, sourceFile, isExtendsFunction, isExtendsDefult, callSignatures, usesThisType, name);
    } else if (hasOnlyConstructSignature && constructSignatures.length > 0) {
      this.handleSingleConstructSignature(node, sourceFile, constructSignatures, name);
    };
  };
  private processNodeMembers(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration, sourceFile: ts.SourceFile): {
    callSignatures: ts.CallSignatureDeclaration[];
    constructSignatures: ts.ConstructSignatureDeclaration[];
    usesThisType: boolean;
    hasOnlyCallSignature: boolean;
    hasOnlyConstructSignature: boolean;
  } {
    let callSignatures: ts.CallSignatureDeclaration[] = [];
    let constructSignatures: ts.ConstructSignatureDeclaration[] = [];
    let usesThisType = false;
    let hasOnlyCallSignature = true;
    let hasOnlyConstructSignature = true;
    const members = ts.isInterfaceDeclaration(node)
      ? node.members
      : ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)
        ? node.type.members
        : [];
    for (const member of members) {
      [callSignatures, constructSignatures, usesThisType, hasOnlyCallSignature, hasOnlyConstructSignature] =
        this.processMember(member, sourceFile, callSignatures, constructSignatures, usesThisType, hasOnlyCallSignature, hasOnlyConstructSignature);
    };
    return { callSignatures, constructSignatures, usesThisType, hasOnlyCallSignature, hasOnlyConstructSignature };
  };
  private processMember(
    member: ts.Node,
    sourceFile: ts.SourceFile,
    callSignatures: ts.CallSignatureDeclaration[],
    constructSignatures: ts.ConstructSignatureDeclaration[],
    usesThisType: boolean,
    hasOnlyCallSignature: boolean,
    hasOnlyConstructSignature: boolean
  ): [
      ts.CallSignatureDeclaration[],
      ts.ConstructSignatureDeclaration[],
      boolean,
      boolean,
      boolean
    ] {
    if (ts.isCallSignatureDeclaration(member)) {
      callSignatures.push(member);
      usesThisType = this.CheckUsesThisType(member);
      hasOnlyConstructSignature = false;
    } else if (ts.isConstructSignatureDeclaration(member)) {
      constructSignatures.push(member);
      hasOnlyCallSignature = false;
    } else if (
      ts.isPropertySignature(member) ||
      ts.isIndexSignatureDeclaration(member) ||
      ts.isMethodSignature(member) ||
      ts.isGetAccessor(member) ||
      ts.isSetAccessor(member)
    ) {
      hasOnlyCallSignature = false;
      hasOnlyConstructSignature = false;
    };
    return [callSignatures, constructSignatures, usesThisType, hasOnlyCallSignature, hasOnlyConstructSignature];
  };
  private escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  private checkTypeAliasDeclaration(node: ts.TypeAliasDeclaration, sourceFile: ts.SourceFile): void {
    const processTypes = (types: ts.NodeArray<ts.TypeNode>): void => {
      types.forEach(type => {
        if (ts.isTypeLiteralNode(type)) {
          this.reportTypeLiteral(node, type, sourceFile, true);
        }
      });
    };
    if (ts.isIntersectionTypeNode(node.type)) {
      processTypes(node.type.types);
    } else if (ts.isUnionTypeNode(node.type)) {
      processTypes(node.type.types);
    } else if (ts.isTypeLiteralNode(node.type)) {
      let hasOnlyCallSignature = true;
      let callSignatures: ts.CallSignatureDeclaration[] = [];
      let usesThisType = false;
      ts.forEachChild(node.type, (child) => {
        if (ts.isCallSignatureDeclaration(child)) {
          callSignatures.push(child);
          usesThisType = this.CheckUsesThisType(child);
        } else if (ts.isPropertySignature(child) || ts.isConstructSignatureDeclaration(child) ||
          ts.isIndexSignatureDeclaration(child) || ts.isMethodSignature(child)) {
          hasOnlyCallSignature = false;
        };
      });
      if (callSignatures.length > 1) { return; }
      if (hasOnlyCallSignature && callSignatures.length > 0) {
        const callSignature = callSignatures[0];
        const { fixKeyword, errMesaging } = this.extractCallSignatureInfo(callSignature, node, sourceFile);
        let defect = this.createDefect(callSignature, callSignature.getText(), usesThisType ? errMesaging : this.metaData.description, usesThisType);
        let isAllNode = node.getText().replace(callSignature.parent.getText(), fixKeyword);
        if (isAllNode.match(/;[\s]*;/)) {
          isAllNode = isAllNode.replace(/;[\s]*;$/, ';');
        }
        let ruleFix = this.createFix(node, isAllNode);
        if (usesThisType) {
          this.issues.push(new IssueReport(defect, undefined));
        } else {
          this.issues.push(new IssueReport(defect, ruleFix));
        };
      };
    };
  };
  private handleSingleCallSignature(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration, sourceFile: ts.SourceFile,
    isExtendsFunction: boolean, isExtendsDefult: boolean, callSignatures: ts.CallSignatureDeclaration[], usesThisType: boolean, name: string): void {
    const callSignature = callSignatures[0];
    const interfaceName = node.name?.getText();
    const returnTypeText = (callSignature?.getText() || 'void');
    const result = returnTypeText.replace(/(\(\s*[^)]*\s*\))\s*:/g, '$1 =>');
    const isExported = node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
    const exportKeyword = isExported ? 'export ' : '';
    // 获取泛型参数
    const typeParameters = ts.isInterfaceDeclaration(node) && node.typeParameters
      ? `<${node.typeParameters.map(param => param.getText()).join(', ')}>`
      : '';
    let suggestion = `${exportKeyword}type ${interfaceName}${typeParameters} = ${result}`;
    // 处理注释
    const comments = ts.getLeadingCommentRanges(sourceFile.text, callSignature.pos) || [];
    comments.forEach(comment => {
      const commentText = sourceFile.text.slice(comment.pos, comment.end);
      suggestion = `${commentText}\n${suggestion}`;
    });

    const fixKeyword = suggestion;
    let errMesaging = 'Interface only has a call signature, you should use a function type instead.';
    let isThis = false;
    if (usesThisType || callSignature.type?.getText() === 'this') {
      errMesaging = `\`this\` refers to the function type '${name}', did you intend to use a generic \`this\` parameter like \`<Self>(this: Self, ...) => Self\` instead?`;
      isThis = true;
    };
    if (isExtendsDefult) {
      usesThisType = true;
    };
    let defect = this.createDefect(callSignature, callSignature.getText(), errMesaging, isThis);
    let ruleFix = this.createFix(node, fixKeyword);
    if (usesThisType) {
      this.issues.push(new IssueReport(defect, undefined));
    } else {
      this.issues.push(new IssueReport(defect, ruleFix));
    };
  };
  private extractCallSignatureInfo(callSignature: ts.CallSignatureDeclaration, node: ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile): { fixKeyword: string; errMesaging: string } {
    const callSignatureParent = callSignature.parent.getText();
    const modifiedString = callSignatureParent.replace(/\{/, '').replace(/\}$/, '');
    const returnTypeText = (callSignature.type?.getText(sourceFile) || 'void');
    const parametersText = modifiedString.replace(
      new RegExp(`: ${this.escapeRegExp(returnTypeText)}`, 'g'),
      `=> ${returnTypeText}`
    );
    let fixKeyword = parametersText;
    fixKeyword = fixKeyword.replace(/\n/g, '');
    const errMesaging = `\`this\` refers to the function type '${node.name.getText()}', did you intend to use a generic \`this\` parameter like \`<Self>(this: Self, ...) => Self\` instead?`;
    return { fixKeyword, errMesaging };
  };
  private checkFunctionOrVariableDeclaration(node: ts.FunctionDeclaration | ts.VariableDeclaration, sourceFile: ts.SourceFile): void {
    if (ts.isFunctionDeclaration(node)) {
      node.parameters.forEach(param => this.checkParameterType(param, sourceFile));
    } else if (ts.isVariableDeclaration(node)) {
      this.checkParameterType(node, sourceFile);
    };
  };
  private checkParameterType(node: ts.ParameterDeclaration | ts.VariableDeclaration, sourceFile: ts.SourceFile): void {
    const type = node.type;
    if (type) {
      if (ts.isTypeLiteralNode(type)) {
        this.reportTypeLiteral(node, type, sourceFile, false);
      } else if (ts.isUnionTypeNode(type)) {
        type.types.forEach(unionType => {
          if (ts.isTypeLiteralNode(unionType)) {
            this.reportTypeLiteral(node, unionType, sourceFile, true);
          };
        });
      };
    };
  };
  private CheckUsesThisType(member: ts.CallSignatureDeclaration): boolean {
    let usesThisType = false;
    usesThisType = member.parameters.some(param => {
      return param.type !== undefined && ts.isThisTypeNode(param.type);
    });
    if (!usesThisType && member.type && ts.isTypeNode(member.type)) {
      if (ts.isUnionTypeNode(member.type)) {
        usesThisType = member.type.types.some(type => ts.isThisTypeNode(type));
      } else if (ts.isTypeReferenceNode(member.type) && member.type.typeName.getText() === 'this') {
        usesThisType = true;
      };
    };
    return usesThisType;
  };
  private reportTypeLiteral(node: ts.Node, type: ts.TypeLiteralNode, sourceFile: ts.SourceFile, isUnionType: boolean): void {
    let name: string | undefined;
    if (ts.isTypeAliasDeclaration(node)) {
      name = node.name.getText(sourceFile);
    };
    let hasOnlyCallSignature = true;
    let callSignatures: ts.CallSignatureDeclaration[] = [];
    let usesThisType = false;
    ts.forEachChild(type, (child) => {
      if (ts.isCallSignatureDeclaration(child)) {
        callSignatures.push(child);
        usesThisType = this.CheckUsesThisType(child);
      } else if (ts.isPropertySignature(child) || ts.isConstructSignatureDeclaration(child) ||
        ts.isIndexSignatureDeclaration(child) || ts.isMethodSignature(child)) {
        hasOnlyCallSignature = false;
      };
    });
    if (callSignatures.length > 1) { return; }
    if (hasOnlyCallSignature && callSignatures.length > 0) {
      const errMesaging = `\`this\` refers to the function type '${name}', did you intend to use a generic \`this\` parameter like \`<Self>(this: Self, ...) => Self\` instead?`;
      const callSignature = callSignatures[0];
      const callSignatureParent = callSignature.parent.getText();
      const modifiedString = callSignatureParent.replace(/[{}]/g, '');
      const returnTypeText = (callSignature.type?.getText(sourceFile) || 'void')
      let parametersText = modifiedString.replace(
        new RegExp(`: ${this.escapeRegExp(returnTypeText)}`, "g"),
        `=> ${returnTypeText}`
      );
      if (isUnionType) {
        parametersText = parametersText.replace(/\(([^)]*)\)\s*=>\s*(\w+)/, "(($1) => $2)");
      };
      const fixKeyword = parametersText;
      let defect = this.createDefect(callSignature, callSignature.getText(), usesThisType ? errMesaging : this.metaData.description, usesThisType);
      let isAllNode = node.getText().replace(callSignatureParent, fixKeyword);
      if (isAllNode.match(/;[\s]*;/)) {
        isAllNode = isAllNode.replace(/;[\s]*;$/, ';');
      };
      let ruleFix = this.createFix(node, isAllNode);
      if (usesThisType) {
        this.issues.push(new IssueReport(defect, undefined));
      } else {
        this.issues.push(new IssueReport(defect, ruleFix));
      };
    };
  };
  private createDefect(node: ts.Node, keyword: string, errMesaging: string, isThis: boolean): Defects {
    const warnInfo = this.getLineAndColumn(node, isThis);
    const filePath = warnInfo.filePath;
    let lineNum = warnInfo.line;
    let startColum = warnInfo.startCol;
    let endColumn = warnInfo.endCol;
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(lineNum, startColum, endColumn, errMesaging, severity,
      this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, !isThis);
    this.defects.push(defect);
    RuleListUtil.push(defect);
    return defect;
  };
  private getLineAndColumn(node: ts.Node, isThis: boolean): { line: number; startCol: number; endCol: number; filePath: string } {
    const sourceFile = node.getSourceFile();
    let startIndex = 0;
    if (isThis) {
      startIndex = node.getText().indexOf('this')
    };
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const endCharacter = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).character;
    return {
      line: line + 1,
      startCol: character + 1 + startIndex,
      endCol: endCharacter + 1,
      filePath: this.filepatch
    };
  };
  private createFix(child: ts.Node, code: string): RuleFix {
    return { range: [child.getStart(), child.getEnd()], text: code };
  };
  private handleSingleConstructSignature(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration, sourceFile: ts.SourceFile,
    constructSignatures: ts.ConstructSignatureDeclaration[], name: string): void {
    const constructSignature = constructSignatures[0];
    const errMessage = 'Interface only has a call signature, you should use a function type instead.';
    const fixKeyword = this.generateFixKeyword(constructSignature, node, sourceFile);
    let defect = this.createDefect(constructSignature, constructSignature.getText(), errMessage, false);
    let ruleFix = this.createFix(node, fixKeyword);
    this.issues.push(new IssueReport(defect, ruleFix));
  };
  private generateFixKeyword(
    constructSignature: ts.ConstructSignatureDeclaration,
    node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile
  ): string {
    const callSignatureParent = constructSignature.parent.getText();
    const interfaceName = node.name?.getText();
    let modifiedString = callSignatureParent.replace('interface', 'type');
    const returnTypeText = constructSignature.type?.getText(sourceFile) || 'void';
    const regex1 = new RegExp(`\\b${interfaceName}\\s*(<[^>]*>)?\\s*\\{`, 'g');
    modifiedString = modifiedString.replace(regex1, `${interfaceName}$1 =`);
    modifiedString = modifiedString.replace(/\}+$/, '');
    const index = modifiedString.indexOf(constructSignature.getText());
    if (index !== -1) {
      modifiedString = modifiedString.substring(0, index).replace(/\r\n\s*$/, '') + constructSignature.getText() + modifiedString.substring(index + constructSignature.getText().length);
    };
    let parametersText = modifiedString.replace(
      new RegExp(`: ${this.escapeRegExp(returnTypeText)}`, 'g'),
      `=> ${returnTypeText}`
    );
    const comments = ts.getLeadingCommentRanges(sourceFile.text, constructSignature.pos) || [];
    if (comments.length > 0) {
      const commentText = comments.map(comment => sourceFile.text.slice(comment.pos, comment.end)).join('\n');
      parametersText = `${commentText}\n${parametersText}`;
    };
    return parametersText;
  };
};