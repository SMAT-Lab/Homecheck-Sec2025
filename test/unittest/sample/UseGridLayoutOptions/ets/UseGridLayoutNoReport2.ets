@Entry
@Component
struct UseGridLayoutNoReport2 {

  private datasource: string[] = [];
  scroller:Scroller = new Scroller();

  build() {
    Column({space: 5 }){
      Text('使用columnStrart,columnEnd设置GridItem大小').fontColor(0xCCCCCC).fontSize(9).width('90%')
      Grid(this.scroller){
        ForEach(this.datasource,(item: string, index: number) => {
          if(index % 4 === 0){
            GridItem(){
              Text(item)
                .fontSize(16)
                .fontColor('block')
            }
            .columnStart(0).columnEnd(2)
          } else {
            GridItem(){
              Text(item)
                .fontSize(16)
                .fontColor('block')
            }
          }
        },(item: string) => item)
      }
      .cachedCount(5)
      .columnsTemplate('1fr 1fr 1fr')
      .columnsGap(10)
      .rowsGap(10)
      .width('90%')
      .height('40%')

      Button("scrollToIndex:1900").onClick(() => {
        this.scroller.scrollToIndex((1900));
      })
    }
    .width('100%')
    .margin({ top: 5 })
  }
}