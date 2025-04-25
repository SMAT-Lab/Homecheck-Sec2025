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

import lottie from '@ohos/lottie';
import { AnimationItem } from '@ohos/lottie';

// 动画播放的起始帧
const FRAME_START: number = 60;
// 动画播放的终止帧
const FRAME_END: number = 120;

// 调用了销毁，但是不是全部销毁，上报
@Entry
@Component
struct LottieAnimation5 {
  private politeChickyController: CanvasRenderingContext2D = new CanvasRenderingContext2D();
  // 动画名称
  private politeChicky: string = 'politeChicky';
  // hap包内动画资源文件路径，仅支持json格式
  private politeChickyPath: string = 'media/politeChicky.json';
  private animateItem: AnimationItem | null = null;

  build() {
    Canvas(this.politeChickyController)
      .width(160)
      .height(160)
      .backgroundColor(Color.Gray)
      .borderRadius(3)
      .onReady(() => {
        this.animateItem = lottie.loadAnimation({
          container: this.politeChickyController,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          name: 'anim_name1',
          path: this.politeChickyPath,
          initialSegment: [FRAME_START, FRAME_END]
        })
      })
      .onClick(()=> {
        this.animateItem = lottie.loadAnimation({
          container: this.politeChickyController,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          name: 'anim_name2',
          path: this.politeChickyPath,
          initialSegment: [FRAME_START, FRAME_END]
        })
      })
      .onDisAppear(()=>{
        // 上报lottie,只销毁一个
        lottie.destroy('anim_name2');
      })
  }
}