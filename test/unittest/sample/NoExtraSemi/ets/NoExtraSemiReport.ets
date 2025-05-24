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

var x = 5;;

function foo() {
  // code
};

for(;;);;

while(0);;

do;while(0);;

for(a in b);;

for(a of b);;

if(true);;

if(true){} else;;

if(true){;} else {;}

foo:;;

with(foo);;

with(foo){;}

class A { ; }

class B { /*a*/; }

class Cc { ; a() {} }

class Aa { a() {}; }

class Aaa { a() {}; b() {} }

class Aaaa {; a() {}; b() {}; }

class Bb { a() {}; get b() {} }

class Foo {
  public foo: number = 0;;
}

class Fo {
  public foo: number = 0;
}

class Fol {
  public foo: number = 0;; public bar: number = 1;;
  public baz: number = 1;;
}

class Fdd {
  public foo: number = 0; public bar: number = 1;
  public baz: number = 1;
}

class Fii {
  abstract foo: number;; abstract bar: number;;
  abstract baz: number;;
}

class Fhh {
  abstract foo: number; abstract bar: number;
  abstract baz: number;
}

class Fsds {
  abstract foo();; abstract bar();;
  abstract baz();;
  abstract foo(): void;; abstract bar(): void;;
  abstract baz(): void;;
}

class C {
  field;;

  method() {
    // code
  };;;

  static {
    // code
  };
};