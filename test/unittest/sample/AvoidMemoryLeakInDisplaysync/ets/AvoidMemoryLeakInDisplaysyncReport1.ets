import { displaySync } from '@kit.ArkGraphics2D';

@Entry
@Component
struct Index {
  @State drawFirstSize: number = 25;
  @State drawSecondSize: number = 25;
  // 告警
  private backDisplaySyncSlow: displaySync.DisplaySync | undefined = undefined;
  private backDisplaySyncFast: displaySync.DisplaySync | undefined = undefined;

  CreateDisplaySyncSlow() {
    // 定义期望绘制帧率
    let range: ExpectedFrameRateRange = {
      expected: 30,
      min: 0,
      max: 120
    };

    this.backDisplaySyncSlow = displaySync.create(); // 创建DisplaySync实例
    this.backDisplaySyncSlow.setExpectedFrameRateRange(range); // 设置帧率
  }

  CreateDisplaySyncFast() {
    // 定义期望绘制帧率
    let range: ExpectedFrameRateRange = {
      expected: 60,
      min: 0,
      max: 120
    };

    this.backDisplaySyncFast = displaySync.create(); // 创建DisplaySync实例
    this.backDisplaySyncFast.setExpectedFrameRateRange(range); // 设置帧率
  }

  aboutToDisappear() {
    this.displayStop();
    if (this.backDisplaySyncFast) {
      this.backDisplaySyncFast.stop(); // DisplaySync失能关闭
      this.backDisplaySyncFast = undefined; // 实例置空
    }
  }

  displayStop() {
    if (this.backDisplaySyncSlow) {
      this.backDisplaySyncSlow.stop(); // DisplaySync失能关闭
    }
  }

  build() {
    Column() {
      Row() {
        Button('Start')
          .id('CustomDrawStart')
          .fontSize(14)
          .fontWeight(500)
          .margin({ bottom: 10, left: 5 })
          .fontColor(Color.White)
          .onClick((): void => {
            if (this.backDisplaySyncSlow == undefined) {
              this.CreateDisplaySyncSlow();
            }
            if (this.backDisplaySyncFast == undefined) {
              this.CreateDisplaySyncFast();
            }
            if (this.backDisplaySyncSlow) {
              this.backDisplaySyncSlow.start(); // DisplaySync使能开启
            }
            if (this.backDisplaySyncFast) {
              this.backDisplaySyncFast.start(); // DisplaySync使能开启
            }
          })
          .width('20%')
          .height(40)
          .shadow(ShadowStyle.OUTER_DEFAULT_LG)

        Button('Stop')
          .id('CustomDrawStop')
          .fontSize(14)
          .fontWeight(500)
          .margin({ bottom: 10, left: 5 })
          .fontColor(Color.White)
          .onClick((): void => {
            if (this.backDisplaySyncSlow) {
              this.backDisplaySyncSlow.stop(); // DisplaySync失能关闭
            }
            if (this.backDisplaySyncFast) {
              this.backDisplaySyncFast.stop(); // DisplaySync失能关闭
            }
          })
          .width('20%')
          .height(40)
          .shadow(ShadowStyle.OUTER_DEFAULT_LG)
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
      .shadow(ShadowStyle.OUTER_DEFAULT_SM)
      .alignItems(VerticalAlign.Bottom)
      .layoutWeight(1)
    }
  }
}