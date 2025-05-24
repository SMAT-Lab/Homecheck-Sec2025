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
@Entry
@Component
struct NoUnsafeOptionalChainingReport {
  @State message: string = 'Hello World';

  async foo () {
    const { bar } = await obj?.foo;
}

  build() {
    RelativeContainer() {
      Text(this.message)
        .id('NoUnsafeOptionalChainingReport')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onTouch(() => {
            // 反例
            [...obj?.foo];

            bar(...obj?.foo);

            1 in obj?.foo;

        })
    }
    .height('100%')
    .width('100%')
  }
}

// 反例
try {
    bar instanceof obj?.foo;
    for (bar of obj?.foo);
} catch (e) {
  throw e;
} finally {
  cleanUp();
}