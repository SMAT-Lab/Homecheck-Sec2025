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

function f(a1 = 0, b1: number) {}
function f1(a1: number, b1 = 0, c1: number) {}
function f2(a1: number, b1?: number, c1: number) {}
class Foo1 {
    constructor(
        public a1 = 10,
        private b1: number,
    ) {}
}
class Foo2 {
    constructor(
        public a1?: number,
        private b1: number,
    ) {}
}