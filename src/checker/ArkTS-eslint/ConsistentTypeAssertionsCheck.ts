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
import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, Utils } from '../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../Index';
import { Rule } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ConsistentTypeAssertionsCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/consistent-type-assertions-check.md',
    description: 'Enforce consistent usage of type assertions.'
};

enum AssertionStyle {
    angleBracket = 0,
    as = 1,
    never = 2
}

enum ObjectLiteralTypeAssertions {
    allowAsParameter = 0,
    allow = 1,
    never = 2
}

type RuleOptions = {
    assertionStyle: AssertionStyle,
    objectLiteralTypeAssertions: ObjectLiteralTypeAssertions
}

type Options = {
    assertionStyle: string,
    objectLiteralTypeAssertions: string
}

type FixInformation = {
    message: string,
    fix: RuleFix | undefined
}

export class ConsistentTypeAssertionsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private issueMap: Map<string, IssueReport> = new Map();
    private ruleOptions: RuleOptions = { assertionStyle: AssertionStyle.as, objectLiteralTypeAssertions: ObjectLiteralTypeAssertions.allow }

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
        let options = this.rule.option;
        if (options.length > 0) {
            const option = options[0] as Options;
            if (option.assertionStyle === 'angle-bracket') {
                this.ruleOptions.assertionStyle = AssertionStyle.angleBracket;
            } else if (option.assertionStyle === 'as') {
                this.ruleOptions.assertionStyle = AssertionStyle.as;
            }
            if (option.objectLiteralTypeAssertions === 'allow') {
                this.ruleOptions.objectLiteralTypeAssertions = ObjectLiteralTypeAssertions.allow;
            } else if (option.objectLiteralTypeAssertions === 'allow-as-parameter') {
                this.ruleOptions.objectLiteralTypeAssertions = ObjectLiteralTypeAssertions.allowAsParameter;
            } else if (option.objectLiteralTypeAssertions === 'never') {
                this.ruleOptions.objectLiteralTypeAssertions = ObjectLiteralTypeAssertions.never;
            }
        }

        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        if (sourceFileObject === undefined) {
            return;
        }

        this.issueMap.clear();

        this.loopNode(targetFile, sourceFile, sourceFileObject);

        this.reportSortedIssues();
    }

    public loopNode(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const children = aNode.getChildren();
        for (const child of children) {
            if (ts.isAsExpression(child) || ts.isTypeAssertionExpression(child)) {
                this.checkExpression(targetFile, sourceFile, child);
            }

            this.loopNode(targetFile, sourceFile, child);
        }
    }

    private checkExpression(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        if (aNode.parent && aNode.parent.kind === ts.SyntaxKind.Parameter) {
            return;
        }
        const children = aNode.getChildren();
        let message: string | undefined = undefined;
        let fix: RuleFix | undefined = undefined;
        if (this.ruleOptions.assertionStyle === AssertionStyle.never) {
            if (ts.isTypeAssertionExpression(aNode)) {
                if (children[1].getText() === 'const') {
                    return;
                }
            }
            message = 'Do not use any type assertions.';
        } else {
            let objectNode: ts.Node | undefined = undefined;
            if (ts.isTypeAssertionExpression(aNode)) {
                if (children.length >= 2) {
                    objectNode = children[children.length - 1];
                }
            } else if (ts.isAsExpression(aNode)) {
                if (children.length !== 3) {
                    return;
                }
                objectNode = children[0];
                // fix
                fix = { range: [children[1].getStart(), children[1].getEnd()], text: 'satisfies' };
            }
            if (objectNode !== undefined) {
                // 对象类型的强转，例如{ bar: 5 } as Foo
                const result = this.getObjectLiteralFix(aNode, objectNode, children);
                if (result.fix) {
                    fix = result.fix;
                }
                if (result.message) {
                    message = result.message;
                }
            }
            if (message === undefined) {
                const result = this.getFixInfo(aNode);
                if (result.fix) {
                    fix = result.fix;
                }
                if (result.message) {
                    message = result.message;
                }
            }
        }
        this.reportIssue(targetFile, sourceFile, aNode, message, fix);
    }

    private reportIssue(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node, message: string | undefined, fix: RuleFix | undefined): void {
        if (message !== undefined) {
            const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
            const startLine = startPosition.line + 1;
            const startCol = startPosition.character + 1;
            const defect = this.addIssueReport(targetFile, startLine, startCol, 0, message, fix);

            if (fix !== undefined) {
                this.issueMap.set(defect.fixKey, { defect, fix });
            }
        }
    }

    private getObjectLiteralFix(aNode: ts.Node, objectNode: ts.Node, children: ts.Node[]): { message: string | undefined, fix: RuleFix | undefined } {
        let message: string | undefined = undefined;
        let fix: RuleFix | undefined = undefined;
        const objNode = this.getTypeNode(objectNode);
        if (!ts.isObjectLiteralExpression(objNode)) {
            return { message: undefined, fix: undefined };
        }
        // 对象类型不允许强转
        if (this.ruleOptions.objectLiteralTypeAssertions === ObjectLiteralTypeAssertions.never) {
            message = 'Always prefer const x: T = { ... }.';
        } else if (this.ruleOptions.objectLiteralTypeAssertions === ObjectLiteralTypeAssertions.allowAsParameter) {
            // 只允许作为参数时强转
            if (aNode.parent.kind === ts.SyntaxKind.NewExpression ||
                aNode.parent.kind === ts.SyntaxKind.CallExpression ||
                aNode.parent.kind === ts.SyntaxKind.ThrowStatement) {
                if ((ts.isTypeAssertionExpression(aNode) && this.ruleOptions.assertionStyle === AssertionStyle.angleBracket) ||
                    (ts.isAsExpression(aNode) && this.ruleOptions.assertionStyle === AssertionStyle.as)) {
                    return { message, fix };
                }
            } else {
                message = 'Always prefer const x: T = { ... }.';

                // fix
                if (!ts.isTypeAssertionExpression(aNode)) {
                    return { message, fix };
                }
                if (this.ruleOptions.assertionStyle === AssertionStyle.angleBracket) {
                    const fixText = children[children.length - 1].getText() + ' satisfies ' + children[1].getText();
                    fix = { range: [aNode.getStart(), aNode.getEnd()], text: fixText };
                } else if (this.ruleOptions.assertionStyle === AssertionStyle.as) {
                    const fixInfo = this.getTypeFixInfo(aNode);
                    if (fixInfo) {
                        message = fixInfo.message;
                        fix = fixInfo.fix;
                    }
                }
            }
        }
        return { message, fix };
    }

    private getFixInfo(aNode: ts.Node): { message: string | undefined, fix: RuleFix | undefined } {
        let message: string | undefined;
        let fix: RuleFix | undefined;
        if (this.ruleOptions.assertionStyle === AssertionStyle.as) {
            if (ts.isTypeAssertionExpression(aNode)) {
                const fixInfo = this.getTypeFixInfo(aNode);
                if (fixInfo) {
                    message = fixInfo.message;
                    fix = fixInfo.fix;
                }
            }
        } else if (this.ruleOptions.assertionStyle === AssertionStyle.angleBracket) {
            if (ts.isAsExpression(aNode)) {
                const children = aNode.getChildren();
                if (children.length === 3) {

                    const typeNode = children[2];
                    const typeName = typeNode.getText();
                    message = "Use '<" + typeName + ">' instead of 'as " + typeName + "'.";
                }
            }
        }
        return { message, fix };
    }

    private getTypeFixInfo(aNode: ts.Node): FixInformation | undefined {
        const aNodeChildren = aNode.getChildren();
        // 找到尖括号内的类型
        if (aNodeChildren.length !== 4) {
            return;
        }

        const typeNode = aNodeChildren[1];
        const realNode = this.removeBracket(typeNode);
        if (realNode === undefined) {
            return;
        }

        const typeName = realNode.getText();
        const message = "Use 'as " + typeName + "' instead of '<" + typeName + ">'.";

        // fix
        const hasOperation = this.needBracket(aNode);
        const nameNode = this.getTypeNode(aNodeChildren[3])
        const fixText = (hasOperation ? '(' : '') + nameNode.getText() + ' as ' + typeName + (hasOperation ? ')' : '');
        const fix: RuleFix = { range: [aNode.getStart(), aNode.getEnd()], text: fixText };

        return { message, fix };
    }

    // 修复的节点是否需要加括号
    private needBracket(aNode: ts.Node): boolean {
        const parent = aNode.parent;
        if (!parent) {
            return false;
        }

        // 箭头函数需要增加括号：const x = () => <Foo>{ bar: 5 }; // const x = () => ({ bar: 5 } as Foo);
        if (parent.kind === ts.SyntaxKind.ArrowFunction) {
            return true;
            // 函数调用和new表达式中的对象字面量和数组字面量都添加括号
        } else if (parent.kind === ts.SyntaxKind.CallExpression ||
            parent.kind === ts.SyntaxKind.NewExpression) {
            const children = aNode.getChildren();
            for (const child of children) {
                const typeNode = this.getTypeNode(child);
                // 同时处理对象字面量和数组字面量
                if (ts.isObjectLiteralExpression(typeNode) ||
                    ts.isArrayLiteralExpression(typeNode)) {
                    return true;
                }
            }
            return false;
        } else { // 强转后面有操作符的要加括号：const x = <A>a + b; // const x = (a as A) + b;
            const children = parent.getChildren();
            const index = children.indexOf(aNode);
            if (index === children.length - 1) {
                return false;
            }

            const nextNode = children[index + 1];
            return nextNode.kind === ts.SyntaxKind.PlusToken;
        }
        return false;
    }

    // 去掉代码外层的括号
    private getTypeNode(aNode: ts.Node): ts.Node {
        if (aNode.kind === ts.SyntaxKind.ParenthesizedExpression) {
            const children = aNode.getChildren();
            if (children.length === 3) {
                return this.getTypeNode(children[1]);
            }
        }
        return aNode;
    }

    // 去掉圆括号，例如<((A))>a中A外面的圆括号
    private removeBracket(aNode: ts.Node): ts.Node | undefined {
        let hasParen = false;
        const children = aNode.getChildren();
        if (children.length === 3) {
            if (children[0].kind === ts.SyntaxKind.OpenParenToken && children[children.length - 1].kind === ts.SyntaxKind.CloseParenToken) {
                hasParen = true;
            }
        }

        if (hasParen) {
            const result = this.removeBracket(children[1]);
            if (result) {
                return result;
            }
        } else {
            return aNode;
        }
    }

    private addIssueReport(arkFile: ArkFile, line: number, startCol: number, endCol: number, message: string, fix: RuleFix | undefined): Defects {
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