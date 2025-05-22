import { ArkFile, Stmt } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger_Insecure = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'InsecureHttpCheck');
const gMetaData_Insecure: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects use of insecure HTTP (http://) requests.'
};
export class InsecureHttpCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData_Insecure;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = { matcherType: MatcherTypes.FILE };
    public registerMatchers(): MatcherCallback[] {
        return [{ matcher: this.fileMatcher, callback: this.check }];
    }
    public check = (targetFile: ArkFile) => {
        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                const cfg = arkMethod.getCfg(); if (!cfg) continue;
                for (const stmt of cfg.getStmts()) {
                    const text = stmt.getOriginalText() || '';
                    if (text.includes('http://')) {
                        this.reportIssue(targetFile, stmt);
                    }
                }
            }
        }
    }
    private reportIssue(arkFile: ArkFile, stmt: Stmt): void {
        const pos = stmt.getOriginPositionInfo();
        const text = stmt.getOriginalText() || '';
        const defect = new Defects(
            pos.getLineNo(),
            pos.getColNo(),
            pos.getColNo() + text.length,
            this.metaData.description,
            this.rule.alert ?? this.metaData.severity,
            this.rule.ruleId,
            arkFile.getFilePath(),
            this.metaData.ruleDocPath,
            true, false, false
        );
        this.issues.push(new IssueReport(defect, undefined));
        logger_Insecure.warn(`Insecure HTTP usage detected at ${arkFile.getFilePath()}:${pos.getLineNo()}`);
    }
}