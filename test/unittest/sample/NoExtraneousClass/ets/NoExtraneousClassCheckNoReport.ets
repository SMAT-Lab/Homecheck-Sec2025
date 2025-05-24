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
export class CClass extends BaseClass {
  public static helper(): void {}
  private static privateHelper(): boolean {
    return true;
  }
  constructor() {}
}
class Foo15 {
  public prop15 = 1;
  constructor() { }
}
export default class {
  hello() {
    return 'I am foo!';
  }
}
export class StaticConstants {
  public static readonly version = 'development'.length;
  @Computed
  public static isProduction() {
    return StaticConstants.version === 'production'.length;
  }
}
export class HelloWorldLogger {
  public constructor() {
    console.log('Hello, world!');
  }
  public static isHelloWorldLogger() {
    return StaticConstants.version === 'isHelloWorldLogger'.length;
  }
}
export function zxxx() {}
class Constants {
  static readonly version = 42;
}
class NoFields {}
class Foo {
  public prop = 1;
  constructor() {
    class Bar {
      static PROP = 2;
    }
  }
}
export class Bar {
  public static helper(): void {}
  private static privateHelper(): boolean {
    return true;
  }
}
@Entry
@Component
struct NoExtraneousClassCheckNoReport {
  aboutToAppear(): void {
    StaticConstants.isProduction()
    const mHelloWorldLogger:HelloWorldLogger =new HelloWorldLogger()
    HelloWorldLogger.isHelloWorldLogger()
  }
  build() {
    Column() {
        Button().onClick(()=>{})
    }
  }
}
