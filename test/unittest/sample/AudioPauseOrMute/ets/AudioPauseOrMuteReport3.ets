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

let myAudioRenderer333: audio.AudioRenderer;

async function initAVPlayer(): Promise<media.AVPlayer> {
  // warning line
  let player333 = await media.createAVPlayer();
  player333.on('audioInterrupt', ()=>{
    console.error(`createAVPlayer audioInterrupt1`);
  });
  return player333;
}
async function initAudioRenderer(): Promise<audio.AudioRenderer> {
  // warning line
  myAudioRenderer333 = await audio.createAudioRenderer(audioRendererOptions);
  return myAudioRenderer333;
}

async function playAll() {
  let play1 = await initAVPlayer();
  play1.on('stateChange', ()=>{
    console.error(`createAVPlayer audioInterrupt`);
  });
  let play2 = await initAudioRenderer();
  play2.on('audioInterrupt', ()=>{
    console.error(`createAudioRenderer audioInterrupt1`);
  });
  play2.on('stateChange', ()=>{
    console.error(`createAudioRenderer audioInterrupt`);
  });
}

export class AudioPauseOrMuteReport3 {
  private myAudioRenderer: audio.AudioRenderer | null = null;

  async initAVPlayer(): Promise<media.AVPlayer> {
    // warning line
    let player333 = await media.createAVPlayer();
    player333.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
    return player333;
  }
  async initAudioRenderer(): Promise<audio.AudioRenderer> {
    // warning line
    this.myAudioRenderer = await audio.createAudioRenderer(audioRendererOptions);
    this.myAudioRenderer.on('audioInterrupt', ()=>{
      console.error(`createAudioRenderer audioInterrupt1`);
    });
    return this.myAudioRenderer;
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
  }
}