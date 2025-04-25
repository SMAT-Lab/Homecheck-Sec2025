import { media } from '@kit.MediaKit'

@Entry
@Component
struct Index {
  private avPlayer: media.AVPlayer | undefined = undefined;

  aboutToAppear(): void {
    //页面创建时初始化AVPlayer实例
    media.createAVPlayer().then((ret) => {
      this.avPlayer = ret;
    })
  }

  aboutToDisappear(): void {
    //离开页面时销毁AVPlayer实例
    if (this.avPlayer) {
      this.avPlayer.release();
    }
    this.avPlayer = undefined;
  }

  build() {
    //组件布局
  }
}
