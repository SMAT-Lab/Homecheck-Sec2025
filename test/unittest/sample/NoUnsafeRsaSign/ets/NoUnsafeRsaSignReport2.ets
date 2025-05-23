import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const verifyAlgName = 'RSA512|PKCS1|MD5';

@Entry
@Component
struct ItemComponent {
  private verifyAlgName = 'RSA512|PKCS1|MD5';
  cipherByPromise() {
    try {
      cryptoFramework.createVerify('RSA512|PKCS1|MD5');
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