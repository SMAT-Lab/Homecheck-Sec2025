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

//调用多次loadAnimation，但是只在onDisAppear销毁一次
@Entry
@Component
struct LottieAnimationDestoryReport2 {
  private politeChickyController: CanvasRenderingContext2D = new CanvasRenderingContext2D();
  // 动画名称
  private politeChicky: string = 'politeChicky';
  // hap包内动画资源文件路径，仅支持json格式
  private politeChickyPath: string = 'media/politeChicky.json';
  private animateItem: AnimationItem | null = null;
  // 初始化点击次数
  @State times: number = 0;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // 动画
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
            name: this.politeChicky,
            path: this.politeChickyPath,
            initialSegment: [FRAME_START, FRAME_END]
          })
        })
        .onClick(() => {
          this.animateItem = lottie.loadAnimation({
            container: this.politeChickyController,
            renderer: 'canvas',
            loop: true,
            autoplay: true,
            name: this.politeChicky,
            path: this.politeChickyPath,
            initialSegment: [FRAME_START, FRAME_END]
          })
          this.times++;
        })
        .onDisAppear(()=> {
          // 上报此处animateItem，描述description不一样，如果无法找到动画名称，则直接建议用lottie.destory
          this.animateItem?.destroy();
        })
      // 响应动画的文本
      Text('text')
        .fontSize(16)
        .margin(10)
        .fontColor(Color.White)
    }.margin({ top: 20 })
  }
}