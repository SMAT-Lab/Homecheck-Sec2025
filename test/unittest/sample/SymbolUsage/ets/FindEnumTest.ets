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

import { EnumTarget, MySpace } from "./Target";

export class FindEnum {
  // enum在类字段右值
  public field1 = EnumTarget.ONE;
  // enum在类字段右值参与计算
  public field2 = EnumTarget.ONE + 2;


  public findEnumTest() {
    // enum在右值
    let one = EnumTarget.ONE;
    // enum参数表达式计算
    let calculate = EnumTarget.ONE + 1;

    // enum在ifStmt中
    if (one === EnumTarget.ONE) {
      console.log("one is one");
    }
  }
}

export class FindEnumInNamespaces {
  // enum在类字段右值
  public field1 = MySpace.InnerSpace.EnumTarget.ONE;
  // enum在类字段右值参与计算
  public field2 = MySpace.InnerSpace.EnumTarget.ONE + 2;


  public findEnumTest() {
    // enum在右值
    let one = MySpace.InnerSpace.EnumTarget.ONE;
    // enum参数表达式计算
    let calculate = MySpace.InnerSpace.EnumTarget.ONE + 1;

    // enum在ifStmt中
    if (one === MySpace.InnerSpace.EnumTarget.ONE) {
      console.log("one is one");
    }
  }
}

