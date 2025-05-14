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
import { Rule } from "../../model/Rule";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import { ArkFile, AstTreeUtils, ts } from "arkanalyzer";
import { Defects, FileMatcher, MatcherCallback, MatcherTypes } from "../../Index";
import { IssueReport } from "../../model/Defects";
import { RuleFix } from "../../model/Fix";
import { RuleListUtil } from "../../utils/common/DefectsList";

export class PreferAsConstCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/prefer-as-const.md',
        description: 'Enforce the use of `as const` over literal type assertions.'
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcher: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatcher];
    };

    public check = (target: ArkFile) => {
        if (!this.getFileExtension(target.getName(), 'ts')) {
            return;
        }
        const filePath = target.getFilePath();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);
        const defects = this.checkAsConstAssertions(sourceFile, filePath);
        defects.forEach(defect => {
            const ruleFix = this.createFix(sourceFile, defect);
            this.issues.push(new IssueReport(defect, ruleFix));
        });
    };

    private getFileExtension(filePath: string, filetype: string): boolean {
        const match = filePath.match(/\.([0-9a-zA-Z]+)$/);
        if (match) {
            const extension = match[1];
            return extension === filetype;
        }
        return false;
    };

    private checkAsConstAssertions(sourceFile: ts.SourceFile, filePath: string): Defects[] {
        const defects: Defects[] = [];
        const traverse = (node: ts.Node) => {
            if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
                if (this.shouldReportAssertion(node)) {
                    const message = "Expected a `const` instead of a literal type assertion."
                    this.addDefect(defects, sourceFile, filePath, node, message);
                }
            }
            if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
                if (this.shouldReportVariableDeclaration(node)) {
                    const message = "Expected a `const` assertion instead of a literal type annotation. "
                    this.addDefect(defects, sourceFile, filePath, node, message);
                }
            }
            ts.forEachChild(node, traverse);
        };
        traverse(sourceFile);
        return defects;
    };

    private shouldReportAssertion(node: ts.AssertionExpression): boolean {
        const { expression, type } = node;
        // 检查对象字面量中的属性断言
        if (ts.isObjectLiteralExpression(expression)) {
            return expression.properties.some(prop => {
                if (ts.isPropertyAssignment(prop)) {
                    const value = prop.initializer;
                    return ts.isAsExpression(value) && this.shouldReportAssertion(value);
                }
                return false;
            });
        }
        // 处理基本类型断言
        if (type.kind === ts.SyntaxKind.StringKeyword ||
            type.kind === ts.SyntaxKind.NumberKeyword) {
            return false;
        }
        // 不需要报错的情况
        if (!ts.isLiteralTypeNode(type)) return false;
        if (ts.isTypeReferenceNode(type)) return false;
        // 处理模板字面量
        if (ts.isTemplateLiteral(expression)) {
            return false;
        }
        // 检查字面量类型断言
        if (ts.isLiteralTypeNode(type)) {
            if (ts.isStringLiteral(expression) && ts.isStringLiteral(type.literal)) {
                return expression.text === type.literal.text;
            }
            if (ts.isNumericLiteral(expression) && ts.isNumericLiteral(type.literal)) {
                return expression.text === type.literal.text;
            }
        }
        return false;
    };

    private shouldReportVariableDeclaration(node: ts.VariableDeclaration | ts.PropertyDeclaration): boolean {
        const { type, initializer } = node;
        if (!type || !initializer) return false;
        // 跳过基本类型注解
        if (!ts.isLiteralTypeNode(type) &&
            (type.kind === ts.SyntaxKind.StringKeyword ||
                type.kind === ts.SyntaxKind.NumberKeyword)) {
            return false;
        }
        // 跳过函数类型
        if (ts.isFunctionTypeNode(type) || ts.isMethodDeclaration(node)) {
            return false;
        }
        // 跳过模板字面量
        if (ts.isTemplateLiteral(initializer)) {
            return false;
        }
        // 检查字面量类型注解
        if (ts.isLiteralTypeNode(type)) {
            if (ts.isStringLiteral(initializer) && ts.isStringLiteral(type.literal)) {
                return initializer.text === type.literal.text;
            }
            if (ts.isNumericLiteral(initializer) && ts.isNumericLiteral(type.literal)) {
                return initializer.text === type.literal.text;
            }
        }
        return false;
    };

    private addDefect(defects: Defects[], sourceFile: ts.SourceFile, filePath: string, node: ts.Node, message: string): void {
        let start: number;
        this.metaData.description = message ? message : this.metaData.description;
        if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
            // 对于变量声明和属性声明，定位到类型注解的值
            const typeNode = node.type;
            if (typeNode && ts.isLiteralTypeNode(typeNode)) {
                start = typeNode.literal.getStart();
            } else {
                start = node.getStart();
            }
        } else if (ts.isTypeAssertionExpression(node)) {
            // 对于尖括号语法的类型断言，定位到类型位置
            start = node.type.getStart();
        } else if (ts.isAsExpression(node)) {
            // 对于 as 语法的断言，定位到类型位置
            start = node.type.getStart();
        } else {
            start = node.getStart();
        }
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
        const lineNumber = lineAndChar.line + 1;
        const column = lineAndChar.character + 1;
        const lineEndChar = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const severity = this.rule.alert ?? this.metaData.severity;
        const defect = new Defects(
            lineNumber,
            column,
            lineEndChar.character + 1,
            this.metaData.description,
            severity,
            this.rule.ruleId,
            filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            true,
        );
        defects.push(defect);
        RuleListUtil.push(defect);
    };

    private createFix(sourceFile: ts.SourceFile, defect: Defects): RuleFix {
        const { reportLine, reportColumn } = defect;
        const lineIndex = reportLine - 1;
        const pos = sourceFile.getPositionOfLineAndCharacter(lineIndex, reportColumn);
        let node = this.findNodeAtPosition(sourceFile, pos);
        // 向上查找父节点
        while (node &&
            !ts.isVariableDeclaration(node) &&
            !ts.isPropertyDeclaration(node) &&
            !ts.isTypeAssertionExpression(node) &&
            !ts.isAsExpression(node) &&
            node !== sourceFile) {
            node = node.parent;
        }
        let start = pos;
        let end = pos;
        let fixedText = '';
        if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
            if (node.type && ts.isLiteralTypeNode(node.type)) {
                // 修复 "let foo: 2 = 2" -> "let foo = 2 as const"
                start = node.name.getEnd();
                end = node.getEnd();
                fixedText = ` = ${this.getInitializerText(node.initializer)} as const`;
            }
        } else if (ts.isTypeAssertionExpression(node)) {
            // 修复 "<'bar'>'bar'" -> "<const>'bar'"
            start = node.getStart() + 1; // 跳过开始的 <
            end = node.type.getEnd();    // 到类型结束
            fixedText = 'const';
        } else if (ts.isAsExpression(node)) {
            // 修复 "'bar' as 'bar'" -> "'bar' as const"
            start = node.type.getStart() - 3; // 包含 "as"
            end = node.type.getEnd();
            fixedText = 'as const';
        }
        return { range: [start, end], text: fixedText };
    };

    private getInitializerText(initializer: ts.Expression | undefined): string {
        if (!initializer) return '';
        return initializer.getText();
    };

    private findNodeAtPosition(sourceFile: ts.SourceFile, pos: number): ts.Node {
        let foundNode: ts.Node = sourceFile;

        const visit = (node: ts.Node) => {
            // 跳过 token 级别的节点
            if (node.kind < ts.SyntaxKind.FirstNode) {
                return;
            }
            const start = node.getStart();
            const end = node.getEnd();

            if (start <= pos && pos <= end) {
                // 记录当前匹配的节点
                foundNode = node;
                // 继续遍历子节点
                ts.forEachChild(node, visit);
            }
        };
        ts.forEachChild(sourceFile, visit);
        return foundNode;
    };
}
