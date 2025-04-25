@Entry
@Component
struct MyComponent {
  build() {
    Column() {
      Scroll(){
        List() {

        }
        .height('100%')
      }
    }
    .width('100%')
    .height('100%')
  }
}