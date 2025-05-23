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

// 反例1：正向检查 - 应使用includes
function fInvalidOne(a: string): void {
  a.indexOf(b) !== -1;
}

// 反例2：正向检查 - 使用!=
function fInvalidTwo(a: string): void {
  a.indexOf(b) != -1;
}

// 反例3：正向检查 - 使用>
function fInvalidThree(a: string): void {
  a.indexOf(b) > -1;
}

// 反例4：正向检查 - 使用>=
function fInvalidFour(a: string): void {
  a.indexOf(b) >= 0;
}

// 反例5：负向检查 - 使用===
function fInvalidFive(a: string): void {
  a.indexOf(b) === -1;
}

// 反例6：负向检查 - 使用==
function fInvalidSix(a: string): void {
  a.indexOf(b) == -1;
}

// 反例7：负向检查 - 使用<=
function fInvalidSeven(a: string): void {
  a.indexOf(b) <= -1;
}

// 反例8：负向检查 - 使用<
function fInvalidEight(a: string): void {
  a.indexOf(b) < 0;
}

// 反例9：可选链的负向检查
function fInvalidNine(a?: string): void {
  a?.indexOf(b) === -1;
}

// 反例10：可选链的正向检查
function fInvalidTen(a?: string): void {
  a?.indexOf(b) !== -1;
}

// 反例11：简单的正则表达式测试
function fInvalidEleven(a: string): void {
  /bar/.test(a);
}

// 反例12：序列表达式
function fInvalidTwelve(a: string): void {
  /bar/.test((1 + 1, a));
}

// 反例14：RegExp实例作为变量
const patternTwo = new RegExp('bar');
function fInvalidFourteen(a: string): void {
  patternTwo.test(a);
}

// 反例15：正则表达式测试字符串连接
const patternThree = /bar/;
function fInvalidFifteen(a: string, b: string): void {
  patternThree.test(a + b);
}

// 反例16：在数组上使用indexOf
function fInvalidSixteen(a: any[]): void {
  a.indexOf(b) !== -1;
}

// 反例17：在只读数组上使用indexOf
function fInvalidSeventeen(a: ReadonlyArray<any>): void {
  a.indexOf(b) !== -1;
}

// 反例18：在Int8Array上使用indexOf
function fInvalidEighteen(a: Int8Array): void {
  a.indexOf(b) !== -1;
}

// 反例19：在Int16Array上使用indexOf
function fInvalidNineteen(a: Int16Array): void {
  a.indexOf(b) !== -1;
}

// 反例20：在Int32Array上使用indexOf
function fInvalidTwenty(a: Int32Array): void {
  a.indexOf(b) !== -1;
}

// 反例21：在Uint8Array上使用indexOf
function fInvalidTwentyOne(a: Uint8Array): void {
  a.indexOf(b) !== -1;
}

// 反例22：在Uint16Array上使用indexOf
function fInvalidTwentyTwo(a: Uint16Array): void {
  a.indexOf(b) !== -1;
}

// 反例23：在Uint32Array上使用indexOf
function fInvalidTwentyThree(a: Uint32Array): void {
  a.indexOf(b) !== -1;
}

// 反例24：在Float32Array上使用indexOf
function fInvalidTwentyFour(a: Float32Array): void {
  a.indexOf(b) !== -1;
}

// 反例25：在Float64Array上使用indexOf
function fInvalidTwentyFive(a: Float64Array): void {
  a.indexOf(b) !== -1;
}

// 反例26：在泛型数组上使用indexOf
function fInvalidTwentySix<T>(a: T[] | ReadonlyArray<T>): void {
  a.indexOf(b) !== -1;
}

// 反例27：复杂泛型约束
function fInvalidTwentySeven<
T,
U extends
  | T[]
  | ReadonlyArray<T>
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array,
  >(a: U): void {
  a.indexOf(b) !== -1;
}

// 正例28：自定义类型同时具有indexOf和includes
type UserDefinedFive = {
  indexOf(x: any): number;
  includes(x: any): boolean;
};
function fInvalidTwentyEight(a: UserDefinedFive): void {
  a.indexOf(b) !== -1;
}

// 反例29：在只读包装类型上使用indexOf
function fInvalidTwentyNine(a: Readonly<any[]>): void {
  a.indexOf(b) !== -1;
}
