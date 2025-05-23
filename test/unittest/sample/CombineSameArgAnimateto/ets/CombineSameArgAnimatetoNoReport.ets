@Entry
@Component
struct MyComponent {
  @State w: number = 150;
  @State h: number = 2;
  @State brightNum: number = 1.5;
  @State color: Color = Color.Red;

  func() {
    animateTo({curve: Curve.Sharp, duration: 1000}, () => {
      this.w = (this.w === 80 ? 150 : 80);
      this.color = (this.color === Color.Yellow ? Color.Red : Color.Yellow);
      this.h = (this.h === 2 ? 5 : 2);
      this.brightNum = (this.brightNum === 1.5 ? 1 : 1.5);
    });
  }

  build() {
    Column() {
      Row()
        .width(this.w)
        .backgroundColor(this.color)
        .height(this.h)
        .brightness(this.brightNum)
      Button("click oneFunc")
        .onClick(() => {
          let doTimes = 10;
          this.func();
        })
    }
  }
}