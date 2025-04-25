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

import { ArkFile } from "arkanalyzer";
import { Rule } from "../model/Rule";
import { MatcherCallback } from "../matcher/Matchers";
import { IssueReport } from "../model/Defects";

export interface BaseMetaData {
    severity: number,
    ruleDocPath: string,
    description: string,
    [extendField: string]: any
}

export interface BaseChecker {
    metaData: object;
    // 在CheckerFactory构建checker实例时，已对rule进行赋值
    rule: Rule;
    registerMatchers(): MatcherCallback[];
    check(target: any): void;
    codeFix?(arkFile: ArkFile, fixKey: string): boolean;
    // 用于保存当前checker发现的告警信息与fix相关信息
    issues: IssueReport[];
}
