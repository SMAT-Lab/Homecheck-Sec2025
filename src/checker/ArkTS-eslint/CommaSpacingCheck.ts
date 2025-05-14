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

import { ArkFile } from "arkanalyzer/lib";
import { BaseChecker, BaseMetaData } from "../BaseChecker";
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
import { RuleListUtil } from "../../utils/common/DefectsList";
import { Defects, IssueReport } from "../../model/Defects";
import { Rule } from "../../model/Rule";
import { FileMatcher, MatcherCallback, MatcherTypes } from "../../Index";
import { RuleFix } from "../../model/Fix";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, "CommaSpacingCheck");

const gMetaData: BaseMetaData = {
  severity: 2,
  ruleDocPath: "docs/comma-spacing.md",
  description: "Enforce consistent spacing before and after commas",
};

interface CommaSpacingOption {
  before?: boolean;
  after?: boolean;
}

interface Range {
  start: number;
  end: number;
}

export class CommaSpacingCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private arkFile: ArkFile;

  private options: CommaSpacingOption = {
    before: false,
    after: true,
  };

  private inMultiLineComment: boolean = false;

  public check(target: any): void {
    this.options = this.rule.option[0] ? this.rule.option[0] : this.options;
    if (target instanceof ArkFile) {
      this.arkFile = target;
      const code = target.getCode();
      if (!code) {
        return;
      }

      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        this.checkLine(line, i + 1, target.getFilePath());
      }
    }
  }

  public registerMatchers(): MatcherCallback[] {
    const matcher: FileMatcher = {
      matcherType: MatcherTypes.FILE,
    };

    const matchCallback: MatcherCallback = {
      matcher: matcher,
      callback: this.check.bind(this),
    };

    return [matchCallback];
  }

  private checkLine(line: string, lineNumber: number, filePath: string): void {
    if (this.shouldSkipLine(line)) {
      return;
    }
  
    const { stringRanges, regExpRanges, commentRanges } = this.cacheRanges(line);
    const skipRanges: [number, number][] = commentRanges.map(range => [range.start, range.end]);
  
    this.processCommas(line, lineNumber, filePath, stringRanges, regExpRanges, skipRanges);
  }
  
  private shouldSkipLine(line: string): boolean {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
      if (line.trim().startsWith('/*') && !line.includes('*/')) {
        this.inMultiLineComment = true;
      }
      return true;
    }
  
    if (this.inMultiLineComment) {
      if (line.includes('*/')) {
        this.inMultiLineComment = false;
      }
      return true;
    }
  
    return false;
  }
  
  private processCommas(
    line: string,
    lineNumber: number,
    filePath: string,
    stringRanges: Range[],
    regExpRanges: Range[],
    skipRanges: [number, number][]
  ): void {
    const commaRegex = /,/g;
    let match;
    
    while ((match = commaRegex.exec(line)) !== null) {
      const commaIndex = match.index;
      
      if (this.shouldSkipComma(line, commaIndex, stringRanges, regExpRanges, skipRanges)) {
        continue;
      }
  
      this.checkCommaSpacing(line, lineNumber, filePath, commaIndex, skipRanges);
    }
  }
  
  private shouldSkipComma(
    line: string,
    commaIndex: number,
    stringRanges: Range[],
    regExpRanges: Range[],
    skipRanges: [number, number][]
  ): boolean {
    if (this.isInRanges(commaIndex, stringRanges) || 
        this.isInRanges(commaIndex, regExpRanges) ||
        this.isGenericTrailingComma(line, commaIndex)) {
      return true;
    }
  
    const isInCommentContent = skipRanges.some(
      ([start, end]) => commaIndex > start && commaIndex < end
    );
  
    return isInCommentContent;
  }
  
  private checkCommaSpacing(
    line: string,
    lineNumber: number,
    filePath: string,
    commaIndex: number,
    skipRanges: [number, number][]
  ): void {
    const context = this.getSpacingContext(line, commaIndex, skipRanges);
    
    if (this.shouldSkipSpacingCheck(line, commaIndex)) {
      return;
    }
  
    this.checkBeforeSpacing(context, line, lineNumber, filePath, commaIndex);
    this.checkAfterSpacing(context, line, lineNumber, filePath, commaIndex);
  }
  
  private getSpacingContext(
    line: string,
    commaIndex: number,
    skipRanges: [number, number][]
  ): {
    prevChar: string;
    nextChar: string;
    isBeforeComment: boolean;
    isImmediatelyAfterComment: boolean;
    isCommaBeforeComment: boolean;
    isEndOfLine: boolean;
    isCommaAfterComment: boolean;
  } {
    const prevChar = line[commaIndex - 1];
    let nextChar = line[commaIndex + 1];
  
    const isBeforeComment = skipRanges.some(([start]) => start === commaIndex + 1);
    const isImmediatelyAfterComment = skipRanges.some(([_, end]) => end === commaIndex - 1);
    const isCommaBeforeComment = this.isCommaBeforeComment(line, commaIndex, skipRanges);
    const isEndOfLine = this.isEndOfLine(line, commaIndex);
    const isCommaAfterComment = this.isCommaAfterComment(line, commaIndex);
  
    if (isBeforeComment) {
      nextChar = ' ';
    }
  
    return {
      prevChar,
      nextChar,
      isBeforeComment,
      isImmediatelyAfterComment,
      isCommaBeforeComment,
      isEndOfLine,
      isCommaAfterComment
    };
  }
  
  private shouldSkipSpacingCheck(
    line: string,
    commaIndex: number
  ): boolean {
    const isConsecutiveComma = this.isConsecutiveComma(line, commaIndex);
    const isBracketContext = this.isBracketContext(line, commaIndex);
    const isEmptyArrayElement = this.isEmptyArrayElement(line, commaIndex);
    
    if (!this.options.before && this.options.after) {
      const isFirstCommaWithElement = this.isArrayFirstCommaWithElement(line, commaIndex);
      
      if (isFirstCommaWithElement) {
        return false;
      }
    }
  
    return isConsecutiveComma || isBracketContext || isEmptyArrayElement;
  }
  
  private isArrayFirstCommaWithElement(line: string, commaIndex: number): boolean {
    if (line[commaIndex - 1] !== ' ') {
      return false;
    }
    
    let leftBracketIndex = -1;
    for (let i = commaIndex - 1; i >= 0; i--) {
      if (line[i] === '[') {
        leftBracketIndex = i;
        break;
      }
    }
    
    if (leftBracketIndex === -1) {
      return false;
    }
    
    const contentBetween = line.substring(leftBracketIndex + 1, commaIndex).trim();
    if (contentBetween === '') {
      return false;
    }
    
    const commaSubstring = line.substring(leftBracketIndex + 1, commaIndex);
    const hasPrevComma = commaSubstring.includes(',');
    if (hasPrevComma) {
      return false;
    }
    
    return true;
  }
  
  private checkBeforeSpacing(
    context: ReturnType<typeof this.getSpacingContext>,
    line: string,
    lineNumber: number,
    filePath: string,
    commaIndex: number
  ): void {
    const isLineStart = line.substring(0, commaIndex).trim() === '';
    
    if (!isLineStart && !context.isImmediatelyAfterComment && !context.isCommaAfterComment) {
      if (!this.options.before && context.prevChar === ' ') {
        this.addDefect(
          "There should be no space before ','.",
          lineNumber,
          commaIndex + 1,
          filePath,
          this.calculateAbsolutePosition(lineNumber, commaIndex)
        );
      }
  
      if (this.options.before && context.prevChar !== ' ') {
        this.addDefect(
          "A space is required before ','.",
          lineNumber,
          commaIndex + 1,
          filePath,
          this.calculateAbsolutePosition(lineNumber, commaIndex)
        );
      }
    }
  }
  
  private checkAfterSpacing(
    context: ReturnType<typeof this.getSpacingContext>,
    line: string,
    lineNumber: number,
    filePath: string,
    commaIndex: number
  ): void {
    const skipTrailingCommaAfterCheck = 
      this.options.before === false && 
      this.options.after === true && 
      this.isTrailingComma(line, commaIndex);
  
    const skipAfterSpaceCheck = !this.options.after && context.isCommaBeforeComment;
    const isLineEnd = commaIndex === line.trim().length - 1;
  
    if (!context.isEndOfLine && !skipTrailingCommaAfterCheck && !isLineEnd) {
      if (!this.options.after && context.nextChar === ' ' && !skipAfterSpaceCheck) {
        this.addDefect(
          "There should be no space after ','.",
          lineNumber,
          commaIndex + 1,
          filePath,
          this.calculateAbsolutePosition(lineNumber, commaIndex)
        );
      }
  
      if (this.options.after && context.nextChar !== ' ') {
        this.addDefect(
          "A space is required after ','.",
          lineNumber,
          commaIndex + 1,
          filePath,
          this.calculateAbsolutePosition(lineNumber, commaIndex)
        );
      }
    }
  }
  
  private isConsecutiveComma(line: string, commaIndex: number): boolean {
    const nextCommaIndex = line.indexOf(',', commaIndex + 1);
    const prevCommaIndex = line.lastIndexOf(',', commaIndex - 1);
  
    const hasNextConsecutiveComma = nextCommaIndex !== -1 &&
      line.substring(commaIndex + 1, nextCommaIndex).trim() === '';
      
    const hasPrevConsecutiveComma = prevCommaIndex !== -1 &&
      line.substring(prevCommaIndex + 1, commaIndex).trim() === '';
    
    if (!this.options.before && this.options.after && hasNextConsecutiveComma) {
      const hasRealElementBeforeComma = this.hasRealElementBeforeComma(line, commaIndex);
      if (hasRealElementBeforeComma) {
        return false;
      }
    }
    
    return hasNextConsecutiveComma || hasPrevConsecutiveComma;
  }
  
  private hasRealElementBeforeComma(line: string, commaIndex: number): boolean {
    if (line[commaIndex - 1] !== ' ') {
      return false;
    }
    let leftBracketIndex = -1;
    for (let i = commaIndex - 1; i >= 0; i--) {
      if (line[i] === '[') {
        leftBracketIndex = i;
        break;
      }
    }
    if (leftBracketIndex === -1) {
      return false;
    }
    const contentBetween = line.substring(leftBracketIndex + 1, commaIndex).trim();
    if (contentBetween !== '' && !/^,+$/.test(contentBetween)) {
      return true;
    }
    
    return false;
  }
  
  private isBracketContext(line: string, commaIndex: number): boolean {
    const prevChar = line[commaIndex - 1];
    const nextChar = line[commaIndex + 1];
  
    const isAfterLeftBracket = prevChar === '[' ||
      (prevChar === ' ' && line.slice(0, commaIndex).trim().endsWith('[') && 
       !this.hasContentBetweenBracketAndComma(line, commaIndex));
    
    const isBeforeRightBracket = (nextChar === ']' ||
      (nextChar === ' ' && line.slice(commaIndex + 1).trim().startsWith(']'))) &&
      !this.isTrailingComma(line, commaIndex);
    
    const isBeforeRightBrace = nextChar === '}' ||
      (nextChar === ' ' && line.slice(commaIndex + 1).trim().startsWith('}'));
    
    const isBeforeRightParen = nextChar === ')' ||
      (nextChar === ' ' && line.slice(commaIndex + 1).trim().startsWith(')'));
  
    return isAfterLeftBracket || isBeforeRightBracket || isBeforeRightBrace || isBeforeRightParen;
  }
  
  private hasContentBetweenBracketAndComma(line: string, commaIndex: number): boolean {
    if (line[commaIndex - 1] !== ' ') {
      return false;
    }
    
    let leftBracketIndex = -1;
    for (let i = commaIndex - 1; i >= 0; i--) {
      if (line[i] === '[') {
        leftBracketIndex = i;
        break;
      }
    }
    
    if (leftBracketIndex === -1) {
      return false;
    }
    
    const contentBetween = line.substring(leftBracketIndex + 1, commaIndex).trim();
    return contentBetween !== '';
  }
  
  private isEmptyArrayElement(line: string, commaIndex: number): boolean {
    const isInArray = line.includes('[') && line.includes(']');
    
    const isEmptyElement = isInArray && (
      (line.slice(0, commaIndex).trim().endsWith('[') &&
      !line.slice(commaIndex + 1).trim().startsWith(']'))
    );
    
    if (!isEmptyElement && !this.options.before && this.options.after) {
      let leftBracketIndex = -1;
      for (let i = commaIndex - 1; i >= 0; i--) {
        if (line[i] === '[') {
          leftBracketIndex = i;
          break;
        } else if (line[i] === ']' || line[i] === '{' || line[i] === '}') {
          return isEmptyElement;
        }
      }
      
      if (leftBracketIndex !== -1) {
        const contentBetween = line.substring(leftBracketIndex + 1, commaIndex).trim();
        if (contentBetween === '') {
          return true;
        }
      }
    }
    
    return isEmptyElement;
  }
  
  private isTrailingComma(line: string, commaIndex: number): boolean {
    const isInArray = line.includes('[') && line.includes(']');
    
    return isInArray &&
      line.slice(commaIndex + 1)
        .trim()
        .replace(/\s*\/\*[\s\S]*?\*\/\s*/g, '')
        .replace(/\s*\/\/.*/g, '')
        .startsWith(']');
  }

  private calculateAbsolutePosition(
    lineNumber: number,
    columnIndex: number
  ): number {
    if (!this.arkFile) {
      return columnIndex;
    }

    const fileContent = this.arkFile.getCode();
    if (!fileContent) {
      return columnIndex;
    }

    const lines = fileContent.split('\n');
    let position = 0;

    for (let i = 0; i < lineNumber - 1; i++) {
      position += lines[i].length + 1;
    }

    position += columnIndex;
    return position;
  }

  private addDefect(message: string, line: number, column: number, filePath: string, startPos: number): Defects {
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(line, column, column + 1, message, severity, this.rule.ruleId, filePath, this.metaData.ruleDocPath, true, false, true);
    let fix: RuleFix = this.getFix(message, startPos, line, column);
    const issue = new IssueReport(defect, fix);
    this.issues.push(issue);
    RuleListUtil.push(defect);
    return defect;
  }

  private getFix(message: string, startPos: number, line: number, column: number): RuleFix {
    if (message.includes('required after')) {
      const currentLine = this.arkFile.getCode().split('\n')[line - 1];
      const commaPos = column - 1;
      if (commaPos + 1 < currentLine.length && currentLine[commaPos + 1] === ',') {
        return { range: [startPos + 1, startPos + 1], text: '' };
      }
      return { range: [startPos + 1, startPos + 1], text: ' ' };
    } else if (message.includes('required before')) {
      return { range: [startPos, startPos], text: ' ' };
    } else if (message.includes('no space after')) {
      const currentLine = this.arkFile.getCode().split('\n')[line - 1];
      const commaPos = column - 1;
      if (commaPos >= 0 && commaPos < currentLine.length && currentLine[commaPos] === ',' && 
          commaPos + 1 < currentLine.length && currentLine[commaPos + 1] === ' ') {
        return { range: [startPos + 1, startPos + 2], text: '' };
      } else {
        return { range: [startPos + 1, startPos + 1], text: '' };
      }
    } else if (message.includes('no space before')) {
      const currentLine = this.arkFile.getCode().split('\n')[line - 1];
      const commaPos = column - 1;
      if (commaPos > 0 && commaPos < currentLine.length && currentLine[commaPos] === ',' && 
          commaPos - 1 >= 0 && currentLine[commaPos - 1] === ' ') {
        return { range: [startPos - 1, startPos], text: '' };
      } else {
        return { range: [startPos - 1, startPos], text: '' };
      }
    } else {
      return { range: [startPos - 1, startPos], text: '' };
    }
  }

  private cacheRanges(line: string): { 
    stringRanges: Range[]; 
    regExpRanges: Range[]; 
    commentRanges: Range[] 
  } {
    const stringRanges = this.findStringRanges(line);
    const commentRanges = this.findCommentRanges(line);
    const regExpRanges = this.findRegExpRanges(line, stringRanges);
    
    return { stringRanges, regExpRanges, commentRanges };
  }
  
  private findCommentRanges(line: string): Range[] {
    const commentRanges: Range[] = [];
    
    const blockCommentRegex = /\/\*[\s\S]*?\*\//g;
    let blockMatch;
    while ((blockMatch = blockCommentRegex.exec(line)) !== null) {
      commentRanges.push({
        start: blockMatch.index + 2,
        end: blockMatch.index + blockMatch[0].length - 2
      });
    }
    
    const lineCommentRegex = /\/\/.*/g;
    let lineMatch;
    while ((lineMatch = lineCommentRegex.exec(line)) !== null) {
      commentRanges.push({
        start: lineMatch.index + 2,
        end: lineMatch.index + lineMatch[0].length
      });
    }
    
    return commentRanges;
  }
  
  private findStringRanges(line: string): Range[] {
    const stringRanges: Range[] = [];
    const state = {
      inSingleQuote: false,
      inDoubleQuote: false,
      inBacktick: false,
      escaping: false,
      stringStart: -1
    };
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (this.handleEscapeCharInString(char, state)) {
        continue;
      }
      
      if (!state.inSingleQuote && !state.inDoubleQuote && !state.inBacktick) {
        this.handleStringStart(char, i, state);
      } else {
        this.handleStringEnd(char, i, state, stringRanges);
      }
    }
    
    return stringRanges;
  }
  
  private handleEscapeCharInString(char: string, state: any): boolean {
    if (state.escaping) {
      state.escaping = false;
      return true;
    }
    
    if (char === '\\') {
      state.escaping = true;
      return true;
    }
    
    return false;
  }
  
  private handleStringStart(char: string, index: number, state: any): void {
    if (char === "'") {
      state.inSingleQuote = true;
      state.stringStart = index;
    } else if (char === '"') {
      state.inDoubleQuote = true;
      state.stringStart = index;
    } else if (char === '`') {
      state.inBacktick = true;
      state.stringStart = index;
    }
  }
  
  private handleStringEnd(char: string, index: number, state: any, stringRanges: Range[]): void {
    if (char === "'" && state.inSingleQuote) {
      state.inSingleQuote = false;
      stringRanges.push({ start: state.stringStart, end: index });
    } else if (char === '"' && state.inDoubleQuote) {
      state.inDoubleQuote = false;
      stringRanges.push({ start: state.stringStart, end: index });
    } else if (char === '`' && state.inBacktick) {
      state.inBacktick = false;
      stringRanges.push({ start: state.stringStart, end: index });
    }
  }
  
  private findRegExpRanges(line: string, stringRanges: Range[]): Range[] {
    const regExpRanges: Range[] = [];
    const potentialRegExp = /\/(?![\/\*])(?:[^\/\\\n]|\\.)*\//g;
    
    let regMatch;
    while ((regMatch = potentialRegExp.exec(line)) !== null) {
      const range = this.validateRegExpRange(regMatch, stringRanges);
      if (range) {
        regExpRanges.push(range);
      }
    }
    
    return regExpRanges;
  }
  
  private validateRegExpRange(
    regMatch: RegExpExecArray, 
    stringRanges: Range[]
  ): Range | null {
    const start = regMatch.index;
    const end = start + regMatch[0].length - 1;
    
    const isInString = stringRanges.some(range => 
      (start >= range.start && start <= range.end) || 
      (end >= range.start && end <= range.end)
    );
    
    if (!isInString) {
      return { start, end };
    }
    
    return null;
  }
  
  private isInRanges(position: number, ranges: Range[]): boolean {
    if (ranges.length === 0) {
      return false;
    }
    
    let left = 0;
    let right = ranges.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const range = ranges[mid];
      
      if (position >= range.start && position <= range.end) {
        return true;
      }
      
      if (position < range.start) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    return false;
  }

  private isInString(line: string, position: number): boolean {
    const state = {
      inSingleQuote: false,
      inDoubleQuote: false,
      inBacktick: false,
      inTemplateExpr: false,
      escaping: false,
      braceCount: 0
    };
  
    for (let i = 0; i < position; i++) {
      this.updateStringState(line, i, state);
    }
  
    return state.inSingleQuote || state.inDoubleQuote || (state.inBacktick && !state.inTemplateExpr);
  }
  
  private updateStringState(line: string, index: number, state: any): void {
    const char = line[index];
  
    if (this.handleEscapeChar(char, state)) {
      return;
    }
  
    if (this.handleTemplateExpression(line, index, char, state)) {
      return;
    }
  
    if (state.inTemplateExpr) {
      this.updateBraceCount(char, state);
      return;
    }
  
    this.updateQuoteState(char, state);
  }
  
  private handleEscapeChar(char: string, state: any): boolean {
    if (state.escaping) {
      state.escaping = false;
      return true;
    }
  
    if (char === '\\') {
      state.escaping = true;
      return true;
    }
  
    return false;
  }
  
  private handleTemplateExpression(line: string, index: number, char: string, state: any): boolean {
    if (state.inBacktick && !state.inTemplateExpr && char === '$' && 
        index + 1 < line.length && line[index + 1] === '{') {
      state.inTemplateExpr = true;
      state.braceCount = 1;
      return true;
    }
    return false;
  }
  
  private updateBraceCount(char: string, state: any): void {
    if (char === '{') {
      state.braceCount++;
    } else if (char === '}') {
      state.braceCount--;
      if (state.braceCount === 0) {
        state.inTemplateExpr = false;
      }
    }
  }
  
  private updateQuoteState(char: string, state: any): void {
    if (char === "'" && !state.inDoubleQuote && !state.inBacktick) {
      state.inSingleQuote = !state.inSingleQuote;
    } else if (char === '"' && !state.inSingleQuote && !state.inBacktick) {
      state.inDoubleQuote = !state.inDoubleQuote;
    } else if (char === '`' && !state.inSingleQuote && !state.inDoubleQuote) {
      state.inBacktick = !state.inBacktick;
    }
  }

  private isInRegExp(line: string, position: number): boolean {
    let lastSlashPos = -1;
    let inRegExp = false;
    let escaping = false;

    for (let i = 0; i < position; i++) {
      const char = line[i];

      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === '\\') {
        escaping = true;
        continue;
      }

      if (char === '/' && !this.isInString(line, i)) {
        if (!inRegExp) {
          inRegExp = true;
          lastSlashPos = i;
        } else {
          inRegExp = false;
        }
      }
    }

    if (inRegExp && lastSlashPos !== -1) {
      for (let i = position + 1; i < line.length; i++) {
        const char = line[i];

        if (escaping) {
          escaping = false;
          continue;
        }

        if (char === '\\') {
          escaping = true;
          continue;
        }

        if (char === '/' && !this.isInString(line, i)) {
          return true;
        }
      }
    }

    return false;
  }

  private isGenericTrailingComma(line: string, position: number): boolean {
    let closingAngleFound = false;
    let i = position + 1;

    while (i < line.length && line[i] === ' ') {
      i++;
    }

    if (i < line.length && line[i] === '>') {
      closingAngleFound = true;
    }

    if (!closingAngleFound) {
      return false;
    }

    let openAnglePos = -1;
    for (let j = position - 1; j >= 0; j--) {
      if (
        line[j] === '<' &&
        !this.isInString(line, j) &&
        !this.isInRegExp(line, j)
      ) {
        openAnglePos = j;
        break;
      }
    }

    if (openAnglePos === -1) {
      return false;
    }

    const beforeOpenAngle = line.substring(0, openAnglePos).trim();
    const isGenericContext =
      /\b(class|interface|type|function|const|let|var)\b/.test(
        beforeOpenAngle
      ) ||
      beforeOpenAngle.endsWith('=') ||
      /[a-zA-Z0-9_$]\s*$/.test(beforeOpenAngle);

    return isGenericContext;
  }

  private isCommaAfterComment(line: string, commaIndex: number): boolean {
    const beforeComma = line.substring(0, commaIndex).trim();
  
    if (!beforeComma.endsWith('*/')) {
      return false;
    }
  
    const commentStartIndex = beforeComma.lastIndexOf('/*');
    if (commentStartIndex === -1) {
      return false;
    }
  
    const beforeComment = beforeComma.substring(0, commentStartIndex).trim();
    if (!this.hasArrayOrObjectLiteral(beforeComment)) {
      return false;
    }
  
    return this.isValidLastCharBeforeComment(line, commentStartIndex);
  }
  
  private hasArrayOrObjectLiteral(text: string): boolean {
    return text.includes('[') || text.includes('{');
  }
  
  private isValidLastCharBeforeComment(line: string, commentStartIndex: number): boolean {
    const validChars = new Set([',', '[', '{']);
    const lastNonWhitespaceChar = this.findLastNonWhitespaceChar(line, commentStartIndex);
    return validChars.has(lastNonWhitespaceChar);
  }
  
  private findLastNonWhitespaceChar(line: string, startIndex: number): string {
    for (let i = startIndex - 1; i >= 0; i--) {
      if (line[i] !== ' ' && line[i] !== '\t') {
        return line[i];
      }
    }
    return '';
  }

  private isCommaBeforeComment(
    line: string,
    commaIndex: number,
    skipRanges: [number, number][]
  ): boolean {
    let i = commaIndex + 1;
    while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
      i++;
    }

    if (i < line.length) {
      if (
        line[i] === '/' &&
        i + 1 < line.length &&
        (line[i + 1] === '/' || line[i + 1] === '*')
      ) {
        return true;
      }
      return skipRanges.some(([start, _]) => start === i);
    }

    return false;
  }

  private isEndOfLine(line: string, commaIndex: number): boolean {
    const restOfLine = line.slice(commaIndex + 1).trim();
    
    if (restOfLine === '') {
      return true;
    }

    if (restOfLine.startsWith('//') || restOfLine.startsWith('/*')) {
      const lineContent = line.slice(commaIndex + 1);
      const commentStart = lineContent.indexOf('//') !== -1 
        ? lineContent.indexOf('//')
        : lineContent.indexOf('/*');
      
      const beforeComment = lineContent.substring(0, commentStart).trim();
      if (beforeComment !== '') {
        return false;
      }

      const afterCommentContent = lineContent.substring(commentStart);
      if (afterCommentContent.includes('\n') || 
          (afterCommentContent.startsWith('//') && line.trim() !== line.trimEnd())) {
        return false;
      }
    }

    const afterComma = line.slice(commaIndex + 1);
    const nextNonSpaceChar = afterComma.match(/\S/);
    
    if (nextNonSpaceChar) {
      const nextChar = nextNonSpaceChar[0];
      const nextCharIndex = afterComma.indexOf(nextChar);
      
      if (nextChar === '/' && afterComma[nextCharIndex + 1] === '/') {
        return false;
      }
      
      return (nextChar === ']' || nextChar === '}' || nextChar === ')') && nextCharIndex === 0;
    }

    return false;
  }
}