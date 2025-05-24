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
let someArray1: MyType[] = [];
for (let i = 0; i < 10; i += 1) {
  someArray1 = someArray1.filter((item: MyType) => !!item);
}
let someArray2: MyType[] = [];
for (let i = 0; i < 10; i += 1) {
  someArray2 = someArray2.filter((item: MyType) => !!item);
}
let someArray3: MyType[] = [];
for (let i = 0; i < 10; i += 1) {
  someArray3 = someArray3.filter((item: MyType) => !!item);
}
type MyType = 1;
let someArray4: MyType[] = [];
for (let i = 0; i < 10; i += 1) {
  someArray4 = someArray4.filter((item: MyType) => !!item);
}
const string = function a() {};
for (var i = 0; i < l; i++) {}
var a = function () {
  i;
};
for (
  var i = 0,
    a = function () {
      i;
    };
  i < l;
  i++
) {}
for (var x in xs.filter(function (x) {
  return x != upper;
})) {
}
for (var x of xs.filter(function (x) {
  return x != upper;
})) {
}
for (var i = 0; i < l; i++) {
  (function () {});
}
for (var i in {}) {
  (function () {});
}
for (var i of {}) {
  (function () {});
}
for (let i = 0; i < l; i++) {
  (function () {
    i;
  });
}
for (let i in {}) {
  i = 7;
  (function () {
    i;
  });
}
for (const i of {}) {
  (function () {
    i;
  });
}
for (let i = 0; i < 10; ++i) {
  for (let x in xs.filter(x => x != i)) {
  }
}
let a1 = 0;
for (let i = 0; i < l; i++) {
  (function () {
    a1;
  });
}
let a2 = 0;
for (let i in {}) {
  (function () {
    a2;
  });
}
let a3 = 0;
for (let i of {}) {
  (function () {
    a3;
  });
}
let a4 = 0;
for (let i = 0; i < l; i++) {
  (function () {
    (function () {
      a4;
    });
  });
}
let a5 = 0;
for (let i in {}) {
  function foo() {
    (function () {
      a5;
    });
  }
}
let a6 = 0;
for (let i of {}) {
  () => {
    (function () {
      a6;
    });
  };
}
var a7 = 0;
for (let i = 0; i < l; i++) {
  (function () {
    a7;
  });
}
var a8 = 0;
for (let i in {}) {
  (function () {
    a8;
  });
}
var a9 = 0;
for (let i of {}) {
  (function () {
    a9;
  });
}
let result = {};
for (const score in scores) {
  const letters = scores[score];
  letters.split('').forEach(letter => {
    result[letter] = score;
  });
}
result.__default = 6;
while (true) {(function() { a10; });}let a10;
