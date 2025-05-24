import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

const generatorAlgName = 'RSA3072|PRIMES_2';

@Entry
@Component
struct ItemComponent {
  private generatorAlgName = 'RSA3072|PRIMES_2';
  cipherByPromise() {
    try {
      cryptoFramework.createAsyKeyGenerator('RSA3072|PRIMES_2');
      cryptoFramework.createAsyKeyGenerator(this.generatorAlgName);
      cryptoFramework.createAsyKeyGenerator(generatorAlgName);
      console.info('generator algName:' + generatorAlgName);
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
