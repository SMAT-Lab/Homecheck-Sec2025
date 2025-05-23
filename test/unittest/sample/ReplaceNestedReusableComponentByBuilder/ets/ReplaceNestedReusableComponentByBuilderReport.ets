import { GoodItems } from "../../UseReusableComponent/ets/utils/GoodItems";
import { MyDataSource } from "../../UseReusableComponent/ets/utils/MyDataSource";

@Entry
@Component
struct lessEmbeddedComponent {
  private data: MyDataSource = new MyDataSource();

  aboutToAppear(): void {
    for (let index = 0; index < 100; index++) {
      this.data.addData(index, 'index:' + index);
    }
  }

  build() {
    Column() {
      List({ space: 20 }) {
        LazyForEach(this.data, (moment: GoodItems) => {
          ListItem() {
            OneMomentNoBuilder({ moment: moment })
          }
        }, (moment: GoodItems) => moment.index)
      }
      .width('100%')
      .height('100%')
      .cachedCount(20)
    }
  }
}

@Reusable
@Component
export struct OneMomentNoBuilder {
  @Prop moment: GoodItems;

  aboutToReuse(params: Record<string, ESObject>): void {
    this.moment = params.moment;
  }

  // 无需对@Prop修饰的变量进行aboutToReuse赋值，因为这些变量是由父组件传递给子组件的。如果在子组件中重新赋值这些变量，会导致重用的组件的内容重新触发状态刷新，从而降低组件的复用性能。
  build() {
    // 在复用组件中嵌套使用自定义组件
    Row() {
      InteractiveButton({
        imageStr: $r('app.media.ic_share'),
        text: $r('app.string.friendMomentsPage_share')
      })
      Blank()
      InteractiveButton({
        imageStr: $r('app.media.ic_thumbsup'),
        text: $r('app.string.friendMomentsPage_thumbsup')
      })
      Blank()
      InteractiveButton({
        imageStr: $r('app.media.ic_message'),
        text: $r('app.string.friendMomentsPage_message')
      })
    }
  }
}

@Component
export struct InteractiveButton {
  @State imageStr: ResourceStr;
  @State text: ResourceStr;

  // 嵌套的组件中也需要实现aboutToReuse来进行UI的刷新
  aboutToReuse(params: Record<string, Object>): void {
    this.imageStr = params.imageStr as ResourceStr;
    this.text = params.text as ResourceStr;
  }

  build() {
    Row() {
      Image(this.imageStr)
      Text(this.text)
    }
    .alignItems(VerticalAlign.Center)
  }
}