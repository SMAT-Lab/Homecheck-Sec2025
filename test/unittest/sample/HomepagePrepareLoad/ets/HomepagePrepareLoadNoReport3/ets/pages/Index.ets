import { webview } from '@kit.ArkWeb'

@Entry
@Component
struct WebComponent {
  webviewController: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      Web({ src: 'https://www.baidu.com/cn/', controller: this.webviewController})
        .onAppear(() => {
          webview.WebviewController.prepareForPageLoad('https://www.baiduImage.com/cn/', true, 2);
        })
    }
  }
}