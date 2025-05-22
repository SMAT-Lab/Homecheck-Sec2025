// 敏感数据泄露检查器
import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'SensitiveDataLeakCheck');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects sensitive data leaks, including passwords, keys, personal information, unsafe file operations, and insecure network requests'
};

export class SensitiveDataLeakCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private readonly sensitivePatterns = [
        'password',
        'secret',
        'key',
        'token',
        'credential',
        'apiKey',
        'privateKey',
        'publicKey',
        'ssn',
        'creditCard',
        'idCard',
        'phone',
        'bankCard'
    ];

    private readonly unsafeFileOperations = [
        'writeFile',
        'writeFileSync',
        'appendFile',
        'appendFileSync'
    ];

    private readonly unsafeNetworkRequests = [
        'fetch',
        'axios',
        'request',
        'http.request',
        'https.request'
    ];

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
        let fsImportName = 'fs';

        // 检查 fs 模块导入
        const importVisitor = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
                if (importPath === 'fs') {
                    hasFsImport = true;
                    if (node.importClause && node.importClause.name) {
                        fsImportName = node.importClause.name.text;
                    }
                }
            }
            ts.forEachChild(node, importVisitor);
        };
        
        importVisitor(sourceFileObject);

        const visitor = (node: ts.Node) => {
            // 检查字符串字面量
            if (ts.isStringLiteral(node)) {
                const text = node.text.toLowerCase();
                for (const pattern of this.sensitivePatterns) {
                    if (text.includes(pattern)) {
                        const start = node.getStart();
                        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                        this.reportIssue(
                            targetFile,
                            lineAndChar.line + 1,
                            lineAndChar.character + 1,
                            `Potential sensitive data detected: ${text}`
                        );
                    }
                }
            }

            // 检查变量声明
            if (ts.isVariableDeclaration(node)) {
                const name = node.name.getText().toLowerCase();
                for (const pattern of this.sensitivePatterns) {
                    if (name.includes(pattern)) {
                        const start = node.getStart();
                        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                        this.reportIssue(
                            targetFile,
                            lineAndChar.line + 1,
                            lineAndChar.character + 1,
                            `Potential sensitive data variable detected: ${name}`
                        );
                    }
                }
            }

            // 检查对象属性
            if (ts.isPropertyAssignment(node)) {
                const name = node.name.getText().toLowerCase();
                for (const pattern of this.sensitivePatterns) {
                    if (name.includes(pattern)) {
                        const start = node.getStart();
                        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                        this.reportIssue(
                            targetFile,
                            lineAndChar.line + 1,
                            lineAndChar.character + 1,
                            `Potential sensitive data property detected: ${name}`
                        );
                    }
                }
            }

            // 检查不安全的文件操作
            if (hasFsImport && ts.isCallExpression(node)) {
                const expression = node.expression;
                if (ts.isPropertyAccessExpression(expression)) {
                    const objectName = expression.expression.getText();
                    const propertyName = expression.name.getText();
                    
                    if (objectName === fsImportName && this.unsafeFileOperations.includes(propertyName)) {
                        // 检查是否直接写入敏感数据
                        const args = node.arguments;
                        if (args.length >= 2) {
                            const dataArg = args[1];
                            if (this.containsSensitiveData(dataArg)) {
                                const start = node.getStart();
                                const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                                this.reportIssue(
                                    targetFile,
                                    lineAndChar.line + 1,
                                    lineAndChar.character + 1,
                                    `Unsafe file operation detected: Writing sensitive data without encryption`
                                );
                            }
                        }
                    }
                }
            }

            // 检查不安全的网络请求
            if (ts.isCallExpression(node)) {
                const functionName = node.expression.getText().toLowerCase();
                if (this.unsafeNetworkRequests.some(req => functionName.includes(req))) {
                    // 检查请求体是否包含敏感数据
                    const args = node.arguments;
                    if (args.length > 0) {
                        const lastArg = args[args.length - 1];
                        if (this.containsSensitiveData(lastArg)) {
                            const start = node.getStart();
                            const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                            this.reportIssue(
                                targetFile,
                                lineAndChar.line + 1,
                                lineAndChar.character + 1,
                                `Unsafe network request detected: Sending sensitive data without encryption`
                            );
                        }
                    }
                }
            }

            ts.forEachChild(node, visitor);
        };

        visitor(sourceFileObject);
    }

    private containsSensitiveData(node: ts.Expression): boolean {
        if (ts.isStringLiteral(node)) {
            const text = node.text.toLowerCase();
            return this.sensitivePatterns.some(pattern => text.includes(pattern));
        }
        
        if (ts.isObjectLiteralExpression(node)) {
            return node.properties.some(prop => {
                if (ts.isPropertyAssignment(prop)) {
                    const name = prop.name.getText().toLowerCase();
                    return this.sensitivePatterns.some(pattern => name.includes(pattern));
                }
                return false;
            });
        }

        if (ts.isIdentifier(node)) {
            const name = node.text.toLowerCase();
            return this.sensitivePatterns.some(pattern => name.includes(pattern));
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