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

var x = 5;

function foo() {}

for(;;);

while(0);

do;while(0);

for(a in b);

for(a of b);

if(true);

if(true); else;

foo: ;

with(foo);

class A { }

var AA = class { };

class B { a() { this; } }

var BB = class { a() { this; } };

class C { } c;

export const xxx = 42;

export default 42;

export class Foo {
  public foo: number = 0;
}

export class Doo {
  public foo: number = 0; public bar: number = 1;
}

