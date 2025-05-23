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

let myAudioRenderer333: audio.AudioRenderer;
let myAudioHapticPlayer333: audioHaptic.AudioHapticPlayer;

async function initAVPlayer(): Promise<media.AVPlayer> {
  // warning line
  let player333 = await media.createAVPlayer();
  player333.on('audioOutputDeviceChangeWithInfo', ()=>{
    console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
  });
  return player333;
}
async function initAudioRenderer(): Promise<audio.AudioRenderer> {
  // warning line
  myAudioRenderer333 = await audio.createAudioRenderer(audioRendererOptions);
  return myAudioRenderer333;
}
async function initAudioCapturer(): Promise<audio.AudioCapturer> {
  // warning line
  let audioCapturer333 = await audio.createAudioCapturer(audioCapturerOptions);
  return audioCapturer333;
}

let id = 0;
let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
async function initPlayer(): Promise<audioHaptic.AudioHapticPlayer>  {
  // warning line
  myAudioHapticPlayer333 = await audioHapticManagerInstance.createPlayer(id, options);
  return myAudioHapticPlayer333;
}
async function playAll() {
  let play1 = await initAVPlayer();
  play1.on('stateChange', ()=>{
    console.error(`createAVPlayer audioInterrupt`);
  });
  let play2 = await initAudioRenderer();
  play2.on('outputDeviceChangeWithInfo', ()=>{
    console.error(`createAVPlayer outputDeviceChangeWithInfo`);
  });
  play2.on('stateChange', ()=>{
    console.error(`createAudioRenderer audioInterrupt`);
  });
  let play3 = await initAudioCapturer();
  play3.on('stateChange', ()=>{
    console.error(`createAudioCapturer audioInterrupt`);
  });
  let play4 = await initPlayer();
}

export class AudioInterruptReport3 {
  private myAudioRenderer: audio.AudioRenderer | null = null;
  private static myAudioCapturer: audio.AudioCapturer | null = null;
  private myAudioHapticPlayer: audioHaptic.AudioHapticPlayer | null = null;
  async initAVPlayer(): Promise<media.AVPlayer> {
    // warning line
    let player333 = await media.createAVPlayer();
    return player333;
  }
  async initAudioRenderer(): Promise<audio.AudioRenderer> {
    // warning line
    this.myAudioRenderer = await audio.createAudioRenderer(audioRendererOptions);
    this.myAudioRenderer.on('outputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer outputDeviceChangeWithInfo`);
    });
    return this.myAudioRenderer;
  }
  async initAudioCapturer(): Promise<audio.AudioCapturer> {
    // warning line
    AudioInterruptReport3.myAudioCapturer = await audio.createAudioCapturer(audioCapturerOptions);
    return AudioInterruptReport3.myAudioCapturer;
  }
  async initPlayer(): Promise<audioHaptic.AudioHapticPlayer>  {
    let id = 0;
    let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
    let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
    // warning line
    let audioHapticPlayer333 = await audioHapticManagerInstance.createPlayer(id, options);
    this.myAudioHapticPlayer = audioHapticPlayer333;
    return audioHapticPlayer333;
  }
  async playAll() {
    let play1 = await this.initAVPlayer();
    play1.on(Events.SEEK_DONR, ()=>{
      console.error(`createAVPlayer audioInterrupt`);
    });
    let play2 = await this.initAudioRenderer();
    play2.on(Events.STATE_CHANGE, ()=>{
      console.error(`createAudioRenderer audioInterrupt`);
    });
    let play3 = await this.initAudioCapturer();
    play3.on(Events.STATE_CHANGE, ()=>{
      console.error(`createAudioCapturer audioInterrupt`);
    });
    let play4 = await this.initPlayer();
    this.myAudioHapticPlayer?.on(Events.END_OF_STREAM, ()=>{
      console.error(`createPlayer audioInterrupt`);
    });
  }
}