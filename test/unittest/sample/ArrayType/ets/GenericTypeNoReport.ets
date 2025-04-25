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
let arr3: ReadonlyArray<string | number> = ['Hello World', 123];
const d: Array<MyType> = ['a', 'b'];

@Entry
@Component
struct Index {
  @State message: string = 'Hello World';
  @State arr1: ReadonlyArray<string> = ['Hello World'];
  @State arr3: ReadonlyArray<string | number> = ['Hello World', 123];
  data: Array<string> = ['1', '2', '3']

  build() {
    RelativeContainer() {
      Text(this.message)
        .id('IndexHelloWorld')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onClick(() => {
          const d: Array<MyType> = ['a', 'b'];
          const f: ReadonlyArray<string> = ['a', 'b'];
          const g: ReadonlyArray<string | number> = ['Hello World', 123]; 
        })
    }
    .height('100%')
    .width('100%')
  }
}

type MyType = string;