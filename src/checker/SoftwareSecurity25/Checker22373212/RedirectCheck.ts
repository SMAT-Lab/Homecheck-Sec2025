import { ArkAssignStmt, ArkFile, ArkInstanceFieldRef, ArkInstanceInvokeExpr, AstTreeUtils, Local, Stmt, ts } from 'arkanalyzer';
import { Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';



const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects potentially unsafe redirects from user-controlled URL parameters (e.g., searchParams) to href assignments.'

};

export class RedirectCheck implements BaseChecker {
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

        var redirect1;
        var redirect2;

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
                        var right1 = stmt.getRightOp();
                        if (right1 instanceof ArkInstanceFieldRef) {
                            if (right1.getFieldSignature().getFieldName() == 'searchParams') {
                                var temp = stmt.getLeftOp();
                                if (temp instanceof Local) {
                                    redirect1 = temp.getName();
                                }
                            }
                        }
                    }
                }

                for (const stmt of cfg.getStmts()) {
                    if (stmt instanceof ArkAssignStmt) {
                        var right2 = stmt.getRightOp();
                        if (right2 instanceof ArkInstanceInvokeExpr) {
                            if (right2.getBase().getName() == redirect1) {
                                var temp = stmt.getLeftOp();
                                if (temp instanceof Local) {
                                    redirect2 = temp.getName();
                                }
                            }
                        }
                    }
                }

                for (const stmt of cfg.getStmts()) {
                    if (stmt instanceof ArkAssignStmt) {
                        var right3 = stmt.getRightOp();
                        if (right3 instanceof Local) {
                            if (right3.getName() == redirect2) {
                                var left1 = stmt.getLeftOp();
                                if (left1 instanceof ArkInstanceFieldRef) {
                                    if (left1.getFieldSignature().getFieldName() == 'href') {
                                        this.reportIssue(targetFile, stmt, methodName);
                                    }
                                }
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
