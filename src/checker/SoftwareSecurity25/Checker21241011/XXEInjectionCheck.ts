import {ArkFile, Stmt} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'XXEInjectionChecker');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects XML External Entity (XXE) injection vulnerabilities in XML parsers'
};

export class XXEInjectionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    // 危险的XML解析器配置选项
    private dangerousXMLParserOptions = [
        'parseExternalEntities',
        'resolveExternalEntities',
        'dtdload',
        'dtdattr', 
        'dtdvalid',
        'noent',
        'nonet'
    ];

    // XML解析器实例化模式
    private xmlParserPatterns = [
        /new\s+xml2js\.Parser\s*\(/g,
        /new\s+DOMParser\s*\(/g,
        /libxmljs\.parseXml\s*\(/g,
        /\.parseXml\s*\(/g,
        /\.parseString\s*\(/g,
        /\.parseFromString\s*\(/g
    ];

    // 危险的XML解析器配置模式
    private dangerousConfigPatterns = [
        /parseExternalEntities\s*:\s*true/g,
        /resolveExternalEntities\s*:\s*true/g,
        /dtdload\s*:\s*true/g,
        /dtdattr\s*:\s*true/g,
        /dtdvalid\s*:\s*true/g,
        /noent\s*:\s*true/g,
        /nonet\s*:\s*false/g
    ];

    // XML外部实体声明模式
    private xxePatterns = [
        /<!ENTITY\s+\w+\s+SYSTEM\s+['"]/g,
        /<!ENTITY\s+\w+\s+PUBLIC\s+['"]/g,
        /&\w+;/g  // 实体引用
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
                    this.checkForXXEVulnerabilities(targetFile, stmt);
                }
            }
        }
    }

    private checkForXXEVulnerabilities(arkFile: ArkFile, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }

        // 检查危险的XML解析器配置
        this.checkDangerousXMLParserConfig(arkFile, stmt, text);
        
        // 检查XML外部实体声明
        this.checkXMLExternalEntities(arkFile, stmt, text);
        
        // 检查XML解析器实例化
        this.checkXMLParserInstantiation(arkFile, stmt, text);
    }

    private checkDangerousXMLParserConfig(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.dangerousConfigPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    const riskLevel = this.assessXXERisk(text, match[0]);
                    const message = this.generateXXEMessage(match[0], riskLevel);
                    this.reportIssue(arkFile, stmt, match.index, match[0].length, message);
                }
            }
        }
    }

    private checkXMLExternalEntities(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.xxePatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    let message = '';
                    if (match[0].includes('<!ENTITY')) {
                        message = `XXE vulnerability: External entity declaration detected - ${match[0]}`;
                    } else if (match[0].includes('&') && match[0].includes(';')) {
                        message = `XXE vulnerability: Entity reference detected - ${match[0]}`;
                    }
                    
                    if (message) {
                        this.reportIssue(arkFile, stmt, match.index, match[0].length, message);
                    }
                }
            }
        }
    }

    private checkXMLParserInstantiation(arkFile: ArkFile, stmt: Stmt, text: string): void {
        for (const pattern of this.xmlParserPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    // 检查是否在同一语句或附近语句中有危险配置
                    const context = this.getExtendedContext(text, match.index);
                    if (this.hasDangerousConfiguration(context)) {
                        const message = `XXE vulnerability: XML parser with unsafe configuration - ${match[0]}`;
                        this.reportIssue(arkFile, stmt, match.index, match[0].length, message);
                    }
                }
            }
        }
    }

    private getExtendedContext(text: string, position: number): string {
        // 获取前后200个字符作为上下文
        const start = Math.max(0, position - 200);
        const end = Math.min(text.length, position + 200);
        return text.substring(start, end);
    }

    private hasDangerousConfiguration(context: string): boolean {
        // 检查上下文中是否包含危险的配置选项
        for (const option of this.dangerousXMLParserOptions) {
            if (context.includes(`${option}`) && 
                (context.includes(`${option}: true`) || 
                 context.includes(`${option}:true`) ||
                 (option === 'nonet' && context.includes(`${option}: false`)))) {
                return true;
            }
        }
        return false;
    }

    private assessXXERisk(text: string, configOption: string): number {
        let riskScore = 1; // 基础风险
        
        // 高风险配置选项
        const highRiskOptions = ['parseExternalEntities', 'resolveExternalEntities', 'dtdload'];
        const mediumRiskOptions = ['dtdattr', 'dtdvalid', 'noent'];
        
        for (const option of highRiskOptions) {
            if (configOption.includes(option)) {
                riskScore += 2;
            }
        }
        
        for (const option of mediumRiskOptions) {
            if (configOption.includes(option)) {
                riskScore += 1;
            }
        }
        
        // 检查上下文中是否处理外部输入
        const externalInputKeywords = ['request', 'input', 'payload', 'xml', 'soap', 'config'];
        const lowerText = text.toLowerCase();
        for (const keyword of externalInputKeywords) {
            if (lowerText.includes(keyword)) {
                riskScore += 1;
                break;
            }
        }
        
        return Math.min(riskScore, 3); // 最高风险等级为3
    }

    private generateXXEMessage(configOption: string, riskLevel: number): string {
        const baseMessage = `XXE vulnerability: Dangerous XML parser configuration - ${configOption}`;
        
        if (riskLevel >= 3) {
            return `${baseMessage} - HIGH RISK: External entities enabled with external input processing. This allows file disclosure and SSRF attacks.`;
        } else if (riskLevel >= 2) {
            return `${baseMessage} - MEDIUM RISK: External entity processing enabled. Consider disabling to prevent XXE attacks.`;
        } else {
            return `${baseMessage} - LOW RISK: Potentially unsafe XML configuration. Review if external entity processing is needed.`;
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
