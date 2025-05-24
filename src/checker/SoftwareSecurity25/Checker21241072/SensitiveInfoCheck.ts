import { ArkAssignStmt, ArkFile, Local, Stmt } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects, IssueReport } from '../../../model/Defects';
import { MatcherCallback, MatcherTypes, FileMatcher } from '../../../matcher/Matchers';
import { Rule } from '../../../model/Rule';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { StringConstant } from 'arkanalyzer/lib/core/base/Constant';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'SensitiveInfoCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects sensitive information (e.g., passwords).'
};

const SENSITIVE_KEYWORDS = ['password', 'secret', 'token', 'key'];

export class SensitiveInfoCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchFileCb];
    }

    public check = (targetFile: ArkFile): void => {
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
                    if (
                        stmt instanceof ArkAssignStmt &&
                        stmt.getRightOp() instanceof StringConstant &&
                        stmt.getLeftOp() instanceof Local &&
                        SENSITIVE_KEYWORDS.some(keyword => 
                            ((stmt.getLeftOp() as Local).getName().toLowerCase().includes(keyword))
                        )
                    ) {
                        this.reportIssue(targetFile, stmt, methodName);
                    }
                }
            }
        }
    };

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
