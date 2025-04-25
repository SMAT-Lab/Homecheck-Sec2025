/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
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
import { Defects } from '../../model/Defects';
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CheckEntry');

namespace DefectsList {
    let defects: Defects[] = [];

    export function add(defect: Defects) {
        defects.push(defect);
    }

    export function updateDefectByIndex(index: number, defect: Defects) {
        defects[index] = defect;
    }

    export function getDefects(): Defects[] {
        return defects;
    }

    export function clear() {
        defects = [];
    }
}


export class RuleListUtil {
    static push(defect: Defects) {
        // const list = DefectsList.getDefects();
        // if (!list.find(({ mergeKey }) => mergeKey === defect.mergeKey)) {
        //     DefectsList.add(defect);
        // }
    }

    static updateDefect(defect: Defects) {
        // const list = DefectsList.getDefects();
        // const index = list.findIndex(item => item.fixKey === defect.fixKey);
        // if (index !== -1) {
        //     DefectsList.updateDefectByIndex(index, defect);
        // }
    }

    static printDefects() {
        // const defects = DefectsList.getDefects();
        // let defectsMap: Map<string, Defects[]> = new Map;
        // for (const defect of defects) {
        //     const filePath = defect.mergeKey.split('%')[0];
        //     if (defectsMap.has(filePath)) {
        //         defectsMap.get(filePath)?.push(defect);
        //     } else {
        //         defectsMap.set(filePath, [defect])
        //     }
        // }
        // defectsMap.forEach((value, key) => {
        //     // logger.info(`${key}(${value.length})`);
        //     value.forEach(item => {
        //         const level = item.severity === 2 ? 'error' : 'warn';
        //         const text = `${item.reportLine}:${item.reportColumn}\t\t${level}\t\t${item.description.padEnd(100)}${item.ruleId}`;
        //         // logger.info('Text: ' + text);
        //     })
        // })
        // DefectsList.clear();
    }

    static isFilter(ruleId: string): boolean {
        return ruleId.startsWith('@ArkTS-eslint');
    }
}
