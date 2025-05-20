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
        
        // 遍历文件中的所有字符串字面量
        const visitor = (node: ts.Node) => {
            if (ts.isStringLiteral(node)) {
                const value = node.text;
                if (value.startsWith('http://')) {
                    const start = node.getStart();
                    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(start);
                    this.reportIssue(targetFile, lineAndChar.line + 1, lineAndChar.character + 1, value);
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