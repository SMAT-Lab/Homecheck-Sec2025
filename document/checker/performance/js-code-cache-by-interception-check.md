# [Experimental] When requests are intercepted, compile JavaScript into bytecode for faster non-initial web page loading (js-code-cache-by-interception-check)

In scenarios involving JavaScript resource request interception and replacement, the strategy is compiling the used JavaScript files into bytecode and caching it locally. This approach enables the use of locally cached JavaScript bytecode during subsequent page loads, significantly reducing the compilation time.

## Rule Details
This rule is aimed at enforcing the more performant way of using Web.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-js-code-cache-by-interception-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/best-practices-V5/bpta-web-develop-optimization-V5#section1495115588211) for more details.

Examples of **incorrect** code for this rule:

```ets
// Example without a custom protocol and without setting ResponseDataID in the header
import { webview } from '@kit.ArkWeb';
import { hiTraceMeter } from '@kit.PerformanceAnalysisKit';

@Entry
@Component
struct JsCodeCacheByInterceptionCheckReport0 {
  controller: webview.WebviewController = new webview.WebviewController();
  responseResource: WebResourceResponse = new WebResourceResponse();
  jsData: string = 'JavaScript Data';

  build() {
    Column() {
      Web({ src: $rawfile('index.html'), controller: this.controller })
        .onPageBegin(() => {
          hiTraceMeter.startTrace('getMessageData', 0);
        })
        // warning line
        .onInterceptRequest(event => {
          if (event?.request.getRequestUrl() === 'https://www.example.com/test.js') {
            this.responseResource.setResponseData(this.jsData);
            this.responseResource.setResponseEncoding('utf-8');
            this.responseResource.setResponseMimeType('application/javascript');
            this.responseResource.setResponseCode(200);
            this.responseResource.setReasonMessage('OK');
            return this.responseResource;
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
        .onPageEnd(() => {
          hiTraceMeter.finishTrace('getMessageData', 0);
        })
    }
    .width('100%')
  }
}

// Example with a custom protocol and with isCodeCacheSupported set to false
import { webview } from '@kit.ArkWeb';
import { BusinessError } from '@kit.BasicServicesKit';

@Entry
@Component
struct JsCodeCacheByInterceptionCheckReport2 {
  // warning line
  scheme2: webview.WebCustomScheme = { schemeName: "scheme2", isSupportCORS: true, isSupportFetch: true, isCodeCacheSupported: false }
  webController: webview.WebviewController = new webview.WebviewController();
  jsData: string = 'JavaScript Data';

  aboutToAppear(): void {
    try {
      webview.WebviewController.customizeSchemes([this.scheme2])
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`ErrorCode: ${e.code},  Message: ${e.message}`);
    }
  }

  build() {
    Column() {
      Web({
        src: $rawfile('index2.html'),
        controller: this.webController
      })
        .fileAccess(true)
        .javaScriptAccess(true)
        .width('100%')
        .height('100%')
        .onConsole((event) => {
          console.log('ets onConsole:' + event?.message.getMessage());
          return false
        })
        .onInterceptRequest((event) => {
          if (event?.request.getRequestUrl() == 'scheme2://www.intercept.com/test-cc2.js') {
            let responseResource = new WebResourceResponse();
            responseResource.setResponseHeader([
              {
                headerKey: 'ResponseDataID',
                headerValue: '0000000000002'
              }]);
            responseResource.setResponseData(this.jsData);
            responseResource.setResponseEncoding('utf-8');
            responseResource.setResponseMimeType('application/javascript');
            responseResource.setResponseCode(200);
            responseResource.setReasonMessage('OK');
            return responseResource;
          }
          return null;
        })
        .onControllerAttached(async () => {
          this.webController.precompileJavaScript('', 'content', null)
            .then((errCode: number) => {
              console.log('precompile successfully!' );
            }).catch((errCode: number) => {
            console.error('precompile failed.' + errCode);
          })
        })
    }
  }
}
```

Examples of **correct** code for this rule:

```ets
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
```