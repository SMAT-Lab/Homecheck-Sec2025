// Code Sample with Security Issue 1
import * as http from 'http';
import * as https from 'https';

function unsafeHttpRequest() {
    // 不安全的HTTP请求示例
    const options = {
        hostname: 'api.example.com',
        path: '/data',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // 使用http模块 - 不安全
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.info('Result:' + data);
        });
    });

    req.on('error', (err) => {
        console.error('Error:' + JSON.stringify(err));
    });

    req.end();
}

// 正确的HTTPS请求示例
function safeHttpRequest() {
    const options = {
        hostname: 'api.example.com',
        path: '/data',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // 使用https模块 - 安全
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.info('Result:' + data);
        });
    });

    req.on('error', (err) => {
        console.error('Error:' + JSON.stringify(err));
    });

    req.end();
}
