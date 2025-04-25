@Entry
@Component
struct RemoveUnchangedStateVarNoReport1 {
  @State currentIndex: number = 0;
  private  listData: string[] = [];

  aboutToAppear(): void {
    for(let i = 0; i < 10; i++) {
      this.listData.push(`组件 ${i}`);
    }
    this.currentIndex = 10;
  }

  build() {
    Row(){
      Column(){
        List(){
          ForEach(this.listData,(item: string, index: number) => {
            ListItem(){
              ListItemComponent({ item: item, index: index, currentIndex: this.currentIndex })
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
  @Link @Watch('onCurrentIndexUpdate') currentIndex: number;
  @State color: Color = Math.abs(this.index - this.currentIndex) <= 1 ? Color.Red : Color.Blue;

  isRender(): number {
    return 50;
  }

  onCurrentIndexUpdate(){
    this.color = Math.abs(this.index - this.currentIndex) <= 1 ? Color.Red : Color.Blue;
  }

  build() {
    Column(){
      Text(this.item)
        .fontSize(this.isRender())
        .fontColor(Math.abs(this.index - this.currentIndex) <= 1 ? Color.Red : Color.Blue)
        .onClick(() => {
        })
      Text('abc')
    }
  }
}
