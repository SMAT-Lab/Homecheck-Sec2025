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

import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { MatcherCallback, MatcherTypes, FileMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

type Options = [{
    max: number;
}]
const MAX_DEPTH = 10;
interface Issue {
    line: number;
    column: number;
    columnEnd: number;
    message: string;
    filePath: string,
}
interface CallbackInfo {
    depth: number;
    node: ts.Node;
}

export class MaxNestedCallbacksCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/max-nested-callbacks-check.md',
        description: 'Maximum allowed is 10'
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private defaultOptions: Options = [{ 'max': MAX_DEPTH }];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };
    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    };
    public check = (target: ArkFile) => {
        this.defaultOptions = this.rule && this.rule.option[0] ? this.rule.option as Options : this.defaultOptions;
        if (target instanceof ArkFile) {
            this.checkCallbackDepth(target, (this.defaultOptions[0].max ?? MAX_DEPTH));
        }
    };

    private checkCallbackDepth(arkFile: ArkFile, max: number): void {
        // 解析代码段为AST树对象
        const methodAst = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        const stack: CallbackInfo[] = [];
        const visitedNodes = new Set<ts.Node>();
        const checkNode = (node: ts.Node): void => {
            if (visitedNodes.has(node)) {
                return;
            };
            visitedNodes.add(node);
            if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
                const parent = node.parent;
                // 确保是作为参数传递的函数（回调）
                if (parent && ts.isCallExpression(parent) && parent.arguments.includes(node)) {
                    stack.push({ depth: stack.length + 1, node });
                    this.createIssue(node, arkFile, stack, max, methodAst);
                };
            };
            ts.forEachChild(node, checkNode);
            if (stack.length > 0 && stack[stack.length - 1]?.node === node) {
                stack.pop();
            };
        };
        checkNode(methodAst);
    };

    private createIssue(node: ts.ArrowFunction | ts.FunctionExpression, arkFile: ArkFile, stack: CallbackInfo[], max: number, methodAst: ts.SourceFile): void {
        if (stack.length > max) {
            const start = node.getStart(methodAst);
            const { line, character } = methodAst.getLineAndCharacterOfPosition(start);
            const issue: Issue = {
                line: line + 1,
                column: character + 1,
                columnEnd: character + 1 + (node.getEnd() - start),
                message: `Too many nested callbacks (${stack.length}). Maximum allowed is ${max}`,
                filePath: arkFile.getFilePath() ?? ''
            };
            this.addIssueReport(issue);
        }
    };

    private addIssueReport(issue: Issue): void {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defects = new Defects(issue.line, issue.column, issue.columnEnd, this.metaData.description, severity, this.rule.ruleId, issue.filePath,
            this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
        RuleListUtil.push(defects);
    };
}
