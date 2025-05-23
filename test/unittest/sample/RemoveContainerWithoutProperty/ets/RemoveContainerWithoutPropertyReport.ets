@Entry
@Component
struct ViewDepthReport {
  build() {
    Row() {
      Column() {
        Flex() {
          Row() {
            Column() {
              Text('text1')
            }

            Stack() {
              Text('text2')
            }
          }
          .backgroundColor(Color.White)
        }
        .backgroundColor(Color.Blue)
      }
    }
    .width(200)
    .height(200)
  }
}