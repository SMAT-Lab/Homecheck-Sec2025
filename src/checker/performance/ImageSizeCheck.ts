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

import { ArkAssignStmt, ArkClass, ArkFile, ArkInstanceFieldRef, ClassType, Constant, Local, MethodSignature, Scene, Stmt, Value, ViewTreeNode } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, Defects, FileUtils, MatcherCallback, Rule } from '../../Index';
import { IssueReport } from '../../model/Defects';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import path from 'path';
import { NumberConstant, StringConstant } from 'arkanalyzer/lib/core/base/Constant';
import { readImageInfo } from '../../utils/checker/ImageUtils';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ImageSizeCheck');
const viewTreeTool: ViewTreeTool = new ViewTreeTool();
const moduleMediaMap: Map<string, string[]> = new Map();
const moduleElementMap: Map<string, string[]> = new Map();
const moduleRawMap: Map<string, string[]> = new Map();
const moduleResMap: Map<string, string[]> = new Map();
const VP_TO_PX_RATIO = 4;

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/image-size-check.md',
    description: 'Set the size of the image source file properly and use the memory resources properly to reduce the application memory occupied by the image.'
};

interface ComponentSize {
    width: number;
    height: number;
}

export class ImageSizeCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly IMAGE: string = 'Image';
    readonly WIDTH: string = 'width';
    readonly HEIGHT: string = 'height';
    readonly SIZE: string = 'size';
    readonly CREATE: string = 'create';
    readonly BACKGROUND_IMAGE = 'backgroundImage';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: undefined,
            callback: this.check
        };
        return [matchBuildCb];
    }

    public check = (scene: Scene): void => {
        if (moduleMediaMap.size === 0 || moduleRawMap.size === 0) {
            this.cacheProjectImages(scene);
        }
        for (let arkFile of scene.getFiles()) {
            for (let clazz of arkFile.getClasses()) {
                this.classProcess(arkFile, clazz);
            }
            for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
                for (let clazz of namespace.getClasses()) {
                    this.classProcess(arkFile, clazz);
                }
            }
        }
    };

    private cacheProjectImages(scene: Scene): void {
        let moduleScope = 'AppScope';
        let mediaDir = path.join(scene.getRealProjectDir(), moduleScope, 'resources', 'base', 'media');
        let elementDir = path.join(scene.getRealProjectDir(), moduleScope, 'resources', 'base', 'element');
        let rawDir = path.join(scene.getRealProjectDir(), moduleScope, 'resources', 'base', 'rawfile');
        let resDir = path.join(scene.getRealProjectDir(), moduleScope, 'resources', 'base', 'resfile');
        moduleMediaMap.set(moduleScope, FileUtils.getAllFiles(mediaDir, []));
        moduleElementMap.set(moduleScope, FileUtils.getAllFiles(elementDir, []));
        moduleRawMap.set(moduleScope, FileUtils.getAllFiles(rawDir, []));
        moduleResMap.set(moduleScope, FileUtils.getAllFiles(resDir, []));
        for (let [key, value] of scene.getModuleSceneMap()) {
            mediaDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'base', 'media');
            elementDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'base', 'element');
            rawDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'base', 'rawfile');
            resDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'base', 'resfile');
            moduleMediaMap.set(key, FileUtils.getAllFiles(mediaDir, []));
            moduleElementMap.set(key, FileUtils.getAllFiles(elementDir, []));
            moduleRawMap.set(key, FileUtils.getAllFiles(rawDir, []));
            moduleResMap.set(key, FileUtils.getAllFiles(resDir, []));
        }
    }

    private classProcess(arkFile: ArkFile, clazz: ArkClass): void {
        if (clazz.hasViewTree() && !viewTreeTool.hasTraverse(clazz)) {
            let viewTreeRoot = clazz.getViewTree()?.getRoot();
            if (viewTreeRoot) {
                this.traverseViewTree(arkFile, viewTreeRoot);
            }
        }
        for (let method of clazz.getMethods()) {
            let viewTreeRoot = method.getViewTree()?.getRoot();
            if (viewTreeRoot) {
                this.traverseViewTree(arkFile, viewTreeRoot);
            }
        }
    }

    private traverseViewTree(arkFile: ArkFile, viewTreeRoot: ViewTreeNode): void {
        if (viewTreeRoot.name === this.IMAGE) {
            let size = this.getComponentSizeByWidthAndHeight(arkFile, viewTreeRoot);
            if (size.width === 0 || size.height === 0) {
                return;
            }
            let createStmt = viewTreeRoot.attributes.get(this.CREATE);
            if (!createStmt) {
                return;
            }
            this.calculateImageSize(arkFile, size, createStmt, this.IMAGE);
        }
        if (viewTreeRoot.attributes.has(this.BACKGROUND_IMAGE)) {
            let size = this.getComponentSizeByWidthAndHeight(arkFile, viewTreeRoot);
            if (size.width !== 0 && size.height !== 0) {
                let backgroundStmt = viewTreeRoot.attributes.get(this.BACKGROUND_IMAGE);
                if (backgroundStmt) {
                    this.calculateImageSize(arkFile, size, backgroundStmt, this.BACKGROUND_IMAGE);
                }
            }
        }
        if (viewTreeRoot.children.length === 0) {
            return;
        }
        for (let child of viewTreeRoot.children) {
            if (viewTreeTool.hasTraverse(viewTreeRoot)) {
                continue;
            }
            this.traverseViewTree(arkFile, child);
        }
    }

    private calculateImageSize(arkFile: ArkFile, size: ComponentSize,
        createStmt: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]],
        keyword: string): void {
        let imagePath = this.getImageResourcePath(arkFile, createStmt);
        if (!imagePath) {
            return;
        }
        const imageInfo = readImageInfo(imagePath);
        if (!imageInfo) {
            return;
        }
        let componentSize = size.width * size.height;
        let imageSize = imageInfo.width * imageInfo.height;
        if (imageSize > componentSize) {
            this.addIssueReport(createStmt[0], keyword);
        }
    }

    private getComponentSizeByWidthAndHeight(arkFile: ArkFile, treeNode: ViewTreeNode): ComponentSize {
        let size = { width: 0, height: 0 };
        let attributes = treeNode.attributes;
        if (attributes.has(this.WIDTH) && attributes.has(this.HEIGHT)) {
            let widthStmt = attributes.get(this.WIDTH);
            if (!widthStmt) {
                return size;
            }
            let heightStmt = attributes.get(this.HEIGHT);
            if (!heightStmt) {
                return size;
            }
            let width = this.getValueByStmt(widthStmt[0]);
            if (width === 0) {
                return size;
            }
            let height = this.getValueByStmt(heightStmt[0]);
            if (height === 0) {
                return size;
            }
            size.width = width;
            size.height = height;
        } else if (attributes.has(this.SIZE)) {
            let sizeStmt = attributes.get(this.SIZE);
            if (!sizeStmt) {
                return size;
            }
            size = this.getComponentSizeBySize(arkFile, sizeStmt[0]);
        }
        return size;
    }

    private getComponentSizeBySize(arkFile: ArkFile, sizeStmt: Stmt): ComponentSize {
        let size = { width: 0, height: 0 };
        let invoker = CheckerUtils.getInvokeExprFromStmt(sizeStmt);
        if (!invoker) {
            return size;
        }
        let arg0 = invoker.getArg(0);
        let type = arg0.getType();
        if (!(type instanceof ClassType)) {
            return size;
        }
        let sizeClass = arkFile.getScene().getClass(type.getClassSignature());
        if (!sizeClass) {
            return size;
        }
        let widthField = sizeClass.getFieldWithName(this.WIDTH);
        if (!widthField) {
            return size;
        }
        let initializer = widthField.getInitializer();
        size.width = this.getValueByStmt(initializer[0]);
        let heightField = sizeClass.getFieldWithName(this.HEIGHT);
        if (!heightField) {
            return size;
        }
        initializer = heightField.getInitializer();
        size.height = this.getValueByStmt(initializer[0]);
        return size;
    }

    private getImageResourcePath(arkFile: ArkFile,
        createStmt: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]]): string {
        let imageName = this.getImageName(createStmt);
        let moduleName = arkFile.getModuleName();
        if (imageName === '') {
            return '';
        }
        if (moduleName === undefined) {
            return '';
        }
        let moduleImagePaths = moduleMediaMap.get(moduleName);
        if (!moduleImagePaths) {
            return '';
        }
        for (let imagePath of moduleImagePaths) {
            let baseName = path.basename(imagePath);
            if (baseName.startsWith(imageName)) {
                return imagePath;
            }
        }
        for (let [key, imagePaths] of moduleMediaMap) {
            for (let imagePath of imagePaths) {
                let baseName = path.basename(imagePath);
                if (baseName.startsWith(imageName)) {
                    return imagePath;
                }
            }
        }
        return '';
    }

    private getImageName(createStmt: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]]): string {
        let stmt = createStmt[0];
        let invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invoker) {
            return '';
        }
        let arg0 = invoker.getArg(0);
        if (!(arg0 instanceof Local)) {
            return '';
        }
        let declaringStmt = arg0.getDeclaringStmt();
        if (!declaringStmt) {
            return '';
        }
        if (!(declaringStmt instanceof ArkAssignStmt)) {
            return '';
        }
        let argInvoker = CheckerUtils.getInvokeExprFromStmt(declaringStmt);
        if (!argInvoker) {
            return '';
        }
        let methodName = argInvoker.getMethodSignature().getMethodSubSignature().getMethodName();
        if (methodName !== '$r') {
            return '';
        }
        let argRes = argInvoker.getArg(0);
        if (!(argRes instanceof StringConstant)) {
            return '';
        }
        let imageName = argRes.getValue().split('.')[2];
        return imageName;
    }

    private getValueByStmt(initStmt: Stmt): number {
        let invoker = CheckerUtils.getInvokeExprFromStmt(initStmt);
        if (invoker) {
            let arg0 = invoker.getArg(0);
            return this.getArgValue(arg0);
        }
        if (initStmt instanceof ArkAssignStmt) {
            let rightOp = initStmt.getRightOp();
            return this.getArgValue(rightOp);
        }
        return 0;
    }

    private getArgValue(arg0: Value): number {
        if (arg0 instanceof NumberConstant) {
            let value = arg0.getValue();
            return Number(value) * VP_TO_PX_RATIO;
        }
        if (arg0 instanceof StringConstant) {
            let value = arg0.getValue();
            if (value.endsWith('px')) {
                return Number(value.replace('px', ''));
            }
            if (value.endsWith('vp')) {
                return Number(value.replace('vp', '')) * VP_TO_PX_RATIO;
            }
        }
        if (arg0 instanceof Local) {
            return 0;
        }
        return 0;
    }

    private addIssueReport(stmt: Stmt, keyword: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt, keyword);
        if (warnInfo) {
            let defects = new Defects(warnInfo.lineNum, warnInfo.startCol,
                warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(stmt: Stmt, keyword: string): {
        lineNum: number;
        startCol: number;
        endCol: number;
        filePath: string;
    } {
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        const originPosition = stmt.getOriginPositionInfo();
        const line = originPosition?.getLineNo();
        const text = stmt.getOriginalText();
        if (!text || text?.length === 0) {
            return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
        }
        if (!arkFile) {
            logger.debug('ArkFile is null.');
            return { lineNum: -1, startCol: -1, endCol: -1, filePath: '' };
        }
        let startCol = 0;
        let originalTexts = text.split('\n');
        let lineCount = -1;
        for (let originalText of originalTexts) {
            lineCount++;
            if (!originalText.includes(keyword)) {
                continue;
            }
            if (lineCount === 0) {
                startCol = originalText.indexOf(this.IMAGE) + originPosition.getColNo();
            } else {
                startCol = originalText.indexOf(keyword) + 1;
            }
            break;
        }
        let lineNum = line + lineCount;
        let endCol = startCol + keyword.length - 1;
        const originPath = arkFile.getFilePath();
        return { lineNum, startCol, endCol, filePath: originPath };
    }
}