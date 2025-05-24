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
import { Rule } from "../../model/Rule";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../matcher/Matchers";
import { ArkFile, AstTreeUtils, ts } from "arkanalyzer";
import { RuleFix } from "../../model/Fix";
import { Defects } from "../../Index";
import { IssueReport } from "../../model/Defects";
import { RuleListUtil } from "../../utils/common/DefectsList";

type TrailingSpacesOptions = [{
    skipBlankLines?: boolean;
    ignoreComments?: boolean;
}];

export class NoTrailingSpacesCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-trailing-spaces.md',
        description: 'Disallow trailing spaces at the end of lines.'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    private defaultOptions: TrailingSpacesOptions = [{}];

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatcher];
    };

    public check = (target: ArkFile) => {
        const filePath = target.getFilePath();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target); // 获取AST节点
        this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as TrailingSpacesOptions : [{}];
        const defects = this.checkTrailingSpaces(sourceFile, this.defaultOptions, filePath);
        defects.forEach(defect => {
            const ruleFix = this.createFix(sourceFile, defect);
            this.issues.push(new IssueReport(defect, ruleFix));
        });
    };

    private checkTrailingSpaces(sourceFile: ts.SourceFile, options: TrailingSpacesOptions, filePath: string): Defects[] {
        const { skipBlankLines, ignoreComments } = options[0];
        const lines = sourceFile.getFullText().split(/\r?\n/);
        const defects: Defects[] = [];
        // 获取模板字符串的行范围
        const templateStringRanges = this.getTemplateStringRanges(sourceFile);
        // 跟踪多行注释状态
        let inMultilineComment = false;

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const trimmedLine = line.trimEnd();
            const trailingSpaces = line.length - trimmedLine.length;
            // 检查是否进入或退出多行注释
            if (line.includes("/*")) {
                inMultilineComment = true;
            }
            if (inMultilineComment && line.includes("*/")) {
                inMultilineComment = false;
            }
            if (trailingSpaces > 0) {
                if (skipBlankLines && trimmedLine.length === 0) return; // 忽略空白行
                // 同时检查单行注释和多行注释
                if (ignoreComments && (line.includes("//") || inMultilineComment)) return; // 忽略注释中的尾随空格
                // 检查当前行是否在模板字符串内部
                const templateInfo = templateStringRanges.find(range => range.start <= lineNumber && lineNumber <= range.end);
                // 如果当前行不是是模板字符串的最后一行
                if (templateInfo && templateInfo.end !== lineNumber) {
                    return;
                }
                const severity = this.rule.alert ?? this.metaData.severity;
                const message = 'Trailing spaces not allowed';
                const defect = new Defects(
                    lineNumber,
                    line.length - trailingSpaces + 1,
                    line.length + 1,
                    message,
                    severity,
                    this.rule.ruleId,
                    filePath,
                    this.metaData.ruleDocPath,
                    true,
                    false,
                    true,
                );
                defects.push(defect);
                RuleListUtil.push(defect);
            }
        });
        return defects;
    };

    private getTemplateStringRanges(sourceFile: ts.SourceFile): { start: number; end: number }[] {
        const templateStringRanges: { start: number; end: number }[] = [];
        // 递归遍历所有节点
        const traverse = (node: ts.Node) => {
            if (ts.isTemplateExpression(node)) {
                // 检测到模板字符串
                const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
                templateStringRanges.push({ start: startLine, end: endLine });
            }
            // 递归遍历子节点
            ts.forEachChild(node, traverse);
        };
        // 从根节点开始遍历
        traverse(sourceFile);
        return templateStringRanges;
    };

    private createFix(sourceFile: ts.SourceFile, defect: Defects): RuleFix {
        const { reportLine, reportColumn } = defect;
        const lineIndex = reportLine - 1;
        const lines = sourceFile.getFullText().split(/\r?\n/);
        const originalLine = lines[lineIndex];
        // 获取模板字符串范围
        const templateStringRanges = this.getTemplateStringRanges(sourceFile);
        // 检查当前行是否是模板字符串的最后一行
        const isLastLineOfTemplate = templateStringRanges.some(range => range.end === reportLine);
        // 修复逻辑
        let fixedLine: string;
        if (isLastLineOfTemplate) {
            // 如果是模板字符串的最后一行，去掉行尾空格
            fixedLine = originalLine.trimEnd();
        } else {
            // 如果是模板字符串外部或非模板字符串，去掉行尾空格
            fixedLine = originalLine.trimEnd();
        }
        const start = sourceFile.getPositionOfLineAndCharacter(lineIndex, 0);
        const end = sourceFile.getPositionOfLineAndCharacter(lineIndex, originalLine.length);
        return { range: [start, end], text: fixedLine };
    };
}