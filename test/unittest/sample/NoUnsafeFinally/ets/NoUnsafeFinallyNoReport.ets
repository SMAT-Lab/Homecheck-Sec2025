/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
const fooTest13 = function() {
  try {
    return 1;
  } catch(err) {
    return 2;
  } finally {
    return 3;
  }
}
const fooTest14 = function() { try { return 1 } catch(err) { return 2 } finally { if(true) { return 3 } else { return 2 } } }

const fooTest15 = function() { try { return 1 } catch(err) { return 2 } finally { return 3 } }

const fooTest16 = function() { try { return 1 } catch(err) { return 2 } finally { return function(x) { return x } } }

const fooTest17 = function() { try { return 1 } catch(err) { return 2 } finally { return { x: function(c) { return c } } } }

const foo18 = function() { try { return 1 } catch(err) { return 2 } finally { throw new Error() } }

const fooTest19 = function() { try { fooTest19(); } finally { try { bar(); } finally { return; } } }

const fooTest20 = function() { label: try { return 0; } finally { break label; } return 1; }

const fooTest21 = function() {
  a: try {
    return 1;
  } catch(err) {
    return 2;
  } finally {
    break a;
  }
}

const fooTest22 = function() { while (true) try {} finally { break; } }

const fooTest23 = function() { while (true) try {} finally { continue; } }

const fooTest24 = function() { switch (true) { case true: try {} finally { break; } } }

const fooTest25 = function() { a: while (true) try {} finally { switch (true) { case true: break a; } } } // 该代码无法检测 需要特特殊处理

const fooTest26 = function() { a: while (true) try {} finally { switch (true) { case true: continue; } } } // 该代码无法检测 需要特特殊处理

const fooTest27 = function() { a: switch (true) { case true: try {} finally { switch (true) { case true: break a; } } } } // 该代码无法检测 需要特特殊处理