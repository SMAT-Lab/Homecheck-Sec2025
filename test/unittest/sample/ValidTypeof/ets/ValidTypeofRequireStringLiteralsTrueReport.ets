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

let foo;
let point = {
  x: 1,
  y: 2
}
// 反例
if (typeof bar !== any) {
  'ok'
} // {'requireStringLiterals': true}报

if (typeof bar !== Array) {
  'ok'
} // {'requireStringLiterals': true}报
if (typeof bar !== [1]) {
  'ok'
} // {'requireStringLiterals': true}报

if (typeof bar !== point.x) {
  'ok'
} // {'requireStringLiterals': true}报
if (typeof bar !== undefined) {
} // {'requireStringLiterals': true/false}都报
if (typeof bar !== null) {
}
if (typeof bar !== true) {
}
if (typeof bar !== 5000) {
}
if (typeof bar !== A()) {
} // {'requireStringLiterals': true}报
if (typeof bar !== B()) {
} // {'requireStringLiterals': true}报


@Entry
@Component
struct ValidTypeof {
  @State message: string = 'Hello World';
  bool = typeof foo === 'strnig'; // 反例

  build() {
    RelativeContainer() {
      Text(typeof foo == 'thing') // 反例
        .id('NoUselessCatchHelloWorld')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onTouch(() => {
          typeof foo === `\${string}`;
          typeof foo == Object; // {'requireStringLiterals': true}报
          undefined === typeof foo; // {'requireStringLiterals': true/false}都报
          typeof foo === `undefined${foo}`; // {'requireStringLiterals': true}报
        })
    }
    .height('100%')
    .width('100%')
  }
}

// 正例
typeof foo === `str${somethingElse}`;   // {'requireStringLiterals': true}报
typeof foo === baz;  // {'requireStringLiterals': true}报
