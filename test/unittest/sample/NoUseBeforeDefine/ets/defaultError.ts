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
alert(a1);
var a1 = 10;

f1();
function f1() {}

function g1() {
  return b1;
}
var b1 = 1;

{
  alert(c2);
  let c2 = 1;
}

// {
//   class C1 extends C1 {}//底座解析长时间卡顿解析异常
// }

// {
  class C4 {
    static x = "foo";
    [C4.x]() {}
  }
// }

{
  const C5 = class {
    static x = C5;
  }
}

{
  const C6 = class {
    static {
      C6.x = "foo";
    }
  }
}

export { foo3 };
const foo3 = 1;
let var1: StringOrNumber1;
let myVar: StringOrNumber1;
type StringOrNumber1 = string | number;
//  import{ StringOrNumber1 } from './importstype';