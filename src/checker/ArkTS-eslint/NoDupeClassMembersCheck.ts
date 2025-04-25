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

import { ArkFile, ts, AstTreeUtils } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher } from '../../Index';
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoDupeClassMembersCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/no-dupe-class-members-check.md",
    description: "Disallow duplicate class members.",
};

// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
    fileName: string;
    line: number;
    character: number;
    description: string;
}

export class NoDupeClassMembersCheck implements BaseChecker {

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
            const code = target.getCode().replace(/!\s*class\s+/g, 'class ');
            if (!code) {
                return;
            }
            const filePath = target.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
            // 检查类中的重名成员
            const issues = this.checkDuplicateClassMembers(sourceFile);
            // 输出结果
            issues.forEach(info => {
                this.addIssueReportNode(info, filePath);
            });
        }
    }
    // 检查类中是否有重名的成员
    private checkDuplicateClassMembers(sourceFile: ts.SourceFile): LocationInfo[] {
        const result: LocationInfo[] = [];
        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            this.checkClassDeclaration(sourceFile, node, result);
            // 递归遍历子节点
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return result;
    }
    private checkClassDeclaration(sourceFile: ts.SourceFile,
        node: ts.Node,
        result: LocationInfo[]): void {
        if (ts.isClassDeclaration(node)) {
            const memberMap = new Map<string, { name: string; kind: string; signature: string; isStatic: boolean; location: ts.Node }[]>();

            node.members.forEach(member => {
                let memberName: string | undefined;
                let memberKind: string = '';
                let signature = '';
                let isStatic = false;

                if (ts.isMethodDeclaration(member)) {
                    memberName = this.normalizeMemberName(member.name.getText(sourceFile), member);
                    memberKind = 'method';
                    signature = this.getMethodSignature(member);
                    isStatic = !!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
                } else if (ts.isPropertyDeclaration(member)) {
                    memberName = this.normalizeMemberName(member.name.getText(sourceFile), member);
                    memberKind = 'Property';
                    isStatic = !!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
                } else if (ts.isGetAccessorDeclaration(member)) {
                    memberName = this.normalizeMemberName(member.name.getText(sourceFile), member);
                    memberKind = 'setter';
                    isStatic = !!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
                } else if (ts.isSetAccessorDeclaration(member)) {
                    memberName = this.normalizeMemberName(member.name.getText(sourceFile), member);
                    memberKind = 'setter';
                    signature = this.getAccessorSignature(member);
                    isStatic = !!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
                }

                if (memberName) {
                    // 检查是否已经存在同名成员
                    const existingMembers = memberMap.get(memberName) || [];
                    const isDuplicateName = existingMembers.some(m => m.name === memberName);
                    const isDuplicateSignature = existingMembers.some(m => m.signature === signature);
                    const isDuplicateType = existingMembers.some(m => m.kind === memberKind);
                    const isDuplicateStatic = existingMembers.some(m => m.isStatic === isStatic);

                    this.checkMemberName(sourceFile, isDuplicateName, isDuplicateSignature, isDuplicateType, isDuplicateStatic, memberName,
                        member, result);
                    // 将当前成员加入到映射中
                    existingMembers.push({ name: memberName, kind: memberKind, signature, isStatic, location: member });
                    memberMap.set(memberName, existingMembers);
                }
            });
        }
    }

    private checkMemberName(sourceFile: ts.SourceFile,
        isDuplicateName: boolean,
        isDuplicateSignature: boolean,
        isDuplicateType: boolean,
        isDuplicateStatic: boolean,
        memberName: string,
        member: ts.ClassElement,
        result: LocationInfo[]): void {
        if (!isDuplicateName) {
            return;
        }
        if (isDuplicateType) {
            if (isDuplicateSignature) {
                if (!isDuplicateStatic) {
                    return;
                }
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(member.getStart());
                result.push({
                    fileName: sourceFile.fileName,
                    line: line + 1, // 行号从1开始
                    character: character + 1, // 列号从1开始
                    description: `Duplicate name '${memberName}'.`
                });
            }
            // 如果有重名成员，记录问题
        } else {
            if (!isDuplicateStatic) {
                return;
            }
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(member.getStart());
            result.push({
                fileName: sourceFile.fileName,
                line: line + 1, // 行号从1开始
                character: character + 1, // 列号从1开始
                description: `Duplicate name '${memberName}'.`
            });
        }
    }

    // 标准化成员名称
    private normalizeMemberName(memberName: string, member: ts.ClassElement): string {
        if (member.name) {
            if (ts.isNumericLiteral(member.name)) {
                // 将数值名称解析为数值后再转换为字符串
                const numericValue = parseFloat(member.name.getText());
                return numericValue.toString();
            } else if (ts.isIdentifier(member.name)) {
                return member.name.text;
            }
        }
        return memberName.replace(/'/g, '');
    }

    // 获取方法签名
    private getMethodSignature(method: ts.MethodDeclaration): string {
        const parameters = method.parameters.map(param => param.getText()).join(', ');
        const returnType = method.type ? method.type.getText() : 'void';
        return `(${parameters}): ${returnType}`;
    }

    // 获取访问器签名
    private getAccessorSignature(accessor: ts.AccessorDeclaration): string {
        const parameters = accessor.parameters.map(param => param.getText()).join(', ');
        const returnType = accessor.type ? accessor.type.getText() : 'void';
        return `(${parameters}): ${returnType}`;
    }

    private addIssueReportNode(info: LocationInfo, filePath: string): void {
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