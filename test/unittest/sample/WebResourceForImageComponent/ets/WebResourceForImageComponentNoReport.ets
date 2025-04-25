@Entry
@Component
struct WhiteBlockNoReport {
  @State imageUrl2: string | undefined = undefined;
  @State imageMedia1: Resource = $r('app.media.layered_image');
  @State imageRaw1: Resource = $rawfile('notepad/blackwhite_bg_seagulls.png');

  onPageShow(): void {
    this.imageUrl2 = 'https://www.example.com/example.png';
  }

  build() {
    Column() {
      Image(this.imageUrl2 !== undefined ? this.imageUrl2 : '')
        .size({ width: 30, height: 30 })

      Image(this.getImageSrc())
        .size({ width: 30, height: 30 })

      Image(this.imageMedia1)
        .size({ width: 30, height: 30 })

      Image(this.imageRaw1)
        .size({ width: 30, height: 30 })
    }
    .width('100%')
    .height(80)
  }

  getImageSrc(): string {
    return '';
  }
}