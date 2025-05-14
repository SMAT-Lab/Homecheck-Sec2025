// 源码文件，请以工程实际为准
import { MyDataSource } from './MyDataSource';

// 此处为复用的自定义组件
@Reusable
@Component
struct ChildComponent {
  @State desc: string = '';
  @State sum: number = 0;

  aboutToReuse(params: Record<string, Object>): void {
    this.desc = params.desc as string;
    this.sum = params.sum as number;
  }

  build() {
    Column() {
      Text('子组件' + this.desc)
        .fontSize(30)
        .fontWeight(30)
      Text('结果' + this.sum)
        .fontSize(30)
        .fontWeight(30)
    }
  }
}

@Entry
@Component
struct MyComponent {
  private data: MyDataSource = new MyDataSource();

  aboutToAppear(): void {
    for (let index = 0; index < 20; index++) {
      this.data.pushData(index.toString())
    }
  }

  // 真实场景的函数中可能存在未知的耗时操作逻辑，此处用循环函数模拟耗时操作
  count(): number {
    let temp: number = 0;
    for (let index = 0; index < 10000; index++) {
      temp += index;
    }
    return temp;
  }

  build() {
    Column() {
      List() {
        LazyForEach(this.data, (item: string) => {
          ListItem() {
            // 此处sum参数是函数获取的，实际开发场景无法预料该函数可能出现的耗时操作，每次进行组件复用都会重复触发此函数的调用
            ChildComponent({ desc: item, sum: this.count() })
          }
          .width('100%')
          .height(100)
        }, (item: string) => item)
      }
      .height('100%')
      .width('100%')
    }
  }
}