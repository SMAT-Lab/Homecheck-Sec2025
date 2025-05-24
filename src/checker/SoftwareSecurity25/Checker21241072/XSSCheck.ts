import { ArkFile, Stmt, ArkMethod, ArkAssignStmt, ArkInstanceFieldRef, ArkInvokeStmt } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback, FileMatcher } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'XSSCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detect potential XSS vulnerabilities in DOM operations.'
};

// 可能存在 XSS 风险的 DOM 操作方法
const RISKY_DOM_METHODS = [
    'innerHTML',
    'outerHTML',
    'write',
    'eval',
    'setTimeout',
    'setInterval'
];

export class XSSCheck implements BaseChecker {
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
                if (!cfg) continue;

                for (const stmt of cfg.getStmts()) {
                    // console.log('stmt', stmt);
                    if (stmt instanceof ArkAssignStmt) {
                        if (stmt.getLeftOp() instanceof ArkInstanceFieldRef) {
                            const fieldRef = stmt.getLeftOp() as ArkInstanceFieldRef;
                            const fieldName = fieldRef.getFieldName();
                            // console.log('fieldName', fieldName);
                            if (fieldName == 'innerHTML' || fieldName == 'outerHTML') {
                                this.reportIssue(targetFile, stmt, methodName);
                            }
                        }
                    } else if (stmt instanceof ArkInvokeStmt) {
                        const exp = stmt.getInvokeExpr();
                        const methodName = exp.getMethodSignature().getMethodSubSignature().getMethodName();
                        if (methodName == 'write') {
                            const text = stmt.getOriginalText();
                            if (text?.includes('document.write')) {
                                this.reportIssue(targetFile, stmt, methodName);
                            }
                        } else if (methodName == 'eval' || methodName == 'setTimeout' || methodName == 'setInterval') {
                            this.reportIssue(targetFile, stmt, methodName);
                        }
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