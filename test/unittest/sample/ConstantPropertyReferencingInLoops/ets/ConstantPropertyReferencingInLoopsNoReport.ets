/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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

class Time {
  static start: number = 0;
  static info: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}
function getNum(num: number): number {
  /* Year has (12 * 29 =) 348 days at least */
  let total: number = 348;
  const info = Time.info[num- Time.start];
  for (let index: number = 0x8000; index > 0x8; index >>= 1) {
    if ((info & index) != 0) {
      total++;
    }
  }
  return total;
}