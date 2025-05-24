@Entry
@Component
struct ViewDepthNoReport {
  @State message: string = 'Hello World'

  build() {
    RelativeContainer() {
      Image($r("app.media.app_icon"))
        .width("100%")
        .height(300)
        .id("topImage")
        .alignRules({
          left: { anchor: "__container__",align: HorizontalAlign.Start },
          top: { anchor: "__container__",align: VerticalAlign.Top }
        })
      Image($r("app.media.app_icon"))
        .width(40)
        .aspectRatio(1)
        .margin(4)
        .id("topCornerImage")
        .alignRules({
          right: { anchor: "__container__",align: HorizontalAlign.End },
          center: { anchor: "topImage",align: VerticalAlign.Bottom }
        })
      Text("Name")
        .id("name")
        .margin(4)
        .alignRules({
          left: { anchor: "topCornerImage",align: HorizontalAlign.Start },
          top: { anchor: "topCornerImage",align: VerticalAlign.Bottom }
        })
      Text("Singapore")
        .margin(8)
        .fontWeight(FontWeight.Bolder)
        .fontSize(20)
        .id("singapore")
        .alignRules({
          left: { anchor: "__container__",align: HorizontalAlign.Start },
          top: { anchor: "name",align: VerticalAlign.Bottom }
        })
      Text("Camera")
        .margin(8)
        .id("camera")
        .alignRules({
          left: { anchor: "__container__",align: HorizontalAlign.Start },
          top: { anchor: "singapore",align: VerticalAlign.Bottom }
        })
      TextInput()
        .id("cameraInput")
        .alignRules({
          left: { anchor: "camera",align: HorizontalAlign.End },
          right: { anchor: "__container__",align: HorizontalAlign.End },
          top: { anchor: "camera",align: VerticalAlign.Top },
          bottom: { anchor: "camera",align: VerticalAlign.Bottom }
        })
      Text("Settings")
        .margin(8)
        .id("settings")
        .alignRules({
          left: { anchor: "__container__",align: HorizontalAlign.Start },
          top: { anchor: "camera",align: VerticalAlign.Bottom }
        })
      TextInput()
        .id("settingInput")
        .alignRules({
          left: { anchor: "settings",align: HorizontalAlign.End },
          right: { anchor: "__container__",align: HorizontalAlign.End },
          top: { anchor: "settings",align: VerticalAlign.Top },
          bottom: { anchor: "settings",align: VerticalAlign.Bottom }
        })
      Image($r("app.media.app_icon"))
        .id("descriptionIcon")
        .margin(8)
        .width(80)
        .aspectRatio(1)
        .alignRules({
          left: { anchor: "__container__",align: HorizontalAlign.Start },
          top: { anchor: "settings",align: VerticalAlign.Bottom }
        })
      Text("Description")
        .id("description")
        .margin(8)
        .alignRules({
          left: { anchor: "__container__",align: HorizontalAlign.Start },
          top: { anchor: "descriptionIcon",align: VerticalAlign.Bottom }
        })
      Text("Title")
        .fontWeight(FontWeight.Bold)
        .id("title")
        .margin(8)
        .alignRules({
          left: { anchor: "description",align: HorizontalAlign.End },
          top: { anchor: "descriptionIcon",align: VerticalAlign.Top }
        })
      Text("Long Text")
        .id("longText")
        .margin(8)
        .alignRules({
          left: { anchor: "description",align: HorizontalAlign.End },
          right: { anchor: "__container__",align: HorizontalAlign.End },
          top: { anchor: "title",align: VerticalAlign.Bottom }
        })
      Button("Discard")
        .id("discard")
        .margin(8)
        .alignRules({
          right: { anchor: "__container__",align: HorizontalAlign.End },
          bottom: { anchor: "__container__",align: VerticalAlign.Bottom }
        })
      Button("Upload")
        .id("upload")
        .margin(8)
        .alignRules({
          right: { anchor: "discard",align: HorizontalAlign.Start },
          bottom: { anchor: "__container__",align: VerticalAlign.Bottom }
        })
    }.width("100%").height("100%")
  }
}