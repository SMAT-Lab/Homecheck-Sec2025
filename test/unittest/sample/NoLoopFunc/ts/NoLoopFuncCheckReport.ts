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
for (var i = 0; i < l; i++) {
  (function () {
    i;
  });
}
for (var i = 0; i < l; i++) {
  for (var j = 0; j < m; j++) {
    (function () {
      i + j;
    });
  }
}
for (var i in {}) {
  (function () {
    i;
  });
}
for (var i of {}) {
  (function () {
    i;
  });
}
for (var i = 0; i < l; i++) {
  () => {
    i;
  };
}
for (var i = 0; i < l; i++) {
  var a1 = function () {
    i;
  };
}
for (var i = 0; i < l; i++) {
  function a2() {
    i;
  }
  a2();
}
for (
  var i = 0;
  (function () {
    i;
  })(),
  i < l;
  i++
) {}
for (
  var i = 0;
  i < l;
  (function () {
    i;
  })(),
  i++
) {}
while (i) {
  (function () {
    i;
  });
}
do {
  (function () {
    i;
  });
} while (i);
let a4;
for (let i = 0; i < l; i++) {
  a4 = 1;
  (function () {
    a4;
  });
}
let a5;
for (let i in {}) {
  (function () {
    a5;
  });
  a5 = 1;
}
let a6;
for (let i of {}) {
  (function () {
    a6;
  });
}
a6 = 1;
let a7;
for (let i = 0; i < l; i++) {
  (function () {
    (function () {
      a7;
    });
  });
  a7 = 1;
}
let a8;
for (let i in {}) {
  a8 = 1;
  function foo() {
    (function () {
      a8;
    });
  }
}
let a9;
for (let i of {}) {
  () => {
    (function () {
      a9;
    });
  };
}
a9 = 1;
for (var i = 0; i < 10; ++i) {
  for (let x in xs.filter(x => x != i)) {
  }
}
for (let x of xs) {
  let a10;
  for (let y of ys) {
    a10 = 1;
    (function () {
      a10;
    });
  }
}
for (var x of xs) {
  for (let y of ys) {
    (function () {
      x;
    });
  }
}
for (var x of xs) {
  (function () {
    x;
  });
}
var a11;
for (let x of xs) {
  a11 = 1;
  (function () {
    a11;
  });
}
var a12;
for (let x of xs) {
  (function () {
    a12;
  });
  a12 = 1;
}
let a13;
function foo13() {
  a13 = 10;
}
for (let x of xs) {
  (function () {
    a13;
  });
}
foo13();
let a14;
function foo14() {
  a14 = 10;
  for (let x of xs) {
    (function () {
      a14;
    });
  }
}
foo14();
