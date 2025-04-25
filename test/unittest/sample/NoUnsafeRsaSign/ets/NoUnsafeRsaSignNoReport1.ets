import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const signAlgName = 'RSA3072|PSS|SHA256|MGF1_SHA256';

@Entry
@Component
struct ItemComponent {
  private signAlgName = 'RSA3072|PSS|SHA256|MGF1_SHA256';
  cipherByPromise() {
    try {
      cryptoFramework.createSign('RSA3072|PSS|SHA256|MGF1_SHA256');
      cryptoFramework.createSign(this.signAlgName);
      cryptoFramework.createSign(signAlgName);
      console.info('sign algName:' + signAlgName);
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`sync error, ${e.code}, ${e.message}`);
    }
  }

  build() {
    Column() {
      Text('item' + this.signAlgName)
        .fontSize(30)
        .fontWeight(30)
    }
  }
}
