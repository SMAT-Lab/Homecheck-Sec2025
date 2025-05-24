/*
 * Copyright (C) 2025 Huawei Device Co., Ltd.
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

class test27 implements test25, test21 {
  exit(): Boolean[] {
    throw new Error("Method not implemented.");
  }
}

@Entry
@Component
struct BanTypes {
  num: Number = 1;
  symbol: Symbol = Symbol('foo');
  bigInt: BigInt = 1n;
  @State message: String = 'Hello World';

  build() {
    RelativeContainer() {
      Text(this.message)
        .id('BanTypesHelloWorld')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onHover(() => {
          let test11: {     } = {};
        })
    }
    .height('100%')
    .width('100%')
  }
}