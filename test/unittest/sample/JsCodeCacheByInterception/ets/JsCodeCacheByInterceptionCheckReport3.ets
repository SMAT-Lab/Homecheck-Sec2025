import { webview } from '@kit.ArkWeb';
import { BusinessError } from '@kit.BasicServicesKit';
import { WebConstants } from './WebConstants';

@Entry
@Component
struct JsCodeCacheByInterceptionCheckReport3 {
  scheme3: webview.WebCustomScheme = { schemeName: "scheme3", isSupportCORS: true, isSupportFetch: true, isCodeCacheSupported: true }
  webController: webview.WebviewController = new webview.WebviewController();

  aboutToAppear(): void {
    try {
      webview.WebviewController.customizeSchemes([this.scheme3])
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`ErrorCode: ${e.code}, Message: ${e.message}`);
    }
  }

  build() {
    Column(){
      Web({ src: $rawfile('index2.html'), controller: this.webController })
        .fileAccess(true)
        .javaScriptAccess(true)
        .width('100%')
        .height('100%')
        .onConsole((event) => {
          console.log('ets onConsole:' + event?.message.getMessage());
          return false;
        })
        .onInterceptRequest((event) => {
          if(!event){
            return null;
          }
          let requestUrl = event.request.getRequestUrl();
          const customResponse = codeCache.handleURL(requestUrl);
          if(customResponse){
            console.log('[WEB] : custom cached success', requestUrl);
            return customResponse.response;
          }
          return handleInterceptRequest(event.request);
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

function handleInterceptRequest(request: WebResourceRequest): WebResourceResponse | null {
  let requestUrl = request.getRequestUrl();
  let fakeDomain: string = WebConstants.FAKE_DOMAIN;
  if(!requestUrl.startsWith(fakeDomain)){
    return null;
  }
  let newUrl: string = '';
  let splitString: string = fakeDomain + WebConstants.URL_HARD_RESOURCE;
  if(requestUrl.startsWith(splitString)){
    newUrl = requestUrl.substring(splitString.length);
  }
  const position = newUrl.indexOf('?');
  if( position !== -1){
    newUrl = newUrl.substring(0,position);
  }
  let responseResource = new WebResourceResponse();

  let flag2 = newUrl.indexOf('.js') !== -1;
  if(flag2){
    responseResource.setResponseData('json');
    return responseResource;
  }
  if(newUrl.endsWith('.js')){
    responseResource.setResponseData('json');
    responseResource.setResponseEncoding('utf-8');
    responseResource.setResponseMimeType('application/javascript');
    responseResource.setResponseCode(200);
    responseResource.setReasonMessage('OK');
    return responseResource;
  }
	return null;
}

export interface CodeCacheController {
  getScheme(): webview.WebCustomScheme
  getResponseSettings(url: string): CodeCacheResponseSettings | null
}

export interface CodeCacheResponseSettings {
  headerKey: string
  headerValue: string
  data: string | number | Resource | ArrayBuffer;
}

class CodeCacheResponse {
  response: WebResourceResponse

  constructor() {
    this.response = new WebResourceResponse()
    this.setDefault()
  }

  setSettings(settings: CodeCacheResponseSettings){
    this.response.setResponseHeader([{
      headerKey: settings.headerKey,
      headerValue: settings.headerValue
    }])
    this.response.setResponseData(settings.data);
  }

  private setDefault() {
    const response = this.response;
    response.setResponseEncoding('utf-8');
    response.setResponseMimeType('application/javascript');
    response.setResponseCode(200);
    response.setReasonMessage('OK');
  }
}

class CodeCache {
  controllerSet: Set<CodeCacheController>

  constructor() {
    this.controllerSet = new Set()
  }

  getSchemelist(){
    const result: webview.WebCustomScheme[] = []
    for(const controller of this.controllerSet){
      result.push(controller.getScheme())
    }
    return result;
  }

  handleURL(url: string){
    for(const controller of this.controllerSet){
      const settings = controller.getResponseSettings(url);
      if(settings){
        const response = new CodeCacheResponse();
        response.setSettings(settings);
        return response
      }
    }
    return null
  }

  registerController(controller: CodeCacheController){
    this.controllerSet.add(controller)
    return this
  }
}

export const codeCache = new CodeCache()