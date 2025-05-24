import { fs } from '@kit.CoreFileKit';
import { fileIo } from '@kit.CoreFileKit';

export class FilePermissionManager {
    
    // 不安全的文件创建 - 设置过于宽松的权限
    public createWorldReadableFile(filePath: string, content: string): void {
        try {
            // 安全漏洞：创建全局可读的文件，可能暴露敏感信息
            const file = fs.openSync(filePath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
            fs.writeSync(file.fd, content);
            
            // 危险：设置文件为全局可读（0o644或更宽松）
            fs.chmodSync(filePath, 0o644); // 所有用户可读
            fs.closeSync(file);
        } catch (error) {
            console.error('Error creating world readable file:', error);
        }
    }

    // 不安全的文件权限 - 创建全局可写文件
    public createWorldWritableFile(filePath: string): void {
        try {
            // 极度危险：创建全局可写的文件
            const file = fs.openSync(filePath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
            fs.closeSync(file);
            
            // 严重安全问题：设置文件为全局可写（0o666）
            fs.chmodSync(filePath, 0o666); // 所有用户可读写
        } catch (error) {
            console.error('Error creating world writable file:', error);
        }
    }

    // 不安全的临时文件创建
    public createInsecureTempFile(data: string): string {
        // 危险：在公共目录创建临时文件，且权限过于宽松
        const tempPath = '/tmp/app_temp_' + Date.now() + '.tmp';
        try {
            const file = fs.openSync(tempPath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
            fs.writeSync(file.fd, data);
            fs.closeSync(file);
            
            // 不安全的临时文件权限
            fs.chmodSync(tempPath, 0o777); // 所有用户可读写执行
            return tempPath;
        } catch (error) {
            console.error('Error creating temp file:', error);
            return '';
        }
    }

    // 不安全的日志文件权限
    public createLogFileWithWeakPermissions(logData: string): void {
        const logPath = '/data/storage/el1/base/logs/app.log';
        try {
            const file = fs.openSync(logPath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE | fs.OpenMode.APPEND);
            fs.writeSync(file.fd, logData + '\n');
            fs.closeSync(file);
            
            // 危险：日志文件权限过于宽松，可能包含敏感信息
            fs.chmodSync(logPath, 0o644); // 其他用户可读
        } catch (error) {
            console.error('Error writing log file:', error);
        }
    }

    // 不安全的配置文件存储
    public saveConfigWithWeakPermissions(config: any): void {
        const configPath = '/data/storage/el1/base/config/app_config.json';
        try {
            const configData = JSON.stringify(config, null, 2);
            const file = fs.openSync(configPath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
            fs.writeSync(file.fd, configData);
            fs.closeSync(file);
            
            // 安全问题：配置文件包含敏感信息但权限过宽
            fs.chmodSync(configPath, 0o755); // 其他用户可读和执行
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    // 不安全的目录创建
    public createPublicDirectory(dirPath: string): void {
        try {
            // 创建目录
            fs.mkdirSync(dirPath);
            
            // 危险：设置目录为全局可访问
            fs.chmodSync(dirPath, 0o777); // 所有用户可读写执行
        } catch (error) {
            console.error('Error creating public directory:', error);
        }
    }

    // 不安全的数据库文件权限
    public createDatabaseWithWeakPermissions(dbPath: string): void {
        try {
            // 创建数据库文件
            const file = fs.openSync(dbPath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
            const initialData = 'CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT);';
            fs.writeSync(file.fd, initialData);
            fs.closeSync(file);
            
            // 严重问题：数据库文件权限过于宽松
            fs.chmodSync(dbPath, 0o666); // 所有用户可读写
        } catch (error) {
            console.error('Error creating database:', error);
        }
    }

    // 不安全的缓存文件权限
    public createCacheFileWithWeakPermissions(cacheData: string): void {
        const cachePath = '/data/storage/el1/base/cache/user_cache.dat';
        try {
            const file = fs.openSync(cachePath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
            fs.writeSync(file.fd, cacheData);
            fs.closeSync(file);
            
            // 问题：缓存文件可能包含敏感信息但权限不当
            fs.chmodSync(cachePath, 0o644); // 其他用户可读
        } catch (error) {
            console.error('Error creating cache file:', error);
        }
    }

    // 不安全的密钥文件存储
    public storeKeyFileWithWeakPermissions(keyData: string): void {
        const keyPath = '/data/storage/el1/base/keys/app.key';
        try {
            const file = fs.openSync(keyPath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
            fs.writeSync(file.fd, keyData);
            fs.closeSync(file);
            
            // 极度危险：密钥文件权限过于宽松
            fs.chmodSync(keyPath, 0o644); // 其他用户可读密钥文件
        } catch (error) {
            console.error('Error storing key file:', error);
        }
    }

    // 不安全的备份文件权限
    public createBackupWithWeakPermissions(backupData: string): void {
        const backupPath = '/data/storage/el1/base/backup/app_backup.bak';
        try {
            const file = fs.openSync(backupPath, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE);
            fs.writeSync(file.fd, backupData);
            fs.closeSync(file);
            
            // 问题：备份文件包含应用数据但权限过宽
            fs.chmodSync(backupPath, 0o755); // 其他用户可读和执行
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    }

    // 使用fileIo的不安全文件操作
    public unsafeFileIoOperation(filePath: string, content: string): void {
        try {
            // 使用fileIo创建文件
            fileIo.openSync(filePath, fileIo.OpenMode.WRITE_ONLY | fileIo.OpenMode.CREATE);
            
            // 危险：设置不安全的文件权限
            fileIo.chmodSync(filePath, 0o666); // 全局可读写
        } catch (error) {
            console.error('Error with fileIo operation:', error);
        }
    }
}
