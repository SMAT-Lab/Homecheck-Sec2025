import webview from '@ohos.web.webview'

@Entry
@Component
struct PrefetchPageNoReport2 {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      Web({ src: 'www.example.com', controller: this.controller})
        .onPageEnd(() => {
          this.controller.prefetchPage('https://www.iana.org/help/example-domains');
        })
    }
  }
}