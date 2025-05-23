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

// 基础语法的空格错误
// 测试用例1 - 变量声明中的类型注解
let foo1 : string;
let foo2 : number;

// 测试用例2 - 函数返回类型
function greet1() : string {
  return "hello";
}

function greet2() : number {
  return 42;
}

// 测试用例3 - 函数参数
function sayHello1(_name : string) {}
function sayHello2(_age : number) {}

// 测试用例4 - 类成员
class Person1 {
  name : string;
  age : number;
}

// 测试用例5 - 构造函数参数
class Person2 {
  constructor(_message : string){

  };
}

// 测试用例6 - 接口成员
interface Animal1 {
  name : string;
  age : number;
}

// 测试用例7 - 类型别名
type Pet1 = {
  name : string;
  age : number;
}

// 测试用例8 - 箭头函数类型
type Handler1 = (name : string) => void;
type Handler2 = (value : number)=> string;

// 测试用例9 - 可选参数
interface Config1 {
  name? : string;
  value? : number;
}

// 测试用例10 - 映射类型
type Partial1<T> = {
  [P in keyof T] ?: T[P]
}