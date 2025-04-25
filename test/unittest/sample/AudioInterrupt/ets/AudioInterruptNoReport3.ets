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

let myAudioRenderer: audio.AudioRenderer;
let myAudioHapticPlayer: audioHaptic.AudioHapticPlayer;

async function initAVPlayer(): Promise<media.AVPlayer> {
  let player = await media.createAVPlayer();
  player.on('audioOutputDeviceChangeWithInfo', ()=>{
    console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
  });
  return player;
}
async function initAudioRenderer(): Promise<audio.AudioRenderer> {
  myAudioRenderer = await audio.createAudioRenderer(audioRendererOptions);
  return myAudioRenderer;
}
async function initAudioCapturer(): Promise<audio.AudioCapturer> {
  let audioCapturer = await audio.createAudioCapturer(audioCapturerOptions);
  return audioCapturer;
}

let id = 0;
let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
async function initPlayer(): Promise<audioHaptic.AudioHapticPlayer>  {
  myAudioHapticPlayer = await audioHapticManagerInstance.createPlayer(id, options);
  return myAudioHapticPlayer;
}
async function playAll() {
  let player1 = await initAVPlayer();
  player1.on('audioInterrupt', ()=>{
    console.error(`createAVPlayer audioInterrupt`);
  });
  let player2 = await initAudioRenderer();
  player2.on('outputDeviceChangeWithInfo', ()=>{
    console.error(`createAVPlayer outputDeviceChangeWithInfo`);
  });
  player2.on('audioInterrupt', ()=>{
    console.error(`createAudioRenderer audioInterrupt`);
  });
  let player3 = await initAudioCapturer();
  player3.on('audioInterrupt', ()=>{
    console.error(`createAudioCapturer audioInterrupt`);
  });
  let player4 = await initPlayer();
  player4.on('audioInterrupt', ()=>{
    console.error(`createPlayer audioInterrupt`);
  });
}

export class AudioInterruptNoReport3 {
  private myAudioRenderer: audio.AudioRenderer | null = null;
  private static myAudioCapturer: audio.AudioCapturer | null = null;
  private myAudioHapticPlayer: audioHaptic.AudioHapticPlayer | null = null;
  async initAVPlayer(): Promise<media.AVPlayer> {
    let player = await media.createAVPlayer();
    player.on('audioOutputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
    });
    return player;
  }
  async initAudioRenderer(): Promise<audio.AudioRenderer> {
    this.myAudioRenderer = await audio.createAudioRenderer(audioRendererOptions);
    this.myAudioRenderer.on('outputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer outputDeviceChangeWithInfo`);
    });
    return this.myAudioRenderer;
  }
  async initAudioRenderer1(): Promise<audio.AudioRenderer> {
    let player1 = await audio.createAudioRenderer(audioRendererOptions);
    player1.on('outputDeviceChangeWithInfo', ()=>{
      console.error(`createAVPlayer outputDeviceChangeWithInfo`);
    });
    this.myAudioRenderer = player1;
    return this.myAudioRenderer;
  }
  async initAudioCapturer(): Promise<audio.AudioCapturer> {
    AudioInterruptNoReport3.myAudioCapturer = await audio.createAudioCapturer(audioCapturerOptions);
    return AudioInterruptNoReport3.myAudioCapturer;
  }
  async initPlayer(): Promise<audioHaptic.AudioHapticPlayer>  {
    let id = 0;
    let audioHapticManagerInstance: audioHaptic.AudioHapticManager = audioHaptic.getAudioHapticManager();
    let options: audioHaptic.AudioHapticPlayerOptions = { muteAudio: false, muteHaptics: false };
    let audioHapticPlayer = await audioHapticManagerInstance.createPlayer(id, options);
    this.myAudioHapticPlayer = audioHapticPlayer;
    return audioHapticPlayer;
  }
  async playAll() {
    let player1 = await this.initAVPlayer();
    player1.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAVPlayer audioInterrupt`);
    });
    let player2 = await this.initAudioRenderer();
    player2.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAudioRenderer audioInterrupt`);
    });
    let player3 = await this.initAudioCapturer();
    player3.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createAudioCapturer audioInterrupt`);
    });
    let player4 = await this.initPlayer();
    this.myAudioHapticPlayer?.on(Events.AUDIO_INTERRUPT, ()=>{
      console.error(`createPlayer audioInterrupt`);
    });
    playAll();
  }
}