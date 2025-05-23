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
var foo = /[   ]  /; // Expected: /[   ] {2}/;
var foo = /bar\\  baz/; // Expected: /bar\\ {2}baz/;
var foo = /\\   /; // Expected: /\\ {2}/;
var foo = / \\  /; // Expected: / \\ {2}/;
var foo = /[[    ]    ]    /v; // Expected: /[[    ]    ] {4}/v;
var foo = /  [   ] /; // Expected: / {2}[   ] /;
var foo = new RegExp('bar   *baz'); // Expected: new RegExp('bar {2} *baz')
var foo = RegExp('bar   +baz'); // Expected: RegExp('bar {2} +baz')
var foo = /bar   {3}baz/; // Expected: /bar {2} {3}baz/;
var foo = /bar    ?baz/; // Expected: /bar {3} ?baz/;
var foo = RegExp(' a b c d  '); // Expected: RegExp(' a b c d {2}')
var foo = RegExp('bar    baz'); // Expected: RegExp('bar {4}baz')
var foo = new RegExp('bar    baz'); // Expected: new RegExp('bar {4}baz')
var foo = RegExp('bar    '); // Expected: RegExp('bar {4}')
var foo = new RegExp('bar    '); // Expected: new RegExp('bar {4}')
