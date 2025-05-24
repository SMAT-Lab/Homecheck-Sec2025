import { hilog } from '@kit.PerformanceAnalysisKit';

@Observed
class MyStateData {
  id: number = 0;
  name: string = '';
  isFemale: boolean = false;
}

@Entry
@Component
struct NoStateVarAccessInLoopReport5 {
  @State message: string = '';
  @State mData: MyStateData = new MyStateData();

  aboutToAppear(): void {
    let i = 0;
    do {
      this.myForFunc();
      i++;
    }while (i < 10);
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