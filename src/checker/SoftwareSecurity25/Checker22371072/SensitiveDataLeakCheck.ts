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
    description: '检测代码中的敏感数据泄露，包括密码、密钥、个人信息等'
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
        '身份证',
        '手机号',
        '银行卡'
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
                            `发现可能的敏感数据: ${text}`
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
                            `发现可能的敏感数据变量: ${name}`
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
                            `发现可能的敏感数据属性: ${name}`
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