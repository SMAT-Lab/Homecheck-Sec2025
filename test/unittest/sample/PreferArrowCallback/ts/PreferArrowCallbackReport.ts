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
test(
    function ()
    { }
  );
foo(function() {});//{ allowNamedFunctions: true }
foo(function bar() {});//{ allowNamedFunctions: false }
foo(function bar() {});//options: [{ allowNamedFunctions: true }] },
foo(function bar() {})
qux(function( /* a */ foo /* b */ , /* c */ bar /* d */ , /* e */ baz /* f */ ) { return foo; });//
qux(async function (foo = 1, bar = 2, baz = 3) { return baz; });//
qux(function(foo, bar, baz) { return foo * 2; });//
qux(function(foo = 1, [bar = 2] = [], {qux: baz = 3} = {foo: 'bar'}) { return foo + bar; });//
foo(function bar(a) { a; });
foo(function(a) { a; });
qux(function( /* no params */ ) { });
test(
    function (
        ...args
    ) /* Lorem ipsum
      dolor sit amet. */ {
      return args;
    }
  );//
foo(function bar() {});
foo(function() {});
foo?.(function() {});
foo(nativeCb || function() {});
foo(bar ? function() {} : function() {});
foo(function() { (function() { this; }); });
foo(bar || function() { this; }.bind(this));
foo(function() { this; }.bind(this));
foo(function() { (() => this); }.bind(this));
qux(function(foo, bar, baz) { return foo * bar; }.bind(this));
qux(function(foo, bar, baz) { return foo * this.qux; }.bind(this));
qux(async function (foo = 1, bar = 2, baz = 3) { return this; }.bind(this));
foo(function() {}.bind(this, somethingElse));
foo(function() {}.bind(this).bind(obj));
foo?.(function() { return this; }.bind(this));
foo(function() { return this; }?.bind(this));