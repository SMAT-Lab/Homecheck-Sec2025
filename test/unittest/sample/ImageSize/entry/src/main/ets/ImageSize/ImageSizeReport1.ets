@Entry
@Component
struct ImageSizeReport1 {
  build() {
    Column(){
      // warning line
      Image($r('app.media.background'))
        .height('20vp')
        .width('20vp')
    }
    .height('100%')
    .width('100%')
  }
}