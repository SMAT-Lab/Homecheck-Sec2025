import webview from '@ohos.web.webview'

@Entry
@Component
struct PrefetchPageReport3 {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      /**
       * @tc.number: PagePrefetchTest_003
       * @tc.name: 有Web组件，有onAppear方法但方法里面没有预下载
       * @tc.desc: 有Web组件，有onAppear方法但方法里面没有预下载
       */
      Web({ src: 'www.example.com', controller: this.controller})
        .onAppear(() => {
        })
    }
  }
}