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

import { ClassTarget, funcTarget, MySpace } from "./Target";

export class FindFunction {
  // 类字段右值为目标全局函数调用
  public field1 = funcTarget();
  // 类字段右值为类目标方法调用
  public field2 = ClassTarget.methodStatic();
  // 类字段右值为类目标静态方法赋值
  public field3 = ClassTarget.methodStatic;

  public findFunctionTest() {
    // 右值为目标全局函数调用
    let a = funcTarget();
    // 右值为类目标方法调用
    let b = ClassTarget.methodStatic();
    // 右值为类目标静态方法赋值
    let c = ClassTarget.methodStatic;
    // 右值为类实例目标方法调用
    let d = new ClassTarget();
    let e = d.methodTarget();

    // 目标全局函数直接调用
    funcTarget();
    // 类目标方法直接调用
    ClassTarget.methodStatic();
    // 类的实例目标方法直接调用
    d.methodTarget();
  }
}

export class FindFunctionInNamespaces {
  // 类字段右值为目标全局函数调用
  public field1 = MySpace.InnerSpace.funcTarget();
  // 类字段右值为类目标方法调用
  public field2 = MySpace.InnerSpace.ClassTarget.methodStatic();
  // 类字段右值为类目标静态方法赋值
  public field3 = MySpace.InnerSpace.ClassTarget.methodStatic;

  public findFunctionTest() {
    // 右值为目标全局函数调用
    let a = MySpace.InnerSpace.funcTarget();
    // 右值为类目标方法调用
    let b = MySpace.InnerSpace.ClassTarget.methodStatic();
    // 右值为类目标静态方法赋值
    let c = MySpace.InnerSpace.ClassTarget.methodStatic;
    // 右值为类实例目标方法调用
    let d = new MySpace.InnerSpace.ClassTarget();
    let e = d.methodTarget();

    // 目标全局函数直接调用
    MySpace.InnerSpace.funcTarget();
    // 类目标方法直接调用
    MySpace.InnerSpace.ClassTarget.methodStatic();
    // 类的实例目标方法直接调用
    d.methodTarget();
  }
}