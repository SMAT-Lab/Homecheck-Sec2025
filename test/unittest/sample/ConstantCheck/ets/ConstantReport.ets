@Entry
@Component
struct ConstTest {
  @State message: string = 'Hello World';

  build() {
    RelativeContainer() {
      Text(this.message)
        .onClick(() => {
          test();
        })
    }
    .height('100%')
    .width('100%')
  }
}

let a = 1;

function test() {
  let b = a;

  let c = 3;
  if (c === 3) {
    console.log(c.toString());
  }

  let d = 4;
  for (let i = 0; i < 10; i++) {
    console.log(d.toString());
  }
}