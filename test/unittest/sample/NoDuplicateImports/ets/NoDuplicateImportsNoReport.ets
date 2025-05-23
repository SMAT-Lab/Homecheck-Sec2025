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
//正例：https://eslint.nodejs.cn/docs/rules/no-duplicate-imports
/*eslint no-duplicate-imports: "error"*/
import { merge, find } from 'moduleo';
import something from 'another-moduleo';
import * as something from 'modulett';
import { merge } from 'modulett';
/*eslint no-duplicate-imports: ["error", { "includeExports": true }]*/
import { merge, find } from 'moduleu';
export { find };
import os1 from "os";
import fs1 from "fs";
import { merge2 } from "lodash-es2"
import _, { merge3 } from "lodash-es3"
import * as Foobar4 from "async4";
import "foo5"
import os6 from "os6";
export { something7 } from "os6";
import * as bar7 from "os7";
import { baz7 } from "os7";
import foo8, * as bar8 from "os8";
import { baz8 } from "os8"
import foo9, { bar9 } from "os9";
import * as baz9 from "os9";
//options: [{ includeExports: true }]
import os11 from "os11";
export { hello11 } from "hello11";
import os12 from "os12";
export * from "hello12"
import os13 from "os13";
export { hello13 as hi13 } from "hello13";
import os14 from "os14";
export default function(){};
import { merge15 } from "lodash-es15";
export { merge15 as lodashMerge15 }
export { something16 } from "os16";
export * as os16 from "os16";
import { foo } from './foo';
import bar from './bar';
//反例：https://eslint.nodejs.cn/docs/rules/no-duplicate-imports
/*eslint no-duplicate-imports: "error"*/
import { merge } from 'modulee';
import something from 'another-modulee';
import { find } from 'modulee';
import { foo } from './fooq';
import { bar } from './fooq';
/*eslint no-duplicate-imports: ["error", { "includeExports": true }]*/
import { mergew } from 'modulef';
export { find } from 'modulef';
import { mergew3 } from 'modulef';
import "fst1";
import "fst1";
import { merget2 } from "lodash-est2";
import { findt2 } from "lodash-est2";
import { merget3 } from "lodash-est3";
import _ from "lodash-est3";
import ost4 from "ost4";
import { somethingt4 } from "ost4";
import * as foobart4 from "ost4";
import * as modnst5 from "lodash-est5";
import { merget5 } from "lodash-est5";
import { bazt5 } from "lodash-est5";
//options: [{ includeExports: true }],
export { ost6 } from "ost6";
export { somethingt6 } from "ost6";
import ost7 from "ost7";
export { ost7 as foobart7 } from "ost7";
export { somethingt7 } from "ost7";
import ost8 from "ost8";
export { somethingt8 } from "ost8";
import * as modnst12 from "modt12";
export * as modnst12 from "modt12";
export * from "ost13";
export * from "ost13";
import "ost15";
export * from "ost15";
@Entry
@Component
struct NoDuplicateImportsNoReport {
  @State message: string = 'Hello World';
  build() {
    RelativeContainer() {
      Button().onClick(()=>{
      }).width(100)
    }
    .height('100%')
    .width('100%')
  }
}