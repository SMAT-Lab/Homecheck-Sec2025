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

let myAudioRenderer222: audio.AudioRenderer;
let myAudioCapturer222: audio.AudioCapturer;

async function AwaitPromise1() {
  // warning line
  let player222 = await media.createAVPlayer();
  console.log(`init ${player222}`);
}
async function AwaitPromise2() {
  // warning line
  myAudioRenderer222 = await audio.createAudioRenderer(audioRendererOptions);
}
async function AwaitPromise3() {
  // warning line
  myAudioCapturer222 = await audio.createAudioCapturer(audioCapturerOptions);
}

let id = 0;
let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
async function AwaitPromise4() {
  // warning line
  let audioHapticPlayer222 = await audioHapticManagerInstance.createPlayer(id, options);
  console.log(`init ${audioHapticPlayer222}`);
}

export class AudioInterruptReport2 {
  private myAVPlayer: media.AVPlayer | null = null;
  private myAudioRenderer: audio.AudioRenderer | null = null;
  private myAudioCapturer: audio.AudioCapturer | null = null;
  private myAudioHapticPlayer: audioHaptic.AudioHapticPlayer | null = null;
  private static audioMedia: media.AVPlayer | null = null;

  async demoCallback0() {
    // warning line
    let player222 = await media.createAVPlayer();
    player222.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
    console.log(`init ${player222}`);
  }
  async demoCallback1() {
    // warning line
    let audioRenderer222 = await audio.createAudioRenderer(audioRendererOptions);
    audioRenderer222.on('outputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer outputDeviceChangeWithInfo`);
    });
    console.log(`init ${audioRenderer222}`);
  }
  async demoCallback2() {
    // warning line
    let audioCapturer222 = await audio.createAudioCapturer(audioCapturerOptions);
    console.log(`init ${audioCapturer222}`);
  }
  async demoCallback3() {
    let id = 0;
    let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
    let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
    // warning line
    let audioHapticPlayer222 = await audioHapticManagerInstance.createPlayer(id, options);
    console.log(`init ${audioHapticPlayer222}`);
  }
  async demoCallback4(){
    // warning line
    this.myAVPlayer = await media.createAVPlayer();
    this.myAVPlayer.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
  }
  async demoCallback5(): Promise<media.AVPlayer>{
    // warning line
    AudioInterruptReport2.audioMedia = await media.createAVPlayer();
    AudioInterruptReport2.audioMedia.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
    return AudioInterruptReport2.audioMedia;
  }

  async useage() {
    AwaitPromise1();
    AwaitPromise2();
    AwaitPromise3();
    AwaitPromise4();
    myAudioRenderer222.on('outputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer outputDeviceChangeWithInfo`);
    });
    console.log(`init ${myAudioRenderer222}, ${myAudioCapturer222}, ${this.myAVPlayer}`);
    console.log(`init ${this.myAudioRenderer}, ${this.myAudioCapturer}, ${this.myAudioHapticPlayer}`)
  }
}