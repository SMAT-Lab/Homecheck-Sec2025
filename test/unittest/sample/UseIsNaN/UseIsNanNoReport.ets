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

export class UseIsNanNoReportTest {

if (isNaN(foo)) {
    // ...
}

if (!isNaN(foo)) {
    // ...
}

if (Number.isNaN(foo)) {
    bar();
} else {
    switch (foo) {
        case 1:
            baz();
            break;
        // ...
    }
}

if (Number.isNaN(a)) {
    bar();
} else if (Number.isNaN(b)) {
    baz();
} // ...


function myIsNaN(val) {
    return typeof val === "number" && isNaN(val);
}

function indexOfNaN(arr) {
    for (var i = 0; i < arr.length; i++) {
        if (myIsNaN(arr[i])) {
            return i;
        }
    }
    return -1;
}

function lastIndexOfNaN(arr) {
    for (var i = arr.length - 1; i >= 0; i--) {
        if (myIsNaN(arr[i])) {
            return i;
        }
    }
    return -1;
}

var hasNaN = myArray.some(myIsNaN);

var hasNaN = indexOfNaN(myArray) >= 0;

var firstIndex = indexOfNaN(myArray);

var lastIndex = lastIndexOfNaN(myArray);

// ES2015
var hasNaN = myArray.some(Number.isNaN);

// ES2015
var firstIndex = myArray.findIndex(Number.isNaN);

// ES2016
var hasNaN = myArray.includes(NaN);
}