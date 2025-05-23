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

const x = console.log('foo');

const y = console?.log('foo');

console.error(console.log('foo'));

[console.log('foo')];

({ x: console.log('foo') });

void console.log('foo');

console.log('foo') ? true : false;

(console.log('foo') && true) || false;

(cond && console.log('ok')) || console.log('error');

!console.log('foo');

function notcool(input: string) {
  return input, console.log(input);
}

() => console.log('foo');

foo => foo && console.log(foo);

(foo: undefined) => foo && console.log(foo);

foo => foo || console.log(foo);

(foo: undefined) => foo || console.log(foo);

(foo: void) => foo || console.log(foo);

foo => (foo ? console.log(true) : console.log(false)); //2

function f() {
  return console.log('foo');
  console.log('bar');
}

function g() {
  console.log('foo')
  return ['bar', 'baz'].forEach(console.log)
  console.log('quux')
}

function d() {
  console.log('foo');
  return console.log('bar');
}

function h() {
  console.log('foo')
  return ['bar', 'baz'].forEach(console.log);
}

const j = () => {
  if (cond) {
    return console.error('foo');
  }
  console.log('bar');
};

const k = function () {
  if (cond) return console.error('foo');
  console.log('bar');
};

const l = function () {
  let num = 1;
  return num ? console.log('foo') : num;
};

const o = function () {
  let undef = undefined;
  return undef ? console.log('foo') : undef;
};

const p = function () {
  let num = 1;
  return num || console.log('foo');
};

const a = function () {
  let bar = void 0;
  return bar || console.log('foo');
};

let num = 1;
const foo = () => (num ? console.log('foo') : num);

let bar = void 0;
const foo = () => (bar ? console.log('foo') : bar);