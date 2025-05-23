@Entry
@Component
struct lessEmbeddedComponent {
  aboutToAppear(): void {
    getFriendMomentFromRawfile();
  }

  build() {
    Column() {
      TopBar()
      List({ space: ListConstants.LIST_SPACE }) {
        LazyForEach(momentData, (moment: FriendMoment) => {
          ListItem() {
            OneMoment({moment: moment})
          }
        }, (moment: FriendMoment) => moment.id)
      }
      .cachedCount(Constants.CACHED_COUNT)
    }
  }
}

@Reusable
@Component
export struct OneMoment {
  @Prop moment: FriendMoment;

  build() {
    ...
    // 使用@Builder，可以减少自定义组件创建和渲染的耗时
    Row() {
      interactiveButton({
        imageStr: $r('app.media.ic_share'),
        text: $r('app.string.friendMomentsPage_share')
      })
      Blank()
      interactiveButton({
        imageStr: $r('app.media.ic_thumbsup'),
        text: $r('app.string.friendMomentsPage_thumbsup')
      })
      Blank()
      interactiveButton({
        imageStr: $r('app.media.ic_message'),
        text: $r('app.string.friendMomentsPage_message')
      })
    }
    ...
  }
}

class Temp {
  imageStr: ResourceStr = '';
  text: ResourceStr = '';
}

@Builder
export function interactiveButton($$: Temp) {
  Row() {
    // 此处使用$$来进行按引用传递，让@Builder感知到数据变化，进行UI刷新
    Image($$.imageStr)
    Text($$.text)
  }
}