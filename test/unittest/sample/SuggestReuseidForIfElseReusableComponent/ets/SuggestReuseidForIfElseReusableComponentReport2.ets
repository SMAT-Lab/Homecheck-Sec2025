import { FriendMoment } from "./utils/FriendMoment";
import { MyDataSource } from "./utils/MyDataSource";

@Entry
@Component
struct ListPageNoReport2 {
  private data: MyDataSource = new MyDataSource();

  aboutToAppear(): void {
    for (let index = 0; index < 100; index++) {
      this.data.addData(index, 'index:' + index);
    }
  }

  build() {
    Column() {
      List({ space: 10 }) {
        LazyForEach(this.data, (moment: FriendMoment) => {
          ListItem() {
            OneMoment({ moment: moment })
          }
        }, (moment: FriendMoment) => moment.id)
      }
      .width('100%')
      .height('100%')
      .cachedCount(20)
    }
  }
}

@Reusable
@Component
struct OneMoment {
  moment: FriendMoment = new FriendMoment();

  aboutToReuse(params: Record<string, ESObject>): void {
    this.moment = params.moment;
  }

  build() {
    Column() {
      Text(this.moment.text)
      if (this.moment.imgVisible) {
        Flex({ wrap: FlexWrap.Wrap }) {
          Image($r(this.moment.image))
          Image($r(this.moment.image))
          Image($r(this.moment.image))
          Image($r(this.moment.image))
        }
      }
    }
  }
}