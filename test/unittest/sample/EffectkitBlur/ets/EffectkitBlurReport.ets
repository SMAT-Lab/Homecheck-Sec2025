@Entry
@Component
struct MyComponent{
  build() {
    Column({ space: 10 }) {
      // 对image进行模糊，未使用effectKit.createEffect
      Text('Image blur').fontSize(15).fontColor(0xCCCCCC).width('90%')
      Image('resources/base/media/sss001.jpg').blur(1)
        .border({ width: 1 }).borderStyle(BorderStyle.Dashed).aspectRatio(1).width('90%').height(40)

      // 对背景进行模糊，未使用effectKit.createEffect
      Text('backdropBlur').fontSize(15).fontColor(0xCCCCCC).width('90%')
      Text()
        .width('90%')
        .height(40)
        .fontSize(16)
        .backdropBlur(3)
        .backgroundImage('/pages/attrs/image/image.jpg')
        .backgroundImageSize({ width: 1200, height: 160 })
    }.width('100%').margin({ top: 5 })
  }
}