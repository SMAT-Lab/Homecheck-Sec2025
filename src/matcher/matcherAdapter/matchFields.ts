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

import { ArkClass, ArkFile } from 'arkanalyzer';
import { isMatchedFile, isMatchedNamespace, isMatchedClass, FieldMatcher, isMatchedField } from '../Matchers';


export function matchFields(arkFiles: ArkFile[], matcher: FieldMatcher, callback: Function) {
    for (let arkFile of arkFiles) {
        if (matcher.file && !isMatchedFile(arkFile, matcher.file)) {
            continue;
        }
        for (const ns of arkFile.getAllNamespacesUnderThisFile()) {
            if (matcher.namespace && !isMatchedNamespace(ns, matcher.namespace)) {
                continue;
            }
            matchFieldsInClasses(matcher, ns.getClasses(), callback);
        }
        matchFieldsInClasses(matcher, arkFile.getClasses(), callback);
    }
}

function matchFieldsInClasses(matcher: FieldMatcher, classes: ArkClass[], callback: Function) {
    for (const arkClass of classes) {
        if (matcher.class && !isMatchedClass(arkClass, matcher.class)) {
            continue;
        }
        for (const arkField of arkClass.getFields()) {
            if (isMatchedField(arkField, [matcher])) {
                callback(arkField);
            }
        }
    }
}
