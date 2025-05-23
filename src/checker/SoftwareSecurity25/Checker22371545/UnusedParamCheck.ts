import { AbstractBinopExpr, AbstractExpr, ArkAssignStmt, ArkFile, ArkMethod, ArkNormalBinopExpr, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, NullType, Stmt, ts, UndefinedType } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UnusedParamCheck');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects unused param.'
};

export class UnusedParamCheck implements BaseChecker {
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
        console.log("check 4");

        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                const methodName = arkMethod.getName();
                const cfg = arkMethod.getCfg();
                if (cfg == undefined) {
                    continue;
                }

                // 获取参数名列表
                const params = arkMethod.getParameters();
                const paramVars = arkMethod.getParameters().map(param => param.getName());
                const usedVars = new Set<string>();

                // 遍历方法体语句，收集所有 use 中出现的变量
                for (const stmt of cfg.getStmts()) {
                    for (const use of stmt.getUses()) {
                        usedVars.add(use.toString());
                    }
                }

                // 哪些参数未被使用
                for (const param of paramVars) {
                    if (!usedVars.has(param)) {
                        this.reportIssue(targetFile, arkMethod, param);
                        logger.info(`Unused parameter detected: ${param} in method ${methodName}`);
                    }
                }
            }
        }
    }



    public reportIssue(arkFile: ArkFile, method: ArkMethod, paramName: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const lineNum = method.getLine() ?? 0;
        const startColumn = method.getColumn() ?? 0;
        const endColunm = startColumn + paramName.length;

        const defects = new Defects(lineNum, startColumn, endColunm,
            `Unused parameter: ${paramName}`, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);

        this.issues.push(new IssueReport(defects, undefined));
    }


}