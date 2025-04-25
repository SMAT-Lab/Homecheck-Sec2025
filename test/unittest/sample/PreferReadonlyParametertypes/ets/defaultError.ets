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

function array1(arg: string[]) {} // array is not readonly
function array2(arg: readonly string[][]) {} // array element is not readonly
function array3(arg: [string, number]) {} // tuple is not readonly
function array4(arg: readonly [string[], number]) {} // tuple element is not readonly
// the above examples work the same if you use ReadonlyArray<T> instead

function object1(arg: { prop: string }) {} // property is not readonly
 function object2(arg: { readonly prop: string; prop2: string[] }) {} // not all properties are readonly
function object3(arg: { readonly prop: { prop2: string } }) {} // nested property is not readonly
// the above examples work the same if you use Readonly<T> instead

interface CustomArrayType extends ReadonlyArray<string> {
  prop: string; // note: this property is mutable
}
function custom1(arg: CustomArrayType) {}

interface CustomFunction {
  (): void;
  prop: string; // note: this property is mutable
}
function custom2(arg: CustomFunction) {}

 function union(arg: string[] | ReadonlyArray<readonly  number[]>|CustomFunction|Array<number> ) {} // not all types are readonly

// rule also checks function types
interface Foo1 {
  (arg: string[]): void;
}
interface Foo2 {
  new (arg: string[]): void;
}
const x = { foo1(arg: string[]): void {} };
function foo2(arg: string[]);
type Foo3 = (arg: string[]) => void;
interface Foo {
  foo4(arg: string[]): void;
}