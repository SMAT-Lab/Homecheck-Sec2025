/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ArkAssignStmt, ArkField, ArkFile, ArkInvokeStmt, ArkMethod, Stmt } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Rule, Defects, MethodMatcher, MatcherTypes, MatcherCallback, ClassMatcher, FieldMatcher, FileMatcher } from '../../Index';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoNewWrappersCheck');
const gMetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-new-wrappers-check.md',
    description: 'Do not use String as a constructor.'
};

interface WarnInfo {
    line: number, startCol: number, endCol: number, name: string, filePath: string;
};

interface CommentMatch {
    fullMatch: string;
    globalConfigs: Map<string, string>; // 存储变量名和其配置
};

export class NoNewWrappersCheck implements BaseChecker {
    readonly globalConfigRegex = /new String|new Number|new Boolean/;
    readonly metaData: BaseMetaData = gMetaData;
    readonly WRAPPERS_STR: string = 'string';
    readonly CREAER_STR: string = 'new String';
    readonly CREAERNUM_STR: string = 'new Number';
    readonly CREAERBOOL_STR: string = 'new Boolean';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private currentFilePath: string = '';
    public arkFile: ArkFile;
    public comments: CommentMatch[] = [];

    private fieldMatcher: FieldMatcher = {
        matcherType: MatcherTypes.FIELD,
    };

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };

    private clsMatcher: ClassMatcher = {
        matcherType: MatcherTypes.CLASS,
    };

    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.clsMatcher],
        file: [this.fileMatcher],
    };

    public registerMatchers(): MatcherCallback[] {
        const methodMatcherCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check,
        };
        const fieldMatcherCb: MatcherCallback = {
            matcher: this.fieldMatcher,
            callback: this.check,
        };
        return [methodMatcherCb, fieldMatcherCb];
    };

    public check = (target: ArkMethod | ArkField): void => {
        let newFile: ArkFile;

        if (target instanceof ArkMethod) {
            newFile = target.getDeclaringArkFile();
            this.updateFileContext(newFile);
            this.processStatements(target.getBody()?.getCfg().getStmts() ?? []);
        } else if (target instanceof ArkField) {
            newFile = target.getDeclaringArkClass().getDeclaringArkFile();
            this.updateFileContext(newFile);
            this.processStatements(target.getInitializer());
        };
    };

    private updateFileContext(newFile: ArkFile): void {
        const newFilePath = newFile.getFilePath();

        // 只有当文件路径改变时才更新文件上下文和重新解析注释
        if (this.currentFilePath !== newFilePath) {
            this.arkFile = newFile;
            this.currentFilePath = newFilePath;
            this.comments = this.getAllComments(this.arkFile.getCode());
        };
    }

    private processStatements(stmts: Stmt[]): void {
        for (const stmt of stmts) {
            if (stmt instanceof ArkAssignStmt) {
                continue;
            };
            const text = stmt.getOriginalText() ?? '';
            if (text && this.containsWrapperConstructor(text, stmt)) {
                this.addIssueReport(stmt);
            };
        };
    };

    private containsWrapperConstructor(text: string, stmt: Stmt): boolean {
        let eqIndex = text.indexOf('=') ?? -1;
        if (eqIndex === -1) {
            // 非赋值语句需要检查的情况
            if (stmt instanceof ArkInvokeStmt) {
                const blockStmts = stmt.getCfg()?.getStmts();
                if (blockStmts) {
                    return this.checkBlockStmts(blockStmts, stmt);
                };
            };
        } else {
            const textStr = text.split('=');
            if (textStr.length > 1) {
                /**
                 *  需要检查当前作用域中是否有变量声明覆盖了这些构造函数
                 *  需要检查是否有模块导入覆盖了这些构造函数
                 *  需要检查全局变量配置
                 */
                const isGlobalConstructor = this.isGlobalConstructor(textStr[1]?.trim(), stmt);
                return isGlobalConstructor && this.globalConfigRegex.test(textStr[1]?.trim());
            };
        };

        return false;
    };

    private checkBlockStmts(blockStmts: Stmt[], stmt: Stmt): boolean {
        for (const blockStmt of blockStmts) {
            if (!(blockStmt instanceof ArkAssignStmt)) {
                continue;
            };
            const textStr = blockStmt.getOriginalText() ?? '';
            if (textStr) {
                const isGlobalConstructor = this.isGlobalConstructor(textStr, stmt);
                return isGlobalConstructor && this.globalConfigRegex.test(textStr);
            };
        };
        return false;
    }

    private isGlobalConstructor(text: string, stmt: Stmt): boolean {
        let className = '';
        if (text.includes('(') && text.includes('new ')) {
            className = text.split('(')[0].replace('new ', '');
        } else if (text.includes('new ')) {
            className = text.replace('new ', '');
        };
        if (className.startsWith('return ')) {
            className = className.replace('return ', '');
        };
        if (className.endsWith(';')) {
            className = className.replace(';', '');
        };
        // 1. 检查当前作用域是否有同名变量声明
        let isDeclared = this.checkDeclared(className, stmt);
        // 2. 检查是否有同名模块导入
        let isImported = this.checkImported(className);
        // 3. 检查当前文件是否有全局变量配置
        let isGlobal = this.checkGlobalConfig(className);

        return (isImported || isDeclared || isGlobal) ? false : true;
    }

    private checkDeclared(className: string, stmt: Stmt): boolean {
        let isDeclared = false;
        let blocks = stmt.getCfg()?.getBlocks();
        if (!blocks) {
            return isDeclared;
        };
        for (const block of blocks) {
            let stmts = block.getStmts();
            for (const stmt of stmts) {
                if (stmt instanceof ArkAssignStmt && stmt.getLeftOp().toString() === className) {
                    isDeclared = true;
                    break;
                };
            };
        };
        return isDeclared;
    }

    private checkImported(className: string): boolean {
        let isImported = false;
        let imports = this.arkFile?.getImportInfos();
        if (!imports) {
            return isImported;
        };
        for (const importInfo of imports) {
            if (importInfo.getImportClauseName() === className) {
                isImported = true;
                break;
            };
        };
        return isImported;
    }

    private checkGlobalConfig(className: string): boolean {
        let isGlobal = false;
        // 获取当前文件的所有注释
        if (!this.comments) {
            return isGlobal;
        };
        for (const comment of this.comments) {
            if (comment.globalConfigs) {
                const config = comment.globalConfigs.get(className);
                if (config && config === 'off') {
                    isGlobal = true;
                };
            };
        };
        return isGlobal;
    }

    private getAllComments(code: string): CommentMatch[] {
        const comments: CommentMatch[] = [];
        const commentRegex = /\/\/(.*)|\/\*([\s\S]*?)\*\//g;
        const globalConfigRegex = /\/\*\s*global\s+([^*]*?)\s*\*\//;
        const variableConfigRegex = /(\w+)\s*:\s*(off|readable|writable|writeable)/g;

        let match;
        while ((match = commentRegex.exec(code)) !== null) {
            const fullMatch = match[0];
            // 检查是否是全局配置注释
            const globalMatch = globalConfigRegex.exec(fullMatch);
            let globalConfigs: Map<string, string>;

            if (globalMatch) {
                globalConfigs = new Map();
                const configText = globalMatch[1];
                let configMatch;

                while ((configMatch = variableConfigRegex.exec(configText)) !== null) {
                    const [, varName, config] = configMatch;
                    globalConfigs.set(varName, config);
                    comments.push({
                        fullMatch,
                        globalConfigs,
                    });
                };
            };
        };
        return comments;
    };

    private addIssueReport(stmt: Stmt): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt);
        const description = 'Do not use ' + warnInfo.name + ' as a constructor';
        let defect = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, description, severity, this.rule.ruleId,
            warnInfo.filePath as string, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    };
    private getLineAndColumn(stmt: Stmt): WarnInfo {
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition.getLineNo();
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        if (arkFile) {
            const originText = stmt.getOriginalText() ?? '';
            let startCol = originPosition.getColNo();

            if (/new String/.test(originText?.trim())) {
                return this.getWrapperPosition(originText, this.CREAER_STR, startCol, line, arkFile, 'String');
            } else if (/new Number/.test(originText?.trim())) {
                return this.getWrapperPosition(originText, this.CREAERNUM_STR, startCol, line, arkFile, 'Number');
            } else if (/new Boolean/.test(originText?.trim())) {
                return this.getWrapperPosition(originText, this.CREAERBOOL_STR, startCol, line, arkFile, 'Boolean');
            };
        } else {
            logger.debug('arkFile is null');
        };
        return { line: -1, startCol: -1, endCol: -1, name: '', filePath: '' };
    };

    private getWrapperPosition(text: string, wrapperStr: string, startCol: number, line: number, arkFile: any, name: string): WarnInfo {
        const pos = text.indexOf(wrapperStr);
        if (pos !== -1) {
            startCol += pos;
            const endCol = startCol + wrapperStr.length - 1;
            const originPath = arkFile.getFilePath();
            return { line, startCol, endCol, name, filePath: originPath };
        };
        return { line: -1, startCol: -1, endCol: -1, name: '', filePath: '' };
    };
}