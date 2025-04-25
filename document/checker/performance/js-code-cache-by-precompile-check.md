# [Experimental] Consider pre-compiling JavaScript into bytecode to reduce the time required for both the first and second page loads (js-code-cache-by-precompile-check)

By pre-compiling the used JavaScript files into bytecode and caching it locally, you can significantly reduce the time required for both the first and second page loads.

## Rule Details
This rule is aimed at enforcing the more performant way of using Web.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-js-code-cache-by-precompile-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/best-practices-V5/bpta-web-develop-optimization-V5#section563844632917) for more details.

Examples of **incorrect** code for this rule:

```ets
import { webview } from '@kit.ArkWeb';
import { hiTraceMeter } from '@kit.PerformanceAnalysisKit';

@Entry
@Component
struct JsCodeCacheByPrecompileCheckReport {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      Button('加载页面')
        .onClick(() => {
          hiTraceMeter.startTrace('unPrecompileJavaScript', 1);
          this.controller.loadUrl('https://www.example.com/b.html');
        })
      // warning line
      Web({ src: 'https://www.example.com/a.html', controller: this.controller })
        .fileAccess(true)
        .onPageBegin((event) => {
          console.log(`load page begin: ${event?.url}`);
        })
        .onPageEnd((event) => {
          hiTraceMeter.finishTrace('unPrecompileJavaScript', 1);
          console.log(`load page end: ${event?.url}`);
        })
    }
  }
}
```

Examples of **correct** code for this rule:

```ets
import { webview } from '@kit.ArkWeb';

interface Config {
  url: string,
  localPath: string,
  options: webview.CacheOptions
}

@Entry
@Component
struct JsCodeCacheByPrecompileCheckNoReport {
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

  build() {
    Column() {
      Web({ src: 'https://www.example.com/a.html', controller: this.controller })
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
    }
  }
}
```