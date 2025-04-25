import { webview } from '@kit.ArkWeb'

@Entry
@Component
struct WebComponent {
  webviewController: webview.WebviewController = new webview.WebviewController();

  aboutToAppear(): void {
    console.log('aboutToAppear');
  }
  build() {
    Column() {
      Web({ src: 'https://www.baidu.com/cn/', controller: this.webviewController})
        .onAppear(() => {
          console.log('onAppear');
        })
        .onPageEnd(() => {
          console.log('onPageEnd');
        })
    }
  }
}