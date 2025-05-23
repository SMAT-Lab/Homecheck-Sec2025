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
declare const someCondition1: boolean;
if (someCondition1) {
}

declare const someObjectBoolean1: boolean | Record<string, unknown>;
if (someObjectBoolean1 === true) {
}

declare const someStringBoolean1: boolean | string;
if (someStringBoolean1 === true) {
}

declare const varAny1: any;
varAny1 === true;

declare const varAny2: any;
varAny2 == false;

declare const varString: string;
varString === false;

declare const varString2: string;
varString2 === true;

declare const varObject: {};
varObject === true;

declare const varObject: {};
varObject == false;

declare const varNullOrUndefined: null | undefined;
varNullOrUndefined === false;

declare const varBooleanOrString: boolean | string;
varBooleanOrString === false;

declare const varBooleanOrString: boolean | string;
varBooleanOrString == true;

declare const varTrueOrStringOrUndefined: true | string | undefined;
varTrueOrStringOrUndefined == true;

const test: <T>(someCondition: T) => void = someCondition => {
  if (someCondition === true) {
  }
};

const test: <T>(someCondition: boolean | string) => void = someCondition => {
  if (someCondition === true) {
  }
};

declare const varBooleanOrUndefined: boolean | undefined;
varBooleanOrUndefined === true;//varBooleanOrUndefined;

declare const varBooleanOrUndefined: boolean | undefined;
varBooleanOrUndefined === false;//!(varBooleanOrUndefined ?? true);

const test: <T extends boolean | undefined>(
  someCondition: T,
) => void = someCondition => {
  if (someCondition === true) {
  }
};

const test: <T extends boolean | undefined>(
  someCondition: T,
) => void = someCondition => {
  if (someCondition === false) {
  }
};

'false' === true;

'true' === false;

const unconstrained: <T>(someCondition: T) => void = someCondition => {
  if (someCondition === true) {
  }
};

const extendsUnknown: <T extends unknown>(
  someCondition: T,
) => void = someCondition => {
  if (someCondition === true) {
  }
};

declare const varTrueOrUndefined: true | undefined;
if (varTrueOrUndefined === true) {//if (varTrueOrUndefined) {
}

declare const varFalseOrNull: false | null;
if (varFalseOrNull !== true) {//if (!varFalseOrNull) {

}

declare const varBooleanOrNull: boolean | null;
declare const otherBoolean: boolean;
if (varBooleanOrNull === false && otherBoolean) {//if (!(varBooleanOrNull ?? true) && otherBoolean) 
}
// ----
declare const varBooleanOrNull: boolean | null;
declare const otherBoolean: boolean;
if (!(varBooleanOrNull === false) || otherBoolean) {//if (!(varBooleanOrNull ?? true) || otherBoolean)
}

declare const varTrueOrFalseOrUndefined: true | false | undefined;
declare const otherBoolean: boolean;
if (varTrueOrFalseOrUndefined !== false && !otherBoolean) {//if ((varTrueOrFalseOrUndefined ?? true) && !otherBoolean) 
}

const test: <T extends boolean>(someCondition: T) => void = someCondition => {
  if (someCondition === true) {
  }
};

const test: <T extends boolean>(someCondition: T) => void = someCondition => {
  if (!(someCondition !== false)) {
  }
};

const test: <T extends boolean>(someCondition: T) => void = someCondition => {
  if (!((someCondition ?? true) !== false)) {
  }
};

function foo(): boolean { }