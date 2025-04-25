@Entry
@Component
struct ImageSizeReport3 {
  build() {
    Column(){
      Image($r('app.media.background'))
        .height('app.float.icon_width')
        .width('app.float.icon_width')
    }
    .height('100%')
    .width('100%')
  }
}