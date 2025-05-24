/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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
 
declare const ANY_UPPER_CASE: any;
declare const ANY_UPPER_CASE_NULL: any | null;
declare const ANY_UPPER_CASE_UNDE: any | null | undefined;

declare const string_camelCase: string;
declare const string_camelCaseNull: string | null;
declare const string_camelCaseUnder: string | null | undefined;
declare const string_camelCaseA: 'a' | null | undefined;
declare const string_camelCaseString: string | 'a' | null | undefined;

declare const number_camelCase: number;
declare const number_camelCaseNumber: number | null;
declare const number_camelCaseNull: number | null | undefined;
declare const number_camelCaseUnder: 1 | null | undefined;
declare const number_camelCase2: number | 2 | null | undefined;

declare const boolean_camelCase: boolean;
declare const boolean_camelCaseBoolean: boolean | null;
declare const boolean_camelCaseNull: boolean | null | undefined;
declare const boolean_camelCaseUnder: true | null | undefined;
declare const boolean_camelCaseFalse: false | null | undefined;
declare const boolean_camelCaseTrue: true | false | null | undefined;