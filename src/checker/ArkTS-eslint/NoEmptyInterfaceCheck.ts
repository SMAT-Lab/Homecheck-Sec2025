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


import { ts, ArkFile, AstTreeUtils } from "arkanalyzer/lib";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { Defects, IssueReport } from '../../model/Defects';
import { ClassMatcher, FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher } from "../../matcher/Matchers";
import { Utils } from '../../Index';
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { RuleFix } from '../../model/Fix';

const defaultOptions: Options = {
    allowSingleExtends: false
}

interface Options {
    allowSingleExtends?: boolean
}

interface lineColumnInfo {
    line: number,
    character: number
}

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoEmptyInterfaceCheck');
const gmetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-empty-interface-check.md", // TODO: support url
    description: "Disallow the declaration of empty interfaces."
};

export class NoEmptyInterfaceCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gmetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private classMatcher: ClassMatcher = {
        file: [this.fileMatcher],
        matcherType: MatcherTypes.CLASS
    };
    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.classMatcher]
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [matchBuildCb];
    }

    private issueMap: Map<string, IssueReport> = new Map();
    public check = (arkFile: ArkFile): void => {
        // 将规则选项转换为Options类型
        let options: Options;
        if (this.rule && this.rule.option.length > 0) {
            options = this.rule.option[0] as Options;
        } else {
            options = defaultOptions;
        }
        this.checkInterfacesInFile(arkFile, this.metaData, options);
        this.reportSortedIssues();
    }

    private checkInterfacesInFile(file: ArkFile, metaData: BaseMetaData, options: Options): lineColumnInfo[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(file);
        const emptyInterfaces: lineColumnInfo[] = [];
        const traverse = (node: ts.Node): void => {
            if (ts.isInterfaceDeclaration(node) && this.isEmptyInterface(node)) {
                this.handleEmptyInterface(node, file, metaData, sourceFile, emptyInterfaces, options);
            }
            ts.forEachChild(node, traverse);
        };
        traverse(sourceFile);
        return emptyInterfaces;
    }

    private handleEmptyInterface(node: ts.InterfaceDeclaration, file: ArkFile, metaData: BaseMetaData,
        sourceFile: ts.SourceFile, emptyInterfaces: lineColumnInfo[], options: Options): void {
        if (node.heritageClauses) {
            // 如果允许单继承且该接口只有一个继承，则不报告问题
            if (options.allowSingleExtends && node.heritageClauses.length === 1 &&
                node.heritageClauses[0].types.length === 1) {
                return;
            }
            this.handleEmptyInterfaceWithHeritage(node, file, metaData, sourceFile, emptyInterfaces, options);
        } else {
            this.handleEmptyInterfaceWithoutHeritage(node, file, metaData, sourceFile, emptyInterfaces, options);
        }
    }

    private handleEmptyInterfaceWithoutHeritage(node: ts.InterfaceDeclaration, file: ArkFile, metaData: BaseMetaData,
        sourceFile: ts.SourceFile, emptyInterfaces: lineColumnInfo[], options: Options): void {
        metaData.description = 'An empty interface is equivalent to `{}`.';
        const name = node.name;
        const nodeName = node.getText();
        const pos = node.getStart();
        const end = node.getEnd();
        const text = name.getText();
        const fixText = nodeName;
        const start = name.getStart();
        const position = ts.getLineAndCharacterOfPosition(sourceFile, start);
        const line = position.line + 1;
        const character = position.character + 1;
        emptyInterfaces.push({ line, character });
        const defect = this.addIssueReport(file, metaData, { line, character });
        if (fixText && defect) {
            const fix: RuleFix = this.ruleFix(pos, end, fixText);
            this.issueMap.set(defect.fixKey, { defect, fix });
        }
    }

    private handleEmptyInterfaceWithHeritage(node: ts.InterfaceDeclaration, file: ArkFile,
        metaData: BaseMetaData, sourceFile: ts.SourceFile, emptyInterfaces: lineColumnInfo[], options: Options): void {
        metaData.description = 'An interface declaring no members is equivalent to its supertype.';
        const name = node.name;
        const fixText = this.generateFixText(node, node.getText(), name.getText());
        const position = ts.getLineAndCharacterOfPosition(sourceFile, name.getStart());
        const line = position.line + 1;
        const character = position.character + 1;
        emptyInterfaces.push({ line, character });
        const defect = this.addIssueReport(file, metaData, { line, character });
        if (fixText && defect) {
            const fix: RuleFix = this.ruleFix(node.getStart(), node.getEnd(), fixText);
            this.issueMap.set(defect.fixKey, { defect, fix });
        }
    }

    private generateFixText(node: ts.InterfaceDeclaration, nodeText: string, text: string): string | undefined {
        let fixText: string | undefined;
        const baseTypes = node.heritageClauses?.map(clause => clause.types).flat() || [];
        for (const baseType of baseTypes) {
            const baseT = baseType.getText();
            if (nodeText.startsWith('export')) {
                fixText = `export type ${text} = ${baseT}`;
            } else {
                if (nodeText.includes(`${text}<T>`)) {
                    fixText = `type ${text}<T> = ${baseT}`;
                } else {
                    fixText = `type ${text} = ${baseT}`;
                }
            }
        }
        return fixText;
    }

    private isEmptyInterface(node: ts.InterfaceDeclaration): boolean {
        // 如果接口有直接成员，则不是空接口
        if (node.members.length > 0) {
            return false;
        }
        // 获取接口的基类型
        const baseTypes = node.heritageClauses?.map(clause => clause.types).flat() || [];
        // 如果只有一个基类型，认为是空接口
        if (baseTypes.length === 1) {
            return true;
        }
        // 检查所有基类型是否为空接口
        for (const baseType of baseTypes) {
            const baseTypeName = baseType.expression.getText();
            const baseTypeNode = this.findInterfaceNodeByName(baseTypeName, node.getSourceFile());
            if (baseTypeNode && !this.isEmptyInterface(baseTypeNode)) {
                return false;
            }
        }
        // 没有直接成员且所有基类型接口都为空，则当前接口为空
        return true;
    }

    private findInterfaceNodeByName(name: string, sourceFile: ts.SourceFile): ts.InterfaceDeclaration | undefined {
        function traverse(node: ts.Node): ts.InterfaceDeclaration | undefined {
            if (ts.isInterfaceDeclaration(node) && node.name.getText() === name) {
                return node;
            }
            for (const childNode of node.getChildren()) {
                const result = traverse(childNode);
                if (result) {
                    return result;
                }
            }
            return undefined;
        }

        return traverse(sourceFile);
    }

    private ruleFix(pos: number, end: number, fixText: string): RuleFix {
        return { range: [pos, end], text: fixText };
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

    private addIssueReport(arkFile: ArkFile, metaData: BaseMetaData, lineAndColumn: lineColumnInfo): Defects | void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(arkFile, lineAndColumn);
        metaData.description = metaData.description;
        if (warnInfo) {
            const filePath = arkFile.getFilePath();
            let defects = new Defects(warnInfo.line, warnInfo.startCol,
                warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId, filePath,
                this.metaData.ruleDocPath, true, false, true);
            this.defects.push(defects);
            return defects;
        }
    }

    private getLineAndColumn(arkfile: ArkFile, lineColumn: lineColumnInfo): {
        line: number, startCol: number, endCol: number, filePath: string
    } | null {
        if (arkfile) {
            const originPath = arkfile.getFilePath();
            return {
                line: lineColumn.line,
                startCol: lineColumn.character,
                endCol: lineColumn.character,
                filePath: originPath
            };
        } else {
            logger.debug('arkFile is null');
        }
        return null;
    }
}