@Entry
@Component
struct ImageSizeReport5 {
  build() {
    Column(){
      Row()
        // warning line
        .backgroundImage($r('app.media.background'))
        .height(20)
        .width(20)
    }
    .height('100%')
    .width('100%')
  }
}