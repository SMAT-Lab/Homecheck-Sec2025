import { webview } from '@kit.ArkWeb'

@Entry
@Component
struct WebComponent {
  webviewController: webview.WebviewController = new webview.WebviewController();

  aboutToAppear(): void {
    webview.WebviewController.prepareForPageLoad('https://www.example.com/cn/', true, 2);
  }
  build() {
    Column() {
      Web({ src: 'https://www.baidu.com/cn/', controller: this.webviewController})
    }
  }
}