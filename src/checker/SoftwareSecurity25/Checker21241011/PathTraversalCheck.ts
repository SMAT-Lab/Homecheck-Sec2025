import {ArkFile, Stmt} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PathTraversalChecker');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects potential path traversal vulnerabilities in file operations'
};

export class PathTraversalCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    // 危险的文件操作函数
    private dangerousFileOperations = [
        'readFileSync',
        'writeFileSync',
        'createReadStream',
        'createWriteStream',
        'existsSync',
        'unlinkSync',
        'rmdirSync',
        'mkdirSync',
        'copyFileSync',
        'moveSync',
        'accessSync'
    ];

    // 路径拼接模式 - 检测直接字符串拼接和可能的路径遍历
    private pathTraversalPatterns = [
        // 字符串拼接模式
        /['"]\s*\+\s*[\w\[\]\.]+/g,
        /[\w\[\]\.]+\s*\+\s*['"]/g,
        
        // 模板字符串中的变量
        /\$\{[\w\[\]\.]+\}/g,
        
        // path.join, path.resolve 等函数调用
        /path\.(join|resolve|normalize)\s*\(/g,
        
        // 目录遍历字符
        /\.\.\//g,
        /%2e%2e%2f/gi,
        /%2e%2e%5c/gi
    ];

    // 可疑的路径模式
    private suspiciousPathPatterns = [
        /['"`]\.\.\/[^'"`]*['"`]/g,        // "../" patterns
        /['"`]\.\.\\[^'"`]*['"`]/g,        // "..\" patterns  
        /['"`][^'"`]*\/\.\.[^'"`]*['"`]/g, // paths containing "/.."
        /['"`][^'"`]*\\\.\.[\^'"`]*['"`]/g // paths containing "\.."
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
                    this.checkForPathTraversal(targetFile, stmt);
                }
            }
        }
    }

    private checkForPathTraversal(arkFile: ArkFile, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }

        // 检查是否包含文件操作函数
        const hasFileOperation = this.dangerousFileOperations.some(op => 
            text.includes(op)
        );

        if (hasFileOperation) {
            // 检查路径拼接模式
            this.checkPathConcatenation(arkFile, stmt, text);
            
            // 检查可疑路径模式
            this.checkSuspiciousPathPatterns(arkFile, stmt, text);
        }

        // 独立检查目录遍历字符
        this.checkDirectoryTraversalChars(arkFile, stmt, text);
    }

    private checkPathConcatenation(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.pathTraversalPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    this.reportIssue(arkFile, stmt, match.index, match[0].length,
                        `Potential path traversal: unsafe path concatenation detected - ${match[0].trim()}`);
                }
            }
        }
    }

    private checkSuspiciousPathPatterns(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.suspiciousPathPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    this.reportIssue(arkFile, stmt, match.index, match[0].length,
                        `Path traversal vulnerability: directory traversal sequence detected - ${match[0]}`);
                }
            }
        }
    }

    private checkDirectoryTraversalChars(arkFile: ArkFile, stmt: Stmt, text: string): void {
        // 检查显式的目录遍历模式
        const traversalPattern = /\.\.\//g;
        const matches = text.matchAll(traversalPattern);
        
        for (const match of matches) {
            if (match.index !== undefined) {
                // 检查上下文，避免误报（如注释中的说明）
                const context = text.substring(Math.max(0, match.index - 10), match.index + 10);
                if (!context.includes('//') && !context.includes('/*')) {
                    this.reportIssue(arkFile, stmt, match.index, match[0].length,
                        `Directory traversal sequence detected: ${match[0]}`);
                }
            }
        }
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
