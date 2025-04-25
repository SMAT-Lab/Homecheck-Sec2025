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

/*eslint no-empty-character-class: "error"*/
/^abc[]/.test("abcdefg"); // false
"abcdefg".match(/^abc[]/); // null

/^abc[[]]/v.test("abcdefg"); // false
"abcdefg".match(/^abc[[]]/v); // null

/^abc[[]--[x]]/v.test("abcdefg"); // false
"abcdefg".match(/^abc[[]--[x]]/v); // null

/^abc[[d]&&[]]/v.test("abcdefg"); // false
"abcdefg".match(/^abc[[d]&&[]]/v); // null

const regex = /^abc[d[]]/v;
regex.test("abcdefg"); // true, the nested `[]` has no effect
"abcdefg".match(regex); // ["abcd"]
regex.test("abcefg"); // false, the nested `[]` has no effect
"abcefg".match(regex); // null
regex.test("abc"); // false, the nested `[]` has no effect
"abc".match(regex); // null