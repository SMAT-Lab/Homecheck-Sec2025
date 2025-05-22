// 隐私数据泄露示例
import * as fs from 'fs';

// 1. 硬编码的敏感信息
const API_KEY = "sk_live_51H7J9K2J9K2J9K2J9K2J9K2J9K2J9K2J9K2J9K2J9K2J9K2J9K2J9K2";
const DB_PASSWORD = "Admin@123456";
const PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC9QFi67K6Z";

// 2. 用户信息对象
interface UserInfo {
    name: string;
    idCard: string;  // 身份证号
    phoneNumber: string;  // 手机号
    bankCard: string;  // 银行卡号
    password: string;
}

// 3. 不安全的用户信息处理
class UserService {
    private users: UserInfo[] = [];

    // 不安全的用户信息存储
    public addUser(user: UserInfo) {
        this.users.push(user);
        console.log(`用户 ${user.name} 添加成功，身份证号: ${user.idCard}`);
    }

    // 不安全的用户信息展示
    public displayUserInfo(userId: string) {
        const user = this.users.find(u => u.idCard === userId);
        if (user) {
            return {
                name: user.name,
                idCard: user.idCard,
                phoneNumber: user.phoneNumber,
                bankCard: user.bankCard,
                password: user.password  // 不应该直接返回密码
            };
        }
        return null;
    }

    // 不安全的日志记录
    public logUserActivity(user: UserInfo, action: string) {
        console.log(`用户 ${user.name}(${user.idCard}) 执行了操作: ${action}`);
    }
}

// 4. 不安全的配置信息
const config = {
    database: {
        host: "localhost",
        port: 3306,
        username: "root",
        password: "root123",
        apiSecret: "secret_key_123456"
    },
    redis: {
        host: "localhost",
        port: 6379,
        password: "redis123"
    }
};

// 5. 不安全的错误信息
function handleError(error: Error) {
    console.error(`发生错误: ${error.message}`);
    // 错误信息中可能包含敏感数据
    if (error.message.includes("password")) {
        console.error(`密码错误: ${error.message}`);
    }
}