@Entry
@Component
struct ImageSizeReport4 {
  build() {
    Column(){
      // warning line
      Image($r('app.media.background'))
        .size({width: 20, height: 20})
    }
    .height('100%')
    .width('100%')
  }
}