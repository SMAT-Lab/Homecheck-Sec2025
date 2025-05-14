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

import { ArkFile, AstTreeUtils, ts } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnnecessaryTypeArgumentsCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/no-unnecessary-type-arguments.md",
    description: "This is the default value for this type parameter, so it can be omitted.",
};

// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
    fileName: string;
    line: number;
    startCol: number;
    endCol: number;
    start: number;
    end: number;
    typeParamName: string;
    defaultType: string;
    argType: string;
}

export class NoUnnecessaryTypeArgumentsCheck implements BaseChecker {
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
        };
        return [fileMatcherCb];
    }

    public check = (arkFile: ArkFile) => {
        if (arkFile instanceof ArkFile) {
            const code = arkFile.getCode();
            if (!code) {
                return;
            }
            const filePath = arkFile.getFilePath();
            const asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
            // 检查泛型类型
            const locations = this.checkGenericTypes(asRoot);
            locations.forEach((loc) => {
                this.addIssueReportNodeFix(loc, filePath);
            });
        }
    }

    private checkGenericTypes(sourceFile: ts.SourceFile): LocationInfo[] {
        const results: LocationInfo[] = [];
        const typeParameterDefaults: Map<string, Map<string, string>> = new Map();

        const visit = (node: ts.Node) => {
            // 检查函数声明
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                this.checkFunctionDeclaration(node, sourceFile, typeParameterDefaults, results);
            }

            // 检查类声明
            if (ts.isClassDeclaration(node)) {
                this.checkClassDeclaration(node, sourceFile, typeParameterDefaults, results);
            }

            // 检查接口实现
            if (ts.isInterfaceDeclaration(node)) {
                this.checkInterfaceDeclaration(node, sourceFile, typeParameterDefaults, results);
            }

            // 检查 CallExpression
            if (ts.isCallExpression(node)) {
                this.checkCallExpression(node, sourceFile, typeParameterDefaults, results);

            }

            // 检查 NewExpression
            if (ts.isNewExpression(node)) {
                this.checkNewExpression(node, sourceFile, typeParameterDefaults, results);

            }
            if (ts.isModuleDeclaration(node)) {
                return;
            }
            // 检查类型别名
            if (ts.isTypeAliasDeclaration(node)) {
                this.checkTypeAliasDeclaration(node, sourceFile, typeParameterDefaults, results);
            }

            // 检查类型引用
            if (ts.isTypeReferenceNode(node)) {
                this.checkTypeReference(node, sourceFile, typeParameterDefaults, results);
            }

            // 递归遍历子节点
            ts.forEachChild(node, visit);
        };


        visit(sourceFile);
        return results;
    }
    private checkInterfaceDeclaration(node: ts.InterfaceDeclaration, sourceFile: ts.SourceFile,
        typeParameterDefaults: Map<string, Map<string, string>>, results: LocationInfo[]): void {
        if (node.typeParameters) {
            const interfaceName = node.name?.getText(sourceFile) || '';
            const defaults = new Map<string, string>();
            for (const typeParam of node.typeParameters) {
                if (typeParam.default) {
                    const typeParamName = typeParam.name.getText(sourceFile);
                    const defaultTypeText = typeParam.default.getText(sourceFile);
                    defaults.set(typeParamName, defaultTypeText);
                }
            }
            typeParameterDefaults.set(interfaceName, defaults);
        }
    }
    private checkTypeAliasDeclaration(node: ts.TypeAliasDeclaration, sourceFile: ts.SourceFile,
        typeParameterDefaults: Map<string, Map<string, string>>, results: LocationInfo[]): void {
        if (node.typeParameters) {
            const typeName = node.name.getText(sourceFile);
            const defaults = new Map<string, string>();
            for (const typeParam of node.typeParameters) {
                if (typeParam.default) {
                    const typeParamName = typeParam.name.getText(sourceFile);
                    const defaultTypeText = typeParam.default.getText(sourceFile);
                    defaults.set(typeParamName, defaultTypeText);
                }
            }
            typeParameterDefaults.set(typeName, defaults);
        }
        // 递归检查类型别名的类型
        if (ts.isTypeReferenceNode(node.type)) {
            this.checkTypeReference(node.type, sourceFile, typeParameterDefaults, results);
        }
    }

    private checkFunctionDeclaration(node: ts.FunctionDeclaration | ts.MethodDeclaration, sourceFile: ts.SourceFile,
        typeParameterDefaults: Map<string, Map<string, string>>, results: LocationInfo[]): void {
        if (node.typeParameters) {
            const functionName = node.name?.getText(sourceFile) || '';
            const defaults = new Map<string, string>();
            for (const typeParam of node.typeParameters) {
                if (typeParam.default) {
                    const typeParamName = typeParam.name.getText(sourceFile);
                    const defaultTypeText = typeParam.default.getText(sourceFile);
                    defaults.set(typeParamName, defaultTypeText);
                }
            }
            typeParameterDefaults.set(functionName, defaults);
        }
    }
    private checkClassDeclaration(node: ts.ClassDeclaration, sourceFile: ts.SourceFile,
        typeParameterDefaults: Map<string, Map<string, string>>, results: LocationInfo[]): void {
        if (node.typeParameters) {
            const className = node.name?.getText(sourceFile) || '';
            const defaults = new Map<string, string>();
            for (const typeParam of node.typeParameters) {
                if (typeParam.default) {
                    const typeParamName = typeParam.name.getText(sourceFile);
                    const defaultTypeText = typeParam.default.getText(sourceFile);
                    defaults.set(typeParamName, defaultTypeText);
                }
            }
            typeParameterDefaults.set(className, defaults);
        }

        // 检查类继承
        if (!node.heritageClauses) {
            return;
        }
        for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword ||
                clause.token === ts.SyntaxKind.ImplementsKeyword
            ) {
                this.checkClassDeclarationClause(clause, sourceFile, typeParameterDefaults, results);
            }
        }
    }

    private checkClassDeclarationClause(clause: ts.HeritageClause,
        sourceFile: ts.SourceFile,
        typeParameterDefaults: Map<string, Map<string, string>>,
        results: LocationInfo[]
    ): void {
        for (const type of clause.types) {
            if (!ts.isExpressionWithTypeArguments(type)) {
                continue;
            }
            const expression = type.expression;
            let className = '';
            if (ts.isIdentifier(expression)) {
                className = expression.text;
            } else if (ts.isPropertyAccessExpression(expression)) {
                className = expression.name.text;
            }

            const typeArguments = type.typeArguments;
            const defaults = typeParameterDefaults.get(className);
            if (!defaults || !typeArguments) {
                continue;
            }
            const lastIndex = typeArguments.length - 1;
            const lastTypeArg = typeArguments[lastIndex];
            const typeParamName = Array.from(defaults.keys())[lastIndex] || `T${lastIndex + 1}`;
            const defaultType = defaults.get(typeParamName) || '';
            const argType = lastTypeArg.getText(sourceFile);
            let start = 0;
            let end = 0;
            if (argType === defaultType) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(lastTypeArg.getStart());
                const endCharacter = character + lastTypeArg.getWidth();
                if (typeArguments.length < 2) {
                    start = this.findLastCommaStartPosition(sourceFile, lastTypeArg);
                    end = this.findLastCommaEndPosition(sourceFile, lastTypeArg);
                } else {
                    start = this.findLastCommaStartPosition(sourceFile, lastTypeArg);
                    end = endCharacter;
                }
                results.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    startCol: character + 1,
                    endCol: endCharacter,
                    start: start,
                    end: end,
                    typeParamName: typeParamName,
                    defaultType: defaultType,
                    argType: argType,
                });
            }
        }
    }
    private checkCallExpression(node: ts.CallExpression,
        sourceFile: ts.SourceFile,
        typeParameterDefaults: Map<string, Map<string, string>>,
        results: LocationInfo[]
    ): void {
        const expression = node.expression;
        let functionName = '';
        if (ts.isIdentifier(expression)) {
            functionName = expression.text;
        } else if (ts.isPropertyAccessExpression(expression)) {
            functionName = expression.name.text;
        }

        const typeArguments = node.typeArguments;
        const defaults = typeParameterDefaults.get(functionName);
        if (!defaults || !typeArguments) {
            return;
        }
        // 只检查最后一个类型参数
        const lastIndex = typeArguments.length - 1;
        const lastTypeArg = typeArguments[lastIndex];
        const typeParamName = Array.from(defaults.keys())[lastIndex] || `T${lastIndex + 1}`;
        const defaultType = defaults.get(typeParamName) || '';
        const argType = lastTypeArg.getText(sourceFile);
        let start = 0;
        let end = 0;
        if (argType === defaultType) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(lastTypeArg.getStart());
            const endCharacter = character + lastTypeArg.getWidth();
            if (typeArguments.length < 2) {
                start = this.findLastCommaStartPosition(sourceFile, lastTypeArg);
                end = this.findLastCommaEndPosition(sourceFile, lastTypeArg);
            } else {
                start = this.findLastCommaStartPosition(sourceFile, lastTypeArg);
                end = this.findLastCommaEndPosition(sourceFile, lastTypeArg) - 1;
            }
            results.push({
                fileName: sourceFile.fileName,
                line: line + 1,
                startCol: character + 1,
                endCol: endCharacter,
                start: start,
                end: end,
                typeParamName: typeParamName,
                defaultType: defaultType,
                argType: argType,
            });
        }
    }

    private checkNewExpression(node: ts.NewExpression,
        sourceFile: ts.SourceFile,
        typeParameterDefaults: Map<string, Map<string, string>>,
        results: LocationInfo[]
    ): void {
        const expression = node.expression;
        let className = '';
        if (ts.isIdentifier(expression)) {
            className = expression.text;
        } else if (ts.isPropertyAccessExpression(expression)) {
            className = expression.name.text;
        }

        const typeArguments = node.typeArguments;
        const defaults = typeParameterDefaults.get(className);
        if (defaults && typeArguments) {
            // 只检查最后一个类型参数
            const lastIndex = typeArguments.length - 1;
            const lastTypeArg = typeArguments[lastIndex];
            const typeParamName = Array.from(defaults.keys())[lastIndex] || `T${lastIndex + 1}`;
            const defaultType = defaults.get(typeParamName) || '';
            const argType = lastTypeArg.getText(sourceFile);
            let start = 0;
            let end = 0;
            if (argType === defaultType) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(lastTypeArg.getStart());
                const endCharacter = character + lastTypeArg.getWidth();
                if (typeArguments.length < 2) {
                    start = this.findLastCommaStartPosition(sourceFile, lastTypeArg);
                    end = this.findLastCommaEndPosition(sourceFile, lastTypeArg);
                } else {
                    start = this.findLastCommaStartPosition(sourceFile, lastTypeArg);
                    end = this.findLastCommaEndPosition(sourceFile, lastTypeArg) - 1;
                }

                results.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    startCol: character + 1,
                    endCol: endCharacter,
                    start: start,
                    end: end,
                    typeParamName: typeParamName,
                    defaultType: defaultType,
                    argType: argType,
                });
            }
        }
    }
    // 检查类型引用的逻辑
    private checkTypeReference(node: ts.TypeReferenceNode,
        sourceFile: ts.SourceFile,
        typeParameterDefaults: Map<string, Map<string, string>>,
        results: LocationInfo[]
    ): void {
        const typeName = node.typeName.getText(sourceFile);
        const typeArguments = node.typeArguments;
        const defaults = typeParameterDefaults.get(typeName);
        if (defaults && typeArguments) {
            // 只检查最后一个类型参数
            const lastIndex = typeArguments.length - 1;
            const lastTypeArg = typeArguments[lastIndex];
            const typeParamName = Array.from(defaults.keys())[lastIndex] || `T${lastIndex + 1}`;
            const defaultType = defaults.get(typeParamName) || '';
            const argType = lastTypeArg.getText(sourceFile);
            let start = 0;
            let end = 0;
            if (argType === defaultType) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(lastTypeArg.getStart());
                const endCharacter = character + lastTypeArg.getWidth();
                if (typeArguments.length < 2) {
                    start = this.findLastCommaStartPosition(sourceFile, lastTypeArg);
                    end = this.findLastCommaEndPosition(sourceFile, lastTypeArg);
                } else {
                    start = this.findLastCommaStartPosition(sourceFile, lastTypeArg);
                    end = this.findLastCommaEndPosition(sourceFile, lastTypeArg) - 1;
                }
                results.push({
                    fileName: sourceFile.fileName,
                    line: line + 1,
                    startCol: character + 1,
                    endCol: endCharacter,
                    start: start,
                    end: end,
                    typeParamName: typeParamName,
                    defaultType: defaultType,
                    argType: argType,
                });
            }
        }
    }

    // 查找最后一个类型参数前面的逗号或尖括号开始的位置
    private findLastCommaStartPosition(sourceFile: ts.SourceFile, lastTypeArg: ts.TypeNode): number {
        const text = sourceFile.getFullText();
        const position = lastTypeArg.getStart();
        // 向前查找逗号或尖括号
        for (let i = position - 1; i >= 0; i--) {
            const char = text[i];
            if (char === ',' || char === '<') {
                return i;
            }
        }
        return position;
    }

    // 查找最后一个类型参数前面的逗号或尖括号结束的位置
    private findLastCommaEndPosition(sourceFile: ts.SourceFile, lastTypeArg: ts.TypeNode): number {
        const text = sourceFile.getFullText();
        const position = lastTypeArg.getEnd(); // 从最后一个类型参数的结束位置开始查找

        // 向后查找尖括号
        for (let i = position; i < text.length; i++) {
            const char = text[i];
            if (char === '>') {
                return i + 1; // 返回尖括号的位置
            }
        }

        return position + 1; // 如果没有找到尖括号，返回最后一个类型参数的结束位置
    }

    // 创建修复对象 
    private ruleFix(loc: LocationInfo): RuleFix {
        return { range: [loc.start, loc.end], text: '' };
    }

    private addIssueReportNodeFix(loc: LocationInfo, filePath: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(loc.line, loc.startCol, loc.endCol, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
        let fix: RuleFix = this.ruleFix(loc);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    }
}