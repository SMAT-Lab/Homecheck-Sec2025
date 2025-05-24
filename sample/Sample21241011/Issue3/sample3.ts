class TokenGenerator {
    
    // 不安全的随机数生成 - 使用Math.random()生成安全令牌
    public generateSecurityToken(): string {
        const randomValue = Math.random();  // 危险：不适合安全目的
        return `token_${randomValue.toString(36).substr(2, 9)}`;
    }
    
    // 不安全的会话ID生成
    public generateSessionId(): string {
        let sessionId = '';
        for (let i = 0; i < 32; i++) {
            sessionId += Math.floor(Math.random() * 16).toString(16);  // 危险：可预测
        }
        return sessionId;
    }
    
    // 不安全的密码重置令牌
    public generatePasswordResetToken(): string {
        const timestamp = Date.now();
        const random = Math.random();  // 危险：伪随机数
        return `reset_${timestamp}_${random}`;
    }
}

class CryptographicService {
    
    // 不安全的加密密钥生成
    public generateEncryptionKey(): Uint8Array {
        const key = new Uint8Array(32);
        for (let i = 0; i < key.length; i++) {
            key[i] = Math.floor(Math.random() * 256);  // 危险：加密密钥使用伪随机数
        }
        return key;
    }
    
    // 不安全的初始化向量(IV)生成
    public generateIV(): string {
        let iv = '';
        for (let i = 0; i < 16; i++) {
            iv += Math.random().toString(16).charAt(2);  // 危险：IV必须是随机的
        }
        return iv;
    }
    
    // 不安全的盐值生成
    public generateSalt(): string {
        return Math.random().toString(36);  // 危险：密码哈希的盐值应该是加密安全的
    }
}

class AuthenticationService {
    
    // 不安全的验证码生成
    public generateVerificationCode(): string {
        const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');  // 危险
        return code;
    }
    
    // 不安全的API密钥生成
    public generateApiKey(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 64; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));  // 危险
        }
        return result;
    }
    
    // 不安全的随机数生成用于双因子认证
    public generateTwoFactorSecret(): string {
        const secret = Array.from({length: 20}, () => 
            Math.floor(Math.random() * 32).toString(32)  // 危险：2FA密钥必须安全随机
        ).join('');
        return secret;
    }
}

// 直接使用Math.random()的其他危险场景
class SecurityUtilities {
    
    // 不安全的文件名生成（可能导致文件名冲突）
    public generateSecureFileName(extension: string): string {
        const randomName = Math.random().toString(36).substring(7);  // 危险
        return `secure_${randomName}.${extension}`;
    }
    
    // 不安全的随机延迟（可能被时序攻击利用）
    public addRandomDelay(): Promise<void> {
        const delay = Math.random() * 1000;  // 危险：安全延迟应该是不可预测的
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // 不安全的随机端口选择
    public getRandomPort(): number {
        return Math.floor(Math.random() * 65535) + 1024;  // 危险：可能被猜测
    }
}

// 演示错误用法
function demonstrateInsecureRandomUsage(): void {
    const tokenGen = new TokenGenerator();
    const cryptoService = new CryptographicService();
    const authService = new AuthenticationService();
    const utilities = new SecurityUtilities();
    
    // 这些都是不安全的随机数使用
    console.log('Security Token:', tokenGen.generateSecurityToken());
    console.log('Session ID:', tokenGen.generateSessionId());
    console.log('Encryption Key:', cryptoService.generateEncryptionKey());
    console.log('Verification Code:', authService.generateVerificationCode());
    console.log('API Key:', authService.generateApiKey());
    console.log('Random Port:', utilities.getRandomPort());
}