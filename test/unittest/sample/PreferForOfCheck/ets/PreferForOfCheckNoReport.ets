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
declare const arr1: string[]
declare const arr: number[]
declare const arr2: string[]

for (let i = 0; i < arr1.length; i++) {
  const x = arr1[i] === arr2[i];
}
for (let i = 0; i < arr.length; i++) {
  arr[i] = 0;
}
for (let c = 0; c < arr.length; c++) {
  if(arr[c] == arr[c+1]){

  }
  doMath(c);
}
function doMath(num: number) {

}

for (var d = 0; d < arr.length; d++) doMath(d);

for (var e = 0; e < arr.length; e++) {
  if (e > 5) {
    doMath(e);
  }
}
for (var f = 0; f <= 40; f++) {
  doMath(f);
}

for (var g = 0; g <= 40; g++) doMath(g);

for (var h = 0, len = arr.length; h < len; h++) {}

for (var i = 0, len = arr.length; i < len; i++) arr[i];//1

let  m = 0;
for (;;) { //2
  if (m > 3) break;
  console.log(m.toString());
  m++;
}

var n = 0;
for (; n < 9; n++) {
  console.log(n.toString());
}

var o = 0;
for (; o < arr.length; o++) {
  console.log(arr[o].toString());
}
for (; x < arr.length; x++) {}
for (let x = 0; ; x++) {}
for (let x = 0; x < arr.length; ) {}
for (let x = 0; NOTX < arr.length; x++) {}
for (let x = 0; x < arr.length; NOTX++) {}
for (let NOTX = 0; x < arr.length; x++) {}
for (let x = 0; x < arr.length; x--) {}
for (let x = 0; x <= arr.length; x++) {}
for (let x = 1; x < arr.length; x++) {}
for (let x = 0; x < arr.length(); x++) {}
for (let x = 0; x < arr.length; x += 11) {}
for (let x = arr.length; x > 1; x -= 1) {}
for (let x = 0; x < arr.length; x *= 2) {}
for (let x = 0; x < arr.length; x = x + 11) {}
for (let x = 0; x < arr.length; x++) {
  x++;
}
for (let x = 0; true; x++) {}
for (var q in obj) { //5555
  if (obj.hasOwnProperty(q)) {
    console.log(q);
  }
}
for (var r of arr) { //6666
  console.log(r);
}

for (let x = 0; x < arr.length; x++) {
  let y = arr[x + 1];
}

for (let i = 0; i < arr1?.length; i++) {
  const x = arr1[i] === arr2[i];
}

for (let i = 0; i < arr?.length; i++) {
  arr[i] = 0;
}

for (var c = 0; c < arr?.length; c++) {
  doMath(c);
}

for (var d = 0; d < arr?.length; d++) doMath(d);

for (var c = 0; c < arr.length; c++) {
  doMath?.(c);
}

for (var d = 0; d < arr.length; d++) doMath?.(d);

for (let i = 0; i < test.length; ++i) {
  this[i];
}

for (let x = 0; x < arr.length; x = x+8 ) {

}

for (let x = 0; x < arr.length; x = 20 + x) {}


declare const array: string[];

for (const x of array) {
  console.log(x);
}

for (let i = 0; i < array.length; i++) {
  // i is used, so for-of could not be used.
  console.log(i, array[i]);
}