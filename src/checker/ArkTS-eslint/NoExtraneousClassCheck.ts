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

import { ArkFile, ts, AstTreeUtils } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, FileMatcher, MatcherTypes, MatcherCallback } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-extraneous-class.md',
    description: 'Disallow classes used as namespaces'
};
type Options = {
    /** 是否允许只包含构造函数的类 */
    allowConstructorOnly?: boolean;
    /** 是否允许空类 */
    allowEmpty?: boolean;
    /** 是否允许只包含静态成员的类 */
    allowStaticOnly?: boolean;
    /** 是否允许带装饰器的类 */
    allowWithDecorator?: boolean;
};
type MessageIds = 'empty' | 'onlyConstructor' | 'onlyStatic';
const messages: Record<MessageIds, string> = {
    empty: 'Unexpected empty class.',
    onlyConstructor: 'Unexpected class with only a constructor.',
    onlyStatic: 'Unexpected class with only static properties.'
};
export class NoExtraneousClassCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private defaultOptions: Options = {
        allowConstructorOnly: false,
        allowEmpty: false,
        allowStaticOnly: false,
        allowWithDecorator: false
    };
    private options: Options = { ...this.defaultOptions };
    private buildMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };
    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check.bind(this)
        };
        return [matchBuildCb];
    };
    public check = (arkFile: ArkFile): void => {
        this.parseOptions();
        const astRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        this.visitNode(astRoot, arkFile);
    };
    /** 递归遍历AST节点，查找所有类声明和类表达式*/
    private visitNode(node: ts.Node, arkFile: ArkFile): void {
        try {
            // 检查类声明
            if (ts.isClassDeclaration(node)) {
                this.checkClass(node, arkFile);
            }
            // 检查类表达式
            else if (ts.isClassExpression(node)) {
                this.checkClass(node, arkFile);
            }
            // 递归检查所有子节点
            ts.forEachChild(node, childNode => this.visitNode(childNode, arkFile));
        } catch (error) {
        }
    }
    private parseOptions(): void {
        if (this.rule?.option?.[0]) {
            const ruleOption = this.rule.option[0] as Options;
            this.options = {
                allowConstructorOnly: ruleOption.allowConstructorOnly ?? this.defaultOptions.allowConstructorOnly,
                allowEmpty: ruleOption.allowEmpty ?? this.defaultOptions.allowEmpty,
                allowStaticOnly: ruleOption.allowStaticOnly ?? this.defaultOptions.allowStaticOnly,
                allowWithDecorator: ruleOption.allowWithDecorator ?? this.defaultOptions.allowWithDecorator
            };
        };
    };
    /** 检查类是否符合规则*/
    private checkClass(node: ts.ClassDeclaration | ts.ClassExpression, arkFile: ArkFile): void {
        try {
            if (this.hasSuperClass(node) || (this.hasDecorators(node) && this.options.allowWithDecorator)) {
                return;
            };
            const members = node.members;
            if (this.options.allowConstructorOnly && this.areAllMembersConstructors(members)) {
                return;
            };
            if ((members.length === 0 || this.isEffectivelyEmpty(members))) {
                if (this.options.allowEmpty) {
                    return;
                } else {
                    this.report(node, 'empty', arkFile);
                    return;
                };
            };
            const { onlyConstructor, onlyStatic } = this.analyzeMembers(members);
            if (onlyConstructor && !this.options.allowConstructorOnly) {
                this.report(node, 'onlyConstructor', arkFile);
                return;
            };
            if (onlyStatic && !this.options.allowStaticOnly) {
                this.report(node, 'onlyStatic', arkFile);
            };
        } catch (error) { }
    };

    private analyzeMembers(members: ts.NodeArray<ts.ClassElement>): { onlyConstructor: boolean, onlyStatic: boolean } {
        let onlyConstructor = true;
        let onlyStatic = true;
        let hasNonStaticNonConstructorMember = false;
        for (const member of members) {
            if (this.isEmptyMember(member)) {
                continue;
            }
            if (this.isStaticBlock(member)) {
                onlyConstructor = false;
                continue;
            };
            if (ts.isConstructorDeclaration(member)) {
                if (this.hasParameterProperties(member)) {
                    onlyConstructor = false;
                    onlyStatic = false;
                    hasNonStaticNonConstructorMember = true;
                };
            } else {
                onlyConstructor = false;
                if (!this.isStaticMember(member)) {
                    onlyStatic = false;
                    hasNonStaticNonConstructorMember = true;
                };
            };
            if (hasNonStaticNonConstructorMember) {
                break;
            }
        };
        return { onlyConstructor, onlyStatic: onlyStatic || (!hasNonStaticNonConstructorMember && members.some(m => this.isStaticBlock(m))) };
    };
    /**检查节点是否有继承关系*/
    private hasSuperClass(node: ts.ClassDeclaration | ts.ClassExpression): boolean {
        return !!node.heritageClauses?.some(clause =>
            clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0
        );
    };
    /***检查节点是否有装饰器*/
    private hasDecorators(node: ts.Node): boolean {
        const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
        return !!decorators && decorators.length > 0;
    }
    /** 检查构造函数是否有参数属性*/
    private hasParameterProperties(constructor: ts.ConstructorDeclaration): boolean {
        return constructor.parameters.some(param => {
            const modifiers = ts.getModifiers(param);
            return !!modifiers?.some(mod =>
                mod.kind === ts.SyntaxKind.PrivateKeyword ||
                mod.kind === ts.SyntaxKind.ProtectedKeyword ||
                mod.kind === ts.SyntaxKind.PublicKeyword ||
                mod.kind === ts.SyntaxKind.ReadonlyKeyword
            );
        });
    };
    /** 检查成员是否是静态成员*/
    private isStaticMember(member: ts.ClassElement): boolean {
        // 检查静态代码块 (static { ... })
        if (typeof ts.isClassStaticBlockDeclaration === 'function' && ts.isClassStaticBlockDeclaration(member)) {
            return true;
        }
        // 尝试通过类型判断检测静态块
        if (member.kind === ts.SyntaxKind.ClassStaticBlockDeclaration) {
            return true;
        }
        // 检查其他常规静态成员
        if (!ts.canHaveModifiers(member)) {
            return false;
        }
        const modifiers = ts.getModifiers(member);
        return !!modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
    };
    /** 检查节点是否是静态代码块*/
    private isStaticBlock(node: ts.Node): boolean {
        try {
            if (typeof ts.isClassStaticBlockDeclaration === 'function' && ts.isClassStaticBlockDeclaration(node)) {
                return true;
            };
            if ('ClassStaticBlockDeclaration' in ts.SyntaxKind && node.kind === (ts.SyntaxKind as any).ClassStaticBlockDeclaration) {
                return true;
            };
            const nodeText = node.getText?.()?.trim();
            if (nodeText && this.isStatusClass(nodeText)) {
                return true;
            };
            const parent = node.parent;
            if (parent && (ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) &&
                'body' in node && ts.isBlock((node as any).body) && !('name' in node) && !('parameters' in node)) {
                const modifiers = (node as any).modifiers;
                if (Array.isArray(modifiers) && modifiers.some((m: any) => m.kind === ts.SyntaxKind.StaticKeyword)) {
                    return true;
                };
            };
            return false;
        } catch (error) {
            return false;
        };
    };
    private isStaticRegular = /^static\s*\{/;

    private isStatusClass(nodeText: string): boolean {
        const isStatic = this.isStaticRegular.test(nodeText);
        return isStatic;
    };
    /** 检查类成员是否为空（只有分号或注释）对比codelinter空class里面有一个分号可以检测出来*/
    private isEmptyMember(member: ts.ClassElement): boolean {
        if (member.kind === ts.SyntaxKind.SemicolonClassElement) {
            return true;
        };
        const text = member.getText();
        const strippedText = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').trim();
        return strippedText === '' || strippedText === ';';
    };
    /**检查类是否实际上是空的（只包含分号或注释）对比codelinter空class里面有一个分号可以检测出来 */
    private isEffectivelyEmpty(members: ts.NodeArray<ts.ClassElement>): boolean {
        return members.every(member => this.isEmptyMember(member));
    };
    private report(node: ts.ClassDeclaration | ts.ClassExpression, messageId: MessageIds, arkFile: ArkFile): void {
        let reportNode = node.name || node;
        const severity = this.rule.alert ?? this.metaData.severity;
        try {
            // 处理默认导出类 (export default class {})
            if (ts.isClassDeclaration(node)) {
                // 先检查是否是export default形式
                const isDefaultExport = this.isExportDefaultClass(node);
                // 尝试定位class关键字位置
                const classKeywordInfo = this.findClassKeywordPosition(node);
                if (isDefaultExport && classKeywordInfo) {
                    const location = this.getNodeLocationWithCustomPosition(
                        node,
                        classKeywordInfo.start,
                        classKeywordInfo.end,
                        arkFile
                    );
                    const defect = new Defects(
                        location.line,
                        location.startCol,
                        location.endCol,
                        messages[messageId],
                        severity,
                        this.rule.ruleId,
                        location.filePath,
                        this.metaData.ruleDocPath,
                        true, false, false, false
                    );
                    this.issues.push(new IssueReport(defect, undefined));
                    RuleListUtil.push(defect);
                    return;
                };
            };
        } catch (error) {
        };
        const location = this.getNodeLocation(reportNode, arkFile);
        const defect = new Defects(
            location.line,
            location.startCol,
            location.endCol,
            messages[messageId],
            severity,
            this.rule.ruleId,
            location.filePath,
            this.metaData.ruleDocPath,
            true, false, false, false
        );
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };
    /** 检查类是否是export default class*/
    private isExportClassRegular = /^\s*export\s+default\s+class\b/;

    private isExportDefaultClass(node: ts.ClassDeclaration): boolean {
        try {
            if (!node.parent) {
                return false;
            };
            if (ts.isExportAssignment(node.parent)) {
                return node.pos === node.parent.expression.pos &&
                    node.end === node.parent.expression.end;
            };
            if (node.modifiers) {
                const hasExport = node.modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
                const hasDefault = node.modifiers.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword);

                if (hasExport && hasDefault) {
                    return true;
                };
            };
            const nodeText = node.getText();
            if (this.isExportClassRegular.test(nodeText)) {
                return true;
            };
            if (node.parent && ts.isVariableDeclaration(node.parent) && this.isValidVariableStatement(node.parent)) {
                const variableDecl = node.parent;
                const varStatement = variableDecl.parent.parent;
                if (varStatement.modifiers) {
                    const hasExport = varStatement.modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
                    const hasDefault = varStatement.modifiers.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword);
                    return hasExport && hasDefault;
                };
            };
        } catch (error) {
        };
        return false;
    };
    private isValidVariableStatement(variableDecl: ts.VariableDeclaration): boolean {
        return variableDecl.parent &&
            ts.isVariableDeclarationList(variableDecl.parent) &&
            variableDecl.parent.parent &&
            ts.isVariableStatement(variableDecl.parent.parent);
    };
    /** 找到class关键字在节点中的位置*/
    private findClassKeywordPosition(node: ts.ClassDeclaration): { start: number, end: number } | undefined {
        try {
            // 获取原始文本
            const sourceFile = node.getSourceFile();
            const nodeStart = node.getStart();
            const nodeEnd = node.getEnd();
            const nodeText = sourceFile.text.substring(nodeStart, nodeEnd);
            const classMatch = /\bclass\b/.exec(nodeText);
            if (classMatch && classMatch.index !== -1) {
                const classKeywordStart = nodeStart + classMatch.index;
                const classKeywordEnd = classKeywordStart + 'class'.length;
                return {
                    start: classKeywordStart,
                    end: classKeywordEnd
                };
            };
            const classKeywordIndex = nodeText.indexOf('class');
            if (classKeywordIndex !== -1) {
                const classKeywordStart = nodeStart + classKeywordIndex;
                const classKeywordEnd = classKeywordStart + 'class'.length;

                return {
                    start: classKeywordStart,
                    end: classKeywordEnd
                };
            };
        } catch (error) {
        };
        return undefined;
    };
    private getNodeLocationWithCustomPosition(
        node: ts.Node,
        customStart: number,
        customEnd: number,
        arkFile: ArkFile
    ): { line: number, startCol: number, endCol: number, filePath: string } {
        const sourceFile = node.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(customStart);
        const endPosition = sourceFile.getLineAndCharacterOfPosition(customEnd);
        return {
            line: line + 1,
            startCol: character + 1,
            endCol: endPosition.character + 1,
            filePath: arkFile.getFilePath()
        };
    };
    private getNodeLocation(node: ts.Node, arkFile: ArkFile): { line: number, startCol: number, endCol: number, filePath: string } {
        const sourceFile = node.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const endCharacter = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).character;
        return {
            line: line + 1,
            startCol: character + 1,
            endCol: endCharacter + 1,
            filePath: arkFile.getFilePath()
        };
    };

    private areAllMembersConstructors(members: ts.NodeArray<ts.ClassElement>): boolean {
        const nonEmptyMembers = members.filter(member => !this.isEmptyMember(member));
        if (nonEmptyMembers.length === 0) {
            return false;
        };
        const allConstructors = nonEmptyMembers.every(member => ts.isConstructorDeclaration(member));
        return allConstructors;
    };
};