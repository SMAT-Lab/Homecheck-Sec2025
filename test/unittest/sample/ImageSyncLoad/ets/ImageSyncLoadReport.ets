/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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
struct MyComponent {

  build() {
    Column(){
      Image($r('app.media.startIcon'))
        .border({ width: 1 })
        .borderStyle(BorderStyle.Dashed)
        .aspectRatio(1)
        .width('25%')
        .height('12.5%')
        .syncLoad(true)

      this.ImageBuilder()
      imageComponent()
    }
    .width('25%')
    .height('12.5%')
  }
  @Builder
  ImageBuilder(){
    Image($r('app.media.startIcon'))
      .border({ width: 1 })
      .borderStyle(BorderStyle.Dashed)
      .aspectRatio(1)
      .width('25%')
      .height('12.5%')
      .syncLoad(true)
  }
}

@Component
@Reusable
struct imageComponent{
  build() {
    Column(){
      Image($r('app.media.startIcon'))
        .border({ width: 1 })
        .borderStyle(BorderStyle.Dashed)
        .aspectRatio(1)
        .width('25%')
        .height('12.5%')
        .syncLoad(true)
    }
    .width('25%')
    .height('12.5%')
  }
}