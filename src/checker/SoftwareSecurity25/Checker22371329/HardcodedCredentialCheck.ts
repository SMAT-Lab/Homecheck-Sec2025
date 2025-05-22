import { ArkFile, Stmt } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'HardcodedCredentialCheck');

const gMetaData_HardCred: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects hardcoded credentials like passwords or API keys.'
};

export class HardcodedCredentialCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData_HardCred;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    // 仅针对文件级规则
    private fileMatcher: FileMatcher = { matcherType: MatcherTypes.FILE };

    public registerMatchers(): MatcherCallback[] {
        return [{ matcher: this.fileMatcher, callback: this.check }];
    }

    public check = (targetFile: ArkFile) => {
        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                const cfg = arkMethod.getCfg();
                if (!cfg) continue;
                for (const stmt of cfg.getStmts()) {
                    const text = stmt.getOriginalText() || '';
                    // 简单正则匹配密码、token、apiKey 等硬编码形式
                    if (/\b(password|passwd|apiKey|token)\s*[:=]\s*["'].*["']/.test(text)) {
                        this.reportIssue(targetFile, stmt, arkMethod.getName());
                    }
                }
            }
        }
    }

    public reportIssue(arkFile: ArkFile, stmt: Stmt, methodName: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const pos = stmt.getOriginPositionInfo();
        const lineNum = pos.getLineNo();
        const text = stmt.getOriginalText() || '';
        const startCol = pos.getColNo() + text.indexOf('=');
        const endCol = startCol + text.length - text.indexOf('=');

        const defect = new Defects(
            lineNum,
            startCol,
            endCol,
            this.metaData.description,
            severity,
            this.rule.ruleId,
            filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            false
        );
        this.issues.push(new IssueReport(defect, undefined));
        logger.warn(`Hardcoded credential detected at ${filePath}:${lineNum}`);
    }
}