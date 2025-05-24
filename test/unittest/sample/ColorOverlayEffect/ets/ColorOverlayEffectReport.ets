@Component
struct ColorNormal {
  @Prop isSelected: boolean = false;

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column()
        .width('100%')
        .height(100)
        .backgroundColor(this.isSelected ? Color.Blue : Color.Grey)
        .borderRadius(12)
        .alignItems((HorizontalAlign.Center))
        .justifyContent(FlexAlign.Center)
      Column()
        .width('100%')
        .height(100)
        .backgroundColor(this.isSelected ? "#99000000" : Color.Grey)
        .borderRadius(12)
        .alignItems((HorizontalAlign.Center))
        .justifyContent(FlexAlign.Center)
    }
  }
}

@Entry
@Component
struct Index {
  @State isSelected: boolean = false;

  build() {
    Scroll() {
      Column() {
        ColorNormal({ isSelected: this.isSelected })
          .onClick(() => {
            this.isSelected = !this.isSelected;
          })
      }
    }
  }
}