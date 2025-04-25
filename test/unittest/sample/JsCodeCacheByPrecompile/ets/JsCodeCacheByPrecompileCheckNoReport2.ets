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

import { webview } from '@kit.ArkWeb';
interface Config {
  url: string,
  localPath: string,
  options: webview.CacheOptions
}

@Entry
@Component
struct JsCodeCacheByPrecompileCheckNoReport2 {
  controller: webview.WebviewController = new webview.WebviewController();
  configs: Array<Config> = [
    {
      url: 'https://www.example.com/example.js',
      localPath: 'example.js',
      options: {
        responseHeaders: [
          { headerKey: 'E-Tag', headerValue: 'xxx' },
          { headerKey: 'Last-Modified', headerValue: 'Web, 21 Mar 2024 10:38:41 GMT' }
        ]
      }
    }
  ]

  aboutToAppear(): void {
    for (const config of this.configs) {
      let content = getContext().resourceManager.getRawFileContentSync(config.localPath);
      try {
        this.controller.precompileJavaScript(config.url, content, config.options)
          .then((errCode: number) => {
            console.log('precompile successfully!' );
          }).catch((errCode: number) => {
          console.error('precompile failed.' + errCode);
        })
      } catch (err) {
        console.error('precompile failed!.' + err.code + err.message);
      }
    }
  }

  build() {
    Column() {
      Web({ src: 'https://www.example.com/a.html', controller: this.controller })
        .onControllerAttached(async () => {
          for (const config of this.configs) {
            let content = getContext().resourceManager.getRawFileContentSync(config.localPath);
          }
        })
    }
  }
}