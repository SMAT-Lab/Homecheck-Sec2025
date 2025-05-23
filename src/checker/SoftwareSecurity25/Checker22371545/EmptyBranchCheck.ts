import { AbstractBinopExpr, AbstractExpr, ArkAssignStmt, ArkFile, ArkMethod, ArkNormalBinopExpr, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, NullType, Stmt, ts, UndefinedType } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'EmptyBranchCheck');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects empty branch.'
};

export class EmptyBranchCheck implements BaseChecker {
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
        console.log("check 5");

        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                const methodName = arkMethod.getName();
                const cfg = arkMethod.getCfg();
                if (!cfg) continue;

                const stmts = cfg.getStmts();
                for (let i = 0; i < stmts.length; i++) {
                    const stmt = stmts[i];
                    const text = stmt.getOriginalText()?.trim() ?? "";

                    // 粗略判断是否为 if/else 分支语句
                    const isIf = text.startsWith("if");
                    const isElse = text.startsWith("else");

                    if (isIf || isElse) {
                        // 检查下一个语句是否为空块
                        const nextStmt = stmts[i + 1];
                        if (nextStmt) {
                            const nextText = nextStmt.getOriginalText()?.trim() ?? "";
                            if (nextText === "{}" || nextText === "") {
                                // 报告空分支
                                this.reportIssue(targetFile, nextStmt, methodName);
                                logger.info(`Empty ${isIf ? "if" : "else"} block detected in method ${methodName}`);
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

        const startColumn = originPositionInfo.getColNo();
        const endColumn = startColumn + text.length;

        const defects = new Defects(lineNum, startColumn, endColumn,
            "Empty branch block detected", severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);

        this.issues.push(new IssueReport(defects, undefined));
    }
}