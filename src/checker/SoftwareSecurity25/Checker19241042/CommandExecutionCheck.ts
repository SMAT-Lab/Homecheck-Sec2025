import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {RuleListUtil} from '../../../utils/common/DefectsList';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CommandExecutionCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects unsafe command execution via exec() calls.'
};

export class CommandExecutionCheck implements BaseChecker {
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
                const cfg = arkMethod.getCfg();
                if (cfg == undefined) {
                    continue;
                }
                cfg.buildDefUseChain();
                const printChains: DefUseChain[] = [];
                for (const stmt of cfg.getStmts()) {
                    if (stmt.getExprs().length > 0) {
                        const expr = stmt.getExprs()[0];
                        if (expr instanceof ArkStaticInvokeExpr && expr.getMethodSignature().getMethodSubSignature().getMethodName() == "exec") {
                            for (const arg of expr.getArgs()) {
                                if (arg instanceof Constant) {
                                    console.log("constant: "+arg.getValue());
                                    continue;
                                }
                                for (const chain of cfg.getDefUseChains()){
                                    if (chain.value == arg && !printChains.includes(chain)){
                                        console.log("variable: "+chain.value.toString()+", def: "+chain.def.toString()+", use: "+chain.use.toString());
                                        printChains.push(chain);
                                        // this.reportCommandExecution(targetFile, sourceFile);
                                    }
                                }
                            }
                            
                        }
                    }
                }
            }
        }
    }

    private reportCommandExecution(targetFile: ArkFile, sourceFile: ts.SourceFileLike, aNode: ts.Node): void {
        const message = 'Unsafe command execution.';
        const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getStart());
        const startLine = startPosition.line + 1;
        const startCol = startPosition.character + 1;
        const endPosition = ts.getLineAndCharacterOfPosition(sourceFile, aNode.getEnd());
        const endLine = endPosition.line + 1;
        const endCol = endPosition.character + 1;
        this.addIssueReport(targetFile, startLine, startCol, endLine, endCol, message);
    }

    private addIssueReport(arkFile: ArkFile, startLine: number, startCol: number, endLine: number, endCol: number, message: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const defect = new Defects(startLine, startCol, endCol, message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}