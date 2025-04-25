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
import { Rule, MatcherTypes, MatcherCallback, FileMatcher } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { Defects, IssueReport } from '../../model/Defects';
import { RuleFix } from '../../model/Fix';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'BanTypesCheck');

interface WarnInfo {
    line: number;
    startCol: number;
    endColum: number;
    message: string;
    isCanFix: boolean;
};

type Types = Record<
    string,
    | boolean
    | string
    | {
        message: string;
        fixWith?: string;
        suggest?: readonly string[];
    }
    | null
>;

type Options = [
    {
        types?: Types;
        extendDefaults?: boolean;
    },
];

const StringMsg = 'Use string instead';
const BooleanMsg = 'Use boolean instead';
const NumberMsg = 'Use number instead';
const SymbolMsg = 'Use symbol instead';
const BigIntMsg = 'Use bigint instead';
const FunctionMsg = [
    'The `Function` type accepts any function-like value.',
    'It provides no type safety when calling the function, which can be a common source of bugs.',
    'It also accepts things like class declarations, which will throw at runtime as they will not be called with `new`.',
    'If you are expecting the function to accept certain arguments, you should explicitly define the function shape.',
].join('\n');

const ObjectMsg = [
    'The `Object` type actually means "any non-nullish value", so it is marginally better than `unknown`.',
    '- If you want a type meaning "any object", you probably want `object` instead.',
    '- If you want a type meaning "any value", you probably want `unknown` instead.',
    '- If you really want a type meaning "any non-nullish value", you probably want `NonNullable<unknown>` instead.',
].join('\n');

const LiteralObjectMsg = [
    '`{}` actually means "any non-nullish value".',
    '- If you want a type meaning "any object", you probably want `object` instead.',
    '- If you want a type meaning "any value", you probably want `unknown` instead.',
    '- If you want a type meaning "empty object", you probably want `Record<string, never>` instead.',
    '- If you really want a type meaning "any non-nullish value", you probably want `NonNullable<unknown>` instead.',
].join('\n');

const defaultTypes: Types = {
    String: {
        message: StringMsg,
        fixWith: 'string',
    },
    Boolean: {
        message: BooleanMsg,
        fixWith: 'boolean',
    },
    Number: {
        message: NumberMsg,
        fixWith: 'number',
    },
    Symbol: {
        message: SymbolMsg,
        fixWith: 'symbol',
    },
    BigInt: {
        message: BigIntMsg,
        fixWith: 'bigint',
    },

    Function: {
        message: FunctionMsg,
    },
    // object typing
    Object: {
        message: ObjectMsg,
        suggest: ['object', 'unknown', 'NonNullable<unknown>'],
    },
    '{}': {
        message: LiteralObjectMsg,
        suggest: [
            'object',
            'unknown',
            'Record<string, never>',
            'NonNullable<unknown>',
        ],
    },
};

export class BanTypesCheck implements BaseChecker {
    private defaultOptions: Options = [{ types: defaultTypes }];
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private bannedTypes: Map<string, Types[keyof Types]> = new Map();
    private canFixTypes: string[] = ['String', 'Boolean', 'Number', 'Symbol', 'BigInt'];
    private filePath: string = '';

    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/ban-types-check.md',
        description: 'Disallow certain types.',
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };

        return [fileMatcherCb];
    };

    public check = (target: ArkFile): void => {
        try {
            this.getDefaultOptions();
            this.filePath = target.getFilePath();
            const sourceFile = AstTreeUtils.getSourceFileFromArkFile(target);

            // 遍历 AST
            this.visitNode(sourceFile, sourceFile);
        } catch (error) {
            logger.error(`Error occurred while checking file: ${target.getFilePath()}, Error: ${error}`);
        };
    };

    private getDefaultOptions(): void {
        if (this.rule && this.rule.option && this.rule.option[0]) {
            const options = this.rule.option as Options;
            const extendDefaults = options[0].extendDefaults ?? true;
            const customTypes = options[0].types ?? {};

            // 合并默认类型和自定义类型
            const mergedTypes = extendDefaults
                ? { ...defaultTypes, ...customTypes }
                : customTypes;

            this.defaultOptions[0].types = mergedTypes;
            this.defaultOptions[0].extendDefaults = extendDefaults;
        } else {
            this.defaultOptions = [{ types: defaultTypes }];
        };

        if (this.defaultOptions[0].types) {
            // 创建禁用类型映射，保留 null 值的配置
            this.bannedTypes = new Map(
                Object.entries(this.defaultOptions[0].types).map(([type, data]) => [
                    this.removeKeySpaces(type),
                    data === null ? null : data
                ])
            );

            // 更新可修复类型列表
            this.canFixTypes = Object.entries(this.defaultOptions[0].types)
                .filter(([_, data]) => data && typeof data === 'object' && 'fixWith' in data)
                .map(([type]) => this.removeKeySpaces(type));
        };
    }

    private checkTypeReferenceNode(node: ts.TypeReferenceNode, sourceFile: ts.SourceFile): void {
        if (ts.isIdentifier(node.typeName)) {
            const typeName = node.typeName.getText(sourceFile);
            this.checkTypeString(typeName, node.typeName, sourceFile);
            this.checkBannedType(node, sourceFile);
        } else if (ts.isQualifiedName(node.typeName)) {
            this.checkQualifiedTypeName(node.typeName, sourceFile);
        } else {
            this.checkBannedType(node, sourceFile);
        };
    };

    private checkTypeLiteralNode(node: ts.TypeLiteralNode, sourceFile: ts.SourceFile): void {
        const typeText = node.getText();
        const strippedType = this.removeKeySpaces(typeText);
        if (strippedType === '{}') {
            this.checkBannedType(node, sourceFile);
        };
    };

    private checkTupleTypeNode(node: ts.TupleTypeNode, sourceFile: ts.SourceFile): void {
        const typeText = node.getText();
        const tupleText = this.removeKeySpaces(typeText);
        if (tupleText === '[]' || tupleText === '[[]]') {
            this.checkBannedType(node, sourceFile);
        };

        node.elements.forEach((element: ts.Node) => {
            if (ts.isTypeReferenceNode(element)) {
                this.checkBannedType(element, sourceFile);
            };
        });
    };

    private checkInterfaceDeclaration(node: ts.InterfaceDeclaration, sourceFile: ts.SourceFile): void {
        if (!node.heritageClauses) {
            return;
        };
        node.heritageClauses.forEach((clause: ts.HeritageClause) => {
            clause.types.forEach((type: ts.Node) => {
                if (ts.isTypeReferenceNode(type) || ts.isExpressionWithTypeArguments(type)) {
                    this.checkBannedType(type, sourceFile);
                };
            });
        });
        // 检查接口成员的类型
        this.checkInterfaceMembers(node, sourceFile);
    };

    private checkInterfaceMembers(node: ts.InterfaceDeclaration, sourceFile: ts.SourceFile): void {
        node.members.forEach(member => {
            if (ts.isPropertySignature(member) && member.type) {
                this.checkBannedType(member.type, sourceFile);
            };
        });
    };

    private checkClassDeclaration(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): void {
        // 检查继承和实现的类型
        if (!node.heritageClauses) {
            return;
        };
        // 遍历继承和实现的类型
        node.heritageClauses.forEach((clause: ts.HeritageClause) => {
            clause.types.forEach(type => {
                if (this.isHeritageTypeToCheck(type)) {
                    this.checkBannedType(type, sourceFile);
                };
            });
        });

        // 检查类成员的类型
        this.checkClassMembers(node, sourceFile);
    };

    private checkClassMembers(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): void {
        node.members.forEach(member => {
            // 检查属性和方法的类型
            this.checkMemberType(member, sourceFile);
            // 检查方法参数的类型
            if (ts.isMethodDeclaration(member)) {
                this.checkMethodParameters(member, sourceFile);
            };
        });
    };

    private checkMemberType(member: ts.ClassElement, sourceFile: ts.SourceFile): void {
        if ((ts.isPropertyDeclaration(member) || ts.isMethodDeclaration(member)) && member.type) {
            this.checkBannedType(member.type, sourceFile);
        };
    };

    private checkMethodParameters(method: ts.MethodDeclaration, sourceFile: ts.SourceFile): void {
        method.parameters.forEach(param => {
            if (param.type) {
                this.checkBannedType(param.type, sourceFile);
            };
        });
    };

    // 重命名方法以更准确地反映其用途
    private isHeritageTypeToCheck(type: ts.Node): boolean {
        return ts.isTypeReferenceNode(type) ||
            (ts.isExpressionWithTypeArguments(type) && !this.shouldSkipInheritanceCheck(type));
    };

    private visitNode(node: ts.Node, sourceFile: ts.SourceFile): void {
        if (ts.isTypeReferenceNode(node)) {
            this.checkTypeReferenceNode(node, sourceFile);
        } else if (ts.isTypeLiteralNode(node)) {
            this.checkTypeLiteralNode(node, sourceFile);
        } else if (ts.isTupleTypeNode(node)) {
            this.checkTupleTypeNode(node, sourceFile);
        } else if (ts.isInterfaceDeclaration(node)) {
            this.checkInterfaceDeclaration(node, sourceFile);
        } else if (ts.isClassDeclaration(node)) {
            this.checkClassDeclaration(node, sourceFile);
        } else if (ts.isTypeAliasDeclaration(node)) {
            this.checkBannedType(node.type, sourceFile);
        } else if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
            node.parameters.forEach((param: ts.ParameterDeclaration) => {
                if (param.type) {
                    this.checkBannedType(param.type, sourceFile);
                };
            });
            if (node.type) {
                this.checkBannedType(node.type, sourceFile);
            };
        } else if (ts.isVariableDeclaration(node) && node.type) {
            this.checkBannedType(node.type, sourceFile);
        } else if (ts.isParameterPropertyDeclaration(node, node.parent) && node.type) {
            this.checkBannedType(node.type, sourceFile);
        };

        ts.forEachChild(node, child => this.visitNode(child, sourceFile));
    };

    private shouldSkipInheritanceCheck(type: ts.ExpressionWithTypeArguments): boolean {
        const text = type.getText();
        const builtInTypes = ['String', 'Number', 'Boolean', 'Object', 'Function'];
        return builtInTypes.some(t => text.startsWith(t));
    };

    private checkQualifiedTypeName(node: ts.QualifiedName, sourceFile: ts.SourceFile): void {
        // 获取完整的限定名
        const fullName = node.getText();

        // 检查最右边的标识符是否是禁用类型
        const bannedType = this.bannedTypes.get(this.removeKeySpaces(fullName));
        if (bannedType) {
            this.checkBannedType(node, sourceFile);
        };
    };

    private checkTypeString(typeString: string, node: ts.Node, sourceFile: ts.SourceFile): void {
        // 检查类型是否在禁用列表中
        const bannedType = this.bannedTypes.get(typeString);
        if (!this.bannedTypes.has(typeString) || bannedType === false) {
            return;
        };
        this.commonCheck(node, sourceFile, typeString, bannedType);
    };

    private checkBannedType(node: ts.Node, sourceFile: ts.SourceFile): void {
        const typeText = node.getText();
        const strippedType = this.removeKeySpaces(typeText);

        this.checkTypeString(strippedType, node, sourceFile);
    };

    private commonCheck(node: ts.Node, sourceFile: ts.SourceFile, typeString: string, bannedType: Types[keyof Types] | undefined): void {
        // 构造错误信息
        const message = `Don't use \`${typeString}\` as a type.${this.getCustomMessageByType(bannedType)}`;
        // 获取节点在源文件中的位置信息
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const isCanFix = this.canFixTypes.includes(typeString);

        let defect = this.addIssueReport({
            line: line + 1,
            startCol: character + 1,
            endColum: character + 1 + typeString.length,
            message: message,
            isCanFix: isCanFix
        });
        let fix: RuleFix | undefined;
        if (isCanFix) {
            fix = this.createFix(node, bannedType);
        };
        this.issues.push(new IssueReport(defect, fix));
        RuleListUtil.push(defect);
    };

    private createFix(node: ts.Node, bannedType: Types[keyof Types] | undefined): RuleFix | undefined {
        if (typeof bannedType === 'object' && bannedType !== null && 'fixWith' in bannedType) {
            return { range: [node.getStart(), node.getEnd()], text: bannedType.fixWith as string };
        };
        return undefined;
    };

    private addIssueReport(warnInfo: WarnInfo): Defects {
        this.metaData.description = warnInfo.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endColum, this.metaData.description, severity, this.rule.ruleId,
            this.filePath, this.metaData.ruleDocPath, true, false, warnInfo.isCanFix);
        return defect;
    };

    // 去除空格
    removeKeySpaces(str: string): string {
        return str.replace(/\s/g, '');
    };

    // 获取自定义消息
    private getCustomMessageByType(
        bannedType: Types[keyof Types] | undefined,
    ): string {
        if (bannedType == null) {
            return '';
        } else if (typeof bannedType === 'string') {
            return ` ${bannedType}`;
        } else if (typeof bannedType === 'object' && 'message' in bannedType) {
            return ` ${bannedType.message}`;
        };

        return '';
    }
}
