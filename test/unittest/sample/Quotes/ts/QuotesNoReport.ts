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

//使用默认 'double' 选项的此规则的正确代码示例：
/*eslint quotes: ['error', 'double']*/
var double = 'double';
var backtick = tag`backtick`; // backticks are allowed due to tag tag is a function defined by js ES6

//使用 'single' 选项的此规则的正确代码示例：
/*eslint quotes: ['error', 'single']*/
var single = 'single';
var backtick = `back${x}tick`; // backticks are allowed due to substitution

//使用 'backtick' 选项的此规则的正确代码示例：
/*eslint quotes: ['error', 'backtick']*/
'use strict'; // directives must use single or double quotes
var backtick = 'backtick';
var obj = { 'prop-name': 'value' }; // backticks not allowed for property names

//avoidEscape
//使用 'double', { 'avoidEscape': true } 选项的此规则的附加正确代码示例：
/*eslint quotes: ['error', 'double', { 'avoidEscape': true }]*/
var single = 'a string containing `double` quotes';

//使用 'single', { 'avoidEscape': true } 选项的此规则的附加正确代码示例：
/*eslint quotes: ['error, 'single', { 'avoidEscape': true }]*/
var double = `a string containing 'single' quotes`;

//使用 'backtick', { 'avoidEscape': true } 选项的此规则的附加正确代码示例：
/*eslint quotes: ['error', 'backtick', { 'avoidEscape': true }]*/
var double = 'a string containing `backtick` quotes'

//allowTemplateLiterals
//使用 'double', { 'allowTemplateLiterals': true } 选项的此规则的附加正确代码示例：
/*eslint quotes: ['error', 'double', { 'allowTemplateLiterals': true }]*/
var double = 'double';

//{ 'allowTemplateLiterals': false } 不会禁止使用所有模板字面。如果你想禁止任何模板字面实例，请使用 no-restricted-syntax 并定位 TemplateLiteral 选择器。
