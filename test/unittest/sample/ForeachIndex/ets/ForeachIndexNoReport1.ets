@Entry
@Component
struct ForeachTest {
  private data: string[] = ['1', '2', '3'];

  build() {
    RelativeContainer() {
      List() {
        ForEach(this.data, (item: string, index: number) => {
          ListItem() {
            Text(item);
          }
        }, (item: string, index: number) => item)
      }
      .height('100%')
      .width('100%')
    }
    .height('100%')
    .width('100%')
  }
}