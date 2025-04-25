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
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'DefaultParamLastCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: "docs/default-param-last-check.md",
    description: "Default parameters should be last.",
};

// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
    fileName: string;
    line: number;
    character: number;
}

export class DefaultParamLastCheck implements BaseChecker {

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
        let code: string | undefined;
        let filePath: string | undefined;
        let startCol: number | null = null;
        let startLine: number | null = null;
        if (target instanceof ArkFile) {
            code = target.getCode();
            filePath = target.getFilePath();
            startLine = 1;
            startCol = 1;
        }
        if (!code || !filePath || !startLine || !startCol) {
            return;
        }
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);

        const issues = this.checkDefaultParamLast(sourceFile, startLine, startCol);
        // 输出结果
        issues.forEach(info => {
            this.addIssueReportNode(info.line, info.character, filePath!);
        });
    }

    private checkDefaultParamLast(sourceFile: ts.SourceFile, startLine: number, startCol: number): LocationInfo[] {
        const result: LocationInfo[] = [];
        const visit: (node: ts.Node) => void = (node: ts.Node) => {
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
                ts.isConstructorDeclaration(node) || ts.isArrowFunction(node)) {

                const parameters = node.parameters;
                this.checkNode(parameters, sourceFile, startLine, startCol, result);
            }
            // 递归遍历子节点
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return result;
    }
    private checkNode(parameters: ts.NodeArray<ts.ParameterDeclaration>, sourceFile: ts.SourceFile,
        startLine: number, startCol: number, result: LocationInfo[]): void {

        for (let i = 0; i < parameters.length; i++) {
            const parameter = parameters[i];
            const isOptional = !!parameter.initializer; // 是否有默认值
            const isDefault = !!parameter.questionToken; // 是否是可选参数
            const isRestParameter = !!ts.isRestParameter(parameter); // 是否是剩余参数;
            if (!isOptional && !isDefault && !isRestParameter) {
                this.checkNodeTwo(i, parameters, sourceFile, startLine, startCol, result);
            }
        }
    }
    private checkNodeTwo(i: number, parameters: ts.NodeArray<ts.ParameterDeclaration>, sourceFile: ts.SourceFile,
        startLine: number, startCol: number, result: LocationInfo[]): void {
        for (let j = i - 1; j >= 0; j--) {
            const parameter2 = parameters[j];
            if (parameter2.initializer || parameter2.questionToken) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(parameters[j].getStart());
                result.push({
                    fileName: sourceFile.fileName,
                    line: startLine + line,
                    character: startCol + character,
                });
            }
        }
    }
    private addIssueReportNode(line: number, startCol: number, filePath: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(line, startCol, startCol, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}
