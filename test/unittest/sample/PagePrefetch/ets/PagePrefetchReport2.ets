import webview from '@ohos.web.webview'

@Entry
@Component
struct PrefetchPageReport2 {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      /**
       * @tc.number: PagePrefetchTest_002
       * @tc.name: 有Web组件，有onPageEnd方法但方法里面没有预下载
       * @tc.desc: 有Web组件，有onPageEnd方法但方法里面没有预下载
       */
      Web({ src: 'www.example.com', controller: this.controller})
        .onPageEnd(() => {
        })
    }
  }
}