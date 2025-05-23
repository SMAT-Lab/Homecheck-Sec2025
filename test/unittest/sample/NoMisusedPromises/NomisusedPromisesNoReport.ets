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

const promise = Promise.resolve('value');

// Always `await` the Promise in a conditional
if (await promise) {
    // Do something
}

const val = (await promise) ? 123 : 456;

while (await promise) {
    // Do something
}

// for-of puts `await` in outer context
for (const value of [1, 2, 3]) {
    await doSomething(value);
}

// Use an async IIFE wrapper
new Promise((resolve, reject) => {
    // combine with `void` keyword to tell `no-floating-promises` rule to ignore unhandled rejection
    void (async () => {
        await doSomething();
        resolve();
    })();
});

const getData1 = () => Promise.resolve({ key: 42 });

console.log({
      someData: 42,
      ...(await getData1()),
    });

