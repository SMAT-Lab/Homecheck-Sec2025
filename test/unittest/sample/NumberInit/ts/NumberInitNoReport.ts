/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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
 
import {x, NumberUtil } from './NumberUtil';

let a = 0.1;
a = 3.5;

let b = 2.5;
b = a + 0.1;

let c = 2;
if (c > 2.5) {
  c++;
}
c = 3;

for (let i = 0; i < 3; i++) {
  b = 3.5;
}

let e = x;
e = c;

let f = NumberUtil.Y;
f = c;