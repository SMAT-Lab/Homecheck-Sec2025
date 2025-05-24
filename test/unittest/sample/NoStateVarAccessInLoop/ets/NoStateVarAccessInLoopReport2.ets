import { HashMap } from '@kit.ArkTS';
import { hilog } from '@kit.PerformanceAnalysisKit';

@Observed
class MyStateData {
  id: number = 0;
  name: string = '';
  isFemale: boolean = false;
}

@Entry
@Component
struct NoStateVarAccessInLoopReport2 {
  @State message: string = '';
  @State mData: MyStateData = new MyStateData();
  @State arr: number[] = [1, 2, 3];
  @State map: HashMap<string, string> = new HashMap<string, string>();

  build() {
    Column(){
      Button('打印日志')
        .width('90%')
        .backgroundColor(Color.Blue)
        .fontColor(Color.White)
        .margin({ top: 10 })
      CustomView({msg: this.message, data: this.mData})
    }
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Center)
    .margin({ top: 15 })
  }
}

@Reusable
@Component
export struct CustomView {
  @Prop @Watch('abc') msg: string;
  @ObjectLink @Watch('cad') data: MyStateData;

  aboutToReuse(params: Record<string, ESObject>): void {
    this.data = params as MyStateData;
  }

  abc() {
    this.msg = '';
  }

  cad() {
    this.data.name = 'zhangsan';
  }

  myLoopFunc() {
    let y = 20;
    do{
      hilog.info(0x0000, 'TAG', '%{public}s', this.msg);
    }while (y <  10);
  }

  build() {
    Column() {
      Text(this.msg)
      if(this.data.isFemale) {
        Flex({ wrap: FlexWrap.Wrap }) {
          Image(this.data.id)
        }
      }
    }
  }
}