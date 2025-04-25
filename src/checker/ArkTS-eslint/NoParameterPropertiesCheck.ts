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
import {ArkFile, AstTreeUtils, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../BaseChecker';
import {Defects} from '../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../Index';
import {Rule} from '../../Index';
import {RuleListUtil} from '../../utils/common/DefectsList';
import {IssueReport} from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoParameterPropertiesCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-parameter-properties-check.md',
    description: 'Property name should be declared as a class property.'
};

type Options = [{
    allow: string[]
}];

export class NoParameterPropertiesCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    private allows: string[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        if (!targetFile.getFilePath().endsWith('.ts')) {
            return;
        }

        if (this.rule && this.rule.option) {
            const option = this.rule.option as Options;
            if (option.length > 0) {
                this.allows = option[0].allow;
            }
        }

        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject === undefined) {
            return;
        }

        this.loopNode(targetFile, sourceFile, sourceFileObject);
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isParameter(child)) {
                this.checkParameter(targetFile, sourceFile, child);
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkParameter(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        if (children.length === 0) {
            return;
        }

        const firstNode = children[0];
        if (firstNode.kind !== ts.SyntaxKind.SyntaxList) {
            return;
        }

        const keyword = firstNode.getText();
        if (this.allows.includes(keyword)) {
            return;
        }

        // 关键字前面含有@的不报错 constructor(@Foo foo: string) { super(foo); }
        if (keyword.startsWith('@')) {
            return;
        }

        // 参数中含有...的不报错 class Foo { constructor(private ...name: string[]) {} }
        for (const child of children) {
            if (child.kind === ts.SyntaxKind.DotDotDotToken) {
                return;
            }
        }

        // 参数名是数组的不报错 class Foo { constructor(private [test]: [string]) {} }
        if (children[1].kind === ts.SyntaxKind.ArrayBindingPattern) {
            return;
        }

        let name = 'name';
        if (ts.isParameter(aNode)) {
            name = aNode.name.getText();
        }

        const message = 'Property ' + name + ' cannot be declared in the constructor.';
        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, firstNode.getStart());
        const startLine = startPosition.line + 1;
        const startCol = startPosition.character + 1;
        this.addIssueReport(targetFile, startLine, startCol, 0, message);
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}