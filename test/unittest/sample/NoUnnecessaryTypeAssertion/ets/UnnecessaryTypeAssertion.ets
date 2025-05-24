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

const fooTest = 3;
const barTest = fooTest!;

const foo2Test = <3>3;

type Foo3Test = 3;
const foo4Test = <Foo3Test>3;

type Foo4Test = 3;
const foo6Test = 3 as Foo4Test;

function foo7Test(x: number): number {
    return x!;
}