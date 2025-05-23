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

// 返回 any 类型 (当 allowAny: false 时)
function returnsAny(): any {
  return 0;
}

// 返回 unknown 类型 (当 allowAny: false 时)
function returnsUnknown(): unknown {
  return 0;
}

// 非异步 Promise 函数表达式 A
const nonAsyncPromiseFunctionExpressionA = function (p: Promise<void>) {
  return p;
};

// 非异步 Promise 函数表达式 B
const nonAsyncPromiseFunctionExpressionB = function () {
  return new Promise<void>();
};

// 非异步 Promise 函数声明 A
function nonAsyncPromiseFunctionDeclarationA(p: Promise<void>) {
  return p;
}

// 非异步 Promise 函数声明 B
function nonAsyncPromiseFunctionDeclarationB() {
  return new Promise<void>();
}

// 非异步 Promise 箭头函数 A
const nonAsyncPromiseArrowFunctionA = (p: Promise<void>) => p;

// 非异步 Promise 箭头函数 B
const nonAsyncPromiseArrowFunctionB = () => new Promise<void>();

// 对象中的非异步 Promise 方法
const functions = {
  nonAsyncPromiseMethod() {
    return Promise.resolve(1);
  },
};

// 类中的非异步 Promise 方法
class Test {
  public nonAsyncPromiseMethodA(p: Promise<void>) {
    return p;
  }

  public static nonAsyncPromiseMethodB() {
    return new Promise<void>();
  }
}

// 自定义 Promise 类型
class PromiseType {}

const returnAllowedType = () => new PromiseType();

// 扩展 Promise 的接口
interface SPromise<T> extends Promise<T> {}
function foo(): Promise<string> | SPromise<boolean> {
  return Math.random() > 0.5
    ? Promise.resolve('value')
    : Promise.resolve(false);
}

// 带装饰器的类方法
class Test2 {
  @decorator
  public test() {
    return Promise.resolve(123);
  }
}

// 带特殊名称的类方法
class Test3 {
  @decorator(async () => {})
  static protected[(1)]() {
    return Promise.resolve(1);
  }
  public'bar'() {
    return Promise.resolve(2);
  }
  private['baz']() {
    return Promise.resolve(3);
  }
}

// 带关键字名称的类方法
class Foo {
  catch() {
    return Promise.resolve(1);
  }

  public default() {
    return Promise.resolve(2);
  }

  @decorator
  private case<T>() {
    return Promise.resolve(3);
  }
}

// 对象中的关键字方法名
const foo2 = {
  catch() {
    return Promise.resolve(1);
  },
};

// 无显式返回类型的联合类型函数
function promiseInUnionWithoutExplicitReturnType(p: boolean) {
  return p ? Promise.resolve(5) : 5;
}

// 全是 Promise 的函数重载
function overloadingThatCanReturnPromise(): Promise<number>;
function overloadingThatCanReturnPromise(a: boolean): Promise<string>;
function overloadingThatCanReturnPromise(
  a?: boolean,
): Promise<number | string> {
  return Promise.resolve(5);
}

// 包含 any 的函数重载 (当 allowAny: false 时)
function overloadingThatIncludeAny(): number;
function overloadingThatIncludeAny(a: boolean): any;
function overloadingThatIncludeAny(a?: boolean): any | number {
  return Promise.resolve(5);
}

// 包含 unknown 的函数重载 (当 allowAny: false 时)
function overloadingThatIncludeUnknown(): number;
function overloadingThatIncludeUnknown(a: boolean): unknown;
function overloadingThatIncludeUnknown(a?: boolean): unknown | number {
  return Promise.resolve(5);
}
