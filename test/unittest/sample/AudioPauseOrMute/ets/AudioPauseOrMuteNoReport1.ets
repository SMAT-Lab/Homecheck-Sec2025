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
import { audio } from '@kit.AudioKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { Events } from './utils/Constants';

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

let myAVPlayer: media.AVPlayer;
let myAudioRenderer: audio.AudioRenderer;

function demoCallback() {
  media.createAVPlayer().then((player: media.AVPlayer) => {
    player.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
    console.info('createAVPlayer 222');
    player.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
  }).catch((error: BusinessError) => {
    console.info('createAVPlayer 333');
  });
  audio.createAudioRenderer(audioRendererOptions).then((audioRenderer: audio.AudioRenderer) => {
    if(!audioRenderer){
      console.error(`AudioRenderer Created: Error`);
    }else {
      audioRenderer.on('audioInterrupt', ()=>{
        console.error(`createAudioRenderer audioInterrupt1`);
      });
      console.info(`AudioRenderer Created: Success: SUCCESS`);
      setCallback2(audioRenderer);
    }
  });
}

function setCallback0() {
  myAVPlayer.on('audioOutputDeviceChangeWithInfo', ()=>{
    console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
  });
  myAudioRenderer.on('outputDeviceChangeWithInfo', ()=>{
    console.error(`createAudioRenderer outputDeviceChangeWithInfo`);
  });
}
function setCallback2(player2: audio.AudioRenderer) {
  player2.on('outputDeviceChangeWithInfo', ()=>{
    console.error(`AudioRenderer outputDeviceChangeWithInfo`);
  });
}

export class AudioPauseOrMuteNoReport1 {
  private myAVPlayer: media.AVPlayer | null = null;
  private myAudioRenderer: audio.AudioRenderer | null = null;

  demoCallback() {
    media.createAVPlayer().then((player) => {
      if (player) {
        player.on('audioInterrupt', ()=>{
          console.error(`createAVPlayer audioInterrupt1`);
        });
        player.on(Events.AUDIO_OUTPUT_DEVICE, () => {
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
        });
        console.info(`Succeded in creating AVPlayer`);
      } else {
        console.error(`Failed to creating AVPlayer, error message`);
      }
    });
    audio.createAudioRenderer(audioRendererOptions).then((audioRenderer) => {
      if (!audioRenderer) {
        console.error(`AudioRenderer Created: Error`);
      } else {
        audioRenderer.on('audioInterrupt', ()=>{
          console.error(`createAudioRenderer audioInterrupt1`);
        });
        console.info(`AudioRenderer Created: Success: SUCCESS`);
        this.setCallback2(audioRenderer);
      }
    });
  }
  setCallback0() {
    this.myAVPlayer?.on(Events.AUDIO_OUTPUT_DEVICE, ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
    this.myAudioRenderer?.on(Events.OUTPUT_DEVICE, ()=>{
      console.error(`createAudioRenderer outputDeviceChangeWithInfo`);
    });
  }
  setCallback2(player2: audio.AudioRenderer) {
    player2.on(Events.OUTPUT_DEVICE, ()=>{
      console.error(`AudioRenderer outputDeviceChangeWithInfo`);
    });
    demoCallback();
  }
}