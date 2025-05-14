@Entry
@Component
struct ViewDepthReport {
  @State message: string = 'Hello World'
  @State textWidth: string = "";

  build() {
    Column() {
      Image($r("app.media.app_icon")).width("100%").height(300).margin({ bottom: 20 })
      Row() {
        Blank()
        Column() {
          Image($r("app.media.app_icon")).margin({ bottom: 4 }).width(40).aspectRatio(1)
          Text("Name")
          Column() {
            Row() {
              Text("Singapore").fontSize(20).fontWeight(FontWeight.Bolder)
                .margin(8)
                .textAlign(TextAlign.Start)
              Row() {
                Column() {
                  Stack() {
                    Image($r("app.media.app_icon")).width(80).aspectRatio(1).margin({ bottom: 8 })
                    Text("Description")
                    Flex({ alignItems: ItemAlign.Center }) {
                      Text("Camera").flexShrink(0)
                        .margin({ right: 8 })
                      TextInput()
                      Column() {
                        Row() {
                          Stack() {
                            Text("Title").fontWeight(FontWeight.Bold).margin({ bottom: 8 })
                            Text("Long Text")
                            Flex({ justifyContent: FlexAlign.End }) {
                              Button("Upload").margin(8)
                              Button("Discard").margin(8)
                              Column() {
                                Image($r("app.media.app_icon")).width("100%").height(300).margin({ bottom: 20 })
                                Row() {
                                  Blank()
                                  Column() {
                                    Image($r("app.media.app_icon")).margin({ bottom: 4 }).width(40).aspectRatio(1)
                                    Text("Name")
                                    Column() {
                                      Row() {
                                        Text("Singapore").fontSize(20).fontWeight(FontWeight.Bolder)
                                          .margin(8)
                                          .textAlign(TextAlign.Start)

                                        Row() {
                                          Column() {
                                            Stack() {
                                              Image($r("app.media.app_icon")).width(80).aspectRatio(1).margin({ bottom: 8 })
                                              Text("Description")
                                              Flex({ alignItems: ItemAlign.Center }) {
                                                Text("Camera").flexShrink(0)
                                                  .margin({ right: 8 })
                                                TextInput()
                                                Column() {
                                                  Row() {
                                                    Stack() {
                                                      Text("Title").fontWeight(FontWeight.Bold).margin({ bottom: 8 })
                                                      Text("Long Text")
                                                      Flex({ justifyContent: FlexAlign.End }) {
                                                        Button("Upload").margin(8)
                                                        Button("Discard").margin(8)
                                                        Column() {
                                                          Image($r("app.media.app_icon")).width("100%").height(300).margin({ bottom: 20 })
                                                          Row() {
                                                            Blank()
                                                            Column() {
                                                              Image($r("app.media.app_icon")).margin({ bottom: 4 }).width(40).aspectRatio(1)
                                                              Text("Name")
                                                              Column() {
                                                                Row() {
                                                                  Text("Singapore").fontSize(20).fontWeight(FontWeight.Bolder)
                                                                    .margin(8)
                                                                    .textAlign(TextAlign.Start)

                                                                  Row() {
                                                                    Column() {
                                                                      Stack() {
                                                                        Image($r("app.media.app_icon")).width(80).aspectRatio(1).margin({ bottom: 8 })
                                                                        Text("Description")
                                                                        Flex({ alignItems: ItemAlign.Center }) {
                                                                          Text("Camera").flexShrink(0)
                                                                            .margin({ right: 8 })
                                                                          TextInput()
                                                                          Column() {
                                                                            Row() {
                                                                              Stack() {
                                                                                Text("Title").fontWeight(FontWeight.Bold).margin({ bottom: 8 })
                                                                                Text("Long Text")
                                                                                Flex({ justifyContent: FlexAlign.End }) {
                                                                                  Button("Upload").margin(8)
                                                                                  Button("Discard").margin(8)
                                                                                }
                                                                              }
                                                                            }
                                                                          }.margin(8).layoutWeight(1).alignItems(HorizontalAlign.Start)
                                                                        }.margin(8)
                                                                      }
                                                                    }.margin(8)
                                                                  }.margin(8).width("100%").alignItems(VerticalAlign.Top)
                                                                }.width("100%").justifyContent(FlexAlign.Start)



                                                                Flex({ alignItems: ItemAlign.Center }) {
                                                                  Text("Settings").flexShrink(0)
                                                                    .margin({ right: 8 })
                                                                  TextInput()
                                                                }.margin(8)

                                                              }.layoutWeight(1)
                                                            }.margin({ left: 8, right: 8 })
                                                          }.position({ y: 280}).width(("100%"))
                                                          // Empty row
                                                          Row().height(this.textWidth)
                                                        }
                                                        .width("100%").height("100%")
                                                      }
                                                    }
                                                  }
                                                }.margin(8).layoutWeight(1).alignItems(HorizontalAlign.Start)
                                              }.margin(8)
                                            }
                                          }.margin(8)
                                        }.margin(8).width("100%").alignItems((VerticalAlign.Top))
                                      }.width("100%").justifyContent(FlexAlign.Start)
                                    }.layoutWeight(1)
                                  }.margin({ left: 8, right: 8 })
                                }.position({ y: 280 }).width("100%")
                                // Empty row
                                Row().height(this.textWidth)
                              }
                              .width("100%").height("100%")
                            }
                          }
                        }
                      }.margin(8).layoutWeight(1).alignItems(HorizontalAlign.Start)
                    }.margin(8)
                  }
                }.margin(8)
              }.margin(8).width("100%").alignItems((VerticalAlign.Top))
            }.width("100%").justifyContent(FlexAlign.Start)
            Flex({ alignItems: ItemAlign.Center }) {
              Text("Settings").flexShrink(0)
                .margin({ right: 8 })
              TextInput()
            }.margin(8)
          }.layoutWeight(1)
        }.margin({ left: 8, right: 8 })
      }.position({ y: 280 }).width("100%")
      // Empty row 
      Row().height(this.textWidth)
    }
    .width("100%").height("100%")
  }
}