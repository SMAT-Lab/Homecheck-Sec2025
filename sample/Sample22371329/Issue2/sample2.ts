function rule() {
    const userCode = "console.log('Hello')";  // 漏洞示例：动态代码执行
    eval(userCode);
}