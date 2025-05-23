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

const __dirname = 'foobar';

// 模板字符串
`${''}`;
`${'text'}`;
`${true}`;
`${false}`;
`${1}`;
`${1n}`;
`${[]}`;
`${/regex/}`;

// 操作符 + 和 +=
'' + '';
'' + 'text';
'' + true;
'' + false;
'' + 1;
'' + 1n;
'' + [];
'' + /regex/;
'' + (__dirname === 'foobar');
'' + {}.constructor();
'' + (() => { });
'' + (function () { });

let a = '';
a += '';
a += 'text';
a += true;
a += false;
a += 1;
a += 1n;
a += [];
a += /regex/;
a += __dirname === 'foobar';
a += {}.constructor();
a += () => { };
a += function () { };

// toString() 方法
''.toString();
'text'.toString();
true.toString();
false.toString();
(1).toString();
(1n).toString();
[].toString();
/regex/.toString();
(__dirname === 'foobar').toString();
({}.constructor()).toString();
(() => { }).toString();
(function () { }).toString();

// String() 函数
String('');
String('text');
String(true);
String(false);
String(1);
String(1n);
String([]);
String(/regex/);
String(__dirname === 'foobar');
String({}.constructor());
String(() => { });
String(function () { });

// 变量 toString() 和模板字符串
let value1 = '';
value1.toString();
let text1 = `${value1}`;

let value2 = 'text';
value2.toString();
let text2 = `${value2}`;

let value3 = true;
value3.toString();
let text3 = `${value3}`;

let value4 = false;
value4.toString();
let text4 = `${value4}`;

let value5 = 1;
value5.toString();
let text5 = `${value5}`;

let value6 = 1n;
value6.toString();
let text6 = `${value6}`;

let value8 = /regex/;
value8.toString();
let text8 = `${value8}`;

let value9 = __dirname === 'foobar';
value9.toString();
let text9 = `${value9}`;

let value10 = {}.constructor();
value10.toString();
let text10 = `${value10}`;

let value11 = () => { };
value11.toString();
let text11 = `${value11}`;

let value12 = function () { };
value12.toString();
let text12 = `${value12}`;

// 函数 toString()
function someFunction1() { }
someFunction1.toString();
let text13 = `${someFunction1}`;

someFunction1.toLocaleString();
let text14 = `${someFunction1}`;

// 未知对象方法
const unknownObject = {
  toString: () => '[object Object]',
  toLocaleString: () => '[object Object]',
  someOtherMethod: () => { }
};
unknownObject.someOtherMethod();

// 字面量对象 toString
const literalWithToString1 = {
  toString: () => 'Hello, world!',
};
'' + literalWithToString1;

// 打印函数
const printer1 = (inVar: string | number | boolean) => {
  inVar.toString();
};
printer1('');
printer1(1);
printer1(true);

const printerLocale1 = (inVar: string | number | boolean) => {
  inVar.toLocaleString();
};
printerLocale1('');
printerLocale1(1);
printerLocale1(true);

// 其他有效示例
let someObjectOrString1: { a: boolean } | string = Math.random() ? { a: true } : 'text';
if (typeof someObjectOrString1 === 'object') {
  someObjectOrString1 = JSON.stringify(someObjectOrString1); // 显式转换为字符串
}
someObjectOrString1.toLocaleString();

someObjectOrString1 = Math.random() ? { a: true } : 'text';
if (typeof someObjectOrString1 === 'object') {
  someObjectOrString1 = JSON.stringify(someObjectOrString1); // 显式转换为字符串
}
someObjectOrString1 + '';

let someObjectOrObject1: { a: boolean; b?: boolean } | string = Math.random() ? { a: true, b: true } : { a: true };
if (typeof someObjectOrObject1 === 'object') {
  someObjectOrObject1 = JSON.stringify(someObjectOrObject1); // 显式转换为字符串
}
someObjectOrObject1.toLocaleString();

someObjectOrObject1 = Math.random() ? { a: true, b: true } : { a: true };
if (typeof someObjectOrObject1 === 'object') {
  someObjectOrObject1 = JSON.stringify(someObjectOrObject1); // 显式转换为字符串
}
someObjectOrObject1 + '';

['foo', 'bar'].join('');
(['foo', 'bar']).join('');
function foo1(array: any[]) {
  return array.join();
}
class Foo1 {
  toString() {
    return '';
  }
}
[new Foo1()].join();
class Bar1 {
  join() { }
}
const bar1 = new Bar1();
bar1.join();
const array1 = ['foo', 'bar'];
array1.join('');
class Baz1 {
  foo = 'foo';
}
const arrayWithFoo1 = ['foo', 'bar'];
arrayWithFoo1.join('');
class Qux1 {
  foo = 'foo';
}
class Quux1 {
  bar = 'bar';
}
const arrayWithFooOrQuux1 = ['foo', 'bar'];
arrayWithFooOrQuux1.join('');
class Corge1 {
  foo = 'foo';
}
class Grault1 {
  bar = 'bar';
}
const arrayWithFooAndCorge1 = ['foo', 'bar'];
arrayWithFooAndCorge1.join('');
class Garply1 {
  foo = 'foo';
}
class Waldo1 {
  bar = 'bar';
}
const tupleWithFooAndWaldo1 = ['foo', 'bar'];
tupleWithFooAndWaldo1.join('');
class Fred1 {
  foo = 'foo';
}
const tupleWithFoo1 = ['foo'];
tupleWithFoo1.join();

String(['foo', 'bar']);
String([JSON.stringify({ foo: 'foo' }), 'bar']);
function fooString1(array: any) {
  return String(array);
}
class FooString1 {
  toString() {
    return '';
  }
}
String([new FooString1()]);
const arrayString1 = ['foo', 'bar'];
String(arrayString1);
class FooString2 {
  foo = 'foo';
}
const arrayStringWithFoo1 = ['foo', 'bar'];
String(arrayStringWithFoo1);
class BarString1 {
  foo = 'foo';
}
class BazString1 {
  bar = 'bar';
}
const arrayStringWithFooOrBar1 = ['foo', 'bar'];
String(arrayStringWithFooOrBar1);
class QuuxString1 {
  foo = 'foo';
}
class CorgeString1 {
  bar = 'bar';
}
const arrayStringWithFooAndCorge1 = ['foo', 'bar'];
String(arrayStringWithFooAndCorge1);
class GraultString1 {
  foo = 'foo';
}
class GarplyString1 {
  bar = 'bar';
}
const tupleStringWithGraultAndGarply1 = ['foo', 'bar'];
String(tupleStringWithGraultAndGarply1);
class WaldoString1 {
  foo = 'foo';
}
const tupleStringWithWaldo1 = ['foo'];
String(tupleStringWithWaldo1);

['foo', 'bar'].toString();
[{ foo: 'foo' }, 'bar']
  .map(item => typeof item === 'object' ? JSON.stringify(item) : item)
  .toString();
function fooToString1(array: { toString: () => any }) {
  return array.toString();
}
class FooToString1 {
  toString() {
    return '';
  }
}
[new FooToString1()].toString();
const arrayToString1 = ['foo', 'bar'];
arrayToString1.toString();
class FooToString2 {
  foo = 'foo';
}
const arrayToStringWithFoo1 = ['foo', 'bar'];
arrayToStringWithFoo1.toString();
class BarToString1 {
  foo = 'foo';
}
class BazToString1 {
  bar = 'bar';
}
const arrayToStringWithFooOrBar1 = ['foo', 'bar'];
arrayToStringWithFooOrBar1.toString();
class QuuxToString1 {
  foo = 'foo';
}
class CorgeToString1 {
  bar = 'bar';
}
const arrayToStringWithFooAndCorge1 = ['foo', 'bar'];
arrayToStringWithFooAndCorge1.toString();
class GraultToString1 {
  foo = 'foo';
}
class GarplyToString1 {
  bar = 'bar';
}
const tupleToStringWithGraultAndGarply1 = ['foo', 'bar'];
tupleToStringWithGraultAndGarply1.toString();
class WaldoToString1 {
  foo = 'foo';
}
const tupleToStringWithWaldo1 = ['foo'];
tupleToStringWithWaldo1.toString();