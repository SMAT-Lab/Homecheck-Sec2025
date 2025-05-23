import { webview } from "@kit.ArkWeb";

export class WebConstants {
  public static readonly INTERCEPTION_URL: string = 'scheme3://www.intercept.com/test-cc2.js';
  public static readonly SCHEME3: string = 'scheme3://';
  public static readonly URL: string = 'www.intercept.com';
  public static readonly JS_FILE: string = 'test-cc2.js';
  public static readonly CUSTOM_SCHEME8 = 'scheme8';
  public static readonly SCHEME9: webview.WebCustomScheme = { schemeName: "scheme9", isSupportCORS: true, isSupportFetch: true, isCodeCacheSupported: true }
  public static readonly FAKE_DOMAIN = 'https://675554.com/';
  public static readonly URL_HARD_RESOURCE: string = 'resource://rawfile/';
}