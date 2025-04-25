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
struct GifDrawableReport2 {
  //warning line
  @State model4:GIFComponent.ControllerOptions = new GIFComponent.ControllerOptions();
  @State gifAutoPlay:boolean = true;
  @State gifReset:boolean = true;

  aboutToAppear(): void {
    ResourceLoader.downloadDataWithContext(getContext(this), {
      url: 'https://pic.ibaotu.com/gif/18/17/16/51u888piCtqj.gif!fwpaa70/fw/700'
    }, (sucBuffer: ArrayBuffer) => {
      this.model4.setOpenHardware(false);
      this.model4.loadBuffer(sucBuffer, () => {
        console.log('网络加载解析成功回调绘制！')
        this.gifAutoPlay = true;
      })
    }, (err: string) => {
      // 用户根据返回的错误信息，进行业务处理(展示一张失败占位图、再次加载一次、加载其它图片等)
    })
  }
  build() {
    Row() {
      GIFComponent({model:this.model4!!, autoPlay:this.gifAutoPlay!!, resetGif: this.gifReset!!})
    }
  }
}

