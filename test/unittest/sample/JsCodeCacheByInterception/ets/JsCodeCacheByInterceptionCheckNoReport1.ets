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
import { BusinessError } from '@kit.BasicServicesKit';

@Entry
@Component
struct JsCodeCacheByInterceptionCheckNoReport1 {
  scheme1: webview.WebCustomScheme = { schemeName: "scheme1", isSupportCORS: true, isSupportFetch: true, isCodeCacheSupported: true }
  webController: webview.WebviewController = new webview.WebviewController();
  jsData: string = 'JavaScript Data';

  aboutToAppear(): void {
    try {
      webview.WebviewController.customizeSchemes([this.scheme1])
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`ErrorCode: ${e.code}, Message: ${e.message}`);
    }
  }

  build() {
    Column() {
      Web({ src: $rawfile('index2.html'), controller: this.webController })
        .fileAccess(true)
        .javaScriptAccess(true)
        .width('100%')
        .height('100%')
        .onConsole((event) => {
          console.log('ets onConsole:' + event?.message.getMessage());
          return false;
        })
        .onControllerAttached(async () => {
          for (const config of this.configs) {
            let content = getContext().resourceManager.getRawFileContentSync(config.localPath);
            try {
              this.webController.precompileJavaScript(config.url, content, config.options)
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
          let responseResource = new WebResourceResponse();
          if (event?.request.getRequestUrl() === 'scheme1://www.intercept.com/test-cc2.js') {
            responseResource.setResponseHeader([
              {
                headerKey: 'ResponseDataID',
                headerValue: '0000000000001'
              }
            ]);
            responseResource.setResponseData(this.jsData);
            responseResource.setResponseEncoding('utf-8');
            responseResource.setResponseMimeType('application/javascript');
            responseResource.setResponseCode(200);
            responseResource.setReasonMessage('OK');
            return responseResource;
          }
          return null;
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