import image from '@ohos.multimedia.image';

@Entry
@Component
struct Image_Report {
  @State srcDrawableDescriptor1: DrawableDescriptor = getContext(this).resourceManager.getDrawableDescriptor($r('app.media.icon'));
  @State srcResource: Resource = $r('app.media.impressions_bg_meteor');
  @State srcDrawableDescriptor2: DrawableDescriptor = getContext(this).resourceManager.getDrawableDescriptor($rawfile('hinote_ic_public_cancel.png'));

  onPageShow(): void {
    let imageMedia1 = getContext(this).resourceManager.getDrawableDescriptor($r('app.media.icon'));
    let mediaInfo = $r('app.media.icon');
    let imageMedia2 = getContext(this).resourceManager.getDrawableDescriptor(mediaInfo.id);
    let fdPromise = getContext(this).resourceManager.getRawFd('notepad/folder_bg_1.png');
    let fd = getContext(this).resourceManager.getRawFdSync('notepad/folder_bg_1.png');
    let imageSourceApi: image.ImageSource = image.createImageSource(fd);
  }

  build() {
    Column() {
      // media资源
      Image($r('app.media.startIcon'))
        .size({width: 30, height: 30})

      // raw资源
      Image($rawfile('ic_disable_color_btn_bound.webp'))
        .size({width: 30, height: 30})
      Image($rawfile('notepad/folder_bg_1.png'))
        .size({width: 30, height: 30})

      Image('../../../../import_image.png')
        .size({width: 30, height: 30})

      Image(this.srcDrawableDescriptor1)
        .size({width: 30, height: 30})

      Image(this.srcDrawableDescriptor2)
        .size({width: 30, height: 30})

      Image(this.srcResource)
        .size({width: 30, height: 30})

      Image(getContext(this).resourceManager.getDrawableDescriptor($r('app.media.impressions_bg_snowscape')))
        .size({width: 30, height: 30})
    }
    .width('100%')
    .height(80)
  }
}