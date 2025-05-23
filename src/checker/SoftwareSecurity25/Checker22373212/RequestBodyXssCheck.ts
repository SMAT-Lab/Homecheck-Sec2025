import { ArkAssignStmt, ArkFile, AstTreeUtils, Stmt, ts } from 'arkanalyzer';
import { Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';



const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects possible XSS vulnerabilities by checking unvalidated usage of req.body data in response.'
};

export class XssRequestBodyCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        return [{
            matcher: this.fileMatcher,
            callback: this.check
        }];
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
                    if (stmt instanceof ArkAssignStmt) {
                        const text = stmt.getOriginalText?.() ?? "";
                        if (text.includes("req.body")) {
                            this.reportIssue(targetFile, stmt, methodName);
                        }
                    }
                }
            }
        }
    }

    public reportIssue(arkFile: ArkFile, stmt: Stmt, methodName: string): void {
        const severity = this.rule?.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        const lineNum = originPositionInfo.getLineNo();
        const text = stmt.getOriginalText() ?? '';
        const startColumn = originPositionInfo.getColNo();
        const endColumn = startColumn + (text.length > 0 ? text.length : 1);
        const defects = new Defects(
            lineNum,
            startColumn,
            endColumn,
            this.metaData.description,
            severity,
            this.rule?.ruleId,
            filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            false
        );
        this.issues.push(new IssueReport(defects, undefined));
    }
}
