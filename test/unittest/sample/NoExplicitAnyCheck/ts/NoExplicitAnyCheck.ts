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

export const age1: any = 17;
export const age2: any = [age1];
export const age3: any = [age1];

export function greet1(): any {
    return 'greet';
}

export function greet4(): any[][] {
    return [['greet']];
}

export function greet5(param: readonly any[]): any {
    return param[age1];
}

export function greet6(param: readonly any[]): any[] {
    return [...param];
}