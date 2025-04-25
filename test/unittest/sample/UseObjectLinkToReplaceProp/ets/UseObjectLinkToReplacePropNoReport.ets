@Observed
class ClassA {
  public c: number = 0;
  constructor(c: number) {
    this.c = c;
  }
}
@Component
struct PropChild {
  // @ObjectLink 装饰状态变量不会深拷贝
  // 当修饰为ObjectLink时 ClassA必须同时被Observed修饰
  @ObjectLink testNum: ClassA;
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
      // 当子组件不需要发生本地改变时，优先使用@ObjectLink，因为@Prop是会深拷贝数据，具有拷贝的性能开销，所以这个时候@ObjectLink是比@Link和@Prop更优的选择
      PropChild({ testNum: this.testNum[0] })
    }
  }}