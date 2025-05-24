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

import { MySpace, TypeTarget } from "./Target";

export class FindType {
  // 类字段使用目标type
  public field1: TypeTarget = 1;
  public fileds2 = this.field1;

  public findTypeTest() {
    // 显式定义目标type
    let a: TypeTarget = 1;
    let aa = a;
    // as强转为目标type
    let b = (1 as TypeTarget);
    // ifStmt使用了目标type
    if (aa === (2 as TypeTarget)) {
      console.log('test');
    }
  }
}

class FindTypeInNamespacen {
  // 类字段使用目标type
  public field1: MySpace.InnerSpace.TypeTarget = 1;
  public fileds2 = this.field1;

  public findTypeTest() {
    // 显式定义目标type
    let a: MySpace.InnerSpace.TypeTarget = 1;
    let aa = a;
    // as强转为目标type
    let b = (1 as MySpace.InnerSpace.TypeTarget);
    // ifStmt使用了目标type
    if (aa === (2 as MySpace.InnerSpace.TypeTarget)) {
      console.log('test');
    }
  }
}