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

// 非异步非Promise的箭头函数
const nonAsyncNonPromiseArrowFunction = (n: number) => n;

// 非异步非Promise的函数声明
function nonAsyncNonPromiseFunctionDeclaration(n: number) {
  return n;
}

// 异步Promise函数表达式A
const asyncPromiseFunctionExpressionA = async function (p: Promise<void>) {
  return p;
};

// 异步Promise函数表达式B
const asyncPromiseFunctionExpressionB = async function () {
  return new Promise<void>();
};

// 测试类
class Test {
  public nonAsyncNonPromiseArrowFunction = (n: number) => n;
  public nonAsyncNonPromiseMethod() {
    return 0;
  }

  public async asyncPromiseMethodA(p: Promise<void>) {
    return p;
  }

  public async asyncPromiseMethodB() {
    return new Promise<void>();
  }
}

// 无效的异步修饰符类
class InvalidAsyncModifiers {
  public constructor() {
    return new Promise<void>();
  }
  public get asyncGetter() {
    return new Promise<void>();
  }
  public set asyncGetter(p: Promise<void>) {
    return p;
  }
  public get asyncGetterFunc() {
    return async () => new Promise<void>();
  }
  public set asyncGetterFunc(p: () => Promise<void>) {
    return p;
  }
}

// 无效的异步修饰符对象
const invalidAsyncModifiers = {
  get asyncGetter() {
    return new Promise<void>();
  },
  set asyncGetter(p: Promise<void>) {
    return p;
  },
  get asyncGetterFunc() {
    return async () => new Promise<void>();
  },
  set asyncGetterFunc(p: () => Promise<void>) {
    return p;
  },
};

// 导出函数
export function valid(n: number) {
  return n;
}

// 默认导出函数
export default function invalid(n: number) {
  return n;
}

// 简单类
class Foo {
  constructor() {}

  async catch<T>(arg: Promise<T>) {
    return arg;
  }
}

// 返回 any 类型
function returnsAny(): any {
  return 0;
}

// 返回 unknown 类型
function returnsUnknown(): unknown {
  return 0;
}

// 返回联合类型
interface ReadableStream {}
interface Options {
  stream: ReadableStream;
}

type Return = ReadableStream | Promise<void>;
const foo = (options: Options): Return => {
  return options.stream ? asStream(options) : asPromise(options);
};

// 抽象类
abstract class Test2 {
  abstract test1(): Promise<number>;

  abstract test2(): Promise<number> {
    return Promise.resolve(1);
  }
}

// 异步函数返回联合类型
async function asyncFunctionReturningUnion(p: boolean) {
  return p ? Promise.resolve(5) : 5;
}

// 函数重载
function overloadingThatCanReturnPromise(): Promise<number>;
function overloadingThatCanReturnPromise(a: boolean): number;

function a(): Promise<void>;
function a(x: boolean): void;
