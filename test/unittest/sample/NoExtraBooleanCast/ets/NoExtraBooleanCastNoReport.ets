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

var doo = bar || !!baz

var doo = bar && !!baz

var doo1 = bar || (baz && !!bat)

function doo1() { return (!!bar || baz); }

var doo = bar() ? (!!baz && bat) : (!!bat && qux)

for(!!(doo && bar);;) {}

for(;; !!(foo || bar)) {}

var doo2 = Boolean(bar) || baz;

var doo3 = bar || Boolean(baz);

var doo4 = Boolean(bar) || Boolean(baz);

function doo5() { return (Boolean(bar) || baz); }

var foo = bar() ? Boolean(baz) || bat : Boolean(bat)

for(Boolean(foo) || bar;;) {}

for(;; Boolean(foo) || bar) {}

if (new Boolean(foo) || bar) {}

if ((!!foo || bar) === baz) {}

if (!!foo ?? bar) {}