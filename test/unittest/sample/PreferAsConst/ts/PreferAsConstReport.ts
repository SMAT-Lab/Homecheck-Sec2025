/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let bar: 2 = 2;
let foo = <'bar'>'bar';
let foo = { bar: 'baz' as 'baz' };

let foo = { bar: 'baz' as 'baz' };
let foo = { bar: 1 as 1 };
let []: 'bar' = 'bar';
let foo: 'bar' = 'bar';
let foo: 2 = 2;
let foo: 'bar' = 'bar' as 'bar';
let foo = <'bar'>'bar';
let foo = <4>4;
let foo = 'bar' as 'bar';
let foo = 5 as 5;

class foo {
  bar: 'baz' = 'baz';
}

class foo {
  bar: 2 = 2;
}

class foo {
  foo = <'bar'>'bar';
}

class foo {
  foo = 'bar' as 'bar';
}

class foo {
  foo = 5 as 5;
}

