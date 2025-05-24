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

export class AudioInterruptNoReport4 {
  private playerInstancePromise?: CustomPromise<media.AVPlayer>;
  private static playerStaticPromise?: CustomPromise<media.AVPlayer>;

  constructor() {
    this.getPlayer();
  }

  private async getPlayer(): Promise<media.AVPlayer> {
    if(!this.playerInstancePromise){
      this.playerInstancePromise = new CustomPromise();
      media.createAVPlayer().then((player) => {
        player.on('audioOutputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
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
      player441?.on(Events.AUDIO_INTERRUPT, ()=>{
        console.error(`createPlayer audioInterrupt1`);
      });
    }
  }
  private static async getStaticPlayer(): Promise<media.AVPlayer> {
    if(!AudioInterruptNoReport4.playerStaticPromise){
      AudioInterruptNoReport4.playerStaticPromise = new CustomPromise();
      media.createAVPlayer().then((player) => {
        player.on('audioOutputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
        });
        AudioInterruptNoReport4.playerStaticPromise?.resolve(player);
      }).catch((err: BusinessError) => {
        console.error(`avplayer create error, code is ${err?.code}, message is ${err?.message}`);
      });
    }
    return AudioInterruptNoReport4.playerStaticPromise;
  }
  private static async playStaticInQueue(): Promise<void> {
    const player442 = await AudioInterruptNoReport4.getStaticPlayer();
    if(player442){
      player442?.on(Events.AUDIO_INTERRUPT, ()=>{
        console.error(`createPlayer audioInterrupt1`);
      });
    }
  }
  public play(): void {
    this.playInQueue();
    AudioInterruptNoReport4.playStaticInQueue();
  }
}