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
const foo = new Promise(async (resolve, reject) => {
  readFile('foo.txt', function(err, result) {
    if (err) {
      reject(err);
    } else {
      resolve(result);
    }
  });
});

function readFile(str, Function) {

}

const result = new Promise(async (resolve, reject) => {
  resolve(await foo);
});

new Promise(async function foo(resolve, reject) {})

new Promise(async (resolve, reject) => {})

new Promise(((((async () => {})))))

@Entry
@Component
struct Index {
  @State message: string = 'Hello World';

  myMethod() {
    const result = new Promise(async (resolve, reject) => {
      resolve(await foo);
    });
  }

  build() {
    RelativeContainer() {
      Text(this.message)
        .id('HelloWorld')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onClick(() => {
          if (1) { if (2) { if (3) {} } }
        })
    }
    .height('100%')
    .width('100%')
  }
}