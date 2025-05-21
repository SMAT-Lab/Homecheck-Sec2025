// Code Sample with Security Issue 2
import * as fs from 'fs';
import * as path from 'path';

function unsafeFileOperation() {
    // 不安全的文件操作示例
    const userInput = process.argv[2]; // 从命令行参数获取用户输入
    
    // 1. 不安全的文件路径拼接（存在文件遍历的风险）
    const filePath = path.join('/var/data', userInput);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }
        console.log('File content:', data);
    });

    // 2. 不安全的文件写入
    const writePath = path.join('/var/data', userInput);
    fs.writeFile(writePath, 'sensitive data', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }
        console.log('File written successfully');
    });

    // 3. 不安全的文件删除
    const deletePath = path.join('/var/data', userInput);
    fs.unlink(deletePath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return;
        }
        console.log('File deleted successfully');
    });
}

unsafeFileOperation();