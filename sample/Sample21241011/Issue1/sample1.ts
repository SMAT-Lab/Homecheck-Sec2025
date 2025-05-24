import { exec } from 'child_process';

class DatabaseConfig {
    // 硬编码数据库密码 - 安全漏洞
    private dbPassword: string = "admin123456";
    
    // 硬编码API密钥 - 安全漏洞  
    private apiKey: string = "sk-1234567890abcdef";
    
    // 硬编码JWT密钥 - 安全漏洞
    private jwtSecret: string = "mysecretjwtkey";
    
    constructor() {
        this.connectToDatabase();
    }
    
    private connectToDatabase(): void {
        // 使用硬编码密码连接数据库
        console.log(`Connecting with password: ${this.dbPassword}`);
    }
    
    public getApiKey(): string {
        return this.apiKey;
    }
    
    // SQL注入漏洞示例
    public getUserData(userId: string): void {
        const query = "SELECT * FROM users WHERE id = '" + userId + "'";
        console.log("Executing query: " + query);
    }
    
    // 命令执行漏洞示例
    public executeCommand(userInput: string): void {
        exec('ls -la ' + userInput, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
    }
}

// 硬编码加密密钥 - 安全漏洞
const ENCRYPTION_KEY = "myencryptionkey123";

// 硬编码访问令牌 - 安全漏洞  
const ACCESS_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";

function initializeApp(): void {
    const config = new DatabaseConfig();
    
    // 危险的命令执行
    exec('rm -rf /tmp');
    
    console.log("App initialized with hardcoded secrets");
}