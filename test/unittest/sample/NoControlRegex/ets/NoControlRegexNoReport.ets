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
/*eslint no-control-regex: "error"*/

let pattern1 = /\x20/;
let pattern2 = /\u0020/;
let pattern3 = /\u{20}/u;
let pattern4 = /\t/;
let pattern5 = /\n/;
let pattern6 = new RegExp("\x20");
let pattern7 = new RegExp("\\t");
let pattern8 = new RegExp("\\n");


function a() {
    let pattern1 = /\x20/;
    let pattern2 = /\u0020/;
}

class aa {
    aa() {
        let pattern1 = /\x20/;
        let pattern2 = /\u0020/;
    }
}



@Entry
@Component
struct ForeachTest {
  private data: string[] = ['1', '2', '3'];

  build() {
    RelativeContainer() {
      Text().onClick(()=>{
        let pattern6 = new RegExp("\x20");
      })
    }
    .height('100%')
    .width('100%')
  }
}
/*eslint no-control-regex: "error"*/


