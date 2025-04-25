/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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

import { AbstractFieldRef, ArkAssignStmt, ArkFile, ArkIfStmt, ArkInvokeStmt, ArkMethod, ArkNamespace, ArkNewExpr,
  ArkNormalBinopExpr, ArkStaticInvokeExpr, ArkUnopExpr, ClassSignature, ClassType, DEFAULT_ARK_CLASS_NAME,
  FunctionType, LocalSignature, MethodSignature, NamespaceSignature, Scene, Signature, TEMP_LOCAL_PREFIX, Value,
  transfer2UnixPath } from 'arkanalyzer';
import { ArkClass, ClassCategory } from 'arkanalyzer/lib/core/model/ArkClass';
import { ExportSignature } from 'arkanalyzer/lib/core/model/ArkExport';
import { Local } from 'arkanalyzer/lib/core/base/Local';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import path from 'path';
import { FileUtils, WriteFileMode } from '../utils/common/FileUtils';

const OUTPUT_DIR_PATH = './ModuleChains';
const FILE_NAME_CHAINS_JSON = 'ModuleChains.json';
const FILE_NAME_FILE_ID_MAP = 'FileIdMap.json';
const FILE_NAME_CHAINS_TXT = 'ModuleChains.txt';
const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'BuildModuleChains');

type ModuleSignature = ExportSignature | string;
const gFinishScanMap = new Map<ModuleSignature, ModuleSignature[]>();
const gNodeMap: Map<string, { nodeInfo: NodeInfo, nextNodes: string[] }> = new Map();
const gModuleIdMap: Map<ModuleSignature, string> = new Map();
const repeatFilePath: string[] = [];
let gOutPutDirPath: string = OUTPUT_DIR_PATH;
let gIsSkipSdk = true;

let gOutStorage = '';
let gOutNum = 0;

interface NodeInfo {
  filePath: string;
  name: string;
  type: number;
  line: number;
}

export function buildModuleChains(scene: Scene, arkFiles: ArkFile[], outputDirPath: string): boolean {
  let fileNameFlag = '';
  if (outputDirPath.length !== 0) {
    gOutPutDirPath = outputDirPath;
  }
  if (arkFiles.length === 0) {
    fileNameFlag = 'allFiles';
    arkFiles = scene.getFiles();
  } else {
    fileNameFlag = arkFiles[0].getName();
  }
  let isOutput = false;
  for (const arkFile of arkFiles) {
    const busyArray = new Array<ModuleSignature>();
    fileProcess(arkFile, busyArray);
    // isOutput = genResultForChains(arkFile);
  }
  logger.debug('Scan completed, start to write file...');
  isOutput = genResultForJson(scene, fileNameFlag);
  clearGlobalMem();
  return isOutput;
}

function clearGlobalMem() {
  gFinishScanMap.clear();
  gNodeMap.clear();
  gModuleIdMap.clear();
  repeatFilePath.length = 0;
  gOutStorage = '';
  gOutNum = 0;
}

function genResultForJson(scene: Scene, fileName: string): boolean {
  for (const [module] of gFinishScanMap) {
    if (typeof module === 'string') {
      const uniqueId = genUniqueId();
      genJsonNode(scene, module, uniqueId);
    }
  }
  return outputNodeList(fileName.replace(/[\\/]/g, '_'));
}

function genUniqueId(): string {
  return Math.random().toString(36).substring(2);
}

function genJsonNode(scene: Scene, module: ModuleSignature, uniqueId: string) {
  const nodeInfo = genNodeInfo(scene, module);
  if (nodeInfo) {
    gNodeMap.set(uniqueId, { nodeInfo: nodeInfo, nextNodes: [] });
    gModuleIdMap.set(module, uniqueId);
  } else {
    logger.warn(`create nodeInfo failed!`);
  }

  let nextNodeList = gFinishScanMap.get(module);
  if (!nextNodeList) {
    return;
  }

  for (const nextNode of nextNodeList) {
    let nextUniqueId = gModuleIdMap.get(nextNode);
    if (nextUniqueId) {
      gNodeMap.get(uniqueId)?.nextNodes.push(nextUniqueId);
    } else {
      nextUniqueId = genUniqueId();
      gNodeMap.get(uniqueId)?.nextNodes.push(nextUniqueId);
      genJsonNode(scene, nextNode, nextUniqueId);
    }
  }
}

function classTypeToString(scene: Scene, classSign: ClassSignature): string {
  const type = scene.getClass(classSign)?.getCategory();
  switch (type) {
    case ClassCategory.CLASS:
      return 'class';
    case ClassCategory.STRUCT:
      return 'struct';
    case ClassCategory.INTERFACE:
      return 'interface';
    case ClassCategory.ENUM:
      return 'enum';
    case ClassCategory.TYPE_LITERAL:
      return 'literal';
    case ClassCategory.OBJECT:
      return 'object';
    default:
      return '';
  }
}

enum NodeType {
  FILE = 0,
  NAMESPACE,
  CLASS,
  STRUCT,
  INTERFACE,
  ENUM,
  TYPE_LITERAL,
  OBJECT,
  FUNCTION,
  VARIABLE
}

function genNodeInfo(scene: Scene, module: ModuleSignature): NodeInfo | null {
  let nodeInfo: NodeInfo | null = null;
  if (module instanceof ClassSignature) {
    const type = scene.getClass(module)?.getCategory();
    nodeInfo = {
      filePath: module.getDeclaringFileSignature().getFileName(),
      name: module.getClassName(),
      // 底座ArkClass的枚举值差2
      type: (type !== undefined) ? type + 2 : -1,
      line: -1
    };
  } else if (module instanceof MethodSignature) {
    let className = module.getDeclaringClassSignature()?.getClassName();
    if (className === DEFAULT_ARK_CLASS_NAME) {
      className = module.getDeclaringClassSignature().getDeclaringNamespaceSignature()?.getNamespaceName() ?? ''
    }
    let methodName = module.getMethodSubSignature().getMethodName();
    const methodLine = scene.getMethod(module)?.getLine();
    let curLine: number = -1;
    if (methodLine) {
      curLine = methodLine;
    }
    methodName = className.length > 0 ? `${className}.${methodName}` : methodName;
    nodeInfo = {
      filePath: module.getDeclaringClassSignature()?.getDeclaringFileSignature().getFileName(),
      name: methodName,
      type: NodeType.FUNCTION,
      line: curLine
    };
  } else if (module instanceof NamespaceSignature) {
    nodeInfo = {
      filePath: module.getDeclaringFileSignature().getFileName(),
      name: module.getNamespaceName(),
      type: NodeType.NAMESPACE,
      line: -1
    };
  } else if (module instanceof LocalSignature) {
    const fileSign = module.getDeclaringMethodSignature().getDeclaringClassSignature().getDeclaringFileSignature();
    const methodLine = scene.getMethod(module.getDeclaringMethodSignature())?.getLine();
    let curLine: number = -1;
    if (methodLine) {
      curLine = methodLine;
    }
    nodeInfo = {
      filePath: fileSign.getFileName() ?? '',
      name: module.getName(),
      type: NodeType.VARIABLE,
      line: curLine
    };
  } else if (typeof module === 'string') {
    nodeInfo = {
      filePath: module,
      name: path.basename(module),
      type: NodeType.FILE,
      line: -1
    };
  }
  return nodeInfo;
}

function genResultForChains(arkFile: ArkFile): boolean {
  for (const [module] of gFinishScanMap) {
    if (typeof (module) === 'string' && module.includes(arkFile.getFileSignature().getFileName().replace(/\//g, '\\'))) {
      genChain(module);
    }
  }
  if (gOutStorage.length > 0 && outputStorage()) {
    logger.info(gOutStorage.length + ' chains have been written to the file.');
    return true;
  }
  return false;
}

function genChain(module: ModuleSignature, headChain: string = '') {
  const nextNodes = gFinishScanMap.get(module);
  if (nextNodes) {
    for (const nextNode of nextNodes) {
      genChain(nextNode, headChain + module.toString().replace(`/${DEFAULT_ARK_CLASS_NAME}./g`, '') + '\n>>');
    }
  } else {
    gOutStorage += headChain + module.toString().replace(`/${DEFAULT_ARK_CLASS_NAME}./g`, '') + '\n';
    gOutNum++;
    if (gOutNum >= 1000 && outputStorage()) {
      gOutStorage = '';
      gOutNum = 0;
    }
  }
}

function fileProcess(arkFile: ArkFile, busyArray: Array<ModuleSignature>) {
  const filePath = path.join('@' + arkFile.getProjectName(), transfer2UnixPath(arkFile.getName()));
  if (!busyArray.includes(filePath) && !repeatFilePath.includes(filePath)) {
    repeatFilePath.push(filePath);
    busyArray.push(filePath);
    const importList = arkFile.getImportInfos();
    for (const importModule of importList) {
      const moduleSign = importModule.getLazyExportInfo()?.getArkExport()?.getSignature();
      if (!moduleSign) {
        continue;
      }
      // 添加文件间依赖
      const importFile = importModule.getLazyExportInfo()?.getDeclaringArkFile();
      if (importFile) {
        fileProcess(importFile, busyArray);
      }
      moduleDeeplyProcess(moduleSign, busyArray, arkFile.getScene());
    }
    if (busyArray.length > 1 && typeof (busyArray[busyArray.length - 1]) === 'string') {
      addLastNodeToMap(busyArray);
    }
    // 查找全局调用
    // const currentFileName = busyArray[busyArray.length - 1].toString().replace('@' + arkFile.getProjectName(), '');
    // const fileSignature = new FileSignature(arkFile.getProjectName(), currentFileName);
    findGlobalDef(arkFile.getDefaultClass().getDefaultArkMethod(), busyArray);
    busyArray.pop();
  }
}

function findGlobalDef(dfltMethod: ArkMethod | null, busyArray: Array<ModuleSignature>) {
  const stmts = dfltMethod?.getBody()?.getCfg().getStmts();
  for (const stmt of stmts ?? []) {
    if (stmt instanceof ArkInvokeStmt) {
      busyArray.push(stmt.getInvokeExpr().getMethodSignature());
      addLastNodeToMap(busyArray);
      busyArray.pop();
    }
  }
}

function moduleDeeplyProcess(moduleSign: Signature, busyArray: Array<ModuleSignature>, scene: Scene ) {
  if (moduleSign instanceof ClassSignature) {
    classProcess(scene.getClass(moduleSign), busyArray);
  } else if (moduleSign instanceof MethodSignature) {
    methodProcess(scene.getMethod(moduleSign), busyArray);
  } else if (moduleSign instanceof NamespaceSignature) {
    namespaceProcess(scene.getNamespace(moduleSign), busyArray);
  } else if (moduleSign instanceof LocalSignature) {
    busyArray.push(moduleSign);
    addLastNodeToMap(busyArray);
    busyArray.pop();
  }
}

function namespaceProcess(ns: ArkNamespace | null, busyArray: Array<ModuleSignature>) {
  if (!ns || busyArray.includes(ns.getSignature())) {
    return;
  }
  const nsSign = ns.getSignature();
  busyArray.push(nsSign);
  addLastNodeToMap(busyArray);
  // 遍历过的节点不再遍历
  if (gFinishScanMap.has(nsSign)) {
    busyArray.pop();
    return;
  }
  // 处理sdk跳过逻辑
  if (gIsSkipSdk && nsSign.getDeclaringFileSignature().getProjectName() !== ns.getDeclaringArkFile().getScene().getProjectName()) {
    busyArray.pop();
    return;
  }
  // 处理当前层ns的类
  for (const arkClass of ns.getClasses()) {
    classProcess(arkClass, busyArray);
  }
  // 递归处理嵌套ns的类
  for (const innerNs of ns.getNamespaces()) {
    namespaceProcess(innerNs, busyArray);
  }
  busyArray.pop();
}

function classProcess(arkClass: ArkClass | null, busyArray: Array<ModuleSignature>) {
  if (!arkClass || busyArray.includes(arkClass.getSignature())) {
    return;
  }
  const arkClassSign = arkClass.getSignature();
  busyArray.push(arkClassSign);
  if (!arkClass.isAnonymousClass()) {
    addLastNodeToMap(busyArray);
  }
  
  // 遍历过的节点不再遍历
  if (gFinishScanMap.has(arkClassSign)) {
    busyArray.pop();
    return;
  }
  // 处理sdk跳过逻辑
  if (gIsSkipSdk && arkClassSign.getDeclaringFileSignature().getProjectName() !== arkClass.getDeclaringArkFile().getScene().getProjectName()) {
    busyArray.pop();
    return;
  }
  // 1、继承类处理
  superClassProcess(arkClass, busyArray);
  // 2、成员变量处理
  arkFieldProcess(arkClass, busyArray);
  // 3、方法内处理
  for (const arkMethod of arkClass.getMethods()) {
    methodProcess(arkMethod, busyArray);
  }
  busyArray.pop();
}

function methodProcess(arkMethod: ArkMethod | null | undefined, busyArray: Array<ModuleSignature>) {
  if (!arkMethod || busyArray.includes(arkMethod.getSignature())) {
    return;
  }
  const arkMethodSign = arkMethod.getSignature();
  busyArray.push(arkMethodSign);
  if (!arkMethod.isAnonymousMethod()) {
    addLastNodeToMap(busyArray);
  }
  // 遍历过的节点不再遍历
  if (gFinishScanMap.has(arkMethodSign)) {
    busyArray.pop();
    return;
  }
  // 处理sdk跳过逻辑
  if (gIsSkipSdk && arkMethod.getDeclaringArkFile().getProjectName() !== arkMethod.getDeclaringArkFile().getScene().getProjectName()) {
    busyArray.pop();
    return;
  }
  const stmts = arkMethod.getBody()?.getCfg()?.getStmts() ?? [];
  const arkFile = arkMethod.getDeclaringArkFile();
  for (const stmt of stmts) {
    if (stmt instanceof ArkInvokeStmt && stmt.getInvokeExpr() instanceof ArkStaticInvokeExpr) {
      // 判断static调用是否为import, 仅考虑静态调用，示例调用场景在new stmt中处理
      staticExprProcess(stmt.getInvokeExpr() as ArkStaticInvokeExpr, arkFile, busyArray);
    } else if (stmt instanceof ArkAssignStmt) {
      // 判断右值中1、new class; 2、Local; 3、一元运算；4、二元运算；5、实例调用/实例字段 是否为import导入的模块
      rightOpProcess(stmt.getRightOp(), arkFile, busyArray);
    } else if (stmt instanceof ArkIfStmt) {
      // 判断ifStmt中变量或常量是否为import导入的模块
      ifStmtProcess(stmt, arkFile, busyArray);
    }
  }
  busyArray.pop();
}

function staticExprProcess(invokeExpr: ArkStaticInvokeExpr, arkFile: ArkFile, busyArray: Array<ModuleSignature>) {
  const methodSignature = invokeExpr.getMethodSignature();
  const classSignature = methodSignature.getDeclaringClassSignature();
  const methodName = methodSignature.getMethodSubSignature().getMethodName();
  let className = classSignature.getClassName();
  if (className === DEFAULT_ARK_CLASS_NAME) {
    className = classSignature.getDeclaringNamespaceSignature()?.getNamespaceName() ?? '';
  }
  const fileSign = classSignature.getDeclaringFileSignature();
  let invokeFilePath = arkFile.getScene().getFile(fileSign)?.getFilePath();
  if (invokeFilePath && invokeFilePath === arkFile.getFilePath()) {
    // 本文件的模块，深搜
    methodProcess(arkFile.getScene().getMethod(methodSignature), busyArray);
    return;
  }
  // 导入的模块
  for (const importInfo of arkFile.getImportInfos()) {
    const importName = importInfo.getImportClauseName();
    const typeSign = importInfo.getLazyExportInfo()?.getArkExport()?.getSignature();
    if (typeSign && (methodName === importName || className === importName)) {
      moduleDeeplyProcess(typeSign, busyArray, arkFile.getScene());
    }
  }
}

function ifStmtProcess(stmt: ArkIfStmt, curFile: ArkFile, busyArray: Array<ModuleSignature>) {
  const op1 = stmt.getConditionExpr().getOp1();
  const op2 = stmt.getConditionExpr().getOp2();
  if (op1 instanceof Local) {
    localProcess(op1, curFile, busyArray);
  }
  if (op2 instanceof Local) {
    localProcess(op2, curFile, busyArray);
  }
}

function superClassProcess(arkClass: ArkClass, busyArray: Array<ModuleSignature>) {
  const superName = arkClass.getSuperClass()?.getName();
  if (!superName || busyArray.includes(arkClass.getSuperClass()?.getSignature()!)) {
    return;
  }
  for (const importInfo of arkClass.getDeclaringArkFile().getImportInfos()) {
    const typeSign = importInfo.getLazyExportInfo()?.getArkExport()?.getSignature();
    if (importInfo.getImportClauseName() === superName && typeSign) {
      moduleDeeplyProcess(typeSign, busyArray, arkClass.getDeclaringArkFile().getScene());
    }
  }
}

function arkFieldProcess(arkClass: ArkClass, busyArray: Array<ModuleSignature>) {
  const arkFields = arkClass.getFields();
  for ( const arkField of arkFields) {
    const fieldStmts = arkField.getInitializer();
    for (const stmt of fieldStmts) {
      if (stmt instanceof ArkAssignStmt) {
        rightOpProcess(stmt.getRightOp(), arkClass.getDeclaringArkFile(), busyArray);
      }
    }
  }
}

function rightOpProcess(rightOp: Value, curFile: ArkFile, busyArray: Array<ModuleSignature>) {
  if (rightOp instanceof ArkNewExpr) {
    // 右值为new class场景
    const type = rightOp.getType();
    if (type instanceof ClassType) {
      newExprProcess(type, curFile, busyArray);
    }
  } else if (rightOp instanceof Local) {
    // 右值为Local场景
    localProcess(rightOp, curFile, busyArray);
  } else if (rightOp instanceof ArkUnopExpr) {
    // 右值为一元运算场景
    const ops = rightOp.getUses();
    for (const op of ops) {
      if (op instanceof Local) {
        localProcess(op, curFile, busyArray);
      }
    }
  } else if (rightOp instanceof ArkNormalBinopExpr) {
    // 右值为二元运算场景
    const op1 = rightOp.getOp1();
    const op2 = rightOp.getOp2();
    if (op1 instanceof Local) {
      localProcess(op1, curFile, busyArray);
    }
    if (op2 instanceof Local) {
      localProcess(op2, curFile, busyArray);
    }
  } else if (rightOp instanceof AbstractFieldRef) {
    moduleDeeplyProcess(rightOp.getFieldSignature().getDeclaringSignature(), busyArray, curFile.getScene());
  } else if (rightOp instanceof ArkStaticInvokeExpr) {
    staticExprProcess(rightOp, curFile, busyArray);
  }
}

function newExprProcess(type: ClassType, arkFile: ArkFile, busyArray: Array<ModuleSignature>) {
  const classSign = type.getClassSignature();
  const className = classSign.getClassName();
  const curFilePath = arkFile.getFilePath();
  const classFilePath = arkFile.getScene().getFile(classSign.getDeclaringFileSignature())?.getFilePath();
  if (!curFilePath || !classFilePath) {
    logger.debug('Get curFilePath or classFilePath failed.');
    return;
  }
  if (curFilePath === classFilePath) {
    // 本文件类
    classProcess(arkFile.getClass(classSign), busyArray);
  } else {
    // 非本文件类
    for (const importInfo of arkFile.getImportInfos()) {
      const typeSign = importInfo.getLazyExportInfo()?.getArkExport()?.getSignature();
      if (className === importInfo.getImportClauseName() && typeSign) {
        moduleDeeplyProcess(typeSign, busyArray, arkFile.getScene());
      }
    }
  }
}

function localProcess(rightOp: Local, curFile: ArkFile, busyArray: Array<ModuleSignature>) {
  const type = rightOp.getType();
  // todo: Local变量为方法或者类地址，let a = class1，目前右值type为unknown，走else分支
  if (type instanceof ClassType) {
    if (rightOp.getName().includes(TEMP_LOCAL_PREFIX)) {
      return;
    }
    moduleDeeplyProcess(type.getClassSignature(), busyArray, curFile.getScene());
  } else if (type instanceof FunctionType) {
    moduleDeeplyProcess(type.getMethodSignature(), busyArray, curFile.getScene());
  } else {
    for (const importInfo of curFile.getImportInfos()) {
      const typeSign = importInfo.getLazyExportInfo()?.getArkExport()?.getSignature();
      if (importInfo.getImportClauseName() === rightOp.getName() && typeSign) {
        moduleDeeplyProcess(typeSign, busyArray, curFile.getScene());
        break;
      }
    }
  }
}

function isAnonymous(module: ModuleSignature): boolean {
  return module.toString().includes('%A');
}

function addLastNodeToMap(busyArray: Array<ModuleSignature>) {
  let index = busyArray.length - 2;
  let lastModule = busyArray[index];
  while (isAnonymous(lastModule) && index > 0) {
    index--;
    lastModule = busyArray[index];
  }
  let curModule = busyArray[busyArray.length - 1];
  const storage = gFinishScanMap.get(lastModule);
  if (!storage) {
    gFinishScanMap.set(lastModule, [curModule]);
  } else if (!storage.includes(curModule)) {
    storage.push(curModule);
  }
}

function outputNodeList(fileName: string): boolean {
  // 文件和节点编号映射落盘
  // try {
  //   const fileIdMap = new Map([...gModuleIdMap].filter(([key]) => typeof(key) === 'string')) as Map<string, string>;
  //   FileUtils.writeToFile(path.join(gOutPutDirPath, FILE_NAME_FILE_ID_MAP), JSON.stringify(mapToJson(fileIdMap)));
  // } catch (error) {
  //   logger.error((error as Error).message);
  //   return false;
  // }

  // import链落盘
  try {
    FileUtils.writeToFile(path.join(gOutPutDirPath, fileName + '_' + FILE_NAME_CHAINS_JSON), JSON.stringify(mapToJson(gNodeMap)), WriteFileMode.OVERWRITE);
    return true;
  } catch (error) {
    logger.error((error as Error).message);
    return false;
  }
}

function outputStorage() {
  try {
    FileUtils.writeToFile(path.join(gOutPutDirPath, FILE_NAME_CHAINS_TXT), gOutStorage);
    return true;
  } catch (error) {
    logger.error((error as Error).message);
    return false;
  }
}

function mapToJson(map: Map<string, any>): any {
  const obj: { [key: string]: any } = Object.create(null);
  for (const [key, value] of map) {
    if (value instanceof Map) {
      // 递归转换嵌套的Map
      obj[key] = mapToJson(value);
    } else {
      obj[key] = value;
    }
  }
  return obj;
}