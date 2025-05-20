import preferences from '@ohos.data.preferences';
import { Context } from '@ohos.application.Context';
import { rdb } from '@ohos.data.rdb';
import * as crypto from '@ohos.security.cryptoFramework';

class UserManager {
    private context: Context;
    
    constructor(context: Context) {
        this.context = context;
    }
    
    // 不安全：明文存储密码
    async storeUserCredentials(username: string, password: string) {
        try {
            // 获取首选项实例
            const preferences = await preferences.getPreferences(this.context, 'userPrefs');
            
            // 不安全：明文存储密码
            await preferences.put('username', username);
            await preferences.put('password', password); // 明文存储敏感信息
            
            await preferences.flush();
        } catch (error) {
            console.error("存储失败", error);
        }
    }
    
    // 不安全：在数据库中明文存储API密钥
    async storeApiCredentials(apiKey: string, apiSecret: string) {
        try {
            // 创建RDB配置
            const config = {
                name: "credentials.db",
            };
            
            // 获取RDB数据库实例
            const rdbStore = await rdb.getRdbStore(this.context, config, 1);
            
            // 创建SQL语句 - 不安全：明文存储API凭据
            const sql = "INSERT INTO api_credentials (api_key, api_secret) VALUES (?, ?)";
            
            // 执行SQL - 明文存储敏感信息
            await rdbStore.executeSql(sql, [apiKey, apiSecret]);
        } catch (error) {
            console.error("数据库存储失败", error);
        }
    }
    
    // 安全：加密存储密码
    async secureStorePassword(username: string, password: string) {
        try {
            // 加密密码
            const salt = crypto.randomBytes(16).toString('hex');
            const digest = await crypto.pbkdf2Sync(password, salt, 10000, 64, 'SHA-256');
            const hashedPassword = digest.toString('hex');
            
            // 获取首选项实例
            const preferences = await preferences.getPreferences(this.context, 'securePrefs');
            
            // 安全：存储加密后的密码和盐值
            await preferences.put('username', username);
            await preferences.put('hashedPassword', hashedPassword);
            await preferences.put('salt', salt);
            
            await preferences.flush();
        } catch (error) {
            console.error("安全存储失败", error);
        }
    }
}

// 测试函数
async function testStorage(context: Context) {
    const userManager = new UserManager(context);
    
    // 不安全的调用
    await userManager.storeUserCredentials("testUser", "password123");
    await userManager.storeApiCredentials("ak_12345abcde", "sk_secret98765");
    
    // 安全的调用
    await userManager.secureStorePassword("secureUser", "securePass123");
}