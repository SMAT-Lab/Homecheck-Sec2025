import webview from '@ohos.web.webview'

@Entry
@Component
struct PrefetchPageNoReport3 {
  controller: webview.WebviewController = new webview.WebviewController();

  aboutToAppear(): void {
    this.controller.prefetchPage('https://www.iana.org/help/example-domains');
  }

  build() {
    Column() {
      Web({ src: 'www.example.com', controller: this.controller})
    }
  }
}