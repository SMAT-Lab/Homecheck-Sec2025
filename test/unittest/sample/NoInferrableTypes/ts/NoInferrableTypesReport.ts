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

const a1: bigint = 10n;
const a2: bigint = BigInt(10);
const a3: boolean = !0;
const a4: boolean = Boolean(null);
const a5: boolean = true;
const a6: null = null;
const a7: number = 10;
const a8: number = Infinity;
const a9: number = NaN;
const a10: number = Number('1');
const a11: RegExp = /a/;
const a12: RegExp = new RegExp('a');
const a13: string = `str`;
const a14: string = String(1);
const a15: symbol = Symbol('a');
const a16: undefined = undefined;
const a17: undefined = void someValue;

class Foo {
  propName: number = 5;
}

function fn(aPara: number = 5, bPara: boolean = true) {}