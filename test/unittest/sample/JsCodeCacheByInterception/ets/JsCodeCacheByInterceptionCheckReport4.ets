import { webview } from '@kit.ArkWeb';
import { BusinessError } from '@kit.BasicServicesKit';

@Entry
@Component
struct JsCodeCacheByInterceptionCheckReport4 {
  scheme1: webview.WebCustomScheme = { schemeName: "scheme1", isSupportCORS: true, isSupportFetch: true, isCodeCacheSupported: true }
  controller: webview.WebviewController = new webview.WebviewController();

  aboutToAppear(): void {
    try {
      webview.WebviewController.customizeSchemes([this.scheme1])
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`ErrorCode: ${e.code}, Message: ${e.message}`);
    }
  }

  build() {
    Column(){
      Web({ src: $rawfile('index2.html'), controller: this.controller })
        .fileAccess(true)
        .javaScriptAccess(true)
        .width('100%')
        .height('100%')
        .onConsole((event) => {
          console.log('ets onConsole:' + event?.message.getMessage());
          return false;
        })
        //warning line
        .onInterceptRequest((event) => {
          if(!event){
            return null;
          }
          if (event?.request.getRequestUrl() === 'scheme1://www.intercept.com/test-cc2.js') {
            let responseResource = new WebResourceResponse();
            setResponseData(responseResource, 'abv', 1);
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

function setResponseData(responseResource: WebResourceResponse, str: string, num: number): void {
  responseResource.setResponseData('json');
  responseResource.setResponseEncoding('utf-8');
  responseResource.setResponseMimeType('application/javascript');
  responseResource.setResponseCode(200);
  responseResource.setReasonMessage('OK');
}
