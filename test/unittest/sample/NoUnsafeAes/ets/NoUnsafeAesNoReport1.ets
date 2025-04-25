import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

let cipherAlgName = 'AES128|CBC|PKCS5';
try {
  cryptoFramework.createCipher('AES128|CBC|PKCS5');
  cryptoFramework.createCipher(cipherAlgName);
  let cipher1 = cryptoFramework.createCipher('AES128|CBC|PKCS5');
  let cipher2 = cryptoFramework.createCipher(cipherAlgName);
  console.info('cipher algName：' + cipher1.algName + cipher2.algName);
} catch (error) {
  let e: BusinessError = error as BusinessError;
  console.error(`sync error, ${e.code}, ${e.message}`);
}