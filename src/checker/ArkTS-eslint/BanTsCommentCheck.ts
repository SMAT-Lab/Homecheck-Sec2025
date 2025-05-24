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
import { ArkFile, ts, AstTreeUtils } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'BanTsCommentCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/ban-ts-comment.md",
    description: "Disallow `@ts-<directive>` comments or require descriptions after directives.",
};

type DirectiveConfig =
    | boolean
    | 'allow-with-description'
    | { descriptionFormat: string };

interface Options {
    'minimumDescriptionLength'?: number;
    'ts-check'?: DirectiveConfig;
    'ts-expect-error'?: DirectiveConfig;
    'ts-ignore'?: DirectiveConfig;
    'ts-nocheck'?: DirectiveConfig;
}

interface CommentInfo {
    fileName: string;
    line: number;
    character: number;
    comment: string;
    description: string;
}

export class BanTsCommentCheck implements BaseChecker {

    private defaultOptions: Options = {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': true,
        'ts-nocheck': true,
        'ts-check': false,
        minimumDescriptionLength: 3,
    };

    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public descriptionLength: number = 3;

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatcherCb];
    }

    public check = (target: ArkFile) => {
        if (target instanceof ArkFile) {
            const code = target.getCode();
            if (!code) {
                return;
            }
            const filePath = target.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);

            // 提取注释
            const comments = this.extractComments(sourceFile);

            // 输出结果
            comments.forEach(comment => {
                this.addIssueReportNode(comment, filePath)
            });
        }
    }

    private extractComments(sourceFile: ts.SourceFile): CommentInfo[] {
        const comments: CommentInfo[] = [];

        const visit = (node: ts.Node) => {
            const leadingComments = ts.getLeadingCommentRanges(sourceFile.getFullText(), node.pos);

            if (leadingComments) {
                this.checkComments(sourceFile, leadingComments, comments);
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return comments;
    }

    private checkComments(sourceFile: ts.SourceFile, leadingComments: ts.CommentRange[], comments: CommentInfo[]): CommentInfo[] {
        let description;
        for (const comment of leadingComments) {
            let isPass: boolean = true;
            const commentText = sourceFile.getFullText().substring(comment.pos, comment.end).trim();

            if (commentText.includes('@ts-expect-error')) {
                isPass = this.checkOption(commentText, 'ts-expect-error');
                if (this.checkExpectError('ts-expect-error')) {
                    description = 'Do not use "@ts-expect-error" because it alters compilation errors.';
                } else {
                    description = `Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary.The description must be ${this.descriptionLength} characters or longer.`;
                }
                const formatMessage = this.checkDescriptionFormat(commentText, 'ts-expect-error');
                if (formatMessage) {
                    description = formatMessage;
                }
            }
            if (commentText.includes('@ts-ignore')) {
                isPass = this.checkOption(commentText, 'ts-ignore');
                description = `Use "@ts-expect-error" instead of "@ts-ignore", as "@ts-ignore" will do nothing if the following line is error-free.`;
            }
            if (commentText.includes('@ts-nocheck')) {
                isPass = this.checkOption(commentText, 'ts-nocheck');
                description = `Do not use "@ts-nocheck" because it alters compilation errors.`;
            }
            if (commentText.includes('@ts-check')) {
                isPass = this.checkOption(commentText, 'ts-check');
                description = `Do not use "@ts-check" because it alters compilation errors.`;
            }

            if (!isPass) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(comment.pos);
                comments.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    character: character + 1,
                    comment: commentText,
                    description: description || ''
                });
            }
        }
        return comments;
    }

    private checkExpectError(option: keyof Options): boolean {
        const options = this.rule && this.rule.option[0] ? this.rule.option[0] as Options : this.defaultOptions;
        let directiveConfig;
        if (typeof options === 'object' && options !== null && option in options) {
            directiveConfig = options[option];
        }
        if (directiveConfig === true) {
            return true;
        }
        return false;
    }

    private checkOption(commentText: string, option: keyof Options): boolean {
        let isPass: boolean = false;
        const options = this.rule && this.rule.option[0] ? this.rule.option[0] as Options : this.defaultOptions;
        this.descriptionLength = options.minimumDescriptionLength ?? 3;
        let directiveConfig;
        // 提取配置中的实际规则值
        if (typeof options === 'object' && options !== null && option in options) {
            directiveConfig = options[option];
        }
        if (directiveConfig === false) {
            isPass = true;
        } else if (directiveConfig === 'allow-with-description') {
            // 使用模板字符串动态生成正则表达式
            const directiveRegex = new RegExp(`@${option}\\s*(.+)`);
            const match = commentText.match(directiveRegex);
            if (match) {
                const fullMatch = match[0];
                const description = match[1].trim();

                // 获取 fullMatch 和 description 的起始位置
                const fullMatchStart = commentText.indexOf(fullMatch);
                const descriptionStart = commentText.indexOf(description, fullMatchStart);

                // 检查 description 是否在同一行
                const lines = commentText.split('\n');
                const fullMatchLine = lines.findIndex(line => line.includes(fullMatch));
                const descriptionLine = lines.findIndex(line => line.includes(description));

                if (fullMatchLine === descriptionLine && description.length > this.descriptionLength) {
                    isPass = true;
                }
            }
        } else if (typeof directiveConfig === 'object' && directiveConfig !== null && 'descriptionFormat' in directiveConfig) {
            const format = (directiveConfig as { descriptionFormat: string }).descriptionFormat;
            // 移除开头的冒号要求，并确保没有多余的空格
            const formatRegex = new RegExp(format.replace(/^\^:/, '^').replace(/^\^ /, '^'));
            // 提取描述部分，移除注释标记和指令
            const description = commentText.includes(':') ? commentText.split(':')[1]?.trim() : commentText.trim();
            if (formatRegex.test(description)) {
                isPass = true;
            }
        }
        return isPass;
    }

    private checkDescriptionFormat(commentText: string, option: keyof Options): string {
        let message = '';
        const options = this.rule && this.rule.option[0] ? this.rule.option[0] as Options : this.defaultOptions;
        let directiveConfig;
        // 提取配置中的实际规则值
        if (typeof options === 'object' && options !== null && option in options) {
            directiveConfig = options[option];
        }

        if (directiveConfig === false) {
            return message;
        }
        if (typeof directiveConfig === 'object' && directiveConfig !== null && 'descriptionFormat' in directiveConfig) {
            const format = (directiveConfig as { descriptionFormat: string }).descriptionFormat;
            // 移除开头的冒号要求，并确保没有多余的空格
            const formatRegex = new RegExp(format.replace(/^\^:/, '^').replace(/^\^ /, '^'));
            // 提取描述部分，移除注释标记和指令
            const description = commentText.includes(':') ? commentText.split(':')[1]?.trim() : commentText.trim();
            if (formatRegex.test(description)) {
                return '';
            }
            message = `The description for the ${option} directive must match the ${format} format.`;
        }

        return message;
    }

    private addIssueReportNode(info: CommentInfo, filePath: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        if (info.description) {
            this.metaData.description = info.description;
        }
        let defect = new Defects(info.line, info.character, info.character, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}
