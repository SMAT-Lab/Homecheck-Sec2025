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

import { GlobMatch } from "../utils/common/GlobMatch";

export class RuleConfig {
    public files: GlobMatch;
    public ignore: GlobMatch;
    public rules: object;
    public extRules: object;
    public extRuleSet: object[];
    public ruleSet: string[];
    public overrides: RuleConfig[];

    constructor(config: any) {
        if (config.files && config.files.length > 0) {
            this.files = new GlobMatch(config.files);
        } else {
            this.files = new GlobMatch(['**/*.ets']);
        }
        if (config.ignore) {
            if (config.ignore.length > 0) {
                this.ignore = new GlobMatch(config.ignore);
            }
        } else if (config.excluded && config.excluded.length > 0) {
            this.ignore = new GlobMatch(config.excluded);
        }
        this.rules = config.rules ?? {};
        this.extRules = config.extRules ?? {};
        this.extRuleSet = config.extRuleSet ?? [];
        this.ruleSet = config.ruleSet ?? [];

        if (config.overrides) {
            let overrides: RuleConfig[] = [];
            let overRuleConfigs = config.overrides;
            overRuleConfigs.forEach((overRuleConfig: any) => {
                overrides.push(new RuleConfig(overRuleConfig));
            });
            this.overrides = overrides;
        } else {
            this.overrides = [];
        }
    }
}