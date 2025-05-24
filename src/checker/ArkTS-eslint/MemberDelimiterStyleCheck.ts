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
    ruleDocPath: "docs/member-delimiter-style.md",
    description: "Require a specific member delimiter style for interfaces and type literals",
};
type MultiLineOption = 'comma' | 'none' | 'semi';
type SingleLineOption = 'comma' | 'semi';
type DelimiterConfig = {
    multiline?: {
        delimiter?: MultiLineOption;
        requireLast?: boolean;
    };
    singleline?: {
        delimiter?: SingleLineOption;
        requireLast?: boolean;
    };
};
type Options = [
    {
        multiline?: {
            delimiter?: MultiLineOption;
            requireLast?: boolean;
        };
        multilineDetection?: 'brackets' | 'last-member';
        overrides?: {
            interface?: DelimiterConfig;
            typeLiteral?: DelimiterConfig;
        };
        singleline?: {
            delimiter?: SingleLineOption;
            requireLast?: boolean;
        };
    },
];

export class MemberDelimiterStyleCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private issueMap: Map<string, IssueReport> = new Map();
    private multilineDetection: 'brackets' | 'last-member' = 'brackets';
    private interfaceMultilineDelimiter: MultiLineOption = 'semi';
    private interfaceMultilineRequireLast: boolean = true;
    private interfaceSingleLineDelimiter: SingleLineOption = 'semi';
    private interfaceSingleLineRequireLast: boolean = false;
    private typeLiteralMultilineDelimiter: MultiLineOption = 'semi';
    private typeLiteralMultilineRequireLast: boolean = true;
    private typeLiteralSingleLineDelimiter: SingleLineOption = 'semi';
    private typeLiteralSingleLineRequireLast: boolean = false;

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
        this.parseOptions(this.rule?.option as Options);
        const asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const sourceFileObject = ts.getParseTreeNode(asRoot);
        if (!sourceFileObject) {
            return;
        }
        this.loopNode(arkFile, asRoot, sourceFileObject);
        this.reportSortedIssues();
    }

    private parseOptions(options: Options): void {
        if (options && options.length > 0) {
            const defaultOptions = options[0];
            this.multilineDetection = defaultOptions?.multilineDetection || 'brackets';
            this.interfaceMultilineDelimiter = defaultOptions?.multiline?.delimiter || 'semi';
            this.interfaceMultilineRequireLast = defaultOptions?.multiline?.requireLast || true;
            this.interfaceSingleLineDelimiter = defaultOptions?.singleline?.delimiter || 'semi';
            this.interfaceSingleLineRequireLast = defaultOptions?.singleline?.requireLast || false;
            this.applyDefaultOptions(defaultOptions);
            if (defaultOptions?.overrides) {
                this.applyOverrides(defaultOptions.overrides);
            }
        }
    }

    private applyDefaultOptions(defaultOptions: { multiline?: { delimiter?: MultiLineOption; requireLast?: boolean; };
        singleline?: { delimiter?: SingleLineOption; requireLast?: boolean; }; }): void {
        this.typeLiteralMultilineDelimiter = defaultOptions?.multiline?.delimiter || 'semi';
        this.typeLiteralMultilineRequireLast = defaultOptions?.multiline?.requireLast || true;
        this.typeLiteralSingleLineDelimiter = defaultOptions?.singleline?.delimiter || 'semi';
        this.typeLiteralSingleLineRequireLast = defaultOptions?.singleline?.requireLast || false;
    }

    private applyOverrides(overrides: { interface?: DelimiterConfig; typeLiteral?: DelimiterConfig }): void {
        if (overrides?.interface) {
            this.interfaceMultilineDelimiter = overrides.interface.multiline?.delimiter || 'semi';
            this.interfaceMultilineRequireLast = overrides.interface.multiline?.requireLast || true;
            this.interfaceSingleLineDelimiter = overrides.interface.singleline?.delimiter || 'semi';
            this.interfaceSingleLineRequireLast = overrides.interface.singleline?.requireLast || false;
        }
        if (overrides?.typeLiteral) {
            this.typeLiteralMultilineDelimiter = overrides.typeLiteral.multiline?.delimiter || 'semi';
            this.typeLiteralMultilineRequireLast = overrides.typeLiteral.multiline?.requireLast || true;
            this.typeLiteralSingleLineDelimiter = overrides.typeLiteral.singleline?.delimiter || 'semi';
            this.typeLiteralSingleLineRequireLast = overrides.typeLiteral.singleline?.requireLast || false;
        }
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFile, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isInterfaceDeclaration(child)) {
                this.checkInterfaceMembers(child, sourceFile, targetFile);
            } else if (ts.isTypeAliasDeclaration(child)) {
                this.checkTypeAliasMembers(child, sourceFile, targetFile);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkInterfaceMembers(child: ts.InterfaceDeclaration, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        const members = child?.members;
        if (!members) {
            return;
        }
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const isLastMember = i === members.length - 1;
            const { isSameLine } = this.getLineInfo(child, members, sourceFile, isLastMember);
            if (member.getChildren().length > 1) {
                this.processMember(member, sourceFile, arkFile, isSameLine, isLastMember);
            }
        }
    }

    private getLineInfo(child: ts.InterfaceDeclaration, members: ts.NodeArray<ts.TypeElement>,
                        sourceFile: ts.SourceFile, isLastMember: boolean): { startLine: number, endLine: number, isSameLine: boolean } {
        let startLine = this.getStartLine(child, sourceFile);
        if (this.multilineDetection === 'last-member' && isLastMember) {
            startLine = this.getStartLine(members[members.length - 1], sourceFile);
        }
        const endLine = this.getEndLine(child, sourceFile);
        const isSameLine = startLine === endLine;
        return { startLine, endLine, isSameLine };
    }

    private processMember(member: ts.TypeElement, sourceFile: ts.SourceFile, arkFile: ArkFile, isSameLine: boolean, isLastMember: boolean): void {
        const lastToken = member.getChildren()[member.getChildren().length - 1];
        const positionInfo = this.getPositionInfo(member, sourceFile);
        if (isSameLine && isLastMember) {
            this.checkSingleLineLastMember(member, lastToken, positionInfo, sourceFile, arkFile);
        } else if (isSameLine) {
            this.checkSingleLineMember(member, lastToken, positionInfo, sourceFile, arkFile);
        } else if (!isSameLine && isLastMember) {
            this.checkMultilineLastMember(member, lastToken, positionInfo, sourceFile, arkFile);
        } else {
            this.checkMultilineMember(member, lastToken, positionInfo, sourceFile, arkFile);
        }
    }

    private checkSingleLineLastMember(member: ts.TypeElement, lastToken: ts.Node,
                                      positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                      sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (this.interfaceSingleLineRequireLast) {
            this.checkDelimiter(member, lastToken, positionInfo, sourceFile, arkFile, this.interfaceSingleLineDelimiter);
        } else {
            this.removeDelimiterIfPresent(member, lastToken, positionInfo, sourceFile, arkFile);
        }
    }

    private checkSingleLineMember(member: ts.TypeElement, lastToken: ts.Node,
                                  positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                  sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        this.checkDelimiter(member, lastToken, positionInfo, sourceFile, arkFile, this.interfaceSingleLineDelimiter);
    }

    private checkMultilineLastMember(member: ts.TypeElement, lastToken: ts.Node,
                                     positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                     sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (this.interfaceMultilineRequireLast) {
            this.checkDelimiter(member, lastToken, positionInfo, sourceFile, arkFile, this.interfaceMultilineDelimiter);
        } else {
            this.removeDelimiterIfPresent(member, lastToken, positionInfo, sourceFile, arkFile);
        }
    }

    private checkMultilineMember(member: ts.TypeElement, lastToken: ts.Node,
                                 positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                 sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        this.checkDelimiter(member, lastToken, positionInfo, sourceFile, arkFile, this.interfaceMultilineDelimiter);
    }

    private checkDelimiter(member: ts.TypeElement, lastToken: ts.Node,
                           positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                           sourceFile: ts.SourceFile, arkFile: ArkFile, delimiter: MultiLineOption | SingleLineOption): void {
        if (delimiter === 'none' && (lastToken.kind === ts.SyntaxKind.CommaToken || lastToken.kind === ts.SyntaxKind.SemicolonToken)) {
            this.removeDelimiter(member, positionInfo, arkFile, lastToken.kind === ts.SyntaxKind.SemicolonToken);
        } else if (delimiter === 'semi' && lastToken.kind !== ts.SyntaxKind.SemicolonToken) {
            this.replaceDelimiter(member, lastToken, positionInfo, arkFile, ';');
        } else if (delimiter === 'comma' && lastToken.kind !== ts.SyntaxKind.CommaToken) {
            this.replaceDelimiter(member, lastToken, positionInfo, arkFile, ',');
        }
    }

    private removeDelimiterIfPresent(member: ts.TypeElement, lastToken: ts.Node,
                                     positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                     sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (lastToken.kind === ts.SyntaxKind.CommaToken || lastToken.kind === ts.SyntaxKind.SemicolonToken) {
            this.removeDelimiter(member, positionInfo, arkFile, lastToken.kind === ts.SyntaxKind.SemicolonToken);
        }
    }

    private removeDelimiter(member: ts.TypeElement,
                            positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                            arkFile: ArkFile, semicolonToken: boolean): void {
        const result = member.getText().slice(0, -1);
        const fix: RuleFix = { range: [member.getStart(), member.getEnd()], text: result };
        const defect = this.addIssueReport(arkFile, positionInfo.endPosition.line + 1, positionInfo.endPosition.character + 1,
            positionInfo.endPosition.character + 1, (`Unexpected separator ${semicolonToken ? '(;).' : '(,).'}`), fix);
        this.issueMap.set(defect.fixKey, { defect, fix });
    }

    private replaceDelimiter(member: ts.TypeElement, lastToken: ts.Node,
                             positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                             arkFile: ArkFile, delimiter: string): void {
        const result = lastToken.kind === ts.SyntaxKind.CommaToken || lastToken.kind === ts.SyntaxKind.SemicolonToken
            ? member.getText().slice(0, -1) + delimiter
            : member.getText() + delimiter;
        const fix: RuleFix = { range: [member.getStart(), member.getEnd()], text: result };
        const defect = this.addIssueReport(arkFile, positionInfo.endPosition.line + 1, positionInfo.endPosition.character + 1,
            positionInfo.endPosition.character + 1, (`Expected a ${delimiter === ';' ? 'semicolon.' : 'comma.'}`), fix);
        this.issueMap.set(defect.fixKey, { defect, fix });
    }

    private checkTypeAliasMembers(child: ts.TypeAliasDeclaration | ts.TypeElement, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (!ts.isTypeAliasDeclaration(child) && !ts.isPropertySignature(child)) {
            return;
        }
        if (ts.isUnionTypeNode(child.type!) || ts.isIntersectionTypeNode(child.type!)) {
            child.type.types.forEach((type) => {
                if (ts.isTypeLiteralNode(type)) {
                    const members = type.members;
                    this.processTypeAliasMembers(members, child, sourceFile, arkFile);
                }
            });
        }
        if (!ts.isTypeLiteralNode(child.type!)) {
            return;
        }
        const members = child.type.members;
        this.processTypeAliasMembers(members, child, sourceFile, arkFile);
    }

    private processTypeAliasMembers(members: ts.NodeArray<ts.TypeElement>, child: ts.TypeAliasDeclaration | ts.PropertySignature,
                                    sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        for (const [i, member] of members.entries()) {
            if (member.getChildren().length <= 1) {
                continue;
            }
            const isLastMember = i === members.length - 1;
            if (child.type) {
                const { isSameLine } = this.getLineInfoType(child.type, members, sourceFile, isLastMember);
                this.processMemberType(member, sourceFile, arkFile, isSameLine, isLastMember);
            }
        }
    }


    private getLineInfoType(child: ts.Node, members: ts.NodeArray<ts.TypeElement>, sourceFile: ts.SourceFile,
                            isLastMember: boolean): { startLine: number, endLine: number, isSameLine: boolean } {
        let startLine = this.getStartLine(child, sourceFile);
        if (this.multilineDetection === 'last-member' && isLastMember) {
            startLine = this.getStartLine(members[members.length - 1], sourceFile);
        }
        const endLine = this.getEndLine(child, sourceFile);
        const isSameLine = startLine === endLine;
        return { startLine, endLine, isSameLine };
    }

    private processMemberType(member: ts.TypeElement, sourceFile: ts.SourceFile, arkFile: ArkFile, isSameLine: boolean, isLastMember: boolean): void {
        const lastToken = member.getChildren()[member.getChildren().length - 1];
        const positionInfo = this.getPositionInfo(member, sourceFile);
        if (isSameLine && isLastMember) {
            this.checkSingleLineLastMemberType(member, lastToken, positionInfo, sourceFile, arkFile);
        } else if (isSameLine) {
            this.checkSingleLineMemberType(member, lastToken, positionInfo, sourceFile, arkFile);
        } else if (!isSameLine && isLastMember) {
            this.checkMultilineLastMemberType(member, lastToken, positionInfo, sourceFile, arkFile);
        } else {
            this.checkMultilineMemberType(member, lastToken, positionInfo, sourceFile, arkFile);
        }
    }

    private checkSingleLineLastMemberType(member: ts.TypeElement, lastToken: ts.Node,
                                          positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                          sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (this.typeLiteralSingleLineRequireLast) {
            this.checkDelimiterType(member, lastToken, positionInfo, sourceFile, arkFile, this.typeLiteralSingleLineDelimiter);
        } else {
            this.removeDelimiterIfPresentType(member, lastToken, positionInfo, sourceFile, arkFile);
        }
    }

    private checkSingleLineMemberType(member: ts.TypeElement, lastToken: ts.Node,
                                      positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                      sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        this.checkDelimiterType(member, lastToken, positionInfo, sourceFile, arkFile, this.typeLiteralSingleLineDelimiter);
    }

    private checkMultilineLastMemberType(member: ts.TypeElement, lastToken: ts.Node,
                                         positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                         sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (this.typeLiteralMultilineRequireLast) {
            this.checkDelimiterType(member, lastToken, positionInfo, sourceFile, arkFile, this.typeLiteralMultilineDelimiter);
        } else {
            this.removeDelimiterIfPresentType(member, lastToken, positionInfo, sourceFile, arkFile);
        }
    }

    private checkMultilineMemberType(member: ts.TypeElement, lastToken: ts.Node,
                                     positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                     sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        this.checkDelimiterType(member, lastToken, positionInfo, sourceFile, arkFile, this.typeLiteralMultilineDelimiter);
    }

    private checkDelimiterType(member: ts.TypeElement, lastToken: ts.Node,
                               positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                               sourceFile: ts.SourceFile, arkFile: ArkFile, delimiter: MultiLineOption | SingleLineOption): void {
        if (delimiter === 'none' && (lastToken.kind === ts.SyntaxKind.CommaToken || lastToken.kind === ts.SyntaxKind.SemicolonToken)) {
            this.removeDelimiterType(member, positionInfo, arkFile, lastToken.kind === ts.SyntaxKind.SemicolonToken);
        } else if (delimiter === 'semi' && lastToken.kind !== ts.SyntaxKind.SemicolonToken) {
            this.replaceDelimiterType(member, lastToken, positionInfo, arkFile, ';');
        } else if (delimiter === 'comma' && lastToken.kind !== ts.SyntaxKind.CommaToken) {
            this.replaceDelimiterType(member, lastToken, positionInfo, arkFile, ',');
        }
    }

    private removeDelimiterIfPresentType(member: ts.TypeElement, lastToken: ts.Node,
                                         positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                         sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (lastToken.kind === ts.SyntaxKind.CommaToken || lastToken.kind === ts.SyntaxKind.SemicolonToken) {
            this.removeDelimiterType(member, positionInfo, arkFile, lastToken.kind === ts.SyntaxKind.SemicolonToken);
        }
    }

    private removeDelimiterType(member: ts.TypeElement,
                                positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                arkFile: ArkFile, semicolonToken: boolean): void {
        const result = member.getText().slice(0, -1);
        const fix: RuleFix = { range: [member.getStart(), member.getEnd()], text: result };
        const defect = this.addIssueReport(arkFile, positionInfo.endPosition.line + 1, positionInfo.endPosition.character + 1,
            positionInfo.endPosition.character + 1, (`Unexpected separator ${semicolonToken ? '(;).' : '(,).'}`), fix);
        this.issueMap.set(defect.fixKey, { defect, fix });
    }

    private replaceDelimiterType(member: ts.TypeElement, lastToken: ts.Node,
                                 positionInfo: { startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter },
                                 arkFile: ArkFile, delimiter: string): void {
        const result = lastToken.kind === ts.SyntaxKind.CommaToken || lastToken.kind === ts.SyntaxKind.SemicolonToken
            ? member.getText().slice(0, -1) + delimiter
            : member.getText() + delimiter;
        const fix: RuleFix = { range: [member.getStart(), member.getEnd()], text: result };
        const defect = this.addIssueReport(arkFile, positionInfo.endPosition.line + 1, positionInfo.endPosition.character + 1,
            positionInfo.endPosition.character + 1, (`Expected a ${delimiter === ';' ? 'semicolon.' : 'comma.'}`), fix);
        this.issueMap.set(defect.fixKey, { defect, fix });
    }

    private getStartLine(node: ts.Node, sourceFile: ts.SourceFile): number {
        const start = node.getStart(sourceFile);
        return sourceFile.getLineAndCharacterOfPosition(start).line + 1;
    }

    private getEndLine(node: ts.Node, sourceFile: ts.SourceFile): number {
        const end = node.getEnd();
        return sourceFile.getLineAndCharacterOfPosition(end).line + 1;
    }

    private getPositionInfo(expression: ts.TypeElement, sourceFile: ts.SourceFileLike): {
        startPosition: ts.LineAndCharacter, endPosition: ts.LineAndCharacter
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

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string, fix?: RuleFix): Defects {
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