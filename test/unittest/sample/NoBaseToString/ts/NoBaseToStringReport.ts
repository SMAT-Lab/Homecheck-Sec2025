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

// 模板字符串
`${{}}`;

// 操作符 + 和 +=
'' + {};
'' += {};

// toString() 方法
({}).toString();
({}).toLocaleString();

// String() 函数
String({});

// 变量 toString() 和模板字符串
let value13 = {};
value13.toString();
let text15 = `${value13}`;

// 其他无效示例
let someObjectOrString2 = Math.random() ? { a: true } : 'text';
someObjectOrString2.toString();

someObjectOrString2 = Math.random() ? { a: true } : 'text';
someObjectOrString2 + '';

let someObjectOrObject2 = Math.random() ? { a: true, b: true } : { a: true };
someObjectOrObject2.toString();

someObjectOrObject2 = Math.random() ? { a: true, b: true } : { a: true };
someObjectOrObject2 + '';

[{}, {}].join('');
const array2 = [{}, {}];
array2.join('');
class A1 {
  a = 'a';
}
[new A1(), 'str'].join('');
class Foo2 {
  foo = 'foo';
}
declare const array3: (string | Foo2)[];
array3.join('');
class Foo3 {
  foo = 'foo';
}
declare const array4: (string & Foo3) | (string | Foo3)[];
array4.join('');
class Foo4 {
  foo = 'foo';
}
class Bar2 {
  bar = 'bar';
}
declare const array5: Foo4[] & Bar2[];
array5.join('');
class Foo5 {
  foo = 'foo';
}
declare const array6: string[] | Foo5[];
array6.join('');
class Foo6 {
  foo = 'foo';
}
declare const tuple1: [string, Foo6];
tuple1.join('');
class Foo7 {
  foo = 'foo';
}
declare const tuple2: [Foo7, Foo7];
tuple2.join('');
class Foo8 {
  foo = 'foo';
}
declare const tuple3: [Foo8 | string, string];
tuple3.join('');
class Foo9 {
  foo = 'foo';
}
declare const tuple4: [string, string] | [Foo9, Foo9];
tuple4.join('');
class Foo10 {
  foo = 'foo';
}
declare const tuple5: [Foo10, string] & [Foo10, Foo10];
tuple5.join('');
const array7 = ['string', { foo: 'bar' }];
array7.join('');
type Bar3 = Record<string, string>;
function foo2(array) {
  return array.join();
}
foo2([{ foo: 'foo' }]).join();
foo2([{ foo: 'foo' }, 'bar']).join();

interface MyType {
  name: string;
}
// Passing an object or class instance to string concatenation:
const obj: MyType = {
  name: 'object'
};
export const v1 = '' + obj;

class MyClass {}
const value = new MyClass();
export const v2 = value + '';

// Interpolation and manual .toString() calls too:
export const v3 = `Value: ${value}`;
export const v4 = obj.toString();