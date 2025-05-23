@Entry
@Component
struct WhiteBlockReport {
  @State imageUrl1: string = 'https://www.example.com/example.webp';

  build() {
    Column() {
      Image('https://www.example.com/example.JPG')
        .size({ width: 30, height: 30 })

      Image('http://www.example.com/example.JPG')
        .size({ width: 30, height: 30 })

      Image('ftp://username:password@www.example.com/example.JPG')
        .size({ width: 30, height: 30 })

      Image(this.imageUrl1)
        .size({ width: 30, height: 30 })
    }
    .width('100%')
    .height(80)
  }
}