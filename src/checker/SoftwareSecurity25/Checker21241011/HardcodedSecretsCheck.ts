import {ArkFile, Stmt} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'HardcodedSecretsChecker');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects hardcoded secrets and sensitive information in code'
};

export class HardcodedSecretsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    // 敏感信息模式
    private sensitivePatterns = [
        // 密码相关
        /password\s*[:=]\s*["'][\w\d@#$%^&*()_+-=\[\]{}|;:,.<>?/~`!]{6,}["']/gi,
        /pwd\s*[:=]\s*["'][\w\d@#$%^&*()_+-=\[\]{}|;:,.<>?/~`!]{6,}["']/gi,
        
        // API密钥
        /api[_-]?key\s*[:=]\s*["'][\w\d-]{10,}["']/gi,
        /apikey\s*[:=]\s*["'][\w\d-]{10,}["']/gi,
        /sk-[\w\d]{10,}/gi,
        
        // JWT密钥
        /jwt[_-]?secret\s*[:=]\s*["'][\w\d]{8,}["']/gi,
        /secret[_-]?key\s*[:=]\s*["'][\w\d]{8,}["']/gi,
        
        // 加密密钥
        /encryption[_-]?key\s*[:=]\s*["'][\w\d]{8,}["']/gi,
        
        // 访问令牌
        /access[_-]?token\s*[:=]\s*["'][\w\d.-]{20,}["']/gi,
        /bearer\s+[\w\d.-]{20,}/gi,
        
        // 数据库连接字符串
        /connection[_-]?string\s*[:=]\s*["'][^"']*password[^"']*["']/gi
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
                    this.checkForHardcodedSecrets(targetFile, stmt);
                }
            }
        }
    }

    private checkForHardcodedSecrets(arkFile: ArkFile, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }

        // 检查每个敏感信息模式
        for (const pattern of this.sensitivePatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    this.reportIssue(arkFile, stmt, match.index, match[0].length, 
                        `Hardcoded sensitive information detected: ${this.getSensitiveType(match[0])}`);
                }
            }
        }
    }

    private getSensitiveType(matchText: string): string {
        const lowerText = matchText.toLowerCase();
        if (lowerText.includes('password') || lowerText.includes('pwd')) {
            return 'password';
        } else if (lowerText.includes('apikey') || lowerText.includes('api_key') || lowerText.includes('sk-')) {
            return 'API key';
        } else if (lowerText.includes('jwt') || lowerText.includes('secret')) {
            return 'secret key';
        } else if (lowerText.includes('encryption')) {
            return 'encryption key';
        } else if (lowerText.includes('token') || lowerText.includes('bearer')) {
            return 'access token';
        } else {
            return 'sensitive information';
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
