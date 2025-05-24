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
struct JsCodeCacheByInterceptionCheckReport1 {
  controller: webview.WebviewController = new webview.WebviewController();
  jsData2: string = 'JavaScript Data';

  aboutToAppear(): void {
    try {
      webview.WebviewController.customizeSchemes([{ schemeName: "scheme1", isSupportCORS: true, isSupportFetch: true, isCodeCacheSupported: true }])
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`ErrorCode: ${e.code}, Message: ${e.message}`);
    }
  }

  build() {
    Column() {
      Web({
        src: $rawfile('index2.html'),
        controller: this.controller
      })
        .fileAccess(true)
        .javaScriptAccess(true)
        .width('100%')
        .height('100%')
        .onConsole((event) => {
          console.log('ets onConsole:' + event?.message.getMessage());
          return false;
        })
          // warning line
        .onInterceptRequest((event) => {
          if (event?.request.getRequestUrl() === 'scheme1://www.intercept.com/test-cc2.js') {
            let responseResource = new WebResourceResponse();
            responseResource.setResponseData(this.jsData2);
            responseResource.setResponseEncoding('utf-8');
            responseResource.setResponseMimeType('application/javascript');
            responseResource.setResponseCode(200);
            responseResource.setReasonMessage('OK');
            return responseResource;
          }
          return null;
        })
        .onControllerAttached(async () => {
          this.controller.precompileJavaScript('', 'content', null)
            .then((errCode: number) => {
              console.log('precompile successfully!' );
            }).catch((errCode: number) => {
            console.error('precompile failed.' + errCode);
          })
        })
    }
  }
}