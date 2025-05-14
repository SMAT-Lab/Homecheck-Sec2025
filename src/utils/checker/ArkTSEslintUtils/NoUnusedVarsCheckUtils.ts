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

  import { ArkMethod, Stmt, ArkClass, ArkNamespace, ImportInfo, ArkFile, ClassType, ClassSignature, ts, 
    NamespaceSignature, ArkInvokeStmt, ArkAssignStmt } from 'arkanalyzer/lib';
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
  type Var_base = {
    name?: string;
    type?: { name?: string };
    usedStmts?: Stmt[];
    declaringStmt?: Stmt;
  };
  const accuratePositionReg = /[.*+?^=!:${}()|\[\]\/\\]/g;
  const replaceStringReg = /[.*+?^=!:${}()|\[\]\/\\]/g;
  const textUsedReg = /[.*+?^${}()|[\]\\]/g;
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
   // 主函数，返回未使用类型的数组，并附带行列号信息
  public static noUsedType(astRoot: ts.SourceFile): astType[] {
    const typeMap = new Map<
      string,
      { used: boolean; kind: string; pos: number }
    >();
    const noUsedTypes: {
      name: string;
      kind: string;
      line: number;
      character: number;
    }[] = [];
    this.collectTypes(astRoot, astRoot, typeMap);
    this.checkTypeUsage(astRoot, astRoot, typeMap);
    for (const [name, info] of typeMap.entries()) {
      if (!info.used) {
        const { line, character } = astRoot.getLineAndCharacterOfPosition(
          info.pos
        );
        // 注意：行列号从 0 开始，所以返回时加 1
        noUsedTypes.push({
          name,
          kind: info.kind,
          line: line + 1,
          character: character + 1,
        });
      }
    }
    return noUsedTypes;
  }

public static collectTypes(
    node: ts.Node,
    astRoot: ts.SourceFile,
    typeMap: Map<string, { used: boolean; kind: string; pos: number }>
  ): void {
    if (ts.isTypeAliasDeclaration(node)) {
      const isExported =
        node.modifiers &&
        node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
      typeMap.set(node.name.text, {
        used: isExported ? true : false,
        kind: 'type别名',
        pos: node.name.getStart(astRoot),
      });
    } else if (ts.isInterfaceDeclaration(node)) {
      const isExported =
        node.modifiers &&
        node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
      typeMap.set(node.name.text, {
        used: isExported ? true : false,
        kind: '接口',
        pos: node.name.getStart(astRoot),
      });
    }
    ts.forEachChild(node, (child) =>
      this.collectTypes(child, astRoot, typeMap)
    );
  }

  public static checkTypeUsage(
    node: ts.Node,
    astRoot: ts.SourceFile,
    typeMap: Map<string, { used: boolean; kind: string; pos: number }>
  ): void {
    if (ts.isIdentifier(node) && node.parent) {
      if (!this.isTypeDeclaration(node) && !this.isDefaultExport(node)) {
        this.markTypeAsUsed(node, typeMap);
      }
    }

    ts.forEachChild(node, (child) =>
      this.checkTypeUsage(child, astRoot, typeMap)
    );
  }

  
  public static isTypeDeclaration(node: ts.Identifier): boolean {
      return ts.isTypeAliasDeclaration(node.parent) && node.parent.name === node;
    }
  
    public static isDefaultExport(node: ts.Identifier): boolean {
      return (
        ts.isExportAssignment(node.parent) && node.parent.isExportEquals === false
      );
    }
  
    public static markTypeAsUsed(
      node: ts.Identifier,
      typeMap: Map<string, { used: boolean; kind: string; pos: number }>
    ): void {
      if (typeMap.has(node.text)) {
        const info = typeMap.get(node.text)!;
        info.used = true;
        typeMap.set(node.text, info);
      }
    }

  public static isTextUsed(code: string, name: string): boolean {
    // 转义正则特殊字符
    const escapedName = name.replace(textUsedReg, '\\$&');
    // 正则匹配完整的标识符，并确保不在引号内
    const regex = new RegExp(`\\b${escapedName}\\b(?![^"']*["'])`, 'g');
    return regex.test(code);
  }

  public static collectGenerics(
    node: ts.Node,
    typeMap: Map<
      string,
      { used: boolean; kind: string; pos: number; node: ts.Node }
    >
  ): void {
    // Handle the specific cases where generics are present
    this.handleGenerics(node, typeMap);
    // Recursively traverse child nodes
    ts.forEachChild(node, (child) => this.collectGenerics(child, typeMap));
  }

  // Handle the specific cases for type aliases, function declarations, and constructor type nodes
  public static handleGenerics(
    node: ts.Node,
    typeMap: Map<
      string,
      { used: boolean; kind: string; pos: number; node: ts.Node }
    >
  ): void {
    if (
      ts.isTypeAliasDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isFunctionTypeNode(node)
    ) {
      this.collectTypeAliasGenerics(node, typeMap);
    }

    if (
      (ts.isTypeAliasDeclaration(node) &&
        ts.isConstructorTypeNode(node.type)) ||
      ts.isConstructSignatureDeclaration(node)
    ) {
      this.collectConstructorTypeGenerics(node, typeMap);
    }
  }

  // Collect generics for type aliases and function declarations
  public static collectTypeAliasGenerics(
    node:
      | ts.TypeAliasDeclaration
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.InterfaceDeclaration
      | ts.ClassDeclaration
      | ts.ArrowFunction
      | ts.MethodDeclaration
      | ts.FunctionTypeNode
      | ts.ClassExpression,
    typeMap: Map<
      string,
      { used: boolean; kind: string; pos: number; node: ts.Node }
    >
  ): void {
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
    if (node.typeParameters && decorators === undefined) {
      node.typeParameters.forEach((typeParam) => {
        const genericKey = `${node.getText()}--->${typeParam.name.text}`;
        if (!typeMap.has(genericKey)) {
          typeMap.set(genericKey, {
            used: false,
            kind: typeParam.name.text,
            pos: typeParam.getStart(),
            node: node,
          });
        }
      });
    }
  }

  // Collect generics for constructor type aliases
  public static collectConstructorTypeGenerics(
    node: ts.TypeAliasDeclaration | ts.ConstructSignatureDeclaration,
    typeMap: Map<
      string,
      { used: boolean; kind: string; pos: number; node: ts.Node }
    >
  ): void {
    if (node.typeParameters) {
      node.typeParameters.forEach((typeParam) => {
        const genericKey = `${node.getText()}-${typeParam.name.text}`;
        if (!typeMap.has(genericKey)) {
          typeMap.set(genericKey, {
            used: false,
            kind: typeParam.name.text,
            pos: typeParam.getStart(),
            node: node,
          });
        }
      });
    }
  }
  public static checkGenericUsages(
    typeMap: Map<
      string,
      { used: boolean; kind: string; pos: number; node: ts.Node }
    >
  ): void {
    for (const [keyString, value] of typeMap) {
      this.checkGenericUsage(value.node, value);
    }
  }
  public static checkGenericUsage(
    node: ts.Node,
    typeMap: { used: boolean; kind: string; pos: number }
  ): void {
    this.checkPressTypeUsage(node, typeMap);
    // 递归检查子节点
    ts.forEachChild(node, (child) => this.checkGenericUsage(child, typeMap));
  }

  // 检查函数返回值中的泛型
  public static checkPressTypeUsage(
    node: ts.Node,
    typeMap: { used: boolean; kind: string; pos: number }
  ): void {
    if (!node) {
      return;
    }

    const genericText = this.isGenericUsedInType(node);
    if (!genericText) {
      return;
    }
    if (typeMap.kind === genericText) {
      const infoPos = typeMap?.pos;
      const nodePos = node.getStart();
      infoPos !== nodePos ? (typeMap!.used = true) : (typeMap!.used = false);
    }
  }
  public static isGenericUsedInType(node: ts.Node): string | null {
    if (!node) {
      return null;
    }

    if (ts.isTypeParameterDeclaration(node)) {
      return node.name.getText();
    }

    if (ts.isTypeReferenceNode(node)) {
      return this.handleTypeReferenceNode(node);
    }

    if (ts.isInferTypeNode(node)) {
      return node.typeParameter.name.getText();
    }

    if (ts.isConditionalTypeNode(node)) {
      return this.handleConditionalTypeNode(node);
    }

    if (ts.isIndexedAccessTypeNode(node)) {
      return this.handleIndexedAccessTypeNode(node);
    }

    if (ts.isMappedTypeNode(node)) {
      return this.isGenericUsedInType(node.type ?? node.typeParameter);
    }

    if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) {
      return this.handleFunctionTypeNode(node);
    }

    return this.checkChildrenForGeneric(node);
  }

  public static handleTypeReferenceNode(node: ts.TypeReferenceNode): string | null {
    const typeName = node.typeName.getText();
    if (node.typeArguments) {
      for (const arg of node.typeArguments) {
        const genericName = this.isGenericUsedInType(arg);
        if (genericName) {
          return genericName;
        }
      }
    }
    return typeName;
  }

  public static handleConditionalTypeNode(
    node: ts.ConditionalTypeNode
  ): string | null {
    return (
      this.isGenericUsedInType(node.checkType) ||
      this.isGenericUsedInType(node.extendsType) ||
      this.isGenericUsedInType(node.trueType) ||
      this.isGenericUsedInType(node.falseType)
    );
  }

  public static handleIndexedAccessTypeNode(
    node: ts.IndexedAccessTypeNode
  ): string | null {
    return (
      this.isGenericUsedInType(node.objectType) ||
      this.isGenericUsedInType(node.indexType)
    );
  }

  public static handleFunctionTypeNode(
    node: ts.FunctionTypeNode | ts.ConstructorTypeNode
  ): string | null {
    for (const param of node.parameters) {
      if (param.type) {
        const paramType = this.isGenericUsedInType(param.type);
        if (paramType) {
          return paramType;
        }
      }
    }
    return this.isGenericUsedInType(node.type);
  }

  public static checkChildrenForGeneric(node: ts.Node): string | null {
    let firstGeneric: string | null = null;
    ts.forEachChild(node, (child) => {
      firstGeneric = this.isGenericUsedInType(child);
      if (firstGeneric) {
        return;
      }
    });
    return firstGeneric;
  }

  public static getUnusedGenerics(astRoot: ts.SourceFile): astType[] {
    const typeMap = new Map<
      string,
      { used: boolean; kind: string; pos: number; node: ts.Node }
    >();
    const unusedGenerics: {
      name: string;
      kind: string;
      line: number;
      character: number;
    }[] = [];

    // 1. 收集所有的泛型声明（包括类型别名、函数签名中的泛型等）
    this.collectGenerics(astRoot, typeMap);

    // 2. 遍历 AST 检查这些泛型是否被使用
    this.checkGenericUsages(typeMap);

    // 3. 输出未使用的泛型
    for (const [name, info] of typeMap.entries()) {
      if (!info.used) {
        const { line, character } = astRoot.getLineAndCharacterOfPosition(
          info.pos
        );
        unusedGenerics.push({
          name: info.kind,
          kind: info.kind,
          line: line + 1,
          character: character + 1,
        });
      }
    }
    return unusedGenerics;
  }

  // 递归遍历 AST
  public static traverseAST(node: ts.Node, namespaceName: string): boolean {
    // 如果节点为空，或者已经找到了命名空间使用，直接返回 true
    if (!node) {
      return false;
    }

    // 处理 PropertyAccessExpression 这种访问（MyNamespace.greet()）
    if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
      const propertyAccess = node as ts.PropertyAccessExpression;
      // 检查访问的对象是否是命名空间 MyNamespace
      if (
        propertyAccess.expression.kind === ts.SyntaxKind.Identifier &&
        (propertyAccess.expression as ts.Identifier).text === namespaceName
      ) {
        // 如果访问的属性（函数或变量）也匹配
        return true;
      }
    }

    // 处理 QualifiedName 这种类型引用（MyNamespace.SomeType）
    if (node.kind === ts.SyntaxKind.QualifiedName) {
      const qualifiedName = node as ts.QualifiedName;
      if (
        qualifiedName.left.kind === ts.SyntaxKind.Identifier &&
        (qualifiedName.left as ts.Identifier).text === namespaceName
      ) {
        return true; // 找到命名空间 MyNamespace 被引用
      }
    }

    // 递归遍历子节点
    return (
      ts.forEachChild(node, (childNode) => {
        return this.traverseAST(childNode, namespaceName); // 一旦找到目标，递归会返回 true
      }) || false
    ); // 如果没有找到任何子节点使用该命名空间，返回 false
  }

  // `isNamespaceUsed` 方法调用外部 `traverseAST`
  public static isNamespaceUse(
    arkfile: ArkFile,
    namespaceSignature: NamespaceSignature
  ): boolean {
    for (const clasz of arkfile.getClasses()) {
      for (const method of clasz.getMethods()) {
        if (this.isMethodUsingNamespace(method, namespaceSignature)) {
          return true;
        }
      }
    }
    return false;
  }

  public static isMethodUsingNamespace(
    method: ArkMethod,
    namespaceSignature: NamespaceSignature
  ): boolean {
    const stmts = method.getBody()?.getCfg()?.getStmts() ?? [];
    for (const stmt of stmts) {
      if (
        stmt instanceof ArkInvokeStmt &&
        this.isInvokeUsingNamespace(stmt, namespaceSignature)
      ) {
        return true;
      }
    }
    return false;
  }

  public static isInvokeUsingNamespace(
    stmt: ArkInvokeStmt,
    namespaceSignature: NamespaceSignature
  ): boolean {
    const invokeExpr = stmt.getInvokeExpr();
    const methodSignature = invokeExpr.getMethodSignature();
    if (
      methodSignature instanceof NamespaceSignature &&
      methodSignature === namespaceSignature
    ) {
      return true;
    }
    const args = invokeExpr.getArgs();
    for (const arg of args) {
      if (this.isArgumentUsingNamespace(arg, namespaceSignature)) {
        return true;
      }
    }
    return false;
  }

  public static isArgumentUsingNamespace(
    arg: any,
    namespaceSignature: NamespaceSignature
  ): boolean {
    const varBaseArg = arg as Var_base;
    if (varBaseArg && varBaseArg.declaringStmt instanceof ArkAssignStmt) {
      const origText = varBaseArg.declaringStmt.getOriginalText() ?? '';
      if (this.isTextUsed(origText, namespaceSignature.getNamespaceName())) {
        return true;
      }
    }
    return false;
  }

  
  public static getClassOrMethod(arkFileAllClass: ArkClass[], arkfile: ArkFile): noUseVars[] {
    let nousedSet: noUseVars[] = [];
    for (const targetClass of arkFileAllClass) {
      let methods = targetClass.getMethods();
      const methodStatic = targetClass.getMethodWithName('%statBlock0'); //获取static块
      if (methodStatic) {
        methods.push(methodStatic);
      }
      const isDefault = targetClass.getName() === '%dflt';
      const isExported = targetClass?.isExport();
      //逻辑语句中定义class 命名规则 className$作用域className.作用域函数名 要进行解析不能直接使用
      const className = targetClass.getName().split('$')[0];
      const extendedClass = targetClass.getExtendedClasses();
      const isInternal = targetClass.getName().startsWith('%');
      if (
        !(isExported) &&
        !isInternal &&
        extendedClass.size === 0
      ) {
        if (methodStatic) {
          nousedSet.push({
            varType: VarType.Class,
            arkClass: targetClass,
            name: className,
            static: true,
          });
        } else {
          nousedSet.push({
            varType: VarType.Class,
            arkClass: targetClass,
            name: className,
          });
        }
      }
    }
    return nousedSet;
  }
  public static filterClass(clas: ArkClass, signature: ClassSignature, exportNames: string[]): boolean {

      const implents = clas.getImplementedInterfaceNames(); //string[]
      const className = signature.getClassName();
      if (
        exportNames.includes(className) ||
        implents.includes(className)
      ) {
        return true;
      }
      //处理 new Object()情况
      const fields = clas.getFields();
      for (const item of fields) {
        let ui = item?.getType()?.getTypeString() ?? '-101p';
        const typeSign = (item?.getType() instanceof ClassType) ? (item?.getType() as ClassType)?.getClassSignature() : null;
        if (
           typeSign === signature ||
          (this.isTextUsed(ui, className) &&
          !this.isTextUsed(ui, `$${className}`))
        ) {
          return true;
        }
      }
    // }
    return false;
  }

  public static collectImports(
    node: ts.Node,
    astRoot: ts.SourceFile,
    importMap: Map<string, { used: boolean; source: string }>
  ): void {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      this.processImportDeclaration(node, astRoot, importMap);
    }

    ts.forEachChild(node, (child) =>
      this.collectImports(child, astRoot, importMap)
    );
  }

  public static processImportDeclaration(
    node: ts.ImportDeclaration | ts.ImportEqualsDeclaration,
    astRoot: ts.SourceFile,
    importMap: Map<string, { used: boolean; source: string }>
  ): void {
    if (ts.isImportDeclaration(node)) {
      const moduleText = node.moduleSpecifier.getText(astRoot);
      const importClause = node.importClause;

      if (importClause) {
        if (importClause.name) {
          this.processDefaultImport(
            importClause.name.text,
            moduleText,
            importMap
          );
        }

        if (importClause.namedBindings) {
          this.processNamedBindings(
            importClause.namedBindings,
            moduleText,
            importMap
          );
        }
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      const moduleText = node.moduleReference.getText();
      const importClauseName = node.name.escapedText.toString();
      this.processDefaultImport(importClauseName, moduleText, importMap);
    }
  }

  public static processDefaultImport(
    defaultImportName: string,
    source: string,
    importMap: Map<string, { used: boolean; source: string }>
  ): void {
    importMap.set(defaultImportName, { used: false, source: source });
  }

  public static processNamedBindings(
    namedBindings: ts.ImportClause['namedBindings'],
    source: string,
    importMap: Map<string, { used: boolean; source: string }>
  ): void {
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      this.processNamedImports(namedBindings, source, importMap);
    } else if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      this.processNamespaceImport(namedBindings, source, importMap);
    }
  }

  public static processNamedImports(
    namedImports: ts.NamedImports,
    source: string,
    importMap: Map<string, { used: boolean; source: string }>
  ): void {
    for (const element of namedImports.elements) {
      importMap.set(element.name.text, {
        used: false,
        source: source,
      });
    }
  }

  public static processNamespaceImport(
    namespaceImport: ts.NamespaceImport,
    source: string,
    importMap: Map<string, { used: boolean; source: string }>
  ): void {
    importMap.set(namespaceImport.name.text, {
      used: false,
      source: source,
    });
  }

  // 辅助函数：递归遍历 AST 检查标识符的使用情况
  public static checkUsage(
    node: ts.Node,
    astRoot: ts.SourceFile,
    importMap: Map<string, { used: boolean; source: string }>
  ): void {
    if (ts.isIdentifier(node)) {
      // 排除在导入声明中的标识符
      if (
        node.parent &&
        (ts.isImportSpecifier(node.parent) ||
          ts.isImportClause(node.parent) ||
          ts.isNamespaceImport(node.parent) ||
          ts.isImportEqualsDeclaration(node.parent))
      ) {
        // 忽略
      } else {
        if (importMap.has(node.text)) {
          const info = importMap.get(node.text)!;
          info.used = true;
          importMap.set(node.text, info);
        }
      }
    }
    ts.forEachChild(node, (child) =>
      this.checkUsage(child, astRoot, importMap)
    );
  }

  // 主函数：检测未使用的导入
  public static noUsedImport(astRoot: ts.SourceFile): string[] {
    const importMap = new Map<string, { used: boolean; source: string }>();
    const noUsedImports: string[] = [];
    // 1. 收集导入信息
    this.collectImports(astRoot, astRoot, importMap);

    // 2. 检查标识符使用情况
    this.checkUsage(astRoot, astRoot, importMap);

    // 3. 输出未使用的导入
    for (const [name, info] of importMap.entries()) {
      if (!info.used) {
        noUsedImports.push(name);
      }
    }
    return noUsedImports;
  }
 

  }
 