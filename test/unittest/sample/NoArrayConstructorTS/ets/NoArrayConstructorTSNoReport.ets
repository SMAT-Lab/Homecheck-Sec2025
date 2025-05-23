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

new Array(x);

Array(x);

new Array(9);

Array(9);

new foo.Array();

foo.Array();

new Array.foo();

Array.foo();
// TypeScript
new Array<Foo>(1, 2, 3);

new Array<Foo>();

Array<Foo>(1, 2, 3);

Array<Foo>();
// optional chain
Array?.(x);

Array?.(9);

foo?.Array();

Array?.foo();

foo.Array?.();

Array.foo?.();

Array?.<Foo>(1, 2, 3);

Array?.<Foo>();

Array?.(0, 1, 2);

Array?.(x, y);

const length = 500;
Array(length);

export const newArr: number[] = new Array(['1'].length);

export const arr = ['0', '1', '2'];

export const createArray = (array: string) => new Array(array.length);