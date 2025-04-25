const ADAPTIVE_SCALE = 1.5;

@Component
export struct AppIcan {

  @State icon: string | PixelMap = '';
  @Prop iconSize: number = 1;
  private mInterpolation: ImageInterpolation = ImageInterpolation.Medium;

  aboutToAppear(): void {
    this.mInterpolation = ImageInterpolation.None;
  }

  @Builder
  overlayIcon(){
    Image(this.icon)
      .height(this.iconSize * ADAPTIVE_SCALE)
      .width(this.iconSize * ADAPTIVE_SCALE)
      .interpolation(this.mInterpolation)
  }

  build() {
    this.overlayIcon();
    this.overlayIcon1();
    Image($r('app.media.pause'))
      .draggable(false)
      .interpolation(this.mInterpolation)
  }
}