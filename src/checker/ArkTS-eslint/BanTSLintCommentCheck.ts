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
import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { Defects, IssueReport } from '../../model/Defects';
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'BanTSLintCommentCheck');

interface WarnInfo {
    line: number;
    startCol: number;
    endColum: number;
    comment: string;
};

interface CommentNodeInfo {
    startCol: number;
    pos: number;
    end: number;
    line: number;
};

interface CommentMatch {
    fullMatch: string;
    innerMatch: string | null;
    node: CommentNodeInfo;
};

export class BanTSLintCommentCheck implements BaseChecker {
    readonly REGEX_ENABLE_DISABLE = /^\s*tslint:(enable|disable)(?:-(line|next-line))?(:|\s|$)/;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private filePath: string = '';
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/ban-tslint-comment.md',
        description: 'tslint comment detected: ',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };

        return [fileMatcherCb];
    };

    public check = (target: ArkFile): void => {
        try {
            this.filePath = target.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);

            const comments = this.getComments(sourceFile);
            comments.forEach((comment: ts.CommentRange) => {
                const commentText = sourceFile.getFullText().substring(comment.pos, comment.end);
                this.handleComment(commentText, sourceFile, comment);
            });
        } catch (error) {
            logger.error(`Error occurred while checking file: ${target.getFilePath()}, Error: ${error}`);
        };
    };

    private processCommentRanges(ranges: ts.CommentRange[] | undefined, commentRanges: ts.CommentRange[], seenComments: Set<string>): void {
        if (!ranges) {
            return;
        };
        ranges.forEach((commentRange) => {
            const key = `${commentRange.pos}-${commentRange.end}`;
            if (!seenComments.has(key)) {
                commentRanges.push(commentRange);
                seenComments.add(key);
            };
        });
    };

    private processNodeComments(node: ts.Node, text: string, commentRanges: ts.CommentRange[], seenComments: Set<string>): void {
        this.processCommentRanges(ts.getLeadingCommentRanges(text, node.pos), commentRanges, seenComments);
        this.processCommentRanges(ts.getTrailingCommentRanges(text, node.end), commentRanges, seenComments);
    };

    private processMethodComments(node: ts.Node, sourceFile: ts.SourceFile): void {
        if (ts.isMethodDeclaration(node) && node.body) {
            this.checkMethodComment(node.body as ts.FunctionBody, sourceFile);
        } else if (ts.isArrowFunction(node) && node.body) {
            this.checkMethodComment(node.body as ts.ArrowFunction, sourceFile);
        } else if (ts.isFunctionDeclaration(node) && node.body) {
            this.checkMethodComment(node.body as ts.FunctionBody, sourceFile);
        };
    };

    // 获取文件中所有注释（包括前导、尾随和未附着的注释）
    private visitNode(node: ts.Node, text: string, commentRanges: ts.CommentRange[], seenComments: Set<string>, sourceFile: ts.SourceFile): void {
        this.processNodeComments(node, text, commentRanges, seenComments);
        this.processMethodComments(node, sourceFile);
        ts.forEachChild(node, (child) => this.visitNode(child, text, commentRanges, seenComments, sourceFile));
    };

    private getComments(sourceFile: ts.SourceFile): ts.CommentRange[] {
        const text = sourceFile.text;
        const commentRanges: ts.CommentRange[] = [];
        const seenComments = new Set<string>();

        this.visitNode(sourceFile, text, commentRanges, seenComments, sourceFile);
        return commentRanges;
    };

    private handleComment(commentText: string, sourceFile: ts.SourceFile, comment: ts.CommentRange): void {
        if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia || comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
            this.checkComment(commentText, sourceFile, comment);
        };
    };

    private removeNewlines(str: string): string {
        // 先去除换行符，然后将多个连续空格替换为单个空格
        return str.replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
    };

    private getAllComments(code: string): CommentMatch[] {
        const comments: CommentMatch[] = [];
        const commentRegex = /\/\/(.*)|\/\*([\s\S]*?)\*\//g;

        let match;
        while ((match = commentRegex.exec(code)) !== null) {
            const fullMatch = match[0];
            let innerMatch: string | null = null;
            if (match[1]) {
                innerMatch = match[1].trim();
            } else if (match[2]) {
                innerMatch = match[2].trim();
            };
            const pos = match.index;
            // 把注释起始位置之前的代码按换行符分割成一个行数组
            const linesBefore = code.slice(0, pos).split('\n');
            // 计算行列号
            const line = linesBefore.length;
            const startCol = linesBefore[linesBefore.length - 1].length + 1;
            const end = pos + fullMatch.length;

            const node: CommentNodeInfo = { startCol, pos, end, line };
            comments.push({ fullMatch, innerMatch, node });
        };
        return comments;
    };

    // 处理方法节点的最后一个注释
    private checkMethodComment(body: ts.FunctionBody | ts.ConciseBody, sourceFile: ts.SourceFile): void {
        const commentMatch = this.getAllComments(body.getText());
        const lastComment = commentMatch.length !== 0 ? commentMatch[commentMatch.length - 1] : null;
        if (lastComment && this.REGEX_ENABLE_DISABLE.test(lastComment.innerMatch as string)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(body.getStart());
            const startLine = line + lastComment.node.line;
            const startCol = lastComment.node.startCol;

            let defect = this.addIssueReport({
                line: startLine,
                startCol: startCol,
                endColum: startCol + lastComment.fullMatch.length,
                comment: this.removeNewlines(lastComment.fullMatch)
            });

            let pos = lastComment.node.pos + body.pos + 1;
            let end = lastComment.node.end + body.pos + 1;
            let fix: RuleFix = this.ruleFix(pos, end);
            this.issues.push({ defect, fix });
            RuleListUtil.push(defect);
        };
    };

    // 检查注释
    private checkComment(commentText: string, sourceFile: ts.SourceFile, comment: ts.CommentRange): void {
        let commentValue = commentText.substring(2).trim();
        if (this.REGEX_ENABLE_DISABLE.test(commentValue)) {
            // 获取注释起始位置的行列号
            let { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(comment.pos);
            startLine = startLine + 1;
            startCol = startCol + 1;

            let defect = this.addIssueReport({
                line: startLine,
                startCol: startCol,
                endColum: startCol + commentText.length,
                comment: this.removeNewlines(commentText)
            });

            let fix: RuleFix = this.ruleFix(comment.pos, comment.end);
            this.issues.push(new IssueReport(defect, fix));
            RuleListUtil.push(defect);
        };
    };

    // 创建修复对象 
    private ruleFix(pos: number, end: number): RuleFix {
        return { range: [pos, end], text: '' };
    };

    private addIssueReport(warnInfo: WarnInfo): Defects {
        this.metaData.description = `tslint comment detected: "${warnInfo.comment}"`;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endColum, this.metaData.description, severity, this.rule.ruleId,
            this.filePath, this.metaData.ruleDocPath, true, false, true);
        return defect;
    };
};