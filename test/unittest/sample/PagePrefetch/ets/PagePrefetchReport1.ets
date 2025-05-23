import webview from '@ohos.web.webview'

@Entry
@Component
struct PrefetchPageReport1 {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      /**
       * @tc.number: PagePrefetchTest_001
       * @tc.name: 有Web组件，没有aboutToAppear、onAppear、onPageEnd方法
       * @tc.desc: 有Web组件，没有aboutToAppear、onAppear、onPageEnd方法
       */
      Web({ src: 'www.example.com', controller: this.controller})
    }
  }
}