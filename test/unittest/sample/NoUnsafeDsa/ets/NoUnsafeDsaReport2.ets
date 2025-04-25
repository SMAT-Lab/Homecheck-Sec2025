import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let verifyAlgName = 'DSA3027|SHA1';

@Entry
@Component
struct ItemComponent {
  private verifyAlgName = 'DSA3027|SHA1';

  generatorByPromise() {
    try {
      cryptoFramework.createVerify('DSA3027|SHA1');
      cryptoFramework.createVerify(verifyAlgName);
      cryptoFramework.createVerify(this.verifyAlgName);
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