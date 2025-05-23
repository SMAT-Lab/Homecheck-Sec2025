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
const [a, _b, c] = ["a", "b", "c"];
console.log(a+c);
const bar ={x:["v", [] ]}
const { x: [_a, foo] } = bar;//特殊解析
console.log(foo.toString());

function baz([_c, x]) {
  x;
}
baz(["a","b"]);
//特殊解析
function test({p: [_q, r]}) {
  r;
}
test({p:["a","b"]});
let _m, n;
foo.forEach(item => {
  // var _m,n;
  [_m, n] = item;
  console.log(_m);
});

let _o, p;
_o = 1;
[_o, p] = foo;
p;
"io";
`hjkhjkhk`;
