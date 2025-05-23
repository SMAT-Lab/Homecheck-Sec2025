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

new Array();
new Array(x, y);
new Array(0, 1, 2);
const array1 = Array?.();


const array2 = (Array)(
  /* foo */a,
  b = c() // bar
);
const array = Array(...args);
a = new (Array);
a = new (Array) && (foo);

// Semicolon required before array literal to compensate for ASI
foo
Array();

foo()
Array(bar, baz);

new foo
Array();

let number: a = 0;
(a++)
Array();

++a
Array();

const foo = function() {}
Array();

const foo = class {}
Array("a", "b", "c");

foo = this.return
Array();

var yield = bar.yield
Array();

var foo = { bar: baz }
Array();

Array();

{}
Array();

function foo() {}
Array()

class Foo {}
Array()

foo: Array(); //0 解析出来text是空的   //

foo();Array();

{ Array(); }

if (a) Array();

if (a); else Array();

while (a) Array();

do Array();
while (a);

for (let i = 0; i < 10; i++) Array();

for (const prop in obj) Array();

for (const element of iterable) Array();

with (obj) Array();//0 解析出来text是空的   //
// languageOptions: { sourceType: "script" }
// No semicolon required before array literal because ASI still occurs
const foo = () => {}
Array();

a++
Array();

function foo() {
  return
  Array();//0 解析出来text是空的  //
};

function * foo() {
  yield
  Array();
};

do {}
while (a)
Array();

debugger
Array();

foo: break foo
Array();

foo: while (true) continue foo
Array();

const foo = bar
export { foo }
Array();
//languageOptions: { sourceType: "module" }

export { foo } from 'bar'
Array();
//languageOptions: { sourceType: "module" }

export * as foo from 'bar'
Array();
//languageOptions: { sourceType: "module" }

import foo from 'bar'
Array();
//languageOptions: { sourceType: "module" }

var yield = 5;
yield: while (foo) {
  if (bar)
    break yield
  new Array();//0 解析出来text是空的  //
}