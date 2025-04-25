@Entry
@Component
struct ViewDepthNoReport {
  build() {
    Row() {
      Text('text')
        .fontSize(12)
    }
    .backgroundColor(Color.Red)
    .width(200)
    .height(200)
  }
}