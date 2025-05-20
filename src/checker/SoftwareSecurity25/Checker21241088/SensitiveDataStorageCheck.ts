import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'SensitiveDataStorageCheck');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects sensitive data stored in plaintext.'
};

export class SensitiveDataStorageCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private reportedLocations = new Set<string>();

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    private sensitiveKeywords = [
        'password', 'passwd', 'pwd', 'pass',
        'secret', 'token', 'apikey', 'api_key', 'api-key',
        'privatekey', 'private_key', 'private-key',
        'credential', 'auth', 'authentication',
        'key', 'secret'  // 更一般的关键词
    ];

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        logger.info("开始检查敏感信息明文存储...");
        
        // 获取源文件
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        if (!sourceFile) {
            logger.error("无法获取源文件");
            return;
        }
        
        // 获取文件内容
        const fileContent = sourceFile.getFullText();
        logger.info(`分析文件: ${targetFile.getFilePath()}`);
        
        // 检查是否有存储相关的API调用
        const hasStorageAPI = /\.put\s*\(|\.save\s*\(|\.insert\s*\(|storage\.set|preferences\.put/.test(fileContent);
        
        if (hasStorageAPI) {
            logger.info("发现数据存储API调用，检查敏感信息存储");
            
            // 遍历语句寻找具体位置
            for (const arkClass of targetFile.getClasses()) {
                for (const arkMethod of arkClass.getMethods()) {
                    const cfg = arkMethod.getCfg();
                    if (!cfg) continue;
                    
                    for (const stmt of cfg.getStmts()) {
                        const stmtText = stmt.getOriginalText();
                        if (!stmtText) continue;
                        
                        // 检查是否是存储API调用
                        if (this.isDataStorageCall(stmtText)) {
                            // 检查是否存储敏感信息
                            const sensitiveKeyword = this.containsSensitiveData(stmtText);
                            if (sensitiveKeyword) {
                                logger.info(`发现敏感信息 '${sensitiveKeyword}' 可能明文存储`);
                                this.reportIssue(targetFile, stmt, sensitiveKeyword);
                            }
                        }
                    }
                }
            }
        } else {
            logger.info("未发现数据存储API调用");
        }
    }
    
    private isDataStorageCall(text: string): boolean {
        // 检查数据存储的API调用
        return (
            // preferences API
            /\.put\s*\(/.test(text) || 
            // RDB API
            /\.executeSql\s*\(/.test(text) || 
            /\.insert\s*\(/.test(text) ||
            // 其他通用模式
            /\.save\s*\(/.test(text) ||
            /\.set\s*\(/.test(text) ||
            /\.store\s*\(/.test(text)
        );
    }
    
    private containsSensitiveData(text: string): string | null {
        // 1. 检查是否包含敏感关键字
        for (const keyword of this.sensitiveKeywords) {
            // 宽松匹配以捕获更多情况
            const pattern = new RegExp(`(["'\`]|\\b)${keyword}(["'\`]|\\b)`, 'i');
            if (pattern.test(text)) {
                return keyword;
            }
        }
        
        // 2. 检查SQL语句中的敏感字段
        if (/executeSql|insert|update/.test(text)) {
            // 检查是否操作含有敏感字段的表
            if (/api_credentials|user|account|auth|token|secret/.test(text)) {
                // 找出可能的敏感字段名
                for (const field of ['password', 'api_key', 'api_secret', 'token', 'secret', 'credential']) {
                    if (text.includes(field)) {
                        return field;
                    }
                }
                return 'sensitive-table';  // 至少表名是敏感的
            }
        }
        
        // 3. 检查参数数组，可能包含敏感信息
        if (/\[\s*.*?(password|secret|key|token)/.test(text)) {
            return 'parameter-array';
        }
        
        return null;
    }

    public reportIssue(arkFile: ArkFile, stmt: Stmt, sensitiveType: string): void {
        const severity = this.rule?.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        if (!originPositionInfo) {
            logger.error("无法获取位置信息");
            return;
        }
        
        const lineNum = originPositionInfo.getLineNo();
        const colNum = originPositionInfo.getColNo();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            logger.error("无法获取原始文本");
            return;
        }
        
        // 创建唯一位置标识
        const locationKey = `${filePath}:${lineNum}:${colNum}`;
        
        // 检查是否已经报告过这个位置
        if (this.reportedLocations.has(locationKey)) {
            return;
        }

        // 记录这个位置已经报告过
        this.reportedLocations.add(locationKey);

        logger.info(`报告问题: 行${lineNum}, 列${colNum}, 类型:敏感数据`);

        const defects = new Defects(
            lineNum, 
            colNum, 
            colNum + text.length, 
            `检测到敏感信息 '${sensitiveType}' 明文存储，应使用加密方式存储敏感信息`, 
            severity, 
            this.rule?.ruleId || "@software-sec/checker21241088/sensitive-data-storage-check",
            filePath, 
            this.metaData.ruleDocPath, 
            true, false, false
        );
        
        this.issues.push(new IssueReport(defects, undefined));
        logger.info("问题已报告");
    }
}