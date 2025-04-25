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

/^(?:(a)|\1b)$/; // reference to (a) into another alternative


@Entry
@Component
struct NoUselessBackreferenceCheck {
  /* tslint:disable */
  @State message: string = 'Hello World';
  a = /^(?:(a)|b(?:c|\1))$/; // reference to (a) into another alternative

  build() {
    RelativeContainer() {
      Text(this.message)
        .id('BanESLintCommentHelloWorld')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onHover(() => {
        })
    }
    .height('100%')
    .width('100%')
  }
}