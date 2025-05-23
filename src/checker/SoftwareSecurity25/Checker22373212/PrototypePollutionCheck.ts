import { ArkFile, ArkInvokeStmt, ArkStaticInvokeExpr, AstTreeUtils, Stmt, ts } from 'arkanalyzer';
import { Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';



const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects potentially unsafe use of Object.assign that could lead to prototype pollution.'

};

export class PrototypePollutionCheck implements BaseChecker {
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
                    if (stmt instanceof ArkInvokeStmt) {
                        const Expr = stmt.getInvokeExpr();
                        if (Expr instanceof ArkStaticInvokeExpr) {
                            if (Expr.getMethodSignature().getDeclaringClassSignature().getClassName() == 'Object' && Expr.getMethodSignature().getMethodSubSignature().getMethodName() == 'assign') {
                                this.reportIssue(targetFile, stmt, methodName);
                            }
                        }

                    }
                }
            }
        }
    }

    public reportIssue(arkFile: ArkFile, stmt: Stmt, methodName: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        const lineNum = originPositionInfo.getLineNo();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const startColumn = originPositionInfo.getColNo() + text.lastIndexOf(methodName);
        const endColunm = startColumn + methodName.length;
        let defects = new Defects(lineNum, startColumn, endColunm, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}
