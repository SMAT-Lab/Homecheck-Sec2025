import {ArkFile, Stmt} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'InsecureRandomChecker');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects use of insecure random number generators for security-sensitive operations'
};

export class InsecureRandomCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    // 不安全的随机数生成方法
    private insecureRandomMethods = [
        'Math.random()',
        'Math.floor(Math.random()',
        'Math.ceil(Math.random()',
        'Math.round(Math.random()'
    ];

    // 安全敏感的上下文关键词
    private securitySensitiveKeywords = [
        // 认证相关
        'token', 'auth', 'session', 'login', 'password', 'secret',
        'key', 'api', 'credential', 'cert', 'signature',
        
        // 加密相关
        'encrypt', 'decrypt', 'crypto', 'cipher', 'hash', 'salt',
        'iv', 'nonce', 'seed',
        
        // 安全相关
        'security', 'secure', 'random', 'verify', 'validation',
        'otp', 'code', 'pin', 'factor', 'challenge',
        
        // 其他敏感操作
        'reset', 'recovery', 'backup', 'admin', 'privilege'
    ];

    // Math.random() 使用模式
    private mathRandomPatterns = [
        /Math\.random\(\)/g,
        /Math\.floor\s*\(\s*Math\.random\(\)/g,
        /Math\.ceil\s*\(\s*Math\.random\(\)/g,
        /Math\.round\s*\(\s*Math\.random\(\)/g
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
                    this.checkForInsecureRandom(targetFile, stmt);
                }
            }
        }
    }

    private checkForInsecureRandom(arkFile: ArkFile, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }

        // 检查Math.random()的使用
        this.checkMathRandomUsage(arkFile, stmt, text);
    }

    private checkMathRandomUsage(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.mathRandomPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    const context = this.getContext(text, match.index);
                    const riskLevel = this.assessSecurityRisk(context);
                    
                    if (riskLevel > 0) {
                        const message = this.generateMessage(match[0], riskLevel, context);
                        this.reportIssue(arkFile, stmt, match.index, match[0].length, message);
                    }
                }
            }
        }
    }

    private getContext(text: string, position: number): string {
        // 获取前后50个字符作为上下文
        const start = Math.max(0, position - 50);
        const end = Math.min(text.length, position + 50);
        return text.substring(start, end).toLowerCase();
    }

    private assessSecurityRisk(context: string): number {
        let riskScore = 0;
        
        // 检查是否包含安全敏感关键词
        for (const keyword of this.securitySensitiveKeywords) {
            if (context.includes(keyword.toLowerCase())) {
                riskScore += 1;
            }
        }
        
        // 特殊高风险场景
        const highRiskPatterns = [
            'generatekey', 'generatetoken', 'generatesession',
            'generatepassword', 'generatesecret', 'generateiv',
            'generatesalt', 'generateapi', 'generatecode',
            'verification', 'authentication', 'encryption'
        ];
        
        for (const pattern of highRiskPatterns) {
            if (context.includes(pattern)) {
                riskScore += 2;
            }
        }
        
        return Math.min(riskScore, 3); // 最高风险等级为3
    }

    private generateMessage(randomCall: string, riskLevel: number, context: string): string {
        const baseMessage = `Insecure random number generation detected: ${randomCall}`;
        
        if (riskLevel >= 3) {
            return `${baseMessage} - HIGH RISK: Used in security-critical context. Use cryptographically secure random generator instead.`;
        } else if (riskLevel >= 2) {
            return `${baseMessage} - MEDIUM RISK: Used in security-sensitive context. Consider using secure random generation.`;
        } else if (riskLevel >= 1) {
            return `${baseMessage} - LOW RISK: Used in potentially sensitive context. Review if secure random is needed.`;
        } else {
            return `${baseMessage} - Consider using secure random generation for security-sensitive operations.`;
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
