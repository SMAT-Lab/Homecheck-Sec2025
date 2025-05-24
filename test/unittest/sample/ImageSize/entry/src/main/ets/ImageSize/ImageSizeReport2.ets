@Entry
@Component
struct ImageSizeReport2 {
  build() {
    Column(){
      // warning line
      Image($r('app.media.background'))
        .height(20)
        .width(20)
    }
    .height('100%')
    .width('100%')
  }
}