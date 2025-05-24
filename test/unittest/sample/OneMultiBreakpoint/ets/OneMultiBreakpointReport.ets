import { deviceInfo } from '@kit.BasicServicesKit';
import { display } from '@kit.ArkUI';

@Entry
@Component
struct ItemComponent {
  isFullScreen: boolean = true;

  build() {
    if (this.isFullScreen) {
      if (deviceInfo.deviceType === 'phone' &&
        (display.getDefaultDisplaySync().orientation === display.Orientation.PORTRAIT && display.isFoldable())) {
          //...
      }
    }
  }
}