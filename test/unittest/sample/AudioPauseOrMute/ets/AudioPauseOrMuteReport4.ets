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
import { audio } from '@kit.AudioKit';

let audioStreamInfo1: audio.AudioStreamInfo = {
  samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_44100,
  channels: audio.AudioChannel.CHANNEL_1,
  sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
  encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW
}
let audioRendererInfo: audio.AudioRendererInfo = {
  usage: audio.StreamUsage.STREAM_USAGE_VOICE_COMMUNICATION,
  rendererFlags: 0
}
let audioRendererOptions: audio.AudioRendererOptions = {
  streamInfo: audioStreamInfo1,
  rendererInfo: audioRendererInfo
}

export class AudioPauseOrMuteReport4 {
  private playerArr: media.AVPlayer[] = [];
  private rendererArr: audio.AudioRenderer[] = [];

  async SpecialInvoke() {
    media.createAVPlayer((error: BusinessError, player) => {
      if (player) {
        player.on('audioInterrupt', ()=>{
          console.error(`createAVPlayer audioInterrupt1`);
        });
        let b = player;
        this.playerArr[0] = b;
        console.log('success');
        this.playerArr[0].on(Events.AUDIO_INTERRUPT, ()=>{
          console.error(`createAVPlayer audioInterrupt1 ${error}`);
        });
      }
    });
    audio.createAudioRenderer(audioRendererOptions).then((audioRenderer: audio.AudioRenderer) => {
      if(!audioRenderer){
        console.error(`AudioRenderer Created: Error`);
      }else {
        audioRenderer.on('audioInterrupt', ()=>{
          console.error(`createAudioRenderer audioInterrupt1`);
        });
        console.info(`AudioRenderer Created: Success: SUCCESS`);
        let temp = audioRenderer;
        this.rendererArr[0] = temp;
        console.log('success');
        this.rendererArr[0].on(Events.AUDIO_INTERRUPT, () => {
          console.error(`createAudioRenderer audioInterrupt1`);
        });
      }
    });
  }
}