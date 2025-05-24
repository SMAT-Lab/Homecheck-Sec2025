const ADAPTIVE_SCALE = 1.5;

@Component
export struct AppIcan {

  @State icon: string | PixelMap = '';
  @Prop iconSize: number = 1;

  build() {
    let none = ImageInterpolation.Medium;
    Image($r('app.media.pause'))
      .draggable(false)
      .interpolation(none)
  }
}