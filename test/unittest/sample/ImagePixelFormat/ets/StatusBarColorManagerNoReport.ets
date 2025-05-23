import image from '@ohos.multimedia.image';

const enum WallpaperType {
  DESKTOP,
  SCEENLOCK,
};

class StatusBarColorManager {

  private getDecdingOptions(imageInfo: image.ImageInfo, width: number, height: number): image.DecodingOptions {
    let decodingOptions: image.DecodingOptions = {
      editable: true,
      desiredPixelFormat: image.PixelMapFormat.RGBA_8888,
    };
    return decodingOptions;
  }

  private async getWallpaper(wallpaperType: WallpaperType, width: number, height: number): Promise<PixelMap | null> {
    let imageSource: image.ImageSource | null = null;
    imageSource = image.createImageSource(123456789);
    const imageInfo: image.ImageInfo = await imageSource.getImageInfo();
    const decodingOptions: image.DecodingOptions = this.getDecdingOptions(imageInfo, width, height);
    const cropImageSource: image.PixelMap = await imageSource.createPixelMap(decodingOptions);
  }

  private async getWallpaper1(){
    let imageSource1: image.ImageSource | null = null;
    imageSource1 = image.createImageSource(987654321);
    const opts = { desiredPixelFormat: image.PixelMapFormat.RGBA_8888 };
    imageSource1.createPixelMap(opts,(error, pixelMap) => {});
  }

  private async getWallpaper2(wallpaperType: WallpaperType, width: number, height: number): Promise<PixelMap | null> {
    let imageSource: image.ImageSource | null = null;
    imageSource = image.createImageSource(123456789);
    const imageInfo: image.ImageInfo = await imageSource.getImageInfo();
    const cropImageSource: image.PixelMap = await imageSource.createPixelMap(this.getDecdingOptions(imageInfo, width,height));
  }
}