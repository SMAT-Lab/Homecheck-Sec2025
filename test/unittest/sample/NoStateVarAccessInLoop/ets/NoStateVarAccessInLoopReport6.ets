import { hilog } from '@kit.PerformanceAnalysisKit';

@Observed
class MyStateData {
  id: number = 0;
  name: string = '';
  isFemale: boolean = false;
}

@Entry
@Component
struct NoStateVarAccessInLoopReport6 {
  @State message: string = '';
  @State mData: MyStateData = new MyStateData();

  aboutToAppear(): void {
    let arr: number[] = [1, 2, 3, 4, 5];
    arr.forEach((val) => {
      hilog.info(0x0000, 'TAG', '%{public}s', this.message);
      hilog.info(0x0000, 'TAG', '%{public}s', this.mData.name);
    });

    arr.every((val) => {
      this.myForFunc();
    });

    arr.some((val) => {
      this.myForFunc();
    });

    arr.map((val) => {
      this.myForFunc();
    });

    arr.flatMap((val) => {
      this.myForFunc();
    });

    arr.find((val) => {
      this.myForFunc();
    });

    arr.filter((val) => {
      this.myForFunc();
    });
  }

  myForFunc() {
    hilog.info(0x0000, 'TAG', '%{public}s', this.message);
    hilog.info(0x0000, 'TAG', '%{public}s', this.mData.name);
  }

  build() {
    Column(){
      Button('打印日志')
        .width('90%')
        .backgroundColor(Color.Blue)
        .fontColor(Color.White)
        .margin({ top: 10 })
    }
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Center)
    .margin({ top: 15 })
  }
}