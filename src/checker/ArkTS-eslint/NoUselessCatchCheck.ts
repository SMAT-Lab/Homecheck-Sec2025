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
import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUselessCatchCheck');
interface WarnInfo {
    line: number;
    character: number;
    endCol: number;
    message: string;
}

export class NoUselessCatchCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private filePath: string = '';
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-useless-catch-check.md',
        description: 'Disallow unnecessary catch clauses.',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [fileMatcher];
    };

    public check = (target: ArkFile): void => {
        this.filePath = target.getFilePath();
        const myInvalidPositions = this.checkAction(target);
        myInvalidPositions.forEach((warnInfo) => {
            this.addIssueReport(warnInfo);
        });
    };

    private checkAction(target: ArkFile): WarnInfo[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
        const warnInfos: WarnInfo[] = [];
        this.traverseAST(sourceFile, warnInfos);
        return warnInfos;
    };

    private traverseAST(node: ts.Node, warnInfos: WarnInfo[]): void {
        if (ts.isCatchClause(node)) {
            this.checkCatchClause(node, warnInfos);
        };
        ts.forEachChild(node, (childNode) => this.traverseAST(childNode, warnInfos));
    };

    private checkCatchClause(node: ts.CatchClause, warnInfos: WarnInfo[]): void {
        if (node.block.statements.length !== 1) {
            return;
        };

        const stmt = node.block.statements[0];
        if (!ts.isThrowStatement(stmt) || !stmt.expression || !ts.isIdentifier(stmt.expression)) {
            return;
        };

        const catchVariable = node.variableDeclaration?.name;
        if (!catchVariable || !ts.isIdentifier(catchVariable) || stmt.expression.text !== catchVariable.text) {
            return;
        };

        this.addWarningForCatchClause(node, warnInfos);
    };

    private addWarningForCatchClause(node: ts.CatchClause, warnInfos: WarnInfo[]): void {
        const parentTryStatement = node.parent;
        if (!ts.isTryStatement(parentTryStatement)) {
            return;
        };

        const { line, character } = node.getSourceFile().getLineAndCharacterOfPosition(
            parentTryStatement.finallyBlock ? node.getStart() : parentTryStatement.getStart()
        );

        warnInfos.push({
            message: parentTryStatement.finallyBlock
                ? 'Unnecessary catch clause'
                : 'Unnecessary try/catch wrapper',
            line: line + 1,
            character: character + 1,
            endCol: character + 1 + (parentTryStatement.finallyBlock
                ? node.getWidth()
                : parentTryStatement.getWidth())
        });
    }

    private addIssueReport(warnInfo: WarnInfo): void {
        this.metaData.description = warnInfo.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(warnInfo.line, warnInfo.character, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
            this.filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };
}
