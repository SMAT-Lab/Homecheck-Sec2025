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
function numberOne(): number {
  return 1;
};
// Non-async function expression
const numberOne = function (): number {
  return 1;
};
// Non-async arrow function expression (concise-body)
const numberOne = (): number => 1;
// Non-async arrow function expression (block-body)
const numberOne = (): number => {
  return 1;
};
// Non-async function that returns a promise
function delay() {
  return Promise.resolve();
};
const delay = () => {
  return Promise.resolve();
};
const delay = () => Promise.resolve();
// Async function declaration with await
async function numberOne(): Promise<number> {
  return await 1;
};
// Async function expression with await
const numberOne = async function (): Promise<number> {
  return await 1;
};
// Async arrow function expression with await (concise-body)
const numberOne = async (): Promise<number> => await 1;
// Async arrow function expression with await (block-body)
const numberOne = async (): Promise<number> => {
  return await 1;
};
// Async function declaration with promise return
async function numberOne(): Promise<number> {
  return Promise.resolve(1);
};
// Async function expression with promise return
const numberOne = async function (): Promise<number> {
  return Promise.resolve(1);
};
// Async arrow function with promise return (concise-body)
const numberOne = async (): Promise<number> => Promise.resolve(1);
// Async arrow function with promise return (block-body)
const numberOne = async (): Promise<number> => {
  return Promise.resolve(1);
};
// Async function declaration with async function return
async function numberOne(): Promise<number> {
  return getAsyncNumber(1);
};
async function getAsyncNumber(x: number): Promise<number> {
  return Promise.resolve(x);
};
// Async function expression with async function return
const numberOne = async function (): Promise<number> {
  return getAsyncNumber(1);
};
const getAsyncNumber = async function (x: number): Promise<number> {
  return Promise.resolve(x);
};
// Async arrow function with async function return (concise-body)
const numberOne = async (): Promise<number> => getAsyncNumber(1);
const getAsyncNumber = async function (x: number): Promise<number> {
  return Promise.resolve(x);
};
// Async arrow function with async function return (block-body)
const numberOne = async (): Promise<number> => {
  return getAsyncNumber(1);
};
const getAsyncNumber = async function (x: number): Promise<number> {
  return Promise.resolve(x);
};
// Async function declaration with await in Promise.all
async function testFunction(): Promise<void> {
  await Promise.all(
    [1, 2, 3].map(
      async value => Promise.resolve(value),
    ),
  );
};
async function* run() {};
async function* run() {
  await new Promise(resolve => setTimeout(resolve, 100));
  yield 'Hello';
  console.log('World');
};
function* test6() {
  yield* syncGenerator();
};
function* syncGenerator() {
  yield 1;
};
async function* asyncGenerator() {
  await Promise.resolve();
  yield 1;
};
async function* test1() {
  yield* asyncGenerator();
};
async function* asyncGenerator() {
  await Promise.resolve();
  yield 1;
};
async function* test1() {
  yield* asyncGenerator();
  yield* 2;
};
async function* test(source: AsyncIterable<any>) {
  yield* source;
};
async function* test(source: Iterable<any> & AsyncIterable<any>) {
  yield* source;
};
async function* test(source: Iterable<any> | AsyncIterable<any>) {
  yield* source;
};
type MyType = {
  [Symbol.iterator](): Iterator<any>;
  [Symbol.asyncIterator](): AsyncIterator<any>;
};
async function* test(source: MyType) {
  yield* source;
};
type MyType = {
  [Symbol.asyncIterator]: () => AsyncIterator<any>;
};
async function* test(source: MyType) {
  yield* source;
};
type MyFunctionType = () => AsyncIterator<any>;
type MyType = {
  [Symbol.asyncIterator]: MyFunctionType;
};
async function* test(source: MyType) {
  yield* source;
};
const foo: () => void = async function* () {};
async function* foo(): Promise<string> {
  return new Promise(res => res(`hello`));
};
async function* f() {
  let x!: Omit<
  {
    [Symbol.asyncIterator](): AsyncIterator<any>;
  },
  'z'
  >;
  yield* x;
};
async function* test1() {
  yield Promise.resolve(1);
};
function asyncFunction() {
  return Promise.resolve(1);
};
async function* test1() {
  yield asyncFunction();
};
declare const asyncFunction: () => Promise<void>;
async function* test1() {
  yield asyncFunction();
};
async function* test1() {
  yield new Promise(() => {});
};