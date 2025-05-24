import image from '@ohos.multimedia.image';

let mCubemapPath: string = 'startIcon1.png';
@Entry
@Component
struct Image_Report {
  mCubemapPath = 'startIcon1.png';
  number1 = 1;
  number2 = this.number1;
  @State srcDrawableDescriptor1: DrawableDescriptor = getContext(this).resourceManager.getDrawableDescriptor($r('app.media.icon'));
  @State srcResource: Resource = $r('app.media.impressions_bg_snowscape');
  @State srcDrawableDescriptor2: DrawableDescriptor = getContext(this).resourceManager.getDrawableDescriptor($rawfile('startIcon1.png'));

  onPageShow(): void {
    let imageMedia1 = getContext(this).resourceManager.getDrawableDescriptor($r('app.media.icon2'));
    let bigStr = 'app.media.big';
    let big = $r(bigStr);
    let mediaInfo = $r('app.media.icon3');
    let imageMedia2 = getContext(this).resourceManager.getDrawableDescriptor(mediaInfo.id);
    let fdPromise = getContext(this).resourceManager.getRawFd('notepad/folder_bg_1.png');
    let fd = getContext(this).resourceManager.getRawFdSync('notepad/folder_bg_1.png');
    let imageSourceApi: image.ImageSource = image.createImageSource(fd);
  }

  build() {
    Column() {
      // media资源
      Image('app.media.startIcon')
        .size({width: 30, height: 30})

      // raw资源
      Image('startIcon2.png')
        .size({width: 30, height: 30})

      Image(this.srcDrawableDescriptor1)
        .size({width: 30, height: 30})

      Image(this.srcDrawableDescriptor2)
        .size({width: 30, height: 30})

      Image(this.srcResource)
        .size({width: 30, height: 30})

      Image(getContext(this).resourceManager.getDrawableDescriptor($r('app.media.impressions_bg_snowscape2')))
        .size({width: 30, height: 30})
    }
    .width('100%')
    .height(80)
  }
}