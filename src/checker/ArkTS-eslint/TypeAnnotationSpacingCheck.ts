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

interface WhitespaceRule {
    before: boolean;
    after: boolean;
}

interface Options {
    before?: boolean;
    after?: boolean;
    overrides?: {
        colon?: WhitespaceRule;
        arrow?: WhitespaceRule;
    };
}

interface Issue {
    ruleFix: RuleFix;
    line: number;
    column: number;
    message: string;
    filePath: string;
}

export class TypeAnnotationSpacingCheck implements BaseChecker {
    public rule: Rule;
    private options: Options;
    private isUseDefaultOption: boolean = true;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private defaultOptions: Options = {
        before: false,
        after: true,
        overrides: {
            colon: {
                before: false,
                after: true
            },
            arrow: {
                before: true,
                after: true
            }
        }
    };
    private issueMap: Map<string, IssueReport> = new Map();
    constructor() {
        this.options = this.defaultOptions;
    }
    registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchFileCb];
    }
    codeFix?(arkFile: ArkFile, fixKey: string): boolean {
        throw new Error("Method not implemented.");
    }

    public metaData: BaseMetaData = {
        severity: 1,
        ruleDocPath: 'docs/type-annotation-spacing.md',
        description: 'Require consistent spacing around type annotations'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public check = (target: ArkFile) => {
        this.issueMap.clear();
        if (this.rule && this.rule.option && this.rule.option.length > 0) {
            this.options = this.rule.option[0] as Options;
            this.isUseDefaultOption = false;
        } else {
            this.isUseDefaultOption = true;
        }
        if (target instanceof ArkFile) {
            this.checkTypeAnnotationSpacing(target).forEach((issue) => {
                issue.filePath = target.getFilePath();
                this.addIssueReport(issue);
            });
        }
    }

    private checkTypeAnnotationSpacing(arkFile: ArkFile): Issue[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const tempIssues: Issue[] = [];

        const checkNode = (node: ts.Node): void => {
            if (ts.isTypeNode(node) || ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
                this.checkQuestionToken(node, sourceFile, tempIssues, arkFile);
            }

            if (ts.isTypeNode(node)) {
                this.checkTypeAnnotation(node, sourceFile, tempIssues, arkFile);
            }

            ts.forEachChild(node, checkNode);
        };

        checkNode(sourceFile);
        return tempIssues;
    }

    // 检查问号标记
    private checkQuestionToken(
        node: ts.Node,
        sourceFile: ts.SourceFile,
        tempIssues: Issue[],
        arkFile: ArkFile
    ): void {
        const children = node.parent.getChildren(sourceFile);
        const questionColonToken = children.find(child => child.kind === ts.SyntaxKind.QuestionToken);

        //默认option不需要检测三元表达式
        if (!questionColonToken || this.isUseDefaultOption) {
            return;
        }

        const quesTokenStart = questionColonToken.getStart(sourceFile);
        const quesTokenEnd = questionColonToken.getEnd();
        const tokenText = questionColonToken.getText(sourceFile);

        // 查找问号后面的冒号
        const textBetweenInfo = this.findTextBetweenQuestionAndColon(sourceFile, quesTokenStart);
        const textBetweenTokens = textBetweenInfo.text;
        const loopTimes = textBetweenInfo.loopTimes;

        // 检查空格情况
        const spaceInfo = this.checkQuestionSpacing(sourceFile, quesTokenStart, quesTokenEnd, textBetweenTokens, loopTimes);
        const betweenSpace = spaceInfo.betweenSpace;
        const quesBeforeSpace = spaceInfo.beforeSpace;
        const quesAfterSpace = spaceInfo.afterSpace;

        // 应用规则并生成问题报告
        this.generateQuestionTokenIssues(
            tempIssues,
            betweenSpace,
            quesBeforeSpace,
            quesAfterSpace,
            questionColonToken,
            tokenText,
            quesTokenStart,
            quesTokenEnd,
            sourceFile,
            arkFile
        );
    }

    // 查找问号和冒号之间的文本
    private findTextBetweenQuestionAndColon(sourceFile: ts.SourceFile, start: number): { text: string, loopTimes: number } {
        let textBetweenTokens: string = '';
        let cursor = start;
        let loopTimes = 1;

        for (; ;) {
            textBetweenTokens = sourceFile.text.substring(start, cursor++);
            if (textBetweenTokens.includes(':')) {
                break;
            }
            if (loopTimes > 100) {
                break;
            }
            loopTimes++;
        }

        return { text: textBetweenTokens, loopTimes: loopTimes };
    }

    // 检查问号前后的空格
    private checkQuestionSpacing(
        sourceFile: ts.SourceFile,
        start: number,
        end: number,
        textBetween: string,
        loopTimes: number
    ): { betweenSpace: boolean, beforeSpace: boolean, afterSpace: boolean } {
        const betweenSpace = textBetween.includes(' ');
        let beforeSpace: boolean = false;
        let afterSpace: boolean = false;

        if (betweenSpace) {
            const textBeforeToken = sourceFile.text.substring(start - 1, start);
            beforeSpace = textBeforeToken === ' ';
            const textAfterToken = sourceFile.text.substring(start + loopTimes - 1, start + loopTimes);
            afterSpace = textAfterToken === ' ';
        } else {
            const textBeforeToken = sourceFile.text.substring(start - 1, start);
            beforeSpace = textBeforeToken === ' ';
            const textAfterToken = sourceFile.text.substring(end + 1, end + 2);
            afterSpace = textAfterToken === ' ';
        }

        return { betweenSpace, beforeSpace, afterSpace };
    }

    // 生成问号标记相关的问题报告
    private generateQuestionTokenIssues(
        tempIssues: Issue[],
        betweenSpace: boolean,
        beforeSpace: boolean,
        afterSpace: boolean,
        token: ts.Node,
        tokenText: string,
        tokenStart: number,
        tokenEnd: number,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        const tempRule: Required<WhitespaceRule> = {
            before: this.options.overrides?.colon?.before ?? this.options.before ?? false,
            after: this.options.overrides?.colon?.after ?? this.options.after ?? true
        };

        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(tokenStart);

        if (!betweenSpace) {
            // 处理问号前后的空格
            this.handleQuestionMarkSpacing(
                tempIssues,
                tempRule,
                beforeSpace,
                afterSpace,
                token,
                tokenText,
                lineAndChar,
                arkFile
            );
        } else {
            // 处理问号和冒号之间的空格
            this.handleBetweenSpaceIssues(
                tempIssues,
                tempRule,
                beforeSpace,
                afterSpace,
                token.pos,
                token.end,
                tokenStart,
                tokenEnd,
                tokenText,
                lineAndChar,
                arkFile
            );
        }
    }

    // 处理问号前后的空格
    private handleQuestionMarkSpacing(
        tempIssues: Issue[],
        tempRule: WhitespaceRule,
        beforeSpace: boolean,
        afterSpace: boolean,
        token: ts.Node,
        tokenText: string,
        lineAndChar: ts.LineAndCharacter,
        arkFile: ArkFile
    ): void {
        // 处理问号后的空格
        if (afterSpace !== tempRule.after) {
            this.addSpacingIssue(
                tempIssues,
                token.pos + 3,
                token.end + (tempRule.after ? 1 : -1),
                tempRule.after,
                'after',
                tokenText,
                lineAndChar,
                arkFile
            );
        }
        // 处理问号前的空格
        if (beforeSpace !== tempRule.before) {
            this.addSpacingIssue(
                tempIssues,
                token.pos,
                token.end - 1,
                tempRule.before,
                'before',
                tokenText,
                lineAndChar,
                arkFile
            );
        }

    }

    // 添加空格相关的问题
    private addSpacingIssue(
        tempIssues: Issue[],
        pos: number,
        end: number,
        shouldHaveSpace: boolean,
        position: 'before' | 'after',
        tokenText: string,
        lineAndChar: ts.LineAndCharacter,
        arkFile: ArkFile
    ): void {
        const fix: RuleFix = {
            range: [pos, end],
            text: shouldHaveSpace ? ' ' : ''
        };

        tempIssues.push({
            ruleFix: fix,
            line: lineAndChar.line + 1,
            column: lineAndChar.character + (position === 'after' ? 2 : 1),
            message: shouldHaveSpace
                ? `Expected a space ${position} the '${tokenText}'.`
                : `Unexpected space ${position} the '${tokenText}'.`,
            filePath: arkFile.getFilePath() ?? ''
        });
    }

    // 处理问号和冒号之间有空格的情况
    private handleBetweenSpaceIssues(
        tempIssues: Issue[],
        tempRule: WhitespaceRule,
        beforeSpace: boolean,
        afterSpace: boolean,
        pos: number,
        end: number,
        tokenStart: number,
        tokenEnd: number,
        tokenText: string,
        lineAndChar: ts.LineAndCharacter,
        arkFile: ArkFile
    ): void {
        // 处理问号前面的空格问题
        if (beforeSpace !== tempRule.before) {
            const beforeFix: RuleFix = {
                range: [tokenStart - (beforeSpace ? 1 : 0), tokenStart],
                text: tempRule.before ? ' ' : ''
            };

            tempIssues.push({
                ruleFix: beforeFix,
                line: lineAndChar.line + 1,
                column: lineAndChar.character + 1,
                message: tempRule.before
                    ? `Expected a space before the '${tokenText}'.`
                    : `Unexpected space before the '${tokenText}'.`,
                filePath: arkFile.getFilePath() ?? ''
            });
        }

        // 处理问号和冒号之间的空格问题
        const questionColonFix: RuleFix = { range: [tokenStart, tokenEnd], text: '?:' };
        tempIssues.push({
            ruleFix: questionColonFix,
            line: lineAndChar.line + 1,
            column: lineAndChar.character + 3,
            message: `Unexpected space between '?' and ':'.`,
            filePath: arkFile.getFilePath() ?? ''
        });

        // 处理冒号后面的空格问题
        if (afterSpace !== tempRule.after) {
            const afterFix: RuleFix = {
                range: [tokenEnd, tokenEnd + (afterSpace ? 1 : 0)],
                text: tempRule.after ? ' ' : ''
            };

            tempIssues.push({
                ruleFix: afterFix,
                line: lineAndChar.line + 1,
                column: lineAndChar.character + 1,
                message: tempRule.after
                    ? `Expected a space after the '${tokenText}'.`
                    : `Unexpected space after the '${tokenText}'.`,
                filePath: arkFile.getFilePath() ?? ''
            });
        }
    }

    // 检查类型注解前的标记(冒号或箭头)
    private checkTypeAnnotation(
        node: ts.Node,
        sourceFile: ts.SourceFile,
        tempIssues: Issue[],
        arkFile: ArkFile
    ): void {
        // 判断是否已经处理过问号标记
        const children = node.parent.getChildren(sourceFile);
        const questionColonToken = children.find(child => child.kind === ts.SyntaxKind.QuestionToken);

        if (questionColonToken) {
            return;
        }

        // 查找冒号或箭头标记
        const precedingToken = node.parent.getChildren(sourceFile).find(child =>
            child.kind === ts.SyntaxKind.ColonToken ||
            child.kind === ts.SyntaxKind.EqualsGreaterThanToken
        );

        if (!precedingToken) {
            return;
        }

        const tokenStart = precedingToken.getStart(sourceFile);
        const tokenEnd = precedingToken.getEnd();
        const tokenText = precedingToken.getText(sourceFile);
        const isArrow = precedingToken.kind === ts.SyntaxKind.EqualsGreaterThanToken;

        // 检查前后空格
        const textBeforeToken = sourceFile.text.substring(tokenStart - 1, tokenStart);
        const textAfterToken = sourceFile.text.substring(tokenEnd, tokenEnd + 1);
        const beforeSpace = textBeforeToken === ' ';
        const afterSpace = textAfterToken === ' ';

        // 应用规则并生成问题报告
        this.generateTokenIssues(
            tempIssues,
            beforeSpace,
            afterSpace,
            precedingToken,
            tokenStart,
            tokenText,
            isArrow,
            sourceFile,
            arkFile
        );
    }

    // 生成标记相关的问题报告
    private generateTokenIssues(
        tempIssues: Issue[],
        beforeSpace: boolean,
        afterSpace: boolean,
        token: ts.Node,
        tokenStart: number,
        tokenText: string,
        isArrow: boolean,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile
    ): void {
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(tokenStart);
        const effectiveRules = this.getEffectiveRules(isArrow);

        this.checkAndHandleSpacing(tempIssues, token, beforeSpace, afterSpace, effectiveRules, isArrow, lineAndChar, tokenText, arkFile);
    }

    // 检查并处理空格问题
    private checkAndHandleSpacing(
        tempIssues: Issue[],
        token: ts.Node,
        beforeSpace: boolean,
        afterSpace: boolean,
        effectiveRules: WhitespaceRule,
        isArrow: boolean,
        lineAndChar: ts.LineAndCharacter,
        tokenText: string,
        arkFile: ArkFile
    ): void {
        // 处理标记后的空格问题
        if (afterSpace !== effectiveRules.after) {
            this.handleAfterSpacing(
                tempIssues,
                token,
                effectiveRules,
                isArrow,
                lineAndChar,
                tokenText,
                afterSpace,
                arkFile
            );
        }
        // 处理标记前的空格问题
        if (beforeSpace !== effectiveRules.before) {
            this.handleBeforeSpacing(
                tempIssues,
                token,
                effectiveRules,
                isArrow,
                lineAndChar,
                tokenText,
                beforeSpace,
                arkFile
            );
        }
    }

    // 获取适用的规则
    private getEffectiveRules(isArrow: boolean): WhitespaceRule {
        return isArrow
            ? {
                before: this.options.overrides?.arrow?.before ?? this.options.before ?? true,
                after: this.options.overrides?.arrow?.after ?? this.options.after ?? true
            }
            : {
                before: this.options.overrides?.colon?.before ?? this.options.before ?? false,
                after: this.options.overrides?.colon?.after ?? this.options.after ?? true
            };
    }

    // 处理标记前的空格问题
    private handleBeforeSpacing(
        tempIssues: Issue[],
        token: ts.Node,
        effectiveRules: WhitespaceRule,
        isArrow: boolean,
        lineAndChar: ts.LineAndCharacter,
        tokenText: string,
        beforeSpace: boolean,
        arkFile: ArkFile
    ): void {
        // 获取标记的实际开始位置
        let tokenStart = token.getStart();
        
        // 修复范围应该在标记开始位置之前
        const end = tokenStart;
        const pos = beforeSpace ? tokenStart - 1 : tokenStart;
        
        // 创建修复
        const fix = this.createSpacingFix(pos, end, effectiveRules.before);

        // 添加问题报告
        tempIssues.push({
            ruleFix: fix,
            line: lineAndChar.line + 1,
            column: lineAndChar.character + 1,
            message: effectiveRules.before
                ? `Expected a space before the '${tokenText}'.`
                : `Unexpected space before the '${tokenText}'.`,
            filePath: arkFile.getFilePath() ?? ''
        });
    }

    // 处理标记后的空格问题
    private handleAfterSpacing(
        tempIssues: Issue[],
        token: ts.Node,
        effectiveRules: WhitespaceRule,
        isArrow: boolean,
        lineAndChar: ts.LineAndCharacter,
        tokenText: string,
        afterSpace: boolean,
        arkFile: ArkFile
    ): void {
        // 获取标记的实际结束位置
        let tokenEnd = token.getEnd();
        
        // 修复范围应该从标记结束位置开始
        const pos = tokenEnd;
        const end = afterSpace ? tokenEnd + 1 : tokenEnd;
        
        // 创建修复
        const fix = this.createSpacingFix(pos, end, effectiveRules.after);

        // 添加问题报告
        tempIssues.push({
            ruleFix: fix,
            line: lineAndChar.line + 1,
            column: lineAndChar.character + 1,
            message: effectiveRules.after
                ? `Expected a space after the '${tokenText}'.`
                : `Unexpected space after the '${tokenText}'.`,
            filePath: arkFile.getFilePath() ?? ''
        });
    }

    // 创建空格修复
    private createSpacingFix(pos: number, end: number, shouldHaveSpace: boolean): RuleFix {
        return shouldHaveSpace
            ? { range: [pos, end], text: ' ' }
            : { range: [pos, end], text: '' };
    }

    private addIssueReport(issue: Issue) {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defect = new Defects(issue.line, issue.column, issue.column, this.metaData.description, severity,
            this.rule.ruleId, issue.filePath, this.metaData.ruleDocPath, true, false, true);
        RuleListUtil.push(defect);
        const fix: RuleFix = issue.ruleFix;
        let issueReport: IssueReport = { defect, fix };
        this.issues.push(issueReport);
    }
}