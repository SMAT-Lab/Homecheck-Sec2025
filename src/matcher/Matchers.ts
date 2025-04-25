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

import { ArkField, ArkFile, ArkMethod, ArkNamespace, Scene } from "arkanalyzer";
import { ArkClass, ClassCategory } from "arkanalyzer/lib/core/model/ArkClass";

export enum MethodCategory {
    Accessor = 0,
    ArrowFunction = 1,
    FunctionExpression = 2,
    Constructor = 3
}

export enum MatcherTypes {
    FILE = 0,
    NAMESPACE = 1,
    CLASS = 2,
    METHOD = 3,
    FIELD = 4,
    EXPR = 5
}

export interface BaseMatcher {
    [matchFieldName: string]: any;
}

//TODO: move to FileMatcher.ts
export interface FileMatcher extends BaseMatcher {
    readonly matcherType: MatcherTypes.FILE;
    name?: string;
}

export interface NamespaceMatcher extends BaseMatcher {
    readonly matcherType: MatcherTypes.NAMESPACE;
    name?: string[];
    file?: (FileMatcher | ArkFile)[];
    namespace?: (NamespaceMatcher | ArkNamespace)[];
    isExport?: boolean;
}

export interface ClassMatcher extends BaseMatcher {
    readonly matcherType: MatcherTypes.CLASS;
    name?: string[];
    file?: (FileMatcher | ArkFile)[];
    namespace?: (NamespaceMatcher | ArkNamespace)[];
    category?: ClassCategory[];
    isAbstract?: boolean;
    isExport?: boolean;
    extends?: (ClassMatcher | ArkClass)[];
    implements?: (ClassMatcher | ArkClass)[];
    hasViewTree?: boolean;
}

export interface MethodMatcher extends BaseMatcher {
    readonly matcherType: MatcherTypes.METHOD;
    name?: string[];
    file?: (FileMatcher | ArkFile)[];
    namespace?: (NamespaceMatcher | ArkNamespace)[];
    class?: (ClassMatcher | ArkClass)[];
    category?: MethodCategory[];
    decorators?: string[];
    isStatic?: boolean;
    isExport?: boolean;
    isPublic?: boolean;
    isPrivate?: boolean;
    isProtected?: boolean;
    isAbstract?: boolean;
    hasViewTree?: boolean;
    isAnonymous?: boolean;
}

export interface FieldMatcher extends BaseMatcher {
    readonly matcherType: MatcherTypes.FIELD;
    name?: string[];
    file?: (FileMatcher | ArkFile)[];
    namespace?: (NamespaceMatcher | ArkNamespace)[];
    class?: (ClassMatcher | ArkClass)[];
    decorators?: string[];
    isStatic?: boolean;
    isPublic?: boolean;
    isPrivate?: boolean;
    isProtected?: boolean;
    isReadonly?: boolean;
}

export interface MatcherCallback {
    matcher: BaseMatcher | undefined,
    callback: Function
}

export function isMatchedFile(arkFile: ArkFile, matchers: (FileMatcher | ArkFile)[]): boolean {
    for (const fileMatcher of matchers) {
        if (fileMatcher instanceof ArkFile) {
            if (arkFile === fileMatcher) {
                return true;
            }
        } else {
            if (fileMatcher.name && arkFile.getName() !== fileMatcher.name) {
                continue;
            }
            return true;
        }
    }
    return false;
}

export function isMatchedNamespace(arkNs: ArkNamespace | null | undefined, matchers: (NamespaceMatcher | ArkNamespace)[]): boolean {
    if (!arkNs) {
        return false;
    }

    for (const nsMatcher of matchers) {
        if (nsMatcher instanceof ArkNamespace) {
            if (arkNs === nsMatcher) {
                return true;
            }
        } else {
            if (nsMatcher.file && !isMatchedFile(arkNs.getDeclaringArkFile(), nsMatcher.file) ||
                nsMatcher.namespace && !isMatchedNamespace(arkNs.getDeclaringArkNamespace(), nsMatcher.namespace) ||
                nsMatcher.name && !nsMatcher.name.includes(arkNs.getName()) ||
                nsMatcher.isExported !== undefined && nsMatcher.isExported !== arkNs.isExport()) {
                continue;
            }
            // todo: 未考虑嵌套ns场景
            return true;
        }
    }
    return false;
}

export function isMatchedClass(arkClass: ArkClass | null | undefined, matchers: (ClassMatcher | ArkClass)[]): boolean {
    if (!arkClass) {
        return false;
    }
    for (const classMatcher of matchers) {
        if (classMatcher instanceof ArkClass) {
            if (arkClass === classMatcher) {
                return true;
            }
        } else {
            if (classMatcher.file && !isMatchedFile(arkClass.getDeclaringArkFile(), classMatcher.file) ||
                classMatcher.namespace && !isMatchedNamespace(arkClass.getDeclaringArkNamespace(), classMatcher.namespace) ||
                classMatcher.name && !classMatcher.name.includes(arkClass.getName()) ||
                classMatcher.category && !classMatcher.category.includes(arkClass.getCategory()) ||
                classMatcher.isAbstract !== undefined && classMatcher.isAbstract !== arkClass.isAbstract() ||
                classMatcher.isExport !== undefined && classMatcher.isExport !== arkClass.isExport() ||
                classMatcher.hasViewTree !== undefined && classMatcher.hasViewTree !== arkClass.hasViewTree() ||
                // classMatcher.implements && !isMatchedClass(arkClass.getImplementedInterfaces(), classMatcher.implements) ||
                classMatcher.extends && !isMatchedClass(arkClass.getSuperClass(), classMatcher.extends)) {
                continue;
            }
            return true;
        }
    }
    return false;
}

export function isMatchedMethod(arkMethod: ArkMethod | null | undefined, matchers: (MethodMatcher | ArkMethod)[]): boolean {
    if (!arkMethod) {
        return false;
    }
    for (const mtdMatcher of matchers) {
        if (mtdMatcher instanceof ArkMethod) {
            if (mtdMatcher === arkMethod) {
                return true;
            }
        } else {
            if (mtdMatcher.file && !isMatchedFile(arkMethod.getDeclaringArkFile(), mtdMatcher.file) ||
                mtdMatcher.namespace && !isMatchedNamespace(arkMethod.getDeclaringArkClass().getDeclaringArkNamespace(), mtdMatcher.namespace) ||
                mtdMatcher.class && !isMatchedClass(arkMethod.getDeclaringArkClass(), mtdMatcher.class) ||
                // mtdMatcher.category && !mtdMatcher.category.includes(arkMethod.getCategory()) ||
                mtdMatcher.isAnonymous && !arkMethod.isAnonymousMethod() ||
                mtdMatcher.name && !mtdMatcher.name.includes(arkMethod.getName()) ||
                mtdMatcher.decorators && !arkMethod.getDecorators().some(d => mtdMatcher.decorators!.includes(d.getKind())) ||
                mtdMatcher.isStatic !== undefined && mtdMatcher.isStatic !== arkMethod.isStatic() ||
                mtdMatcher.isExport !== undefined && mtdMatcher.isExport !== arkMethod.isExport() ||
                mtdMatcher.isPublic !== undefined && mtdMatcher.isPublic !== arkMethod.isPublic() ||
                mtdMatcher.isPrivate !== undefined && mtdMatcher.isPrivate !== arkMethod.isPrivate() ||
                mtdMatcher.isProtected !== undefined && mtdMatcher.isProtected !== arkMethod.isProtected() ||
                mtdMatcher.hasViewTree !== undefined && mtdMatcher.hasViewTree !== arkMethod.hasViewTree() ||
                mtdMatcher.isAbstract !== undefined && mtdMatcher.isAbstract !== arkMethod.isAbstract()) {
                continue;
            }
            return true;
        }
    }
    return false;
}

export function isMatchedField(arkField: ArkField | null | undefined, matchers: (FieldMatcher | ArkField)[]): boolean {
    if (!arkField) {
        return false;
    }
    for (const fieldMatcher of matchers) {
        if (fieldMatcher instanceof ArkField) {
            if (fieldMatcher === arkField) {
                return true;
            }
        } else {
            if (fieldMatcher.file && !isMatchedFile(arkField.getDeclaringArkClass().getDeclaringArkFile(), fieldMatcher.file) ||
                fieldMatcher.namespace && !isMatchedNamespace(arkField.getDeclaringArkClass().getDeclaringArkNamespace(), fieldMatcher.namespace) ||
                fieldMatcher.class && !isMatchedClass(arkField.getDeclaringArkClass(), fieldMatcher.class) ||
                fieldMatcher.name && !fieldMatcher.name.includes(arkField.getName()) ||
                fieldMatcher.decorators && !arkField.getDecorators().some(d => fieldMatcher.decorators!.includes(d.getKind())) ||
                fieldMatcher.isStatic !== undefined && fieldMatcher.isStatic !== arkField.isStatic() ||
                fieldMatcher.isPublic !== undefined && fieldMatcher.isPublic !== arkField.isPublic() ||
                fieldMatcher.isPrivate !== undefined && fieldMatcher.isPrivate !== arkField.isPrivate() ||
                fieldMatcher.isProtected !== undefined && fieldMatcher.isProtected !== arkField.isProtected()) {
                continue;
            }
            return true;
        }
    }
    return false;
}