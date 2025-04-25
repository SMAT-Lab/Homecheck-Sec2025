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
 
/*eslint max-lines-per-function: ["error", 2]*/
function foo() {
    let x = 0;
}

/*eslint max-lines-per-function: ["error", 3]*/
function foo1() {
    // a comment
    let x = 0;
}

/*eslint max-lines-per-function: ["error", 4]*/
function foo2() {
    // a comment followed by a blank line

    let x = 0;
}

/*eslint max-lines-per-function: ["error", {"max": 2, "skipBlankLines": true}]*/
function foo3() {

    let x = 0;
}

/*eslint max-lines-per-function: ["error", {"max": 2, "skipComments": true}]*/
function foo4() {
    // a comment
    let x = 0;
}

/*eslint max-lines-per-function: ["error", {"max": 2, "IIFEs": true}]*/
((() => {
    let x = 0;
})());

(() => {
    let x = 0;
})();

