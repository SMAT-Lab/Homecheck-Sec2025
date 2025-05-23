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

let z = 1; foo(z);

for (let i in [1,2,3]) { foo1(i); }

for (let x of [1,2,3]) { foo2(x); }

let [xx = -1, y] = [1,2]; y = 0;

let {a: xxx = -1, b: yy} = {a:1,b:2}; yy = 0;

(function() { let q = 1; foo3(q); })();   ///?

(function() { for (let w in [1,2,3]) { foo4(w); } })();

(function() { for (let e of [1,2,3]) { foo5(e); } })();

(function() { let [a = -1, b] = [1,2]; b = 0; })();

let f = (function() { let g = s; })(); f = 1;   ///?

(function() { let {a: x = -1, b: y} = {a:1,b:2}; y = 0; })();
//
let d = 0; { let d = 1; foo6(d); } d = 0;

for (let j = 0; j < 10; ++j) { let c = 1; foo7(c); }  ///?

for (let cc in [1,2,3]) { let n = 1; foo8(n); } ///? n

let zx; zx = 0;  ///?

switch (zx) { case 0: let s; s = 0; }  ///?

(function() { let qa; qa = 1; })();  ///?

let [as] = [1];

let {ada} = obj;

let al, bl; ({al = 0, bl} = obj); foo11(al, bl);//

let xa; function foo12() { barr(xa); } xa = 0;

/*eslint custom/use-x:error*/ let xi = 1;

/*eslint custom/use-x:error*/ { let ox = 1 }

let { fooi, bari } = bazi;

const xg = [1,2]; let [,yg] = xg;

const xk = [1,2,3]; let [yk,,zk] = xk;

let predicate; [, {foo11:returnType, predicate}] = foo12();

let predicate1; [, {foos:returnType, predicate1}, ...bard ] = foo13();

let predicate2; [, {foow:returnType, ...predicate2} ] = foo14();

let df = 'df', ydf = 'ydf';

let xr = 1, yr = 'y'; let zr = 1;

let { ah, bh, ch} = obj; let { xh, yh, zh} = anotherObj; xh = 2;

let x1 = 'x1', y1 = 'y1'; function someFunc() { let a1 = 1, b1 = 2; foo15(a1, b1) }  ///?a1

let someFunc1 = () => { let a2 = 1, b2 = 2; foo16(a2, b2) }

let {a3, b3} = c3, d3; /// 不需要修复

let {a4, b4, c4} = {}, e4, f4; /// 不需要修复

/*eslint no-undef-init:error*/ let foo19 = undefined;

let a6 = 1; class C6 { static { a6; } }

class C7 { static { a7; } } let a7 = 1;

class C8 { static { let a8 = 1; } }  ///?

class C9 { static { if (foo20) { let a9 = 1; } } }   ///?

class C10 { static { let a10 = 1; if (foo21) { a10; } } }  ///?

class C11 { static { if (foo22) { let a11; a11 = 1; } } }  ///?

class C12 { static { let a12; a12 = 1; } }

class C13 { static { let { a13, b13 } = foo23; } } ///?

class C14 { static { let a14, b14; ({ a14, b14 } = foo24); } }

class C15 { static { let a15; let b15; ({ a15, b15 } = foo25); } }

class C16 { static { let a16; a16 = 0; console.log(a16); } }  ///?

var foo9 = function() {
  for (const bb of cd) {
    let m;
    m = 1;
  }
}

var foodd = function() {
  for (const bh of ch) {
    let a;
    ({a} = 1);
  }
}

function a5() {
  let foo17 = 0,  bar5 = 1;
  foo17 = 1;
}
function b5() {
  let foo18 = 0, bar5 = 2;
  foo18 = 2;
}
