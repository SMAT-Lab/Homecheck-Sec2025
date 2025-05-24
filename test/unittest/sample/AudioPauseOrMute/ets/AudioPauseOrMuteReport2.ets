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

let myAudioRenderer222: audio.AudioRenderer;

async function AwaitPromise1() {
  // warning line
  let player222 = await media.createAVPlayer();
  player222.on('audioInterrupt', ()=>{
    console.error(`createAVPlayer audioInterrupt1`);
  });
  console.log(`init ${player222}`);
}
async function AwaitPromise2() {
  // warning line
  myAudioRenderer222 = await audio.createAudioRenderer(audioRendererOptions);
}

export class AudioPauseOrMuteReport2 {
  private myAVPlayer: media.AVPlayer | null = null;
  private myAudioRenderer: audio.AudioRenderer | null = null;
  private static audioMedia: media.AVPlayer | null = null;

  async demoCallback0() {
    // warning line
    let player222 = await media.createAVPlayer();
    player222.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
    console.log(`init ${player222}`);
  }
  async demoCallback1() {
    // warning line
    let audioRenderer222 = await audio.createAudioRenderer(audioRendererOptions);
    audioRenderer222.on('audioInterrupt', ()=>{
      console.error(`createAudioRenderer audioInterrupt1`);
    });
    console.log(`init ${audioRenderer222}`);
  }
  async demoCallback4(){
    // warning line
    this.myAVPlayer = await media.createAVPlayer();
    this.myAVPlayer.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
  }
  async demoCallback5(): Promise<media.AVPlayer>{
    // warning line
    AudioPauseOrMuteReport2.audioMedia = await media.createAVPlayer();
    AudioPauseOrMuteReport2.audioMedia.on('audioInterrupt', ()=>{
      console.error(`createAVPlayer audioInterrupt1`);
    });
    return AudioPauseOrMuteReport2.audioMedia;
  }

  async useage() {
    AwaitPromise1();
    AwaitPromise2();
    myAudioRenderer222.on('audioInterrupt', ()=>{
      console.error(`createAudioRenderer audioInterrupt1`);
    });
    console.log(`init ${myAudioRenderer222}, ${this.myAVPlayer}`);
    console.log(`init ${this.myAudioRenderer}`)
  }
}