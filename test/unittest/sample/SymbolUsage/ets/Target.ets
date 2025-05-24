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

// 目标函数
export function funcTarget() {
  console.log('123');
}

// 目标类
export class ClassTarget {
  // 目标类字段
  public fieldTarget = '111';
  static fieldStatic = 123;
  static methodStatic() {
    return '';
  }
  // 目标方法
  public methodTarget() {
    let a = this.fieldTarget;
  }
}

// 目标interface
export interface InterfaceTarget {
  a: string;
  b: number;
}

// 目标enum
export enum EnumTarget {
  ONE = 1,
  TWO = 2
}

// 目标type
export type TypeTarget = string | number;

// 嵌套namespace
export namespace MySpace {
  export namespace InnerSpace {
    // 多层ns下的目标函数
    export function funcTarget() {
      console.log('123');
    }
    // 多层ns嵌套下的目标类
    export class ClassTarget {
      // 多层ns目标类字段
      public fieldTarget = '111';
      static fieldStatic = 123;
      static methodStatic() {
        return '';
      }
      // 目标方法
      public methodTarget() {
        let a = this.fieldTarget;
      }
    }

    // 多层ns嵌套下的目标interface
    export interface InterfaceTarget {
      a: string;
      b: number;
    }

    // 多层ns嵌套下的目标enum
    export enum EnumTarget {
      ONE = 1,
      TWO = 2
    }

    export type TypeTarget = string | number;
  }
}

@Component
export struct StructTarget {
  build() {
  }
}

export namespace NSTest {
  export type Constructor<T> = {
    new(): T;
    readonly prototype: T;
  }

  export interface TestInterface {

  }

  export function testFunc<T>(arr: T[]): T[] {
    return arr.reverse();
  }
}
