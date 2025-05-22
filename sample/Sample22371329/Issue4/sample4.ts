const req = { query: { id: '1' } };
const db = { query: (sql: string) => console.log(sql) };

function rule() {
    const id = req.query.id;  // 漏洞示例：字符串拼接 SQL
    // 使用模板字符串包裹 SQL，避免 TS 解析表名错误
    const sql = `SELECT * FROM users WHERE id = ${id}`;
    // @ts-ignore: 忽略 db.query 的 TS 检查
    db.query(sql);
}