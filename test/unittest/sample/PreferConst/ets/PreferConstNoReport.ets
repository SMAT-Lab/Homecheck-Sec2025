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

var x = 0;

let y;

let z; { z = 0; } foo(z);

let xx = 0; xx = 1;

const c = 0;

for (let i = 0, end = 10; i < end; ++i) {}

for (let ii in [1,2,3]) { ii = 0; }

for (let x of [1,2,3]) { x = 0; }

(function() { var x = 0; })();

(function() { let x; })();

(function() { let x; { x = 0; } foo1(x); })();

(function() { let x = 0; x = 1; })();

(function() { const x = 0; })();

(function() { for (let i = 0, end = 10; i < end; ++i) {} })();

(function() { for (let i in [1,2,3]) { i = 0; } })();

(function() { for (let x of [1,2,3]) { x = 0; } })();

(function(x = 0) { })();

let a; while (a = foo2());

let aa; do {} while (aa = foo3());

let ab; for (; ab = foo4(); );

let ac; for (;; ++ac);

let ad; for (const {b = ++ad} in foo5());

let aq; for (const {b = ++aq} of foo6());

let az; for (const x of [1,2,3]) { if (az) {} az = foo7(); }

let ax; for (const x of [1,2,3]) { ax = ax || foo8(); bar(ax); }

let av; for (const x of [1,2,3]) { foo9(++av); }

let an; function foo10() { if (an) {} an = bar(); }

let am; function foo11() { am = am || bar(); baz(am); }

let al; function foo12() { bar(++al); }

/*exported ap*/ let ap; function init() { ap = foo13(); }

(function (au) {
  let b;
  ({ au, b } = obj);
})();

(function (ay) {
  let b;
  ([ ay, b ] = obj);
})();

var at; { var b; ({ at, b } = obj); }

let ar; { let b; ({ ar, b } = obj); }

var ae; { var b; ([ ae, b ] = obj); }

let aw; { let b; ([ aw, b ] = obj); }

let xs; { xs = 0; foo15(x); }

(function() { let xd; { xd = 0; foo16(xd); } })();

let xf; for (const a of [1,2,3]) { xf = foo17(); bar(xf); }

(function() { let xg; for (const a of [1,2,3]) { xg = foo18(); bar(xg); } })();

const xss = [1,2]; let ys; [,ys] = xss; ys = 0;

const xff = [1,2,3]; let yf, zf; [yf,,zf] = xff; yf = 0; zf = 0;

class C { static { let a = 1; a = 2; } }

class B { static { let a; a = 1; a = 2; } }

let aww; class D { static { aww = 1; } }

class E { static { let a; if (foo) { a = 1; } } }

class F { static { let a; if (foo) a = 1; } }

class G { static { let a, b; if (foo) { ({ a, b } = foo); } } }

let id;
function foo() {
  if (typeof id !== 'undefined') {
    return;
  }
  id = setInterval(() => {}, 250);
}
foo();
