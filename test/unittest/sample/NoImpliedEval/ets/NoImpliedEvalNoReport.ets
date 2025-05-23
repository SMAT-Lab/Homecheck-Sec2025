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
function alert(arg: string) {
  console.log(arg);
}
const time = 100;
setTimeout(() => {
  alert('Hi!');
}, time);
setInterval(() => {
  alert('Hi!');
}, time);
const fn1 = () => {
  console.info('fn');
};
setTimeout(fn1, time);
class Foo2 {
  public static fn2 = () => {
    console.info('static');
  };
  public meth() {
    console.info('method');
  }
}
setTimeout(Foo2.fn2, time);
foo3.setImmediate(null);
foo3.setInterval(null);
foo3.execScript(null);
foo3.setTimeout(null);
foo3();
(function () {})();
setTimeout(() => {}, 0);
window.setTimeout(() => {}, 0);
window['setTimeout'](() => {}, 0);
setInterval(() => {}, 0);
window.setInterval(() => {}, 0);
window['setInterval'](() => {}, 0);
setImmediate(() => {});
window.setImmediate(() => {});
window['setImmediate'](() => {});
execScript(() => {});
window.execScript(() => {});
window['execScript'](() => {});
const foo4 = () => {};
setTimeout(foo4, 0);
setInterval(foo4, 0);
setImmediate(foo4);
execScript(foo4);
const foo5 = function () {};
setTimeout(foo5, 0);
setInterval(foo5, 0);
setImmediate(foo5);
execScript(foo5);
const foo7 = {
  fn7: () => {},
};
setTimeout(foo7.fn7, 0);
setInterval(foo7.fn7, 0);
setImmediate(foo7.fn7);
execScript(foo7.fn7);
const foo8 = {
  fn8: function () {},
};
setTimeout(foo8.fn8, 0);
setInterval(foo8.fn8, 0);
setImmediate(foo8.fn8);
execScript(foo8.fn8);
const foo9 = {
  fn9: function foo() {},
};
setTimeout(foo9.fn9, 0);
setInterval(foo9.fn9, 0);
setImmediate(foo9.fn9);
execScript(foo9.fn9);
const foo10 = {
  fn10() {},
};
setTimeout(foo10.fn10, 0);
setInterval(foo10.fn10, 0);
setImmediate(foo10.fn10);
execScript(foo10.fn10);
const foo11 = {
  fn11: () => {},
};
const fn12 = 'fn';
setTimeout(foo11[fn11], 0);
setInterval(foo11[fn11], 0);
setImmediate(foo11[fn11]);
execScript(foo11[fn11]);
const foo12 = {
  fn: () => {},
};
setTimeout(foo12['fn'], 0);
setInterval(foo12['fn'], 0);
setImmediate(foo12['fn']);
execScript(foo12['fn']);
const foo13: () => void = () => {};
setTimeout(foo13, 0);
setInterval(foo13, 0);
setImmediate(foo13);
execScript(foo13);
const foo14: () => () => void = () => {
  return () => {};
};
setTimeout(foo14(), 0);
setInterval(foo14(), 0);
setImmediate(foo14());
execScript(foo14());
const foo15: () => () => void = () => () => {};
setTimeout(foo15(), 0);
setInterval(foo15(), 0);
setImmediate(foo15());
execScript(foo15());
const foo16 = () => () => {};
setTimeout(foo16(), 0);
setInterval(foo16(), 0);
setImmediate(foo16());
execScript(foo16());
const foo18 = function () {
  return function () {
    return '';
  };
};
setTimeout(foo18(), 0);
setInterval(foo18(), 0);
setImmediate(foo18());
execScript(foo18());
const foo19: () => () => void = function foo() {
  return function foo() {};
};
setTimeout(foo19(), 0);
setInterval(foo19(), 0);
setImmediate(foo19());
execScript(foo19());
function foo20() {
  return function foo() {
    return () => {};
  };
}
setTimeout(foo20()(), 0);
setInterval(foo20()(), 0);
setImmediate(foo20()());
execScript(foo20()());
class Foo21 {
  static fn = () => {};
}
setTimeout(Foo21.fn, 0);
setInterval(Foo21.fn, 0);
setImmediate(Foo21.fn);
execScript(Foo21.fn);
class Foo22 {
  fn() {}
}
const foo22 = new Foo22();
setTimeout(foo22.fn, 0);
setInterval(foo22.fn, 0);
setImmediate(foo22.fn);
execScript(foo22.fn);
class Foo23 {
  fn() {}
}
const foo23 = new Foo23();
const fn23 = foo23.fn;
setTimeout(fn23.bind(null), 0);
setInterval(fn23.bind(null), 0);
setImmediate(fn23.bind(null));
execScript(fn23.bind(null));
const fn = (foo24: () => void) => {
  setTimeout(foo24, 0);
  setInterval(foo24, 0);
  setImmediate(foo24);
  execScript(foo24);
};
const foo3 = (callback: Function) => {
  setTimeout(callback, 0);
};
const foo26 = () => {};
const bar27 = () => {};
setTimeout(Math.radom() > 0.5 ? foo26 : bar27, 0);
setTimeout(foo26 || bar27, 500);
@Entry
@Component
struct NoImpliedEvalReport {
  @State message: string = 'Hello World';
  build() {
    RelativeContainer() {
    }
    .height('100%')
    .width('100%')
  }
}
