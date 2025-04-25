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

  import { ArkMethod, Stmt, ArkClass, ArkNamespace, ImportInfo, ArkFile } from 'arkanalyzer/lib';
  type astType = { name: string; kind: string; line: number; character: number };
  enum VarType { Var = 'var', Class = 'class', Import = 'import', Method = 'method', Type = 'type',
    Args = 'args', ArgsP = 'ArrayBindingPattern', Catch = 'catch', Static = 'static',
    UsedIgnorePattern = 'UsedIgnorePattern',
   }
  type noUseVars = {
    varType: VarType; //方法名称
    stmt?: Stmt;
    arkClass?: ArkClass; //获取类信息
    arkNamespace?: ArkNamespace; //命名空间信息
    declareStmt?: Stmt; //有方法或者类不能固定
    name: string | string[]; //解构-特殊情况
    local?: 'local' | 'all' ; //本地或者全局
    isMethodParam?: boolean; //是否是方法参数
    arkMethod?: ArkMethod; //方便获取方法的位置信息20250207
    isRestSiblings?: boolean; //是否与解构同级
    methodName?: string; //方法名称
    parammaxUsedIndex?: number; //被使用最大参数下标
    paramIndex?: number; //用于方法参数的判定
    static?: boolean; //是否是静态
    varInit?: boolean; //2025-02-07 优化方案
    ArrayBindingPattern?: boolean;
    argPosion?: [lineNo: number, strClo: number, endClo: number]; //记录缺失的位置信息
    filePath?: string; //参数stmt不包含
    isAll?: boolean; //注释标明global
  };
  const accuratePositionReg = /[.*+?^=!:${}()|\[\]\/\\]/g;
  const replaceStringReg = /[.*+?^=!:${}()|\[\]\/\\]/g;
  export class NoUnusedVarsCheckUtils {
    public static collecUnusedImports(importInfos: ImportInfo[], targetFilePath: string, importNoused: string[]): noUseVars[] {
        let nousedSet: noUseVars[] = [];
        for (const info of importInfos) {
          const lineNo = info.getOriginTsPosition().getLineNo();
          const codeImport = info.getTsSourceCode();
          const nameAs = info.getImportClauseName();
          const posion = this.getAccuratePosition(codeImport, nameAs);
          if (importNoused.includes(nameAs)) {
            //处理未使用的import
            nousedSet.push({varType: VarType.Import,
              argPosion: [posion.line + lineNo - 1, posion.col, posion.col + nameAs.length], // Assign a default value or the appropriate value
              name: nameAs, filePath: targetFilePath
            });
          }
        }
        return nousedSet;
      }
      public static collecUnusedTypes(noUsedtype: astType[], targetFilePath: string): noUseVars[] {
        let nousedSet: noUseVars[] = [];
        for (const type of noUsedtype) {
          nousedSet.push({varType: VarType.Type,
            argPosion: [type.line, type.character, type.character], // Assign a default value or the appropriate value
            name: type.name, filePath: targetFilePath,
          });
        }
        return nousedSet;
      }
      public static collecUnusedGenerics(generics: astType[], targetFilePath: string): noUseVars[] {
        let nousedSet: noUseVars[] = [];
        for (const generic of generics) {
          nousedSet.push({varType: VarType.Type,
            argPosion: [generic.line, generic.character, generic.character + generic.name.length], // Assign a default value or the appropriate value
            name: generic.name, filePath: targetFilePath,
          });
        }
        return nousedSet;
      }
     //抽取函数参数语句
     public static extractParameters(methodCode: string): string[] {
      const start = methodCode.indexOf('(');
      if (start === -1) {
        return [];
      }
    
      let depth = 0;
      let end = -1;
    
      // 找到配对的第一个括号
      for (let i = start; i < methodCode.length; i++) {
        const char = methodCode[i];
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
    
      if (end === -1) {
        return [];
      }
    
      const paramStr = methodCode.slice(start + 1, end);
      let paramList: string[] = [];
    
      let current = '';
      let nested = 0;
      let inString: string | null = null;
      let inArrowFn = false;
    
      const exceresult = this.excetParamsBody(paramStr, inString, current, inArrowFn, nested, paramList);
      current = exceresult.current;
      paramList = exceresult.paramList;
      if (current.trim()) {
        paramList.push(current.trim());
      }
    
      return paramList;
    }
    
    
    public static extractParameters_nested(char: string, nested: number): number {
      if (['{', '[', '(', '<'].includes(char)) {
        nested++;
      }
      else if (['}', ']', ')', '>'].includes(char)) {
        nested--;
      }
      return nested;
    }
    
    public static excetParamsBody(paramStr: string, inString: string | null, current: string, inArrowFn: boolean, nested: number,
      paramList: string[]
    ): {inString: string | null, current: string, inArrowFn: boolean, nested: number, paramList: string[]} {
      for (let i = 0; i < paramStr.length; i++) {
        const char = paramStr[i];
        const prev = paramStr[i - 1];
        const next = paramStr[i + 1];
        // 字符串处理：支持 '', "", ``
        if (!inString && (char === '\'' || char === '"' || char === '`')) {
          inString = char;
        } else if (inString && char === inString && prev !== '\\') {
          inString = null;
        }
        if (inString) {
          current += char;
          continue;
        }
        // 判断箭头函数 =>
        if (char === '=' && next === '>') {
          inArrowFn = true;
          current += '=>';
          i++; // 跳过 >
          continue;
        }
        // 处理嵌套结构
        nested = this.extractParameters_nested(char, nested);
        // 只有在顶层并且不在箭头函数中才处理逗号分割
        if (char === ',' && nested === 0 && !inArrowFn) {
          paramList.push(current.trim());
          current = '';
        } else {
          current += char;
        }
        // 重置箭头函数标识
        if (inArrowFn && (char === '}' || char === ')')) {
          inArrowFn = false;
        }
      }
      return {inString: inString, current: current, inArrowFn: inArrowFn, nested: nested, paramList: paramList};
    }

    public static getAccuratePosition(codeImport: string, name: string): { line: number; col: number } {
        const lines = codeImport.split('\n');
        // 转义 name 中的正则特殊字符
        const escapedName = name.replace(accuratePositionReg, '\\$&');
        // 使用正则，确保匹配完整的标识符（前后是非字母数字或下划线）
        const regex = new RegExp(`\\b${escapedName}\\b`, 'g');
        for (let i = 0; i < lines.length; i++) {
          let match;
          while ((match = regex.exec(lines[i])) !== null) {
            return { line: i + 1, col: match.index + 1 }; // 返回行号和列号
          }
        }
        return { line: -1, col: -1 }; // 未找到
      }
 
  public static setWarnInfoForArgType(noUseVar: noUseVars, warnInfo: any): void {
    if (noUseVar.argPosion) {
      warnInfo.line = noUseVar.argPosion[0];
      warnInfo.startCol = noUseVar.argPosion[1];
      warnInfo.endCol = noUseVar.argPosion[2];
      warnInfo.filePath = noUseVar.filePath ?? '';
    }
  }

  public static setWarnInfoForMethodNobody(noUseVar: noUseVars, warnInfo: any): void {
    if (noUseVar.argPosion && warnInfo.line === -1) {
      warnInfo.line = noUseVar.argPosion[0];
      warnInfo.startCol = noUseVar.argPosion[1];
      warnInfo.endCol = noUseVar.argPosion[2];
      warnInfo.filePath = noUseVar.arkMethod?.getDeclaringArkFile().getFilePath() ?? '';
    }
  }

  public static setWarnInfoForClass(noUseVar: noUseVars, warnInfo: any): void {
    const strNum = noUseVar.arkClass?.getColumn() ?? -1;
    const posion = this.getTextPosition(noUseVar.arkClass?.getCode() ?? '', noUseVar.name.toString());
    let startCol = strNum + posion.column - 1;
    if (posion.line > 0) {
      startCol = posion.column;
    }
   
   
    warnInfo.line = (noUseVar.arkClass?.getLine() ?? -1 ) + posion.line;
    warnInfo.startCol = startCol;
    warnInfo.endCol = startCol + noUseVar.name.length;
    warnInfo.filePath =
      noUseVar.arkClass?.getDeclaringArkFile()?.getFilePath() ?? '';
  }

  public static setWarnInfoForType(noUseVar: noUseVars, warnInfo: any): void {
    warnInfo.line = noUseVar.argPosion?.[0] ?? -1;
    warnInfo.startCol = noUseVar.argPosion?.[1] ?? -1;
    warnInfo.endCol = warnInfo.startCol + noUseVar.name.length;
    warnInfo.filePath =
      noUseVar.arkClass?.getDeclaringArkFile()?.getFilePath() ?? '';
  }
  
  public static setWarnInfoForArgs(noUseVar: noUseVars, warnInfo: any): void {
    warnInfo.line = noUseVar.argPosion?.[0] ?? -1;
    warnInfo.startCol = (noUseVar.argPosion?.[1] ?? -1) + 1;
    warnInfo.endCol = warnInfo.startCol + noUseVar.name.length;
    warnInfo.filePath =
      noUseVar.arkClass?.getDeclaringArkFile()?.getFilePath() ?? '';
  }
  public static setWarnInfoForVar(noUseVar: noUseVars, warnInfo: any): void {
    if (noUseVar.isAll) {
      warnInfo.line = noUseVar.argPosion?.[0] ?? -1;
      warnInfo.startCol = (noUseVar.argPosion?.[1] ?? -1);
      warnInfo.endCol = warnInfo.startCol + noUseVar.name.length;
      warnInfo.filePath = noUseVar.filePath;
    }
   
  }

  public static setWarnInfoForNamespace(noUseVar: noUseVars, warnInfo: any): void {
    const indexNum =
      noUseVar.arkNamespace?.getCode()?.indexOf(noUseVar.name.toString()) ?? -1;
    const strNum = noUseVar.arkNamespace?.getColumn() ?? -1;
    const startCol = indexNum + strNum;
    warnInfo.line = noUseVar.arkNamespace?.getLine() ?? -1;
    warnInfo.startCol = startCol;
    warnInfo.endCol = startCol + noUseVar.name.length;
    warnInfo.filePath =
      noUseVar.arkNamespace?.getDeclaringArkFile()?.getFilePath() ?? '';
  }
      public static getTextPosition(text: string, target: string): { line: number, column: number } {
         const escapedTarget = this.escapeRegExp(target);
         const strictWordRegex = new RegExp(`(?<![a-zA-Z0-9])${escapedTarget}(?![a-zA-Z0-9])`, 's'); // 's' 模式支持跨行
       
         const match = strictWordRegex.exec(text);
         if (!match) {
           return { line: -1, column: -1 };
         }
       
         const index = match.index;
       
         const linesUpToMatch = text.slice(0, index).split('\n');
         const line = linesUpToMatch.length - 1;
         const column = linesUpToMatch[linesUpToMatch.length - 1].length + 1;
       
         return { line, column };
       }
       public static escapeRegExp(str: string): string {
        return str.replace(replaceStringReg, '\\$&'); // 转义所有正则特殊字符
      }
     
      public static getArkFileAllClasss(targetFile: ArkFile): ArkClass[] {
        let allClass: ArkClass[] = [];  
        const namespaces = this.getAllNamespaces(targetFile);
        for (const namespace of namespaces) {
          const classes = !namespace.isDeclare() ? (namespace.getClasses() ?? []).filter(cls => cls.getName() !== '%dflt') : [];
          allClass = allClass.concat(classes);  
        }
        const classes = targetFile.getClasses() ?? [];
        allClass = allClass.concat(classes);
        return allClass;
       
        } 
      
        public static getAllNamespaces(targetFile: ArkFile): ArkNamespace[] {
            const result: ArkNamespace[] = [];
            const namespaces = targetFile.getNamespaces?.(); // 确保 getNamespaces() 存在
            if (Array.isArray(namespaces)) {
              this.recursiveSearch(namespaces, result);
            }
            return result;
          }
          public static recursiveSearch(namespaces: ArkNamespace[], result: ArkNamespace[]): void {
          for (const ns of namespaces) {
            result.push(ns); // 记录当前命名空间
      
            // 确保 getNamespaces() 存在且返回的是数组
            const subNamespaces = ns.getNamespaces?.();
            if (Array.isArray(subNamespaces)) {
              this.recursiveSearch(subNamespaces, result); // 递归调用子命名空间
            }
          }
        }

        //获取方法体code
          public static extractMethodBody(methodCode: string): string {
            let braceCount = 0;
            let startIndex = -1;
            // 遍历代码，找到方法体的起始 `{`
            for (let i = 0; i < methodCode.length; i++) {
              if (methodCode[i] === '{') {
                if (startIndex === -1) {
                  startIndex = i; // 记录第一个 `{`
                }
                braceCount++;
              } else if (methodCode[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  // 找到匹配的 `}`
                  return methodCode.substring(startIndex + 1, i).trim();
                }
              }
            }
            // 如果没有找到完整的方法体，返回空字符串
            return '';
            ``;
          }
  }
 