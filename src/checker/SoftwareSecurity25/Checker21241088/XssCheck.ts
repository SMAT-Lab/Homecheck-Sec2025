import { ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Stmt, ts } from 'arkanalyzer'; // 只导入确认存在的模块
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'XssCheck');

const gMetaData: BaseMetaData = {
    severity: 2, // XSS通常是较高风险
    ruleDocPath: '',
    description: 'Detects potential Cross-Site Scripting (XSS) vulnerabilities in WebView components.'
};

export class XssCheck implements BaseChecker {
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

    public check = (targetFile: ArkFile) => {
        logger.info(`[XssCheck] 开始检查文件: ${targetFile.getFilePath()}`);

        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        if (!sourceFile) {
            logger.error("[XssCheck] 无法获取源文件");
            return;
        }

        // 辅助函数，用于递归遍历AST节点
        const visitNode = (node: ts.Node) => {
            if (ts.isCallExpression(node) || ts.isCallChain(node)) {
                const expression = node.expression;
                let methodName = '';
                let calledOnObjectText = ''; // 被调用对象的文本表示

                if (ts.isPropertyAccessExpression(expression)) {
                    methodName = expression.name.getText(sourceFile);
                    calledOnObjectText = expression.expression.getText(sourceFile);
                } else if (ts.isIdentifier(expression)) {
                    methodName = expression.getText(sourceFile);
                }

                const args = node.arguments;

                // 1. 检查 webview.loadData() 或 controller.loadData()
                if (methodName === 'loadData' || methodName === 'loadDataWithBaseUrl') {
                    if (args.length >= 1) {
                        const dataArgIndex = methodName === 'loadDataWithBaseUrl' ? 1 : 0;
                        const dataArgNode = args[dataArgIndex];
                        const mimeTypeArgNode = args.length > dataArgIndex + 1 ? args[dataArgIndex + 1] : undefined;

                        let isHtmlMimeType = false;
                        if (mimeTypeArgNode) {
                            if (ts.isStringLiteral(mimeTypeArgNode) || ts.isNoSubstitutionTemplateLiteral(mimeTypeArgNode)) {
                                if (mimeTypeArgNode.getText(sourceFile).toLowerCase().includes('text/html')) {
                                    isHtmlMimeType = true;
                                }
                            } else { // 如果mimeType是变量或复杂表达式，也标记为潜在风险
                                isHtmlMimeType = true;
                            }
                        }

                        if (isHtmlMimeType) {
                            // 修正: 分离条件表达式，确保类型安全
                            let isUnsafe = false;

                            // 如果不是字符串字面量，可能不安全
                            if (!ts.isStringLiteral(dataArgNode) && !ts.isNoSubstitutionTemplateLiteral(dataArgNode)) {
                                isUnsafe = true;
                            }
                            
                            // 如果是二元表达式且是 + 操作符（字符串拼接），可能不安全
                            if (ts.isBinaryExpression(dataArgNode)) {
                                if (dataArgNode.operatorToken.kind === ts.SyntaxKind.PlusToken) {
                                    isUnsafe = true;
                                }
                            }
                            
                            // 如果是模板表达式（如`${var}`），可能不安全
                            if (ts.isTemplateExpression(dataArgNode)) {
                                isUnsafe = true;
                            }

                            if (isUnsafe) {
                                this.reportIssueFromTsNode(targetFile, node, `WebView.${methodName}`,
                                    `检测到潜在的XSS风险: '${methodName}' 方法接收了未经处理的HTML内容，可能导致跨站脚本攻击。应确保所有内容经过安全处理。`);
                            }
                        }
                    }
                }

                // 2. 检查 webview.runJavaScript() 或 controller.runJavaScript()
                if (methodName === 'runJavaScript' || methodName === 'runJavaScriptExt') {
                    if (args.length >= 1) {
                        const scriptArgNode = args[0];
                        
                        // 修正: 分离条件表达式，确保类型安全
                        let isUnsafe = false;

                        // 如果不是字符串字面量，可能不安全
                        if (!ts.isStringLiteral(scriptArgNode) && !ts.isNoSubstitutionTemplateLiteral(scriptArgNode)) {
                            isUnsafe = true;
                        }
                        
                        // 如果是二元表达式且是 + 操作符（字符串拼接），可能不安全
                        if (ts.isBinaryExpression(scriptArgNode)) {
                            if (scriptArgNode.operatorToken.kind === ts.SyntaxKind.PlusToken) {
                                isUnsafe = true;
                            }
                        }
                        
                        // 如果是模板表达式（如`${var}`），可能不安全
                        if (ts.isTemplateExpression(scriptArgNode)) {
                            isUnsafe = true;
                        }

                        if (isUnsafe) {
                            this.reportIssueFromTsNode(targetFile, node, `WebView.${methodName}`,
                                `检测到潜在的XSS风险: '${methodName}' 方法可能执行未经验证的JavaScript代码。确保所有执行的脚本来自可信来源或经过安全处理。`);
                        }
                    }
                }

                // 3. 检查loadUrl方法，特别是加载不可信来源的URL
                if (methodName === 'loadUrl') {
                    if (args.length >= 1) {
                        const urlArgNode = args[0];
                        // 检查URL是否为变量或拼接而成
                        if (!ts.isStringLiteral(urlArgNode)) {
                            this.reportIssueFromTsNode(targetFile, node, `WebView.${methodName}`,
                                `检测到潜在安全风险: 加载的URL可能来自不可信来源，可能导致XSS攻击。确保验证所有URL。`);
                        } else if (urlArgNode.getText(sourceFile).includes('javascript:')) {
                            // 单独处理javascript:协议的情况
                            this.reportIssueFromTsNode(targetFile, node, `WebView.${methodName}`,
                                `检测到潜在安全风险: URL包含javascript:协议，可能导致XSS攻击。避免使用javascript:协议加载内容。`);
                        }
                    }
                }
            } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                // 检查 WebView 设置, e.g., controller.javaScriptEnabled = true
                const left = node.left;
                const right = node.right;
                if (ts.isPropertyAccessExpression(left)) {
                    const propertyName = left.name.getText(sourceFile);
                    if (propertyName === 'javaScriptEnabled') {
                        let jsEnabled = false;
                        if (right.kind === ts.SyntaxKind.TrueKeyword) {
                            jsEnabled = true;
                        } else if (ts.isCallExpression(right) && ts.isIdentifier(right.expression) && 
                                  right.expression.getText(sourceFile) === 'Boolean' && 
                                  right.arguments.length > 0 && 
                                  right.arguments[0].getText(sourceFile).includes('true')) {
                            jsEnabled = true; // Boolean('true')
                        }

                        if (jsEnabled) {
                            logger.info(`[XssCheck] WebView启用了JavaScript: ${node.getText(sourceFile).substring(0, 80)}`);
                            // 这不直接报告为问题，但会记录在日志中
                        }
                    }
                }
            }

            ts.forEachChild(node, visitNode);
        };

        visitNode(sourceFile); // 从源文件的根节点开始遍历

        // 此外，我们还检查类中的方法，寻找可能的XSS漏洞
        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                const cfg = arkMethod.getCfg();
                if (!cfg) continue;

                for (const stmt of cfg.getStmts()) {
                    const stmtText = stmt.getOriginalText();
                    if (!stmtText) continue;

                    // 通过文本匹配查找潜在XSS风险
                    // 这种方法不如AST遍历精确，但对于初步筛查很有效
                    if (stmtText.includes('loadData') && stmtText.includes('text/html')) {
                        if (stmtText.includes('${') || stmtText.includes(' + ') || 
                           !stmtText.match(/loadData\([^)]*"[^"]*"[^)]*\)/)) { // 简单检查第一个参数是否为字符串字面量
                            this.reportIssue(targetFile, stmt, "WebView.loadData", 
                                `检测到潜在的XSS风险: WebView加载了可能未经安全处理的HTML内容。`);
                        }
                    }

                    if (stmtText.includes('runJavaScript')) {
                        if (stmtText.includes('${') || stmtText.includes(' + ') || 
                           !stmtText.match(/runJavaScript\([^)]*"[^"]*"[^)]*\)/)) {
                            this.reportIssue(targetFile, stmt, "WebView.runJavaScript", 
                                `检测到潜在的XSS风险: 执行了可能未经验证的JavaScript代码。`);
                        }
                    }

                    if (stmtText.includes('loadUrl')) {
                        if (stmtText.includes('javascript:') || stmtText.includes('${') || 
                            stmtText.includes(' + ') || !stmtText.match(/loadUrl\([^)]*"[^"]*"[^)]*\)/)) {
                            this.reportIssue(targetFile, stmt, "WebView.loadUrl", 
                                `检测到潜在安全风险: 加载了可能不安全的URL或包含javascript:协议。`);
                        }
                    }
                }
            }
        }

        logger.info(`[XssCheck] 文件检查完成: ${targetFile.getFilePath()}`);
    }

    public reportIssue(arkFile: ArkFile, stmt: Stmt, issueType: string, message: string, severityOverride?: number): void {
        const severity = severityOverride !== undefined ? severityOverride : (this.rule?.alert ?? this.metaData.severity);
        const filePath = arkFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        if (!originPositionInfo) {
            logger.error("[XssCheck] 无法获取位置信息");
            return;
        }

        const lineNum = originPositionInfo.getLineNo();
        const colNum = originPositionInfo.getColNo();
        const text = stmt.getOriginalText() || issueType;

        const locationKey = `${filePath}:${lineNum}:${colNum}:${issueType}`;
        if (this.reportedLocations.has(locationKey)) {
            logger.info(`[XssCheck] 位置 ${locationKey} 已经报告过，跳过`);
            return;
        }
        this.reportedLocations.add(locationKey);

        logger.warn(`[XssCheck] 报告问题: 文件=${filePath}, 行=${lineNum}, 列=${colNum}, 类型=${issueType}, 消息=${message}`);

        const defects = new Defects(
            lineNum,
            colNum,
            colNum + text.length,
            message,
            severity,
            this.rule?.ruleId || "@software-sec/checker21241088/xss-check",
            filePath,
            this.metaData.ruleDocPath,
            true, false, false
        );

        this.issues.push(new IssueReport(defects, undefined));
    }

    // 基于ts.Node报告问题
    private reportIssueFromTsNode(arkFile: ArkFile, tsNode: ts.Node, issueType: string, message: string, severityOverride?: number): void {
        const severity = severityOverride !== undefined ? severityOverride : (this.rule?.alert ?? this.metaData.severity);
        const filePath = arkFile.getFilePath();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        if (!sourceFile) {
            logger.error("[XssCheck] 无法获取源文件用于报告TS Node问题");
            return;
        }

        const startPos = tsNode.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(startPos);
        const lineNum = line + 1; // ts行号从0开始
        const colNum = character + 1; // ts列号从0开始
        const text = tsNode.getText(sourceFile) || issueType;

        const locationKey = `${filePath}:${lineNum}:${colNum}:${issueType}`;
        if (this.reportedLocations.has(locationKey)) {
            logger.info(`[XssCheck] 位置 ${locationKey} 已经报告过，跳过`);
            return;
        }
        this.reportedLocations.add(locationKey);

        logger.warn(`[XssCheck] 报告问题: 文件=${filePath}, 行=${lineNum}, 列=${colNum}, 类型=${issueType}, 消息=${message}`);

        const defects = new Defects(
            lineNum,
            colNum,
            colNum + text.length, // 结束列可能不精确，但对于单行问题足够
            message,
            severity,
            this.rule?.ruleId || "@software-sec/checker21241088/xss-check",
            filePath,
            this.metaData.ruleDocPath,
            true, false, false
        );

        this.issues.push(new IssueReport(defects, undefined));
    }
}