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
import senceListModel from '../model/SenceListModel';
import TestCaseBean from '../common/bean/TestCaseBean';

const FONT_SIZE: number = 12;
const g_new_array_count1 = 123;
const g_array_use_count1 = 321;

@Entry
@Component
struct ObjectCreateNoReport {

  aboutToAppear(): void {
    let aar1: number[] = new Array(2);

    let count = 3;
    let arr2: number[] = new Array(count);

    let a: number = 4;
    let b: number = 5;
    count = a + b;
    let arr3: number[] = new Array(count);

    count = b - a;
    let arr4: number[] = new Array(count);

    let c = 6;
    count = a * c;
    let arr5: number[] = new Array(count);

    count = b / c;
    let arr6: number[] = new Array(count);

    c = 9;
    count = b % c;
    let arr7: number[] = new Array(count);

    let inc = 7;
    inc++;
    let arr81: number[] = new Array(inc);
    inc--;
    let arr82: number[] = new Array(inc);

    a = 8;
    b = 9;
    count = a & b;
    let arr9: number[] = new Array(count);

    a = 10;
    b = 11;
    count = a | b;
    let arr10: number[] = new Array(count);

    count = a ^ b;
    let arr11: number[] = new Array(count);

    count = ~a;
    let arr12: number[] = new Array(count);

    count = a << 1;
    let arr13: number[] = new Array(count);
    count = a >> 1;
    arr13 = new Array(count);
    count = a >>> 1;
    arr13 = new Array(count);

    let arr14: number[] = new Array(g_new_array_count1);

    let ctx = 12;
    ctx -= 1;
    let arr15: number[] = new Array(ctx);

    let j = 13;
    let k = 14;
    let count19 = j * k + j << 1;
    let arr21: number[] = new Array(count19);
  }

  build() {
    Navigation() {
      List() {
        ForEach(senceListModel.getTestCase(), (item: TestCaseBean, index: number) => {
          ListItem() {
            Button(item.name)
              .fontSize(FONT_SIZE)
              .margin(15)
              .fontWeight(FontWeight.Bold)
          }
          .onClick(() => {
            let result: number[] = new Array();
            result[2] = 0;

            let pos = 3;
            result[pos] = 0;

            let p: number = 4;
            let pos1 = ++p;
            result[pos1] = 0;

            p = 1024;
            pos1 = ++p;
            result[pos1] = 0;

            let a: number = 5;
            let b: number = 6;
            let pos2 = a + b;
            result[pos2] = 0;

            let q: number = 7;
            let pos3 = ~q;
            result[pos3] = 0;

            let pos4: number = 8;
            pos4 += 9;
            result[pos4] = 0;

            result[g_array_use_count1] = 0;

            let j = 10;
            let k = 11;
            let pos5 = j * k + j << 1;
            result[pos5] = 0;
          })
        })
      }.divider({
        strokeWidth: 1,
        color: Color.Blue
      })
    }
    .titleMode(NavigationTitleMode.Mini)
  }

  aboutToDisappear(): void {
  }
}