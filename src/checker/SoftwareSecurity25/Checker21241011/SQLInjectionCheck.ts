import {ArkFile, Stmt} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'SQLInjectionChecker');

const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: '',
    description: 'Detects SQL injection vulnerabilities in database queries'
};

export class SQLInjectionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    // SQL关键字模式
    private sqlKeywords = [
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
        'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'UNION', 'JOIN',
        'LIMIT', 'OFFSET', 'VALUES', 'SET', 'INTO', 'TABLE', 'INDEX', 'VIEW',
        'CALL', 'EXEC', 'EXECUTE'
    ];

    // 数据库操作方法模式
    private dbOperationPatterns = [
        /\.query\s*\(/g,
        /\.execute\s*\(/g,
        /\.executeQuery\s*\(/g,
        /\.executeUpdate\s*\(/g,
        /\.executeStatement\s*\(/g,
        /\.executeSQL\s*\(/g,
        /\.executeRawSQL\s*\(/g,
        /\.find\s*\(/g,
        /\.aggregate\s*\(/g,
        /\.exec\s*\(/g
    ];

    // 危险的字符串拼接模式
    private stringConcatenationPatterns = [
        // 模板字符串注入
        /`[^`]*\$\{[^}]*\}[^`]*`/g,
        // 字符串连接符
        /["'][^"']*["']\s*\+\s*[^"'\s]/g,
        /[^"'\s]\s*\+\s*["'][^"']*["']/g,
        // 直接变量插入SQL关键字后
        /(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|ORDER BY|GROUP BY|HAVING|UNION|JOIN|LIMIT|VALUES|SET|INTO|CREATE|DROP|ALTER|CALL|EXEC)\s+[^"']*\$\{/gi
    ];

    // SQL注入攻击特征模式
    private sqlInjectionPatterns = [
        // 经典注入模式
        /'\s*OR\s*'?\d*'?\s*=\s*'?\d*'?/gi,
        /'\s*AND\s*'?\d*'?\s*=\s*'?\d*'?/gi,
        /'\s*UNION\s*(ALL\s*)?SELECT/gi,
        /;\s*DROP\s+TABLE/gi,
        /;\s*DELETE\s+FROM/gi,
        /;\s*UPDATE\s+\w+\s+SET/gi,
        /--[^\r\n]*/g,
        /\/\*.*?\*\//g,
        // NoSQL注入模式
        /\$where/gi,
        /\$ne/gi,
        /\$gt/gi,
        /\$lt/gi,
        /\$regex/gi
    ];

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                const cfg = arkMethod.getCfg();
                if (cfg == undefined) {
                    continue;
                }
                for (const stmt of cfg.getStmts()) {
                    this.checkForSQLInjection(targetFile, stmt);
                }
            }
        }
    }

    private checkForSQLInjection(arkFile: ArkFile, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }

        // 检查数据库操作方法
        this.checkDatabaseOperations(arkFile, stmt, text);
        
        // 检查危险的字符串拼接
        this.checkStringConcatenation(arkFile, stmt, text);
        
        // 检查SQL注入攻击模式
        this.checkSQLInjectionPatterns(arkFile, stmt, text);
    }

    private checkDatabaseOperations(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.dbOperationPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    // 检查查询参数是否包含动态内容
                    const queryContext = this.getQueryContext(text, match.index);
                    if (this.containsDynamicSQL(queryContext)) {
                        const riskLevel = this.assessSQLInjectionRisk(queryContext);
                        const message = this.generateSQLInjectionMessage(match[0], riskLevel, queryContext);
                        this.reportIssue(arkFile, stmt, match.index, match[0].length, message);
                    }
                }
            }
        }
    }

    private checkStringConcatenation(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.stringConcatenationPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    // 检查是否是SQL相关的字符串拼接
                    if (this.containsSQLKeywords(match[0])) {
                        const message = `SQL injection vulnerability: Unsafe string concatenation in SQL query - ${this.truncateString(match[0], 50)}`;
                        this.reportIssue(arkFile, stmt, match.index, match[0].length, message);
                    }
                }
            }
        }
    }

    private checkSQLInjectionPatterns(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.sqlInjectionPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    let message = '';
                    if (match[0].match(/OR\s*\d*\s*=\s*\d*/gi)) {
                        message = `SQL injection pattern detected: Boolean-based injection - ${match[0]}`;
                    } else if (match[0].match(/UNION.*SELECT/gi)) {
                        message = `SQL injection pattern detected: UNION-based injection - ${match[0]}`;
                    } else if (match[0].match(/DROP\s+TABLE/gi)) {
                        message = `SQL injection pattern detected: Destructive command - ${match[0]}`;
                    } else if (match[0].match(/--/)) {
                        message = `SQL injection pattern detected: Comment-based injection - ${match[0]}`;
                    } else if (match[0].match(/\$where|\$ne|\$gt|\$lt|\$regex/gi)) {
                        message = `NoSQL injection pattern detected: MongoDB operator injection - ${match[0]}`;
                    } else {
                        message = `SQL injection pattern detected: ${match[0]}`;
                    }
                    
                    this.reportIssue(arkFile, stmt, match.index, match[0].length, message);
                }
            }
        }
    }

    private getQueryContext(text: string, position: number): string {
        // 获取查询上下文，查找括号内的内容
        let start = position;
        let end = position;
        let parenCount = 0;
        let foundStart = false;
        
        // 向后查找开始括号
        for (let i = position; i < text.length; i++) {
            if (text[i] === '(') {
                if (!foundStart) {
                    start = i;
                    foundStart = true;
                }
                parenCount++;
            } else if (text[i] === ')') {
                parenCount--;
                if (parenCount === 0 && foundStart) {
                    end = i;
                    break;
                }
            }
        }
        
        return text.substring(start, end + 1);
    }

    private containsDynamicSQL(queryContext: string): boolean {
        // 检查是否包含动态SQL构造
        const dynamicPatterns = [
            /\$\{[^}]+\}/g,  // 模板字符串变量
            /\+\s*\w+/g,     // 字符串拼接变量
            /\"\s*\+/g,      // 字符串连接
            /\'\s*\+/g,      // 字符串连接
        ];
        
        for (const pattern of dynamicPatterns) {
            if (pattern.test(queryContext)) {
                return true;
            }
        }
        
        return false;
    }

    private containsSQLKeywords(text: string): boolean {
        const upperText = text.toUpperCase();
        return this.sqlKeywords.some(keyword => upperText.includes(keyword));
    }

    private assessSQLInjectionRisk(queryContext: string): number {
        let riskScore = 1; // 基础风险
        
        // 检查危险的SQL操作
        const dangerousOperations = ['DELETE', 'DROP', 'UPDATE', 'INSERT', 'CREATE', 'ALTER'];
        const queryUpper = queryContext.toUpperCase();
        
        for (const operation of dangerousOperations) {
            if (queryUpper.includes(operation)) {
                riskScore += 2;
                break;
            }
        }
        
        // 检查是否有用户输入相关的变量名
        const userInputKeywords = ['input', 'param', 'request', 'user', 'form', 'query'];
        const lowerContext = queryContext.toLowerCase();
        
        for (const keyword of userInputKeywords) {
            if (lowerContext.includes(keyword)) {
                riskScore += 1;
                break;
            }
        }
        
        // 检查是否有WHERE子句
        if (queryUpper.includes('WHERE')) {
            riskScore += 1;
        }
        
        return Math.min(riskScore, 3); // 最高风险等级为3
    }

    private generateSQLInjectionMessage(operation: string, riskLevel: number, context: string): string {
        const baseMessage = `SQL injection vulnerability: Unsafe database operation - ${operation}`;
        
        if (riskLevel >= 3) {
            return `${baseMessage} - CRITICAL RISK: High-risk SQL operation with dynamic input. Use parameterized queries immediately.`;
        } else if (riskLevel >= 2) {
            return `${baseMessage} - HIGH RISK: Potentially dangerous SQL operation. Consider using prepared statements.`;
        } else {
            return `${baseMessage} - MEDIUM RISK: Dynamic SQL detected. Validate input and use parameterized queries.`;
        }
    }

    private truncateString(str: string, maxLength: number): string {
        if (str.length <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength) + '...';
    }

    public reportIssue(arkFile: ArkFile, stmt: Stmt, startColumn: number, length: number, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        const lineNum = originPositionInfo.getLineNo();
        const endColumn = startColumn + length;
        
        let defects = new Defects(lineNum, startColumn, endColumn, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}
