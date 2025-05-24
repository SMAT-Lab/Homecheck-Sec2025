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

export class FindClass extends ClassTarget {
  // 类字段右值为目标静态属性
  public field1 = ClassTarget.fieldStatic;
  // 类字段右值为目标静态方法调用
  public field2 = ClassTarget.methodStatic();
  // 类字段右值为目标静态方法赋值
  public field3 = ClassTarget.methodStatic;
  // 类字段右值new了目标类
  public field4 = new ClassTarget();


  public findClassTest() {
    // 右值new了目标类
    let testClass = new ClassTarget();

    // 右值为目标类实例的属性，未直接使用目标类，不上报
    let a = testClass.fieldTarget;

    // 左值为目标类静态属性
    ClassTarget.fieldStatic = 1;

    // 右值为目标类静态属性
    let b = ClassTarget.fieldStatic;

    // 右值为目标类静态方法调用
    let c = ClassTarget.methodStatic();

    // 右值为目标类静态方法赋值
    let d = ClassTarget.methodStatic;

    // 右值为目标类的静态属性参与运算
    let e = ClassTarget.fieldStatic + 1;

    // 目标类当作类型使用
    let classRename: ClassTarget = testClass;
  }
}

export class FindClassInNamespaces extends MySpace.InnerSpace.ClassTarget {
  // 类字段右值为目标静态属性
  public field1 = MySpace.InnerSpace.ClassTarget.fieldStatic;
  // 类字段右值为目标静态方法调用
  public field2 = MySpace.InnerSpace.ClassTarget.methodStatic();
  // 类字段右值为目标静态方法赋值
  public field3 = MySpace.InnerSpace.ClassTarget.methodStatic;
  // 类字段右值new了目标类
  public field4 = new MySpace.InnerSpace.ClassTarget();


  public findClassTest() {
    // 右值new了目标类
    let testClass = new MySpace.InnerSpace.ClassTarget();

    // 右值为目标类实例的属性，未直接使用目标类，不上报
    let a = testClass.fieldTarget;

    // 左值为目标类静态属性
    MySpace.InnerSpace.ClassTarget.fieldStatic = 1;

    // 右值为目标类静态属性
    let b = MySpace.InnerSpace.ClassTarget.fieldStatic;

    // 右值为目标类静态方法调用
    let c = MySpace.InnerSpace.ClassTarget.methodStatic();

    // 右值为目标类静态方法赋值
    let d = MySpace.InnerSpace.ClassTarget.methodStatic;

    // 右值为目标类的静态属性参与运算
    let e = MySpace.InnerSpace.ClassTarget.fieldStatic + 1;

    // 目标类当作类型使用 todo: 暂未支持
    let classRename: MySpace.InnerSpace.ClassTarget = testClass;
  }
}
