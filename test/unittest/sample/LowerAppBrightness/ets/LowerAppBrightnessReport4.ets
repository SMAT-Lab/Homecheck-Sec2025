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

import { UIAbility } from "@kit.AbilityKit";
import { window } from "@kit.ArkUI";
import { power } from "@kit.BasicServicesKit";

export default class EntryAbility extends UIAbility {
  onWindowStageCreate(windowStage: window.WindowStage) {
    // 判断当前是否为省电模式
    if (power.getPowerMode() == power.DevicePowerMode.MODE_POWER_SAVE) {
      let windowClass = windowStage.getMainWindowSync();
      try {
        // 未设置当前应用窗口亮度
        console.info('The application brightness has not been set.');
      } catch (exception) {
        console.error('Failed to set the brightness. Cause: ' + JSON.stringify(exception));
      }
    }
  }
}