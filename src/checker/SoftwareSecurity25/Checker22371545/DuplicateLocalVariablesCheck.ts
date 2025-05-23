import { AbstractBinopExpr, AbstractExpr, ArkAssignStmt, ArkFile, ArkNormalBinopExpr, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, NullType, Stmt, ts, UndefinedType } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'DuplicateLocalVariablesCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects duplicate local variables.'
};

export class DuplicateLocalVariablesCheck implements BaseChecker {
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
        // console.log("check 2");
        
        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                if (arkMethod.getName() === '_DEFAULT_ARK_METHOD') {
                    continue;
                }

                const methodName = arkMethod.getName();
                const cfg = arkMethod.getCfg();
                if (cfg == undefined) {
                    continue;
                }

                const seenVars = new Map<string, Stmt>();

                for (const stmt of cfg.getStmts()) {
                    const def = stmt.getDef(); 
                    if (def) {
                        const varName = def.toString();
                        if (seenVars.has(varName)) {
                            // 找重复定义变量
                            this.reportIssue(targetFile, stmt, methodName);
                            logger.info(`Duplicate local variable detected: ${varName} in method ${methodName}`);
                        } else {
                            seenVars.set(varName, stmt);
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