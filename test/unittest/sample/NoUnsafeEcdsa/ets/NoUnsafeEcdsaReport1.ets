import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let signAlgName = 'ECC224|SHA1';

@Entry
@Component
struct ItemComponent {
  private signAlgName = 'ECC224|SHA1';

  generatorByPromise() {
    try {
      cryptoFramework.createSign('ECC224|SHA1');
      cryptoFramework.createSign(signAlgName);
      cryptoFramework.createSign(this.signAlgName);
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