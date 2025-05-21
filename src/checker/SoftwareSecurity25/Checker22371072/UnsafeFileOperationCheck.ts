import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UnsafeFileOperationCheck');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects unsafe file operations that may lead to security vulnerabilities.'
};

export class UnsafeFileOperationCheck implements BaseChecker {
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

        let hasFsImport = false;
        let hasPathImport = false;
        let fsImportName = 'fs';
        let pathImportName = 'path';
        
        // 检查模块导入
        const importVisitor = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
                if (importPath === 'fs') {
                    hasFsImport = true;
                    if (node.importClause && node.importClause.name) {
                        fsImportName = node.importClause.name.text;
                    }
                } else if (importPath === 'path') {
                    hasPathImport = true;
                    if (node.importClause && node.importClause.name) {
                        pathImportName = node.importClause.name.text;
                    }
                }
            }
            ts.forEachChild(node, importVisitor);
        };
        
        importVisitor(sourceFileObject);
        console.log('hasFsImport', hasFsImport);
        console.log('hasPathImport', hasPathImport);
        if (!hasFsImport && !hasPathImport) {
            return;
        }

        // 检查不安全的文件操作
        const visitor = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
                const expression = node.expression;
                
                // 检查 fs 操作
                if (hasFsImport && ts.isPropertyAccessExpression(expression)) {
                    const objectName = expression.expression.getText();
                    const propertyName = expression.name.getText();
                    
                    if (objectName === fsImportName && 
                        (propertyName === 'readFile' || 
                         propertyName === 'writeFile' || 
                         propertyName === 'unlink')) {
                        this.checkFileOperationArgs(node, sourceFile, targetFile);
                    }
                }
                
                // 检查 path.join
                if (hasPathImport && ts.isPropertyAccessExpression(expression)) {
                    const objectName = expression.expression.getText();
                    const propertyName = expression.name.getText();
                    
                    if (objectName === pathImportName && propertyName === 'join') {
                        this.checkPathJoinArgs(node, sourceFile, targetFile);
                    }
                }
            }
            ts.forEachChild(node, visitor);
        };

        visitor(sourceFileObject);
    }

    private checkFileOperationArgs(node: ts.CallExpression, sourceFile: ts.SourceFile, targetFile: ArkFile) {
        const args = node.arguments;
        if (args.length > 0) {
            const firstArg = args[0];
            if (this.isUserInput(firstArg)) {
                const start = node.getStart();
                const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                this.reportIssue(
                    targetFile,
                    lineAndChar.line + 1,
                    lineAndChar.character + 1,
                    `不安全的文件操作: ${node.expression.getText()}`
                );
            }
        }
    }

    private checkPathJoinArgs(node: ts.CallExpression, sourceFile: ts.SourceFile, targetFile: ArkFile) {
        const args = node.arguments;
        for (const arg of args) {
            if (this.isUserInput(arg)) {
                const start = node.getStart();
                const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                this.reportIssue(
                    targetFile,
                    lineAndChar.line + 1,
                    lineAndChar.character + 1,
                    `不安全的路径拼接: ${node.expression.getText()}`
                );
                break;
            }
        }
    }

    private isUserInput(node: ts.Expression): boolean {
        // 检查是否是 process.argv
        if (ts.isPropertyAccessExpression(node)) {
            const text = node.getText();
            if (text === 'process.argv[2]' || text.startsWith('process.argv[')) {
                return true;
            }
        }
        
        // 检查是否是变量引用
        if (ts.isIdentifier(node)) {
            const text = node.text.toLowerCase();
            return text.includes('input') || 
                   text.includes('user') || 
                   text.includes('param') ||
                   text.includes('query') ||
                   text.includes('request') ||
                   text.includes('body') ||
                   text.includes('form') ||
                   text.includes('data');
        }
        
        return false;
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