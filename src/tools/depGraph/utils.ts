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

import fs from 'fs';
import {fetchDependenciesFromFile, OH_PACKAGE_JSON5} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import path from 'path';
import {ModuleCategory} from './moduleComponent';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'depGraphUtils');

export const OH_MODULES_DIR = './oh_modules/';

export function getModuleKind(modulePath: string): ModuleCategory {
    const moduleJson5Path = path.join(modulePath, './src/main/module.json5');
    const content = fetchDependenciesFromFile(moduleJson5Path);
    if (!content.type) {
        switch (content.type as string) {
            case 'entry':
                return ModuleCategory.ENTRY;
            case 'feature':
                return ModuleCategory.FEATURE;
            case 'har':
                return ModuleCategory.HAR;
            case 'shared':
                return ModuleCategory.HSP;
            default:
                break;
        }
    }

    const ohPkgPath = path.join(modulePath, OH_PACKAGE_JSON5);
    if (!fs.existsSync(ohPkgPath)) {
        return ModuleCategory.UNKNOWN;
    }
    const ohPkgContent = fetchDependenciesFromFile(ohPkgPath);
    if (ohPkgContent.packageType) {
        return ModuleCategory.HSP;
    } else {
        return ModuleCategory.HAR;
    }
}
