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

import { window } from '@kit.ArkUI'
import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';

export default class demo extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    console.log(`onCreate, want: ${want.abilityName}`);
  }

  onWindowStageCreate(windowStage: window.WindowStage) {
    console.log('onWindowStageCreate');
  }

  onWindowStageDestroy() {
    console.log('onWindowStageDestroy');
  }

  onWindowStageWillDestroy(windowStage: window.WindowStage) {
    console.log('onWindowStageWillDestroy');
  }

  onForeground() {
    console.log('onForeground');
  }

  onBackground() {
    console.log('onBackground');
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam) {
    console.log(`onNewWant, want: ${want.abilityName}`);
    console.log(`onNewWant, launchParam: ${JSON.stringify(launchParam)}`);
  }

  onDestroy() {
    console.log(`onDestroy`);
  }
};