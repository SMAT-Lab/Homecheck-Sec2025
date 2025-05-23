import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let generatorAlgName = 'DSA1024';

@Entry
@Component
struct ItemComponent {
  private generatorAlgName = 'DSA1024';

  generatorByPromise() {
    try {
      cryptoFramework.createAsyKeyGenerator('DSA1024');
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