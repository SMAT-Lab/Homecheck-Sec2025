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

// nullable numbers are considered unsafe by default
let num: number | undefined = 0;
if (num) {
  console.log('num is defined');
}

// nullable strings are considered unsafe by default
let str: string | null = null;
if (!str) {
  console.log('str is empty');
}

// nullable booleans are considered unsafe by default
function foo(bool?: boolean) {
  if (bool) {
    bar();
  }
}

// `any`, unconstrained generics and unions of more than one primitive type are disallowed
const foo = <T>(arg: T) => (arg ? 1 : 0);

// always-truthy and always-falsy types are disallowed
let obj = {};
while (obj) {
  obj = getObj();
}

//1.非布尔值直接用作条件
if (1 + 1) {}
while ("a" + "b") {}
if ({}) {}

//2.可空类型未经处理
declare const x: string | null;
if (x) {} // 错误,应该先检查null

declare const x: number | null;
if (x) {} // 错误,应该先检查null

//3.对象类型直接用作条件
if ([]) {}
if ({}) {}
declare const x: symbol;
if (x) {}

//4.any类型未经显式转换
declare const x: any;
if (x) {} // 错误,应该使用Boolean(x)

//5.字符串直接用作条件(当allowString=false)
if ("") {}
while ("x") {}

//6.数字直接用作条件(当allowNumber=false)
if (0) {}
while (1n) {}