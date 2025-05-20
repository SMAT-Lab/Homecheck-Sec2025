import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'SqlInjectionCheck');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects SQL injection vulnerabilities in database queries.'
};

export class SqlInjectionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        logger.info("开始检查SQL注入漏洞...");
        
        // 获取源文件
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        if (!sourceFile) {
            logger.error("无法获取源文件");
            return;
        }
        
        // 获取文件内容
        const fileContent = sourceFile.getFullText();
        logger.info(`分析文件: ${targetFile.getFilePath()}`);
        logger.info(`文件内容长度: ${fileContent.length}`);
        
        // 使用正则表达式直接检测可能的SQL注入模式
        // 寻找字符串拼接模式，如 "query" + 变量, 或 `query ${变量}`
        const sqlInjectionPattern1 = /(\bquery|executeQuery|execute|run|all|get)\s*\(\s*(['"`].*?\+|`.*?\${)/gi;
        const sqlInjectionPattern2 = /(['"`].*?)(SELECT|INSERT|UPDATE|DELETE).*?(\+.*?|`.*?\${)/gi;
        
        // 检查文件内容
        if (sqlInjectionPattern1.test(fileContent) || sqlInjectionPattern2.test(fileContent)) {
            logger.info("发现潜在SQL注入漏洞！");
            
            // 遍历语句寻找具体位置
            for (const arkClass of targetFile.getClasses()) {
                for (const arkMethod of arkClass.getMethods()) {
                    const cfg = arkMethod.getCfg();
                    if (!cfg) continue;
                    
                    for (const stmt of cfg.getStmts()) {
                        const stmtText = stmt.getOriginalText();
                        if (!stmtText) continue;
                        
                        // 检查语句是否包含SQL查询调用和字符串拼接
                        if ((stmtText.includes("query") || stmtText.includes("execute")) && 
                            (stmtText.includes("+") || stmtText.includes("`"))) {
                            
                            // 确定方法名
                            let methodName = "query";
                            if (stmtText.includes("executeQuery")) {
                                methodName = "executeQuery";
                            } else if (stmtText.includes("execute")) {
                                methodName = "execute";
                            } else if (stmtText.includes("run")) {
                                methodName = "run";
                            } else if (stmtText.includes("all")) {
                                methodName = "all";
                            } else if (stmtText.includes("get")) {
                                methodName = "get";
                            }
                            
                            // 报告问题
                            this.reportIssue(targetFile, stmt, methodName);
                            logger.info(`在语句 '${stmtText}' 发现SQL注入风险`);
                        }
                    }
                }
            }
        } else {
            logger.info("未发现SQL注入漏洞");
        }
    }
// 在类中添加一个Set来记录已经报告过的位置
private reportedLocations = new Set<string>();

// 修改reportIssue方法
public reportIssue(arkFile: ArkFile, stmt: Stmt, methodName: string): void {
    const severity = this.rule?.alert ?? this.metaData.severity;
    const filePath = arkFile.getFilePath();
    const originPositionInfo = stmt.getOriginPositionInfo();
    if (!originPositionInfo) {
        logger.error("无法获取位置信息");
        return;
    }
    
    const lineNum = originPositionInfo.getLineNo();
    const text = stmt.getOriginalText();
    if (!text || text.length === 0) {
        logger.error("无法获取原始文本");
        return;
    }
    
    // 尝试找到方法名位置
    let startColumn = originPositionInfo.getColNo();
    let endColunm = startColumn + methodName.length;
    
    if (text.includes(methodName)) {
        startColumn = originPositionInfo.getColNo() + text.indexOf(methodName);
        endColunm = startColumn + methodName.length;
    }
    
    // 创建唯一位置标识
    const locationKey = `${filePath}:${lineNum}:${startColumn}`;
    
    // 检查是否已经报告过这个位置
    if (this.reportedLocations.has(locationKey)) {
        logger.info(`位置 ${locationKey} 已经报告过，跳过`);
        return;
    }
    
    // 记录这个位置已经报告过
    this.reportedLocations.add(locationKey);
    
    logger.info(`报告问题: 行${lineNum}, 列${startColumn}, 方法${methodName}`);
    
    const defects = new Defects(
        lineNum, 
        startColumn, 
        endColunm, 
        '检测到SQL注入漏洞风险，避免在SQL查询中直接拼接用户输入。', 
        severity, 
        this.rule?.ruleId || "@software-sec/checker21241088/sql-injection-check",
        filePath, 
        this.metaData.ruleDocPath, 
        true, false, false
    );
    
    this.issues.push(new IssueReport(defects, undefined));
    logger.info("问题已报告");
    logger.info(`在语句 '${text}' 发现SQL注入风险`);
}
}