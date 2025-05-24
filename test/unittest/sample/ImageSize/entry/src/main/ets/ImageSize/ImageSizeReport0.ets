@Entry
@Component
struct ImageSizeReport0 {
  build() {
    Column(){
      // warning line
      Image($r('app.media.background'))
        .height('100px')
        .width('100px')
    }
    .height('100%')
    .width('100%')
  }
}