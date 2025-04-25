@Entry
@Component
struct ImageSizeNoReport0 {
  build() {
    Column(){
      Image($r('app.media.background'))
        .height('900px')
        .width('900px')
      Image($r('app.media.background'))
        .height('200vp')
        .width('200vp')
      Image($r('app.media.background'))
        .height(200)
        .width(200)
      Image($r('app.media.background'))
        .size({width: 300, height: 300})
      Row()
        .backgroundImage($r('app.media.background'))
        .height(400)
        .width(400)
    }
    .height('100%')
    .width('100%')
  }
}