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
if (typeof bar !== undefined) {
} // {'requireStringLiterals': true/false}都报
if (typeof bar !== null) {
}
if (typeof bar !== true) {
}
if (typeof bar !== 5000) {
}

undefined === typeof foo; // {'requireStringLiterals': true/false}都报

function A() {
  'strnig' != typeof foo;

  for (let i = 0; i++; i < 5) {
    if (typeof bar !== 'umdefined') {
      typeof foo === `string + object` ? typeof foo : '';
    }
  }
  return '';
}
function B() {}

@Entry
@Component
struct ValidTypeof {
  @State message: string = 'Hello World';
  bool = typeof foo === 'strnig'; // 反例

  build() {
    RelativeContainer() {
      Text(typeof foo == 'thing') // 反例
      Text(typeof foo + 'thing') // 正例
        .id('NoUselessCatchHelloWorld')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onTouch(() => {
          let string = '';
          let foo = '';
          let somethingElse = 0;
          let bar = '';
          let qux = '';

          typeof foo === 'strnig';
          'strnig' != typeof foo;
          if (typeof bar == 'umdefined') {
          }
          if (typeof bar !== undefined) {
          } // {'requireStringLiterals': true/false}都报
        })
    }
    .height('100%')
    .width('100%')
  }
}
