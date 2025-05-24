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

throw new Error();

throw new Error('error');

const e = new Error('error');
throw e;

try {
  throw new Error('error');
} catch (e) {
  throw e;
}

const err = new Error();
throw err;

function err() {
  return new Error();
}
throw err();

const foo = {
  bar: new Error(),
};
throw foo.bar;

class CustomError extends Error {
  // ...
}
throw new CustomError();