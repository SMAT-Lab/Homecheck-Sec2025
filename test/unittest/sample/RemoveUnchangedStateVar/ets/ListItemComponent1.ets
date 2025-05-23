@Component
export struct ListItemComponent1{
  @Prop item: string;
  @Prop index: number;
  @Link currentIndex: number;
  private sizeFont: number = 50;

  isRender(): number {
    return this.sizeFont;
  }

  build() {
    Column(){
      Text(this.item)
        .fontSize(this.isRender())
        .fontColor(Math.abs(this.index - this.currentIndex) <= 1 ? Color.Red : Color.Blue)
        .onClick(() => {
          this.currentIndex = this.index;
        })
      Text('abc')
    }
  }
}