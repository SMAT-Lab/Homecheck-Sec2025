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

function array1(arg: readonly string[]) {}
function array2(arg: readonly (readonly string[])[]) {}
function array3(arg: readonly [string, number]) {}
function array4(arg: readonly [readonly string[], number]) {}
// the above examples work the same if you use ReadonlyArray<T> instead

function object1(arg: { readonly prop: string }) {}
function object2(arg: { readonly prop: string; readonly prop2: string }) {}
function object3(arg: { readonly prop: { readonly prop2: string } }) {}
// the above examples work the same if you use Readonly<T> instead

interface CustomArrayType extends ReadonlyArray<string> {
  readonly prop: string;
}
function custom1(arg: Readonly<CustomArrayType>) {}
// interfaces that extend the array types are not considered arrays, and thus must be made readonly.

interface CustomFunction {
  (): void;
  readonly prop: string;
}
function custom2(arg: CustomFunction) {}

function union(arg: readonly string[] | ReadonlyArray<number>) {}

function primitive1(arg: string) {}
function primitive2(arg: number) {}
function primitive3(arg: boolean) {}
function primitive4(arg: unknown) {}
function primitive5(arg: null) {}
function primitive6(arg: undefined) {}
function primitive7(arg: any) {}
function primitive8(arg: never) {}
function primitive9(arg: string | number | undefined) {}

function fnSig(arg: () => void) {}

enum Foo {
  a,
  b,
}
function enumArg(arg: Foo) {}

function symb1(arg: symbol) {}
const customSymbol = Symbol('a');
function symb2(arg: typeof customSymbol) {}

// function types
interface Foo1 {
  (arg: readonly string[]): void;
}
interface Foo2 {
  new (arg: readonly string[]): void;
}
const x = { foo(arg: readonly string[]): void {} };
function foo(arg: readonly string[]);
type Foo5 = (arg: readonly string[]) => void;
interface Foo3 {
  foo(arg: readonly string[]): void;
}