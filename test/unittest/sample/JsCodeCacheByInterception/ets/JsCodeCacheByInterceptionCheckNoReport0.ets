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
import { hiTraceMeter } from '@kit.PerformanceAnalysisKit';

@Entry
@Component
struct JsCodeCacheByInterceptionCheckNoReport0 {
  controller: webview.WebviewController = new webview.WebviewController();
  responseResource: WebResourceResponse = new WebResourceResponse();
  jsData: string = 'JavaScript Data';

  build() {
    Column() {
      Web({ src: $rawfile('index.html'), controller: this.controller })
        .onControllerAttached(async () => {
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
        })
        .onInterceptRequest((event) => {
          if (event?.request.getRequestUrl() === 'https://www.example.com/test.js') {
            this.responseResource.setResponseHeader([
              {
                headerKey: 'ResponseDataID',
                headerValue: '0000000000001'
              }
            ]);
            this.responseResource.setResponseData(this.jsData);
            this.responseResource.setResponseEncoding('utf-8');
            this.responseResource.setResponseMimeType('application/javascript');
            this.responseResource.setResponseCode(200);
            this.responseResource.setReasonMessage('OK');
            return this.responseResource;
          }
          return null;
        })
        .onPageBegin(() => {
          hiTraceMeter.startTrace('getMessageData', 0);
        })
        .onPageEnd(() => {
          hiTraceMeter.finishTrace('getMessageData', 0);
        })
    }
  }
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
}
interface Config {
  url: string,
  localPath: string,
  options: webview.CacheOptions
}