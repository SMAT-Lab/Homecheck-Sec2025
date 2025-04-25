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

import { media } from '@kit.MediaKit';
import { Events } from './utils/Constants';
import { BusinessError } from '@kit.BasicServicesKit';

export class AudioInterruptNoReport5 {
  private priPlayer?: media.AVPlayer;

  async SpecialInvoke() {
    media.createAVPlayer((error: BusinessError, player) => {
      if(player) {
        player.on('audioOutputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
        });
        this.setPlayer(player);
        console.log('success');
      }
    });
  }

  public setPlayer(player: media.AVPlayer): void {
    this.priPlayer = player;
  }

  public getPlayer(): media.AVPlayer | undefined {
    return this.priPlayer;
  }

  async play() {
    let myPlayer = this.getPlayer();
    myPlayer?.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
  }
}