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

//使用默认 "double" 选项的此规则的错误代码示例：
/*eslint quotes: ["error", "double"]*/
var single = 'single';
var unescaped = 'a string containing "double" quotes';
var backtick = `back\ntick`; // you can use \n in single or double quoted strings

//使用 "single" 选项的此规则的错误代码示例：
/*eslint quotes: ["error", "single"]*/
var double = "double";
var unescaped = "a string containing 'single' quotes";

//使用 "backtick" 选项的此规则的错误代码示例：
/*eslint quotes: ["error", "backtick"]*/
var single = 'single';
var double = "double";
var unescaped = 'a string containing `backticks`';

// 1. 属性名和方法名
class TestClass {
  // 带空格的字符串作为方法名
  "method with spaces"() {
    return "testing with double quotes";
  }

  // 使用单引号的计算属性名
  ['computed property']() {
    return 'testing with single quotes';
  }

  // 使用反引号的计算属性名
  [`backtick property`]() {
    return `testing with backticks`;
  }

  test(index:number) {
    switch (index){
      case 2:{
        for(let i= 1;i<10000;i++){
          const simpleTemplateStr = 'This is a template string';
        }
      }
        break;
      default :
        break;
    }

  }
}

// 3. 枚举成员
enum Colors {
  "RED" = "red",
  'BLUE' = 'blue',
  [`GREEN`] = `green`
}

// 4. 对象字面量属性
const obj = {
  "regular-prop": "value",
  'single-quoted-prop': 'value',
  [`backtick-prop`]: `value`
};