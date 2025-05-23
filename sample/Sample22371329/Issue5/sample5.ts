function rule() {
    const token = Math.random().toString(36).substring(2);  // 漏洞示例：不安全随机数生成
    console.log(token);
}