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

if (!!foo || bar) {}

if (!!foo && bar) {}

if ((!!foo || bar) && bat) {}

if (foo && !!bar) {}

do {} while (!!foo || bar)

while (!!foo || bar) {}

!!foo && bat ? bar : baz

for (; !!foo || bar;) {}

!!!foo || bar

Boolean(!!foo || bar)

new Boolean(!!foo || bar)

if (Boolean(foo) || bar) {}

do {} while (Boolean(foo) || bar)

while (Boolean(foo) || bar) {}

Boolean(foo) || bat ? bar : baz

for (; Boolean(foo) || bar;) {}

!Boolean(foo) || bar

!Boolean(foo && bar) || bat

!Boolean(foo + bar) || bat

!Boolean(+foo)  || bar

!Boolean(foo()) || bar

!Boolean(foo() || bar)

!Boolean(foo = bar) || bat

!Boolean(...foo) || bar;

!Boolean(foo, bar()) || bar;

!Boolean((foo, bar()) || bat);

!Boolean() || bar;

!(Boolean()) || bar;

if (!Boolean() || bar) { foo() }

while (!Boolean() || bar) { foo() }

var foo = Boolean() || bar ? bar() : baz()

if (Boolean() || bar) { foo() }

while (Boolean() || bar) { foo() }
// Adjacent tokens tests
function *foo() { yield(!!a || d) ? b : c }

function *foo() { yield(!! a || d) ? b : c }

function *foo() { yield(! !a || d) ? b : c }

function *foo() { yield (!!a || d) ? b : c }

function *foo() { yield/**/(!!a || d) ? b : c }

x=!!a || d ? b : c

void(!Boolean() || bar)

void(! Boolean() || bar)

typeof(!Boolean() || bar)

(!Boolean() || bar)

void/**/(!Boolean() || bar)

!/**/(!!foo || bar)

!!/**/!foo || bar

!!!/**/foo || bar

!(!!foo || bar)/**/

if(!/**/!foo || bar);

(!!/**/foo || bar ? 1 : 2)

!/**/(Boolean(foo) || bar)

!Boolean/**/(foo) || bar

!Boolean(/**/foo) || bar

!Boolean(foo/**/) || bar

!(Boolean(foo)|| bar)/**/

if(Boolean/**/(foo) || bar);

(Boolean(foo/**/)|| bar ? 1 : 2)

/**/!Boolean()|| bar

!/**/Boolean()|| bar

!Boolean/**/()|| bar

!Boolean(/**/)|| bar

(!Boolean()|| bar)/**/

if(!/**/Boolean()|| bar);

(!Boolean(/**/) || bar ? 1 : 2)

if(/**/Boolean()|| bar);

if(Boolean/**/()|| bar);

if(Boolean(/**/)|| bar);

if(Boolean()|| bar/**/);

(Boolean/**/()|| bar ? 1 : 2)

if (a && !!(b ? c : d)){}

function *foo() { yield!!a || d ? b : c }

if (!!(a, b) || !!(c, d)) {}

if (Boolean((a, b)) || Boolean((c, d))) {}

if (!!(a, b) && !!(c, d)) {}

if (Boolean((a, b)) && Boolean((c, d))) {}










