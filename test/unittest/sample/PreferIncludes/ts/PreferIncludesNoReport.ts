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

// 正例1：简单使用 indexOf 但不进行-1比较
function fOne(a: string): void {
  a.indexOf(b);
}

// 正例2：indexOf的结果用于其他运算
function fTwo(a: string): void {
  a.indexOf(b) + 0;
}

// 正例3：在联合类型上使用 indexOf
function fThree(a: string | { value: string }): void {
  a.indexOf(b) !== -1;
}

// 正例4：自定义类型无includes方法时
type UserDefinedOne = {
  indexOf(x: any): number; // don't have 'includes'
};
function fFour(a: UserDefinedOne): void {
  a.indexOf(b) !== -1;
}

// 正例5：自定义类型的includes方法参数不同时
type UserDefinedTwo = {
  indexOf(x: any, fromIndex?: number): number;
  includes(x: any): boolean; // different parameters
};
function fFive(a: UserDefinedTwo): void {
  a.indexOf(b) !== -1;
}

// 正例6：自定义类型的includes方法参数不同时
type UserDefinedThree = {
  indexOf(x: any, fromIndex?: number): number;
  includes(x: any, fromIndex: number): boolean; // different parameters
};
function fSix(a: UserDefinedThree): void {
  a.indexOf(b) !== -1;
}

// 正例7：自定义类型的includes是属性而非方法
type UserDefinedFour = {
  indexOf(x: any, fromIndex?: number): number;
  includes: boolean; // different type
};
function fSeven(a: UserDefinedFour): void {
  a.indexOf(b) !== -1;
}

// 正例8：带i标志的正则表达式
function fEight(a: string): void {
  /bar/i.test(a);
}

// 正例9：复杂的正则表达式
function fNine(a: string): void {
  /ba[rz]/.test(a);
}

// 正例10：有选择的正则表达式
function fTen(a: string): void {
  /foo|bar/.test(a);
}

// 正例11：test方法没有参数
function fEleven(a: string): void {
  /bar/.test();
}

// 正例12：非正则表达式的test方法
function fTwelve(a: string): void {
  something.test(a);
}

// 正例13：RegExp实例
const patternOne = new RegExp('bar');
function fThirteen(a) {
  return patternOne.test(a);
}
