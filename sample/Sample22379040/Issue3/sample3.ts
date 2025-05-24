import { fs } from '@kit.CoreFileKit';

export class FileManager {
    private baseDir: string = '/data/storage/el1/base/cache/';

    // 不安全的文件读取 - 直接使用用户输入构建路径
    public unsafeReadFile(userInput: string): Promise<ArrayBuffer> {
        // 路径遍历漏洞：用户可以使用 "../" 访问上级目录
        const filePath = this.baseDir + userInput;
        const file = fs.openSync(filePath, fs.OpenMode.READ_ONLY);
        return fs.read(file.fd, new ArrayBuffer(1024));
    }

    // 另一个不安全的文件写入示例
    public unsafeWriteFile(fileName: string, content: string): Promise<number> {
        // 危险：直接拼接用户输入，可能导致写入任意路径
        const targetPath = "/data/app/" + fileName;
        const file = fs.openSync(targetPath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
        return fs.write(file.fd, content);
    }

    // 不安全的文件删除操作
    public unsafeDeleteFile(relativePath: string): Promise<void> {
        // 用户输入未验证，可能删除重要系统文件
        const fullPath = this.baseDir + relativePath;
        return fs.unlink(fullPath);
    }

    // 不安全的目录创建
    public unsafeCreateDirectory(dirName: string): Promise<void> {
        // 路径注入：用户可以创建任意路径的目录
        const newDir = "/data/storage/el1/bundle/" + dirName;
        return fs.mkdir(newDir);
    }

    // 不安全的文件复制操作
    public unsafeCopyFile(sourcePath: string, destPath: string): Promise<void> {
        // 双重路径遍历风险：源路径和目标路径都未验证
        const source = this.baseDir + sourcePath;
        const destination = this.baseDir + destPath;
        return fs.copyFile(source, destination);
    }

    // 不安全的文件列表操作
    public unsafeListFiles(directory: string): Promise<string[]> {
        // 可能列出敏感目录内容
        const targetDir = "/data/storage/" + directory;
        return fs.listFile(targetDir);
    }

    // 另一种不安全的路径处理方式
    public downloadFile(fileName: string): Promise<ArrayBuffer> {
        // 使用用户提供的文件名直接构建下载路径
        const downloadPath = `/data/downloads/${fileName}`;
        const file = fs.openSync(downloadPath, fs.OpenMode.READ_ONLY);
        return fs.read(file.fd, new ArrayBuffer(2048));
    }
}
