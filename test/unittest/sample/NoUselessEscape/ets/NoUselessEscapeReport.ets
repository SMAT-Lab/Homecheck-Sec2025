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
let a = "\'";
let a1 = '\"';
`\#{foo}`;

@Entry
@Component
struct NoUselessCatch {
  @State message: string = 'Hello World';

  A () {
    for(let i = 0; i++; i < 5) {
        /[\[]/;
    }
  }

  build() {
    RelativeContainer() {
      Text(this.message)
        .id('NoUselessCatchHelloWorld')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onTouch(() => {
            let str1 = "\'";
            let str2 = "\#";
            let str15 = /[a-z\-]/;
        })
    }
    .height('100%')
    .width('100%')
  }
}
