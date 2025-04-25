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

Boolean(bar, !!baz);

var foo = !!bar;

function foo() { return !!bar; }

var foo = bar() ? !!baz : !!bat

for(!!foo;;) {}

for(;; !!foo) {}

var foo = Boolean(bar);

function foo() { return Boolean(bar); }

var foo = bar() ? Boolean(baz) : Boolean(bat)

for(Boolean(foo);;) {}

for(;; Boolean(foo)) {}

if (new Boolean(foo)) {}