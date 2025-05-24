import * as fs from 'fs';
import * as path from 'path';

class FileManager {
    private basePath: string = './uploads/';
    
    constructor() {
        console.log('FileManager initialized');
    }
    
    // 路径遍历漏洞 - 直接拼接用户输入
    public readFile(fileName: string): string {
        const filePath = this.basePath + fileName;  // 危险：未验证路径
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            return 'File not found';
        }
    }
    
    // 路径遍历漏洞 - 使用path.join但未验证
    public downloadFile(userPath: string): void {
        const fullPath = path.join('./downloads/', userPath);  // 危险：未验证用户路径
        console.log(`Downloading file from: ${fullPath}`);
        
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath);
            console.log('File downloaded successfully');
        }
    }
    
    // 路径遍历漏洞 - 写入文件
    public saveFile(filename: string, content: string): void {
        const savePath = './data/' + filename;  // 危险：直接拼接
        fs.writeFileSync(savePath, content);
        console.log(`File saved to: ${savePath}`);
    }
    
    // 路径遍历漏洞 - 删除文件
    public deleteFile(filename: string): void {
        const deletePath = path.resolve('./temp/' + filename);  // 危险：未验证
        if (fs.existsSync(deletePath)) {
            fs.unlinkSync(deletePath);
            console.log(`File deleted: ${deletePath}`);
        }
    }
}

// 更多路径遍历攻击示例
class DocumentService {
    
    // 危险的文件访问模式
    public getDocument(docId: string): void {
        const docPath = `./documents/${docId}.pdf`;  // 危险：模板字符串拼接
        console.log(`Accessing document: ${docPath}`);
    }
    
    // 危险的文件包含
    public includeTemplate(templateName: string): void {
        const templatePath = './templates/' + templateName + '.html';  // 危险
        console.log(`Including template: ${templatePath}`);
    }
}

// 使用示例 - 这些调用可能被攻击者利用
function demonstrateAttacks(): void {
    const fileManager = new FileManager();
    const docService = new DocumentService();
    
    // 潜在的攻击向量
    fileManager.readFile('../../../etc/passwd');  // 尝试读取系统文件
    fileManager.downloadFile('../../config/database.conf');  // 尝试下载配置文件
    fileManager.saveFile('../../../tmp/malicious.sh', 'rm -rf /');  // 尝试写入危险文件
    
    docService.getDocument('../../../secret');  // 尝试访问敏感文档
    docService.includeTemplate('../../admin/users');  // 尝试包含管理文件
}