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

import { ArkFile } from 'arkanalyzer';
import { NamespaceMatcher, isMatchedFile, isMatchedNamespace } from '../Matchers';

export function matchNameSpaces(arkFiles: ArkFile[], matcher: NamespaceMatcher, callback: Function) {
    for (let arkFile of arkFiles) {
        if (matcher.file && !isMatchedFile(arkFile, matcher.file)) {
            continue;
        }
        for (const ns of arkFile.getAllNamespacesUnderThisFile()) {
            if (isMatchedNamespace(ns, [matcher])) {
                callback(ns);
            }
        }
    }
}