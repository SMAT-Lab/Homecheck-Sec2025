import { ListItemComponent } from './ListItemComponent';

@Entry
@Component
struct MultipleAssociationsStateVarReport {
  @State currentIndex: number = 0;
  private listData: string[] = [];

  aboutToAppear(): void {
    for (let i = 0; i < 10; i++) {
      this.listData.push(`ListItemComponent ${i}`);
    }
    this.currentIndex = 10;
  }

  build() {
    Row() {
      Column() {
        List() {
          ForEach(this.listData, (item: string, index: number) => {
            ListItem() {
              ListItemComponent({ item: item, index: index, currentIndex: this.currentIndex })
            }
          })
        }
        .width('100%')
        .height('100%')
        .alignListItem(ListItemAlign.Center)
      }
      .width('100%')
      .height('100%')
    }
    .height('100%')
  }
}
