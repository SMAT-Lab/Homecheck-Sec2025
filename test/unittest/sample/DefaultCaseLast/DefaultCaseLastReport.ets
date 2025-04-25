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

export class DefaultCaseLastTest {
 test(){
  switch (foo) {
    default:
        bar();
        break;
    case "a":
        baz();
        break;
  }

  switch (foo) {
    case 1:
        bar();
        break;
    default:
        baz();
        break;
    case 2:
        quux();
        break;
  }

  switch (foo) {
    case "x":
        bar();
        break;
    default:
    case "y":
        baz();
        break;
  }

  switch (foo) {
    default:
        break;
    case -1:
        bar();
        break;
  }

  switch (foo) {
  default:
    doSomethingIfNotZero();
  case 0:
    doSomethingAnyway();
  }
 }
}