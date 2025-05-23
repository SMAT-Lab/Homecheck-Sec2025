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

import { GIFComponent, ResourceLoader } from '@ohos/gif-drawable'

@Entry
@Component
struct GifDrawableReport1 {
  @State model1:GIFComponent.ControllerOptions = new GIFComponent.ControllerOptions();
  @State gifAutoPlay:boolean = true;
  @State gifReset:boolean = true;

  aboutToAppear(): void {
    this.model1.destroy();
    //warning line
    let model11 = new GIFComponent.ControllerOptions();
    ResourceLoader.downloadDataWithContext(getContext(this), {
      url: 'https://pic.ibaotu.com/gif/18/17/16/51u888piCtqj.gif!fwpaa70/fw/700'
    }, (sucBuffer: ArrayBuffer) => {
      model11.setOpenHardware(false);
      model11.loadBuffer(sucBuffer, () => {
        console.log('网络加载解析成功回调绘制！')
        this.gifAutoPlay = true;
        // 给组件数据赋新的用户配置参数，达到后续gif动画效果
        this.model1 = model11;
      })
    }, (err: string) => {
      // 用户根据返回的错误信息，进行业务处理(展示一张失败占位图、再次加载一次、加载其它图片等)
    })
  }
  build() {
    Row() {
      GIFComponent({model:this.model1!!, autoPlay:this.gifAutoPlay!!, resetGif: this.gifReset!!})
    }
  }
}

