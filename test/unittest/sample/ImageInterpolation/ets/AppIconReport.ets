const ADAPTIVE_SCALE = 1.5;

@Component
export struct AppIcan {

  @State icon: string | PixelMap = '';
  @Prop iconSize: number = 1;

  @Builder
  overlayIcon(){
    Image(this.icon)
      .height(this.iconSize * ADAPTIVE_SCALE)
      .width(this.iconSize * ADAPTIVE_SCALE)
      .interpolation(ImageInterpolation.None)
  }

  build() {
    this.overlayIcon();
    Image($r('app.media.pause'))
      .draggable(false)
      .interpolation(ImageInterpolation.None)
  }
}