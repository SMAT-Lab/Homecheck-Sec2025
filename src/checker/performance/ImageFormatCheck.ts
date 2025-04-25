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

import { ArkAssignStmt, ArkField, ArkFile, ArkInstanceFieldRef, ArkInstanceInvokeExpr, ArkMethod, ArkNamespace, ArkStaticInvokeExpr, ClassSignature, Constant, fetchDependenciesFromFile, Local, Scene, Stmt, Value, ViewTreeNode } from 'arkanalyzer';
import { appJson5App, extensionAbility, moduleAbility, moduleJson5Module } from '../../utils/checker/AbilityInterface';
import { CheckerUtils, Defects, FileUtils, MatcherCallback, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { ViewTreeTool } from '../../utils/checker/ViewTreeTool';
import { readImageInfo } from '../../utils/checker/ImageUtils';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { IssueReport } from '../../model/Defects';
import fs, { existsSync } from 'fs';
import path from 'path';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ImageFormatCheck');
let hasCheckJson5 = false;
let ImageFormats: string[] = ['jpg', 'png', 'webp'];
let moduleMediaMap: Map<string, string[]> = new Map();
let moduleRawMap: Map<string, string[]> = new Map();
let moduleResMap: Map<string, string[]> = new Map();
let viewTreeTool: ViewTreeTool = new ViewTreeTool();

const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/image-format-check.md',
    description: 'Use ASTC images.'
};

enum ResourceType {
    MEDIA,
    RAWFILE,
    RESFILE,
    NET
}

export class ImageFormatCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
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

    /**
     * Image Format check.
     * 
     * @param scene
     */
    public check = (scene: Scene): void => {
        if (!hasCheckJson5) {
            hasCheckJson5 = true;
            if (moduleMediaMap.size === 0 || moduleRawMap.size === 0) {
                this.cacheProjectImages(scene);
            }
            this.checkImageFormatInJson5(scene);
        }
        for (let arkFile of scene.getFiles()) {
            this.checkImageFormatInEts(arkFile);
        }
    };

    /**
     * Cache project image files.
     * 
     * @param scene
     */
    private cacheProjectImages(scene: Scene): void {
        // 缓存AppScope中的资源
        let moduleScope = 'AppScope';
        let mediaDir = path.join(scene.getRealProjectDir(), moduleScope, 'resources', 'base', 'media');
        let rawDir = path.join(scene.getRealProjectDir(), moduleScope, 'resources', 'rawfile');
        let resDir = path.join(scene.getRealProjectDir(), moduleScope, 'resources', 'resfile');
        moduleMediaMap.set(moduleScope, FileUtils.getAllFiles(mediaDir, []));
        moduleRawMap.set(moduleScope, FileUtils.getAllFiles(rawDir, []));
        moduleResMap.set(moduleScope, FileUtils.getAllFiles(resDir, []));
        // 缓存每个module中的资源
        for (let [key, value] of scene.getModuleSceneMap()) {
            mediaDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'base', 'media');
            rawDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'rawfile');
            resDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'resfile');
            moduleMediaMap.set(key, FileUtils.getAllFiles(mediaDir, []));
            moduleRawMap.set(key, FileUtils.getAllFiles(rawDir, []));
            moduleResMap.set(key, FileUtils.getAllFiles(resDir, []));
        }
    }

    /**
     * Check image format in json5.
     * 
     * @param scene
     */
    private checkImageFormatInJson5(scene: Scene): void {
        let realProjectDir = scene.getRealProjectDir();
        let appScopeJson5Path = path.join(realProjectDir, 'AppScope', 'app.json5');
        if (existsSync(appScopeJson5Path)) {
            const jsonData = fetchDependenciesFromFile(appScopeJson5Path);
            let app = jsonData.app as appJson5App;
            let iconName = app.icon.substring(app.icon.indexOf(':') + 1);
            if (this.isImageSuggest(ResourceType.MEDIA, scene, 'AppScope', iconName)) {
                this.reportJson5Issue(appScopeJson5Path, app.icon);
            }
        }
        for (let [key, value] of scene.getModuleSceneMap()) {
            let moduleJson5Path = path.join(value.getModulePath(), 'src', 'main', 'module.json5');
            if (!existsSync(moduleJson5Path)) {
                logger.debug('module json5 not exist');
                continue;
            }
            const jsonData = fetchDependenciesFromFile(moduleJson5Path);
            let moduleJson5 = jsonData.module as moduleJson5Module;
            let abilities = moduleJson5.abilities;
            if (abilities) {
                this.checkImageFormatInAbility(scene, key, moduleJson5Path, abilities);
            }
            let extensionAbilities = moduleJson5.extensionAbilities;
            if (extensionAbilities) {
                this.checkImageFormatInExtensionAbility(scene, key, moduleJson5Path, extensionAbilities);
            }
        }
    }

    private checkImageFormatInAbility(scene: Scene, moduleName: string, moduleJson5Path: string, abilities: moduleAbility[]): void {
        for (let ability of abilities) {
            let icon = ability.icon;
            if (icon && icon.startsWith('$media:')) {
                let iconName = icon.substring(icon.indexOf(':') + 1);
                if (this.isImageSuggest(ResourceType.MEDIA, scene, moduleName, iconName)) {
                    this.reportJson5Issue(moduleJson5Path, icon);
                }
            }
            let startWindowIcon: string = ability.startWindowIcon;
            if (startWindowIcon && startWindowIcon.startsWith('$media:')) {
                let iconName = startWindowIcon.substring(startWindowIcon.indexOf(':') + 1);
                if (this.isImageSuggest(ResourceType.MEDIA, scene, moduleName, iconName)) {
                    this.reportJson5Issue(moduleJson5Path, startWindowIcon);
                }
            }
        }
    }

    private checkImageFormatInExtensionAbility(scene: Scene, moduleName: string, moduleJson5Path: string, extensionAbilities: extensionAbility[]): void {
        for (let extensionAbility of extensionAbilities) {
            let icon = extensionAbility.icon;
            if (icon && icon.startsWith('$media:')) {
                let iconName = icon.substring(icon.indexOf(':') + 1);
                if (this.isImageSuggest(ResourceType.MEDIA, scene, moduleName, iconName)) {
                    this.reportJson5Issue(moduleJson5Path, icon);
                }
            }
        }
    }

    /**
     * If media image is jpg, png, webp return true, otherwise false.
     * 
     * @param type
     * @param scene
     * @param moduleName
     * @param imageName
     * @returns boolean
     */
    private isImageSuggest(type: ResourceType, scene: Scene, moduleName: string, imageName: string): boolean {
        // 如果模块名字为AppScope，则只找AppScope下面的资源
        let imageFile = moduleMediaMap.get('AppScope')?.find((imagePath) => {
            return path.basename(imagePath).replace(path.extname(imagePath), '') === imageName;
        });
        if (moduleName === 'AppScope') {
            if (!imageFile) {
                return false;
            }
        } else {
            // 根据当前模块dependencies去找其他模块
            imageFile = this.getImageFileByDependencyTree(type, scene, moduleName, imageName);
        }
        // 未找到图片，则不上报
        if (!imageFile) {
            return false;
        }
        // 有路径，但是无文件
        if (!existsSync(imageFile)) {
            return false;
        }
        // 获取图片的真实格式
        let ImageFormat = this.getImageFormat(imageFile);
        if (ImageFormats.includes(ImageFormat)) {
            return true;
        }
        return false;
    }

    private getImageFileByDependencyTree(type: ResourceType, scene: Scene, moduleName: string, imageName: string): string | undefined {
        // 根据资源类型，现在当前模块找
        let imageArray: string[] | undefined;
        switch (type) {
            case ResourceType.MEDIA:
                imageArray = moduleMediaMap.get(moduleName);
                break;
            case ResourceType.RAWFILE:
                imageArray = moduleRawMap.get(moduleName);
                break;
            case ResourceType.RESFILE:
                imageArray = moduleResMap.get(moduleName);
                break;
            default:
                break;
        }
        if (!imageArray) {
            return undefined;
        }
        let imageFile = imageArray.find((imagePath) => {
            return path.basename(imagePath).replace(path.extname(imagePath), '') === imageName;
        });
        // 当前模块找到图片，则直接返回
        if (imageFile) {
            return imageFile;
        }
        // 当前模块找不到，则解析oh-package.json5,去依赖库中查找
        let moduleInfo = scene.getModuleScene(moduleName);
        if (!moduleInfo) {
            return undefined;
        }
        let ohPkgContent = moduleInfo.getOhPkgContent() as { [k: string]: unknown };
        let dependencies = ohPkgContent.dependencies;
        if (!dependencies) {
            return undefined;
        }
        for (let [name, value] of Object.entries(dependencies as { [k: string]: unknown })) {
            // oh-package.json5中的modulename不一定为真实module名称
            let dependMoudleName = name;
            if (/^(file:)?\.{1,2}\//.test(value as string)) {
                // 需要解析相对路径最后一级的名称 "common": "file:../common"
                dependMoudleName = path.basename(value as string);
            }
            // 从任何一个依赖模块中找到则返回
            imageFile = this.getImageFileByDependencyTree(type, scene, dependMoudleName, imageName);
            if (imageFile) {
                return imageFile;
            }
        }
        return imageFile;
    }

    /**
     * Get image format, like jpg, png, webp, astc.
     * 
     * @param imagePath
     * @returns string
     */
    private getImageFormat(imagePath: string): string {
        try {
            const info = readImageInfo(imagePath);
            let format = info?.type;
            if (format) {
                return format;
            }
        } catch (err) {
            logger.error('ImageFormatCheck getImageFormat exception');
        }
        return '';
    }

    /**
     * Check image format in ets file.
     * 
     * @param arkFile
     */
    private checkImageFormatInEts(arkFile: ArkFile): void {
        for (let clazz of arkFile.getClasses()) {
            // 解析Image组件中的图片格式
            if (clazz.hasViewTree() && !viewTreeTool.hasTraverse(clazz)) {
                let rootTreeNode = clazz.getViewTree()?.getRoot();
                if (!rootTreeNode) {
                    return;
                }
                this.traverseViewTree(arkFile, rootTreeNode);
            }
            // 解析getDrawableDescriptor和createImageSource接口参数中的图片格式
            for (let method of clazz.getMethods()) {
                this.processArkMethod(arkFile, method);
            }
        }
        for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
            this.traverseNameSpace(arkFile, namespace);
        }
    }

    private traverseNameSpace(arkFile: ArkFile, namespace: ArkNamespace): void {
        for (let clazz of namespace.getClasses()) {
            // 解析getDrawableDescriptor和createImageSource接口参数中的图片格式
            for (let method of clazz.getMethods()) {
                this.processArkMethod(arkFile, method);
            }
            // 解析Image组件中的图片格式
            if (!clazz.hasViewTree()) {
                continue;
            }
            if (clazz.hasViewTree() && !viewTreeTool.hasTraverse(clazz)) {
                let rootTreeNode = clazz.getViewTree()?.getRoot();
                if (!rootTreeNode) {
                    return;
                }
                this.traverseViewTree(arkFile, rootTreeNode);
            }
        }
    }

    /**
     * traverse view find container with one children.
     * 
     * @param arkFile
     * @param treeNode
     */
    private traverseViewTree(arkFile: ArkFile, treeNode: ViewTreeNode): void {
        if (treeNode === undefined || treeNode === null) {
            return;
        }
        if (treeNode.children.length === 0) {
            return;
        }
        for (let children of treeNode.children) {
            if (children.isCustomComponent()) {
                continue;
            }
            if (children.name === 'Image') {
                let stmts = children.attributes;
                let createStmt = stmts.get('create');
                if (!createStmt) {
                    continue;
                }
                let stmt = createStmt[0];
                if (!(stmt instanceof ArkAssignStmt)) {
                    continue;
                }
                let rightOp = stmt.getRightOp();
                if (!(rightOp instanceof ArkStaticInvokeExpr)) {
                    continue;
                }
                // arg为Image.create()方法的入参，类型有Constant和Local两种类型
                let arg = rightOp.getArg(0);
                // 检测Image创建时src: PixelMap, src: Resourcr, src: DrawableDescriptor的图片格式
                this.checkImageFormatInArg(arkFile, stmt, 'create', arg);
            }
            if (children.children.length !== 0) {
                this.traverseViewTree(arkFile, children);
            }
        }
    }

    private processArkMethod(arkFile: ArkFile, method: ArkMethod): void {
        for (let stmt of method.getBody()?.getCfg().getStmts() ?? []) {
            let invokerExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!(invokerExpr instanceof ArkInstanceInvokeExpr)) {
                continue;
            }
            if (invokerExpr.getArgs().length === 0) {
                continue;
            }
            let methodName = invokerExpr.getMethodSignature().getMethodSubSignature().getMethodName();
            if (methodName !== 'getDrawableDescriptor' && methodName !== 'getRawFd' && methodName !== 'getRawFdSync' && methodName !== 'createImageSource') {
                return;
            }
            // 1、检测getDrawableDescriptor方法参数resId: number, resource: Resource的图片格式
            // 2、检测getRawFd和getRawFdSync方法参数path: string的图片格式
            // 3、检测createImageSource方法参数rawfile: resourceManager.RawFileDescriptor, buf: ArrayBuffer, fd: number, uri: string的图片格式
            if (methodName === 'getDrawableDescriptor') {
                this.checkImageFormatInArg(arkFile, stmt, methodName, invokerExpr.getArg(0));
            } else if (methodName === 'getRawFd' || methodName === 'getRawFdSync') {
                this.checkImageFormatInArg(arkFile, stmt, methodName, invokerExpr.getArg(0));
            } else if (methodName === 'createImageSource') {
                // promise跨方法导致推导失败，只能推导出getRawFdSync,与上面重复
            }
        }
    }

    private checkImageFormatInArg(arkFile: ArkFile, stmt: Stmt, methodName: string, arg: Value): void {
        // arg为Image.create或getDrawableDescriptor或getRawFd或createImageSource的参数
        if (arg instanceof Constant) {
            this.checkImageFormatInConstant(arkFile, stmt, methodName, arg);
        } else if (arg instanceof Local) {
            let declaringStmt = arg.getDeclaringStmt();
            if (!declaringStmt) {
                return;
            }
            if (!(declaringStmt instanceof ArkAssignStmt)) {
                return;
            }
            this.checkImageFormatInArg(arkFile, declaringStmt, methodName, declaringStmt.getRightOp());
        } else if (arg instanceof ArkInstanceFieldRef) {
            this.checkImageFormatInRef(arkFile, methodName, arg);
        } else if (arg instanceof ArkStaticInvokeExpr) {
            this.checkImageFormatInStaticExpr(arkFile, stmt, arg);
        } else if (arg instanceof ArkInstanceInvokeExpr) {
            // 样例代码: Image(getContext(this).resourceManager.getDrawableDescriptor($r('app.media.impressions_bg_snowscape')))
            let subMethodName = arg.getMethodSignature().getMethodSubSignature().getMethodName();
            if (subMethodName !== 'getDrawableDescriptor' && subMethodName !== 'getRawFd' && subMethodName !== 'getRawFdSync' && subMethodName !== 'createImageSource') {
                return;
            }
            if (arg.getArgs().length === 0) {
                return;
            }
            this.checkImageFormatInArg(arkFile, stmt, subMethodName, arg.getArg(0));
        }
    }

    private checkImageFormatInConstant(arkFile: ArkFile, stmt: Stmt, methodName: string, arg: Constant): void {
        let value = arg.getValue();
        let valueLowCase = value.toLocaleLowerCase();
        // 不检测手机沙盒资源，网络资源，手机媒体库资源
        if (valueLowCase.includes('/data/storage/') || valueLowCase.includes('http://') || valueLowCase.includes('https://') || valueLowCase.includes('ftp://') || valueLowCase.includes('file://')) {
            return;
        }
        // 其他类型资源，可能存在本地，获取文件名后，去本地资源查找
        let imageName = path.basename(value).replace(path.extname(value), '');
        if (imageName === '') {
            return;
        }
        let moduleScene = arkFile.getModuleScene();
        if (!moduleScene) {
            return;
        }
        // 这getRawFd与getRawFdSync方法则去moduleRawMap,其他则去moduleResMap缓存中查找
        if (methodName === 'getRawFd' || methodName === 'getRawFdSync') {
            if (this.isImageSuggest(ResourceType.RAWFILE, arkFile.getScene(), moduleScene.getModuleName(), imageName)) {
                this.reportEtsIssue(arkFile, stmt, value);
            }
        } else {
            if (this.isImageSuggest(ResourceType.RESFILE, arkFile.getScene(), moduleScene.getModuleName(), imageName)) {
                this.reportEtsIssue(arkFile, stmt, value);
            }
        }
    }

    private checkImageFormatInRef(arkFile: ArkFile, methodName: string, arg: ArkInstanceFieldRef): void {
        // 样例代码: Image(this.mediaArr[0]), Image(this.srcPixelMap)
        let fieldName = arg.getFieldName();
        // 引用Resource对象
        if (fieldName === 'id') {
            let base = arg.getBase();
            let declaringStmt = base.getDeclaringStmt();
            if (declaringStmt instanceof ArkAssignStmt) {
                this.checkImageFormatInArg(arkFile, declaringStmt, methodName, declaringStmt.getRightOp());
            }
        }
        if (arg.getBase().getName() !== 'this') {
            return;
        }
        // 引用当前类字段
        let baseSignature = arg.getFieldSignature().getDeclaringSignature();
        if (!(baseSignature instanceof ClassSignature)) {
            return;
        }
        let arkClass = arkFile.getClassWithName(baseSignature.getClassName());
        if (!arkClass) {
            return;
        }
        let arkField = arkClass.getFieldWithName(fieldName);
        if (!arkField) {
            return;
        }
        let stmts = arkField.getInitializer();
        if (stmts.length === 0) {
            return;
        }
        let stmt = stmts[0];
        if (!(stmt instanceof ArkAssignStmt)) {
            return;
        }
        let initialValue = stmt.getRightOp();
        this.checkImageFormatInClassField(arkFile, arkField, initialValue);
        // 引用当前类的字段，暂不处理
    }

    private checkImageFormatInClassField(arkFile: ArkFile, arkField: ArkField, arg: Value): void {
        if (arg instanceof Constant) {
            return;
        } else if (arg instanceof ArkStaticInvokeExpr) {
            if (arg.getArgs().length === 0) {
                return;
            }
            let imageValue = arg.getArg(0);
            if (!(imageValue instanceof Constant)) {
                return;
            }
            let imagePath = imageValue.getValue();
            let methodName = arg.getMethodSignature().getMethodSubSignature().getMethodName();
            const moduleName = arkFile.getModuleName();
            if (!moduleName) {
                return;
            }
            if (methodName.includes('$r')) {
                let imageName = imagePath.replace('app.media.', '');
                if (this.isImageSuggest(ResourceType.MEDIA, arkFile.getScene(), moduleName, imageName)) {
                    this.reportEtsIssue(arkFile, arkField, imagePath);
                }
            } else if (methodName.includes('$rawfile')) {
                let imageName = path.basename(imagePath).replace(path.extname(imagePath), '');
                if (this.isImageSuggest(ResourceType.RAWFILE, arkFile.getScene(), moduleName, imageName)) {
                    this.reportEtsIssue(arkFile, arkField, imagePath);
                }
            }
        } else if (arg instanceof ArkInstanceInvokeExpr) {
            let subMethodName = arg.getMethodSignature().getMethodSubSignature().getMethodName();
            if (subMethodName !== 'getDrawableDescriptor' && subMethodName !== 'getRawFd' && subMethodName !== 'getRawFdSync' && subMethodName !== 'createImageSource') {
                return;
            }
            if (arg.getArgs().length === 0) {
                return;
            }
            this.checkImageFormatInClassField(arkFile, arkField, arg.getArg(0));
        }
    }

    private checkImageFormatInStaticExpr(arkFile: ArkFile, stmt: Stmt, arg: ArkStaticInvokeExpr): void {
        if (arg.getArgs().length === 0) {
            return;
        }
        let imageValue = arg.getArg(0);
        if (!(imageValue instanceof Constant)) {
            return;
        }
        let imagePath = imageValue.getValue();
        let methodName = arg.getMethodSignature().getMethodSubSignature().getMethodName();
        let moduleScene = arkFile.getModuleScene();
        if (!moduleScene) {
            return;
        }
        if (methodName === '$r') {
            let imageName = imagePath.replace('app.media.', '');
            if (this.isImageSuggest(ResourceType.MEDIA, arkFile.getScene(), moduleScene.getModuleName(), imageName)) {
                this.reportEtsIssue(arkFile, stmt, imagePath);
            }
        } else if (methodName === '$rawfile') {
            let imageName = path.basename(imagePath).replace(path.extname(imagePath), '');
            if (this.isImageSuggest(ResourceType.RAWFILE, arkFile.getScene(), moduleScene.getModuleName(), imageName)) {
                this.reportEtsIssue(arkFile, stmt, imagePath);
            }
        }
    }

    /**
     * Report issue in json5.
     * 
     * @param json5Path
     * @param iconName
     */
    private reportJson5Issue(json5Path: string, iconName: string): void {
        let severity = this.rule.alert ?? this.metaData.severity;
        let readData = fs.readFileSync(json5Path, 'utf8');
        let readLines: string[] = readData.split('\n');
        let lineNum = 1;
        let startColumn = -1;
        let endColumn = -1;
        for (let line of readLines) {
            if ((line.includes('icon') || line.includes('startWindowIcon')) && line.includes(iconName)) {
                startColumn = line.indexOf(iconName) + 1;
                endColumn = startColumn + iconName.length - 1;
                let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity, this.rule.ruleId,
                    json5Path, this.metaData.ruleDocPath, true, false, false);
                this.issues.push(new IssueReport(defects, undefined));
            }
            lineNum++;
        }
    }

    /**
     * Report issue.
     * 
     * @param arkFile
     * @param stmtLike
     * @param imageName
     */
    private reportEtsIssue(arkFile: ArkFile, stmtLike: Stmt | ArkField, imageName: string): void {
        let severity = this.rule.alert ?? this.metaData.severity;
        let filePath = arkFile.getFilePath();
        let lineNum = -1;
        let startColumn = -1;
        let endColumn = -1;
        if (stmtLike instanceof Stmt) {
            const text = stmtLike.getOriginalText();
            if (!text || text.length === 0) {
                return;
            }
            let originalPosition = stmtLike.getOriginPositionInfo();
            lineNum = originalPosition.getLineNo();
            startColumn = originalPosition.getColNo() + text.indexOf(imageName);
            endColumn = startColumn + imageName.length - 1;
        } else {
            let lineCode = stmtLike.getCode();
            lineNum = stmtLike.getOriginPosition().getLineNo();
            startColumn = stmtLike.getOriginPosition().getColNo() + lineCode.indexOf(imageName);
            endColumn = startColumn + imageName.length - 1;
        }
        let defects = new Defects(lineNum, startColumn, endColumn, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}