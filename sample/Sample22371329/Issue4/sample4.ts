import * as fs from 'fs';
function rule() {
    const filename = '../etc/passwd';  // 漏洞示例：路径穿越
    // @ts-ignore
    const data = fs.readFileSync(filename, 'utf-8');
    console.log(data);
}