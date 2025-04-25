@Entry
@Component
struct MyComponent {
  @State w: number = 150;
  @State h: number = 2;
  @State brightNum: number = 1.5;
  @State color: Color = Color.Red;

  func1() {
    animateTo({curve: Curve.Sharp, duration: 1000}, () => {
      this.w = (this.w === 80 ? 150 : 80);
    });
  }

  func2() {
    animateTo({curve: Curve.Sharp, duration: 1000}, () => {
      this.color = (this.color === Color.Yellow ? Color.Red : Color.Yellow);
    });
  }

  func3() {
    animateTo({curve: Curve.Sharp, duration: 1000}, () => {
      this.h = (this.h === 2 ? 5 : 2);
    });
  }

  func4() {
    animateTo({curve: Curve.Sharp, duration: 1000}, () => {
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
          this.func1();
          this.func2();
          this.func3();
          this.func4();
        })
    }
  }
}