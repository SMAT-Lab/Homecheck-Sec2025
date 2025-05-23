import { AbstractBinopExpr, AbstractExpr, ArkAssignStmt, ArkFile, ArkIfStmt, ArkMethod, ArkNormalBinopExpr, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, NullType, Stmt, ts, UndefinedType } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';
import { log } from 'console';

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
        // console.log("check 5");

        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                const methodName = arkMethod.getName();
                const cfg = arkMethod.getCfg();
                if (cfg == undefined) {
                    continue;
                }

                const stmts = cfg.getStmts();
                const blocks = cfg.getBlocks();
                blocks.forEach(block => {
                    // console.log(block);
                    if (block.getSuccessors().length == 1) {
                        let nextBlock = block.getSuccessors()[0];
                        // console.log("next: " + nextBlock.toString());
                        let name = nextBlock.toString();
                        // console.log(name);
                        let length = block.getStmts().length - 1;
                        let lastStmt = block.getStmts()[length];
                        // 没有后续stmt
                        if (lastStmt instanceof ArkIfStmt) {
                            this.reportIssue(targetFile, lastStmt, methodName);
                            const text = lastStmt.getOriginalText();
                            logger.info(`Empty block: \n${text}\ndetected in method ${methodName}`);
                        }
                    }
                });

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