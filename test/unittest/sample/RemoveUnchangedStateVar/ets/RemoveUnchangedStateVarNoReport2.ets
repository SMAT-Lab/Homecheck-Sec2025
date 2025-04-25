import { ListItemComponent1 } from './ListItemComponent1';

@Entry
@Component
struct RemoveUnchangedStateVarNoReport2 {
  @State currentIndex: number = 0;
  private listData: string[] = [];

  aboutToAppear(): void {
    for (let i = 0; i < 10; i++) {
      this.listData.push(`组件 ${i}`);
    }
  }

  build() {
    Row(){
      Column(){
        List(){
          ForEach(this.listData,(item: string, index: number) => {
            ListItem(){
              ListItemComponent1({ item: item, index: index, currentIndex: this.currentIndex })
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