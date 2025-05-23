import webview from '@ohos.web.webview'

@Entry
@Component
struct PrefetchPageNoReport1 {
  controller: webview.WebviewController = new webview.WebviewController();

  aboutToAppear(): void {
    console.log('aboutToAppear');
  }
  
  build() {
    Column() {
      /**
       * @tc.number: PagePrefetchTest_004
       * @tc.name: 有Web组件，有aboutToAppear方法但方法里面没有预下载
       * @tc.desc: 有Web组件，有aboutToAppear方法但方法里面没有预下载
       */
      Web({ src: 'www.example.com', controller: this.controller})
    }
  }
}