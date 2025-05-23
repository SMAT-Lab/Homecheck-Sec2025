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
import { CustomPromise } from './utils/CustomPromise';

export class AudioPauseOrMuteNoReport4 {
  private playerInstancePromise?: CustomPromise<media.AVPlayer>;
  private static playerStaticPromise?: CustomPromise<media.AVPlayer>;

  constructor() {
    this.getPlayer();
  }

  private async getPlayer(): Promise<media.AVPlayer> {
    if(!this.playerInstancePromise){
      this.playerInstancePromise = new CustomPromise();
      media.createAVPlayer().then((player) => {
        player.on('audioInterrupt', ()=>{
          console.error(`createAVPlayer audioInterrupt1`);
        });
        this.playerInstancePromise?.resolve(player);
      }).catch((err: BusinessError) => {
        console.error(`avplayer create error, code is ${err?.code}, message is ${err?.message}`);
      });
    }
    return this.playerInstancePromise;
  }

  private async playInQueue(): Promise<void> {
    const player441 = await this.getPlayer();
    if(player441){
      player441?.on(Events.AUDIO_OUTPUT_DEVICE, ()=>{
        console.error(`createPlayer audioOutputDeviceChangeWithInfo`);
      });
    }
  }
  private static async getStaticPlayer(): Promise<media.AVPlayer> {
    if(!AudioPauseOrMuteNoReport4.playerStaticPromise){
      AudioPauseOrMuteNoReport4.playerStaticPromise = new CustomPromise();
      media.createAVPlayer().then((player) => {
        player.on('audioInterrupt', ()=>{
          console.error(`createAVPlayer audioInterrupt1`);
        });
        AudioPauseOrMuteNoReport4.playerStaticPromise?.resolve(player);
      }).catch((err: BusinessError) => {
        console.error(`avplayer create error, code is ${err?.code}, message is ${err?.message}`);
      });
    }
    return AudioPauseOrMuteNoReport4.playerStaticPromise;
  }
  private static async playStaticInQueue(): Promise<void> {
    const player442 = await AudioPauseOrMuteNoReport4.getStaticPlayer();
    if(player442){
      player442?.on(Events.AUDIO_OUTPUT_DEVICE, ()=>{
        console.error(`createPlayer audioOutputDeviceChangeWithInfo`);
      });
    }
  }
  public play(): void {
    this.playInQueue();
    AudioPauseOrMuteNoReport4.playStaticInQueue();
  }
}