import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UnsafeHttpCheck');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects unsafe HTTP protocol usage in network requests.'
};

export class UnsafeHttpCheck implements BaseChecker {
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
        
        if (!sourceFileObject) {
            logger.error('Failed to get parse tree node from source file');
            return;
        }

        let hasHttpImport = false;
        let httpImportName = 'http';
        
        // 检查 http 模块导入
        const importVisitor = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
                if (importPath === 'http') {
                    hasHttpImport = true;
                    if (node.importClause && node.importClause.name) {
                        httpImportName = node.importClause.name.text;
                    }
                }
            }
            ts.forEachChild(node, importVisitor);
        };
        
        importVisitor(sourceFileObject);
        
        if (!hasHttpImport) {
            return;
        }
        
        // 检查 http.request 调用
        const requestVisitor = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
                const expression = node.expression;
                if (ts.isPropertyAccessExpression(expression)) {
                    const objectName = expression.expression.getText();
                    const propertyName = expression.name.getText();
                    console.log(objectName, propertyName);
                    
                    if (objectName === httpImportName && propertyName === 'request') {
                        const start = node.getStart();
                        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                        this.reportIssue(
                            targetFile, 
                            lineAndChar.line + 1, 
                            lineAndChar.character + 1, 
                            `use of ${httpImportName}.request`
                        );
                        console.log(lineAndChar.line + 1, lineAndChar.character + 1);
                    }
                }
            }
            ts.forEachChild(node, requestVisitor);
        };
        
        requestVisitor(sourceFileObject);
    }

    public reportIssue(arkFile: ArkFile, lineNum: number, startColumn: number, text: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const endColumn = startColumn + text.length;
        
        let defects = new Defects(
            lineNum,
            startColumn,
            endColumn,
            this.metaData.description,
            severity,
            this.rule.ruleId,
            filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            false
        );
        
        this.issues.push(new IssueReport(defects, undefined));
    }
} 