@Observed
class ClassA {
  public c: number = 0;
  constructor(c: number) {
    this.c = c;
  }
}
@Component
struct PropChild {
  // @Prop 装饰状态变量会深拷贝
  @Prop testNum: ClassA;
  build() {
    Text(`PropChild testNum ${this.testNum.c}`)
  }
}
@Entry
@Component
struct Parent {
  @State testNum: ClassA[] = [new ClassA(1)];
  build() {
    Column() {
      Text(`Parent testNum ${this.testNum[0].c}`)
        .onClick(() => {
          this.testNum[0].c += 1;
        })
      // PropChild没有改变@Prop testNum: ClassA的值，所以这时最优的选择是使用@ObjectLink
      PropChild({ testNum: this.testNum[0] })
    }
  }
}