import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const mdAlgName = 'SHA256';

@Entry
@Component
struct ItemComponent {
  private mdAlgName = 'SHA256';
  cipherByPromise() {
    try {
      cryptoFramework.createMd('SHA256');
      cryptoFramework.createMd(this.mdAlgName);
      cryptoFramework.createMd(mdAlgName);
      console.info('md algName:' + mdAlgName);
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`sync error, ${e.code}, ${e.message}`);
    }
  }

  build() {
    Column() {
      Text('item' + this.mdAlgName)
        .fontSize(30)
        .fontWeight(30)
    }
  }
}
