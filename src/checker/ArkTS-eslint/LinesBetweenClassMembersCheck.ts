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

import {ArkFile, AstTreeUtils, ts} from "arkanalyzer";
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData, FileMatcher, MatcherCallback, MatcherTypes, Utils} from '../../Index';
import {Defects} from "../../model/Defects";
import {Rule} from "../../model/Rule";
import {RuleListUtil} from "../../utils/common/DefectsList";
import {IssueReport} from '../../model/Defects';
import {RuleFix} from "../../model/Fix";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AwaitThenableCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/lines-between-class-members.md",
    description: "Expected blank line between class members.",
};

type Options = [{
    exceptAfterOverload: boolean | undefined,
}]

export class LinesBetweenClassMembersCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private issueMap: Map<string, IssueReport> = new Map();
    private exceptAfterOverload: boolean | undefined = undefined;

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatcherCb];
    }

    public check = (arkFile: ArkFile): void => {
        if (this.rule && this.rule.option) {
            const option = this.rule.option as Options;
            if (option.length > 0) {
                this.exceptAfterOverload = option[0].exceptAfterOverload;
            }
        }
        const asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const sourceFileObject = ts.getParseTreeNode(asRoot);
        if (sourceFileObject == undefined) {
            return;
        }

        this.loopNode(arkFile, asRoot, sourceFileObject);

        this.reportSortedIssues();
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFile, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isClassDeclaration(child) || ts.isClassExpression(child)) {
                this.checkClassMembers(child, sourceFile, targetFile);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkClassMembers(child: ts.ClassDeclaration | ts.ClassExpression, sourceFile: ts.SourceFile,
        arkFile: ArkFile): void {
        if (this.hasAbstractModifier(child)) {
            return;
        }
        if (child.members.length <= 1) {
            return;
        }
        for (let i = 0; i < child.members.length - 1; i++) {
            const currentMember = child.members[i];
            let nextMember = child.members[i + 1];
            const currentEndLine = this.getEndLine(currentMember, sourceFile);
            let nextStartLine = this.getStartLine(nextMember, sourceFile);
            if (this.shouldSkipSemicolonToProperty(currentMember, nextMember, child, i)) {
                continue;
            }
            let abstractModifier = currentMember.modifiers?.
            find(modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword);
            if (ts.isPropertyDeclaration(currentMember) && !abstractModifier && this.exceptAfterOverload === undefined) {
                let isPropertyDeclarationWithSpacing = this.checkPropertySpacing(
                    currentMember, nextMember, child, i, currentEndLine, sourceFile, arkFile);
                if (isPropertyDeclarationWithSpacing) {
                    continue;
                }
            }

            if (this.exceptAfterOverload !== false && this.isOverload(currentMember)) {
                continue;
            }
            if (this.exceptAfterOverload !== false) {
                this.handleExceptAfterOverload(child, i, sourceFile, arkFile);
            } else {
                this.handleNoExceptAfterOverload(currentMember, nextMember, currentEndLine, nextStartLine, sourceFile, arkFile);
            }
        }
    }

    private shouldSkipSemicolonToProperty(
        currentMember: ts.ClassElement, nextMember: ts.ClassElement,
        child: ts.ClassDeclaration | ts.ClassExpression, i: number
    ): boolean {
        if (
            ts.isSemicolonClassElement(currentMember) &&
            currentMember.getText() === ';' &&
            ts.isPropertyDeclaration(nextMember) &&
            i > 0 &&
            ts.isPropertyDeclaration(child.members[i - 1]) &&
            this.exceptAfterOverload === undefined
        ) {
            const abstractNextModifier = nextMember.modifiers?.find(
                modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword
            );
            return !abstractNextModifier;
        }
        return false;
    }

    private checkPropertySpacing(
        currentMember: ts.ClassElement, nextMember: ts.ClassElement, child: ts.ClassDeclaration | ts.ClassExpression,
        i: number, currentEndLine: number, sourceFile: ts.SourceFile, arkFile: ArkFile
    ): boolean {
        let nextNewMember = child.members[i + 1];
        let nextNewStartLine = this.getStartLine(nextNewMember, sourceFile);
        // 处理分号占位符的情况
        if (ts.isSemicolonClassElement(nextMember) && nextMember.getText() === ';') {
            if (i + 2 <= child.members.length - 1) {
                nextNewMember = child.members[i + 2];
                nextNewStartLine = this.getStartLine(nextNewMember, sourceFile);
            } else {
                return true;
            }
        }
        if (ts.isPropertyDeclaration(nextNewMember)) {
            if (nextNewStartLine - currentEndLine > 1) {
                const positionInfo = this.getPositionInfo(nextNewMember, sourceFile);
                this.handlePropertyDeclarationWithSpacing(
                    currentMember, nextNewMember, currentEndLine, sourceFile, arkFile, positionInfo);
            }
            return true;
        }
        return false;
    }

    private handlePropertyDeclarationWithSpacing(
        currentMember: ts.ClassElement,
        nextNewMember: ts.ClassElement,
        currentEndLine: number,
        sourceFile: ts.SourceFile,
        arkFile: ArkFile,
        positionInfo: { startPosition: ts.LineAndCharacter; endPosition: ts.LineAndCharacter }
    ): void {
        const fullText = nextNewMember.getFullText();
        const modifiedText = fullText.replace(/\r\n/, '');
        const fix: RuleFix | undefined = {
            range: [nextNewMember.getFullStart(), nextNewMember.getEnd()],
            text: modifiedText
        };
        const defect = this.addIssueReport(
            arkFile,
            positionInfo.startPosition.line + 1,
            positionInfo.startPosition.character + 1,
            positionInfo.endPosition.character + 1,
            'Unexpected blank line between class members.',
            fix
        );
        this.issueMap.set(defect.fixKey, { defect, fix });
    }

    private hasAbstractModifier(child: ts.ClassDeclaration | ts.ClassExpression): boolean {
        for (const modifier of child.modifiers ?? []) {
            if (modifier.kind === ts.SyntaxKind.AbstractKeyword) {
                return true;
            }
        }
        if (!child.members) {
            return false;
        }
        if (child.members?.length > 0 && ts.isMethodDeclaration(child.members[0])) {
            return child.members[0].modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword) ?? false;
        }
        return false;
    }

    private handleExceptAfterOverload(child: ts.ClassDeclaration | ts.ClassExpression, i: number,
        sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let members: any[] = [];
        let semicolonElements: { element: ts.ClassElement, index: number }[] = [];
        // 收集所有非分号成员和分号成员，记录它们的索引关系
        child.members.forEach((member, idx) => {
            if (!ts.isSemicolonClassElement(member) && member.getText() !== ';') {
                members.push(member);
            } else if (idx > 0) {
                // 记录分号元素及其前一个元素在members中的位置
                semicolonElements.push({ element: member, index: members.length - 1 });
            };
        });
        for (let j = i + 1; j < members.length; j++) {
            const currentMember = members[i];
            let nextMember = members[j];
            if (this.checkMembersCondition(members, i, j, sourceFile)) {
                const positionInfo = this.getPositionInfo(nextMember, sourceFile);
                const sourceText = sourceFile.text;
                const currentMemberEnd = currentMember.getEnd();
                const semicolonAfterMember = semicolonElements.find(item => item.index === i);
                // 确定要检查尾随注释的结束位置
                let checkPos = semicolonAfterMember
                    ? semicolonAfterMember.element.getEnd() // 如果有分号元素，从分号元素结束位置开始检查
                    : currentMemberEnd; // 否则从当前成员结束位置开始检查
                const trailingComments = ts.getTrailingCommentRanges(sourceText, checkPos);
                let endPos = checkPos; // 初始结束位置
                if (trailingComments && trailingComments.length > 0) {
                    endPos = trailingComments[trailingComments.length - 1].end;
                };
                // 获取从成员开始到结束位置的所有文本（包括可能的分号和注释）
                const fullText = sourceText.substring(currentMember.getStart(), endPos);
                const fix: RuleFix | undefined = {
                    range: [currentMember.getStart(), endPos],
                    text: fullText + '\n'
                };
                const defect = this.addIssueReport(arkFile, positionInfo.startPosition.line + 1,
                    positionInfo.startPosition.character + 1, positionInfo.endPosition.character + 1, this.metaData.description, fix);
                this.issueMap.set(defect.fixKey, { defect, fix });
                break;
            }
        }
    }

    private handleNoExceptAfterOverload(currentMember: ts.ClassElement, nextMember: ts.ClassElement,
                                        currentEndLine: number, nextStartLine: number, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (nextStartLine - currentEndLine <= 1) {
            const positionInfo = this.getPositionInfo(nextMember, sourceFile);
            const fix: RuleFix | undefined = {
                range: [currentMember.getStart(), currentMember.getEnd()],
                text: currentMember.getText() + '\n'
            };
            const defect = this.addIssueReport(arkFile, positionInfo.startPosition.line + 1,
                positionInfo.startPosition.character + 1, positionInfo.endPosition.character + 1, this.metaData.description, fix);
            this.issueMap.set(defect.fixKey, {defect, fix});
        }
    }

    private checkMembersCondition(members: any [], i: number, j: number,
                                  sourceFile: ts.SourceFile): boolean {
        const currentMember = members[i];
        const nextMember = members[j];
        const currentEndLine = this.getEndLine(currentMember, sourceFile);
        const nextStartLine = this.getStartLine(nextMember, sourceFile);
        if (nextStartLine - currentEndLine <= j - i) {
            return !this.isOverload(nextMember);
        }
        return false;
    }

    private getStartLine(node: ts.Node, sourceFile: ts.SourceFile): number {
        const start = node.getStart(sourceFile);
        return sourceFile.getLineAndCharacterOfPosition(start).line + 1;
    }

    private getEndLine(node: ts.Node, sourceFile: ts.SourceFile): number {
        const end = node.getEnd();
        return sourceFile.getLineAndCharacterOfPosition(end).line + 1;
    }

    private isOverload(node: ts.ClassElement): boolean {
        return (node.kind === ts.SyntaxKind.MethodDeclaration && (node as ts.MethodDeclaration).body === undefined) ||
            (node.kind === ts.SyntaxKind.Constructor && (node as ts.MethodDeclaration).body === undefined) ||
            (node.kind === ts.SyntaxKind.SetAccessor && (node as ts.MethodDeclaration).body === undefined) ||
            (node.kind === ts.SyntaxKind.GetAccessor && (node as ts.MethodDeclaration).body === undefined);
    }

    private getPositionInfo(expression: ts.ClassElement, sourceFile: ts.SourceFileLike): {
        startPosition: ts.LineAndCharacter;
        endPosition: ts.LineAndCharacter
    } {
        const start = expression.getStart();
        const end = expression.getEnd();
        const startPositionInfo = sourceFile.getLineAndCharacterOfPosition(start);
        const endPositionInfo = sourceFile.getLineAndCharacterOfPosition(end);
        return {
            startPosition: startPositionInfo,
            endPosition: endPositionInfo
        };
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number,
                           endCol: number, message: string, fix?: RuleFix): Defects {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, true);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
        return defect;
    }

    private reportSortedIssues(): void {
        if (this.issueMap.size === 0) {
            return;
        }
        const sortedIssues = Array.from(this.issueMap.entries())
            .sort(([keyA], [keyB]) => Utils.sortByLineAndColumn(keyA, keyB));
        this.issues = [];
        sortedIssues.forEach(([_, issue]) => {
            RuleListUtil.push(issue.defect);
            this.issues.push(issue);
        });
    }
}