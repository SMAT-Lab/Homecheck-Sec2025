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
let g_new_array_count = 1066;
let g_array_use_count = 1077;

class ArrayClass {
  constructor(arr1: Array<number>, arr2: Array<number>, arr3: Array<number>) {
  }
}

@Entry
@Component
struct ObjectCreateReport {

  aboutToAppear(): void {
    let aar1: number[] = new Array(10000);

    let count = 2000;
    let arr2: number[] = new Array(count);

    arr2 = new Array(6666);

    let a: number = 1000;
    let b: number = 3999;
    count = a + b;
    let arr3: number[] = new Array(count);

    count = b - a;
    let arr4: number[] = new Array(count);

    let c = 3;
    count = a * c;
    let arr5: number[] = new Array(count);

    count = b / c;
    let arr6: number[] = new Array(count);

    let inc = 6666;
    inc++;
    let arr81: number[] = new Array(inc);
    inc--;
    let arr82: number[] = new Array(inc);

    let q = 1023;
    q = q + 2;
    let arr83: number[] = new Array(q);

    let r = 1022;
    r += 5;
    let arr84: number[] = new Array(r);

    a = 9981;
    b = 1111;
    count = a & b;
    let arr9: number[] = new Array(count);

    a = 1000;
    b = 1234;
    count = a | b;
    let arr10: number[] = new Array(count);

    count = a ^ b;
    let arr11: number[] = new Array(count);

    a = -2000;
    count = ~a;
    let arr12: number[] = new Array(count);

    a = 999;
    count = a << 1;
    let arr13: number[] = new Array(count);

    let arr14: number[] = new Array(g_new_array_count);

    let ctx = 3000;
    ctx -= 1000;
    let arr15: number[] = new Array(ctx);

    let j = 1234;
    let k = 4321;
    let count19 = j * k + j << 1;
    let arr21: number[] = new Array(count19);

    let count20 = 2222;
    let count21 = 100;
    let arr22: Object = new ArrayClass(new Array(count20), new Array(count20), new Array(count20));
    let arr23: Object = new ArrayClass(new Array(count20), new Array(count21), new Array(count20));
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
            result[9999] = 0;

            let pos = 9999;
            result[pos] = 0;

            let p: number = 2222;
            let pos1 = ++p;
            result[pos1] = 0;

            let a: number = 2000;
            let b: number = 7999;
            let pos2 = a + b;
            result[pos2] = 0;

            let q: number = -2000;
            let pos3 = ~q;
            result[pos3] = 0;

            let pos4: number = 1022;
            pos4 += 200;
            result[pos4] = 0;

            result[g_array_use_count] = 0;

            let j = 1234;
            let k = 4321;
            let pos5 = j * k + j << 1;
            result[pos5] = 0;

            let pos6 = 1025
            result[pos6 + 3] = 1;

            let arr: number[] = new Array();
            arr[result[9999]] = 0;

            arr[result[8888] + result[7777] + result[6666]] = 0;
            arr[result[8888] + result[10] + result[7777]] = 0;

            let pos7 = 1025;
            arr[result[pos7 + 2] + result[100] + result[9999]] = 1;

            let pos8 = 1025;
            arr[result[pos8 + 2] + result[3 + pos8] + result[pos8 + pos8]] = 1;
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