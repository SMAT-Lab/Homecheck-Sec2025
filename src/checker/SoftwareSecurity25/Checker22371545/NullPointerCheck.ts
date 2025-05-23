import { AbstractBinopExpr, AbstractExpr, ArkAssignStmt, ArkFile, ArkNormalBinopExpr, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, NullType, Stmt, ts, UndefinedType } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NullPointerCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: 'Detects null pointer access.'
};

export class NullPointerCheck implements BaseChecker {
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

    // public isNullOrUndefinedExpr(expr: AbstractExpr): boolean {
    //     const cType = typeof expr;
    //     const type = expr.getType();
    //     return type === NullType.getInstance() || type === UndefinedType.getInstance();
    // }

    // public mayNullOrUndefinedExpr(expr: AbstractExpr): boolean {
    //     if (expr instanceof AbstractBinopExpr) {
    //         let op1 = expr.getOp1();
    //         let op2 = expr.getOp2();
    //         // let type = expr.getType();
    //         if ("constFlag" in op1 && op1.constFlag) {
    //             if ("originValue" in op1 && (op1.originValue == null || op1.originValue == undefined)) {
    //                 return true;
    //             }
    //             if ("declaringStmt" in op1 && op1.declaringStmt) {
    //                 let value = op1.declaringStmt;
    //                 if ("declaringStmt" in value && op1.declaringStmt) {
                    
    //                 }
    //             }
    //         }
    //         if ("constFlag" in op2 && op2.constFlag) {
    //             if ("originValue" in op2 && (op2.originValue == null || op2.originValue == undefined)) {
    //                 return true;
    //             }
    //         }
    //     }
    //     return false;
    // }

    public check = (targetFile: ArkFile) => {
        // console.log("check 1");
        
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        const sourceFileObject = ts.getParseTreeNode(sourceFile);

        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                if (arkMethod.getName() == '_DEFAULT_ARK_METHOD') {
                    continue;
                }
                const methodName = arkMethod.getName();
                // const cfg = arkMethod.getCfg();
                if (arkMethod == undefined) {
                    continue;
                }
                const body = arkMethod.getBody();
                if (body == undefined) {
                    continue;
                }
                const cfg = body.getCfg();
                if (cfg == undefined) {
                    continue;
                }

                cfg.buildDefUseChain();
                const defUseChains = cfg.getDefUseChains();

                // console.log(defUseChains);
                
                if (!defUseChains) {
                    continue;
                }

                for (const chain of defUseChains) {
                    const defStmt = chain.def;
                    const useStmt = chain.use;
                    const value = chain.value;

                    if (!defStmt || !value) {
                        continue;
                    }
                    
                    if (useStmt instanceof ArkAssignStmt) {
                        let rightOp = useStmt.getRightOp();
                        if (rightOp instanceof ArkNormalBinopExpr) {
                            let op1 = rightOp.getOp1();
                            let op2 = rightOp.getOp2();
                            if (op1.getType().toString() == 'null' || op1.getType().toString() == 'undefined') {
                                // console.log("ok1");
                                logger.info(`Access to null value: ${useStmt} in method ${methodName}`);
                                this.reportIssue(
                                targetFile,
                                useStmt,
                                methodName
                            );
                            }
                            if (op2.getType().toString() == 'null' || op2.getType().toString() == 'undefined') {
                                // console.log("ok2");
                                logger.info(`Access to null value: ${useStmt} in method ${methodName}`);
                                this.reportIssue(
                                targetFile,
                                useStmt,
                                methodName,
                                
                            );
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