/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    ArkAssignStmt,
    ArkInvokeStmt,
    Stmt,
    Local,
    ArkInstanceInvokeExpr,
    ts,
    ArkInstanceFieldRef,
    ArkNewArrayExpr,
    ArkPtrInvokeExpr,
    ArkNormalBinopExpr,
    ArkFile,
    AstTreeUtils,
    ArkMethod,
} from 'arkanalyzer';
import { Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects } from '../../Index';
import {
    FileMatcher,
    MatcherCallback,
    MatcherTypes,
} from '../../Index';
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from "../../model/Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoUnexpectedMultilineCheck');

interface MessageInfo {
    line: number;
    character: number;
    endCol: number;
    message: string;
}

export class NoUnexpectedMultilineCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public sourceFile: ts.SourceFile;
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-unexpected-multiline-check.md',
        description: 'Disallow confusing multiline expressions.',
    };

    // 添加静态缓存
    private static readonly sourceFileCache = new Map<string, ts.SourceFile>();

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    public registerMatchers(): MatcherCallback[] {
        const methodMatcherCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check,
        };
        return [methodMatcherCb];
    }

    // 在对象名和紧随其后的左方括号[之间（用于属性访问）是否有换行符
    public checkNewlineBeforePropertyAccess(code: string): boolean {
        // 使用正则表达式查找属性访问，并检查对象名和左方括号之间是否存在换行符
        const regex = /[^;\s]\r\n\s*[\(\[\+\-\*\/]/; // 匹配对象名、换行符和左方括号
        if (regex.test(code)) {
            // 检查是否包含可选链操作符
            const lines = code.split('\n');
            for (let i = 0; i < lines.length - 1; i++) {
                if (lines[i].trim().endsWith('?.')) {
                    return true;
                }
            }
            return false;
        } else {
            return true;
        }
    }

    private testAfterThreeFun(stmt: ArkAssignStmt | ArkInvokeStmt, code: string, fileName: string) {
        const warnInfo = this.getLineAndColumn(stmt);
        const severity = this.rule.alert ?? this.metaData.severity;

        const objResult = this.checkNewlineBeforePropertyAccess(code);
        const result2 = this.checkNewlineBetweenObjectAndBracket(code, fileName);
        if (!objResult && result2.length > 0) {
            result2.forEach(pos => {
                pos.line = warnInfo.line + pos.line - 1;
                pos.character = pos.character;
                this.addIssueReport(warnInfo.filePath, pos, severity)
            });
        }

        const templateResult = this.checkNewlineBetweenTagAndTemplateLiteral(code, fileName);
        if (templateResult.length > 0) {
            templateResult.forEach(pos => {
                pos.line = warnInfo.line + pos.line - 1;
                pos.character = warnInfo.startCol;
                this.addIssueReport(warnInfo.filePath, pos, severity)
            });
        }

        const divisionResult = this.checkNewlineBetweenNumeratorAndDivisionOperator(code, fileName);
        if (divisionResult.length > 0) {
            divisionResult.forEach(pos => {
                pos.line = warnInfo.line + pos.line - 1;
                this.addIssueReport(warnInfo.filePath, pos, severity)
            });
        }
    }

    private addIssueReport(filePath: string, pos: MessageInfo, severity: number) {
        let defect = new Defects(pos.line, pos.character, pos.endCol, pos.message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private getLineAndColumn(stmt: Stmt) {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            let startCol = originPosition.getColNo();
            const filePath = arkFile.getFilePath();
            return { line, startCol, filePath };
        } else {
            logger.debug('originStmt or arkFile is null');
        }
        return { line: -1, startCol: -1, filePath: '' };
    }

    private getSourceFile(code: string, fileName: string): ts.SourceFile {
        // 检查静态缓存
        let sourceFile = NoUnexpectedMultilineCheck.sourceFileCache.get(code);
        if (!sourceFile) {
            sourceFile = AstTreeUtils.getASTNode(fileName, code);
            NoUnexpectedMultilineCheck.sourceFileCache.set(code, sourceFile);
        }
        return sourceFile;
    }

    // 检查对象名和左方括号之间是否存在换行符
    private checkNewlineBetweenObjectAndBracket(code: string, fileName: string): MessageInfo[] {
        const errors: MessageInfo[] = [];
        this.sourceFile = this.getSourceFile(code, fileName);
        const checkForBreakAfter = (node: ts.Node) => {
            if (ts.isElementAccessExpression(node)) {
                const expressionEnd = node.expression.getEnd();
                const openBracketStart = node.argumentExpression.getStart(this.sourceFile, true);
                const expressionEndLine = this.sourceFile.getLineAndCharacterOfPosition(expressionEnd).line;
                const openBracketStartLine = this.sourceFile.getLineAndCharacterOfPosition(openBracketStart).line;
                errors.push(...this.checkNewlineBetweenObjectAndBracketBody(node, expressionEndLine, openBracketStartLine, openBracketStart));
            }
            ts.forEachChild(node, checkForBreakAfter);
        };

        ts.forEachChild(this.sourceFile, checkForBreakAfter);
        return errors;
    }

    private checkNewlineBetweenObjectAndBracketBody(node: ts.Node, expressionEndLine: number,
        openBracketStartLine: number, openBracketStart: number): MessageInfo[] {
        const errors: MessageInfo[] = [];
        if (expressionEndLine !== openBracketStartLine) {
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(openBracketStart);
            errors.push({
                line: line + 1,
                character: character,
                endCol: character + 1 + node.getText().length,
                message: 'Unexpected newline between object and [ of property access'
            });
        }
        return errors;
    }

    // 检查模板标签和模板字面量之间是否存在换行符
    private checkNewlineBetweenTagAndTemplateLiteral(code: string, fileName: string): MessageInfo[] {
        const errors: MessageInfo[] = [];
        this.sourceFile = this.getSourceFile(code, fileName);
        const checkForBreakAfter = (node: ts.Node) => {
            if (ts.isTaggedTemplateExpression(node)) {
                const tagEnd = node.tag.getEnd();
                const templateStart = node.template.getStart(this.sourceFile, true);
                const tagEndLine = this.sourceFile.getLineAndCharacterOfPosition(tagEnd).line;
                const templateStartLine = this.sourceFile.getLineAndCharacterOfPosition(templateStart).line;
                errors.push(...this.checkNewlineBetweenTagAndTemplateLiteralBody(node, tagEndLine, templateStartLine, templateStart));
            }
            ts.forEachChild(node, checkForBreakAfter);
        };

        ts.forEachChild(this.sourceFile, checkForBreakAfter);
        return errors;
    }

    private checkNewlineBetweenTagAndTemplateLiteralBody(node: ts.Node, tagEndLine: number,
        templateStartLine: number, templateStart: number): MessageInfo[] {
        const errors: MessageInfo[] = [];
        if (tagEndLine !== templateStartLine) {
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(templateStart);
            errors.push({
                line: line + 1,
                character: character + 1,
                endCol: character + 1 + node.getText().length,
                message: 'Unexpected newline between template tag and template literal'
            });
        }
        return errors;
    }

    // 检查分子和除法运算符之间是否存在换行符
    private checkNewlineBetweenNumeratorAndDivisionOperator(code: string, fileName: string): MessageInfo[] {
        const errors: MessageInfo[] = [];
        this.sourceFile = this.getSourceFile(code, fileName);
        const checkForBreakAfter = (node: ts.Node) => {
            if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.SlashToken) {
                const numeratorEnd = node.left.getEnd();
                const divisionOperatorStart = node.operatorToken.getStart(this.sourceFile, true);
                const numeratorEndLine = this.sourceFile.getLineAndCharacterOfPosition(numeratorEnd).line;
                const divisionOperatorStartLine = this.sourceFile.getLineAndCharacterOfPosition(divisionOperatorStart).line;

                if (numeratorEndLine !== divisionOperatorStartLine) {
                    const fullText = this.sourceFile.getFullText();
                    const rightStart = node.right.getStart();
                    const nextLine = fullText.slice(rightStart).split('\n')[0].trim();
                    errors.push(...this.checkNewlineBetweenNumeratorAndDivisionOperatorBody(nextLine, divisionOperatorStart, node));
                }
            }
            ts.forEachChild(node, checkForBreakAfter);
        };

        ts.forEachChild(this.sourceFile, checkForBreakAfter);
        return errors;
    }

    private checkNewlineBetweenNumeratorAndDivisionOperatorBody(nextLine: string, divisionOperatorStart: number, node: ts.Node): MessageInfo[] {
        const errors: MessageInfo[] = [];
        // 检查是否是正则表达式的标志或调用
        const isRegexFlag = /^bar\s*\/[gims]+(?:\.test\([^)]*\))?$/.test(nextLine) || // 匹配 bar /g 或 bar /g.test(baz)
            /^bar\s*\/[a-z]+(?:\.test\([^)]*\))?$/.test(nextLine) || // 匹配其他字母标志
            /^bar\/[gims]+(?:\.test\([^)]*\))?$/.test(nextLine) || // 匹配无空格的情况
            /^bar\/[a-z]+(?:\.test\([^)]*\))?$/.test(nextLine) || // 匹配其他无空格的情况
            /^regex\/g\.test\([^)]*\)$/.test(nextLine); // 匹配 regex/g.test(bar) 的情况

        if (isRegexFlag) {
            const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(divisionOperatorStart);
            errors.push({
                line: line + 1,
                character: character + 1,
                endCol: character + 1 + node.getText().length,
                message: 'Unexpected newline between numerator and division operator'
            });
        }
        return errors;
    }

    private checkNewlineBeforeParen(codeStr: string, stmt?: ArkAssignStmt | ArkInvokeStmt): MessageInfo[] {
        const errors: MessageInfo[] = [];
        const lines = codeStr.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
            const currentLine = lines[i].trim();
            const nextLine = lines[i + 1].trim();

            // 检查是否是变量声明且下一行以括号开始
            if ((currentLine.startsWith('var ') || currentLine.startsWith('let ') ||
                currentLine.startsWith('const ')) && nextLine.startsWith('(')) {
                // 检查当前行是否包含可选链操作符
                const hasOptionalChaining = currentLine.includes('?.');

                // 只有在不包含可选链操作符时才报错
                if (!hasOptionalChaining) {
                    // 计算错误位置
                    const line = i + 2;
                    const currentLineIndent = lines[i].length - lines[i].trimStart().length;
                    const parenIndexInNextLine = nextLine.indexOf('(');
                    const character = currentLineIndent + parenIndexInNextLine + 1;
                    errors.push({
                        line: line,
                        character: character,
                        endCol: character + 1 + codeStr.length,
                        message: 'Unexpected newline between function and ( of function call'
                    });
                }
            }
        }
        return errors;
    }

    private checkFunAndC(stmt: ArkAssignStmt | ArkInvokeStmt, mtdNameOriginText: string): void {
        const warnInfo = this.getLineAndColumn(stmt);
        if (mtdNameOriginText.length > 1) {
            let funRuleParen = this.checkNewlineBeforeParen(mtdNameOriginText, stmt);
            if (funRuleParen?.length > 0) {
                for (let index = 0; index < funRuleParen.length; index++) {
                    const pos = funRuleParen[index];
                    pos.line = warnInfo.line + pos.line - 1;
                    pos.character = warnInfo.startCol;
                    const severity = this.rule.alert ?? this.metaData.severity;
                    this.addIssueReport(warnInfo.filePath, {
                        line: pos.line, character: pos.character,
                        endCol: pos.character + mtdNameOriginText.length, message: pos.message
                    }, severity)
                }
            }
        }
    }

    private checkArkAssignStmt(stmts: Stmt[], fileName: string): void {
        for (const stmt of stmts) {
            const text = stmt.getOriginalText() ?? '';
            if (text.length <= 0) {
                continue;
            }
            if (stmt instanceof ArkAssignStmt) {
                const leftOp = stmt.getLeftOp();
                if (!(leftOp instanceof Local)) {
                    continue;
                }
                const rightOp = stmt.getRightOp();
                if (rightOp instanceof ArkInstanceInvokeExpr) {
                    this.checkFunAndC(stmt, text);
                }

                if (rightOp instanceof ArkInstanceInvokeExpr ||
                    rightOp instanceof Local ||
                    rightOp instanceof ArkInstanceFieldRef ||
                    rightOp instanceof ArkPtrInvokeExpr ||
                    rightOp instanceof ArkNewArrayExpr ||
                    rightOp instanceof ArkNormalBinopExpr) {
                    this.testAfterThreeFun(stmt, text, fileName);
                }
            }
        }
    }

    private checkMethodsInClass(methods: ArkMethod[], fileName: string): void {
        for (let method of methods) {
            const stmts = method.getBody()?.getCfg()?.getStmts() ?? [];
            this.checkArkAssignStmt(stmts, fileName);
        }
    }

    public check = (target: ArkFile) => {
        let classes = target.getClasses();
        const severity = this.rule.alert ?? this.metaData.severity;
        let fileName = target.getName();
        for (let classDemo of classes) {
            classDemo.getFields().forEach(field => {
                let code = field.getCode();
                if (code.length > 0) {
                    let line = field.getOriginPosition().getLineNo();
                    const objResult = this.checkNewlineBeforePropertyAccess(code);
                    const result2 = this.checkNewlineBetweenObjectAndBracket(code, fileName);
                    if (!objResult && result2.length > 0) {
                        result2.forEach(pos => {
                            pos.line = line + 1;
                            pos.character = 1;
                            this.addIssueReport(target.getFilePath(), pos, severity)
                        });
                    }
                }
            });
            this.checkMethodsInClass(classDemo.getMethods(), fileName);
        }
    };
}