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
/*eslint no-unused-vars: "error"*/
var data = { foo:"dsd",bar: "1", bar1: "2", baz: "3" };
 var data1 = { bar: "1", foo: "2", baz: "3" };
var { foo, ...rest } = data;
console.log(rest.toString()); // { bar: 2, baz: 3 }

// OR

var bar;
 let rest1;
 ({ bar, ...rest1 } = data1);
console.log(rest1); // { foo: 1, baz: 3 }