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

export class UseIsNaNReportTest {

if (foo == NaN) {
    // ...
}

if (foo != NaN) {
    // ...
}

if (foo == Number.NaN) {
    // ...
}

if (foo != Number.NaN) {
    // ...
}

switch (foo) {
    case NaN:
        bar();
        break;
    case 1:
        baz();
        break;
    // ...
}

switch (NaN) {
    case a:
        bar();
        break;
    case b:
        baz();
        break;
    // ...
}

switch (foo) {
    case Number.NaN:
        bar();
        break;
    case 1:
        baz();
        break;
    // ...
}

switch (Number.NaN) {
    case a:
        bar();
        break;
    case b:
        baz();
        break;
    // ...
}

var hasNaN = myArray.indexOf(NaN) >= 0;

var firstIndex = myArray.indexOf(NaN);

var lastIndex = myArray.lastIndexOf(NaN);

var indexWithSequenceExpression = myArray.indexOf((doStuff(), NaN));

var firstIndexFromSecondElement = myArray.indexOf(NaN, 1);

var lastIndexFromSecondElement = myArray.lastIndexOf(NaN, 1);
}