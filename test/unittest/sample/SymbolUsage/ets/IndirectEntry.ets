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

import { FindClass } from './FindClassTest'
import { FindEnum } from './FindEnumTest';
import { FindFunction } from './FindFunctionTest';
import { FindInterface } from './FindInterfaceTest';
import { FindProperty } from './FindPropertyTest';
import { FindStruct } from './FindStructTest';
import { FindType } from './FindTypeTest';
function indirectEntry() {
  let a = new FindClass();
  a.findClassTest();

  let b = new FindFunction();
  b.findFunctionTest();

  let c = new FindProperty();
  c.findPropertyTest();

  let e = new FindInterface();

  let f = new FindEnum();
  f.findEnumTest();

  let g = new FindType();
  g.findTypeTest();
}

@Component
struct multiPage {
  build() {
    FindStruct();
  }
}