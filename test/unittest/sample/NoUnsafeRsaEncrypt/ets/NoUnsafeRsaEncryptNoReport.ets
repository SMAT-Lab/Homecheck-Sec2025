import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const cipherAlgName = 'RSA3072|PKCS1_OAEP|SHA256|MGF1_SHA256';

@Entry
@Component
struct ItemComponent {
  private cipherAlgName = 'RSA3072|PKCS1_OAEP|SHA256|MGF1_SHA256';
  cipherByPromise() {
    try {
      cryptoFramework.createCipher('RSA3072|PKCS1_OAEP|SHA256|MGF1_SHA256');
      cryptoFramework.createCipher(this.cipherAlgName);
      cryptoFramework.createCipher(cipherAlgName);
      console.info('cipher algName:' + cipherAlgName);
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`sync error, ${e.code}, ${e.message}`);
    }
  }

  build() {
    Column() {
      Text('item' + this.cipherAlgName)
        .fontSize(30)
        .fontWeight(30)
    }
  }
}
