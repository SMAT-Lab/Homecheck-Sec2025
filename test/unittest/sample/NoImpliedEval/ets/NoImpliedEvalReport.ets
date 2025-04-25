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
const time = 100;
setTimeout('alert(`Hi!`);', time);
setInterval('alert(`Hi!`);', time);
const fn1 = '() = {}';
setTimeout(fn1, time);
const fn2 = () => {
  return 'x = 10';
};
setTimeout(fn2(), time);
//github
setTimeout('x = 1', 0);
setInterval('x = 1', 0);
setImmediate('x = 1');
execScript('x = 1');
setTimeout(undefined, 0);
setInterval(undefined, 0);
setImmediate(undefined);
execScript(undefined);
setTimeout(1 + '' + (() => {}), 0);
setInterval(1 + '' + (() => {}), 0);
setImmediate(1 + '' + (() => {}));
execScript(1 + '' + (() => {}));
const foo = () => {};
setTimeout(foo, 0);
setInterval(foo, 0);
setImmediate(foo);
execScript(foo);
const foo1 = function () {
  return 'x + 1';
};
setTimeout(foo1(), 0);
setInterval(foo1(), 0);
setImmediate(foo1());
execScript(foo1());
const foo2 = function () {
  return () => 'x + 1';
};
setTimeout(foo2()(), 0);
setInterval(foo2()(), 0);
setImmediate(foo2()());
execScript(foo2()());
const fn = function () {};
setTimeout(fn + '', 0);
setInterval(fn + '', 0);
setImmediate(fn + '');
execScript(fn + '');
const foo4: string = 'x + 1';
setTimeout(foo4, 0);
setInterval(foo4, 0);
setImmediate(foo4);
execScript(foo4);
const foo5 = new String('x + 1');
setTimeout(foo5, 0);
setInterval(foo5, 0);
setImmediate(foo5);
execScript(foo5);
const foo6= 'x + 1';
setTimeout(foo6 as any, 0);
setInterval(foo6 as any, 0);
setImmediate(foo6 as any);
execScript(foo6 as any);
const fn8 = (foo8: string | any) => {
  setTimeout(foo8, 0);
  setInterval(foo8, 0);
  setImmediate(foo8);
  execScript(foo8);
};
const foo9 = 'foo';
const bar9 = () => {};
setTimeout(Math.radom() > 0.5 ? foo9 : bar9, 0);
window.setTimeout(``, 0);
window['setTimeout'](``, 0);
window.setInterval(``, 0);
window['setInterval'](``, 0);
window.setImmediate(``);
window['setImmediate'](``);
window.execScript(``);
window['execScript'](``);
global.setTimeout(``, 0);
global['setTimeout'](``, 0);
global.setInterval(``, 0);
global['setInterval'](``, 0);
global.setImmediate(``);
global['setImmediate'](``);
global.execScript(``);
global['execScript'](``);
globalThis.setTimeout(``, 0);
globalThis['setTimeout'](``, 0);
globalThis.setInterval(``, 0);
globalThis['setInterval'](``, 0);
globalThis.setImmediate(``);
globalThis['setImmediate'](``);
globalThis.execScript(``);
globalThis['execScript'](``);
const foo10: string | undefined = 'hello';
const bar10 = () => {};
setTimeout(foo10 || bar10, 500);
const fn11 = Function();
const fn22 = new Function('a', 'b', 'return a + b');
const fn33 = window.Function();
const fn44 = new window.Function();
const fn55 = window['Function']();
const fn76 = new window['Function']();
@Entry
@Component
struct NoImpliedEvalNoReport {
  @State message: string = 'Hello World';
  build() {
    RelativeContainer() {
      Button().onClick(()=>{
      })
    }
    .height('100%')
    .width('100%')
  }
}
