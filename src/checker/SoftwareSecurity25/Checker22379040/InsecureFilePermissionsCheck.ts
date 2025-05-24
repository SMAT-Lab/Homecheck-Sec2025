import {ArkFile, ArkStaticInvokeExpr, AstTreeUtils, Constant, DefUseChain, Stmt, ts} from 'arkanalyzer';
import Logger, {LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {BaseChecker, BaseMetaData} from '../../BaseChecker';
import {Defects} from '../../../Index';
import {FileMatcher, MatcherCallback, MatcherTypes} from '../../../Index';
import {Rule} from '../../../Index';
import {IssueReport} from '../../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'InsecureFilePermissionsCheck');

const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: '',
    description: '检测不安全的文件权限设置，包括过于宽松的文件权限、全局可读写文件等安全风险'
};

export class InsecureFilePermissionsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        }
        return [fileMatchBuildCb];
    }

    public check = (targetFile: ArkFile) => {
        // 检查所有类和方法中的文件权限相关代码
        for (const arkClass of targetFile.getClasses()) {
            for (const arkMethod of arkClass.getMethods()) {
                if (arkMethod.getName() == '_DEFAULT_ARK_METHOD') {
                    continue;
                }
                
                const cfg = arkMethod.getCfg();
                if (cfg == undefined) {
                    continue;
                }
                
                for (const stmt of cfg.getStmts()) {
                    const text = stmt.getOriginalText();
                    if (!text) {
                        continue;
                    }

                    // 检测chmod使用不安全权限
                    if (this.containsInsecureChmod(text)) {
                        this.addIssue(targetFile, stmt, 'Insecure file permissions detected. File permissions are too permissive and may expose sensitive data.');
                    }

                    // 检测临时文件的不安全创建
                    if (this.containsInsecureTempFile(text)) {
                        this.addIssue(targetFile, stmt, 'Insecure temporary file creation detected. Temporary files should have restrictive permissions.');
                    }

                    // 检测在公共目录创建文件
                    if (this.containsPublicDirectoryUsage(text)) {
                        this.addIssue(targetFile, stmt, 'File created in public directory detected. This may expose sensitive information to other applications.');
                    }

                    // 检测敏感文件的不安全权限
                    if (this.containsSensitiveFileWithWeakPermissions(text)) {
                        this.addIssue(targetFile, stmt, 'Sensitive file with weak permissions detected. Files containing sensitive data should have restrictive permissions.');
                    }

                    // 检测日志文件的权限问题
                    if (this.containsInsecureLogFile(text)) {
                        this.addIssue(targetFile, stmt, 'Log file with insecure permissions detected. Log files may contain sensitive information.');
                    }
                }
            }
        }
    }

    private containsInsecureChmod(text: string): boolean {
        // 检测chmod使用不安全的权限值
        if (!text.includes('chmod')) {
            return false;
        }

        // 检测危险的权限值
        const dangerousPermissions = [
            /chmod\w*\([^,]+,\s*0o777\)/,  // 777权限
            /chmod\w*\([^,]+,\s*0o666\)/,  // 666权限
            /chmod\w*\([^,]+,\s*0o755\)/,  // 755权限（对某些文件类型不安全）
            /chmod\w*\([^,]+,\s*0o644\)/,  // 644权限（对敏感文件不安全）
            /chmod\w*\([^,]+,\s*511\)/,    // 十进制777
            /chmod\w*\([^,]+,\s*438\)/,    // 十进制666
            /chmod\w*\([^,]+,\s*493\)/,    // 十进制755
            /chmod\w*\([^,]+,\s*420\)/     // 十进制644
        ];

        return dangerousPermissions.some(pattern => pattern.test(text));
    }

    private containsInsecureTempFile(text: string): boolean {
        // 检测临时文件的不安全创建
        const tempFilePatterns = [
            /\/tmp\/.*\.tmp/,
            /\/temp\/.*\.tmp/,
            /createTempFile/,
            /temp.*chmod/,
            /\.tmp.*chmod/
        ];

        return tempFilePatterns.some(pattern => pattern.test(text));
    }

    private containsPublicDirectoryUsage(text: string): boolean {
        // 检测在公共目录创建文件
        const publicDirPatterns = [
            /\/tmp\//,
            /\/temp\//,
            /\/public\//,
            /\/shared\//,
            /\/sdcard\//,
            /\/storage\/emulated\/0\//
        ];

        return publicDirPatterns.some(pattern => pattern.test(text));
    }

    private containsSensitiveFileWithWeakPermissions(text: string): boolean {
        // 检测敏感文件类型且设置了弱权限
        const sensitiveFilePatterns = [
            /\.key.*chmod/,
            /password.*chmod/,
            /secret.*chmod/,
            /token.*chmod/,
            /\.db.*chmod/,
            /\.sqlite.*chmod/,
            /config.*chmod/,
            /\.conf.*chmod/,
            /credential.*chmod/,
            /private.*chmod/
        ];

        return sensitiveFilePatterns.some(pattern => pattern.test(text));
    }

    private containsInsecureLogFile(text: string): boolean {
        // 检测日志文件的权限问题
        const logFilePatterns = [
            /\.log.*chmod/,
            /log.*chmod/,
            /logging.*chmod/,
            /\/logs\/.*chmod/
        ];

        return logFilePatterns.some(pattern => pattern.test(text));
    }    private addIssue(targetFile: ArkFile, stmt: Stmt, message: string): void {
        const filePath = targetFile.getFilePath();
        const originPositionInfo = stmt.getOriginPositionInfo();
        const lineNum = originPositionInfo.getLineNo();
        const text = stmt.getOriginalText();
        if (!text || text.length === 0) {
            return;
        }
        const startColumn = originPositionInfo.getColNo();
        const endColumn = startColumn + text.length;
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, 2, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}
