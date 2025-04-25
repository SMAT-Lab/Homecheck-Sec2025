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
 
// Unintentional assignment
let x: number;
if (x = 0) {
    const b = 1;
}

for (let i = 0; i = 10; i++) {

}

// Practical example that is similar to an error
const setHeight = (someNode: MyNode) => {
    do {
        someNode.height = "100px";
    } while (someNode = someNode.parentNode as MyNode);
}

// Practical example that wraps the assignment in parentheses
const set_height = (someNode: MyNode) => {
    do {
        someNode.height = "100px";
    } while ((someNode = someNode.parentNode as MyNode));
}

// Practical example that wraps the assignment and tests for 'null'
const heightSetter = (someNode: MyNode) => {
    do {
        someNode.height = "100px";
    } while ((someNode = someNode.parentNode as MyNode) !== null);
}

class MyNode{
    height: string | undefined
    parentNode: MyNode | undefined
}