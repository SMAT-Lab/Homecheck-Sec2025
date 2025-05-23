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

let myAudioRenderer: audio.AudioRenderer;

async function initAVPlayer(): Promise<media.AVPlayer> {
  let player = await media.createAVPlayer();
  player.on('audioInterrupt', ()=>{
    console.error(`createAVPlayer audioInterrupt1`);
  });
  return player;
}
async function initAudioRenderer(): Promise<audio.AudioRenderer> {
  myAudioRenderer = await audio.createAudioRenderer(audioRendererOptions);
  return myAudioRenderer;
}

async function playAll() {
  let player1 = await initAVPlayer();
  player1.on('audioOutputDeviceChangeWithInfo', ()=>{
    console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
  });
  let player2 = await initAudioRenderer();
  player2.on('audioInterrupt', ()=>{
    console.error(`createAudioRenderer audioInterrupt1`);
  });
  player2.on('outputDeviceChangeWithInfo', ()=>{
    console.error(`createAudioRenderer outputDeviceChangeWithInfo`);
  });
}

export class AudioPauseOrMuteNoReport3 {
  private myAudioRenderer: audio.AudioRenderer | null = null;

  async initAVPlayer(): Promise<media.AVPlayer> {
    let player = await media.createAVPlayer();
    player.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
    return player;
  }
  async initAudioRenderer(): Promise<audio.AudioRenderer> {
    this.myAudioRenderer = await audio.createAudioRenderer(audioRendererOptions);
    this.myAudioRenderer.on('audioInterrupt', ()=>{
      console.error(`createAudioRenderer audioInterrupt1`);
    });
    return this.myAudioRenderer;
  }
  async initAudioRenderer1(): Promise<audio.AudioRenderer> {
    let player1 = await audio.createAudioRenderer(audioRendererOptions);
    player1.on('audioInterrupt', ()=>{
      console.error(`createAudioRenderer audioInterrupt1`);
    });
    this.myAudioRenderer = player1;
    return this.myAudioRenderer;
  }

  async playAll() {
    let player1 = await this.initAVPlayer();
    player1.on(Events.AUDIO_OUTPUT_DEVICE, ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
    let player2 = await this.initAudioRenderer();
    player2.on(Events.OUTPUT_DEVICE, ()=>{
      console.error(`createAudioRenderer outputDeviceChangeWithInfo`);
    });
    playAll();
  }
}