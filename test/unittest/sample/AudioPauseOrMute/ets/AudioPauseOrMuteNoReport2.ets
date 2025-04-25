
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

let myAVPlayer: media.AVPlayer;
let myAudioRenderer: audio.AudioRenderer;

async function AwaitPromise1() {
  let player = await media.createAVPlayer();
  player.on('audioInterrupt', ()=>{
    console.error(`createAVPlayer audioInterrupt1`);
  });
  player.on('audioOutputDeviceChangeWithInfo', () => {
    console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
  });
}
async function AwaitPromise2() {
  let audioRenderer = await audio.createAudioRenderer(audioRendererOptions);
  audioRenderer.on('audioInterrupt', ()=>{
    console.error(`createAudioRenderer audioInterrupt1`);
  });
  setCallback2(audioRenderer);
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

export class AudioPauseOrMuteNoReport2 {
  private myAVPlayer: media.AVPlayer | null = null;
  private myAudioRenderer: audio.AudioRenderer | null = null;
  private static audioMedia: media.AVPlayer | null = null;

  async demoCallback0() {
    let player = await media.createAVPlayer();
    player.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
    player.on(Events.AUDIO_OUTPUT_DEVICE, () => {
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
  }
  async demoCallback1() {
    let audioRenderer = await audio.createAudioRenderer(audioRendererOptions);
    setCallback2(audioRenderer);
  }
  async demoCallback4(){
    this.myAVPlayer = await media.createAVPlayer();
    this.myAVPlayer.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
  }
  async demoCallback5(): Promise<media.AVPlayer>{
    AudioPauseOrMuteNoReport2.audioMedia = await media.createAVPlayer();
    AudioPauseOrMuteNoReport2.audioMedia.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
    return AudioPauseOrMuteNoReport2.audioMedia;
  }
  setCallback0() {
    this.myAVPlayer?.on(Events.AUDIO_OUTPUT_DEVICE, ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });

    this.myAudioRenderer?.on(Events.OUTPUT_DEVICE, ()=>{
      console.error(`createAudioRenderer outputDeviceChangeWithInfo`);
    });

    AudioPauseOrMuteNoReport2.audioMedia?.on(Events.AUDIO_OUTPUT_DEVICE, ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
  }
  setCallback2(player2: audio.AudioRenderer) {
    player2.on(Events.OUTPUT_DEVICE, ()=>{
      console.error(`AudioRenderer outputDeviceChangeWithInfo`);
    });
    AwaitPromise1();
    AwaitPromise2();
  }
}