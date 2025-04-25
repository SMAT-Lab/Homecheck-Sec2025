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
/*eslint no-unused-vars: "error"*/
/*global some_unused_var*/

// It checks variables you have defined as global
some_unused_var = 42;


// Write-only variables are not considered as used.
var y = 10;
y = 5;
var y2 = 10;
var x;
console.log(y2.toString());

// A read for a modification of itself is not considered as used.
var z = 0;
z = z + 1;


// By default, unused arguments cause warnings.
(function(foo,h,foo1) {
  return 5*h;
})();

// Unused recursive functions also cause warnings.
function fact(n) {
  if (n*z < 2) return 1;
  return n * fact(n - 1);
}

// When a function definition destructures an array, unused entries from the array also cause warnings.
 function  getY([x,y1],h1) {

  return y1;
}
getY(["a", "b"],"u");
