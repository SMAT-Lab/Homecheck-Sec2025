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
async function numberOne(): Promise<number> {
  return 1;
};
// Async function expression with no await
const numberOne = async function (): Promise<number> {
  return 1;
};
// Async arrow function expression with no await
const numberOne = async (): Promise<number> => 1;
// non-async function with await inside async function without await
async function foo() {
  function nested() {
    await doSomething();
  };
};
async function* foo(): void {
  doSomething();
};
async function* foo() {
  yield 1;
}
const foo = async function* () {
  console.log('bar');
};
async function* asyncGenerator() {
  yield 1;
};
async function* asyncGenerator(source: Iterable<any>) {
  yield* source;
};
function isAsyncIterable(value: unknown): value is AsyncIterable<any> {
  return true;
};
async function* asyncGenerator(source: Iterable<any> | AsyncIterable<any>) {
  if (!isAsyncIterable(source)) {
    yield* source;
  };
}async function* asyncGenerator() {
  yield* syncGenerator();
};
function* syncGenerator() {
  yield 1;
};