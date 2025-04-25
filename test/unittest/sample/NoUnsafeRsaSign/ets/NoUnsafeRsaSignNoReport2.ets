import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const verifyAlgName = 'RSA3072|PSS|SHA256|MGF1_SHA256';

@Entry
@Component
struct ItemComponent {
  private verifyAlgName = 'RSA3072|PSS|SHA256|MGF1_SHA256';
  cipherByPromise() {
    try {
      cryptoFramework.createVerify('RSA3072|PSS|SHA256|MGF1_SHA256');
      cryptoFramework.createVerify(this.verifyAlgName);
      cryptoFramework.createVerify(verifyAlgName);
      console.info('verify algName:' + verifyAlgName);
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`sync error, ${e.code}, ${e.message}`);
    }
  }

  build() {
    Column() {
      Text('item' + this.verifyAlgName)
        .fontSize(30)
        .fontWeight(30)
    }
  }
}