import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const macAlgName = 'SHA256';

@Entry
@Component
struct ItemComponent {
  private macAlgName = 'SHA256';
  cipherByPromise() {
    try {
      cryptoFramework.createMac('SHA256');
      cryptoFramework.createMac(this.macAlgName);
      cryptoFramework.createMac(macAlgName);
      console.info('mac algName:' + macAlgName);
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`sync error, ${e.code}, ${e.message}`);
    }
  }

  build() {
    Column() {
      Text('item' + this.macAlgName)
        .fontSize(30)
        .fontWeight(30)
    }
  }
}
