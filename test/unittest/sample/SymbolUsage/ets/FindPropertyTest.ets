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

import { ClassTarget, MySpace } from "./Target";

export class FindProperty {
  // 目标字段在类字段右值
  public field1 = ClassTarget.fieldStatic;
  // 目标字段在类字段右值参与计算
  public field2 = ClassTarget.fieldStatic + 2;

  public findPropertyTest() {
    // 目标静态字段在右值
    let one = ClassTarget.fieldStatic;
    // 目标静态字段在右值参与计算
    let calculate = ClassTarget.fieldStatic + 1;
    // 目标实例字段在右值
    let instanceClass = new ClassTarget();
    let instanceField = instanceClass.fieldTarget;
    // 目标实例字段在右值参与计算
    let instanceCalculate = instanceClass.fieldTarget + 'xxx';

    // 目标实例字段在ifStmt中
    if ('123' === instanceClass.fieldTarget) {
      console.log("one is one")
    }
  }
}

export class FindPropertyInNamespaces {
  // 目标字段在类字段右值
  public field1 = MySpace.InnerSpace.ClassTarget.fieldStatic;
  // 目标字段在类字段右值参与计算
  public field2 = MySpace.InnerSpace.ClassTarget.fieldStatic + 2;

  public findPropertyTest() {
    // 目标静态字段在右值
    let one = MySpace.InnerSpace.ClassTarget.fieldStatic;
    // 目标静态字段在右值参与计算
    let calculate = MySpace.InnerSpace.ClassTarget.fieldStatic + 1;
    // 目标实例字段在右值
    let instanceClass = new MySpace.InnerSpace.ClassTarget();
    let instanceField = instanceClass.fieldTarget;
    // 目标实例字段在右值参与计算
    let instanceCalculate = instanceClass.fieldTarget + 'xxx';

    // 目标实例字段在ifStmt中
    if ('123' === instanceClass.fieldTarget) {
      console.log("one is one")
    }
  }
}