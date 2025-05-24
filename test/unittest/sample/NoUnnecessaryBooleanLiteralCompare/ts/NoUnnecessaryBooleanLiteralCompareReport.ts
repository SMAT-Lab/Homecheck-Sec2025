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
declare const someCondition: boolean;
if (someCondition === true) {
}

declare const varBoolean: boolean;
if (false !== varBoolean) {
}

declare const varBoolean: boolean;
if (true !== varBoolean) {
}

declare const varBoolean: boolean;
if (varBoolean !== false) {
}

declare const varBoolean: boolean;
if (!(varBoolean !== false)) {
}

declare const varBoolean: boolean;
if (!(varBoolean === false)) {
}

true === true;//true;

false !== true;//!false;

declare const x;
if (x instanceof Error === false) {
}

declare const x;
if (x instanceof Error === (false)) {
}

declare const x;
if ((false) === x instanceof Error) {
}

declare const varBoolean: boolean;
if (!((varBoolean ?? false) !== false)) {
}

declare const varBoolean: boolean;
if (!((varBoolean ?? false) === false)) {
}

declare const varBoolean: boolean;
if (!((varBoolean ?? true) !== false)) {
}

declare const x;
if ((x instanceof Error) === false) {
}

declare const x;
if (false === (x instanceof Error)) {
}
declare const x;
if (typeof x === 'string' === false) {
}
declare const varBoolean: boolean;
if (!(varBoolean instanceof Event == false)) {
}//---------------

declare const varBoolean: boolean;
if (varBoolean instanceof Event == false) {
}

declare const varTrue: true;
if (varTrue !== true) {
}