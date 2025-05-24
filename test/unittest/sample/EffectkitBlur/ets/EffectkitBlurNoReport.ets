import image from "@ohos.multimedia.image";
import effectKit from '@ohos.effectKit';

@Entry
@Component
struct MyComponent {
  @State isShowStaticBlur: boolean = false;
  @State pixelMap: image.PixelMap | undefined = undefined;

  imgSource: image.ImageSource | undefined = undefined;

  async staticBlur() {
    let context = getContext(this);
    let resourceMgr = context.resourceManager;
    const fileData = await resourceMgr.getRawFileContent('startIcon.png');
    let buffer: ArrayBuffer = fileData.buffer.slice(0);
    this.imgSource = image.createImageSource(buffer);
    let opts: image.InitializationOptions = {
      editable: true,
      pixelFormat: 3,
      size: {
        height: 4,
        width: 6
      }
    };
    await this.imgSource.createPixelMap(opts).then((pixelMap: image.PixelMap) => {
      const blurRadius = 1;
      let headFilter = effectKit.createEffect(pixelMap);
      if (headFilter != null) {
        headFilter.blur(blurRadius);
        headFilter.getEffectPixelMap().then((pixelMap: image.PixelMap) => {
          this.pixelMap = pixelMap;
        });
      }
    })
  }

  @Builder
  staticBlurBuilder() {
    Stack() {
      Image(this.pixelMap)
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Fill)
      Button('close')
        .fontSize(20)
        .onClick(() => {
          this.isShowStaticBlur = false;
        })
    }
    .width('100%')
    .height('100%')
  }

  build() {
    Column({ space: 10 }) {
      Button('静态模糊')
        .onClick(() => {
          this.isShowStaticBlur = true;
          this.staticBlur();
        })
        .bindContentCover(this.isShowStaticBlur, this.staticBlurBuilder(), {
          modalTransition: ModalTransition.DEFAULT
        })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}