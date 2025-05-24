import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let agreementAlgName = 'DH_modp1536';

@Entry
@Component
struct ItemComponent {
  private agreementAlgName = 'DH_modp1536';

  cipherByPromise() {
    try {
      cryptoFramework.createKeyAgreement('DH_modp1536');
      cryptoFramework.createKeyAgreement(agreementAlgName);
      cryptoFramework.createKeyAgreement(this.agreementAlgName);
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`sync error, ${e.code}, ${e.message}`);
    }
  }

  build() {
    Column() {
      Text('item' + this.agreementAlgName)
        .fontSize(30)
        .fontWeight(30)
    }
  }
}