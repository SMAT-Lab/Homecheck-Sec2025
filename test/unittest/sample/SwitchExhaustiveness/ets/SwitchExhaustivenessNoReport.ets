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
type Day =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

declare const day1: Day;

let result = '0';

switch (day1) {
  case 'Monday':
    result = '1';
    break;
  case 'Tuesday':
    result = '2';
    break;
  case 'Wednesday':
    result = '3';
    break;
  case 'Thursday':
    result = '4';
    break;
  case 'Friday':
    result = '5';
    break;
  case 'Saturday':
    result = '6';
    break;
  case 'Sunday':
    result = '7';
    break;
}

declare const day2: Day;

result = '0';

switch (day2) {
  case 'Monday':
    result = '1';
    break;
  default:
    result = '42';
}
console.info(result);

enum Fruit {
  apple = 'apple',
  banana = 'banana',
  cherry = 'cherry'
}

declare const fruit2: Fruit;

switch (fruit2) {
  case Fruit.Apple:
    console.log('an apple');
    break;

  default:
    console.log('a fruit');
    break;
}

//allowDefaultCaseForExhaustiveSwitch:true
enum Animal {
  dog = 'dog',
  cat = 'cat',
  pig = 'pig'
}

declare const animal: Animal;

switch (animal) {
  case Animal.dog:
    console.log('a dog');
    break;

  case Animal.cat:
    console.log('a cat');
    break;

  case Animal.pig:
    console.log('a pig');
    break;

  default:
    console.log('animal');
    break;
}

//requireDefaultForNonUnion:false
const value: number = Math.floor(Math.random() * 3);

switch (value) {
  case 0:
    return 0;
  case 1:
    return 1;
}