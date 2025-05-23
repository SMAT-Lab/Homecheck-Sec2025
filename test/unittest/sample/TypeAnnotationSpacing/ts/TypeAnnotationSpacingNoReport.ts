/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
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

// 正确的类型注解空格示例
interface Resolve<T> {
  resolver: (() => Promise<T>) | Promise<T>;
}

// 变量声明
const fooTas1 = {} as FooClass1;
const fooTas2: string = '';

// 函数声明
function fooFunc1(): void { }
function fooFunc2(_param: string): void { }

// 类声明
class FooClass1 {
  name: string = '';
}

class FooClass2 {
  constructor(_message: string) {
    // 构造函数实现
  }
}

class FooClass3 {
  greet(): string { return "hello"; }
}

class FooClass4 {
  greet(name: string): string { return name; }
}

// 接口声明
interface FooInterface1 {
  name: string;
}

interface FooInterface2 {
  greet(): string;
}

interface FooInterface3 {
  greet(name: string): string;
}

interface FooInterface4 {
  thing: { [key in string]: number };
}

// 类型声明
type FooType1 = {
  name: string;
}

type FooType2 = {
  greet(): string;
}

type FooType3 = {
  greet(name: string): string;
}

type FooType4 = (name: string) => string;

type FooType5 = {
  greet: (name: string) => string;
}