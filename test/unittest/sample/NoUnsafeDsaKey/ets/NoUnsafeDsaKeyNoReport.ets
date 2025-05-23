import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let generatorAlgName = 'DSA3027';

@Entry
@Component
struct ItemComponent {
  private generatorAlgName = 'DSA3027';

  generatorByPromise() {
    try {
      cryptoFramework.createAsyKeyGenerator('DSA3027');
      cryptoFramework.createAsyKeyGenerator(generatorAlgName);
      cryptoFramework.createAsyKeyGenerator(this.generatorAlgName);
    } catch (error) {
      let e: BusinessError = error as BusinessError;
      console.error(`sync error, ${e.code}, ${e.message}`);
    }
  }

  build() {
    Column() {
      Text('item' + this.generatorAlgName)
        .fontSize(30)
        .fontWeight(30)
    }
  }
}