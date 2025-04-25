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

//allowSingleExtends:false
interface ry {}

interface Bar extends ry {}

interface Baz {}

interface Foo {}
noFormat`interface Foo extends {}`
interface e {
  props: string;
}

type f = e

class g {}
interface h {
  props: string;
}

interface i extends h {}

class i {}
interface aa {
  props: string;
}

type bb = aa

const b = class bb {};
interface er extends Array<number> {}
interface we extends Array<number | {}> {}
type R = Record<string, unknown>;
interface r extends R {}
interface tg<T> extends Bar<T> {}
declare module as {
  type P = typeof p;
  export interface q extends P {}
}