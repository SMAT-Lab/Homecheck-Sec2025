@Entry
@Component
struct RemoveUnchangedStateVarReport {
  @State currentIndex: number = 0;
  private  listData: string[] = [];

  aboutToAppear(): void {
    for(let i = 0; i < 10; i++) {
      this.listData.push(`组件 ${i}`);
    }
  }

  build() {
    Row(){
      Column(){
        List(){
          ForEach(this.listData,(item: string, index: number) => {
            ListItem(){
              ListItemComponent({ item: item, index: index, subCurrentIndex: this.currentIndex })
            }
          })
        }
        .width('100%')
        .height('100%')
        .alignListItem(ListItemAlign.Center)
      }
      .width('100%')
    }
    .height('100%')
  }
}

@Component
struct ListItemComponent {
  @Prop item: string;
  @Prop index: number;
  @Link subCurrentIndex: number;
  private  sizeFont: number = 50;

  isRender(): number {
    console.info(`ListItemComponent ${this.index} Text is rendered`);
    return this.sizeFont;
  }

  build() {
    Column(){
      Text(this.item)
        .fontSize(this.isRender())
        .fontColor(Math.abs(this.index - this.subCurrentIndex) <= 1 ? Color.Red : Color.Blue)
        .onClick(() => {
        })
      Text('abc')
    }
  }
}