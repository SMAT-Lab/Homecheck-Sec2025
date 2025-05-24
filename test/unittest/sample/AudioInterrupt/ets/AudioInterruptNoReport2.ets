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
let myAudioHapticPlayer: audioHaptic.AudioHapticPlayer;

async function AwaitPromise1() {
  let player = await media.createAVPlayer();
  player.on('audioOutputDeviceChangeWithInfo', ()=>{
    console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
  });
  player.on('audioInterrupt', () => {
    console.error(`createAVPlayer audioInterrupt2`);
  });
}
async function AwaitPromise2() {
  let audioRenderer = await audio.createAudioRenderer(audioRendererOptions);
  setCallback2(audioRenderer);
  audioRenderer.on('outputDeviceChangeWithInfo', ()=>{
    console.error(`createAVPlayer outputDeviceChangeWithInfo`);
  });
}
async function AwaitPromise3() {
  let audioCapturer = await audio.createAudioCapturer(audioCapturerOptions);
  myAudioCapturer = audioCapturer;
  setCallback0();
}

let id = 0;
let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
async function AwaitPromise4() {
  let audioHapticPlayer = await audioHapticManagerInstance.createPlayer(id, options);
  myAudioHapticPlayer = audioHapticPlayer;
  myAudioHapticPlayer.on('audioInterrupt', ()=>{
    console.error(`createAVPlayer audioInterrupt2`);
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
  myAudioHapticPlayer.on('audioInterrupt', ()=>{
    console.error(`createPlayer audioInterrupt1`);
  });
}
function setCallback2(player2: audio.AudioRenderer) {
  player2.on('audioInterrupt', ()=>{
    console.error(`AudioRenderer audioInterrupt1`);
  });
}

export class AudioInterruptNoReport2 {
  private myAVPlayer: media.AVPlayer | null = null;
  private myAudioRenderer: audio.AudioRenderer | null = null;
  private myAudioCapturer: audio.AudioCapturer | null = null;
  private myAudioHapticPlayer: audioHaptic.AudioHapticPlayer | null = null;
  private static audioMedia: media.AVPlayer | null = null;
  async demoCallback0() {
    let player = await media.createAVPlayer();
    player.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
    player.on(Events.AUDIO_INTERRUPT, () => {
      console.error(`createAVPlayer audioInterrupt2`);
    });
  }
  async demoCallback1() {
    let audioRenderer = await audio.createAudioRenderer(audioRendererOptions);
    setCallback2(audioRenderer);
    audioRenderer.on('outputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer outputDeviceChangeWithInfo`);
    });
  }
  async demoCallback2() {
    let audioCapturer = await audio.createAudioCapturer(audioCapturerOptions);
    this.myAudioCapturer = audioCapturer;
    setCallback0();
  }
  async demoCallback3() {
    let id = 0;
    let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
    let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
    let audioHapticPlayer = await audioHapticManagerInstance.createPlayer(id, options);
    myAudioHapticPlayer = audioHapticPlayer;
    myAudioHapticPlayer.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAVPlayer audioInterrupt2`);
    });
  }
  async demoCallback4(){
    this.myAVPlayer = await media.createAVPlayer();
    this.myAVPlayer.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
  }
  async demoCallback5(): Promise<media.AVPlayer>{
    AudioInterruptNoReport2.audioMedia = await media.createAVPlayer();
    AudioInterruptNoReport2.audioMedia.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
    return AudioInterruptNoReport2.audioMedia;
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

    AudioInterruptNoReport2.audioMedia?.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
  }
  setCallback2(player2: audio.AudioRenderer) {
    player2.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`AudioRenderer audioInterrupt1`);
    });
    AwaitPromise1();
    AwaitPromise2();
    AwaitPromise3();
    AwaitPromise4();
  }
}