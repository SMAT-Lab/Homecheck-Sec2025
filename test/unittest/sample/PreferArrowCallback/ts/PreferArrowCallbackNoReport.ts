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
foo(function() { this.a; });
foo(function() { (() => this); });
someArray.map(function(item) { return this.doSomething(item); }, someObject);
foo(a => a);
foo(function*() {});
foo(function() { this; });
foo(function() { (() => this); });
foo(function() { this; }.bind(obj));
foo(function() { this; }.call(this));
foo(a => { (function() {}); });
var foo = function foo() {};
(function foo() {})();
foo(function bar() { bar; });
foo(function bar() { arguments; });
foo(function bar() { arguments; }.bind(this));
foo(function bar() { new.target; });
foo(function bar() { new.target; }.bind(this));
foo((function() {}).bind.bar);
foo((function () {
  ()=>{this}
}).bind(obj).bind(this));
foo(function bar(){
  this;
}.bind(this, somethingElse));
foo(function() { (function a() { this; }).bind(this)});