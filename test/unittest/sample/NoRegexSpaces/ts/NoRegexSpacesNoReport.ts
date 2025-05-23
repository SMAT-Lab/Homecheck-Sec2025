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

/*eslint no-regex-spaces: "error"*/
const re2 = /foo {3}bar/;

const re13 = new RegExp("foo {3}bar");

var foo = /foo/;

var foo = RegExp('foo');

var foo = / /;

var foo = RegExp(' ');

var foo = / a b c d /;

var foo = /bar {3}baz/g;

var foo = RegExp('bar {3}baz', 'g');

var foo = new RegExp('bar {3}baz');

var foo = /bar\t\t\tbaz/;

var foo = RegExp('bar\t\t\tbaz');

var foo = new RegExp('bar\t\t\tbaz');



var foo = /  +/;

var foo = /  ?/;

var foo = /  */;

var foo = /  {2}/;



var foo = /bar \\u0020 baz/;

var foo = /bar\\u0020\\u0020baz/;

var foo = new RegExp('bar \\ baz');//

var foo = new RegExp('bar\\ \\ baz');


var foo = new RegExp('bar \\u0020 baz');
var foo = new RegExp('bar\\u0020\\u0020baz');
var foo = new RegExp('bar \\\\u0020 baz');
var foo = /[  ]/;
var foo = /[   ]/;
var foo = new RegExp('[  ]');
var foo = new RegExp('[   ]');

var foo = /bar \\ baz/;
var foo = /bar\\ \\ baz/;
var foo = / [  ] /;
var foo = / [  ] [  ] /;
new RegExp('  ', flags);
var foo = new RegExp('{  ', 'u');
var foo = new RegExp('[  ');
var foo = new RegExp(' [  ] ');
var foo = RegExp(' [  ] [  ] ');
new RegExp('[[abc]  ]', flags + 'v');
new RegExp('[[abc]\\\\q{  }]', flags + 'v');
var foo = new RegExp('bar \\\\ baz');
var foo = /  {2}/v;