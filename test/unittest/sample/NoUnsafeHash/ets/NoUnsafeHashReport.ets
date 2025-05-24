import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const mdAlgName = 'MD5';

@Entry
@Component
struct ItemComponent {
  private mdAlgName = 'MD5';
  cipherByPromise() {
    try {
      cryptoFramework.createMd('MD5');
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
