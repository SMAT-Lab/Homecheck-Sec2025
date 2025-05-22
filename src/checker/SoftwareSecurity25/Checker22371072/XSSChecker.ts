import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'XSSChecker');

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: '',
    description: 'Detects Cross-Site Scripting (XSS) vulnerabilities, including unsafe DOM operations and user input handling'
};

export class XSSChecker implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private readonly unsafePatterns = [
        'innerHTML',
        'outerHTML',
        'document.write',
        'eval',
        'setTimeout',
        'setInterval'
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
            // 检查属性访问表达式
            if (ts.isPropertyAccessExpression(node)) {
                const propertyName = node.name.text;
                if (this.unsafePatterns.includes(propertyName)) {
                    const start = node.getStart();
                    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                    this.reportIssue(
                        targetFile,
                        lineAndChar.line + 1,
                        lineAndChar.character + 1,
                        `Unsafe DOM operation detected: ${propertyName}`
                    );
                }
            }

            // 检查函数调用表达式
            if (ts.isCallExpression(node)) {
                const functionName = node.expression.getText();
                if (this.unsafePatterns.includes(functionName)) {
                    const start = node.getStart();
                    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                    this.reportIssue(
                        targetFile,
                        lineAndChar.line + 1,
                        lineAndChar.character + 1,
                        `Unsafe function call detected: ${functionName}`
                    );
                }
            }

            // 检查赋值表达式
            if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                const rightSide = node.right;
                if (ts.isPropertyAccessExpression(rightSide)) {
                    const propertyName = rightSide.name.text;
                    if (this.unsafePatterns.includes(propertyName)) {
                        const start = node.getStart();
                        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                        this.reportIssue(
                            targetFile,
                            lineAndChar.line + 1,
                            lineAndChar.character + 1,
                            `Unsafe assignment operation detected: ${propertyName}`
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