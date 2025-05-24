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

    /*eslint default-case-last: "error"*/

  switch (foo) {
    case "a":
        baz();
        break;
    default:
        bar();
        break;
  }

  switch (foo) {
    case 1:
        bar();
        break;
    case 2:
        quux();
        break;
    default:
        baz();
        break;
  }

  switch (foo) {
    case "x":
        bar();
        break;
    case "y":
    default:
        baz();
        break;
  }

  switch (foo) {
    case -1:
        bar();
        break;
  }

  if (foo !== 0) {
    doSomethingIfNotZero();
    }
    doSomethingAnyway();
  }
}