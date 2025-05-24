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


 // 正例
let str16 = new RegExp(/\w\$\*\^\./, "u"); // 正例
let str12 = "\""; // 正例
"\"";
'\'';
"\x12";
"\u00a9";
@Entry
@Component
struct NoUselessCatch {
  @State message: string = 'Hello World';

  A () {
    let a = "\xf9";
    let a1 = "xs\u2111";
    let a2 = `\``;
    let a3 = `\${${a}}`;
    
    for(let i = 0; i++; i < 5) {
        let a4 = `$\{${a}}`;
        let a5 = /\\/g;
        let a6 = /\t/g;
        let a7 = /\w\$\*\^\./;
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
            var foo1 = "\\x123";
            foo1 = "\\u00a9";
            foo1 = "\\377";
            foo1 = "\\\"";
        })
    }
    .height('100%')
    .width('100%')
  }
}
