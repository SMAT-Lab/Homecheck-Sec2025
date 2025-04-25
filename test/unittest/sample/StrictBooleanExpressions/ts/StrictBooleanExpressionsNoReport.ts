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

// Using logical operator short-circuiting is allowed
const Component = () => {
  const entry = map.get('foo') || {};
  return entry && <p>Name: {entry.name}</p>;
};

// nullable values should be checked explicitly against null or undefined
let num: number | undefined = 0;
if (num != null) {
  console.log('num is defined');
}

let str: string | null = null;
if (str != null && !str) {
  console.log('str is empty');
}

function foo(bool?: boolean) {
  if (bool ?? false) {
    bar();
  }
}

// `any` types should be cast to boolean explicitly
const foo = (arg: any) => (Boolean(arg) ? 1 : 0);

//1.布尔值的直接使用
true ? 'a' : 'b';
if (false) {}
while (true) {}
for (; false; ) {}
!true;

//2.布尔值的逻辑运算
false || 123;
true && 'foo';
!(false || true);
true && false ? true : false;

//3.声明的布尔变量
declare const x: boolean;
if (x) {}
(x: boolean) => !x;

//4.允许的字符串判断(当allowString=true):
declare const x: string;
if (x) {}
(x: string) => !x;

//5.允许的数字判断(当allowNumber=true):
declare const x: number;
if (x) {}
(x: bigint) => !x;

//6.允许的可空对象判断(当allowNullableObject=true)
declare const x: null | object;
if (x) {}