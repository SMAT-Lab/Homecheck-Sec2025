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

function takeVoid_1(thing: void,sbc:string) {}
const arrowGeneric = <T extends void>(arg: T) => {};
const arrowGeneric2 = <T extends void = void>(arg: T) => {};
function functionGeneric<T extends void>(arg: T) {}
functionGeneric<void>(undefined);
function functionGeneric2<T extends void = void>(arg: T) {}
declare function functionDeclaration<T extends void>(arg: T): void;
declare function functionDeclaration2<T extends void = void>(arg: T): void;
declare function voidArray(args: void[]): void[];
let value = undefined as void;
let value2 = <void>undefined;
function takesThings(...things: void[]): void {};
type KeyofVoid = keyof void;
type UnionType2 = string | number | void;
type UnionType3 = string | ((number & any) | (string | void));
declare function test(): number | void;
declare function test_1<T extends number | void>(): T;
type IntersectionType = string & number & void;
type MappedType<T> = {
  [K in keyof T]: void;
};
interface Interface {
  lambda: () => void;
  voidProp: void;
}
type ConditionalType<T> = {
  [K in keyof T]: T[K] extends string ? void : string;
};
type ManyVoid = readonly void[];
class ClassName {
  private readonly propName: void;
}
function foo_1(arr: readonly void[]) {}
type invalidVoidUnion = void | Map<string, number>;
let letVoid: void;
type VoidType = void;
class OtherClassName {
  private propName: VoidType;
}