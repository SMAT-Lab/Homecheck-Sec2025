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
  ClassSignature,
  MethodSignature,
  Stmt,
  ArkAssignStmt,
  Local,
  Value,
  ArkInvokeStmt,
  FieldSignature,
  AbstractBinopExpr,
  ExportInfo,
  ArkInstanceFieldRef,
  AliasType,
  ArkAliasTypeDefineStmt,
  Scene,
  ArkFile,
  ArkField,
  ImportInfo,
  ClassType,
  ArkMethod,
  UnknownType,
  ArkUnopExpr,
  ArkCastExpr,
  AbstractInvokeExpr,
  ArkInstanceOfExpr,
  ArkNewExpr,
  Type,
  ArkIfStmt
} from 'arkanalyzer/lib';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { ArkClass } from 'arkanalyzer/lib/core/model/ArkClass';
import { ArkExport } from 'arkanalyzer/lib/core/model/ArkExport';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import {
  ClassMatcher,
  MatcherCallback,
  MatcherTypes,
} from '../../matcher/Matchers';
import { Defects, IssueReport } from '../../model/Defects';
import { Rule } from '../../model/Rule';
type Scene_base = {
  declaringStmt?: Stmt;
  fieldSignature?: FieldSignature;
  classSignature?: ClassSignature;
  methodSignature?: MethodSignature;
  classType?: { classSignature?: ClassSignature };
  usedStmts?: Stmt[];
};
//结果类型
enum VarType {
  Var = 'var',
  Import = 'import',
  TypeDef = 'typeDef',
  TypeRef = 'typeRef',
  ENUM = 'enum',
  Class = 'class',
  Method = 'method',
  Param = 'param',
  Export = 'export',
}
const escapedNameReg = /[.*+?^=!:${}()|\[\]\/\\]/g;
const replaceStringReg = /[.*+?^=!:${}()|\[\]\/\\]/g;
type UseDefined = {
  varType: VarType; //方法名称
  stmt?: Stmt;
  arkClass?: ArkClass;
  exportinfo?: ExportInfo;
  filePath?: string;
  posion?: [lineNo: number, column: number];
  infunc?: boolean;
  name: string; //解构-特殊情况
  isDef?: boolean;
};
type Options = {
  allowNamedExports?: boolean;
  classes?: boolean;
  enums?: boolean;
  functions?: boolean;
  variables?: boolean;
  ignoreTypeReferences?: true;
  typedefs?: true;
};
const defaultOptions: Options = {
  allowNamedExports: false,
  classes: true,
  enums: true,
  functions: true,
  variables: true,
  ignoreTypeReferences: true,
  typedefs: true,
};

const logger = Logger.getLogger(
  LOG_MODULE_TYPE.HOMECHECK,
  'NoUseBeforeDefineCheck'
);
const gMetaData: BaseMetaData = {
  severity: 1,
  ruleDocPath: 'docs/no-use-before-define.md',
  description: 'was used before it was defined.',
};
//编译过程中检测未使用的本地变量和参数
export class NoUseBeforeDefineCheck implements BaseChecker {
  readonly metaData: BaseMetaData = gMetaData;
  public rule: Rule;
  public defects: Defects[] = [];
  public issues: IssueReport[] = [];
  private clsMatcher: ClassMatcher = {
    matcherType: MatcherTypes.CLASS,
  };

  public registerMatchers(): MatcherCallback[] {
    const matchBuildCb: MatcherCallback = {
      matcher: this.clsMatcher,
      callback: this.check,
    };
    return [matchBuildCb];
  }
  public check = (targetClass: ArkClass) => {
    /**
     * targetClass 是扫描的目标文件Class类
     * methods 是文件内所有定义的函数(函数-->'%dft'--->文件非定义Class 和function 片段)
     *
     */
    const targetFile = targetClass.getDeclaringArkFile();
    const targetFilePath = targetFile.getFilePath();
    const isTs = this.getFileExtension(targetFilePath, 'ts');
    if (!isTs) {
      return;
    }
    const scene = targetFile.getScene();
    //获取定义之前
    //获取定义在arkfile最外层的变量集合
    const allVar: UseDefined[] = []; //存放全局变量信息;
    let usedBefores: UseDefined[] = [];
    const defaultMethod = targetFile.getDefaultClass().getDefaultArkMethod();
    this.processDefaultMethod(defaultMethod, allVar);//获取全局变量
    //获取定义在全局的type
    const globalAliasTypeMapMap:
      | Map<string, [AliasType, ArkAliasTypeDefineStmt]>
      | undefined = targetFile
      .getDefaultClass()
      .getDefaultArkMethod()
      ?.getBody()
      ?.getAliasTypeMap();
    const importInfos = targetFile.getImportInfos();
    this.processExtendedClasses(targetClass, usedBefores, importInfos);
    this.processMethod(
      usedBefores,
      targetClass,
      targetFile,
      globalAliasTypeMapMap,
      importInfos,
      allVar
    );
    //获取静态代码区间
    const staticmethod = targetClass.getMethodWithName('%statBlock0');
    this.processSticMethod(targetClass, usedBefores, staticmethod, scene);
    //2.导出类型判定
    const exportsMap: ExportInfo[] = targetFile.getExportInfos();
    this.processExport(exportsMap, usedBefores, importInfos);

    const options: Options = this.rule.option[0] as unknown as Options;
    const mergedOptions: Options = {
      ...defaultOptions,
      ...options,
    };
    const filerUsed = this.filterUnuseds(mergedOptions, usedBefores);
    //装配信息
    this.processFileUsedIssues(filerUsed);
  };
  private handleRightOp(
    stmt: Stmt,
    rightOp: Value,
    scene: Scene,
    usedBefores: UseDefined[],
    importInfos: ImportInfo[],
    allVar: UseDefined[]
  ): UseDefined[] {
    let useDefinedBefore: UseDefined[] = [{varType: VarType.Var, stmt: stmt, name: ''}, {varType: VarType.Var, stmt: stmt, name: ''}];
    if (rightOp instanceof AbstractBinopExpr) {
      const op1 = rightOp.getOp1();
      const op2 = rightOp.getOp2();
      if (!op1.toString().startsWith('%')) {
        useDefinedBefore[0] = this.processExpression(
          stmt,
          op1,
          scene,
          importInfos,
          allVar
        ); // 处理 op1
      }
      if (!op2.toString().startsWith('%')) {
        useDefinedBefore[1] = this.processExpression(
          stmt,
          op2,
          scene,
          importInfos,
          allVar
        ); // 处理 op2
      }
    } else if (rightOp instanceof ArkUnopExpr || rightOp instanceof ArkInstanceOfExpr || rightOp instanceof ArkCastExpr) {
      const op = rightOp.getOp();
      useDefinedBefore[0] = this.processExpression(
        stmt,
        op,
        scene,
        importInfos,
        allVar
      ); // 处理 op
    } else if (rightOp instanceof AbstractInvokeExpr || rightOp instanceof ArkNewExpr) {
      this.processAbstractInvokeExpr(stmt, rightOp, scene, usedBefores, allVar, importInfos);
    } else if (rightOp instanceof ArkInstanceFieldRef) {
        this.processAbstracFieldRef(stmt, rightOp, usedBefores, importInfos);  
    }
     else if (!rightOp.toString().startsWith('%')) {
      useDefinedBefore[2] = this.processExpression(
        stmt,
        rightOp,
        scene,
        importInfos,
        allVar
      ); //直接处理
    }
    return useDefinedBefore;
  }
private handleLeftOp(
  stmt: Stmt,
  leftOp: Value,
  usedBefores: UseDefined[],
  allVar: UseDefined[],
  importInfos: ImportInfo[]) {
    const leftStmt = leftOp as Scene_base;
    const leftName = leftOp.toString() ?? '';
    const declareLineNo = stmt.getOriginPositionInfo().getLineNo() ?? -1;
    const originalText = stmt.getOriginalText() ?? '';
    const startVar = originalText.split('=')[0].trim();
    if (leftStmt?.usedStmts && leftStmt?.usedStmts?.length > 0 && this.isVariableDeclaration(originalText) && startVar.endsWith(leftName)) {
      const usedStmts = leftStmt.usedStmts;
     this.forInHandleLeftOp(usedStmts, declareLineNo, stmt, usedBefores, leftName);
    } else if (!leftName.startsWith('%') && (!this.isVariableDeclaration(originalText) || 
    (this.isVariableDeclaration(originalText) && !startVar.endsWith(leftName))) ) {
//处理未知类型是否在变量里
    this.processVarOrImport(stmt, declareLineNo, leftName, usedBefores, allVar, importInfos);

} else if (this.isSpecialABCase(leftName, originalText)) {
  //处理a,b 情况
 this.otherAddUsedBefores(originalText, stmt, allVar, usedBefores);
}
  }

  private isSpecialABCase(leftName: string, originalText: string): boolean {
    return (
      leftName.startsWith('%') &&
      !originalText.includes('=') &&
      originalText.includes(',')
    );
  }

private otherAddUsedBefores(originalText: string, stmt: Stmt, allVar: UseDefined[], usedBefores: UseDefined[]): void {
  const varArry = originalText.split(',');
  for (const varName of varArry) {
    const lineNo = stmt.getOriginPositionInfo().getLineNo();
    const varAll = allVar.find((item) => item.name === varName.trim());
    const defLineNo = varAll?.stmt?.getOriginPositionInfo().getLineNo() ?? -1;
    if (varAll && lineNo < defLineNo) {
      usedBefores.push({
        varType: VarType.Var,
        stmt: stmt,
        name: varName.trim() ?? '',
      });
    }
  }
}
  
private forInHandleLeftOp(usedStmts: Stmt[], declareLineNo: number, stmt: Stmt,
  usedBefores: UseDefined[], leftName: string

): void {
  for (const st of usedStmts) {
    const lineNo = st.getOriginPositionInfo().getLineNo() ?? -1;
    if (lineNo < declareLineNo && st !== stmt && !(st instanceof ArkInvokeStmt)) {
      usedBefores.push({
        varType: VarType.Var,
        stmt: st,
        name: leftName ?? '',
      });
    }

  }
}

private processVarOrImport(stmt: Stmt, declareLineNo: number, leftName: string, 
  usedBefores: UseDefined[],
  allVar: UseDefined[],
  importInfos: ImportInfo[]): void {
  const varAll = allVar.find((item) => item.name === leftName);
      const varLineNo = varAll?.stmt?.getOriginPositionInfo().getLineNo() ?? -1;
      //for语句中不考虑
      const originalText = stmt.getOriginalText() ?? '';
      if (declareLineNo < varLineNo && !originalText.replace(' ', '').startsWith('for') && !this.isVariableDeclaration(originalText)) {
        //添加到结果集
        usedBefores.push({
          varType: VarType.Var,
          stmt: stmt,
          name:leftName,
        });
      }
    
    const result = importInfos.find((item) => {
      const name = item.getImportClauseName();
      return name === leftName;
    });
    if (result && result.getOriginTsPosition().getLineNo() > declareLineNo) {
      usedBefores.push({
        varType: VarType.Import,
        stmt: stmt,
        name: leftName,
      });
    }
}

  private processExpression(
    leftOp: Stmt,
    expr: any,
    scene: Scene,
    importInfos: ImportInfo[],
    allVar: UseDefined[]
  ): UseDefined {
    let useDefinedBefore: UseDefined = {
      varType: VarType.Var,
      stmt: leftOp,
      name: '',
    };
    const exprDef = expr as Scene_base;

    let lineNo = leftOp.getOriginPositionInfo().getLineNo() ?? -1;
    //记录原始对比信息
    if (exprDef.fieldSignature) {
      const fieldSignature = exprDef.fieldSignature;
      //2.处理枚举
     this.processExpressionFieldSignature(fieldSignature, leftOp, scene, lineNo, useDefinedBefore);
    } else if (exprDef.methodSignature) {
      //3.处理函数
      const methodSignature = exprDef.methodSignature;
      this.processExpressionMethodSignature(methodSignature, leftOp, scene, importInfos, lineNo, useDefinedBefore);
      
    } else if (exprDef.classSignature || exprDef.classType) {
      //3.处理类
      const classSignature = exprDef.classSignature ?? exprDef.classType?.classSignature;
      this.processExpressionClassSignature(classSignature, leftOp, scene, importInfos, lineNo, useDefinedBefore);
    } else if (expr.getType() instanceof UnknownType) {
      //处理未知类型是否在变量里
      this.processExpressionUnknowType(expr, leftOp, allVar, importInfos, lineNo, useDefinedBefore);
    }
    return useDefinedBefore;
  }
  private processExpressionFieldSignature(
    fieldSignature: FieldSignature,
    leftOp: Stmt,
    scene: Scene,
    lineNo: number,
    useDefinedBefore: UseDefined
  ): void {
    const classSignature = fieldSignature.getDeclaringSignature();
    if (classSignature instanceof ClassSignature) {
      const arkClass = scene.getClass(classSignature);
      const line = arkClass?.getLine() ?? -1;
      const thisClass = leftOp
        .getCfg()
        ?.getDeclaringMethod()
        ?.getDeclaringArkClass()
        ?.getSignature();
      const classSign = arkClass?.getSignature();
      const BtoB = classSign === thisClass;
      //&& BtoB
      if (lineNo < line ) {
        //添加到结果集
        useDefinedBefore.varType = VarType.ENUM;
        useDefinedBefore.stmt = leftOp;
        useDefinedBefore.name = arkClass?.getName() ?? '';
      }
    }
  }
  private processExpressionMethodSignature(
    methodSignature: MethodSignature,
    leftOp: Stmt,
    scene: Scene,
    importInfos: ImportInfo[],
    lineNo: number,
    useDefinedBefore: UseDefined
  ): void {
      const methodName1 =
        methodSignature?.getMethodSubSignature()?.getMethodName() ?? '-1-1';
      const arkMethod = scene.getMethod(methodSignature);
      const line = arkMethod?.getLine() ?? -1;
      const io = line;
      const methodName = arkMethod?.getName() ?? methodName1;
      const originalText = leftOp.getOriginalText() ?? '';
      lineNo = leftOp?.getOriginPositionInfo()?.getLineNo();
      const linkFirst = this.extractFunctionName(originalText);
      const result = importInfos.find((item) => {
        const name = item.getImportClauseName();
        return name === methodName || name === linkFirst;
      });
      const methodClass = arkMethod?.getDeclaringArkClass()?.getSignature();
      const thisClass = leftOp
        .getCfg()
        ?.getDeclaringMethod()
        ?.getDeclaringArkClass()
        ?.getSignature();
      const BtoB = methodClass === thisClass;
      if (
        !methodName.startsWith('%') &&
        (!linkFirst || (BtoB && lineNo < line && !result))
      ) {
        //添加到结果集
        useDefinedBefore.varType = VarType.Method;
        useDefinedBefore.stmt = leftOp;
        useDefinedBefore.name = arkMethod?.getName() ?? '';     
    }

  }

  private processExpressionClassSignature(
    classSignature: ClassSignature | undefined,
    leftOp: Stmt,
    scene: Scene,
    importInfos: ImportInfo[],
    lineNo: number,
    useDefinedBefore: UseDefined
  ): void {
    if (classSignature) {
      const arkClass = scene.getClass(classSignature);
      const column = arkClass?.getColumn() ?? -1;
      const line = arkClass?.getLine() ?? -1;
      const result = importInfos.find((item) => {
        const name = item.getImportClauseName();
        const className = arkClass?.getName();
        return name === className;
      });

      if (lineNo < line && !result) {
        //添加到结果集
        useDefinedBefore.varType = VarType.Class;
        useDefinedBefore.stmt = leftOp;
        useDefinedBefore.name = arkClass?.getName() ?? '';
      }
    }

  }

  private processExpressionUnknowType(
    expr: any,
    leftOp: Stmt,
    allVar: UseDefined[],
    importInfos: ImportInfo[],
    lineNo: number,
    useDefinedBefore: UseDefined
  ): void {
    const exprName = expr.toString().replace('typeof', '').trim() ?? '-1-1';
      const varAll = allVar.find((item) => item.name === exprName);
      const declareLineNo = varAll?.stmt?.getOriginPositionInfo().getLineNo() ?? -1;
      const result = importInfos.find((item) => {
        const name = item.getImportClauseName();
        return name === exprName;});
      const importLineNo = result?.getOriginTsPosition().getLineNo() ?? -1;
      if (lineNo < declareLineNo || lineNo < importLineNo) {
        //添加到结果集
        useDefinedBefore.varType = VarType.Var;
        useDefinedBefore.stmt = leftOp;
        useDefinedBefore.name = exprName;
      }

  }


//不是重点是对逻辑补充 其它情况倒推已解决
  private processAbstracFieldRef(stmt: Stmt,
    abstractExpr: ArkInstanceFieldRef,
    usedBefores: UseDefined[],
    importInfos: ImportInfo[]): void {
      const line = stmt.getOriginPositionInfo().getLineNo();
      const filebaseName = abstractExpr.getBase().getName();
      
      const result = importInfos.find((item) => {
        const name = item.getImportClauseName();
        return name === filebaseName;
      });

      if (result && result.getOriginTsPosition().getLineNo() > line) {
       {
        usedBefores.push({
          varType: VarType.Import,
          stmt: stmt,
          name: filebaseName
        });
      }
     
  }}
 
   
  //获取过滤后的结果
  private filterUnuseds(
    mergedOptions: Options,
    usedBefores: UseDefined[]
  ): UseDefined[] {
    let filerUse: UseDefined[] = [];
    if (!mergedOptions.classes) {
      usedBefores = usedBefores.filter(
        (item) => !(item.varType === VarType.Class && item.infunc)
      );
    }  
    if (!mergedOptions.functions) {
      usedBefores = usedBefores.filter(
        (item) => !(item.varType === VarType.Method)
      );
    }  
    if (!mergedOptions.variables) {
      usedBefores = usedBefores.filter(
        (item) => !(item.varType === VarType.Var)
      );
    }  
    if (mergedOptions.allowNamedExports) {
      usedBefores = usedBefores.filter(
        (item) => !(item.varType === VarType.Export)
      );
    }  
    if (!mergedOptions.enums) {
      usedBefores = usedBefores.filter(
        (item) => !(item.varType === VarType.ENUM)
      );
    }
    if (!mergedOptions.typedefs) {
      usedBefores = usedBefores.filter(
        (item) => !(item.varType === VarType.TypeDef)
      );
    }  
    if (mergedOptions.ignoreTypeReferences) {
      usedBefores = usedBefores.filter(
        (item) => !item.isDef 
      );
    }  
    filerUse = usedBefores;
    return filerUse;
  }
  private addIssueReport(stmt: Stmt, name: string, isparam: boolean) {
    const severity = this.rule.alert ?? this.metaData.severity;
    const level = severity === 2 ? 'error' : 'warn';
    let warnInfo = this.getLineAndColumn(stmt, name, isparam);
    if (isparam) {
      warnInfo.startCol = warnInfo.endCol;
    }
    const defect = new Defects(
      warnInfo.line,
      warnInfo.startCol,
      warnInfo.endCol,
      `'${name}' ` + this.metaData.description,
      severity,
      this.rule.ruleId,
      warnInfo.filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    if (warnInfo.line !== -1 && warnInfo.startCol !== -1) {
      this.defects.push(defect);
      this.issues.push(new IssueReport(defect, undefined));
      RuleListUtil.push(defect);
    }
  }

  private getLineAndColumn(stmt: Stmt, name: string, isparam: boolean) {
    const originPosition = stmt.getOriginPositionInfo();
    let line = originPosition.getLineNo();
    const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
    if (arkFile) {
      const originText = stmt.getOriginalText() ?? '';
      let startCol = originPosition.getColNo();
      let pos = originText.indexOf(name);
      const nameInsdex = this.getArrayDefineVarIndex(stmt, name);
      const posion = this.getTextPosition(originText, name, nameInsdex);
      startCol = posion.line === 0 ? startCol + posion.column - 1 : posion.column;
      line = posion.line > 0 ? line + posion.line : line;
      const endCol = startCol + name.length - 1;
      const originPath = arkFile.getFilePath();
      return { line, startCol, endCol, filePath: originPath };
    } else {
      logger.debug('arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }

  private getArrayDefineVarIndex(stmt: Stmt, name: string): number {
    if (!(stmt instanceof ArkAssignStmt)) {
      return 1;
    }
    const startCode = stmt.getLeftOp().toString();
    const stmtCode = stmt.getOriginalText() ?? '';
    const index = stmtCode.lastIndexOf(name);
    if (index > 1) {
      const textArray = stmtCode.split(',');
      for (let i = 0; i < textArray.length; i++) {
        const textcode = textArray[i];
        if (textcode.trim().startsWith(startCode)) {
          return i + 1;
        }
      }
    }
    return 1; // 如果没找到，返回 -1 更合理
  }
  
  private getTextPosition(text: string, target: string, occurrence: number = 1): { line: number, column: number } {
    const escapedTarget = this.escapeRegExp(target);
    const strictWordRegex = new RegExp(`(?<![a-zA-Z0-9])${escapedTarget}(?![a-zA-Z0-9])`, 'gs'); // 'g' 全局匹配，'s' 跨行支持
  
    let match: RegExpExecArray | null;
    let count = 0;
  
    while ((match = strictWordRegex.exec(text)) !== null) {
      count++;
      if (count === occurrence) {
        const index = match.index;
        const linesUpToMatch = text.slice(0, index).split('\n');
        const line = linesUpToMatch.length - 1;
        const column = linesUpToMatch[linesUpToMatch.length - 1].length + 1;
        return { line, column };
      }
    }
  
    return { line: -1, column: -1 };
  }
  
  private escapeRegExp(str: string): string {
    return str.replace(replaceStringReg, '\\$&'); // 转义所有正则特殊字符
  }
  private addIssueReportOther(
    name: string,
    code: string,
    arkfile: ArkFile | string,
    position: [lineNo: number, colNo: number]
  ): void {
    const severity = this.rule.alert ?? this.metaData.severity;
    let warnInfo = { line: -1, startCol: -1, endCol: -1, filePath: '' };
    if (arkfile instanceof ArkFile) {
      warnInfo = this.getLineAndColumnOther(name, code, arkfile, position);
    } else {
      warnInfo.filePath = arkfile;
      warnInfo.line = position[0];
      warnInfo.startCol = position[1];
    }
    const defect = new Defects(
      warnInfo.line,
      warnInfo.startCol,
      warnInfo.endCol,
      `'${name}' ` + this.metaData.description,
      severity,
      this.rule.ruleId,
      warnInfo.filePath,
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    if (warnInfo.line !== -1) {
      this.defects.push(defect);
      this.issues.push(new IssueReport(defect, undefined));
      RuleListUtil.push(defect);
    }
  }
  private getLineAndColumnOther(
    name: string,
    code: string,
    arkfile: ArkFile,
    position: [lineNo: number, colNo: number]
  ): { line: number; startCol: number; endCol: number; filePath: string } {
    if (arkfile) {
      const originText = code ?? '';
      let startCol = position[1];
      const pos = originText.indexOf(name);
      if (pos !== -1) {
        startCol += pos;
        const endCol = startCol + name.length - 1;
        const originPath = arkfile.getFilePath();
        return { line: position[0], startCol, endCol, filePath: originPath };
      }
    } else {
      logger.debug('arkFile is null');
    }
    return { line: -1, startCol: -1, endCol: -1, filePath: '' };
  }
  //获取片段内某段位置
  private getAccuratePosition(
    codeImport: string,
    name: string
  ): { line: number; col: number } {
    const lines = codeImport.split('\n');

    // 转义 name 中的正则特殊字符
    const escapedName = name.replace(escapedNameReg, '\\$&');

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

  //获取调用链首个位置名称
  private extractFunctionName(str: string): string {
    // 去掉所有括号 '()'
    str = str.replace(/\(\)/g, '');

    // 先按 '.' 分割，并取第一个部分
    const firstPart = str.split('.')[0];

    // 再按 ' ' 分割，取最后一个非空单词
    const parts = firstPart.trim().split(' ');
    return parts[parts.length - 1].split('(')[0]; // 取最后一个单词处理(String('abcd') import String)
  }

  private getFileExtension(filePath: string, filetype: string): boolean {
    // 使用正则表达式匹配文件后缀
    const match = filePath.match(/\.([0-9a-zA-Z]+)$/);

    // 如果匹配到了扩展名，且扩展名等于 filetype，则返回扩展名，否则返回空字符串
    if (match) {
      const extension = match[1];
      return extension === filetype;
    }

    return false;
  }

  private processExtendedClasses(
    targetClass: ArkClass,
    usedBefores: UseDefined[],
    importInfos: ImportInfo[]
  ): void {
    const extendClass: Map<string, ArkClass> = targetClass.getExtendedClasses();
    for (const [key, extendArkclass] of extendClass) {
      if (extendArkclass) {
        //1.推断类是否之前调
        const column = extendArkclass?.getColumn() ?? -1;
        const line = extendArkclass?.getLine() ?? -1;
        const targetClassLine = targetClass?.getLine() ?? -1;
        const result = importInfos.find((item) => {
          item.getImportClauseName() === extendArkclass?.getName();
        });
        if (targetClassLine > line && !result) {
          //添加到结果集
          usedBefores.push({
            varType: VarType.Class,
            arkClass: extendArkclass,
            name: targetClass?.getName() ?? '',
          });
        }
      }
    }
  }

  private processMethod(
    usedBefores: UseDefined[],
    targetClass: ArkClass,
    targetFile: ArkFile,
    globalAliasTypeMapMap:
      | Map<string, [AliasType, ArkAliasTypeDefineStmt]>
      | undefined,
    importInfos: ImportInfo[],
    allVar: UseDefined[]
  ): void {
    const className = targetClass.getName();
    const targetFilePath = targetFile.getFilePath();
    const methods = targetClass.getMethods();
    const methodStatic = targetClass.getMethodWithName('%statBlock0'); //获取static块
      if (methodStatic) {
        methods.push(methodStatic);
      }
    const scene = targetFile.getScene();
    for (const arkMethod of methods) {
      const methodName = arkMethod?.getName()?.split('.')[0] ?? '-1Method'; // 处理特殊情况
      if (methodName === className && !methodName.startsWith('%')) {
        const positionLineNo = arkMethod.getLine() ?? -1;
        const positionColNo = arkMethod.getColumn() ?? -1;
        usedBefores.push({
          varType: VarType.Class,
          name: className,
          filePath: targetFile.getFilePath(),
          posion: [positionLineNo, positionColNo],
        });
      }

      const stmts = arkMethod.getBody()?.getCfg().getStmts() ?? [];
      const usedGlobal: Map<string, Value> =
        arkMethod.getBody()?.getUsedGlobals() ?? new Map<string, Value>();
      const varLocal: Map<string, Local> =
        arkMethod.getBody()?.getLocals() ?? new Map<string, Local>();
      this.processVarLocal(
        varLocal,
        usedBefores,
        targetClass,
        targetFile,
        globalAliasTypeMapMap,
        importInfos,
        allVar,
        scene
      );
      this.processGlobal(usedGlobal, usedBefores, allVar);
      //检索执行语句(函数调用)
      this.processStmt(
        stmts,
        scene,
        usedBefores,
        allVar,
        targetFilePath,
        importInfos
      );
    }
  }

  private processVarLocal(
    varLocal: Map<string, Local>,
    usedBefores: UseDefined[],
    targetClass: ArkClass,
    targetFile: ArkFile,
    globalAliasTypeMapMap:
      | Map<string, [AliasType, ArkAliasTypeDefineStmt]>
      | undefined,
    importInfos: ImportInfo[],
    allVar: UseDefined[],
    scene: Scene
  ): void {
    for (const [key, local] of varLocal) {
      const declareStmt = local.getDeclaringStmt();
      if (declareStmt instanceof ArkAssignStmt) {
        const leftOp = declareStmt.getLeftOp();
        const typeName =
          leftOp.getType().toString().split('#').at(-1) ??
          leftOp.getType().toString();
        const localAliasTypeMapMap:
          | Map<string, [AliasType, ArkAliasTypeDefineStmt]>
          | undefined = targetFile
          .getDefaultClass()
          .getDefaultArkMethod()
          ?.getBody()
          ?.getAliasTypeMap();
        if (leftOp.toString().startsWith('this')) {
          continue;
        }
        this.processLocalType(
          localAliasTypeMapMap,
          typeName,
          usedBefores,
          globalAliasTypeMapMap,
          importInfos,
          targetClass,
          declareStmt
        );
        this.processLocalDefType(declareStmt, usedBefores, local.getType(), scene);
        //处理变量
        this.processArkAssignStmt(declareStmt, scene, usedBefores, allVar, targetFile.getFilePath(), importInfos);
      }
    }
  }

 //处理 定义type类型

 private processLocalDefType(declareStmt: Stmt, usedBefores: UseDefined[], baseType: Type, scene: Scene): void {
  if (baseType instanceof ClassType) {
    const typeClassSign = baseType.getClassSignature();
    const decLareLine = declareStmt.getOriginPositionInfo().getLineNo();
    const typeClass = scene.getClass(typeClassSign);
    const typeName = typeClass?.getName();
    const typeClassLine = typeClass?.getLine() ?? -1;
    if (decLareLine < typeClassLine) {
      usedBefores.push({
        varType: VarType.TypeDef,
        stmt: declareStmt,
        name: typeName ?? '',
        isDef: true
      });
    }
  } 
 
      
 }

  private processGlobal(
    usedGlobal: Map<string, Value>,
    usedBefores: UseDefined[],
    allVar: UseDefined[]
  ): void {
    for (const [key, glob] of usedGlobal) {
      const usedGlobalName = key;
      const varAll = allVar.find((item) => item.name === usedGlobalName);
      const usedStmt = (glob as { usedStmts?: Stmt[] }).usedStmts ?? [];
      this.pushGlobal(usedStmt, varAll, usedBefores, usedGlobalName);
    }
  }

  private pushGlobal(
    usedStmt: Stmt[],
    varAll: UseDefined | undefined,
    usedBefores: UseDefined[],
    usedGlobalName: string
  ): void {
    for (const usestm of usedStmt) {
      if (varAll) {
        const lineNo = usestm.getOriginPositionInfo().getLineNo() ?? -1;
        const varLine =
          varAll.stmt?.getOriginPositionInfo().getLineNo() ?? -1;
        if (!(usestm instanceof ArkInvokeStmt) && varLine > lineNo) {
          usedBefores.push({
            varType: VarType.Var,
            stmt: usestm,
            name: usedGlobalName ?? '',
          });
        }
      }
    }
  }

  private processStmt(
    stmts: Stmt[],
    scene: Scene,
    usedBefores: UseDefined[],
    allVar: UseDefined[],
    targetFilePath: string,
    importInfos: ImportInfo[]
  ): void { 
    for (const stmt of stmts) {
      //1.非执行语句
      this.processArkAssignStmt(
        stmt,
        scene,
        usedBefores,
        allVar,
        targetFilePath,
        importInfos
      );
     this.processArkIfStmt(stmt, usedBefores, allVar);
      //1.判断执行函数是否在定义之前+参数
      this.processInvokeStmt(stmt, scene, usedBefores, allVar, importInfos);
    }
  }

  private processArkIfStmt( 
    stmt: Stmt,
    usedBefores: UseDefined[],
    allVar: UseDefined[]
  ): void {
    if (stmt instanceof ArkIfStmt) {
      const expr = stmt.getConditionExpr();
      const operatorString = expr.getOperator().toString();
      const op1 = expr.getOp1();
      const lineNo = stmt.getOriginPositionInfo().getLineNo();
      const varAll = allVar.find((item) => item.name === op1.toString());
      const defLineNo = varAll?.stmt?.getOriginPositionInfo().getLineNo() ?? -1;
      if (varAll && operatorString.trim() === '!=' && lineNo < defLineNo) {

        usedBefores.push({
          varType: VarType.Var,
          stmt: stmt,
          name: op1.toString() ?? '',
        });
      }

     
      
    }
  }

  private processArkAssignStmt(
    stmt: Stmt,
    scene: Scene,
    usedBefores: UseDefined[],
    allVar: UseDefined[],
    targetFilePath: string,
    importInfos: ImportInfo[]
  ): void {
    if (stmt instanceof ArkAssignStmt) {
      const leftOp = stmt.getLeftOp();
      const rightOp = stmt.getRightOp();
      // 不解析this
      if (leftOp.toString().startsWith('this')) {
        return;
      }
      const rightOpType = rightOp.getType() as Scene_base;
      if (
        rightOpType?.classSignature &&
        rightOpType.classSignature instanceof ClassSignature
      ) {
        const arkClass = scene.getClass(rightOpType.classSignature);
        this.processExcClass(arkClass, usedBefores, targetFilePath, leftOp);
      }

      // 处理右操作符
      const leftStmt = (leftOp as Scene_base).declaringStmt;
      if (leftStmt) {
        //处理左操作符
        this.handleLeftOp(stmt, leftOp, usedBefores, allVar, importInfos);
        const usedBeforeTow = this.handleRightOp(
          stmt,
          rightOp,
          scene,
          usedBefores,
          importInfos,
          allVar
        );
        usedBeforeTow.forEach((usedBefore) => {
        if (
          usedBefore.name !== '' &&
          !usedBefore.name.startsWith('%')
        ) {
          usedBefores.push(usedBefore);
        }
      });}
    }
  }

  private processExcClass(
    arkClass: ArkClass | null,
    usedBefores: UseDefined[],
    targetFilePath: string,
    leftOp: Value
  ): void {
    if (arkClass && arkClass.getName().startsWith('%')) {
      if (arkClass as unknown as { staticFields: Map<string, ArkField> }) {
        const staticFields: Map<string, ArkField> = (
          arkClass as unknown as { staticFields: Map<string, ArkField> }
        ).staticFields;
        this.processExcField(
          staticFields,
          usedBefores,
          targetFilePath,
          arkClass
        );
      }
      //处理静态代码块内数据static
      const method_q = arkClass.getMethodWithName('%statBlock0'); //天坑getMethods获取不到 %statBlock0 函数
      if (method_q) {
        const metName = method_q.getName() ?? '';
        const stmtss = method_q.getBody()?.getCfg().getStmts() ?? [];
        this.execStmts(stmtss, metName, usedBefores, targetFilePath, leftOp);
      }
    }
  }

  private execStmts(
    stmtss: Stmt[],
    metName: string,
    usedBefores: UseDefined[],
    targetFilePath: string,
    leftOp: Value
  ): void {
    for (const statement of stmtss) {
      if (
        metName.startsWith('%statBlock') &&
        statement instanceof ArkAssignStmt
      ) {
        const leftOpp = statement.getLeftOp();
        this.execPushStmts(
          leftOpp,
          statement,
          usedBefores,
          targetFilePath,
          leftOp
        );
      }
    }
  }

  private execPushStmts(
    leftOpp: Value,
    statement: Stmt,
    usedBefores: UseDefined[],
    targetFilePath: string,
    leftOp: Value
  ): void {
    if (leftOpp instanceof ArkInstanceFieldRef) {
      const base = leftOpp.getBase();
      const baseName = base.getName() ?? '';
      const leftName = leftOp.toString(); // const C6=class 。。。。。。
      if (baseName === leftName) {
        const posionLineNo =
        statement?.getOriginPositionInfo().getLineNo() ?? -1;
        const posionColNo =
        statement?.getOriginPositionInfo().getColNo() ?? -1;
        const originalText = statement.getOriginalText() ?? '';
        const posion = this.getAccuratePosition(originalText, baseName); //获取具体位置
        usedBefores.push({
          varType: VarType.Class,
          name: baseName,
          filePath: targetFilePath,
          posion: [
            posionLineNo + posion.line - 1,
            posionColNo + posion.col - 1,
          ],
        });
      }
    }
  }

  private processExcField(
    staticFields: Map<string, ArkField>,
    usedBefores: UseDefined[],
    targetFilePath: string,
    arkClass: ArkClass
  ): void {
    for (const [key, value] of staticFields) {
      const initStmt = value.getInitializer();
      for (const stmt of initStmt) {
        this.pushExcField(
          stmt,
          arkClass,
          usedBefores,
          targetFilePath
        );
      }
    }
  }

private pushExcField(
  stmt: Stmt, 
  arkClass:ArkClass, 
  usedBefores: UseDefined[],
  targetFilePath: string
): void {
  if (stmt instanceof ArkAssignStmt) {
    const rightOPTyp = stmt.getRightOp().getType() as Scene_base;
    const classSignature = arkClass.getSignature();
    if (
      rightOPTyp &&
      rightOPTyp.classSignature &&
      classSignature === rightOPTyp.classSignature
    ) {
      const posionLineNo =
        stmt?.getOriginPositionInfo().getLineNo() ?? -1;
      const posionColNo = stmt?.getOriginPositionInfo().getColNo() ?? -1;
      const originalText = stmt.getOriginalText() ?? '';
      const nameClass = stmt.getRightOp().toString();
      const posion = this.getAccuratePosition(originalText, nameClass); //获取具体位置
      usedBefores.push({
        varType: VarType.Class,
        name: nameClass,
        filePath: targetFilePath,
        posion: [
          posionLineNo + posion.line - 1,
          posionColNo + posion.col - 1,
        ],
      });
    }
  }
}

  private processInvokeStmt(
    stmt: Stmt,
    scene: Scene,
    usedBefores: UseDefined[],
    allVar: UseDefined[],
    importInfos: ImportInfo[]
  ): void {
    if (stmt instanceof ArkInvokeStmt) {
      const line = stmt.getOriginPositionInfo().getLineNo();
      const invokeExpr = stmt.getInvokeExpr();
      const arkMethod = scene.getMethod(invokeExpr.getMethodSignature());
      const baseClass = (invokeExpr as unknown as {base: Local})?.base;
      if (baseClass && !baseClass.getDeclaringStmt()) {
        return;
      }
      this.processInvokeStmtInside(invokeExpr, stmt, importInfos, arkMethod, line, usedBefores);
      const parameters = stmt.getInvokeExpr().getArgs();
      this.processParams(stmt, parameters, usedBefores, allVar, line);
    }
  }
  
  private processInvokeStmtInside(
    invokeExpr: AbstractInvokeExpr,
    stmt: Stmt,
    importInfos: ImportInfo[],
    arkMethod: ArkMethod | null,
    line: number,
    usedBefores: UseDefined[]
  ): void {
    const submethodName = invokeExpr.getMethodSignature().getMethodSubSignature()?.getMethodName();
    const linkCode = stmt?.getOriginalText() ?? '';
    const linkFirst = this.extractFunctionName(linkCode).replace('(', '');
    const methodName = arkMethod?.getName() ?? '-1-1';
    const result = importInfos.find((item) => {
      const name = item.getImportClauseName();
      return name === methodName || name === linkFirst || name === submethodName;
    });
    const methodClass = arkMethod?.getDeclaringArkClass()?.getSignature();
    const thisClass = stmt
      .getCfg()
      ?.getDeclaringMethod()
      ?.getDeclaringArkClass()
      ?.getSignature();
    const BtoB = methodClass?.getClassName() === '%dflt' || methodClass === thisClass;
    const methodLine = arkMethod?.getLine() ?? -1;
    
    //新增加函数内定义函数情况
    const infunc = (methodName.startsWith('%') && methodName.includes('$'));
    if (this.isProcessInvokeStmtInsideMethod(methodName, line, methodLine, linkFirst, result, BtoB, infunc)) {
      usedBefores.push({
        varType: VarType.Method,
        stmt: stmt,
        name: infunc ? this.extractBetween(methodName, '%', '$') : methodName,
        infunc: true,
      });
    } else if ((submethodName && submethodName !== 'constructor') && (result && result.getOriginTsPosition().getLineNo() > line)) {
      usedBefores.push({
        varType: VarType.Import,
        stmt: stmt,
        name: submethodName,
        infunc: true,
      });

    }
  }

  private isProcessInvokeStmtInsideMethod(
    methodName: string,
    line: number,
    methodLine: number,
    linkFirst: string,
    result: ImportInfo | undefined,
    BtoB: boolean,
    infunc: boolean
  ): boolean {
    return (!methodName.startsWith('%') || infunc) &&
    (!linkFirst || ( BtoB && methodLine > line && !result));
  }

  private processAbstractInvokeExpr( stmt: Stmt,
    abstractExpr: AbstractInvokeExpr | ArkNewExpr,
    scene: Scene,
    usedBefores: UseDefined[],
    allVar: UseDefined[],
    importInfos: ImportInfo[]): void {
     if (abstractExpr instanceof AbstractInvokeExpr) {
        this.processAbstractInvokeExprinside(stmt, abstractExpr, scene, usedBefores, allVar, importInfos);
      } else if (abstractExpr instanceof ArkNewExpr) {
        this.processArkNewExpr(stmt, abstractExpr, importInfos, usedBefores, scene);
      }
      }
      private processAbstractInvokeExprinside(
        stmt: Stmt,
        abstractExpr: AbstractInvokeExpr,
        scene: Scene,
        usedBefores: UseDefined[],
        allVar: UseDefined[],
        importInfos: ImportInfo[]
      ):void {
        const line = stmt.getOriginPositionInfo().getLineNo();
        const methodSignature = abstractExpr.getMethodSignature();
        const submethodName = methodSignature.getMethodSubSignature()?.getMethodName();
        const arkMethod = scene.getMethod(methodSignature);
        const linkCode = stmt?.getOriginalText() ?? '';
        const linkFirst = this.extractFunctionName(linkCode);
        const methodName = arkMethod?.getName() ?? '-1-1';
        const result = importInfos.find((item) => {
          const name = item.getImportClauseName();
          return name === methodName || name === linkFirst || name === submethodName;
        });
        const methodClass = arkMethod?.getDeclaringArkClass()?.getSignature();
        const thisClass = stmt
          .getCfg()
          ?.getDeclaringMethod()
          ?.getDeclaringArkClass()
          ?.getSignature();
        const BtoB = methodClass === thisClass;
        const methodLine = arkMethod?.getLine() ?? -1;
        //新增加函数内定义函数情况
        const infunc = (methodName.startsWith('%') && methodName.includes('$'));
        if (
          this.isProcessInvokeStmtInsideMethod(methodName, line, methodLine, linkFirst, result, BtoB, infunc)
        ) {
          usedBefores.push({
            varType: VarType.Method,
            stmt: stmt,
            name: infunc ? this.extractBetween(methodName, '%', '$') : methodName,
            infunc: true,
          });
        } else if ((submethodName && submethodName !== 'constructor') && (result && result.getOriginTsPosition().getLineNo() > line)) {
          usedBefores.push({
            varType: VarType.Import,
            stmt: stmt,
            name: linkFirst ? linkFirst : submethodName
          });
        }
        const parameters = abstractExpr.getArgs();
        this.processParams(stmt, parameters, usedBefores, allVar, line);
      }

      private processArkNewExpr(stmt: Stmt, abstractExpr: ArkNewExpr, importInfos: ImportInfo[], usedBefores: UseDefined[],
        scene: Scene
      ): void {
        const lineNo = stmt.getOriginPositionInfo().getLineNo() ?? -1;
        const classSignature = abstractExpr.getClassType().getClassSignature();
        const className = classSignature.getClassName();
        const targetClass = scene.getClass(classSignature);
        const targetdecLine = targetClass?.getLine() ?? -1;
        const result = importInfos.find((item) => {
          const name = item.getImportClauseName();
          return name === className;
        });
        const importLineNo = result?.getOriginTsPosition().getLineNo() ?? -1;
        if (!(className.startsWith('%') || className === 'ObjectConstructor') && (lineNo < importLineNo || lineNo < targetdecLine)) {
          //添加到结果集
          usedBefores.push({
            varType: VarType.Class,
            stmt: stmt,
            name: className
          });
        } 
      }
  
//截取字符串片段
  private extractBetween(str: string, startChar: string, endChar: string): string {
    const start = str.indexOf(startChar);
    const end = str.indexOf(endChar);

    if (start !== -1 && end !== -1 && end > start) {
      return str.substring(start + 1, end);
    }

    return '';
  }
  private processParams(
    stmt: Stmt,
    parameters: Value[],
    usedBefores: UseDefined[],
    allVar: UseDefined[],
    line: number
  ): void {
    for (const param of parameters) {
      const paramName = param.toString();
      const varAll = allVar.find((item) => item.name === paramName);
      if (varAll) {
        const lineP = varAll.stmt?.getOriginPositionInfo().getLineNo() ?? -1;
        this.pushParam(lineP, line, stmt, paramName, usedBefores);
      }
    }
  }

  private pushParam(
    lineP: number,
    line: number,
    stmt: Stmt,
    paramName: string,
    usedBefores: UseDefined[]
  ): void {
    if (lineP > line) {
      const invokeCode = stmt?.getOriginalText() ?? '';
      let col = stmt?.getOriginPositionInfo()?.getColNo() ?? -1;
      const posion = this.getAccuratePosition(invokeCode, paramName);
      let colNo = posion.col;
      if (!invokeCode.startsWith(' ')) {
        colNo = col + colNo;
      }
      usedBefores.push({
        varType: VarType.Param,
        stmt: stmt,
        posion: [line, colNo],
        name: paramName ?? '',
      });
    }
  }

  private processLocalType(
    localAliasTypeMapMap:
      | Map<string, [AliasType, ArkAliasTypeDefineStmt]>
      | undefined,
    typeName: string,
    usedBefores: UseDefined[],
    globalAliasTypeMapMap:
      | Map<string, [AliasType, ArkAliasTypeDefineStmt]>
      | undefined,
    importInfos: ImportInfo[],
    targetClass: ArkClass,
    declareStmt: Stmt
  ): void {
    if (localAliasTypeMapMap && localAliasTypeMapMap.has(typeName)) {
      const aliasTypeDeclaration = localAliasTypeMapMap.get(typeName);
      if (aliasTypeDeclaration) {
        const aliasTypeDecl = aliasTypeDeclaration[1];
        const lineNo = aliasTypeDecl.getOriginPositionInfo().getLineNo();
        const declareLine = declareStmt.getOriginPositionInfo().getLineNo();
        if (declareLine < lineNo) {
          usedBefores.push({
            varType: VarType.TypeDef,
            stmt: declareStmt,
            name: typeName ?? '',
          });
        }
      }
    } else if (globalAliasTypeMapMap && globalAliasTypeMapMap.has(typeName)) {
      const globalTypeDeclaration = globalAliasTypeMapMap.get(typeName);
      this.pushGlobleMap(
        globalTypeDeclaration,
        declareStmt,
        usedBefores,
        targetClass,
        typeName
      );
    } else if (
      importInfos &&
      importInfos.find((item) => item.getImportClauseName() === typeName)
    ) {
      const lineNo =
        importInfos
          .find((item) => item.getImportClauseName() === typeName)
          ?.getOriginTsPosition()
          .getLineNo() ?? -1;
      const declareLine = declareStmt.getOriginPositionInfo().getLineNo();
      if (declareLine < lineNo) {
        usedBefores.push({
          varType: VarType.TypeDef,
          arkClass: targetClass,
          name: typeName ?? '',
        });
      }
    }
  }

  private processSticMethod(
    targetClass: ArkClass,
    usedBefores: UseDefined[],
    staticmethod: ArkMethod | null,
    scene: Scene
  ): void {
    if (staticmethod) {
      const stmts = staticmethod.getBody()?.getCfg().getStmts() ?? [];
      for (const st of stmts) {
        this.execSticMethod(
          usedBefores,
          scene,
          st,
          targetClass
        );
      }
    }
  }
  
  private execSticMethod(
     usedBefores: UseDefined[],
     scene: Scene,
     st: Stmt, 
     targetClass: ArkClass
  ): void {
    if (st instanceof ArkInvokeStmt) {
      const rtType = st.getInvokeExpr() as unknown as {
        base: { type: ClassType };
      };
      if (rtType && rtType.base) {
      const classType = rtType.base.type;
      this.pushSticMethod(
        classType,
        usedBefores,
        scene,
        st,
        targetClass
      );
      }   
    }
  }

  private pushSticMethod(
     classType: ClassType,
     usedBefores: UseDefined[],
     scene: Scene,
     st: Stmt, 
     targetClass: ArkClass
    ): void {
    if (classType instanceof ClassType && classType.getClassSignature()) {
      const useClass = scene.getClass(classType.getClassSignature());
      const line = useClass?.getLine() ?? -1;
      const lineNo = st.getOriginPositionInfo().getLineNo() ?? -1;
      if (useClass && lineNo < line) {
        //添加到结果集
        usedBefores.push({
          varType: VarType.Class,
          arkClass: targetClass,
          name: useClass?.getName() ?? '',
        });
      }
    }

  }
  private processExport(
    exports: ExportInfo[],
    usedBefores: UseDefined[],
    importInfos: ImportInfo[]
  ): void {
    for (const exp of exports) {
      const line = exp.getOriginTsPosition().getLineNo();
      const result = importInfos.find((item) => {
        const name = item.getImportClauseName();
        return name === exp.getExportClauseName();});
        const arkExport = exp.getArkExport();
      const sourLine = this.getExportSourceLine(arkExport);      
      if (sourLine > line) {
        usedBefores.push({
          varType: VarType.Export,
          exportinfo: exp,
          name: exp.getExportClauseName(),
        });
      } else if (result && result.getOriginTsPosition().getLineNo() > line) {
        usedBefores.push({
          varType: VarType.Import,
          exportinfo: exp,
          name: exp.getExportClauseName(),
        });

      }
    }
  }
private getExportSourceLine(arkExport: ArkExport | undefined | null): number {

  const sceneBase = (arkExport as Scene_base);
  if (arkExport instanceof ArkMethod || arkExport instanceof ArkClass) {
    return arkExport.getLine() ?? -1;
  } else if (sceneBase) {
    return sceneBase?.declaringStmt?.getOriginPositionInfo()?.getLineNo() ?? -1;
  }
  return -1;
}

  private processFileUsedIssues(filerUsed: UseDefined[]): void {
    for (const info of filerUsed) {
      if (info.arkClass) {
        this.addIssueReportOther(
          info.name,
          info.arkClass.getCode() ?? '',
          info.arkClass.getDeclaringArkFile(),
          [info.arkClass.getLine(), info.arkClass.getColumn()]
        );
      } else if (info.exportinfo) {
        const position = info.exportinfo.getOriginTsPosition();
        this.addIssueReportOther(
          info.name,
          info.exportinfo.getTsSourceCode() ?? '',
          info.exportinfo.getDeclaringArkFile(),
          [position.getLineNo(), position.getColNo()]
        );
      } else if (info.stmt && info.varType === VarType.Param) {
        //方便缩小检查范围
        this.addIssueReport(info.stmt, info.name, true);
      } else if (info.stmt) {
        this.addIssueReport(info.stmt, info.name, false);
      } else if (info.posion) {
        this.addIssueReportOther(
          info.name,
          '',
          info?.filePath ?? '',
          info.posion
        );
      }
    }
  }

  private processDefaultMethod(
    defaultMethod: ArkMethod | null,
    allVar: UseDefined[]
  ) {
    if (defaultMethod) {
      const vstmts = defaultMethod.getBody()?.getCfg().getStmts() ?? [];
      for (const stmt of vstmts) {
       this.pushAllVar(stmt, allVar);
      }
    }
  }

  private isInImport(importInfos: ImportInfo[], indexString: string): boolean {
    const result = importInfos.find((item) => {
      const name = item.getImportClauseName();
      return name === indexString; 
    });
    return !!result;
  }

  private pushAllVar(stmt: Stmt, allVar: UseDefined[]): void {
    if (stmt instanceof ArkAssignStmt) {
      const varName = stmt.getLeftOp().toString();
      const originalText = stmt.getOriginalText() ?? '';
      const miniOrinalText = originalText.replace(/\s+/g, ' '); //去除多余空格
      const startVar = miniOrinalText.split('=')[0].replace('}', '').trim(); //获取变量名称
      if (!varName.endsWith('this') && !varName.startsWith('%') && this.isVariableDeclaration(originalText) && 
      (startVar.endsWith(varName) || miniOrinalText.includes(','))) {
        allVar.push({
          varType: VarType.Var,
          stmt: stmt,
          name: varName,
        });
      }
    }
  }

  private isVariableDeclaration(varName: string): boolean {
    return (
      varName.startsWith('var') ||
      varName.startsWith('let') ||
      varName.startsWith('const') ||
      varName.startsWith('export')
    );
  }
  

  private pushGlobleMap(
    globalTypeDeclaration: [AliasType, ArkAliasTypeDefineStmt] | undefined,
    declareStmt: Stmt,
    usedBefores: UseDefined[],
    targetClass: ArkClass,
    typeName: string
  ): void {
    if (globalTypeDeclaration) {
      const aliasTypeDecl = globalTypeDeclaration[1];
      const lineNo = aliasTypeDecl.getOriginPositionInfo().getLineNo();
      const declareLine = declareStmt.getOriginPositionInfo().getLineNo();
      if (declareLine < lineNo) {
        usedBefores.push({
          varType: VarType.TypeDef,
          arkClass: targetClass,
          name: typeName ?? '',
        });
      }
    }
  }
}
