import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const cipherAlgName = 'RSA512|PKCS1';

@Entry
@Component
struct ItemComponent {
  private cipherAlgName = 'RSA512|PKCS1';
  cipherByPromise() {
    try {
      cryptoFramework.createCipher('RSA512|PKCS1');
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
