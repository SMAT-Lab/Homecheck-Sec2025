import hilog from '@ohos.hilog';

const DOMAIN = 0x0001;
const TAG = 'SensitiveLoggerDemo';

export class SensitiveLoggerDemo {
    private userPassword = 'user_pass_123';
    public sessionToken: string | null = null;
    public apiKey = "sk_live_abcdefghijklmnopqrstuvwxyz";

    constructor() {
        this.sessionToken = this.generateToken();
    }

    private generateToken(): string {
        return 'generated_secure_token_xyz789';
    }

    public performLogin(username: string, password_param: string): void {
        // 不安全的日志记录
        hilog.info(DOMAIN, TAG, `Attempting login for user: ${username}, password: ${password_param}`); // 问题: password_param
        console.log("User provided password_param:", password_param); // 问题: password_param

        if (password_param === this.userPassword) {
            hilog.debug(DOMAIN, TAG, "Login successful. Session token generated: " + this.sessionToken); // 问题: sessionToken
            console.warn(`Internal userPassword matched: ${this.userPassword}`); // 问题: userPassword
            this.logUserDetails(username, this.userPassword, this.sessionToken);
        } else {
            hilog.error(DOMAIN, TAG, `Login failed for user: ${username}. Incorrect password.`);
        }
    }

    public processPayment(creditCardNumber: string, cvv: string): void {
        const maskedCard = creditCardNumber.substring(creditCardNumber.length - 4).padStart(creditCardNumber.length, '*');
        hilog.info(DOMAIN, TAG, "Processing payment for card (masked): %s", maskedCard); // 安全: 已脱敏

        // 不安全的日志记录
        console.log("Full credit card number for processing:", creditCardNumber); // 问题: creditCardNumber
        hilog.debug(DOMAIN, TAG, `Payment details - CVV: ${cvv}, API_KEY: ${this.apiKey}`); // 问题: cvv, apiKey
    }

    private logUserDetails(user: string, pass: string, tok: string | null): void {
        const userSecret = "user_specific_secret_data";
        // 不安全的日志记录
        hilog.fatal(DOMAIN, TAG, "User: %s, Password: %s, Token: %s, Secret: %s", user, pass, tok, userSecret); // 问题: pass, tok, userSecret
        console.error('User details logged:', { user, pass, token: tok, secret: userSecret }); // 问题: pass, tok, secret (对象属性)
    }

    public safeLoggingExample(): void {
        const userId = "user123";
        const action = "view_profile";
        hilog.info(DOMAIN, TAG, "User %s performed action: %s", userId, action); // 安全
        console.log("Safe log: User action completed.", { userId, action }); // 安全
    }

    public logWithSensitiveVariableNames(): void {
        const mySecretKey = "my-very-secret-key-content";
        const accessTokenValue = "access-token-content-123";
        const user_credentials = { username: "test", password_val: "pass123" };

        console.log(mySecretKey); // 问题: mySecretKey (变量名)
        hilog.info(DOMAIN, TAG, "Current access token: %s", accessTokenValue); // 问题: accessTokenValue (变量名)
        hilog.debug(DOMAIN, TAG, "User credentials object: %s", JSON.stringify(user_credentials)); // 问题: user_credentials (变量名), 内部的 password_val 也会被检测到
    }
}

// 实例化和调用示例 (用于测试)
// const demo = new SensitiveLoggerDemo();
// demo.performLogin("testUser", "actual_password_value");
// demo.processPayment("1234567812345678", "123");
// demo.safeLoggingExample();
// demo.logWithSensitiveVariableNames();