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

if (false) {
    // Compiler warns about unreachable code error
    console.log('hello');
}
if (false) {
    // @ts-expect-error: Unreachable code error
    console.log('hello');
}
if (false) {
    /*
    @ts-expect-error: Unreachable code error
    */
    console.log('hello');
}
// @ts-expect-error: TS1234 because the library definition is wrong
const a = doSomething('hello');

if (false) {
    // @ts-expect-error The rationale for this override is described in issue #1337 on GitLab
    console.log('hello');
}