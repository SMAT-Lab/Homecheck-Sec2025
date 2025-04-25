import { hilog } from '@kit.PerformanceAnalysisKit';

@Observed
class MyStateData {
  id: number = 0;
  name: string = '';
  isFemale: boolean = false;
}

@Entry
@Component
struct NoStateVarAccessInLoopNoReport {
  @State message: string = '';
  @State mData: MyStateData = new MyStateData();

  build() {
    Column(){
      Button('打印日志')
        .onClick(() => {
          let logMessage: string = this.message;
          let mData = this.mData;
          for(let i = 0; i < 10; i++){
            hilog.info(0x0000, 'TAG', '%{public}s', logMessage);
            hilog.info(0x0000, 'TAG', '%{public}s', mData.name);
          }
        })
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