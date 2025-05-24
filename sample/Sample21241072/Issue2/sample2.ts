/**
 * @file SensitiveInfoCheck.ts
 * @description 敏感信息检查示例：展示常见的敏感信息泄漏
 */
function userLogin(username: string) {
    // 数据库连接密码
    const dbPassword = 'db_hardcoded_secret_123';
    console.log(`Attempting to log in user ${username} with DB password: ${dbPassword}`);
}

function processPayment(amount: number) {
    // 支付网关 API 密钥
    const paymentApiKey = 'pay_gateway_hardcoded_key_456';
    console.log(`Processing payment of $${amount} with API key: ${paymentApiKey}`);
}

function sendEmail(to: string, content: string) {
    // 邮件服务器用户名和密码
    const emailUsername = 'admin@example.com';
    const emailPassword = 'email_hardcoded_pass_789';
    console.log(`Sending email to ${to} using credentials: ${emailUsername}:${emailPassword}`);
}

function uploadToCloud(file: string) {
    // 云存储访问密钥
    const cloudAccessKey = 'cloud_hardcoded_access_abc';
    const cloudSecretKey = 'cloud_hardcoded_secret_def';
    console.log(`Uploading ${file} to cloud with keys: ${cloudAccessKey}, ${cloudSecretKey}`);
}

userLogin('testUser');
processPayment(100);
sendEmail('recipient@example.com', 'Hello!');
uploadToCloud('document.pdf');