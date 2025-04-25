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
struct NoUselessCatch {
  @State message: string = 'Hello World';

  A () {
    // 反例
    try {
      doSomethingBeforeRethrow1();
    } catch (error) {
      throw error;
    } finally {
      cleanUp();
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
          // 反例
          try {
            doSomethingBeforeRethrow2();
          } catch (e) {
            throw e;
          } finally {
            cleanUp();
          }
        })
    }
    .height('100%')
    .width('100%')
  }
}

// 反例
try {
  doSomethingBeforeRethrow3();
} catch (e) {
  throw e;
} finally {
  cleanUp();
}


function doSomethingBeforeRethrow1() {
  throw new Error('Function not implemented.');
}

function doSomethingBeforeRethrow2() {
  throw new Error('Function not implemented.');
}

function doSomethingBeforeRethrow3() {
  throw new Error('Function not implemented.');
}

function cleanUp() {
  throw new Error('Function not implemented.');
}

function handleError(e: undefined) {
  throw new Error('Function not implemented.');
}