import { ColorMetrics } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';

@Component
struct ColorMeasure {
  @Prop isSelected: boolean = false;

  build() {
    Column()
      .width('100%')
      .height(100)
      .backgroundColor(this.isSelected ? this.getBlendColor(Color.Blue, "#991a0202").color : Color.Grey)
      .borderRadius(12)
      .alignItems((HorizontalAlign.Center))
      .justifyContent(FlexAlign.Center)
  }

  getBlendColor(baseColor: ResourceColor, addColor: ResourceColor): ColorMetrics {
    let sourceColor: ColorMetrics;
    try {
      sourceColor = ColorMetrics.resourceColor(baseColor).blendColor(ColorMetrics.resourceColor(addColor));
    } catch (error) {
      console.log("getBlendColor failed, code = " + (error as BusinessError).code + ", message = " + (error as BusinessError).message);
      sourceColor = ColorMetrics.resourceColor((addColor));
    }
    return sourceColor;
  }
}

@Entry
@Component
struct Index {
  @State isSelected: boolean = false;

  build() {
    Scroll() {
      Column() {
        ColorMeasure({ isSelected: this.isSelected })
          .onClick(() => {
            this.isSelected = !this.isSelected;
          })
      }
    }
  }
}