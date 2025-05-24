import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'SqlInjectionCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects potential SQL injection vulnerabilities through unsafe string concatenation in SQL queries.'
};

export class SqlInjectionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    // SQL操作方法列表
    private sqlMethods = ['querySql', 'executeSql', 'execute', 'query'];
    
    // SQL关键字模式
    private sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE', 'JOIN'];

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);
        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                if (arkMethod.getName() == '_DEFAULT_ARK_METHOD') {
                    continue;
                }
                const methodName = arkMethod.getName();
                const cfg = arkMethod.getCfg();
                if (cfg == undefined) {
                    continue;
                }
                for (const stmt of cfg.getStmts()) {
                    this.checkSqlInjection(targetFile, stmt);
                }
            }
        }
    }

    private checkSqlInjection(targetFile: ArkFile, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text) return;

        // 检查1: 直接的SQL方法调用
        if (stmt.getExprs().length > 0) {
            const expr = stmt.getExprs()[0];
            if (expr instanceof ArkStaticInvokeExpr) {
                const methodName = expr.getMethodSignature().getMethodSubSignature().getMethodName();
                if (this.sqlMethods.includes(methodName)) {
                    // 检查是否使用了字符串拼接
                    if (this.containsStringConcatenation(text)) {
                        this.reportIssue(targetFile, stmt, `unsafe-${methodName}`);
                    }
                }
            }
        }

        // 检查2: 包含SQL关键字和字符串拼接的语句
        if (this.containsSqlKeywords(text) && this.containsStringConcatenation(text)) {
            this.reportIssue(targetFile, stmt, "sql-concatenation");
        }

        // 检查3: 模板字符串中的SQL注入
        if (this.containsSqlTemplate(text)) {
            this.reportIssue(targetFile, stmt, "sql-template");
        }
    }

    private containsStringConcatenation(text: string): boolean {
        // 检查字符串拼接模式
        return text.includes(' + ') || text.includes('+=') || text.includes('.concat(');
    }

    private containsSqlKeywords(text: string): boolean {
        const upperText = text.toUpperCase();
        return this.sqlKeywords.some(keyword => upperText.includes(keyword));
    }

    private containsSqlTemplate(text: string): boolean {
        // 检查模板字符串中的SQL注入模式
        if (text.includes('`') && text.includes('${')) {
            const upperText = text.toUpperCase();
            return this.sqlKeywords.some(keyword => upperText.includes(keyword));
        }
        return false;
    }

    public reportIssue(arkFile: ArkFile, stmt: Stmt, issueType: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        const lineNum = originPositionInfo.getLineNo();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const startColumn = originPositionInfo.getColNo();
        const endColumn = startColumn + text.length;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}
