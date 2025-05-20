import { ArkFile, AstTreeUtils, Stmt, ts } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'LoggingSensitiveDataCheck');

const gMetaData: BaseMetaData = {
    severity: 1, // 记录敏感数据可能是一个重大风险
    ruleDocPath: '', // 稍后补充
    description: '检测通过 hilog 或 console API 记录敏感数据。'
};

// 常见的敏感关键字，用于检测变量名和字符串字面量
const SENSITIVE_KEYWORDS: string[] = [
    'password', 'passwd', 'pwd',
    'secret', 'secretkey', 'secret_key',
    'token', 'sessiontoken', 'session_token', 'authtoken', 'auth_token', 'bearertoken', 'bearer_token', 'accesstoken', 'access_token',
    'apikey', 'api_key', 'clientkey', 'client_key', 'privatekey', 'private_key',
    'credential', 'credentials',
    'passphrase',
    'creditcard', 'cardnumber', 'card_number', 'ccnum',
    'cvv', 'cvc', 'securitycode',
    'ssn', 'socialsecuritynumber', 'social_security_number',
    'imei',
    'pin', 'otp', 'one_time_password',
    'jwt', // JSON Web Token
    'cookie', // Cookie 通常包含会话标识符
    'sessionid', 'session_id',
    'clientid', 'client_id', // 具体情况可能为敏感
    'clientsecret', 'client_secret',
    'encryptionkey', 'encryption_key',
    'masterkey', 'master_key'
];

// 使用正则表达式快速检测字符串是否包含敏感关键字（不区分大小写）
const SENSITIVE_KEYWORD_REGEX = new RegExp(`\\b(${SENSITIVE_KEYWORDS.join('|')})\\b`, 'i');


export class LoggingSensitiveDataCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private reportedLocations = new Set<string>();

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatchBuildCb];
    }

    private isSensitiveKeyword(text: string): string | undefined {
        const lowerText = text.toLowerCase();
        for (const keyword of SENSITIVE_KEYWORDS) {
            if (lowerText.includes(keyword)) {
                return keyword;
            }
        }
        return undefined;
    }

    private checkArgumentNode(argNode: ts.Expression, sourceFile: ts.SourceFile): string | undefined {
        if (ts.isStringLiteral(argNode) || ts.isNoSubstitutionTemplateLiteral(argNode)) {
            const text = argNode.getText(sourceFile).slice(1, -1); // 去除引号
            return this.isSensitiveKeyword(text);
        } else if (ts.isTemplateExpression(argNode)) {
            // 检查模板字符串头部字面量
            const headKeyword = this.isSensitiveKeyword(argNode.head.getText(sourceFile));
            if (headKeyword) return headKeyword;
            // 检查模板字符串中的各个 span
            for (const span of argNode.templateSpans) {
                const spanLiteralKeyword = this.isSensitiveKeyword(span.literal.getText(sourceFile));
                if (spanLiteralKeyword) return spanLiteralKeyword;
                const expressionKeyword = this.checkArgumentNode(span.expression, sourceFile);
                if (expressionKeyword) return expressionKeyword;
            }
        } else if (ts.isIdentifier(argNode)) {
            return this.isSensitiveKeyword(argNode.getText(sourceFile));
        } else if (ts.isPropertyAccessExpression(argNode)) {
            // 检查完整的属性访问链，例如 user.credentials.password
            return this.isSensitiveKeyword(argNode.getText(sourceFile));
        } else if (ts.isBinaryExpression(argNode) && argNode.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            // 处理字符串拼接，例如 "Password: " + userPassword
            const leftKeyword = this.checkArgumentNode(argNode.left, sourceFile);
            if (leftKeyword) return leftKeyword;
            const rightKeyword = this.checkArgumentNode(argNode.right, sourceFile);
            if (rightKeyword) return rightKeyword;
        }
        // 如有需要，可对其他表达式类型添加更复杂的检测
        return undefined;
    }


    public check = (targetFile: ArkFile) => {
        logger.info(`[LoggingSensitiveDataCheck] 开始检查文件: ${targetFile.getFilePath()}`);
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        if (!sourceFile) {
            logger.error("[LoggingSensitiveDataCheck] 无法获取源文件");
            return;
        }

        const visitNode = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
                const expression = node.expression;
                let logApiName = '';
                let isHilog = false;
                let isConsole = false;

                if (ts.isPropertyAccessExpression(expression)) {
                    const objectName = expression.expression.getText(sourceFile);
                    const methodName = expression.name.getText(sourceFile);

                    if (objectName === 'hilog' && ['debug', 'info', 'warn', 'error', 'fatal'].includes(methodName)) {
                        isHilog = true;
                        logApiName = `hilog.${methodName}`;
                    } else if (objectName === 'console' && ['log', 'info', 'warn', 'error', 'debug', 'trace'].includes(methodName)) {
                        isConsole = true;
                        logApiName = `console.${methodName}`;
                    }
                }

                if (isHilog || isConsole) {
                    const args = node.arguments;
                    let startIndex = 0;
                    if (isHilog) {
                        // 对于 hilog，格式字符串为 args[2]，后续为可变参数
                        if (args.length > 2) { // domain, tag, format, ...
                            const formatArg = args[2];
                            const formatKeyword = this.checkArgumentNode(formatArg, sourceFile);
                            if (formatKeyword) {
                                this.reportIssueFromTsNode(targetFile, node, logApiName,
                                    `检测到通过 ${logApiName} 记录潜在敏感数据 (格式字符串中包含 '${formatKeyword}')。`,
                                    node.arguments.pos > -1 ? args[2] : node // 在格式参数或整个调用上报告
                                );
                                return; // 每次调用只报告一次
                            }
                            startIndex = 3; // 从索引3开始检查可变参数
                        } else {
                            startIndex = args.length; // 没有格式字符串或可变参数可检查
                        }
                    }

                    // 检查 hilog 的剩余参数（可变参数）或 console 的所有参数
                    for (let i = startIndex; i < args.length; i++) {
                        const argNode = args[i];
                        const detectedKeyword = this.checkArgumentNode(argNode, sourceFile);
                        if (detectedKeyword) {
                            this.reportIssueFromTsNode(targetFile, node, logApiName,
                                `检测到通过 ${logApiName} 记录潜在敏感数据 (参数中包含或变量名为 '${detectedKeyword}')。`,
                                argNode // 针对具体参数报告
                            );
                            return; // 每次调用只报告一次，发现第一个敏感参数即返回
                        }
                    }
                }
            }
            ts.forEachChild(node, visitNode);
        };

        visitNode(sourceFile);
        logger.info(`[LoggingSensitiveDataCheck] 文件检查完成: ${targetFile.getFilePath()}`);
    }

    private reportIssueFromTsNode(arkFile: ArkFile, callNode: ts.CallExpression, issueType: string, message: string, specificNode?: ts.Node): void {
        const nodeToReport = specificNode || callNode;
        const severity = this.rule?.alert ?? this.metaData.severity;
        const filePath = arkFile.getFilePath();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        if (!sourceFile) return;

        const startPos = nodeToReport.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(startPos);
        const lineNum = line + 1;
        const colNum = character + 1;
        const text = nodeToReport.getText(sourceFile).split('\n')[0] || issueType; // 取第一行

        const locationKey = `${filePath}:${lineNum}:${colNum}:${issueType}`;
        if (this.reportedLocations.has(locationKey)) {
            // logger.info(`[LoggingSensitiveDataCheck] 位置 ${locationKey} 已经报告过，跳过`);
            return;
        }
        this.reportedLocations.add(locationKey);

        logger.warn(`[LoggingSensitiveDataCheck] 报告问题: 文件=${filePath}, 行=${lineNum}, 类型=${issueType}, 消息=${message}`);

        const defects = new Defects(
            lineNum, colNum, colNum + text.length,
            message,
            severity,
            this.rule?.ruleId || "@software-sec/checker21241088/logging-sensitive-data",
            filePath,
            this.metaData.ruleDocPath,
            true, false, false
        );
        this.issues.push(new IssueReport(defects, undefined));
    }
}