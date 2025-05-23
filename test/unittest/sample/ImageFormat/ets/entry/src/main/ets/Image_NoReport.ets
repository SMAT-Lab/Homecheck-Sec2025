import image from '@ohos.multimedia.image';

@Entry
@Component
struct Image_Report {
  @State resImageBitmap: image.PixelMap | null = null;
  @State netImageBitmap: image.PixelMap | null = null;
  @State mediaImage: DrawableDescriptor = getContext(this).resourceManager.getDrawableDescriptor($r('app.media.icon'));
  @State srcPixelMap: image.PixelMap | null = null;
  @State mediaArr: Resource[] = [$r('app.media.impressions_bg_pink_moon'), $r('app.media.impressions_bg_snowscape')];
  @State rawArr: string[] = ['hinote_ic_public_cancel.png', 'notepad/base_bg_6.png'];

  aboutToAppear(): void {
    let resImagePath = getContext(this).resourceDir + 'abc.jpg';
    getContext(this).resourceManager.getRawFd(resImagePath).then((rawfd) => {
      let imageSrc = image.createImageSource(rawfd);
      if(imageSrc){
        imageSrc.createPixelMap().then((pixelMap: image.PixelMap) => {
          this.resImageBitmap = pixelMap;
        })
      }
    })
  }

  build() {
    Column() {
      // res资源
      Image('/data/storage/el1/bundle/entry/resources/resfile/abc.png')
        .size({width: 30, height: 30})

      // 网络资源
      Image('https://www.example.com/example.JPG')
        .size({width: 30, height: 30})

      // 媒体库资源
      Image('file://media/Photos/5')
        .size({width: 30, height: 30})

      Image('../../../resource/resfile/' + 'import_image.png')
        .size({width: 30, height: 30})

      Image(this.mediaArr[0])
        .size({width: 30, height: 30})

      Image(this.rawArr[0])
        .size({width: 30, height: 30})

      Image(this.srcPixelMap)
        .size({width: 30, height: 30})
    }
    .width('100%')
    .height(80)
  }
}