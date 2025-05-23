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

 function foo() {
  while (true) {
    if (true) {
      if (false) {

      }
    }
  }
}

function foo1() { 
  if (true) {
    
  } else {
    for (let index = 0; index < 3; index++) {
      console.log('${index}')
    }
  } 
}

function foo2() { 
  while (true) {
    if (true) {
      
    } 
  }
}

function foo3() {
  const foo = [1,2,3];
  for (let x of foo) {
    if (true) {
      
    }
  } 
}