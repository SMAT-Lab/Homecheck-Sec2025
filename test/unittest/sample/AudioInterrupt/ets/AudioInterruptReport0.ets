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

function demoCallback() {
  // warning line
  media.createAVPlayer((error: BusinessError, player: media.AVPlayer) => {
    if (player !== null) {
      player.on('audioOutputDeviceChangeWithInfo', ()=>{
        console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
      });
      console.info(`Succeded in creating AVPlayer`);
    } else {
      console.error(`Failed to creating AVPlayer, error message${error.message}`);
    }
  });
  // warning line
  audio.createAudioRenderer(audioRendererOptions, (err, audioRenderer: audio.AudioRenderer) => {
    if(err){
      console.error(`AudioRenderer Created: Error: ${err}`);
    }else {
      audioRenderer.on('outputDeviceChangeWithInfo', ()=>{
        console.error(`createAVPlayer outputDeviceChangeWithInfo`);
      });
      console.info(`AudioRenderer Created: Success: SUCCESS` + audioRenderer);
    }
  });
  // warning line
  audio.createAudioCapturer(audioCapturerOptions, (err, audioCapturer: audio.AudioCapturer) => {
    if(err){
      console.error(`AudioCapturer Created: Error: ${err}`);
    }else {
      console.info(`AudioCapturer Created: Success: SUCCESS` + audioCapturer);
    }
  });
  // warning line
  media.createAVPlayer((error: BusinessError, player: media.AVPlayer) => {
    if (player !== null) {
      player.on('audioOutputDeviceChangeWithInfo', ()=>{
        console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
      });
      console.info(`Succeded in creating AVPlayer`);
    } else {
      console.error(`Failed to creating AVPlayer, error message${error.message}`);
    }
  });
}

export class AudioInterruptReport0 {
  demoCallback() {
    // warning line
    media.createAVPlayer((error: BusinessError, player) => {
      if (player) {
        player.on('audioOutputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
        });
        console.info(`Succeded in creating AVPlayer`);
      } else {
        console.error(`Failed to creating AVPlayer, error message${error.message}`);
      }
    });
    // warning line
    audio.createAudioRenderer(audioRendererOptions, (err, audioRenderer) => {
      if (err) {
        console.error(`AudioRenderer Created: Error: ${err}`);
      } else {
        audioRenderer.on('outputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer outputDeviceChangeWithInfo`);
        });
        console.info(`AudioRenderer Created: Success: SUCCESS` + audioRenderer);
      }
    });
    // warning line
    audio.createAudioCapturer(audioCapturerOptions, (err, audioCapturer) => {
      if (err) {
        console.error(`AudioCapturer Created: Error: ${err}`);
      } else {
        console.info(`AudioCapturer Created: Success: SUCCESS` + audioCapturer);
      }
    });
    // warning line
    media.createAVPlayer((error: BusinessError, player) => {
      if (player) {
        player.on('audioOutputDeviceChangeWithInfo', ()=>{
          console.error(`createAVPlayer audioOutputDeviceChangeWithInfo`);
        });
        console.info(`Succeded in creating AVPlayer`);
      } else {
        console.error(`Failed to creating AVPlayer, error message${error.message}`);
      }
    });
    demoCallback();
  }
}