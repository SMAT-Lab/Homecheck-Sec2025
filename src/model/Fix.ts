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

export type Range = [number, number];

export class FixInfo {
    fixed?: boolean = false;
}

// eslint修复信息
export class RuleFix extends FixInfo {
    /**
     * 被修复字符串的起始位置
     */
    range: Range;
    /**
     * 要替换的文本
     */
    text: string;
}

// homecheck的修复信息
export class FunctionFix extends FixInfo {
    /**
     * 修复方法,入参为ArkFile和fixkey
     */
    fix: Function;
}

// AI修复的信息
export class AIFix extends FixInfo {
    /**
     * 提供给大模型的修复语义
     */
    text: string[];
}

export enum FixMode {
    AST,
    ARKFILE,
    AI,
    UNKNOWN
}