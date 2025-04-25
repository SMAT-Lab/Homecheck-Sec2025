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
interface Foo1 {
  (): void;
  bar: number;
}
type Foo2 = {
  (): void;
  bar: number;
};
interface Foo3 {
  bar: string;
}
interface Bar3 extends Foo3 {
  (): void;
}
interface Foo4 {
  bar: string;
}

interface Bar4 extends Function, Foo4 {
  (): void;
}
export function foo(example: () => number): number {
  return example();
}
// returns the function itself, not the `this` argument.
export type ReturnsSelf = (arg: string) => ReturnsSelf;
export interface Foo {
  bar: string;
}
@Entry
@Component
struct PreferFunctionTypeReport  {
  build() {
  }
}
