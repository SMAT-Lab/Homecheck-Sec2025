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

// No return value should be expected (void)
function test(): void {
  return;
}

// A return value of type number
const fn = function (): number {
  return Number.MAX_VALUE;
};

// A return value of type string
const arrowFn = (): string => 'test';

class Test {
  // No return value should be expected (void)
  public method(): void {
    return;
  }
}

export { test, fn, arrowFn, Test };