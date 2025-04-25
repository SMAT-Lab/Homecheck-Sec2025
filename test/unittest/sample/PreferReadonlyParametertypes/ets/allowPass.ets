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
interface Foo {
  prop: string;
}

interface Wrapper {
  readonly sub: Foo;
  readonly otherProp: string;
}

// Works because Foo is allowed
function fn1(arg: Foo) {}

// Works even when Foo is nested somewhere in the type, with other properties still being checked
function fn2(arg: Wrapper) {}
//--------------------------------lib---------------------
import { Bar } from 'bar-lib';
// Works because Foo is a local type
function fn21(arg: Foo) {}

// Works because HTMLElement is from the default librar
function fn22(arg: Symbol) {}

// Works because Bar is from "bar-lib"
function fn23(arg: Bar) {}

import { Foo2 } from './foo';

// Works because Foo is still a local type - it has to be in the same package
function fn31(arg: Foo2) {}

