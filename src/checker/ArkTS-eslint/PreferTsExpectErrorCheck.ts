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

import { ArkFile, ts } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { AstTreeUtils } from "arkanalyzer";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { Defects, IssueReport } from "../../model/Defects";
import { RuleFix } from '../../model/Fix';
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PreferTsExpectErrorCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/prefer-ts-expect-error-check.md",
    description: 'Use "@ts-expect-error" to ensure an error is actually being suppressed.',
};

// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
    fileName: string;
    line: number;
    startCol: number;
    endCol: number;
    character: number;
    commentStartLine: number
}

const tsIgnoreRegExpSingleLine = /^\s*\/{2,}\s*@ts-ignore/;
export class PreferTsExpectErrorCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
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
            if (this.getFileExtension(target.getName()) !== '.ets') {
                const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
                let filePath = target.getFilePath();
                // 提取注释
                const comments = this.extractComments(sourceFile);
                // 输出结果
                comments.forEach(comment => {
                    this.addIssueReportNodeFix(sourceFile, comment, filePath)
                });
            }
        }
    }

    private getFileExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }
        return filePath.substring(lastDotIndex);
    }

    // 判断注释类型并匹配
    private extractComments(sourceFile: ts.SourceFile): LocationInfo[] {
        const comments: LocationInfo[] = [];
        const visitedComments = new Set<number>(); // 用于记录已处理的注释位置
        const visit = (node: ts.Node) => {
            const leadingComments = ts.getLeadingCommentRanges(sourceFile.getFullText(), node.pos);
            if (leadingComments) {
                for (const comment of leadingComments) {
                    // 如果该注释已经被处理过，跳过
                    if (visitedComments.has(comment.pos)) {
                        continue;
                    }
                    visitedComments.add(comment.pos); // 标记为已处理
                    const commentText = sourceFile.getFullText().substring(comment.pos, comment.end).trim();
                    // 判断是否为 @ts-ignore 注释
                    if (this.isTsIgnoreComment(commentText)) {
                        const tsIgnoreIndex = commentText.indexOf("@ts-ignore");
                        const startOffset = comment.pos + tsIgnoreIndex;
                        // 计算 character（从多行注释的开头开始）
                        const { line: commentStartLine, character: commentStartChar } = sourceFile.getLineAndCharacterOfPosition(comment.pos);
                        // 计算 endCol（从 @ts-ignore 的起始位置开始）
                        const { line: tsIgnoreLine, character: tsIgnoreChar } = sourceFile.getLineAndCharacterOfPosition(startOffset);
                        comments.push({
                            commentStartLine: commentStartLine + 1,
                            fileName: sourceFile.fileName,
                            line: tsIgnoreLine + 1,
                            startCol: tsIgnoreChar + 1, // 从多行注释的开头开始
                            endCol: tsIgnoreChar + "@ts-ignore".length + 1, // 按照之前的逻辑
                            character: commentStartChar + 1, // 从多行注释的开头开始
                        });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return comments;
    }
    private isTsIgnoreComment(commentText: string): boolean {
        if (commentText.startsWith("//")) {
            return tsIgnoreRegExpSingleLine.test(commentText);
        } else if (commentText.startsWith("/*")) {
            const lines = commentText.split("\n");
            for (const line of lines) {
                // 修改后的正则表达式处理块注释中的单行注释格式
                const trimmedLine = line.trim()
                    .replace(/^[\/\*\s]+/g, "")
                    .replace(/[\*\/\s]+$/g, "");

                if (trimmedLine.startsWith("@ts-ignore")) {
                    return true;
                }
            }
        }
        return false;
    }


    private ruleFix(sourceFile: ts.SourceFile, loc: LocationInfo): RuleFix {
        // 获取注释的起始位置和结束位置
        const startPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.startCol - 1);
        const endPosition = sourceFile.getPositionOfLineAndCharacter(loc.line - 1, loc.endCol - 1);
        // 替换 @ts-ignore 为 @ts-expect-error
        const fixText = "@ts-expect-error";
        // 返回替换的范围和替换文本
        return { range: [startPosition, endPosition], text: fixText };
    }

    private addIssueReportNodeFix(sourceFile: ts.SourceFile, loc: LocationInfo, filePath: string) {
        const severity = this.rule.alert ?? this.metaData.severity;
        const defect = new Defects(loc.commentStartLine, loc.character, loc.endCol, this.metaData.description, severity, this.rule.ruleId, filePath,
            this.metaData.ruleDocPath, true, false, true);
        let fix: RuleFix = this.ruleFix(sourceFile, loc);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    }
}
