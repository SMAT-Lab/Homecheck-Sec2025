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

import { Scene } from 'arkanalyzer';
import { Defects, MatcherCallback, Rule } from '../../Index';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { IssueReport } from '../../model/Defects';
import { existsSync } from 'fs';
import path from 'path';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'DarkColorModeCheck');

const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/drak-color-mode-check.md',
    description: 'Properly adapt to the dark mode.'
};

export class DarkColorModeCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: undefined,
            callback: this.check
        };
        return [matchBuildCb];
    }

    public check = (scene: Scene): void => {
        for (let [key, value] of scene.getModuleSceneMap()) {
            let darkFilePath = path.join(value.getModulePath(), 'src', 'main', 'resources', 'dark');
            if (!existsSync(darkFilePath)) {
                this.reportIssue(Array.from(value.getModuleFilesMap().values())[0].getFilePath());
            }
        }
    };

    private reportIssue(filePath: string): void {
        let severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(0, 0, 0, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}