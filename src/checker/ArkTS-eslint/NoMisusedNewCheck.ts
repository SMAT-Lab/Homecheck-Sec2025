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
import {Defects, Utils} from '../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../Index';
import {Rule} from '../../Index';
import {RuleListUtil} from '../../utils/common/DefectsList';
import {IssueReport} from '../../model/Defects';
import {RuleFix} from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoMisusedNewCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-misused-new-check.md',
    description: 'Enforce valid definition of new and constructor.'
};

export class NoMisusedNewCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private readonly errorMessageInterface = 'Interfaces cannot be constructed, only classes.';
    private readonly errorMessageClass = 'Class cannot have method named `new`.';

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
            if (ts.isMethodDeclaration(child) || ts.isConstructSignatureDeclaration(child)) { // new 函数
                let name: string | undefined = undefined;
                if (child.name) {
                    name = child.name.getText();
                } else {
                    name = child.getChildren()[0].getText();
                }
                if (name === 'new') {
                    this.checkNew(targetFile, sourceFile, child);
                }
            } else if (ts.isMethodSignature(child)) { // constructor 函数
                if (child.name?.getText() === 'constructor') {
                    this.checkConstructor(targetFile, sourceFile, child);
                }
            }
            this.loopNode(targetFile, sourceFile, child);
        }
    }

    // 检查 new 函数
    private checkNew(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): ts.Node | undefined {
        let nameNode: ts.Node | undefined = undefined;
        let lastNode: ts.Node | undefined = undefined;
        let nameFlag = false;
        for (const child of aNode.getChildren()) {
            if (nameFlag) {
                nameNode = child;
                break;
            }
            if (lastNode !== undefined && lastNode.kind === ts.SyntaxKind.CloseParenToken && child.kind === ts.SyntaxKind.ColonToken) {
                nameFlag = true;
            }
            lastNode = child;
        }
        if (!nameNode) {
            return;
        }
        const parentClassNode = this.findParentClassOrInterfaceNode(aNode);
        if (!parentClassNode) {
            return;
        }
        if (ts.isInterfaceDeclaration(parentClassNode)) { // interface C { new(): C; }
            const interfaceName = parentClassNode.name.getText();
            let name = nameNode.getText();
            if (nameNode.getChildren().length > 0) {
                name = nameNode.getChildren()[0].getText();
            }
            if (interfaceName === name) {
                const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
                this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, this.errorMessageInterface, undefined)
            }
        } else if (ts.isClassDeclaration(parentClassNode)) { // class C { new(): C; }
            const className = parentClassNode.name?.getText();
            if (className && className === nameNode.getText()) {
                const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
                this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, this.errorMessageClass, undefined)
            }
        }
    }

    private findParentClassOrInterfaceNode(aNode: ts.Node): ts.Node | undefined {
        let parent = aNode.parent;
        while (parent !== undefined) {
            if (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent)) {
                return parent;
            }

            parent = parent.parent;
        }

        return undefined;
    }

    // 检查 constructor 函数
    private checkConstructor(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const parentClassNode = this.findParentClassOrInterfaceNode(aNode);
        if (!parentClassNode) {
            return;
        }

        if (ts.isInterfaceDeclaration(parentClassNode) || ts.isTypeAliasDeclaration(parentClassNode)) {
            const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
            this.addIssueReport(targetFile, startPosition.line + 1, startPosition.character + 1, 0, this.errorMessageInterface, undefined)
        }
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string, fix: RuleFix | undefined): Defects {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(line, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
        return defect;
    }
}