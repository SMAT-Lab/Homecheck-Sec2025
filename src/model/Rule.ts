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

export class Rule {
    ruleId: string;
    alert: ALERT_LEVEL;
    allowExpressions: boolean
    ignoreRestArgs: boolean
    option: Object[] = []

    constructor(ruleId: string, alert: ALERT_LEVEL = ALERT_LEVEL.SUGGESTION) {
        this.ruleId = ruleId;
        this.alert = alert;
        this.allowExpressions = false;
        this.ignoreRestArgs = false;
    }
}

export enum ALERT_LEVEL {
    OFF = 0,
    WARN = 1,
    ERROR = 2,
    SUGGESTION = 3,
}

export interface ExtRuleSet {
    ruleSetName: string;
    packagePath: string;
    extRules: object;
}