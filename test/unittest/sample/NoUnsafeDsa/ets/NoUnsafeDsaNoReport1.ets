import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let signAlgName = 'DSA3027|SHA256';

@Entry
@Component
struct ItemComponent {
  private signAlgName = 'DSA3027|SHA256';

  generatorByPromise() {
    try {
      cryptoFramework.createSign('DSA3027|SHA256');
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