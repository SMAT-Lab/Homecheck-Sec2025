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
import {
    AliasType,
    AnyType,
    ArkAliasTypeDefineStmt,
    ArrayType,
    ClassType,
    FunctionType,
    GenericType,
    IntersectionType,
    LiteralType,
    NeverType,
    NumberType,
    PrimitiveType,
    StringType,
    TupleType,
    Type,
    UnclearReferenceType,
    UnionType,
    UnknownType,
    VoidType,
} from 'arkanalyzer/lib';
import { Rule } from '../../model/Rule';

import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import {
    ClassMatcher,
    MatcherCallback,
    MatcherTypes,
} from '../../matcher/Matchers';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { KeyofTypeExpr, TypeQueryExpr } from 'arkanalyzer/lib/core/base/TypeExpr';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoTypeAlias');
type NoTypeAliasOptions = [
    {
        allowAliases?: string,
        allowCallbacks?: string,
        allowConditionalTypes?: string,
        allowConstructors?: string,
        allowLiterals?: string,
        allowMappedTypes?: string,
        allowTupleTypes?: string,
        allowGenerics?: string
    },
];

type UnionTypeData = {
    text: string,
    position: number
};

const defaultOptions: NoTypeAliasOptions = [
    {
        allowAliases: 'never',
        allowCallbacks: 'never',
        allowConditionalTypes: 'never',
        allowConstructors: 'never',
        allowLiterals: 'never',
        allowMappedTypes: 'never',
        allowTupleTypes: 'never',
        allowGenerics: 'never'
    },
];

interface MessageInfo {
    noTypeAlias: string,
    noCompositionAlias: string,
};

export class NoTypeAliasCheck implements BaseChecker {
    issues: IssueReport[] = [];
    readonly CONST_STR: string = 'const';
    readonly CONST_LET: string = 'let';
    readonly CONST_CONSTRUCTOR: string = 'constructor';
    readonly CONST_EQUAL: string = '=';
    readonly CONST_ARROW: string = '=>';

    private options: NoTypeAliasOptions;
    private messages: MessageInfo = {
        noTypeAlias: 'Type & are not allowed.',
        noCompositionAlias: '& in * types are not allowed.',
    };
    public rule: Rule;
    public defects: Defects[] = [];

    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-type-alias-check.md',
        description: '',
    };

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
    };

    public registerMatchers(): MatcherCallback[] {
        const classMatcherCb: MatcherCallback = {
            matcher: this.clsMatcher,
            callback: this.check,
        };
        return [classMatcherCb];
    }

    private getMessage(templateText: string, replaceText1: string, replaceText2?: string,): string {
        if (replaceText2) {
            return templateText.replace('&', replaceText1).replace('*', replaceText2);
        }
        return templateText.replace('&', replaceText1);
    }

    public check = (target: ArkClass) => {
        this.options = this.getDefaultOption();
        if (target instanceof ArkClass) {
            const filePath = target.getDeclaringArkFile().getFilePath();
            if (filePath.endsWith('.ts')) {
                const methods = target.getMethods();
                methods.forEach(method => {
                    const map = method.getBody()?.getAliasTypeMap();
                    this.checkRule(map, target);
                });
            }
        }
    };

    private checkRule(map: Map<string, [AliasType, ArkAliasTypeDefineStmt]> | undefined, target: ArkClass): void {
        map?.forEach((value: [AliasType, ArkAliasTypeDefineStmt]) => {
            this.checkCallbacks(value[0].getOriginalType(), value[1], target);
            this.checkConditionalTypes(value[0], value[1], target);
            this.checkConstructors(value[0].getOriginalType(), value[1], target);
            if (this.needCheckAliases(value[0], value[1])) {
                this.checkAliases(value[0].getOriginalType(), value[1], target);
            } else {
                const type = value[0].getOriginalType();
                if (type instanceof UnionType || type instanceof IntersectionType) {
                    this.checkAliases(value[0].getOriginalType(), value[1], target);
                }
                this.checkMappedTypes(value[0].getOriginalType(), value[1], target);
            }
            this.checkLiterals(value[0].getOriginalType(), value[1], target);
            this.checkTupleTypes(value[0].getOriginalType(), value[1], target);
            this.checkGenerics(value[0].getOriginalType(), value[1], target);
        });
    }

    private needCheckAliases(type: AliasType, declaration: ArkAliasTypeDefineStmt): boolean {
        const name = type.getName();
        const sourceCode = declaration.getOriginalText()!;
        const nameRightText = sourceCode.substring(sourceCode.indexOf(name) + name.length).trim();
        //兼容type Foo12 = {[K in keyof Others[0]]: Others[K];};  该用例检查checkMappedTypes，不检查checkAliases
        const content1 = nameRightText.substring(1).trim();
        const content2 = content1.substring(1).trim();
        const checkMappedTypes = (content1.startsWith('{') && content2.startsWith('[')) || nameRightText.startsWith('<');
        return !checkMappedTypes;
    }

    private checkGenerics(originalType: Type, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, parentType?: Type, data?: UnionTypeData) : void {
        const aliases = this.options[0].allowTupleTypes;
        if (aliases === 'always') {
            return;
        }
        let message = this.getRealMessage(parentType, aliases, 'generics', 'Generics');
        if (originalType instanceof ClassType) {
            this.checkGenericsClassType(declaration, data, clazz, message, originalType);
        } else if (originalType instanceof UnclearReferenceType) {
            this.checkGenericsUnclearReferenceType(declaration, clazz, message, originalType, data);
        } else if (originalType instanceof ArrayType) {
            this.checkGenericsArrayType(originalType, data, declaration, clazz, message);
        } else if (originalType instanceof UnionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(declaration.getOriginalText() ?? '', '|');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkGenerics(t, declaration, clazz, originalType, p);
            });
        } else if (originalType instanceof IntersectionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(data?.text ?? declaration.getOriginalText() ?? '', '&');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkGenerics(t, declaration, clazz, originalType, p);
            });

        }
    }

    private verifyPosition(dataL: UnionTypeData[], position: number, data: UnionTypeData | undefined) : UnionTypeData | undefined {
        const p = dataL.length > position ? dataL[position] : undefined;
        if (p) {
            p.position += data?.position ?? 0;
        }
        return p;
    }

    private checkGenericsUnclearReferenceType(
        declaration: ArkAliasTypeDefineStmt, 
        clazz: ArkClass, 
        message: string, 
        originalType: UnclearReferenceType, 
        data: UnionTypeData | undefined) : void {
        const hasGenerics = declaration.getOriginalText()!.substring(declaration.getOriginalText()!.indexOf('=') + 1).trim().includes('<');
        if (hasGenerics) {
            this.addIssueReport(declaration, clazz, message, originalType.getName(), data?.position);
        }
    }

    private checkGenericsClassType(declaration: ArkAliasTypeDefineStmt, 
        data: UnionTypeData | undefined, 
        clazz: ArkClass, 
        message: string, 
        originalType: ClassType) : void {
        const hasGenerics = declaration.getOriginalText()!.substring(declaration.getOriginalText()!.indexOf('=') + 1).trim().includes('<');
        if (hasGenerics && !data?.text.startsWith('{')) {
            this.addIssueReport(declaration, clazz, message, originalType.getClassSignature().getClassName(), data?.position);
        }
    }

    private checkGenericsArrayType(originalType: ArrayType, 
        data: UnionTypeData | undefined, 
        declaration: ArkAliasTypeDefineStmt, 
        clazz: ArkClass, message: string) : void {
        if (!(originalType.getBaseType() instanceof UnclearReferenceType)) {
            //type Foo = ReadonlyArray<object>[];不检查
            if (data) {
                if (!data.text.endsWith('[]') && !data.text.endsWith('[];')) {
                    this.addIssueReport(declaration, clazz, message, originalType.getTypeString(), data.position);
                }
            } else {
                const text = declaration.getOriginalText();
                let index = undefined;
                let right = undefined;
                if (text && text.includes('=')) {
                    right = text.substring(text.indexOf('=') + 1).trim();
                    index = text.indexOf(right);
                }
                if (!right?.endsWith('[]') && !right?.endsWith('[];')) {
                    this.addIssueReport(declaration, clazz, message, '', index);
                }
            }
        }
    }

    private checkTupleTypes(originalType: Type, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, parentType?: Type, data?: UnionTypeData) {
        const aliases = this.options[0].allowTupleTypes;
        if (aliases === 'always') {
            return;
        }
        let message = this.getRealMessage(parentType, aliases, 'tuple types', 'Tuple Types');
        if (originalType instanceof TupleType) {
            const rightText = data?.text ?? declaration.getOriginalText()!.substring(declaration.getOriginalText()!.indexOf('=') + 1).trim();
            this.addIssueReport(declaration, clazz, message, rightText, data?.position);
        } else if (originalType instanceof KeyofTypeExpr) {
            this.checkTupleKeyofType(data, declaration, clazz, message);
        } else if (originalType instanceof UnionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(declaration.getOriginalText() ?? '', '|');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkTupleTypes(t, declaration, clazz, originalType, p);
            });

        } else if (originalType instanceof IntersectionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(data?.text ?? declaration.getOriginalText() ?? '', '&');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkTupleTypes(t, declaration, clazz, originalType, p);
            });

        }
    }

    private checkTupleKeyofType(data: UnionTypeData | undefined, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, message: string) : void {
        if (data) {
            const rightText = data?.text ?? 'keyof';
            this.addIssueReport(declaration, clazz, message, rightText, data?.position);
        } else {
            const rightText = declaration.getOriginalText()!.substring(declaration.getOriginalText()!.indexOf('=') + 1).trim();
            const isList = rightText.includes('[') && rightText.includes(']');
            if (isList) {
                this.addIssueReport(declaration, clazz, message, rightText);
            }
        }
    }

    private checkMappedTypes(originalType: Type, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, parentType?: Type, data?: UnionTypeData) {
        const aliases = this.options[0].allowMappedTypes;
        if (aliases === 'always') {
            return;
        }
        let message = this.getRealMessage(parentType, aliases, 'mapped types', 'Mapped types');

        if (originalType instanceof UnknownType) {
            const rightText = data?.text ?? declaration.getOriginalText()!.substring(declaration.getOriginalText()!.indexOf('=') + 1).trim();
            if (rightText.startsWith('{')) {
                this.addIssueReport(declaration, clazz, message, rightText, data?.position);
            }
        } else if (originalType instanceof UnionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(declaration.getOriginalText() ?? '', '|');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkMappedTypes(t, declaration, clazz, originalType, p);
            });

        } else if (originalType instanceof IntersectionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(declaration.getOriginalText() ?? '', '&');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkMappedTypes(t, declaration, clazz, originalType, p);
            });

        }

    }

    private getRealMessage(parentType: Type | undefined, aliases: string | undefined, code1: string, code2: string): string {
        let message = this.getMessage(this.messages.noTypeAlias, code1);
        if (!parentType) {
            return message;
        }
        if (parentType instanceof UnionType) {
            if (parentType.getTypes().length > 1) {
                if (aliases === 'in-unions' || aliases === 'in-unions-and-intersections') {
                    message = '';
                } else {
                    message = this.getMessage(this.messages.noCompositionAlias, code2, 'union');
                }

            }
        } else if (parentType instanceof IntersectionType) {
            if (aliases === 'in-intersections' || aliases === 'in-unions-and-intersections') {
                message = '';
            } else {
                message = this.getMessage(this.messages.noCompositionAlias, code2, 'intersection');
            }
        }
        return message;
    }

    private checkLiterals(originalType: Type, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, parentType?: Type, data?: UnionTypeData) {
        const aliases = this.options[0].allowLiterals;
        if (aliases === 'always') {
            return;
        }
        let message = this.getRealMessage(parentType, aliases, 'literals', 'Literals');
        if (originalType instanceof ClassType) {
            this.checkLiteralsClassType(data, originalType, declaration, clazz, message);

        } else if (originalType instanceof UnionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(declaration.getOriginalText() ?? '', '|');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkLiterals(t, declaration, clazz, originalType, p);
            });

        } else if (originalType instanceof IntersectionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(declaration.getOriginalText() ?? '', '&');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkLiterals(t, declaration, clazz, originalType, p);
            });

        }
    }

    private checkLiteralsClassType(
        data: UnionTypeData | undefined,
        originalType: ClassType,
        declaration: ArkAliasTypeDefineStmt,
        clazz: ArkClass,
        message: string): void {
        if (data?.position && originalType.getClassSignature().getClassName().startsWith('%')) {
            this.addIssueReport(declaration, clazz, message, '', data.position);
        } else {
            const split = declaration.getOriginalText()!.split('=');
            const rightText = split[1].trim();
            if (rightText.startsWith('{')) {
                this.addIssueReport(declaration, clazz, message, rightText);
            } else if (rightText.startsWith('(')) {
                let count = this.getCount(rightText);
                this.addIssueReport(declaration, clazz, message, rightText.substring(count));
            }
        }
    }

    private getCount(rightText: string): number {
        let count = 0; //左括号的数量
        for (let i = 0; i < rightText.length; i++) {
            if (rightText.charAt(i) === '(') {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    private checkConstructors(originalType: Type, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, parentType?: Type, data?: UnionTypeData) : void {
        if (this.options[0].allowConstructors !== 'never') {
            return;
        }
        if (originalType instanceof UnknownType) {
            const message = this.getMessage(this.messages.noTypeAlias, 'constructors');
            const split = declaration.getOriginalText()!.split('=');
            const rightText = split[1].trim();
            if (rightText.startsWith('new')) {
                this.addIssueReport(declaration, clazz, message, rightText, data?.position);
            }
        } else if (originalType instanceof UnionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(declaration.getOriginalText() ?? '', '|');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkConstructors(t, declaration, clazz, originalType, p);
            });
        }
    }

    private checkConditionalTypes(type: AliasType, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass) {
        const originalType = type.getOriginalType();
        if (this.options[0].allowConditionalTypes === 'never') {
            const name = type.getName();
            const sourceCode = declaration.getOriginalText()!;
            const rightText = sourceCode.substring(sourceCode.indexOf(name) + name.length).trim();
            const equalRightText = sourceCode.substring(sourceCode.indexOf('=') + 1).trim();
            if (rightText.startsWith('<') &&
                !(equalRightText.startsWith('{') ||
                    equalRightText.startsWith('|') ||
                    equalRightText.startsWith('[') ||
                    equalRightText.startsWith('Array<') ||
                    equalRightText.startsWith('Arr<') ||
                    equalRightText.includes('=>') ||
                    originalType instanceof UnclearReferenceType ||
                    originalType instanceof UnionType
                )) {
                //用例type BazType<T> = Arr<T>; 不检查
                const message = this.getMessage(this.messages.noTypeAlias, 'conditional types');
                const split = declaration.getOriginalText()!.split('=');
                this.addIssueReport(declaration, clazz, message, split[1].trim());
            }
        }
    }

    private checkCallbacks(originalType: Type, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, parentType?: Type, data?: UnionTypeData) {
        const aliases = this.options[0].allowCallbacks;
        if (aliases === 'always') {
            return;
        }
        let message = this.getRealMessage(parentType, aliases, 'callbacks', 'Callbacks');

        if (originalType instanceof FunctionType) {
            const split = declaration.getOriginalText()!.split('=');
            this.addIssueReport(declaration, clazz, message, split[1].trim(), data?.position);
        } else if (originalType instanceof UnionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(declaration.getOriginalText() ?? '', '|');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkCallbacks(t, declaration, clazz, originalType, p);
            });
        } else if (originalType instanceof IntersectionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(data?.text ?? declaration.getOriginalText() ?? '', '&');
            types.forEach((t, position) => {
                const p = this.verifyPosition(dataL, position, data);
                this.checkCallbacks(t, declaration, clazz, originalType, p);
            });

        }
    }

    private checkAliases(originalType: Type, declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, parentType?: Type, data?: UnionTypeData) {
        const aliases = this.options[0].allowAliases;
        if (aliases === 'always') {
            return;
        }
        let message = this.getRealMessage(parentType, aliases, 'aliases', 'Aliases');
        if (originalType instanceof LiteralType) {
            this.addIssueReport(declaration, clazz, message, this.getText(data, originalType), data?.position);
        } else if (originalType instanceof StringType) {
            this.addIssueReport(declaration, clazz, message, this.getText1(data, originalType), data?.position);
        } else if (originalType instanceof KeyofTypeExpr) {
            //检查type Foo5 = ([string] & [number, number]) | keyof [number, number, number];时，不检查keyof [number, number, number]
            this.checkAliasKeyofType(declaration, parentType, clazz, message, data, originalType);
        } else if (originalType instanceof UnclearReferenceType) {
            //对于type Resolvable<R> = R | PromiseLike<R>; 不检查PromiseLike<R>
            this.checkAliasUnclearReferenceType(data, declaration, clazz, message, originalType);
        } else if (originalType instanceof ArrayType) {
            this.checkAliasArrayType(data, declaration, clazz, message, originalType);
        } else if (this.isNormalType(originalType)) {
            this.addIssueReport(declaration, clazz, message, this.getText2(data, originalType), data?.position);
        } else if (originalType instanceof UnknownType) {
            this.executeUnknownType(data, declaration, clazz, message, originalType);
        } else if (originalType instanceof GenericType) {
            this.checkAliasGenericType(data, declaration, clazz, message, originalType);
        } else if (originalType instanceof ClassType) {
            //过滤字面量类型
            this.executeClassType(originalType, declaration, clazz, message, data);
        } else if (originalType instanceof IntersectionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(this.getParseOriginText(data, declaration), '&');
            this.executeUnionOrIntersection(types, dataL, declaration, clazz, originalType, data?.position ?? 0);
        } else if (originalType instanceof UnionType) {
            const types = originalType.getTypes();
            const dataL = this.parseUnion(this.getParseOriginText(data, declaration), '|');
            this.executeUnionOrIntersection(types, dataL, declaration, clazz, originalType, data?.position ?? 0);
        }
    }

    private checkAliasGenericType(
        data: UnionTypeData | undefined, 
        declaration: ArkAliasTypeDefineStmt, 
        clazz: ArkClass, 
        message: string, 
        originalType: GenericType) : void {
        if (!data?.text.includes('<')) {
            this.addIssueReport(declaration, clazz, message, this.getText2(data, originalType), data?.position);
        }
    }

    private isNormalType(originalType: Type) : boolean {
        return originalType instanceof NumberType ||
            originalType instanceof TypeQueryExpr ||
            originalType instanceof VoidType ||
            originalType instanceof NeverType ||
            originalType instanceof AnyType ||
            originalType instanceof PrimitiveType;
    }

    private checkAliasArrayType(data: UnionTypeData | undefined,
        declaration: ArkAliasTypeDefineStmt,
        clazz: ArkClass,
        message: string,
        originalType: ArrayType): void {
        if (data) {
            this.addIssueReport(declaration, clazz, message, data.text, data.position);
        } else {
            const text = declaration.getOriginalText();
            let index = undefined;
            let right = undefined;
            if (text && text.includes('=')) {
                right = text.substring(text.indexOf('=') + 1).trim();
                index = text.indexOf(right);
            }
            if (!right?.startsWith('Array<')) {
                //type fooUnion = Array<string | number | boolean>;不检查
                this.addIssueReport(declaration, clazz, message, originalType.getTypeString(), index);
            }
        }
    }

    private checkAliasUnclearReferenceType(data: UnionTypeData | undefined,
        declaration: ArkAliasTypeDefineStmt,
        clazz: ArkClass,
        message: string,
        originalType: UnclearReferenceType): void {
        if (data && !(data.text.includes(('<')) && data.text.includes(('>')))) {
            this.addIssueReport(declaration, clazz, message, data.text, data?.position);
        } else {
            const text = declaration.getOriginalText();
            const right = text?.substring(text.indexOf('=') + 1).trim() ?? '';
            if (!(right.includes('<') && right.includes('>'))) {
                this.addIssueReport(declaration, clazz, message, this.getText2(data, originalType), data?.position);
            }
        }
    }

    private checkAliasKeyofType(declaration: ArkAliasTypeDefineStmt,
        parentType: Type | undefined,
        clazz: ArkClass,
        message: string,
        data: UnionTypeData | undefined,
        originalType: KeyofTypeExpr): void {
        const text = declaration.getOriginalText();
        const right = text?.substring(text.indexOf('=') + 1).trim() ?? '';
        const isList = right.includes('[') && right.includes(']');
        if (!parentType && !isList) {
            this.addIssueReport(declaration, clazz, message, this.getText2(data, originalType), data?.position);
        }
    }

    private getText(data: UnionTypeData | undefined, originalType: LiteralType): string {
        return data?.text ?? originalType.getLiteralName().toString();
    }

    private getText1(data: UnionTypeData | undefined, originalType: StringType): string {
        return data?.text ?? originalType.getName().toString();
    }

    private getText2(data: UnionTypeData | undefined,
        originalType: NumberType | ArrayType | TypeQueryExpr | VoidType | NeverType |
            AnyType | PrimitiveType | UnclearReferenceType | KeyofTypeExpr
    ): string {
        return data?.text ?? originalType.getTypeString();
    }

    private getParseOriginText(data: UnionTypeData | undefined, declaration: ArkAliasTypeDefineStmt): string {
        return data?.text ?? declaration.getOriginalText() ?? '';
    }

    private executeClassType(
        originalType: ClassType,
        declaration: ArkAliasTypeDefineStmt,
        clazz: ArkClass,
        message: string,
        data: UnionTypeData | undefined
    ): void {
        const name = originalType.getClassSignature().getClassName();
        if (!name.startsWith('%') && name !== 'Promise') {
            this.addIssueReport(declaration, clazz, message, originalType.getClassSignature().getClassName(), data?.position);
        }
    }

    private executeUnknownType(
        data: UnionTypeData | undefined,
        declaration: ArkAliasTypeDefineStmt,
        clazz: ArkClass,
        message: string,
        originalType: UnknownType
    ): void {
        if (data?.text) {
            if (!data.text.startsWith('{') && !data.text.startsWith('new ')) {
                this.addIssueReport(declaration, clazz, message, data?.text ?? originalType.getTypeString(), data?.position);
            }
        } else {
            //兼容type Foo2 = typeof import('foo');
            const rightText = declaration.getOriginalText()!.substring(declaration.getOriginalText()!.indexOf('=') + 1).trim();
            if (rightText.startsWith('typeof')) {
                this.addIssueReport(declaration, clazz, message, 'typeof');
            } else if (rightText.startsWith('(typeof')) {
                this.addIssueReport(declaration, clazz, message, '(typeof');
            } else {
                //兼容type Foo2 = Bar[-1]
                if (!rightText.startsWith('{') && !rightText.startsWith('new ')) {
                    this.addIssueReport(declaration, clazz, message, rightText);
                }

            }
        }
    }

    private executeUnionOrIntersection(
        types: Type[],
        dataL: UnionTypeData[],
        declaration: ArkAliasTypeDefineStmt,
        clazz: ArkClass,
        originalType: IntersectionType | UnionType,
        parentIndex: number): void {
        types.forEach((t, position) => {
            let p = dataL.length > position ? dataL[position] : undefined;
            if (p) {
                p.position += parentIndex;
            }
            if (t instanceof UnionType) {
                const inner = t.getTypes();
                if (inner.length === 1) {
                    this.checkAliases(inner[0], declaration, clazz, originalType, p);
                } else {
                    this.checkAliases(t, declaration, clazz, originalType, p);
                }
            } else {
                this.checkAliases(t, declaration, clazz, originalType, p);
            }
        });
    }

    public getDefaultOption(): NoTypeAliasOptions {
        let option: NoTypeAliasOptions;
        if (this.rule && this.rule.option) {
            option = this.rule.option as NoTypeAliasOptions;
            if (option[0]) {
                if (!option[0].allowAliases) {
                    option[0].allowAliases = 'never';
                }
                if (!option[0].allowCallbacks) {
                    option[0].allowCallbacks = 'never';
                }
                if (!option[0].allowConditionalTypes) {
                    option[0].allowConditionalTypes = 'never';
                }
                if (!option[0].allowConstructors) {
                    option[0].allowConstructors = 'never';
                }
                if (!option[0].allowLiterals) {
                    option[0].allowLiterals = 'never';
                }
                if (!option[0].allowMappedTypes) {
                    option[0].allowMappedTypes = 'never';
                }
                if (!option[0].allowTupleTypes) {
                    option[0].allowTupleTypes = 'never';
                }
                if (!option[0].allowGenerics) {
                    option[0].allowGenerics = 'never';
                }
                return option;
            }
        }
        return defaultOptions;
    }

    private addIssueReport(declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, description: string, text: string, position?: number): void {
        if (description) {
            let currDescription = description ? description : this.metaData.description;
            const severity = this.rule.alert ?? this.metaData.severity;
            const warnInfo = this.getLineAndColumn(declaration, clazz, text, position);
            if (warnInfo.startCol > -1) {
                const defect = new Defects(
                    warnInfo.line ?? 1,
                    warnInfo.startCol ?? 1,
                    warnInfo.startCol ?? 1,
                    currDescription,
                    severity,
                    this.rule.ruleId,
                    clazz.getDeclaringArkFile().getFilePath(),
                    this.metaData.ruleDocPath,
                    true,
                    false,
                    false
                );
                this.issues.push(new IssueReport(defect, undefined));
                RuleListUtil.push(defect);
            }
        }
    }

    private getLineAndColumn(declaration: ArkAliasTypeDefineStmt, clazz: ArkClass, text: string, position?: number) {
        const originPosition = declaration.getOriginPositionInfo();
        let line = originPosition.getLineNo();
        const arkFile = clazz.getDeclaringArkFile();
        if (arkFile) {
            let originText = declaration.getOriginalText()! ?? '';
            let preLenght = 0;
            if (originText.includes('=')) {
                preLenght = originText.indexOf('=') + 1;
                originText = originText.substring(preLenght);
            }
            let pos = originText.indexOf(text);
            let startCol = originPosition.getColNo();
            //当text在originText中出现多次,则以position为主
            let repeat = this.countOccurrences(originText, text);
            let userPosition = false;
            if (repeat > 1 && position) {
                pos = position;
                userPosition = true;
            }
            //兼容多行问题,当出现多行问题时,该逻辑优先,覆盖其他逻辑
            let count = 0;
            if (pos > -1) {
                count = this.countOccurrences(originText.substring(0, originText.indexOf(text)), '\n');
                line += count;
            }
            if (count > 0) {
                const split = originText.substring(0, originText.indexOf(text)).split('\n');
                const last = split.pop();
                pos = (last?.length ?? 0) + 1;
            }
            if ((pos === -1 || text === '' || count === 0) && position) {
                //position是以0开始，展示的pos是以1开始
                pos = position + startCol;
                userPosition = true;
            }
            if (pos !== -1) {
                if (userPosition) {
                    startCol = pos;
                } else {
                    startCol += pos + (count > 0 ? -1 : preLenght);
                }
                const endCol = startCol + text.length;
                const originPath = arkFile.getFilePath();
                return { line, startCol, endCol, filePath: originPath }
            }
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }

    /**
     * 计算一个字符串包含另一个字符串的次数
     * @param haystack  要搜索的字符串
     * @param needle 要查找的子字符串
     * @returns 子字符串出现的次数
     */
    private countOccurrences(haystack: string, needle: string): number {
        if (!needle) {
            return 0; // 如果要查找的字符串为空，返回0次
        }
        const text = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const regex = new RegExp(text, 'g');
        const matches = [...haystack.matchAll(regex)];

        return matches.length;
    }


    private parseUnion(input: string, logoString: string): UnionTypeData[] {
        const result: UnionTypeData[] = [];
        const unionPart = this.getUnionPart(input);
        if (!unionPart) {
            return result;
        }
        const unionStr = input.substring(unionPart.start, unionPart.end);
        let currentPos = 0;
        while (currentPos < unionStr.length) {
            // 跳过空格
            while (currentPos < unionStr.length && this.isWhitespace(unionStr[currentPos])) {
                currentPos++;
            }
            if (currentPos >= unionStr.length) {
                break;
            }
            const startItem = currentPos;
            const pipePos = this.findNextPipe(unionStr, currentPos, logoString);
            const itemRaw = unionStr.substring(startItem, pipePos);
            const item = itemRaw.trim();
            if (item) {
                this.pushItem(itemRaw, item, startItem, result, unionPart);

            }
            currentPos = pipePos + 1;
        }
        return result;
    }

    private pushItem(itemRaw: string, item: string, startItem: number, result: UnionTypeData[], unionPart: { start: number; end: number; }) : void {
        const itemStartInRaw = itemRaw.indexOf(item);
        const itemStartInUnion = startItem + itemStartInRaw;
        if (item.startsWith('(')) {
            if (item.endsWith(')')) {
                result.push({
                    text: item.substring(1, item.length - 1),
                    position: unionPart.start + itemStartInUnion + 1
                });
            } else if (item.endsWith(');')) {
                result.push({
                    text: item.substring(1, item.length - 2),
                    position: unionPart.start + itemStartInUnion + 1
                });
            }

        } else {
            result.push({
                text: item,
                position: unionPart.start + itemStartInUnion
            });
        }
    }

    private isWhitespace(c: string): boolean {
        return c === ' ' || c === '\t' || c === '\n' || c === '\r';
    }

    private findNextPipe(str: string, startPos: number, logoString: string): number {
        let pos = -1;
        let isBraces = 0;
        for (let i = startPos; i < str.length; i++) {
            const s = str.charAt(i);
            if (s === '(') {
                isBraces++;
            } else if (s === ')') {
                isBraces--;
            } else {
                if (s === logoString && isBraces === 0) {
                    pos = i;
                    break;
                }
            }
        }
        return pos === -1 ? str.length : pos;
    }

    private getUnionPart(s: string): { start: number; end: number } | null {
        let indexEqual = s.indexOf('=');
        let start = indexEqual + 1;
        // 跳过等号后的空格
        while (start < s.length && this.isWhitespace(s[start])) {
            start++;
        }
        let end = s.length;
        // 回退到分号前的非空格字符
        while (end > start && this.isWhitespace(s[end - 1])) {
            end--;
        }
        if (end <= start) {
            return null;
        }
        return { start, end };
    }
}
