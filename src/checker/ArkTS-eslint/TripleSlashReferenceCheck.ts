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


import { ImportInfo, ArkMethod, ArkFile, LineColPosition } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { ClassMatcher, FileMatcher, MatcherCallback, MatcherTypes, MethodMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
const defaultOptions: Options = {
    lib: 'always',
    path: 'never',
    types: 'prefer-import'
};
interface Options {
    lib?: 'always' | 'never';
    path?: 'always' | 'never';
    types?: 'always' | 'never' | 'prefer-import';
};
type importInfo = {
    declaringArkFile: ArkFile,
    importClauseName: string,
    importFrom: string,
    importType: string,
    lazyExportInfo: string,
    modifiers: number,
    nameBeforeAs: string,
    originTsPosition: LineColPosition
};
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'TripleSlashReferenceCheck');
const gmetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/triple-slash-reference-check.md',
    description: 'Do not use a triple slash reference for code, use `import` style instead.'
};
export class TripleSlashReferenceCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gmetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    private classMatcher: ClassMatcher = {
        file: [this.fileMatcher],
        matcherType: MatcherTypes.CLASS
    };
    private methodMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
        class: [this.classMatcher]
    };
    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.methodMatcher,
            callback: this.check
        };
        return [matchBuildCb];
    }
    public check = (method: ArkMethod): void => {
        // 将规则选项转换为Options类型
        let options: Options;
        if (this.rule && this.rule.option.length > 0) {
            options = this.rule.option[0] as Options;
        } else {
            options = defaultOptions;
        }
        if (method instanceof ArkMethod) {
            let declareClass = method.getDeclaringArkClass();
            const arkFile = declareClass.getDeclaringArkFile();
            const code = arkFile.getCode() ?? '';
            if (this.tripleSlash(code)) {
                this.optionsCheck1(options, code, arkFile);
                this.optionsCheck2(options, code, arkFile);
                this.optionsCheck3(options, code, arkFile);
            }
        }
    };
    private optionsCheck1(options: Options, code: string, arkFile: ArkFile): void {
        this.optionsCheck11(options, code, arkFile);
        this.optionsCheck12(options, code, arkFile);
        this.optionsCheck13(options, code, arkFile);
        this.optionsCheck14(options, code, arkFile);
        this.optionsCheck15(options, code, arkFile);
        this.optionsCheck16(options, code, arkFile);
        this.optionsCheck17(options, code, arkFile);
    }
    private optionsCheck11(options: Options, code: string, arkFile: ArkFile): void {
        if (options.lib === 'always' && options.types === 'never' && options.path === 'never') {
            this.allLibAlwaysCheck(code, arkFile);
        }
        if (options.lib === 'always' && !options.path && !options.types) {
            this.allPathNeverAndImportCheck(code, arkFile);
        }
    }
    private optionsCheck12(options: Options, code: string, arkFile: ArkFile): void {
        if (!options.path && options.types === 'never' && options.lib === 'never') {
            this.AllCheck(code, arkFile);
        }
        if (!options.path && options.types === 'always' && options.lib === 'never') {
            this.allTypesAlwaysCheck(code, arkFile);
        }
    }
    private optionsCheck13(options: Options, code: string, arkFile: ArkFile): void {
        if (options.lib === 'never' && options.types === 'prefer-import' && !options.path) {
            this.allTypeAlwaysAndImportCheck(code, arkFile);
        }
        if (!options.path && options.types === 'never' && options.lib === 'always') {
            this.allLibAlwaysCheck(code, arkFile);
        }
    }
    private optionsCheck14(options: Options, code: string, arkFile: ArkFile): void {
        if (!options.path && options.types === 'always' && options.lib === 'always') {
            this.allPathNeverCheck(code, arkFile);
        }
        if (options.lib === 'always' && !options.path && options.types === 'prefer-import') {
            this.allPathNeverAndImportCheck(code, arkFile);
        }
    }
    private optionsCheck15(options: Options, code: string, arkFile: ArkFile): void {
        if (options.path === 'always' && options.types === 'never' && options.lib === 'never') {
            this.allPathAlwaysCheck(code, arkFile);
        }
        if (options.path === 'always' && !options.types && !options.lib) {
            this.allPathNeverAndImportCheck(code, arkFile);
        }
    }
    private optionsCheck16(options: Options, code: string, arkFile: ArkFile): void {
        if (options.path === 'never' && options.types === 'always' && !options.lib) {
            this.allPathNeverCheck(code, arkFile);
        }
        if (options.path === 'never' && options.types === 'never' && !options.lib) {
            this.allLibAlwaysCheck(code, arkFile);
        }
    }
    private optionsCheck17(options: Options, code: string, arkFile: ArkFile): void {
        if (!options.lib && options.path === 'never' && options.types === 'prefer-import') {
            this.allPathNeverAndImportCheck(code, arkFile);
        }
        if (options.path === 'always' && options.types === 'always' && !options.lib) { }
    }
    private optionsCheck2(options: Options, code: string, arkFile: ArkFile): void {
        this.optionsCheck21(options, code, arkFile);
        this.optionsCheck22(options, code, arkFile);
        this.optionsCheck23(options, code, arkFile);
        this.optionsCheck24(options, code, arkFile);
        this.optionsCheck25(options, code, arkFile);
    }
    private optionsCheck21(options: Options, code: string, arkFile: ArkFile): void {
        if (options.path === 'always' && options.types === 'never' && !options.lib) {
            this.allTypesNeverCheck(code, arkFile);
        }
        if (!options.lib && options.path === 'always' && options.types === 'prefer-import') {
            this.allImportCheck(code, arkFile);
        }
    }
    private optionsCheck22(options: Options, code: string, arkFile: ArkFile): void {
        if (options.path === 'never' && options.types === 'never' && options.lib === 'never') {
            this.AllCheck(code, arkFile);
        }
        if (options.path === 'always' && options.types === 'always' && options.lib === 'always') { }
    }
    private optionsCheck23(options: Options, code: string, arkFile: ArkFile): void {
        if (!options.types && options.lib === 'never' && options.path === 'never') {
            this.allTypeAlwaysAndImportCheck(code, arkFile);
        }
        if (options.types === 'always' && options.lib === 'never' && options.path === 'never') {
            this.allTypesAlwaysCheck(code, arkFile);
        }
    }
    private optionsCheck24(options: Options, code: string, arkFile: ArkFile): void {
        if (options.types === 'always' && !options.lib && !options.path) {
            this.allPathNeverCheck(code, arkFile);
        }
        if (options.lib === 'always' && options.path === 'always' && options.types === 'never') {
            this.allTypesNeverCheck(code, arkFile);
        }
    }
    private optionsCheck25(options: Options, code: string, arkFile: ArkFile): void {
        if (options.types === 'never' && !options.lib && !options.path) {
            this.allLibAlwaysCheck(code, arkFile);
        }
        if (options.lib === 'always' && options.path === 'never' && !options.types) {
            this.allPathNeverAndImportCheck(code, arkFile);
        }
    }
    private optionsCheck3(options: Options, code: string, arkFile: ArkFile): void {
        this.optionsCheck31(options, code, arkFile);
        this.optionsCheck32(options, code, arkFile);
        this.optionsCheck33(options, code, arkFile);
        this.optionsCheck34(options, code, arkFile);
        this.optionsCheck35(options, code, arkFile);
    }
    private optionsCheck31(options: Options, code: string, arkFile: ArkFile): void {
        if (options.lib === 'always' && options.path === 'never' && !options.types) {
            this.allLibNeverAndImportCheck(code, arkFile);
        }
        if (options.lib === 'always' && options.types === 'always' && options.path === 'never') {
            this.allPathNeverCheck(code, arkFile);
        }
    }
    private optionsCheck32(options: Options, code: string, arkFile: ArkFile): void {
        if (options.path === 'never' && !options.types && !options.lib) {
            this.allPathNeverAndImportCheck(code, arkFile);
        }
        if (options.path === 'always' && options.types === 'always' && options.lib === 'never') {
            this.allLibNeverCheck(code, arkFile);
        }
    }
    private optionsCheck33(options: Options, code: string, arkFile: ArkFile): void {
        if (options.lib === 'never' && !options.types && !options.path) {
            this.allTypeAlwaysAndImportCheck(code, arkFile);
        }
        if (options.lib === 'always' && options.path === 'always' && !options.types) {
            this.allImportCheck(code, arkFile);
        }
    }
    private optionsCheck34(options: Options, code: string, arkFile: ArkFile): void {
        if (options.lib === 'always' && options.path === 'always' && options.types === 'prefer-import') {
            this.allImportCheck(code, arkFile);
        }
        if (options.lib && options.lib === 'never' && options.path === 'always' && options.types === 'prefer-import') {
            this.allLibNeverAndImportCheck(code, arkFile);
        }
    }
    private optionsCheck35(options: Options, code: string, arkFile: ArkFile): void {
        if (options.lib === 'always' && options.path === 'never' && options.types === 'prefer-import') {
            this.allPathNeverAndImportCheck(code, arkFile);
        }
        if (options.types === 'prefer-import' && !options.lib && !options.path) {
            this.allPathNeverAndImportCheck(code, arkFile);
        }
    }
    private AllCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.AllCheck1(matched, arkFile);
            }
        }
    }
    private AllCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.allCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allTypesAlwaysCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allTypesAlwaysCheck1(matched, arkFile);
            }
        }
    }
    private allTypesAlwaysCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.typesAlwaysCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allPathAlwaysCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allPathAlwaysCheck1(matched, arkFile);
            }
        }
    }
    private allPathAlwaysCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.pathAlwaysCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allTypesNeverCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allTypesNeverCheck1(matched, arkFile);
            }
        }
    }
    private allTypesNeverCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.typesNeverCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allLibAlwaysCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allLibAlwaysCheck1(matched, arkFile);
            }
        }
    }
    private allLibAlwaysCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.libAlwaysCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allPathNeverCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allPathNeverCheck1(matched, arkFile);
            }
        }
    }
    private allPathNeverCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.pathNeverCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allLibNeverCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allLibNeverCheck1(matched, arkFile);
            }
        }
    }
    private allLibNeverCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.libNeverCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allTypeAlwaysAndImportCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allTypeAlwaysAndImportCheck1(matched, arkFile);
            }
        }
    }
    private allTypeAlwaysAndImportCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.typeAlwaysAndImportCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allImportCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allImportCheck1(matched, arkFile);
            }
        }
    }
    private allImportCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (this.ImportCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allLibNeverAndImportCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allLibNeverAndImportCheck1(matched, arkFile);
            }
        }
    }
    private allLibNeverAndImportCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.libNeverAndImportCheck(matched, i, arkFile)) {
                    continue;
                }
            }
        }
    }
    private allPathNeverAndImportCheck(code: string, arkFile: ArkFile): void {
        if (this.normalDirectives(code)) {
            const matched = code.split('\r\n');
            if (matched) {
                this.allPathNeverAndImportCheck1(matched, arkFile);
            }
        }
    }
    private allPathNeverAndImportCheck1(matched: string[], arkFile: ArkFile): void {
        for (let i = 0; i < matched.length; i++) {
            if (this.tripleSlash(matched[i])) {
                if (!this.pathNeverAndImportCheck(matched, i, arkFile)) {
                    continue;
                };
            }
        }
    }
    private ImportCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        const importInfos = arkFile.getImportInfos();
        if (importInfos.length > 0 && this.typesNeverDirectives(matched[i])) {
            if (!this.checkSpecial(matched, i)) {
                return true;
            }
            const match = matched[i].match(/types\s*=\s*"([^"]*)"/);
            if (match) {
                this.checkImport(match, importInfos, matched, i, arkFile);
            }
        }
        return false;
    }
    private pathNeverAndImportCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        let hasPathIssue = false;
        let hasImportIssue = false;

        // 处理path相关检查
        hasPathIssue = this.pathNeverCheck(matched, i, arkFile);
        // 处理import相关检查
        hasImportIssue = !this.checkImportInfo(arkFile, matched, i);

        return !hasPathIssue && !hasImportIssue;
    }
    private libNeverAndImportCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        let hasLibIssue = false;
        let hasImportIssue = false;

        // 处理lib相关检查
        hasLibIssue = this.libNeverCheck(matched, i, arkFile);
        // 处理import相关检查
        hasImportIssue = !this.checkImportInfo(arkFile, matched, i);

        return !hasLibIssue && !hasImportIssue;
    }
    private typeAlwaysAndImportCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        let hasTypeIssue = false;
        let hasImportIssue = false;

        // 处理type相关检查
        hasTypeIssue = this.typesAlwaysCheck(matched, i, arkFile);
        // 处理import相关检查
        hasImportIssue = !this.checkImportInfo(arkFile, matched, i);

        return !hasTypeIssue && !hasImportIssue;
    }
    private allCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        if (!this.checkSpecial(matched, i)) {
            return false;
        }
        const target = this.extractCode(matched[i]);
        if (target) {
            this.addIssueReport(arkFile, matched[i], target);
        }
        return true;
    }
    private typesAlwaysCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        if (this.typesAlwaysDirectives(matched[i])) {
            return this.allCheck(matched, i, arkFile);
        }
        return true;
    }
    private typesNeverCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        if (this.typesNeverDirectives(matched[i])) {
            return this.allCheck(matched, i, arkFile);
        }
        return true;
    }
    private libAlwaysCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        if (this.libAlwaysDirectives(matched[i])) {
            return this.allCheck(matched, i, arkFile);
        }
        return true;
    }
    private pathNeverCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        if (this.pathNeverDirectives(matched[i])) {
            return this.allCheck(matched, i, arkFile);
        }
        return true;
    }
    private pathAlwaysCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        if (this.pathAlwaysDirectives(matched[i])) {
            return this.allCheck(matched, i, arkFile);
        }
        return true;
    }
    private libNeverCheck(matched: string[], i: number, arkFile: ArkFile): boolean {
        if (this.libNeverDirectives(matched[i])) {
            return this.allCheck(matched, i, arkFile);
        }
        return true;
    }
    private checkSpecial(matched: string[], i: number): boolean {
        if (this.DoubleSlash(matched[i])) {
            return false;
        }
        if (matched[i - 1].includes('/*') && matched[i + 1].includes('*/')) {
            return false;
        }
        return true;
    }
    private checkImportInfo(arkFile: ArkFile, matched: string[], i: number): boolean {
        const importInfos = arkFile.getImportInfos();
        if (importInfos.length > 0 && this.typesNeverDirectives(matched[i])) {
            if (this.DoubleSlash(matched[i])) {
                return false;
            }
            const match = matched[i].match(/types\s*=\s*"([^"]*)"/);
            if (match) {
                this.checkImport(match, importInfos, matched, i, arkFile);
            }
        }
        return true;
    }
    private checkImport(match: RegExpMatchArray, importInfos: ImportInfo[], matched: string[],
        i: number, arkFile: ArkFile): void {
        const name = match[1];
        for (const importInfo of importInfos) {
            const ImportInfo = importInfo as unknown as importInfo;
            const importFrom = ImportInfo.importFrom;
            if (importFrom === name) {
                if (matched[i - 1].includes('/*') && matched[i + 1].includes('*/')) {
                    continue;
                }
                const target = this.extractCode(matched[i]);
                if (target) {
                    this.addIssueReport(arkFile, matched[i], target);
                }
            }
        }
    }
    private extractCode(str: string): string | null {
        const regex = /="([^"]+)"/;
        const match = str.match(regex);
        if (match) {
            return match[1]; // 返回捕获的第一个组，即双引号之间的内容
        } else {
            return null; // 如果没有匹配到，返回 null
        }
    }
    //判断给定的字符串中是否包含三个斜杠注释。
    private tripleSlash(text: string): boolean {
        const regex = /\/\/\//;
        return regex.test(text);
    }
    private DoubleSlash(text: string): boolean {
        const regex = new RegExp('\/\/.*?\/\/\/');
        return regex.test(text);
    }
    private normalDirectives(text: string): boolean {
        return /\s*<reference\s+(lib|path|types)="[^"]*"\s*\/>/g.test(text);
    }
    private libAlwaysDirectives(text: string): boolean {
        return /\s*<reference\s+(path|types)="[^"]*"\s*\/>/g.test(text);
    }
    private typesAlwaysDirectives(text: string): boolean {
        return /\s*<reference\s+(path|lib)="[^"]*"\s*\/>/g.test(text);
    }
    private pathAlwaysDirectives(text: string): boolean {
        return /\s*<reference\s+(lib|types)="[^"]*"\s*\/>/g.test(text);
    }
    private pathNeverDirectives(text: string): boolean {
        return /\s*<reference\s+(path)="[^"]*"\s*\/>/g.test(text);
    }
    private libNeverDirectives(text: string): boolean {
        return /\s*<reference\s+(lib)="[^"]*"\s*\/>/g.test(text);
    }
    private typesNeverDirectives(text: string): boolean {
        return /\s*<reference\s+(types)="[^"]*"\s*\/>/g.test(text);
    }
    private addIssueReport(arkFile: ArkFile, name: string, target?: string): void {
        this.metaData.description = 'Do not use a triple slash reference for ' + target + ', use `import` style instead.';
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(arkFile, name);
        this.metaData.description = this.metaData.description;
        const filePath = arkFile.getFilePath();
        let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description,
            severity, this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
        RuleListUtil.push(defects);
    }
    private getLineAndColumn(arkfile: ArkFile, name: string): { line: number, startCol: number, endCol: number, filePath: string } {
        if (arkfile) {
            const code = arkfile.getCode() ?? '';
            const lines = code.split('\r\n');
            let lineNumber = 1;
            for (const line of lines) {
                const lineIndex = line.indexOf(name);
                if (lineIndex !== -1) {
                    const startCol = lineIndex + 1; // 列号从1开始
                    const endCol = lineIndex + 1;
                    const originPath = arkfile.getFilePath();
                    return { line: lineNumber, startCol, endCol, filePath: originPath };
                }
                lineNumber++;
            }
        } else {
            logger.debug('originStmt or arkFile is null');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}