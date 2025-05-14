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
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import {
    FileMatcher,
    MatcherCallback,
    MatcherTypes,
} from '../../matcher/Matchers';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'TypedefCheck');
type Options = [
    {
        arrayDestructuring?: boolean;
        arrowParameter?: boolean;
        memberVariableDeclaration?: boolean;
        objectDestructuring?: boolean;
        parameter?: boolean;
        propertyDeclaration?: boolean;
        variableDeclaration?: boolean;
        variableDeclarationIgnoreFunction?: boolean;
    },
];

export class TypedefCheck implements BaseChecker {
    readonly CONST_STR: string = 'const';
    readonly CONST_LET: string = 'let';
    readonly CONST_CONSTRUCTOR: string = 'constructor';
    readonly CONST_EQUAL: string = '=';
    readonly CONST_ARROW: string = '=>';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public sourceFile: ts.SourceFile;
    public filePath: string;
    public optionList: string[] = [];

    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/typedef.md',
        description: 'Expected a type annotation.',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchBuildCb];
    };

    public check = (target: ArkFile) => {
        this.getDefaultOption();
        this.filePath = target.getFilePath();
        this.sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);

        this.visitNode(this.sourceFile);
    };


    private isBindingPattern = (node: ts.Node): node is ts.BindingPattern => {
        return ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node);
    };

    private visitNode(node: ts.Node): void {
        // 处理变量声明（规则4、5、10）
        this.variableDeclarationNode(node);

        if (ts.isBinaryExpression(node) && ts.isObjectLiteralExpression(node.left)) {
            const start = node.left.getStart(this.sourceFile);
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
            this.addIssueReport('objectDestructuring', line, character, undefined);
        }

        // 处理参数（规则4、5、6、8）
        this.parameterNode(node);

        // 处理类成员变量（规则7）
        this.propertyDeclarationNode(node);

        // 处理类型别名属性（规则9）
        this.typeAliasDeclarationNode(node);

        ts.forEachChild(node, child =>
            this.visitNode(child)
        );
    }

    private typeAliasDeclarationNode(node: ts.Node): void {
        if (ts.isTypeAliasDeclaration(node)) {
            if (ts.isTypeLiteralNode(node.type)) {
                node.type.members.forEach((member) => {
                    this.propertySignatureNode(member);
                });
            }
        }
    }

    private propertySignatureNode(member: ts.TypeElement): void {
        if (ts.isPropertySignature(member) && !member.type) {
            const start = member.name.getStart(this.sourceFile);
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
            this.addIssueReport('propertyDeclaration', line, character, member.name.getText());
        }
    }

    private propertyDeclarationNode(node: ts.Node): void {
        if (ts.isPropertyDeclaration(node) && !node.type) {
            let start = node.name.getStart(this.sourceFile);
            const nodeName = node.getText();
            if (nodeName.startsWith('public ') || nodeName.startsWith('static ') ||
                nodeName.startsWith('declare ') || nodeName.startsWith('@') ||
                nodeName.startsWith('readonly') || nodeName.startsWith('private')) {
                start = node.getStart(this.sourceFile);
            }
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
            let text = node.name.getText();
            if (ts.isComputedPropertyName(node.name)) {
                text = node.name.expression.getText();
            }
            let name = text.startsWith('#') || text.startsWith(`'`) ||
                text.includes('.') || text.startsWith(`"`) || text.startsWith('`') ? undefined : text;
            if (name && name.startsWith('(') && name.endsWith(')')) {
                name = name.substring(1, name.length - 1);
            }
            this.addIssueReport('memberVariableDeclaration', line, character, name);
        }
    }

    private parameterNode(node: ts.Node): void {
        if (ts.isParameter(node)) {
            if (!node.type) {
                this.bindingPatternNode(node);
                this.parameterNodeExecute(node);

            }
        }
    }

    private parameterNodeExecute(node: ts.ParameterDeclaration) : void {
        const parent = node.parent;
        const isArrowFunction = parent && ts.isArrowFunction(parent);
        const type = isArrowFunction ? 'arrowParameter' : 'parameter';
        let start = node.getStart(this.sourceFile);
        let pos = this.sourceFile.getLineAndCharacterOfPosition(start);
        let name = (node.getText() === node.name.getText() && !node.getText().startsWith('{')) ? node.getText() : undefined;
        if (type === 'parameter' && name?.startsWith('[') && name.endsWith(']')) {
            name = undefined;
        }
        if (type === 'parameter' && node.getText().startsWith('@')) {
            name = node.name.getText();
            start = node.name.getStart(this.sourceFile);
            pos = this.sourceFile.getLineAndCharacterOfPosition(start);
        }
        this.addIssueReport(type, pos.line, pos.character, name);
    }

    private bindingPatternNode(node: ts.ParameterDeclaration) : void {
        if (this.isBindingPattern(node.name)) {
            const isArray = ts.isArrayBindingPattern(node.name);
            const type = isArray ? 'arrayDestructuring' : 'objectDestructuring';
            let start = node.name.getStart(this.sourceFile);

            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
            this.addIssueReport(type, line, character, undefined);
        }
    }

    private variableDeclarationNode(node: ts.Node): void {
        if (ts.isVariableDeclaration(node)) {
            if (!node.type) {
                this.variableDeclarationNode1(node);
            }
        }
    }

    private variableDeclarationNode1(node: ts.VariableDeclaration) : void {
        if (ts.isArrayBindingPattern(node.name)) {
            const start = node.name.getStart(this.sourceFile);
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
            this.addIssueReport('arrayDestructuring', line, character, undefined);
        } else if (ts.isObjectBindingPattern(node.name)) {
            const start = node.name.getStart(this.sourceFile);
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
            this.addIssueReport('objectDestructuring', line, character, undefined);
        } else {
            this.variableDeclarationNodeElse(node);
        }
    }

    private variableDeclarationNodeElse(node: ts.VariableDeclaration): void {
        const isFunction = node.initializer &&
            (ts.isArrowFunction(node.initializer) ||
                ts.isFunctionExpression(node.initializer));
        const type = isFunction
            ? 'variableDeclarationIgnoreFunction'
            : 'variableDeclaration';
        const start = node.name.getStart(this.sourceFile);
        const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
        const nodeName = node.getText();
        const name = node.name.getText();
        const substr = nodeName.substring(name.length);
        if (type === 'variableDeclaration' && !ts.isForOfStatement(node.parent.parent) &&
            !ts.isForInStatement(node.parent.parent) && !ts.isCatchClause(node.parent)) {
            this.addIssueReport(type, line, character, node.name.getText());
        } else if (type === 'variableDeclarationIgnoreFunction') {
            this.addIssueReport(type, line, character, node.name.getText());
        }
    }

    private addIssueReport(optionType: string, line: number, col: number, name?: string): void {
        if ((optionType !== 'variableDeclarationIgnoreFunction' && this.optionList.includes(optionType)) ||
            (optionType === 'variableDeclarationIgnoreFunction' && this.optionList.includes('variableDeclaration') &&
                !this.optionList.includes('variableDeclarationIgnoreFunction'))
        ) {

            const description = name ? `Expected ${name} to have a type annotation.` : `Expected a type annotation.`;
            const defect = new Defects(
                line + 1,
                col + 1,
                line + 1,
                description,
                this.rule.alert ?? this.metaData.severity,
                this.rule.ruleId,
                this.filePath,
                this.metaData.ruleDocPath,
                true,
                false,
                false
            );
            this.issues.push(new IssueReport(defect, undefined));
            RuleListUtil.push(defect);
        }
    }

    public getDefaultOption(): void {
        let option: Options;
        if (this.rule && this.rule.option) {
            option = this.rule.option as Options;
            if (option[0]) {
                if (option[0].arrayDestructuring) {
                    this.optionList.push('arrayDestructuring');
                }
                if (option[0].arrowParameter) {
                    this.optionList.push('arrowParameter');
                }
                if (option[0].memberVariableDeclaration) {
                    this.optionList.push('memberVariableDeclaration');
                }
                if (option[0].objectDestructuring) {
                    this.optionList.push('objectDestructuring');
                }
                if (option[0].parameter) {
                    this.optionList.push('parameter');
                }
                if (option[0].propertyDeclaration) {
                    this.optionList.push('propertyDeclaration');
                }
                if (option[0].variableDeclaration) {
                    this.optionList.push('variableDeclaration');
                }
                if (option[0].variableDeclarationIgnoreFunction) {
                    this.optionList.push('variableDeclarationIgnoreFunction');
                }
            }
        }
    }

}
