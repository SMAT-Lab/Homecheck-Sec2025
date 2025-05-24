import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'PathTraversalCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects potential path traversal vulnerabilities in file operations with unsanitized user input.'
};

export class PathTraversalCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    // 文件操作方法列表
    private fileOperationMethods = [
        'openSync', 'read', 'write', 'unlink', 'mkdir', 'copyFile', 
        'listFile', 'access', 'stat', 'readText', 'writeText'
    ];

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
                    this.checkPathTraversal(targetFile, stmt);
                }
            }
        }
    }

    private checkPathTraversal(targetFile: ArkFile, stmt: Stmt): void {
        const text = stmt.getOriginalText();
        if (!text) return;

        // 检查1: 文件操作方法调用
        if (stmt.getExprs().length > 0) {
            const expr = stmt.getExprs()[0];
            if (expr instanceof ArkStaticInvokeExpr) {
                const methodName = expr.getMethodSignature().getMethodSubSignature().getMethodName();
                if (this.fileOperationMethods.includes(methodName)) {
                    // 检查是否存在路径拼接
                    if (this.containsUnsafePathConstruction(text)) {
                        this.reportIssue(targetFile, stmt, `unsafe-${methodName}`);
                    }
                }
            }
        }

        // 检查2: 路径字符串拼接模式
        if (this.containsPathConcatenation(text)) {
            this.reportIssue(targetFile, stmt, "path-concatenation");
        }

        // 检查3: 模板字符串中的路径构建
        if (this.containsUnsafePathTemplate(text)) {
            this.reportIssue(targetFile, stmt, "unsafe-path-template");
        }
    }

    private containsUnsafePathConstruction(text: string): boolean {
        // 检查路径拼接模式，特别是与用户输入相关的
        return (text.includes(' + ') || text.includes('+=') || text.includes('.concat(')) &&
               (text.includes('Path') || text.includes('Dir') || text.includes('/') || text.includes('\\'));
    }

    private containsPathConcatenation(text: string): boolean {
        // 检查常见的不安全路径拼接模式
        const pathPatterns = [
            /['"\/][^'"]*['"] \+ /,  // 路径字符串 + 用户输入
            /\+ [^+]*Path/,          // + xxxPath
            /\+ [^+]*Dir/,           // + xxxDir  
            /\+ [^+]*Name/,          // + xxxName
            /baseDir \+ /,           // baseDir + 
            /basePath \+ /           // basePath +
        ];
        return pathPatterns.some(pattern => pattern.test(text));
    }

    private containsUnsafePathTemplate(text: string): boolean {
        // 检查模板字符串中的不安全路径构建
        if (text.includes('`') && text.includes('${')) {
            return text.includes('/') || text.includes('\\') || 
                   text.includes('data/') || text.includes('storage/');
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
