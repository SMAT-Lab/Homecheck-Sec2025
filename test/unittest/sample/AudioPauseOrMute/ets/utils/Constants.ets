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

export class Constants {
  public static readonly AUDIO_INTERRUPT_READ_ONLY: string = 'audioInterrupt';
  public static readonly STATE_CHANGE: string = 'stateChange';
  public static readonly TIME_UPDATE: string = 'timeUpdate';
  public static AUDIO_INTERRUPT: string = 'audioInterrupt';

}

export enum Events {
  STATE_CHANGE = 'stateChange',
  TIME_UPDATE = 'timeUpdate',
  AUDIO_INTERRUPT = 'audioInterrupt',
  END_OF_STREAM = 'endOfStream',
  START_RENDER_FRAME = 'startRenderFrame',
  VIDEO_SIZE_CHANGE = 'videoSizeChange',
  RESET = 'reset',
  ERROR = 'error',
  SEEK_DONR = 'seekDone',
  BUFFERING_UPDATE = 'bufferingUpdate',
  SPEED_DONE = 'speedDone',
  OUTPUT_DEVICE = 'outputDeviceChangeWithInfo',
  AUDIO_OUTPUT_DEVICE = 'audioOutputDeviceChangeWithInfo'
}