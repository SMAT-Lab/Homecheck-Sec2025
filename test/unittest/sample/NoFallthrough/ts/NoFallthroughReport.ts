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

/* eslint no-fallthrough: ["error", { "reportUnusedFallthroughComment": true }] */
switch(foo) { case 0: a();
  case 1: b() }
switch(foo) { case 0: a();
  default: b() }
switch(foo) { case 0: a(); default: b() }
switch(foo) { case 0: if (a) { break; } default: b() }
switch(foo) { case 0: try { throw 0; } catch (err) {} default: b() }
switch(foo) { case 0: while (a) { break; } default: b() }
switch(foo) { case 0: do{break ;}while (a) { } default: b() }
switch(foo) { case 0:

  default: b() }
switch(foo) { case 0: {} default: b() }
switch(foo) { case 0: a(); { /* falls through */ } default: b() }
switch(foo) { case 0: { /* falls through */ } a(); default: b() }
switch(foo) { case 0: if (a) { /* falls through */ } default: b() }
switch(foo) { case 0: { /* comment */ } default: b() }
switch(foo) { case 0:
// comment
  default: b() }
switch(foo) { case 0: a(); /* falling through */ default: b() }
switch(foo) { case 0: a();
/* no break */
  case 1: b(); }
switch(foo){
  case 1:

  case 2: doSomething();
}

