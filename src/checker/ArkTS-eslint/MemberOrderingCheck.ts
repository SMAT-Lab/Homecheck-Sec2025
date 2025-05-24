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
import { Defects } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'MemberOrderingCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: "docs/member-ordering.md",
    description: "Require consistent member ordering in classes, interfaces, and type literals",
};

// 定义一个接口，用于存储问题的行列信息
interface LocationInfo {
    line: number;
    startCol: number;
    nameStr: string;
    description: string;
}

interface SortedOrderConfig {
    memberTypes?: BaseMemberType[] | 'never';
    optionalityOrder?: 'optional-first' | 'required-first';
    order:
    | 'alphabetically'
    | 'alphabetically-case-insensitive'
    | 'as-written'
    | 'natural'
    | 'natural-case-insensitive';
}

type OrderConfig = BaseMemberType[] | SortedOrderConfig | 'never';

export type Options = [
    {
        default?: OrderConfig;
        classes?: OrderConfig;
        classExpressions?: OrderConfig;
        interfaces?: OrderConfig;
        typeLiterals?: OrderConfig;
    },
];

// 定义更复杂的成员类型
enum BaseMemberType {
    "signature" = "signature",
    "readonly-signature" = "readonly-signature",
    "call-signature" = "call-signature",

    // Fields
    "public-static-field" = "public-static-field",
    "public-static-readonly-field" = "public-static-readonly-field",
    "protected-static-field" = "protected-static-field",
    "protected-static-readonly-field" = "protected-static-readonly-field",
    "private-static-field" = "private-static-field",
    "private-static-readonly-field" = "private-static-readonly-field",
    "#private-static-field" = "#private-static-field",
    "#private-static-readonly-field" = "#private-static-readonly-field",
    "public-decorated-field" = "public-decorated-field",
    "public-decorated-readonly-field" = "public-decorated-readonly-field",
    "protected-decorated-field" = "protected-decorated-field",
    "protected-decorated-readonly-field" = "protected-decorated-readonly-field",
    "private-decorated-field" = "private-decorated-field",
    "private-decorated-readonly-field" = "private-decorated-readonly-field",
    "public-instance-field" = "public-instance-field",
    "public-instance-readonly-field" = "public-instance-readonly-field",
    "protected-instance-field" = "protected-instance-field",
    "protected-instance-readonly-field" = "protected-instance-readonly-field",
    "private-instance-field" = "private-instance-field",
    "private-instance-readonly-field" = "private-instance-readonly-field",
    "#private-instance-field" = "#private-instance-field",
    "#private-instance-readonly-field" = "#private-instance-readonly-field",
    "public-abstract-field" = "public-abstract-field",
    "public-abstract-readonly-field" = "public-abstract-readonly-field",
    "protected-abstract-field" = "protected-abstract-field",
    "protected-abstract-readonly-field" = "protected-abstract-readonly-field",
    "public-field" = "public-field",
    "public-readonly-field" = "public-readonly-field",
    "#private-field" = "#private-field",
    "#private-readonly-field" = "#private-readonly-field",
    "protected-field" = "protected-field",
    "protected-readonly-field" = "protected-readonly-field",
    "private-field" = "private-field",
    "private-readonly-field" = "private-readonly-field",
    "static-field" = "static-field",
    "static-readonly-field" = "static-readonly-field",
    "instance-field" = "instance-field",
    "instance-readonly-field" = "instance-readonly-field",
    "abstract-field" = "abstract-field",
    "abstract-readonly-field" = "abstract-readonly-field",
    "decorated-field" = "decorated-field",
    "decorated-readonly-field" = "decorated-readonly-field",
    "field" = "field",
    "readonly-field" = "readonly-field",

    // Static initialization
    "static-initialization" = "static-initialization",

    // Constructors
    "public-constructor" = "public-constructor",
    "protected-constructor" = "protected-constructor",
    "private-constructor" = "private-constructor",
    "constructor" = "constructor",

    // Accessors
    "public-static-accessor" = "public-static-accessor",
    "protected-static-accessor" = "protected-static-accessor",
    "private-static-accessor" = "private-static-accessor",
    "#private-static-accessor" = "#private-static-accessor",
    "public-decorated-accessor" = "public-decorated-accessor",
    "protected-decorated-accessor" = "protected-decorated-accessor",
    "private-decorated-accessor" = "private-decorated-accessor",
    "public-instance-accessor" = "public-instance-accessor",
    "protected-instance-accessor" = "protected-instance-accessor",
    "private-instance-accessor" = "private-instance-accessor",
    "#private-instance-accessor" = "#private-instance-accessor",
    "public-abstract-accessor" = "public-abstract-accessor",
    "protected-abstract-accessor" = "protected-abstract-accessor",
    "public-accessor" = "public-accessor",
    "protected-accessor" = "protected-accessor",
    "private-accessor" = "private-accessor",
    "#private-accessor" = "#private-accessor",
    "static-accessor" = "static-accessor",
    "instance-accessor" = "instance-accessor",
    "abstract-accessor" = "abstract-accessor",
    "decorated-accessor" = "decorated-accessor",
    "accessor" = "accessor",

    // Getters
    "public-static-get" = "public-static-get",
    "protected-static-get" = "protected-static-get",
    "private-static-get" = "private-static-get",
    "#private-static-get" = "#private-static-get",
    "public-decorated-get" = "public-decorated-get",
    "protected-decorated-get" = "protected-decorated-get",
    "private-decorated-get" = "private-decorated-get",
    "public-instance-get" = "public-instance-get",
    "protected-instance-get" = "protected-instance-get",
    "private-instance-get" = "private-instance-get",
    "#private-instance-get" = "#private-instance-get",
    "public-abstract-get" = "public-abstract-get",
    "protected-abstract-get" = "protected-abstract-get",
    "public-get" = "public-get",
    "protected-get" = "protected-get",
    "private-get" = "private-get",
    "#private-get" = "#private-get",
    "static-get" = "static-get",
    "instance-get" = "instance-get",
    "abstract-get" = "abstract-get",
    "decorated-get" = "decorated-get",
    "get" = "get",

    // Setters
    "public-static-set" = "public-static-set",
    "protected-static-set" = "protected-static-set",
    "private-static-set" = "private-static-set",
    "#private-static-set" = "#private-static-set",
    "public-decorated-set" = "public-decorated-set",
    "protected-decorated-set" = "protected-decorated-set",
    "private-decorated-set" = "private-decorated-set",
    "public-instance-set" = "public-instance-set",
    "protected-instance-set" = "protected-instance-set",
    "private-instance-set" = "private-instance-set",
    "#private-instance-set" = "#private-instance-set",
    "public-abstract-set" = "public-abstract-set",
    "protected-abstract-set" = "protected-abstract-set",
    "public-set" = "public-set",
    "protected-set" = "protected-set",
    "private-set" = "private-set",
    "#private-set" = "#private-set",
    "static-set" = "static-set",
    "instance-set" = "instance-set",
    "abstract-set" = "abstract-set",
    "decorated-set" = "decorated-set",
    "set" = "set",
    // Methods
    "public-static-method" = "public-static-method",
    "protected-static-method" = "protected-static-method",
    "private-static-method" = "private-static-method",
    "#private-static-method" = "#private-static-method",
    "public-decorated-method" = "public-decorated-method",
    "protected-decorated-method" = "protected-decorated-method",
    "private-decorated-method" = "private-decorated-method",
    "public-instance-method" = "public-instance-method",
    "protected-instance-method" = "protected-instance-method",
    "private-instance-method" = "private-instance-method",
    "#private-instance-method" = "#private-instance-method",
    "public-abstract-method" = "public-abstract-method",
    "protected-abstract-method" = "protected-abstract-method",
    "public-method" = "public-method",
    "protected-method" = "protected-method",
    "private-method" = "private-method",
    "#private-method" = "#private-method",
    "static-method" = "static-method",
    "instance-method" = "instance-method",
    "abstract-method" = "abstract-method",
    "decorated-method" = "decorated-method",
    "method" = "method"
}


const defaultOptions = {
    "default": [
        // Index signature
        "signature",
        "readonly-signature",
        "call-signature",

        // Fields
        "public-static-field",
        "public-static-readonly-field",
        "protected-static-field",
        "protected-static-readonly-field",
        "private-static-field",
        "private-static-readonly-field",
        "#private-static-field",
        "#private-static-readonly-field",

        "public-decorated-field",
        "public-decorated-readonly-field",
        "protected-decorated-field",
        "protected-decorated-readonly-field",
        "private-decorated-field",
        "private-decorated-readonly-field",

        "public-instance-field",
        "public-instance-readonly-field",
        "protected-instance-field",
        "protected-instance-readonly-field",
        "private-instance-field",
        "private-instance-readonly-field",
        "#private-instance-field",
        "#private-instance-readonly-field",

        "public-abstract-field",
        "public-abstract-readonly-field",
        "protected-abstract-field",
        "protected-abstract-readonly-field",

        "public-field",
        "public-readonly-field",
        "protected-field",
        "protected-readonly-field",
        "private-field",
        "private-readonly-field",
        "#private-field",
        "#private-readonly-field",

        "static-field",
        "static-readonly-field",
        "instance-field",
        "instance-readonly-field",
        "abstract-field",
        "abstract-readonly-field",

        "decorated-field",
        "decorated-readonly-field",

        "field",
        "readonly-field",

        // Static initialization
        "static-initialization",

        // Constructors
        "public-constructor",
        "protected-constructor",
        "private-constructor",

        "constructor",

        // Accessors
        "public-static-accessor",
        "protected-static-accessor",
        "private-static-accessor",
        "#private-static-accessor",

        "public-decorated-accessor",
        "protected-decorated-accessor",
        "private-decorated-accessor",

        "public-instance-accessor",
        "protected-instance-accessor",
        "private-instance-accessor",
        "#private-instance-accessor",

        "public-abstract-accessor",
        "protected-abstract-accessor",

        "public-accessor",
        "protected-accessor",
        "private-accessor",
        "#private-accessor",

        "static-accessor",
        "instance-accessor",
        "abstract-accessor",
        "decorated-accessor",
        "accessor",

        // Getters
        "public-static-get",
        "protected-static-get",
        "private-static-get",
        "#private-static-get",

        "public-decorated-get",
        "protected-decorated-get",
        "private-decorated-get",

        "public-instance-get",
        "protected-instance-get",
        "private-instance-get",
        "#private-instance-get",

        "public-abstract-get",
        "protected-abstract-get",

        "public-get",
        "protected-get",
        "private-get",
        "#private-get",

        "static-get",
        "instance-get",
        "abstract-get",
        "decorated-get",
        "get",

        // Setters
        "public-static-set",
        "protected-static-set",
        "private-static-set",
        "#private-static-set",

        "public-decorated-set",
        "protected-decorated-set",
        "private-decorated-set",

        "public-instance-set",
        "protected-instance-set",
        "private-instance-set",
        "#private-instance-set",

        "public-abstract-set",
        "protected-abstract-set",

        "public-set",
        "protected-set",
        "private-set",
        "#private-set",

        "static-set",
        "instance-set",
        "abstract-set",
        "decorated-set",
        "set",

        // Methods
        "public-static-method",
        "protected-static-method",
        "private-static-method",
        "#private-static-method",

        "public-decorated-method",
        "protected-decorated-method",
        "private-decorated-method",

        "public-instance-method",
        "protected-instance-method",
        "private-instance-method",
        "#private-instance-method",

        "public-abstract-method",
        "protected-abstract-method",

        "public-method",
        "protected-method",
        "private-method",
        "#private-method",

        "static-method",
        "instance-method",
        "abstract-method",
        "decorated-method",
        "method"
    ]
};

export class MemberOrderingCheck implements BaseChecker {

    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public asRoot: ts.SourceFile;

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

    public check = (arkFile: ArkFile) => {
        if (arkFile instanceof ArkFile) {
            const code = arkFile.getCode();
            if (!code) {
                return;
            }
            this.asRoot = AstTreeUtils.getSourceFileFromArkFile(arkFile);
            if (!this.asRoot) {
                return;
            }
            const filePath = arkFile.getFilePath();
            // 检查成员排序
            this.checkMemberOrder(this.asRoot, filePath);

        }
    }

    // 检查类的成员排序
    private checkMemberOrder(sourceFile: ts.SourceFile, filePath: string) {
        // 遍历 AST
        const visit = (node: ts.Node) => {

            if (ts.isClassDeclaration(node)) {
                const orderConfigDefault = this.getClassesOrderConfig()
                const members = Array.from(node.members);
                this.validateMembersOrder(members, filePath, orderConfigDefault);
            }
            if (ts.isClassExpression(node)) {
                const orderConfigDefault = this.getClassExpressionsOrderConfig()
                const members = Array.from(node.members);
                this.validateMembersOrder(members, filePath, orderConfigDefault);

            }
            if (ts.isInterfaceDeclaration(node)) {
                const orderConfigDefault = this.getInterfacesOrderConfig();
                const members = Array.from(node.members);
                this.validateMembersOrder(members, filePath, orderConfigDefault);
            }
            if (ts.isTypeLiteralNode(node)) {
                const orderConfigDefault = this.getTypeLiteralsOrderConfig()
                const members = Array.from(node.members);
                this.validateMembersOrder(members, filePath, orderConfigDefault);

            }
            // 遍历子节点
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    }


    private getClassesOrderConfig(): OrderConfig {
        let option: Options;
        if (this.rule && this.rule.option) {
            option = this.rule.option as Options;
            const classesOrderConfig = option[0]?.classes
            if (classesOrderConfig) {
                return classesOrderConfig as OrderConfig
            }
        }
        // 使用默认配置并确保其类型正确
        return this.getDefaultOrderConfig();
    }
    private getClassExpressionsOrderConfig(): OrderConfig {
        let option: Options;
        if (this.rule && this.rule.option) {
            option = this.rule.option as Options;
            const classExpressionsOrderConfig = option[0]?.classExpressions
            if (classExpressionsOrderConfig) {
                return classExpressionsOrderConfig as OrderConfig
            }
        }
        // 使用默认配置并确保其类型正确
        return this.getDefaultOrderConfig();
    }

    private getInterfacesOrderConfig(): OrderConfig {
        let option: Options;
        if (this.rule && this.rule.option) {
            option = this.rule.option as Options;
            const interfacesOrderConfig = option[0]?.interfaces
            if (interfacesOrderConfig) {
                return interfacesOrderConfig as OrderConfig
            }
        }
        // 使用默认配置并确保其类型正确
        return this.getDefaultOrderConfig();
    }
    private getTypeLiteralsOrderConfig(): OrderConfig {
        let option: Options;
        if (this.rule && this.rule.option) {
            option = this.rule.option as Options;
            const typeLiteralsOrderConfig = option[0]?.typeLiterals
            if (typeLiteralsOrderConfig) {
                return typeLiteralsOrderConfig as OrderConfig
            }
        }
        // 使用默认配置并确保其类型正确
        return this.getDefaultOrderConfig();
    }

    private getDefaultOrderConfig(): OrderConfig {
        let option: Options;
        if (this.rule && this.rule.option) {
            option = this.rule.option as Options;
            const defaultConfig = option[0]?.default;
            if (defaultConfig) {
                return defaultConfig as OrderConfig
            }
        }
        // 使用默认配置并确保其类型正确
        return (defaultOptions.default || []) as BaseMemberType[];
    }

    private getMemberName(node: ts.Node): string {
        if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
            if (ts.isComputedPropertyName(node.name)) {
                return this.getComputedPropertyName(node.name);
            } else {
                return (node.name as ts.Identifier).text;
            }
        } else if (ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) {
            if (ts.isComputedPropertyName(node.name)) {
                return this.getComputedPropertyName(node.name);
            } else {
                return (node.name as ts.Identifier).text;
            }
        } else if (ts.isConstructorDeclaration(node)) {
            return 'constructor';
        } else if (ts.isCallSignatureDeclaration(node)) {
            return 'call';
        } else if (ts.isNewExpression(node)) {
            return 'new';
        } else if (ts.isConstructSignatureDeclaration(node)) {
            return 'new';
        } else if (ts.isIndexSignatureDeclaration(node)) {
            const parameter = node.parameters[0];
            if (ts.isIdentifier(parameter.name)) {
                return parameter.name.text;
            }
        } else if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
            if (ts.isComputedPropertyName(node.name)) {
                return this.getComputedPropertyName(node.name);
            } else {
                return (node.name as ts.Identifier).text;
            }
        } else if (ts.isClassStaticBlockDeclaration(node)) {
            return 'static block';
        }
        return 'null';
    }

    private getComputedPropertyName(node: ts.ComputedPropertyName): string {
        if (ts.isStringLiteral(node.expression) || ts.isNumericLiteral(node.expression)) {
            return node.expression.text;
        } else if (ts.isIdentifier(node.expression)) {
            return node.expression.text;
        }
        return node.expression.getText();
    }

    private isMemberOptional(node: ts.Node): boolean {
        if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isMethodSignature(node)) {
            return !!node.questionToken;
        }
        return false;
    }

    private getRank(memberType: BaseMemberType, orderConfig: BaseMemberType[]): number {
        // 将 memberType 显式转换为字符串
        const memberTypeString = String(memberType);
        let index = orderConfig.indexOf(memberTypeString as BaseMemberType);
        if (index === -1) {
            const keyType = this.extractTwoKeyType(memberTypeString);
            index = orderConfig.indexOf(keyType as BaseMemberType);
        }
        if (index === -1) {
            const keyType = this.extractKeyType(memberTypeString);
            index = orderConfig.indexOf(keyType as BaseMemberType);
        }
        return index >= 0 ? index : -1; // 如果找不到则返回 -1
    }

    private extractKeyType(memberTypeString: string): string {
        const parts = memberTypeString.split('-');
        return parts[parts.length - 1];
    }
    private extractTwoKeyType(memberTypeString: string): string {
        const parts = memberTypeString.split('-');
        if (parts.length > 1) {
            return parts.slice(1).join('-');
        }
        return parts[0];
    }

    // 辅助函数
    private getNodeType(node: ts.Node): BaseMemberType | null {
        if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
            // 检查字段值是否为函数
            if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
                return this.determineMethodMemberType(node);
            }
            // 检查字段名是否以 # 开头，表示私有字段
            if (node.name.getText().startsWith('#')) {
                const fieldType = this.determineFieldMemberType(node);
                if (fieldType) {
                    return `#${fieldType}` as BaseMemberType;
                }
            }
            return this.determineFieldMemberType(node);
        }
        return this.getNodeTypeOther(node);
    }
    // 辅助函数
    private getNodeTypeOther(node: ts.Node): BaseMemberType | null {
        if (ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) {
            return this.determineMethodMemberType(node);
        } else if (ts.isConstructorDeclaration(node) || ts.isConstructSignatureDeclaration(node)) {
            return BaseMemberType.constructor;
        } else if (ts.isIndexSignatureDeclaration(node)) {
            return BaseMemberType.signature;
        } else if (ts.isCallSignatureDeclaration(node)) {
            return BaseMemberType['call-signature'];
        } else if (ts.isCallSignatureDeclaration(node)) {
            return BaseMemberType['call-signature'];
        } else if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
            return BaseMemberType.method;
        } else if (ts.isGetAccessor(node)) {
            return this.determineGetterMemberType(node);
        } else if (ts.isSetAccessor(node)) {
            return this.determineSetterMemberType(node);
        } else if (ts.isAccessor(node)) {
            return BaseMemberType.accessor;
        } else if (ts.isClassStaticBlockDeclaration(node)) {
            return BaseMemberType['public-instance-method'];
        }
        return null;
    }

    private determineGetterMemberType(node: ts.Node): BaseMemberType {
        if (ts.isGetAccessor(node)) {
            const modifiers = node.modifiers || [];
            const hasPublic = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PublicKeyword);
            const hasStatic = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword);
            const hasProtected = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword);
            const hasPrivate = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword);
            const hasDecorator = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.Decorator);

            if ((hasPublic || (!hasPublic && !hasProtected && !hasPrivate)) && hasStatic) {
                return BaseMemberType['public-static-get'];
            }
            if (hasPublic && hasDecorator) {
                return BaseMemberType['public-decorated-get'];
            }
            if (hasPublic) {
                return BaseMemberType['public-instance-get'];
            }
            if (hasProtected && hasStatic) {
                return BaseMemberType['protected-static-get'];
            }
            if (hasProtected && hasDecorator) {
                return BaseMemberType['protected-decorated-get'];
            }
            if (hasProtected) {
                return BaseMemberType['protected-instance-get'];
            }
            if (hasPrivate && hasStatic) {
                return BaseMemberType['private-static-get'];
            }
            return this.determineGetterMemberTypeTwo(hasPrivate, hasDecorator);
        }
        return BaseMemberType.get; // 默认返回 'get'
    }

    private determineGetterMemberTypeTwo(hasPrivate: boolean, hasDecorator: boolean): BaseMemberType {
        if (hasPrivate && hasDecorator) {
            return BaseMemberType['private-decorated-get'];
        }
        if (hasPrivate) {
            return BaseMemberType['private-instance-get'];
        }
        if (hasDecorator) {
            return BaseMemberType['decorated-get'];
        }
        return BaseMemberType.get;
    }

    private determineSetterMemberType(node: ts.Node): BaseMemberType {
        if (ts.isSetAccessor(node)) {
            const modifiers = node.modifiers || [];
            const hasPublic = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PublicKeyword);
            const hasStatic = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword);
            const hasProtected = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword);
            const hasPrivate = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword);
            const hasDecorator = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.Decorator);

            if ((hasPublic || (!hasPublic && !hasProtected && !hasPrivate)) && hasStatic) {
                return BaseMemberType['public-static-set'];
            }
            if (hasPublic && hasDecorator) {
                return BaseMemberType['public-decorated-set'];
            }
            if (hasPublic) {
                return BaseMemberType['public-instance-set'];
            }
            if (hasProtected && hasStatic) {
                return BaseMemberType['protected-static-set'];
            }
            if (hasProtected && hasDecorator) {
                return BaseMemberType['protected-decorated-set'];
            }
            if (hasProtected) {
                return BaseMemberType['protected-instance-set'];
            }
            if (hasPrivate && hasStatic) {
                return BaseMemberType['private-static-set'];
            }
            return this.determineSetterMemberTypeTwo(hasPrivate, hasDecorator);
        }
        return BaseMemberType.set; // 默认返回 'set'
    }

    private determineSetterMemberTypeTwo(hasPrivate: boolean, hasDecorator: boolean): BaseMemberType {
        if (hasPrivate && hasDecorator) {
            return BaseMemberType['private-decorated-set'];
        }
        if (hasPrivate) {
            return BaseMemberType['private-instance-set'];
        }
        if (hasDecorator) {
            return BaseMemberType['decorated-set'];
        }
        return BaseMemberType.set;
    }

    private determineFieldMemberType(node: ts.Node): BaseMemberType {
        if (ts.isPropertyDeclaration(node)) {
            const modifiers = node.modifiers || [];
            const hasPublic = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PublicKeyword);
            const hasStatic = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword);
            const hasProtected = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword);
            const hasPrivate = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword);
            const hasReadonly = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword);
            // 判断是否为实例字段
            const isInstanceField = !hasStatic;

            if ((hasPublic || (!hasPublic && !hasProtected && !hasPrivate)) && hasStatic) {
                return BaseMemberType['public-static-field'];
            }
            if ((hasPublic || (!hasPublic && !hasProtected && !hasPrivate)) && hasReadonly) {
                return BaseMemberType['public-readonly-field'];
            }
            if (hasPublic && isInstanceField) {
                return BaseMemberType['public-instance-field'];
            }
            if (hasPublic) {
                return BaseMemberType['public-field'];
            }


            return this.determineFieldMemberTypeTwo(hasProtected, hasStatic, hasReadonly, hasPrivate, isInstanceField);
        }
        return BaseMemberType.field; // 默认返回 field
    }

    private determineFieldMemberTypeTwo(hasProtected: boolean, hasStatic: boolean, hasReadonly: boolean,
        hasPrivate: boolean, isInstanceField: boolean): BaseMemberType {
        if (hasProtected && hasStatic) {
            return BaseMemberType['protected-static-field'];
        }
        if (hasProtected && hasReadonly) {
            return BaseMemberType['protected-readonly-field'];
        }
        if (hasProtected && isInstanceField) {
            return BaseMemberType['protected-instance-field'];
        }
        if (hasProtected) {
            return BaseMemberType['protected-field'];
        }
        if (hasPrivate && hasStatic) {
            return BaseMemberType['private-static-field'];
        }
        if (hasStatic) {
            return BaseMemberType['static-field'];
        }
        if (hasPrivate && hasReadonly) {
            return BaseMemberType['private-readonly-field'];
        }
        if (hasPrivate && isInstanceField) {
            return BaseMemberType['private-instance-field'];
        }
        if (hasPrivate) {
            return BaseMemberType['private-field'];
        }
        if (isInstanceField) {
            return BaseMemberType['instance-field'];
        }
        return BaseMemberType.field;
    }

    private determineMethodMemberType(node: ts.Node): BaseMemberType {
        const modifiers = node.modifiers || [];
        const hasPublic = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PublicKeyword);
        const hasStatic = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword);
        const hasProtected = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword);
        const hasPrivate = modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword);

        // 判断是否为实例方法
        const isInstanceMethod = hasStatic;

        if (hasPublic && hasStatic) {
            return BaseMemberType['public-static-method'];
        }
        if (!hasPublic && !hasProtected && !hasPublic && isInstanceMethod) {
            return BaseMemberType['public-instance-method'];
        }
        if (hasPublic || (!hasPublic && !hasProtected && !hasPublic && !hasStatic)) {
            return BaseMemberType['public-method'];
        }
        if (hasProtected && hasStatic) {
            return BaseMemberType['protected-static-method'];
        }
        if (hasProtected && isInstanceMethod) {
            return BaseMemberType['protected-instance-method'];
        }
        if (hasProtected) {
            return BaseMemberType['protected-method'];
        }
        if (hasPrivate && hasStatic) {
            return BaseMemberType['private-static-method'];
        }
        return this.determineMethodMemberTypeTwo(hasPrivate, isInstanceMethod);
    }


    private determineMethodMemberTypeTwo(hasPrivate: boolean, isInstanceMethod: boolean): BaseMemberType {
        if (hasPrivate && isInstanceMethod) {
            return BaseMemberType['private-instance-method'];
        }
        if (hasPrivate) {
            return BaseMemberType['private-method'];
        }
        if (isInstanceMethod) {
            return BaseMemberType['instance-method'];
        }
        return BaseMemberType.method;
    }

    // 检查成员组排序
    private checkGroupSort(members: ts.Node[], orderConfig: BaseMemberType[]): LocationInfo[] {
        const results: LocationInfo[] = [];
        let lastRank = -1;
        let beforeRankType = '';
        for (const member of members) {
            const memberType = this.getNodeType(member);
            if (!memberType) {
                continue;
            }
            const rank = this.getRank(memberType, orderConfig);
            if (rank === -1) {
                continue;
            }
            if (rank < lastRank) {

                let memberName = this.getMemberName(member);
                if (memberName.startsWith('#')) {
                    memberName = memberName.replace('#', '');
                }
                let modifiedFieldType = this.modifiedFieldType(beforeRankType);
                results.push({
                    line: this.getLineAndCharacter(member).line,
                    startCol: this.getLineAndCharacter(member).character,
                    nameStr: memberName,
                    description: `Member ${memberName} should be declared before all ${modifiedFieldType} definitions.`
                });
            } else {
                beforeRankType = String(memberType);
                lastRank = rank;
            }
        }
        return results;
    }

    private modifiedFieldType(fieldType: string): string {
        let modifiedFieldType = fieldType;
        if (modifiedFieldType) {
            if (modifiedFieldType.startsWith('#public')) {
                modifiedFieldType = modifiedFieldType.replace('#public', '#private');
            } else if (modifiedFieldType.startsWith('#protected')) {
                modifiedFieldType = modifiedFieldType.replace('#protected', '#private');
            } else if (modifiedFieldType.startsWith('#') && !modifiedFieldType.startsWith('#private')) {
                modifiedFieldType = modifiedFieldType.replace('#', '#private-');
            } else if (modifiedFieldType.startsWith('public-method')) {
                modifiedFieldType = modifiedFieldType.replace('public-method', 'public-instance-method');
            } else if (modifiedFieldType.trim() === 'constructor') {
                modifiedFieldType = 'public constructor';
            }
            modifiedFieldType = modifiedFieldType.replace(/-/g, ' ');
        }
        return modifiedFieldType;
    }

    //检查成员按字母排序
    private checkAlphaSort(members: ts.Node[], sensitive: boolean): LocationInfo[] {
        const results: LocationInfo[] = [];
        const names = members.map(this.getMemberName); // 获取成员名称

        // 遍历所有成员，找出未按排序顺序排列的成员
        for (let i = 0; i < names.length - 1; i++) {
            let next = names[i + 1];
            let current = names[i];
            let compare = false;

            if (sensitive) {
                compare = this.compareValues(next, current);
            } else {
                compare = this.compareValues(next.toLowerCase(), current.toLowerCase());
            }
            if (compare) {
                // 如果当前成员未按排序顺序排列，记录其位置信息
                results.push({
                    line: this.getLineAndCharacter(members[i + 1]).line,
                    startCol: this.getLineAndCharacter(members[i + 1]).character,
                    nameStr: next,
                    description: `Member ${current} should be declared before member ${next}.`
                });
            }
        }

        return results;
    }
    //检查成员按字母排序
    private checkAlphaByGroupSort(members: ts.Node[], sensitive: boolean): LocationInfo[] {
        const results: LocationInfo[] = [];
        const names = members.map(this.getMemberName); // 获取成员名称
        // 遍历所有成员，找出未按排序顺序排列的成员
        for (let i = 0; i < names.length - 1; i++) {
            const current = names[i];
            const currentMemberType = this.getNodeType(members[i]);
            for (let j = i + 1; j < members.length - 1; j++) {
                const nextMemberType = this.getNodeType(members[j]);
                if (currentMemberType === nextMemberType) {
                    const next = names[j];

                    let compare = false;

                    if (sensitive) {
                        compare = this.compareValues(next, current);
                    } else {
                        compare = this.compareValues(next.toLowerCase(), current.toLowerCase());
                    }
                    if (compare) {
                        // 如果当前成员未按排序顺序排列，记录其位置信息
                        results.push({
                            line: this.getLineAndCharacter(members[j]).line,
                            startCol: this.getLineAndCharacter(members[j]).character,
                            nameStr: next,
                            description: `Member ${current} should be declared before member ${next}.`
                        });
                    }
                }

            }
        }

        return results;
    }

    private compareValues(next: string | number, current: string | number): boolean {
        // 将输入转换为字符串，以便统一处理
        const nextStr = String(next);
        const currentStr = String(current);

        // 检测是否为数字字符串
        const isNextNumber = !isNaN(parseFloat(nextStr)) && isFinite(parseFloat(nextStr));
        const isCurrentNumber = !isNaN(parseFloat(currentStr)) && isFinite(parseFloat(currentStr));

        // 如果两者都是数字字符串，按数字比较
        if (isNextNumber && isCurrentNumber) {
            return parseFloat(nextStr) < parseFloat(currentStr);
        }

        // 如果两者都是字符串，使用自然排序逻辑
        if (typeof next === 'string' && typeof current === 'string') {
            return this.naturalSort(nextStr, currentStr);
        }

        // 如果类型不一致，按字符串比较
        return nextStr < currentStr;
    }

    // 自然排序逻辑
    private naturalSort(a: string, b: string): boolean {
        const regex = /(\d+)|(\D+)/g; // 匹配数字或非数字部分
        const aParts = a.match(regex) || [];
        const bParts = b.match(regex) || [];

        for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
            const aPart = aParts[i];
            const bPart = bParts[i];

            if (aPart !== bPart) {
                // 如果是数字部分，按数字比较
                if (!isNaN(Number(aPart)) && !isNaN(Number(bPart))) {
                    return Number(aPart) < Number(bPart);
                }
                // 如果是非数字部分，按字符串比较
                return aPart < bPart;
            }
        }
        // 如果所有部分都相等，比较长度
        return aParts.length - bParts.length < 0;
    }

    //检查可选和必需成员排序
    private checkRequiredOrder(members: ts.Node[], insensitive: boolean): LocationInfo[] {
        const results: LocationInfo[] = [];
        let resultMember = members[0];
        let hasMark = false;
        for (let i = 0; i < members.length - 1; i++) {

            let next = members[i + 1];
            let nextIsMemberOptional = this.isMemberOptional(next);
            let current = members[i];
            let currentIsMemberOptional = this.isMemberOptional(current);
            if (insensitive) {
                if (i === 0 && !currentIsMemberOptional) {
                    this.addLocationInfo(results, current);
                    return results;
                }

                if (!currentIsMemberOptional && nextIsMemberOptional) {
                    if (hasMark) {
                        this.addLocationInfo(results, resultMember);
                    } else {
                        this.addLocationInfo(results, current);
                    }

                    return results;
                }
                if (!currentIsMemberOptional && !nextIsMemberOptional && !hasMark) {
                    resultMember = current;
                    hasMark = true;
                }
            } else {
                if (i === 0 && currentIsMemberOptional) {
                    this.addLocationInfo(results, current);
                    return results;
                }
                if (currentIsMemberOptional && !nextIsMemberOptional) {
                    if (hasMark) {
                        this.addLocationInfo(results, resultMember);
                    } else {
                        this.addLocationInfo(results, current);
                    }
                    return results;
                }
                if (currentIsMemberOptional && nextIsMemberOptional && !hasMark) {
                    resultMember = current;
                    hasMark = true;
                }
            }
        }
        return results;
    }

    private addLocationInfo(results: LocationInfo[], node: ts.Node): void {
        const location = this.getLineAndCharacter(node);
        results.push({
            line: this.getLineAndCharacter(node).line,
            startCol: this.getLineAndCharacter(node).character,
            nameStr: this.getMemberName(node),
            description: 'Require a consistent member declaration order'
        });
    }

    // 验证逻辑
    private validateMembersOrder(members: ts.Node[], filePath: string, orderConfigDefault: OrderConfig): void {
        let groupErrors: LocationInfo[] = [];
        let alphaErrors: LocationInfo[] = [];
        let requiredErrors: LocationInfo[] = [];
        let hasCollect: boolean = true;
        if (Array.isArray(orderConfigDefault)) {
            const orderConfig = orderConfigDefault as BaseMemberType[];
            groupErrors = this.checkGroupSort(members, orderConfig);
        } else if (typeof orderConfigDefault === 'object' && orderConfigDefault !== null) {
            const optionalityOrder = orderConfigDefault.optionalityOrder;
            const memberTypes = orderConfigDefault.memberTypes;
            const order = orderConfigDefault.order;
            if (memberTypes) {
                hasCollect = this.memberTypesChecks(members, orderConfigDefault, alphaErrors,
                    requiredErrors, groupErrors, filePath);
            } else {
                if (optionalityOrder) {
                    this.optionalityOrderErrors(members, optionalityOrder, requiredErrors, filePath);
                    return;
                }
                if (order) {
                    this.orderErrors(members, order, alphaErrors);
                }
            }
        }
        if (hasCollect) {
            this.collectErrors([...groupErrors, ...alphaErrors, ...requiredErrors], filePath);
        }
    }

    private memberTypesChecks(members: ts.Node[], orderConfigDefault: SortedOrderConfig, alphaErrors: LocationInfo[],
        requiredErrors: LocationInfo[], groupErrors: LocationInfo[], filePath: string): boolean {
        const optionalityOrder = orderConfigDefault.optionalityOrder;
        const memberTypes = orderConfigDefault.memberTypes;
        const order = orderConfigDefault.order;
        if (memberTypes === 'never') {
            this.memberTypesNeverErrors(members, optionalityOrder,
                order, alphaErrors, requiredErrors);
        } else {
            if (Array.isArray(memberTypes)) {
                groupErrors = this.checkGroupSort(members, memberTypes);
                if (order) {
                    this.orderByGroupErrors(members, order, alphaErrors);
                    this.collectErrors([...alphaErrors], filePath);
                }
                if (optionalityOrder) {
                    this.optionalityOrderErrors(members, optionalityOrder, requiredErrors, filePath);
                }
                return false;
            }
            if (optionalityOrder) {
                this.optionalityOrderErrors(members, optionalityOrder, requiredErrors, filePath);
            }
        }
        return true;
    }

    private memberTypesNeverErrors(members: ts.Node[], optionalityOrder: string | undefined,
        order: string, alphaErrors: LocationInfo[], requiredErrors: LocationInfo[]): void {
        if (optionalityOrder) {
            if (optionalityOrder === 'optional-first') {
                requiredErrors = this.checkRequiredOrder(members, true);
            } else if (optionalityOrder === 'required-first') {
                requiredErrors = this.checkRequiredOrder(members, false);
            }
        }
        if (order) {
            this.orderErrors(members, order, alphaErrors);
        }
    }

    private orderByGroupErrors(members: ts.Node[], order: string, alphaErrors: LocationInfo[]): void {
        if (order === 'alphabetically' || order === 'natural') {
            alphaErrors = this.checkAlphaByGroupSort(members, true);
        } else if (order === 'alphabetically-case-insensitive' || order === 'natural-case-insensitive') {
            alphaErrors = this.checkAlphaByGroupSort(members, false);
        }
    }
    private orderErrors(members: ts.Node[], order: string, alphaErrors: LocationInfo[]): void {
        if (order === 'alphabetically' || order === 'natural') {
            alphaErrors = this.checkAlphaSort(members, true);
        } else if (order === 'alphabetically-case-insensitive' || order === 'natural-case-insensitive') {
            alphaErrors = this.checkAlphaSort(members, false);
        }
    }

    private optionalityOrderErrors(members: ts.Node[], optionalityOrder: string, requiredErrors: LocationInfo[],
        filePath: string): void {
        if (optionalityOrder === 'optional-first') {
            requiredErrors = this.checkRequiredOrder(members, true);
        } else if (optionalityOrder === 'required-first') {
            requiredErrors = this.checkRequiredOrder(members, false);
        }
        this.collectErrors([...requiredErrors], filePath);
    }

    // 收集错误信息
    private collectErrors(results: LocationInfo[] = [], filePath: string): void {
        if (results.length > 0) {
            const uniqueResults = new Set<string>();
            results.forEach((loc) => {
                const errorKey = `${loc.line}-${loc.startCol}-${loc.nameStr}`;
                if (!uniqueResults.has(errorKey)) {
                    uniqueResults.add(errorKey);
                    this.addIssueReport(loc, filePath);
                }
            });
        }
    }

    private getLineAndCharacter(node: ts.Node): { line: number; character: number } {
        const { line, character } = this.asRoot.getLineAndCharacterOfPosition(node.getStart());
        return { line: line + 1, character: character + 1 };
    }

    private addIssueReport(loc: LocationInfo, filePath: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        if (loc.description) {
            this.metaData.description = loc.description;
        }
        let defect = new Defects(loc.line, loc.startCol, loc.startCol, this.metaData.description, severity,
            this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}