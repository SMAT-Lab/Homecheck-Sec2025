/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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

import { ArkFile, AstTreeUtils, LineColPosition, ts } from 'arkanalyzer';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ArrayTypeCheck');
const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/array-type-check.md',
    description: 'Require consistently using either `T[]` or `Array<T>` for arrays.'
};

export class ArrayTypeCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private buildMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.buildMatcher,
            callback: this.check
        };
        return [matchBuildCb];
    }

    public check = (arkFile: ArkFile): void => {
        let astRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        for (let child of astRoot.statements) {
            if (ts.isVariableStatement(child)) {
                this.processStmtAst(child, arkFile);
            }
        }
    };

    private processStmtAst(child: ts.VariableStatement, arkFile: ArkFile): void {
        let declarationList = child.declarationList.declarations;
        for (let declaration of declarationList) {
            if (!ts.isVariableDeclaration(declaration)) {
                continue;
            }
            let type = declaration.type;
            if (!type || !ts.isTypeReferenceNode(type)) {
                continue;
            }
            const typeName = type.typeName;
            let typeText = typeName.getText();
            if (typeText !== 'ReadonlyArray' && typeText !== 'Array') {
                continue;
            }
            let args = type.typeArguments;
            if (!args || args.length === 0) {
                continue;
            }
            let readonlyPrefix = (typeText === 'ReadonlyArray') ? 'readonly ' : '';
            let typePrefix = 'any';
            let arg0 = args[0];
            if (arg0.kind === ts.SyntaxKind.StringKeyword) {
                typePrefix = 'string';
            } else if (arg0.kind === ts.SyntaxKind.NumberKeyword) {
                typePrefix = 'number';
            } else if (arg0.kind === ts.SyntaxKind.SymbolKeyword) {
                typePrefix = 'symbol';
            } else if (arg0.kind === ts.SyntaxKind.ObjectKeyword) {
                typePrefix = 'object';
            } else if (ts.isTypeReferenceNode(arg0)) {
                typePrefix = arg0.typeName?.getText() ?? 'any';
            }
            let sourceFile = AstTreeUtils.getASTNode(arkFile.getName(), arkFile.getCode());
            const originTsPosition = LineColPosition.buildFromNode(type, sourceFile);
            let defect = this.createDefect(arkFile, originTsPosition, type.getText());
            let fixKeyword = `${readonlyPrefix}${typePrefix}[]`;
            let ruleFix = this.createFix(type, fixKeyword);
            this.issues.push(new IssueReport(defect, ruleFix));
        }
    }

    private createDefect(arkFile: ArkFile, originTsPosition: LineColPosition, keyword: string): Defects {
        const filePath = arkFile.getFilePath();
        let lineNum = originTsPosition.getLineNo();
        let startColum = originTsPosition.getColNo();
        let endColumn = originTsPosition.getColNo() + keyword.length - 1;
        const severity = this.rule.alert ?? this.metaData.severity;
        return new Defects(lineNum, startColum, endColumn, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
    }

    private createFix(child: ts.Node, code: string): RuleFix {
        return { range: [child.getStart(), child.getEnd()], text: code };
    }
}