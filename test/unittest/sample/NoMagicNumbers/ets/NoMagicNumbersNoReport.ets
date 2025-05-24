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
class thisClass {
  readonly A = 1;
  readonly B = 2;
  public static readonly C = 3;
  static readonly D = 4;
  readonly E = -5;
  readonly F = +6;
  private readonly G = 100n;
}
export function logHelloWorld() {
  console.log('Hello, world!');
  type Foo1 = 6 | 7 | 8;
}
export module Example {}
let Bar:number[] = [0,1,2,3]
type Fool = 1 | 2 | 3;
export const finalPrice = 100 + 100 * 0.25;
const data = ['foo', 'bar', 'baz'];
export const dataLast = data[2];
export const dataLast3 = 3;
type Foo6 = Bar[10n]
type Foo2 = Bar[0]
type Foo3 = Bar[-1]
type Foo4 = Bar[0xab]
type Foo5 = Bar[5.6e1]
type Foo6 = Bar[10n]
type Foo7 = Bar[1 | -2]
type Foo8 = Bar[1 & -2]
enum ThemeColor {
  Red = '5',
  Orange = 6,
  Green = 7
}
@Entry
@Component
struct NoMagicNumbersNoReport {
  aboutToAppear(): void {
    type Foo1 = 6 | 7 | 8;
  }
  build() {
    Column() {
      Row() {
        Button().onClick(()=>{
          type Foo1 = 9 | 17 | 18;
          const dataLast = data[2];
          let  mCmolumn =1;
          mCmolumn = 5.6e1;
        }).width(100)
      }.width(200)
    }.width(300)
  }
}