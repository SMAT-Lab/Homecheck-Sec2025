import { displaySync } from '@kit.ArkGraphics2D';

@Entry
@Component
struct Index {
  @State rotateAngle: number = 1;
  private backDisplaySyncSlow: displaySync.DisplaySync | undefined = undefined;
  private backDisplaySyncFast: displaySync.DisplaySync | undefined = undefined;
  private isBigger_30: boolean = true;

  aboutToDisappear() {
    if (this.backDisplaySyncSlow) {
      this.backDisplaySyncSlow.stop(); // DisplaySync使能关闭
      this.backDisplaySyncSlow = undefined; // 实例置空
    }
    if (this.backDisplaySyncFast) {
      this.backDisplaySyncFast.stop(); // DisplaySync使能关闭
      this.backDisplaySyncFast = undefined; // 实例置空
    }
  }

  CreateDisplaySyncSlow() {
    let range: ExpectedFrameRateRange = {
      expected: 120,
      min: 120,
      max: 120
    };
    // 定义期望绘制帧率
    this.backDisplaySyncSlow = displaySync.create(); // 创建DisplaySync实例
    this.backDisplaySyncSlow.setExpectedFrameRateRange(range); // 设置帧率
    let draw30 = (intervalInfo: displaySync.IntervalInfo) => {
      if (this.isBigger_30) {
        this.rotateAngle += 1;
      } else {
        this.rotateAngle -= 1;
        if (this.rotateAngle < 25) {
          this.isBigger_30 = true;
        }
      }
    };
    this.backDisplaySyncSlow.on("frame", draw30); // 订阅frame事件和注册订阅函数
  }

  build() {
    Column() {
      Row() {
        Button('Start')
          .onClick(() => {
            if (this.backDisplaySyncSlow === undefined) {
              this.CreateDisplaySyncSlow();
            }
            if (this.backDisplaySyncSlow) {
              this.backDisplaySyncSlow.start(); // DisplaySync使能开启
            }
          })
      }
    }
  }
}