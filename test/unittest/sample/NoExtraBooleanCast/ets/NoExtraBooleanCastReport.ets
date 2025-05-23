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

if (!!doo) {}

do {} while (!!doo);

while (!!doo) {}

!!doo ? zzz : ddd;

for (; !!doo;) {}

!!!doo;

Boolean(!!doo);

new Boolean(!!doo);

if (Boolean(doo)) {}

do {} while (Boolean(doo));

while (Boolean(doo)) {}

Boolean(foo) ? zzz : ddd;

for (; Boolean(doo);) {}

!Boolean(doo)

!Boolean(doo && zzz)

!Boolean(doo + bar)

!Boolean(+doo)

!Boolean(doo())

!Boolean(doo = bar)

!Boolean(...doo);

!Boolean(doo, bar());

!Boolean((doo, bar()));

!Boolean();

!(Boolean());

if (!Boolean()) { doo() }

while (!Boolean()) { doo() }

var foo = Boolean() ? agf() : baz()

if (Boolean()) { doo() }

while (Boolean()) { doo() }

Boolean(Boolean(doo))

Boolean(!!doo, bar);

function *soo() { yield!!a ? b : c }

function *aoo() { yield!! a ? b : c }

function *goo() { yield! !a ? b : c }

function *zoo() { yield !!a ? b : c }

function *voo() { yield(!!a) ? b : c }

function *loo() { yield/**/!!a ? b : c }

x=!!a ? b : c

void!Boolean()

void! Boolean()

typeof!Boolean()

(!Boolean())

+!Boolean()

void !Boolean()

void(!Boolean())

void/**/!Boolean()

!/**/!!doo

!!/**/!doo

!!!/**/doo

!!!doo/**/

if(!/**/!doo);

(!!/**/doo ? 1 : 2)

!/**/Boolean(doo)

!Boolean/**/(doo)

!Boolean(/**/doo)

!Boolean(doo/**/)

!Boolean(doo)/**/

if(Boolean/**/(doo));

(Boolean(foo/**/) ? 1 : 2)

/**/!Boolean()

!/**/Boolean()

!Boolean/**/()

!Boolean(/**/)

!Boolean/**/()

(!Boolean(/**/) ? 1 : 2)

if(/**/Boolean());

if(Boolean/**/());

if(Boolean(/**/));

if(Boolean()/**/);

(Boolean/**/() ? 1 : 2)

Boolean(!!(a, b))

Boolean(Boolean((a, b)))

Boolean((!!(a, b)))

Boolean((Boolean((a, b))))

Boolean(!(!(a, b)))

Boolean((!(!(a, b))))

Boolean(!!(a = b))

Boolean((!!(a = b)))

Boolean(Boolean(a = b))

Boolean(Boolean((a += b)))

Boolean(!!(a === b))

Boolean(!!((a !== b)))

Boolean(!!a.b)

Boolean(Boolean((a)))

Boolean((!!(a)))

new Boolean(!!(a, b))

new Boolean(Boolean((a, b)))

new Boolean((!!(a, b)))

new Boolean((Boolean((a, b))))

new Boolean(!(!(a, b)))

new Boolean((!(!(a, b))))

new Boolean(!!(a = b))

new Boolean((!!(a = b)))

new Boolean(Boolean(a = b))

new Boolean(Boolean((a += b)))

new Boolean(!!(a === b))

new Boolean(!!(a !== b))

new Boolean(!!a.b)

new Boolean(Boolean((a)))

new Boolean((!!(a)))

if (!!(a, b));

if (Boolean((a, b)));

if (!(!(a, b)));

if (!!(a = b));

if (Boolean(a = b));

if (!!(a > b));

if (Boolean(a === b));

if (!!f(a));

if (Boolean(f(a)));

if (!!(f(a)));

if ((!!f(a)));

if ((Boolean(f(a))));

if (!!a);

if (Boolean(a));

while (!!(a, b));

while (Boolean((a, b)));

while (!(!(a, b)));

while (!!(a = b));

while (Boolean(a = b));

while (!!(a > b));

while (Boolean(a === b));

while (!!f(a));

while (Boolean(f(a)));

while (!!(f(a)));

while ((!!f(a)));

while ((Boolean(f(a))));

while (!!a);

while (Boolean(a));

do {} while (!!(a, b));

do {} while (Boolean((a, b)));

do {} while (!(!(a, b)));

do {} while (!!(a = b));

do {} while (Boolean(a = b));

do {} while (!!(a > b));

do {} while (Boolean(a === b));

do {} while (!!f(a));

do {} while (Boolean(f(a)));

do {} while (!!(f(a)));

do {} while ((!!f(a)));

do {} while ((Boolean(f(a))));

do {} while (!!a);

do {} while (Boolean(a));

for (; !!(a, b););

for (; Boolean((a, b)););

for (; !(!(a, b)););

for (; !!(a = b););

for (; Boolean(a = b););

for (; !!(a > b););

for (; Boolean(a === b););

for (; !!f(a););

for (; Boolean(f(a)););

for (; !!(f(a)););

for (; (!!f(a)););

for (; (Boolean(f(a))););

for (; !!a;);

for (; Boolean(a););

!!(a, b) ? c : d

(!!(a, b)) ? c : d

Boolean((a, b)) ? c : d

!!(a = b) ? c : d

Boolean(a -= b) ? c : d

(Boolean((a *= b))) ? c : d

!!(a ? b : c) ? d : e

Boolean(a ? b : c) ? d : e

!!(a || b) ? c : d

Boolean(a && b) ? c : d

!!(a === b) ? c : d

Boolean(a < b) ? c : d

!!((a !== b)) ? c : d

Boolean((a >= b)) ? c : d

!!+a ? b : c

!!+(a) ? b : c

Boolean(!a) ? b : c

!!f(a) ? b : c

(!!f(a)) ? b : c

Boolean(a.b) ? c : d

!!a ? b : c

Boolean(a) ? b : c

!!!(a, b)

!Boolean((a, b))

!!!(a = b)

!!(!(a += b))

!(!!(a += b))

!Boolean(a -= b)

!Boolean((a -= b))

!(Boolean(a -= b))

!!!(a || b)

!Boolean(a || b)

!!!(a && b)

!Boolean(a && b)

!!!(a != b)

!!!(a === b)

var x = !Boolean(a > b)

!!!(a - b)

!!!(a ** b)

!Boolean(a ** b)

async function f() { !!!(await a) }

async function f() { !Boolean(await a) }

!!!!a

!!(!(!a))

!Boolean(!a)

!Boolean((!a))

!Boolean(!(a))

!(Boolean(!a))

!!!+a

!!!(+a)

!!(!+a)

!(!!+a)

!Boolean((-a))

!Boolean(-(a))

!!!(--a)

!Boolean(a++)

!!!f(a)

!!!(f(a))

!!!a

!Boolean(a)

if (!Boolean(a as any)) { }