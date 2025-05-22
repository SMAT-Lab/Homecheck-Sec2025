// 不安全的加密操作示例

import * as crypto from 'crypto';

// 1. 使用不安全的哈希算法
function hashPassword(password: string): string {
    // 使用不安全的 MD5
    return crypto.createHash('md5').update(password).digest('hex');
}

// 2. 使用不安全的加密算法
function encryptData(data: string, key: string): string {
    // 使用不安全的 DES
    const iv = Buffer.alloc(8); // 不安全的 IV 生成
    const cipher = crypto.createCipheriv('des', Buffer.from(key), iv);
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

function decryptData(encryptedData: string, key: string): string {
    // 使用不安全的 DES
    const iv = Buffer.alloc(8); // 不安全的 IV 生成
    const decipher = crypto.createDecipheriv('des', Buffer.from(key), iv);
    return decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');
}

// 3. 使用不安全的密钥生成
function generateKey(): string {
    // 使用不安全的随机数生成
    return Math.random().toString(36).substring(2);
}

// 4. 使用不安全的签名算法
function signData(data: string, privateKey: string): string {
    // 使用不安全的 SHA1
    const sign = crypto.createSign('sha1');
    sign.update(data);
    return sign.sign(privateKey, 'hex');
}

// 5. 使用不安全的加密模式
function encryptWithECB(data: string, key: string): string {
    // 使用不安全的 ECB 模式
    const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

// 6. 使用不安全的密码哈希
class User {
    private password: string;

    setPassword(password: string) {
        // 使用不安全的 SHA1
        this.password = crypto.createHash('sha1').update(password).digest('hex');
    }

    verifyPassword(password: string): boolean {
        const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
        return this.password === hashedPassword;
    }
}

// 7. 使用不安全的加密库
function encryptWithRC4(data: string, key: string): string {
    // 使用不安全的 RC4 算法
    const iv = Buffer.alloc(16); // 不安全的 IV 生成
    const cipher = crypto.createCipheriv('rc4', Buffer.from(key), iv);
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

// 8. 不安全的密钥存储
const encryptionKeys = {
    dataKey: "my_secret_key_123",
    apiKey: "api_key_456",
    privateKey: "private_key_789"
};

// 9. 不安全的加密配置
const encryptionConfig = {
    algorithm: 'des',
    mode: 'ecb',
    keySize: 56,
    iterations: 1000
};

// 10. 不安全的加密实现
class CustomEncryption {
    private key: string;

    constructor(key: string) {
        this.key = key;
    }

    encrypt(data: string): string {
        // 自定义的不安全加密实现
        let result = '';
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data.charCodeAt(i) ^ this.key.charCodeAt(i % this.key.length));
        }
        return Buffer.from(result).toString('base64');
    }

    decrypt(encryptedData: string): string {
        // 自定义的不安全解密实现
        const data = Buffer.from(encryptedData, 'base64').toString();
        let result = '';
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data.charCodeAt(i) ^ this.key.charCodeAt(i % this.key.length));
        }
        return result;
    }
} 