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
export const a = 12345;
export const b = 123.456;
export const c = 123e34;
export const d = 12300000000000000000000000;
export const e = 0x1FFFFFFFFFFFFF;
export const f = 9007199254740991;
export const g = 9007_1992547409_91;
@Entry
@Component
struct NoLossOfPrecisionReport {
  build() {
    Column() {
      Row() {
        Button().onClick(()=>{
        })
      }
    }
  }
}