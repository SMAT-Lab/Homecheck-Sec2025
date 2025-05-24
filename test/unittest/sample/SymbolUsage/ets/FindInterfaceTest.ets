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

import { InterfaceTarget, MySpace } from "./Target";

// implements interface
export class FindInterface implements InterfaceTarget {
  a: string = '';
  b: number = 1;
}

// implements多层ns下的interface
export class FindInterfaceInNamespaces implements MySpace.InnerSpace.InterfaceTarget {
  a: string = '';
  b: number = 1;
}

function test() {
  // interface显式类型定义
  let typeUsed: InterfaceTarget = {
    a : "111",
    b : 123
  }
}