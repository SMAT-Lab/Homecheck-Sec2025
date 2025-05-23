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

import { ArkFile, AstTreeUtils, LineColPosition, ts } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData, FileMatcher, MatcherCallback, MatcherTypes, Utils } from '../../Index';
import { Defects } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from '../../model/Defects';
import { RuleFix } from "../../model/Fix";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'AwaitThenableCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/method-signature-style.md",
    description: "Shorthand method signature is forbidden. Use a function property instead.",
};

type Options = ['method' | 'property']

export class MethodSignatureStyleCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private issueMap: Map<string, IssueReport> = new Map();
    private optionsStyle: 'method' | 'property' = 'property';

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
        if (!this.getFileExtension(arkFile.getName(), 'ts')) {
            return;
        }
        if (this.rule && this.rule.option) {
            const option = this.rule.option as Options;
            if (option.length > 0) {
                this.optionsStyle = option[0];
            }
        }
        if (this.optionsStyle === 'method') {
            this.metaData.description = 'Function property signature is forbidden. Use a method shorthand instead.';
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
            if (ts.isInterfaceDeclaration(child)) {
                this.checkInterfaceMembers(child, sourceFile, targetFile);
            }
            else if (ts.isTypeAliasDeclaration(child)) {
                this.checkTypeAliasMembers(child, sourceFile, targetFile);
            }
            else if (ts.isTypeLiteralNode(child)) {
                this.checkInterfaceMembers(child, sourceFile, targetFile);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkInterfaceMembers(child: ts.InterfaceDeclaration | ts.TypeLiteralNode, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        const members = child?.members;
        if (!members) {
            return;
        }

        const nameList = this.buildNameList(members);
        const duplicateIndices = this.findDuplicateNamesWithIndices(nameList);

        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            if (ts.isMethodSignature(member)) {
                this.handleMethodSignature(members, member, duplicateIndices, i, sourceFile, arkFile);
            } else if (ts.isPropertySignature(member)) {
                this.handlePropertySignature(member, sourceFile, arkFile);
            }
        }
    }

    private buildNameList(members: ts.NodeArray<ts.TypeElement>): string[] {
        let nameList: string[] = [];
        members.forEach((member) => {
            if (this.optionsStyle === 'property') {
                if (ts.isMethodSignature(member)) {
                    nameList.push(member.name.getText());
                } else {
                    nameList.push('');
                }
            }
        });
        return nameList;
    }

    private handleMethodSignature(members: ts.NodeArray<ts.TypeElement>, member: ts.MethodSignature, duplicateIndices: Map<string, number[]>,
        index: number, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (this.optionsStyle === 'property' && !(member.type && ts.isFunctionTypeNode(member.type))) {
            const duplicateList = duplicateIndices.get(member.name.getText());
            if (duplicateList) {
                if (duplicateList[duplicateList.length - 1] === index) {
                    this.processLastDuplicateMethod(members, member, duplicateList, sourceFile, arkFile);
                } else {
                    this.processDuplicateMethod(member, sourceFile, arkFile);
                }
            } else {
                this.processUniqueMethod(member, sourceFile, arkFile);
            }
        }
    }

    private processLastDuplicateMethod(members: ts.NodeArray<ts.TypeElement>, member: ts.MethodSignature, duplicateList: number[],
        sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let code = member.name.getText() + ': ';
        const duplicatesMethodBody = this.collectDuplicatesMethodBody(members, duplicateList, member);
        duplicatesMethodBody.forEach((methodBody) => {
            code += '(' + methodBody + ') & ';
        });
        const fixCode = this.replaceLastOccurrence(member.getText(), member.type?.getText()!);
        const methodBody = this.extractMethodBody(fixCode, member.name.getText());
        code += '(' + methodBody + ');';
        this.reportIssue(member, sourceFile, arkFile, code);
    }

    private collectDuplicatesMethodBody(members: ts.NodeArray<ts.TypeElement>, duplicateList: number[], member: ts.MethodSignature): string[] {
        let duplicatesMethodBody: string[] = [];
        duplicateList.forEach((index) => {
            if (index !== duplicateList[duplicateList.length - 1]) {
                const currentMember = members[index] as ts.MethodSignature;
                const fixCode = this.replaceLastOccurrence(currentMember.getText(), currentMember.type?.getText() ?? '');
                const methodBody = this.extractMethodBody(fixCode, currentMember.name.getText());
                duplicatesMethodBody.push(methodBody);
            }
        });
        return duplicatesMethodBody;
    }

    private extractMethodBody(fixCode: string, methodName: string): string {
        return fixCode.replace(methodName, '').replace(',', '').replace(';', '');
    }

    private processDuplicateMethod(member: ts.MethodSignature, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        const fixCode = this.replaceLastOccurrence(member.getText(), member.type?.getText()!);
        const methodBody = this.extractMethodBody(fixCode, member.name.getText());
        this.reportIssue(member, sourceFile, arkFile, '', methodBody);
    }

    private processUniqueMethod(member: ts.MethodSignature, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let newCode = this.replaceFirstOccurrence(member.getText(), member.name?.getText()!);
        let fixCode = '';
        if (member.type) {
            fixCode = this.replaceLastOccurrence(newCode, member.type?.getText()!);
        } else {
            newCode = newCode.replace(',', '').replace(';', '');
            fixCode = newCode + ' => any;';
        }
        this.reportIssue(member, sourceFile, arkFile, fixCode);
    }

    private handlePropertySignature(member: ts.PropertySignature, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (this.optionsStyle === 'method' && member.type && ts.isFunctionTypeNode(member.type)) {
            let newCode = this.replaceMethodFirstOccurrence(member.getText(), member.name?.getText()!);
            let fixCode = this.replaceMethodLastOccurrence(newCode, member.type?.type?.getText()!);
            this.reportIssue(member, sourceFile, arkFile, fixCode);
        }
    }

    private reportIssue(member: ts.Node, sourceFile: ts.SourceFile, arkFile: ArkFile, fixText: string, methodBody?: string): void {
        let fix: RuleFix | undefined = {
            range: [member.getStart(), member.getEnd()],
            text: fixText ? fixText + (methodBody ? methodBody : '') : ''
        };
        if (member.getText().includes('=>')) {
            fix = undefined;
        };
        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, member.getStart());
        const defect = this.addIssueReport(arkFile, startPosition.line + 1, startPosition.character + 1, 0, this.metaData.description, fix);
        this.issueMap.set(defect.fixKey, { defect, fix });
    }


    private replaceFirstOccurrence(originalCode: string, methodName: string): string {
        const escapedMethodName = methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedMethodName);
        return originalCode.replace(regex, `${methodName}: `);
    }

    private replaceMethodFirstOccurrence(originalCode: string, methodName: string): string {
        const escapedMethodName = methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${escapedMethodName}\\s*:`);
        return originalCode.replace(regex, `${methodName}`);
    }

    private replaceLastOccurrence(originalCode: string, returnType: string): string {
        if (!returnType) {
            let newCode = originalCode.replace(',', '').replace(';', '');
            newCode += ' => any;';
            return newCode;
        }
        const regex = new RegExp(`:\\s*${returnType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
        const matches = originalCode.match(regex);
        if (matches?.length) {
            const lastIndex = originalCode.lastIndexOf(matches[matches.length - 1]);
            return originalCode.slice(0, lastIndex) + originalCode.slice(lastIndex).replace(regex, ` => ${returnType}`);
        }
        return originalCode;
    }

    private replaceMethodLastOccurrence(originalCode: string, returnType: string): string {
        const regex = new RegExp(`=>\\s*${returnType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
        const matches = originalCode.match(regex);
        if (matches) {
            const lastIndex = originalCode.lastIndexOf(matches[matches.length - 1]);
            return originalCode.slice(0, lastIndex) + originalCode.slice(lastIndex).replace(regex, `: ${returnType}`);
        }
        return originalCode;
    }

    private findDuplicateNamesWithIndices(list: string[]): Map<string, number[]> {
        const nameIndicesMap = new Map<string, number[]>();
        list.forEach((name, index) => {
            if (name !== '') {
                if (nameIndicesMap.has(name)) {
                    nameIndicesMap.get(name)!.push(index);
                } else {
                    nameIndicesMap.set(name, [index]);
                }
            }
        });
        const duplicates = new Map<string, number[]>();
        for (const name of nameIndicesMap.keys()) {
            if (nameIndicesMap.get(name)!.length > 1) {
                duplicates.set(name, nameIndicesMap.get(name)!);
            }
        }
        return duplicates;
    }

    private checkTypeAliasMembers(child: ts.TypeAliasDeclaration | ts.TypeElement, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (!ts.isTypeAliasDeclaration(child) && !ts.isPropertySignature(child)) {
            return;
        }
        if (!ts.isTypeLiteralNode(child.type!)) {
            return;
        }
        const members = child.type.members;
        const nameList = this.buildNameListForTypeAlias(members);
        const duplicateIndices = this.findDuplicateNamesWithIndices(nameList);
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            if (ts.isMethodSignature(member)) {
                this.handleTypeAliasMethodSignature(members, member, duplicateIndices, i, sourceFile, arkFile);
            } else if (ts.isPropertySignature(member)) {
                this.handleTypeAliasPropertySignature(member, sourceFile, arkFile);
            }
        }
    }

    private buildNameListForTypeAlias(members: ts.NodeArray<ts.TypeElement>): string[] {
        let nameList: string[] = [];
        members.forEach((member) => {
            if (this.optionsStyle === 'property') {
                if (ts.isMethodSignature(member)) {
                    nameList.push(member.name.getText());
                } else {
                    nameList.push('');
                }
            }
        });
        return nameList;
    }

    private handleTypeAliasMethodSignature(members: ts.NodeArray<ts.TypeElement>, member: ts.MethodSignature, duplicateIndices: Map<string, number[]>,
        index: number, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (this.optionsStyle === 'property' && !(member.type && ts.isFunctionTypeNode(member.type))) {
            const duplicateList = duplicateIndices.get(member.name.getText());
            if (duplicateList) {
                if (duplicateList[duplicateList.length - 1] === index) {
                    this.processLastDuplicateTypeAliasMethod(members, member, duplicateList, sourceFile, arkFile);
                } else {
                    this.processDuplicateTypeAliasMethod(member, sourceFile, arkFile);
                }
            } else {
                this.processUniqueTypeAliasMethod(member, sourceFile, arkFile);
            }
        }
    }

    private processLastDuplicateTypeAliasMethod(members: ts.NodeArray<ts.TypeElement>, member: ts.MethodSignature, duplicateList: number[],
        sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let code = member.name.getText() + ': ';
        const duplicatesMethodBody = this.collectTypeAliasDuplicatesMethodBody(members, duplicateList, member);
        duplicatesMethodBody.forEach((methodBody) => {
            code += '(' + methodBody + ') & ';
        });
        const fixCode = this.replaceLastOccurrence(member.getText(), member.type?.getText()!);
        const methodBody = this.extractTypeAliasMethodBody(fixCode, member.name.getText());
        code += '(' + methodBody + ');';
        this.reportTypeAliasIssue(member, sourceFile, arkFile, code);
    }

    private collectTypeAliasDuplicatesMethodBody(members: ts.NodeArray<ts.TypeElement>, duplicateList: number[], member: ts.MethodSignature): string[] {
        let duplicatesMethodBody: string[] = [];
        duplicateList.forEach((index) => {
            if (index !== duplicateList[duplicateList.length - 1]) {
                const currentMember = members[index] as ts.MethodSignature;
                const fixCode = this.replaceLastOccurrence(currentMember.getText(), currentMember.type?.getText() ?? '');
                const methodBody = this.extractTypeAliasMethodBody(fixCode, currentMember.name.getText());
                duplicatesMethodBody.push(methodBody);
            }
        });
        return duplicatesMethodBody;
    }

    private extractTypeAliasMethodBody(fixCode: string, methodName: string): string {
        return fixCode.replace(methodName, '').replace(',', '').replace(';', '');
    }

    private processDuplicateTypeAliasMethod(member: ts.MethodSignature, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        const fixCode = this.replaceLastOccurrence(member.getText(), member.type?.getText()!);
        const methodBody = this.extractTypeAliasMethodBody(fixCode, member.name.getText());
        this.reportTypeAliasIssue(member, sourceFile, arkFile, '', methodBody);
    }

    private processUniqueTypeAliasMethod(member: ts.MethodSignature, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        let newCode = this.replaceFirstOccurrence(member.getText(), member.name?.getText()!);
        let fixCode = '';
        if (member.type) {
            fixCode = this.replaceLastOccurrence(newCode, member.type?.getText()!);
        } else {
            fixCode = newCode + ' => any;';
        }
        this.reportTypeAliasIssue(member, sourceFile, arkFile, fixCode);
    }

    private handleTypeAliasPropertySignature(member: ts.PropertySignature, sourceFile: ts.SourceFile, arkFile: ArkFile): void {
        if (this.optionsStyle === 'method' && member.type && ts.isFunctionTypeNode(member.type)) {
            let newCode = this.replaceMethodFirstOccurrence(member.getText(), member.name?.getText()!);
            let fixCode = this.replaceMethodLastOccurrence(newCode, member.type?.type?.getText()!);
            this.reportTypeAliasIssue(member, sourceFile, arkFile, fixCode);
        }
    }

    private reportTypeAliasIssue(member: ts.Node, sourceFile: ts.SourceFile, arkFile: ArkFile, fixText: string, methodBody?: string): void {
        let fix: RuleFix | undefined = {
            range: [member.getStart(), member.getEnd()],
            text: fixText + (methodBody ? methodBody : '')
        };
        if (member.getText().includes('=>')) {
            fix = undefined;
        };
        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, member.getStart());
        const defect = this.addIssueReport(arkFile, startPosition.line + 1, startPosition.character + 1, 0, this.metaData.description, fix);
        this.issueMap.set(defect.fixKey, { defect, fix });
    }

    private getFileExtension(filePath: string, filetype: string): boolean {
        const match = filePath.match(/\.([0-9a-zA-Z]+)$/);
        if (match) {
            const extension = match[1];
            return extension === filetype;
        }
        return false;
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string, fix: RuleFix | undefined) {
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