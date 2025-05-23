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
let audioStreamInfo2: audio.AudioStreamInfo = {
  samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_44100,
  channels: audio.AudioChannel.CHANNEL_2,
  sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
  encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW
}
let audioCapturerInfo: audio.AudioCapturerInfo = {
  source: audio.SourceType.SOURCE_TYPE_MIC,
  capturerFlags: 0
}
let audioCapturerOptions: audio.AudioCapturerOptions = {
  streamInfo: audioStreamInfo2,
  capturerInfo: audioCapturerInfo
}

let myAVPlayer: media.AVPlayer;
let myAudioRenderer: audio.AudioRenderer;
let myAudioCapturer: audio.AudioCapturer;

function demoCallback() {
  media.createAVPlayer((error: BusinessError, player: media.AVPlayer) => {
    if (player !== null) {
      player.on('audioOutputDeviceChangeWithInfo', ()=>{
        console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
      });
      player.on('audioInterrupt', ()=>{
        console.error(`createAVPlayer audioInterrupt1`);
      });
      console.info(`Succeded in creating AVPlayer`);
    } else {
      console.error(`Failed to creating AVPlayer, error message${error.message}`);
    }
  });
  audio.createAudioRenderer(audioRendererOptions, (err, audioRenderer: audio.AudioRenderer) => {
    if(err){
      console.error(`AudioRenderer Created: Error: ${err}`);
    }else {
      console.info(`AudioRenderer Created: Success: SUCCESS`);
      setCallback2(audioRenderer);
      audioRenderer.on('outputDeviceChangeWithInfo', ()=>{
        console.error(`createAVPlayer outputDeviceChangeWithInfo`);
      });
    }
  });

  let b = 10;

  audio.createAudioCapturer(audioCapturerOptions, (err, audioCapturer: audio.AudioCapturer) => {
    if(err){
      console.error(`AudioCapturer Created: Error: ${err}`);
    }else {
      console.info(`AudioCapturer Created: Success: SUCCESS`);
      myAudioCapturer = audioCapturer;
      setCallback0();
    }
  });
  media.createAVPlayer((error: BusinessError, player: media.AVPlayer) => {
    if (player !== null) {
      player.on('audioOutputDeviceChangeWithInfo', ()=>{
        console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
      });
      myAVPlayer = player;
      myAVPlayer.on('audioInterrupt', ()=>{
        console.error(`createAVPlayer audioInterrupt1`);
      });
      console.info(`Succeded in creating AVPlayer`);
    } else {
      console.error(`Failed to creating AVPlayer, error message${error.message}`);
    }
  });
}

function setCallback0() {
  myAVPlayer.on('audioInterrupt', ()=>{
    console.error(`createAVPlayer audioInterrupt1`);
  });
  myAudioRenderer.on('audioInterrupt', ()=>{
    console.error(`createAudioRenderer audioInterrupt1`);
  });
  myAudioCapturer.on('audioInterrupt', ()=>{
    console.error(`createAudioCapturer audioInterrupt1`);
  });
}
function setCallback2(player2: audio.AudioRenderer) {
  player2.on('audioInterrupt', ()=>{
    console.error(`AudioRenderer audioInterrupt1`);
  });
}

export class AudioInterruptNoReport0 {
  private myAVPlayer: media.AVPlayer | null = null;
  private myAudioRenderer: audio.AudioRenderer | null = null;
  private myAudioCapturer: audio.AudioCapturer | null = null;
  demoCallback() {
    media.createAVPlayer((error: BusinessError, player) => {
      if (player) {
        player.on('audioOutputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
        });
        player.on(Events.AUDIO_INTERRUPT, () => {
          console.error(`createAVPlayer audioInterrupt1`);
        });
        console.info(`Succeded in creating AVPlayer`);
      } else {
        console.error(`Failed to creating AVPlayer, error message${error.message}`);
      }
    });
    audio.createAudioRenderer(audioRendererOptions, (err, audioRenderer) => {
      if (err) {
        console.error(`AudioRenderer Created: Error: ${err}`);
      } else {
        console.info(`AudioRenderer Created: Success: SUCCESS`);
        this.setCallback2(audioRenderer);
        audioRenderer.on('outputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer outputDeviceChangeWithInfo`);
        });
      }
    });
    audio.createAudioCapturer(audioCapturerOptions, (err, audioCapturer) => {
      if (err) {
        console.error(`AudioCapturer Created: Error: ${err}`);
      } else {
        console.info(`AudioCapturer Created: Success: SUCCESS`);
        this.myAudioCapturer = audioCapturer;
        this.myAudioCapturer.on(Events.AUDIO_INTERRUPT, () => {
          console.error(`createAudioCapturer audioInterrupt1`);
        });
      }
    });
    media.createAVPlayer((error: BusinessError, player) => {
      if (player) {
        player.on('audioOutputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
        });
        this.myAVPlayer = player;
        this.setCallback0();
        console.info(`Succeded in creating AVPlayer`);
      } else {
        console.error(`Failed to creating AVPlayer, error message${error.message}`);
      }
    });
  }
  setCallback0() {
    this.myAVPlayer?.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
    this.myAudioRenderer?.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAudioRenderer audioInterrupt1`);
    });
    this.myAudioCapturer?.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAudioCapturer audioInterrupt1`);
    });
  }
  setCallback2(player2: audio.AudioRenderer) {
    player2.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`AudioRenderer audioInterrupt1`);
    });
    demoCallback();
  }
}