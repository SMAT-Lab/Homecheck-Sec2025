// 不安全的加密操作检查器
import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'UnsafeEncryptionCheck');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: '检测代码中的不安全加密操作，包括弱加密算法和不安全的加密实现'
};

export class UnsafeEncryptionCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private readonly unsafeAlgorithms = [
        'md5',
        'sha1',
        'des',
        'rc4',
        'blowfish',
        'md4',
        'md2',
        'sha0'
    ];

    private readonly unsafeFunctions = [
        'createHash',
        'createCipher',
        'createDecipher',
        'createHmac',
        'createSign',
        'createVerify'
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

        const visitor = (node: ts.Node) => {
            // 检查函数调用
            if (ts.isCallExpression(node)) {
                const functionName = node.expression.getText().toLowerCase();
                
                // 检查不安全的加密函数
                for (const func of this.unsafeFunctions) {
                    if (functionName.includes(func)) {
                        const start = node.getStart();
                        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                        this.reportIssue(
                            targetFile,
                            lineAndChar.line + 1,
                            lineAndChar.character + 1,
                            `发现不安全的加密函数调用: ${functionName}`
                        );
                    }
                }

                // 检查函数参数中的不安全算法
                node.arguments.forEach(arg => {
                    if (ts.isStringLiteral(arg)) {
                        const algorithm = arg.text.toLowerCase();
                        if (this.unsafeAlgorithms.includes(algorithm)) {
                            const start = arg.getStart();
                            const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                            this.reportIssue(
                                targetFile,
                                lineAndChar.line + 1,
                                lineAndChar.character + 1,
                                `发现不安全的加密算法: ${algorithm}`
                            );
                        }
                    }
                });
            }

            // 检查字符串字面量中的不安全算法
            if (ts.isStringLiteral(node)) {
                const text = node.text.toLowerCase();
                for (const algo of this.unsafeAlgorithms) {
                    if (text.includes(algo)) {
                        const start = node.getStart();
                        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                        this.reportIssue(
                            targetFile,
                            lineAndChar.line + 1,
                            lineAndChar.character + 1,
                            `发现不安全的加密算法: ${text}`
                        );
                    }
                }
            }

            ts.forEachChild(node, visitor);
        };

        visitor(sourceFileObject);
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