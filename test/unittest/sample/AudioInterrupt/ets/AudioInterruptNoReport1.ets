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
import { audio, audioHaptic } from '@kit.AudioKit';
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

let id = 0;
let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
let myAVPlayer: media.AVPlayer;
let myAudioRenderer: audio.AudioRenderer;
let myAudioCapturer: audio.AudioCapturer;
let myAudioHapticPlayer: audioHaptic.AudioHapticPlayer;

function demoCallback() {
  media.createAVPlayer().then((player: media.AVPlayer) => {
    player.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
    console.info('createAVPlayer 222');
    player.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
  }).catch((error: BusinessError) => {
    console.info('createAVPlayer 333');
  });
  audio.createAudioRenderer(audioRendererOptions).then((audioRenderer: audio.AudioRenderer) => {
    if(!audioRenderer){
      console.error(`AudioRenderer Created: Error`);
    }else {
      console.info(`AudioRenderer Created: Success: SUCCESS`);
      setCallback2(audioRenderer);
      audioRenderer.on('outputDeviceChangeWithInfo', ()=>{
        console.error(`createAVPlayer outputDeviceChangeWithInfo`);
      });
    }
  });
  audio.createAudioCapturer(audioCapturerOptions).then((audioCapturer: audio.AudioCapturer) => {
    if(!audioCapturer){
      console.error(`AudioCapturer Created: Error`);
    }else {
      console.info(`AudioCapturer Created: Success: SUCCESS`);
      myAudioCapturer = audioCapturer;
      setCallback0();
    }
  });
  audioHapticManagerInstance.createPlayer(id, options).then((audioHapticPlayer: audioHaptic.AudioHapticPlayer) => {
    console.info(`Create the audio haptic player successfully.`);
    myAudioHapticPlayer = audioHapticPlayer;
    myAudioHapticPlayer.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
  }).catch((err: BusinessError) => {
    console.error(`Failed to creating the audio haptic player. ${err}`);
  })
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
  myAudioHapticPlayer.on('audioInterrupt', ()=>{
    console.error(`createPlayer audioInterrupt1`);
  });
}
function setCallback2(player2: audio.AudioRenderer) {
  player2.on('audioInterrupt', ()=>{
    console.error(`AudioRenderer audioInterrupt1`);
  });
}

export class AudioInterruptNoReport1 {
  private myAVPlayer: media.AVPlayer | null = null;
  private myAudioRenderer: audio.AudioRenderer | null = null;
  private myAudioCapturer: audio.AudioCapturer | null = null;
  private myAudioHapticPlayer: audioHaptic.AudioHapticPlayer | null = null;
  demoCallback() {
    media.createAVPlayer().then((player) => {
      if (player) {
        player.on('audioOutputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
        });
        player.on(Events.AUDIO_INTERRUPT, () => {
          console.error(`createAVPlayer audioInterrupt1`);
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
        console.info(`AudioRenderer Created: Success: SUCCESS`);
        this.setCallback2(audioRenderer);
        audioRenderer.on('outputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer outputDeviceChangeWithInfo`);
        });
      }
    });
    audio.createAudioCapturer(audioCapturerOptions).then((audioCapturer) => {
      if (!audioCapturer) {
        console.error(`AudioCapturer Created: Error`);
      } else {
        console.info(`AudioCapturer Created: Success: SUCCESS`);
        this.myAudioCapturer = audioCapturer;
        this.setCallback0();
      }
    });
    let id = 0;
    let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
    let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
    audioHapticManagerInstance.createPlayer(id, options).then((audioHapticPlayer) => {
      console.info(`Create the audio haptic player successfully.`);
      myAudioHapticPlayer = audioHapticPlayer;
      myAudioHapticPlayer.on(Events.AUDIO_INTERRUPT, ()=>{
        console.error(`createAVPlayer audioInterrupt1`);
      });
    }).catch((err: BusinessError) => {
      console.error(`Failed to creating the audio haptic player. ${err}`);
    })
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
    this.myAudioHapticPlayer?.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createPlayer audioInterrupt1`);
    });
  }
  setCallback2(player2: audio.AudioRenderer) {
    player2.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`AudioRenderer audioInterrupt1`);
    });
    demoCallback();
  }
}