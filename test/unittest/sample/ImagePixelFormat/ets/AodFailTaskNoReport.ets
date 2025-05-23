import { image } from "@kit.ImageKit";

const DEFAULT_IMAGE_WIDTH_HEIGHT: number = 600;
const DEFAULT_IMAGE_BUFFER_SIZE: number = DEFAULT_IMAGE_WIDTH_HEIGHT * DEFAULT_IMAGE_WIDTH_HEIGHT * 4;

export class AodFailTask {
  private async serImage(): Promise<void> {
    const color = new ArrayBuffer(DEFAULT_IMAGE_BUFFER_SIZE);
    let opts: image.InitializationOptions = {
      editable: true,
      pixelFormat: image.PixelMapFormat.RGBA_8888,
      size: { height: DEFAULT_IMAGE_WIDTH_HEIGHT, width: DEFAULT_IMAGE_WIDTH_HEIGHT }
    }
    const imageSrc = await image.createPixelMap(color, opts);
  }

  private async serImage1(): Promise<void> {
    const color = new ArrayBuffer(DEFAULT_IMAGE_BUFFER_SIZE);
    let opts: image.InitializationOptions = {
      editable: true,
      pixelFormat: 3,
      size: { height: DEFAULT_IMAGE_WIDTH_HEIGHT, width: DEFAULT_IMAGE_WIDTH_HEIGHT }
    }
    const imageSrc = await image.createPixelMap(color, opts);
  }

  private setImage2(){
    let width: number = 100;
    let height: number = 100;

    let buffer: ArrayBuffer = new ArrayBuffer(width * height * 4);
    image.createPixelMap(buffer, {
      editable: false,
      pixelFormat: 3,
      size: { height: height, width: width }
    })
  }
}