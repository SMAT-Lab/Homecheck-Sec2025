const input = '{"__proto__": { "polluted": true }}'; // 模拟用户输入
const user = JSON.parse(input);
const target = {};
Object.assign(target, user);

