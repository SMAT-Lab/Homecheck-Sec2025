/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
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

import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { MatcherCallback, MatcherTypes, FileMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { RuleFix } from '../../model/Fix';

interface Options {
    /** 引号类型："double"(默认)、"single"或"backtick" */
    quoteType?: 'double' | 'single' | 'backtick';
    /** 是否允许在字符串中包含需要转义的引号时使用另一种引号 */
    avoidEscape?: boolean;
    /** 是否允许使用模板字面量 */
    allowTemplateLiterals?: boolean;
};

interface Issue {
    ruleFix: RuleFix;
    line: number;
    column: number;
    message: string;
    filePath: string;
}

export class QuotesCheck implements BaseChecker {
    public rule: Rule;
    private options: Options;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private traversedNodes = new Set<ts.Node>();
    private defaultOptions: Options = {
        quoteType: 'double',
        avoidEscape: false,
        allowTemplateLiterals: false
    };

    // 提取正则表达式为类的成员变量
    private readonly dollarCurlyRegex = /\${/g;
    private readonly backtickRegex = /`/g;
    private readonly escapedBacktickRegex = /\\`/g;
    private readonly doubleQuoteRegex = /"/g;
    private readonly escapedSingleQuoteRegex = /\\'/g;
    private readonly singleQuoteRegex = /'/g;
    private readonly escapedDoubleQuoteRegex = /\\"/g;
    private readonly avoidCheckFolder = 'entry\\src\\test\\';

    public metaData: BaseMetaData = {
        name: 'quotes',
        type: 'Stylistic Issues',
        description: 'Enforce the consistent use of either backticks, double, or single quotes',
        fixable: true,
        severity: 1, // 使用数字类型
        ruleDocPath: 'docs/quotes-check.md' // 添加必需的 ruleDocPath 属性
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE // 添加必需的 matcherType 属性
    };

    constructor() {
        this.options = this.defaultOptions;
    }

    registerMatchers(): MatcherCallback[] {
        return [{ matcher: this.fileMatcher, callback: this.check.bind(this) }];
    }

    check(target: ArkFile): void {
        this.initializeOptions();
        if (target instanceof ArkFile) {
            const regex = new RegExp(`^.*${this.avoidCheckFolder.replace(/\\/g, '\\\\')}.*$`);
            const filePath = target.getFilePath();
            if (regex.test(filePath)) {
                return;
            }
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
            const issues = this.checkQuotes(sourceFile);

            for (const issue of issues) {
                issue.filePath = target.getFilePath();
                this.addIssueReport(issue);
            }
        }
    }

    /**
     * 初始化和解析配置选项
     */
    private initializeOptions(): void {
        if (!this.rule || !this.rule.option || this.rule.option.length === 0) {
            this.options = { quoteType: 'double' };
            return;
        }

        this.parseRuleOptions();
        this.applyOptionSettings();
    }

    /**
     * 解析规则选项
     */
    private parseRuleOptions(): void {
        const firstOption = this.rule.option[0];

        if (typeof firstOption !== 'string') {
            return;
        }

        if (this.isErrorLevel(firstOption)) {
            this.handleErrorLevelOption();
        } else {
            this.handleQuoteTypeOption(firstOption);
        }
    }

    /**
     * 检查是否是错误级别选项
     */
    private isErrorLevel(option: string): boolean {
        return ['error', 'warn', 'off'].includes(option);
    }

    /**
     * 处理错误级别选项
     */
    private handleErrorLevelOption(): void {
        if (this.rule.option.length > 1) {
            const quoteType = this.rule.option[1];

            if (typeof quoteType === 'string') {
                this.setQuoteType(quoteType);

                if (this.rule.option.length > 2 && typeof this.rule.option[2] === 'object') {
                    this.options = this.rule.option[2];
                }
            }
        }
    }

    /**
     * 处理引号类型选项
     */
    private handleQuoteTypeOption(quoteType: string): void {
        this.setQuoteType(quoteType);

        if (this.rule.option.length > 1 && typeof this.rule.option[1] === 'object') {
            this.options = this.rule.option[1];
        }
    }

    /**
     * 设置引号类型
     */
    private setQuoteType(quoteType: string): void {
        if (['double', 'single', 'backtick'].includes(quoteType)) {
            this.options.quoteType = quoteType as 'double' | 'single' | 'backtick';
        }
    }

    /**
     * 应用选项设置
     */
    private applyOptionSettings(): void {
        if (this.options.avoidEscape !== undefined) {
            this.options.avoidEscape = Boolean(this.options.avoidEscape);
        }

        if (this.options.allowTemplateLiterals !== undefined) {
            this.options.allowTemplateLiterals = Boolean(this.options.allowTemplateLiterals);
        }
    }

    private checkQuotes(sourceFile: ts.SourceFile): Issue[] {
        const issues: Issue[] = [];

        // 创建递归遍历函数
        const checkNode = (node: ts.Node): void => {
            // 避免重复检查节点
            if (this.traversedNodes.has(node)) {
                return;
            }
            this.traversedNodes.add(node);

            // 检查字符串字面量
            if (ts.isStringLiteral(node)) {
                this.checkStringLiteral(node, sourceFile, issues);
            }
            // 检查模板字符串
            else if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
                this.checkTemplateLiteral(node, sourceFile, issues);
            }

            // 递归检查子节点
            ts.forEachChild(node, checkNode);
        };

        // 开始遍历
        checkNode(sourceFile);
        return issues;
    }

    private checkStringLiteral(node: ts.StringLiteral, sourceFile: ts.SourceFile, issues: Issue[]): void {
        // 获取字符串的文本和引号类型
        const text = node.getText(sourceFile);
        const rawText = node.text;
        const currentQuoteChar = text.charAt(0);

        // 判断当前引号类型
        const isDoubleQuote = currentQuoteChar === '"';
        const isSingleQuote = currentQuoteChar === "'";

        // 根据选项决定目标引号类型
        const targetQuoteChar = this.options.quoteType === 'single' ? "'" :
            this.options.quoteType === 'backtick' ? '`' : '"';

        // 如果已经是正确的引号类型，不需要处理
        if ((isDoubleQuote && targetQuoteChar === '"') ||
            (isSingleQuote && targetQuoteChar === "'")) {
            return;
        }

        // 检查是否应该排除特定情况
        if (this.options.quoteType === 'backtick' && this.isAllowedAsNonBacktick(node)) {
            return;
        }

        // 正常的 avoidEscape 处理：适用于目标是单引号或双引号的情况
        // 注意：当目标是反引号时，avoidEscape 选项不适用
        if (this.options.avoidEscape && targetQuoteChar !== '`') {
            if ((targetQuoteChar === '"' && rawText.includes('"') && isSingleQuote) ||
                (targetQuoteChar === "'" && rawText.includes("'") && isDoubleQuote)) {
                return;
            }
        }

        // 创建修复
        const fix = this.createQuoteFix(node);
        if (fix) {
            // 获取节点位置信息
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

            // 创建问题报告
            issues.push({
                ruleFix: fix,
                line: line + 1, // 转换为1-indexed
                column: character + 1, // 转换为1-indexed
                message: `Strings must use ${targetQuoteChar === '"' ? 'doublequote' : targetQuoteChar === "'" ? 'singlequote' : 'backtick'}.`,
                filePath: sourceFile.fileName
            });
        }
    }

    private checkTemplateLiteral(node: ts.Node, sourceFile: ts.SourceFile, issues: Issue[]): void {
        // 如果是允许使用模板字面量的，则不报错
        if (this.options.allowTemplateLiterals) {
            return;
        }

        // 检查是否含有表达式插值
        if (ts.isTemplateExpression(node)) {
            // 带有表达式插值的模板字符串总是允许使用反引号
            return;
        }

        // 检查是否是无替换的模板字面量（简单的反引号字符串）
        if (ts.isNoSubstitutionTemplateLiteral(node)) {
            const rawText = node.text;
            // 检查父节点，判断是否是带标签的模板
            const parent = node.parent;
            if (parent && ts.isTaggedTemplateExpression(parent)) {
                return;
            }

            // avoidEscape 检查：如果目标引号在字符串内出现且需要转义，可以使用反引号
            if (this.options.avoidEscape) {
                const targetQuoteChar = this.options.quoteType === 'single' ? "'" : '"';
                // 如果目标引号在字符串中出现，则允许使用反引号避免转义
                if ((targetQuoteChar === '"' && rawText.includes('"')) ||
                    (targetQuoteChar === "'" && rawText.includes("'"))) {
                    return;
                }
            }

            // 创建修复
            const fix = this.createTemplateFix(node, sourceFile);
            if (fix) {
                // 获取节点位置信息
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

                // 创建问题报告
                const targetQuoteChar = this.options.quoteType === 'single' ? "'" : '"';
                issues.push({
                    ruleFix: fix,
                    line: line + 1,
                    column: character + 1,
                    message: `Strings must use ${targetQuoteChar === '"' ? 'doublequote' : 'singlequote'}.`,
                    filePath: sourceFile.fileName
                });
            }
        }
    }

    private isAllowedAsNonBacktick(node: ts.StringLiteral): boolean {
        // 检查父节点类型，判断是否允许使用非反引号
        const parent = node.parent;

        if (!parent) {
            return false;
        }

        // 检查是否为特定类型的节点
        if (
            // 抽象方法定义
            (parent.kind === ts.SyntaxKind.MethodDeclaration && hasModifier(parent, ts.SyntaxKind.AbstractKeyword)) ||
            // 方法签名
            parent.kind === ts.SyntaxKind.MethodSignature ||
            // 属性签名
            parent.kind === ts.SyntaxKind.PropertySignature ||
            // 模块声明
            parent.kind === ts.SyntaxKind.ModuleDeclaration ||
            // 字面量类型
            parent.kind === ts.SyntaxKind.LiteralType ||
            // 外部模块引用
            parent.kind === ts.SyntaxKind.ExternalModuleReference
        ) {
            return true;
        }

        // 检查枚举成员
        if (parent.kind === ts.SyntaxKind.EnumMember) {
            return node === (parent as ts.EnumMember).name;
        }

        // 检查抽象属性定义或普通属性定义
        if (
            (parent.kind === ts.SyntaxKind.PropertyDeclaration && hasModifier(parent, ts.SyntaxKind.AbstractKeyword)) ||
            parent.kind === ts.SyntaxKind.PropertyDeclaration
        ) {
            return node === (parent as ts.PropertyDeclaration).name;
        }

        // 检查对象字面量属性名
        if (parent.kind === ts.SyntaxKind.PropertyAssignment) {
            return node === (parent as ts.PropertyAssignment).name;
        }

        // 检查导入导出语句
        if (
            parent.kind === ts.SyntaxKind.ImportDeclaration ||
            parent.kind === ts.SyntaxKind.ExportDeclaration
        ) {
            return true;
        }

        // 检查指令序言（如"use strict"）
        if (isDirectivePrologue(node)) {
            return true;
        }

        return false;
    }

    private createQuoteFix(node: ts.StringLiteral): RuleFix {
        const rawText = node.text;
        const targetQuoteChar = this.options.quoteType === 'single' ? "'" :
            this.options.quoteType === 'backtick' ? '`' : '"';

        // 处理引号转换
        const newText = this.processQuoteConversion(rawText, targetQuoteChar);

        // 构建新文本
        const fixedText = `${targetQuoteChar}${newText}${targetQuoteChar}`;

        // 创建修复对象
        return {
            range: [node.getStart(), node.getEnd()],
            text: fixedText
        };
    }

    // 处理引号转换
    private processQuoteConversion(text: string, targetQuoteChar: string): string {
        let newText = text;

        if (targetQuoteChar === '`') {
            newText = this.processBacktickConversion(newText);
        } else if (targetQuoteChar === '"') {
            newText = this.escapeDoubleQuotes(newText);
        } else if (targetQuoteChar === "'") {
            newText = this.escapeSingleQuotes(newText);
        }

        return newText;
    }

    // 处理反引号转换
    private processBacktickConversion(text: string): string {
        let newText = text;
        // 转义 ${ 序列以防止被解释为模板表达式
        newText = newText.replace(this.dollarCurlyRegex, '\\${');

        // 如果已有反引号，需要转义它们
        if (newText.includes('`')) {
            newText = newText.replace(this.backtickRegex, '\\`');
        }

        return newText;
    }

    private createTemplateFix(node: ts.Node, sourceFile: ts.SourceFile): RuleFix | null {
        if (!ts.isNoSubstitutionTemplateLiteral(node)) {
            return null;
        }

        const rawText = node.text;
        const targetQuoteChar = this.options.quoteType === 'single' ? "'" : '"';

        // 处理特殊字符
        const newText = this.processTemplateToQuoteConversion(rawText, targetQuoteChar);

        // 构建新文本
        const fixedText = `${targetQuoteChar}${newText}${targetQuoteChar}`;

        // 创建修复对象
        return {
            range: [node.getStart(), node.getEnd()],
            text: fixedText
        };
    }

    // 处理模板字符串到普通引号的转换
    private processTemplateToQuoteConversion(text: string, targetQuoteChar: string): string {
        let newText = text;

        if (targetQuoteChar === '"') {
            // 处理双引号需要转义的情况
            newText = this.escapeDoubleQuotes(newText);
            // 反引号不需要转义
            newText = newText.replace(this.escapedBacktickRegex, '`');
        }
        else if (targetQuoteChar === "'") {
            // 处理单引号需要转义的情况
            newText = this.escapeSingleQuotes(newText);
            // 反引号不需要转义
            newText = newText.replace(this.escapedBacktickRegex, '`');
        }

        // 保留 \n \r \t 等转义序列
        return this.preserveEscapeSequences(newText);
    }

    private addIssueReport(issue: Issue) {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(issue.line, issue.column, issue.column, this.metaData.description, severity,
            this.rule.ruleId, issue.filePath, this.metaData.ruleDocPath, true, false, true);
        RuleListUtil.push(defect);
        const fix: RuleFix = issue.ruleFix;
        let issueReport: IssueReport = { defect, fix };
        this.issues.push(issueReport);
    }

    // 转义双引号
    private escapeDoubleQuotes(str: string): string {
        return str.replace(this.doubleQuoteRegex, '\\"').replace(this.escapedSingleQuoteRegex, "'");
    }

    // 转义单引号
    private escapeSingleQuotes(str: string): string {
        return str.replace(this.singleQuoteRegex, "\\'").replace(this.escapedDoubleQuoteRegex, '"');
    }

    // 保留转义序列
    private preserveEscapeSequences(str: string): string {
        // 这里我们不需要替换转义序列，而是确保它们被保留
        // 所以我们只需要返回原始字符串
        return str;
    }
}

// 检查节点是否有特定修饰符
function hasModifier(node: ts.Node, modifierKind: ts.SyntaxKind): boolean {
    if (!node || !ts.canHaveModifiers(node)) {
        return false;
    }

    const modifiers = ts.getModifiers(node);
    if (!modifiers) {
        return false;
    }

    return modifiers.some(modifier => modifier.kind === modifierKind);
}

// 检查是否为指令序言（如"use strict"）
function isDirectivePrologue(node: ts.StringLiteral): boolean {
    if (!node.parent) {
        return false;
    }

    // 指令序言必须是语句的表达式
    if (node.parent.kind !== ts.SyntaxKind.ExpressionStatement) {
        return false;
    }

    // 获取包含该语句的块或源文件
    let block = node.parent.parent;
    if (!block) {
        return false;
    }

    // 检查该语句是否为块的第一个语句
    if (ts.isBlock(block) || ts.isSourceFile(block)) {
        const statements = block.statements;
        if (!statements || statements.length === 0) {
            return false;
        }

        // 遍历语句，查找指令序言
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            // 如果不是表达式语句，停止搜索
            if (statement.kind !== ts.SyntaxKind.ExpressionStatement) {
                break;
            }

            // 如果是当前节点的父语句，且之前的语句都是指令序言，则当前节点也是指令序言
            if (statement === node.parent) {
                return true;
            }

            // 检查表达式是否为字符串字面量
            const expression = (statement as ts.ExpressionStatement).expression;
            if (expression.kind !== ts.SyntaxKind.StringLiteral) {
                break;
            }
        }
    }

    return false;
}