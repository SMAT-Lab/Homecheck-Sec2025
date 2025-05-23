import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let generatorAlgName = 'DH_modp3027';

@Entry
@Component
struct ItemComponent {
  private generatorAlgName = 'DH_modp3027';

  generatorByPromise() {
    try {
      cryptoFramework.createAsyKeyGenerator('DH_modp3027');
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