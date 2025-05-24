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

// A function with no return value (void)
export function test1(): void {
  return;
}

// A return value of type string
export const arrowFn1 = (): string => 'test';

// All arguments should be typed
export const arrowFn2 = (arg: string): string => `test ${arg}`;

export class Test {
  // A class method with no return value (void)
  public method(): void {
      return;
  }
}

// The function does not apply because it is not an exported function.
function test2() {
  return;
}

test2();