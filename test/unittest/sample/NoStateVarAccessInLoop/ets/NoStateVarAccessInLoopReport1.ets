import { HashMap } from '@kit.ArkTS';
import { hilog } from '@kit.PerformanceAnalysisKit';

@Observed
class MyStateData {
  id: number = 0;
  name: string = '';
  isFemale: boolean = false;

  public setName(name: string) {
    this.name = name;
  }

  public  getName(): string {
    return this.name;
  }
}

@Entry
@Component
struct NoStateVarAccessInLoopReport1 {
  @State message: string = '';
  @State mData: MyStateData = new MyStateData();
  @State arr: number[] = [1, 2, 3];
  @State map: HashMap<string, string> = new HashMap<string, string>();

  func2(data: MyStateData){
    hilog.info(0x0000, 'TAG', '%{public}s', data.name);
  }

  build() {
    Column(){
      Button('打印日志')
        .onClick(() => {
          for(let i = 0; i < 10; i++){
            this.message = 'abc';
            hilog.info(0x0000, 'TAG', '%{public}s', this.message);
            hilog.info(0x0000, 'TAG', '%{public}s', this.mData.name);
            this.mData.getName();
            this.func2(this.mData);
            let x = 10;
            while (x > 10){
              hilog.info(0x0000, 'TAG', '%{public}s', this.arr[0]);
              this.arr[0] = 12;
              let y = 20;
              do{
                hilog.info(0x0000, 'TAG', '%{public}s', this.map.get('abc'));
                this.map.set('jjk', 'hello');
              }while (y < 10);
            }
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
