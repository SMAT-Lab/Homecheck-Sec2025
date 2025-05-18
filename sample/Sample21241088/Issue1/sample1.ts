// Code Sample with SQL Injection Issue
import { Database } from 'sqlite';

function queryUserData(userId: string) {
    // 不安全的SQL查询，直接拼接用户输入
    const db = new Database('users.db');
    const query = "SELECT * FROM users WHERE id = '" + userId + "'";
    db.query(query); // SQL注入漏洞

    // 同样不安全的模板字符串SQL
    const query2 = `SELECT * FROM users WHERE username LIKE '%${userId}%'`;
    db.execute(query2); // SQL注入漏洞
}

// 测试代码 - 可能的攻击输入
function testInjection() {
    // 正常使用
    queryUserData("123");
    
    // 攻击者输入 - 可能导致所有用户信息泄露
    queryUserData("' OR '1'='1");
}