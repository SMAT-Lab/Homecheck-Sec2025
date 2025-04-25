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
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
import { ArkFile } from "arkanalyzer";
import { Rule, BaseChecker } from "../../Index";
import { File2Check } from "../../model/File2Check";
import { Project2Check } from "../../model/Project2Check";
import { CheckerFactory } from "./CheckerFactory";


const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CheckBuilder');

export function fileCheckBuilder(arkFile: ArkFile, enabledRules: Rule[]) {
    let checkIns = new File2Check();
    checkIns.arkFile = arkFile;
    enabledRules.forEach(rule => {
        const checkerInstance = CheckerFactory.getChecker(rule);
        if (checkerInstance) {
            checkIns.addChecker(rule.ruleId, checkerInstance as BaseChecker);
        } else {
            logger.error(`Cannot find checker according rule id: ${rule.ruleId}`);
        }
    });
    return checkIns;
}

export function projectCheckBuilder(arkFiles: ArkFile[], enabledRules: Rule[]) {
    let checkIns = new Project2Check();
    checkIns.arkFiles = arkFiles;
    enabledRules.forEach(rule => {
        const checkerInstance = CheckerFactory.getChecker(rule);
        if (checkerInstance) {
            checkIns.addChecker(rule.ruleId, checkerInstance as BaseChecker);
        } else {
            logger.log(`Cannot find checker according rule id: ${rule.ruleId}`);
        }
    });
    return checkIns;
}