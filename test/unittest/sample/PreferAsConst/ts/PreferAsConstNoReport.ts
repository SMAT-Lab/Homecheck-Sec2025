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
let foo = 'bar';
let foo = 'bar' as const;
let foo: 'bar' = 'bar' as const;
let bar = 'bar' as string;
let foo = <string>'bar';
let foo = { bar: 'baz' };


let foo = 'baz' as const;
let foo = 1 as const;
let foo = { bar: 'baz' as const };
let foo = { bar: 1 as const };
let foo = { bar: 'baz' };
let foo = { bar: 2 };
let foo = <bar>'bar';
let foo = <string>'bar';
let foo = 'bar' as string;
let foo = `bar` as `bar`;
let foo = `bar` as 'bar';
let foo = `bar` as `foo`;
let foo: string = 'bar';
let foo: number = 1;
let foo: 'bar' = baz;
let foo = 'bar';
let foo: 'bar';
let foo = { bar };
let foo: 'baz' = 'baz' as const;

class foo {
  bar = 'baz';
}

class foo {
  bar: 'baz';
}

class foo {
  bar;
}

class foo {
  bar = <baz>'baz';
}

class foo {
  bar: string = 'baz';
}

class foo {
  bar: number = 1;
}

class foo {
  bar = 'baz' as const;
}

class foo {
  bar = 2 as const;
}

class foo {
  get bar(): 'bar' { }
  set bar(bar: 'bar') { }
}

class foo {
  bar = () => 'bar' as const;
}

type BazFunction = () => 'baz';
class foo {
  bar: BazFunction = () => 'bar';
}

class foo {
  bar(): void { }
}