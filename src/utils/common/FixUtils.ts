import { ArkClass, ArkFile, ArkMethod, ExportInfo, ImportInfo, Stmt } from 'arkanalyzer';
import { AIFix, FunctionFix, RuleFix } from '../../model/Fix';

export class FixUtils {

    public static getRangeStart(arkFile: ArkFile, codeNode: Stmt | ArkMethod | ArkClass | ExportInfo | ImportInfo): number {
        let lineNum = 0;
        let startColumn = 0;
        if (codeNode instanceof Stmt) {
            let originalPosition = codeNode.getOriginPositionInfo();
            lineNum = originalPosition.getLineNo();
            startColumn = originalPosition.getColNo();
        } else if (codeNode instanceof ArkMethod) {
            lineNum = codeNode.getLine() ?? 0;
            startColumn = codeNode.getColumn() ?? 0;
        } else if (codeNode instanceof ArkClass) {
            lineNum = codeNode.getLine() ?? 0;
            startColumn = codeNode.getColumn() ?? 0;
        } else if (codeNode instanceof ExportInfo) {
            let originalPosition = codeNode.getOriginTsPosition();
            lineNum = originalPosition.getLineNo();
            startColumn = originalPosition.getColNo();
        } else if (codeNode instanceof ImportInfo) {
            let originalPosition = codeNode.getOriginTsPosition();
            lineNum = originalPosition.getLineNo();
            startColumn = originalPosition.getColNo();
        }
        // 原文代码
        let code = arkFile.getCode();
        // 找到当前分割符所在行
        let lineBreak = this.getTextEof(code);
        let cnt = 0;
        if (lineBreak.length > 0) {
            for (let index = 1; index !== lineNum; index++) {
                cnt = code.indexOf(lineBreak, cnt + 1);
            }
        }
        let start = (cnt === 0 && startColumn === 1) ? 0 : (cnt + startColumn + 1);//对第一行第一列特殊处理，后续代码都是以0，所以需要+1
        return start;
    }

    public static getTextEof(text: string): string {
        if (text.includes('\r\n')) {
            return '\r\n';
        } else if (text.includes('\n')) {
            return '\n';
        } else if (text.includes('\r')) {
            return '\r';
        } else {
            return '';
        }
    }

    public static isRuleFix(object: any): object is RuleFix {
        return typeof object === 'object' && 'range' in object && 'text' in object;
    }

    public static isFunctionFix(object: any): object is FunctionFix {
        return typeof object === 'object' && 'fix' in object;
    }

    public static isAIFix(object: any): object is AIFix {
        return typeof object === 'object' && 'text' in object;
    }

    public static hasOwnPropertyOwn(object: any, key: string): boolean {
        return typeof object === 'object' && key in object;
    }
}