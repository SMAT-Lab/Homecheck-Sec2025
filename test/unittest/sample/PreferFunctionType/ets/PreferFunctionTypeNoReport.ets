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
//反例
/** output:type Foo = () => string;*/
interface Fooz {
      (): string;
}
/**output: null*/
export default interface Foox {
      /** comment */
      // eslint-disable-next-line @typescript-eslint/prefer-function-type
      (): string;
}
/** output: // comment  type Foo = () => string;*/
interface Fooc {
      // comment
      (): string;
}
/** //comment export type Foo = () => string;*/
export interface Foov {
      /** comment */
      // eslint-disable-next-line @typescript-eslint/prefer-function-type
      (): string;
}
/** output: // comment export type Foo = () => string;*/
export interface Foob {
      // comment
      (): string;
}
/** output: type Foo = () => string;*/
type Foon = {
      // eslint-disable-next-line @typescript-eslint/prefer-function-type
      (): string;
};
/**output: type Foo = () => void;*/
interface Foo extends Function {
      (): void;
}
/** output:
 type Foo<T> = (bar: T) => string;*/
interface Foof<T> {
      (bar: T): string;
}
/** output:
 type Foo<T> = (this: T) => void;*/
interface Foog<T> {
      (this: T): void;
}
/**function foo(bar: (s: string) => number): number {
 return bar('hello');
 }*/
// eslint-disable-next-line @typescript-eslint/prefer-function-type
function foos(bar: { (s: string): number }): number {
      return bar('hello');
}
/**function foo(bar: ((s: string) => number) | undefined): number {
 return bar('hello');
 }*/
function food(bar: { (s: string): number } | undefined): number {
      return bar('hello');
}
/** output:function foo(bar: // comment ((s: string) => number) | undefined): number {return bar('hello');}*/
function fooa(bar: { /* comment */ (s: string): number } | undefined): number {
      return bar('hello');
}
/** output: type Foo = () => string;*/
type Foog = {
      (): string;
};
/** output: `
 function foo(bar: (s: string) => number): number {
 return bar('hello');
 }*/
function fooh(bar: { (s: string): number }): number {
      return bar('hello');
}
/**output: `
 function foo(bar: ((s: string) => number) | undefined): number {
 return bar('hello');
 }*/
function fooj(bar: { (s: string): number } | undefined): number {
      return bar('hello');
}
/** output: `
 type Foo = () => void;
 `,
 }*/
interface Fook extends Function {
      // eslint-disable-next-line @typescript-eslint/prefer-function-type
      (): void;
}
/** output: `
 type Foo<T> = (bar: T) => string;*/
interface Fool<T> {
      // eslint-disable-next-line @typescript-eslint/prefer-function-type
      (bar: T): string;
}
/** output: `
 type Foo<T> = (this: T) => void;*/
interface Fooqq<T> {
      (this: T): void;
}
/** output: `
 type Foo<T> = (this: string) => T;*/
type Fooqw<T> = { (this: string): T };

/**没有output*/
interface Fooqr {
      (arg: this): void;
}
/**没有output*/
interface Fooqt {
      (arg: number): this | undefined;
}
/** output: `
 // isn't actually valid ts but want to not give message saying it refers to Foo.
 type Foo = () => {
 a: {
 nested: this;
 };
 between: this;
 b: {
 nested: string;
 };
 };*/
interface Fooqy {
      (): {
            a: {
                  nested: this;
            };
            between: this;
            b: {
                  nested: string;
            };
      };
}
/**
 type X = {} | (() => void)
 * */
type Xq= {} | { (): void; }
/**
 * type X = {} & (() => void);*/
// eslint-disable-next-line @typescript-eslint/prefer-function-type
type Xr = {} & { (): void; };
// 正例
interface Foo1 {
      (): void;
      bar: number;
}
type Foo2 = {
      (): void;
      bar: number;
};
function foo3(bar: { (): string; baz: number }): string {
      return bar();
}
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
export type ReturnsSelf = (arg: string) => ReturnsSelf;
export interface Foo {
      bar: string;
}
@Entry
@Component
struct PreferFunctionTypeNoReport {
      build() {
      }
}
