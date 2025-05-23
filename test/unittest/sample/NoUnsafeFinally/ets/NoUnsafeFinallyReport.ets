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

var bar = () => { throw new Error(); }

const fooTest1 = function() {
  try {
    return 1;
  } catch(err) {
    return 2;
  } finally {
    console.log('hola!')
  }
}

const fooTest2 = function() { try { return 1 } catch(err) { return 2 } finally { console.log('hola!') } }

const fooTest3 = function() { try { return 1 } catch(err) { return 2 } finally { function a(x) { return x } } }

const fooTest4 = function() { try { return 1 } catch(err) { return 2 } finally { var a = function(x) { if(!x) { throw new Error() } } } }

const fooTest5 = function() { try { return 1 } catch(err) { return 2 } finally { var a = function(x) { while(true) { if(x) { break } else { continue } } } } }

const fooTest6 = function() { try { return 1 } catch(err) { return 2 } finally { var a = function(x) { label: while(true) { if(x) { break label; } else { continue } } } } }

const fooTest7 = function() { try {} finally { while (true) break; } }

const fooTest8 = function() { try {} finally { while (true) continue; } }

const fooTest9 = function() { try {} finally { switch (true) { case true: break; } } }

const fooTest10 = function() { try {} finally { do { break; } while (true) } }

const fooTest11 = function() { try { return 1; } catch(err) { return 2; } finally { var bar = () => { throw new Error(); }; } };

const fooTest12 = function() { try { return 1; } finally { class bar { constructor() {} static ehm() { return 'Hola!'; } } } }

