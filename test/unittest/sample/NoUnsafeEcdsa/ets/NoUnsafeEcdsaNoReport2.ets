import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let verifyAlgName = 'ECC256|SHA256';

@Entry
@Component
struct ItemComponent {
  private verifyAlgName = 'ECC256|SHA256';

  generatorByPromise() {
    try {
      cryptoFramework.createVerify('ECC256|SHA256');
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