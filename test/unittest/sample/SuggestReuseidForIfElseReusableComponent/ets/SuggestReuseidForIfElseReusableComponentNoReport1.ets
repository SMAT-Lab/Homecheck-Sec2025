import router from "@ohos.router";
import { MyDataSource } from "./utils/MyDataSource";

@Entry
@Component
struct ListPageNoReport1 {
  private data: MyDataSource = new MyDataSource();

  aboutToAppear(): void {
    for (let index = 0; index < 100; index++) {
      this.data.addData(index, 'index:' + index);
    }
  }

  build() {
    Column() {
      List() {
        LazyForEach(this.data, (item: string, index: number) => {
          ListItem() {
            ChildItem({ item: item }).reuseId(this.data.getReuseIdByIndex(index))
          }
          .onClick(() => {
            router.pushUrl({ url: 'pages/ThirdPage' })
          })
        }, (item: string) => item)
      }
      .width('100%')
      .height('100%')
      .cachedCount(20)
    }
  }
}

@Reusable
@Component
struct ChildItem {
  item: string = '';

  aboutToReuse(params: Record<string, ESObject>): void {
    this.item = params.item;
  }

  build() {
    Column() {
      Text(this.item)
        .fontSize(50)
      Row() {
        if (this.item === '') {
          Image($r('app.media.startIcon')).width(100).height(100)
        } else if (this.item === '123') {
          Image($r('app.media.background')).width(100).height(100)
        } else {
          Image($r('app.media.foreground')).width(100).height(100)
        }
      }
    }
  }
}
