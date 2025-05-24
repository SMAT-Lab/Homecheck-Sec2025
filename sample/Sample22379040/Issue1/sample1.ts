import * as http from 'http';

function unsafeDataTransmission() {
    // 使用HTTP传输敏感数据，存在安全风险
    const options = {
        hostname: 'example.com',
        port: 80,
        path: '/api/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    const data = JSON.stringify({
        username: "admin",
        password: "123456",  // 明文密码通过HTTP传输
        creditCard: "4111-1111-1111-1111"  // 敏感的信用卡信息
    });
    
function anotherUnsafeTransmission() {
    const options = {
        hostname: 'api.bank.com',
        port: 80,
        path: '/transfer',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    const data = JSON.stringify({
        accountNumber: "123456789",
        amount: 50000,
        ssn: "123-45-6789"  // 社会安全号码通过HTTP传输
    });
    
    // 另一个不安全的HTTP传输示例
    const req = http.request(options);
    req.write(data);
    req.end();
    }
}