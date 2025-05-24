import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

@Entry
@Component
struct ItemComponent {
  private cipherAlgName = 'AES128|ECB|PKCS7';

  cipherByPromise() {
    try {
      cryptoFramework.createCipher('AES128|ECB|PKCS7');
      cryptoFramework.createCipher(this.cipherAlgName);
      let cipher1 = cryptoFramework.createCipher('AES128|ECB|PKCS7');
      let cipher2 = cryptoFramework.createCipher(this.cipherAlgName);
      console.info('cipher algName：' + cipher1.algName + cipher2.algName);
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