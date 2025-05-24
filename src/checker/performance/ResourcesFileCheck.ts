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

import { AbstractInvokeExpr, ArkClass, ArkFile, ArkMethod, fetchDependenciesFromFile, MethodSignature, Scene, Stmt } from 'arkanalyzer';
import { appJson5App, extensionAbility, moduleAbility, moduleJson5Module } from '../../utils/checker/AbilityInterface';
import { CheckerUtils, Defects, FileUtils, MatcherCallback, Rule } from '../../Index';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { StringUtils } from '../../utils/checker/StringUtils';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { IssueReport } from '../../model/Defects';
import { VarInfo } from '../../model/VarInfo';
import { StmtExt } from '../../model/StmtExt';
import { existsSync } from 'fs';
import path from 'path';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ResourcesFileCheck');
let ImageFormats: string[] = ['.jpg', '.png', '.webp', '.astc', '.json'];
let moduleMediaMap: Map<string, imageUse[]> = new Map();
let moduleRawMap: Map<string, imageUse[]> = new Map();
let moduleResMap: Map<string, imageUse[]> = new Map();

const gMetaData: BaseMetaData = {
    severity: 3,
    ruleDocPath: 'docs/resources-file-check.md',
    description: 'Suggestion: The image resources is not used.'
};

interface imageUse {
    filePath: string;
    inUse: boolean;
}

enum ResourceType {
    MEDIA,
    RAWFILE,
    RESFILE,
    NET
}

export class ResourcesFileCheck implements BaseChecker {
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
     * resource file check.
     * 
     * @param scene
     */
    public check = (scene: Scene): void => {
        // .json5文件
        this.cacheProjectImages(scene);
        this.checkImageFormatInJson5(scene);
        // 解析ets文件中图片资源，image组件和api调用场景
        for (let arkFile of scene.getFiles()) {
            this.checkImageFormatInEts(arkFile, scene);
        }
        // 遍历map
        this.mapProcess();
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
        moduleMediaMap.set(moduleScope,
            FileUtils.getAllFiles(mediaDir, ImageFormats).map(filePath => ({ filePath: filePath, inUse: false })));
        moduleRawMap.set(moduleScope,
            FileUtils.getAllFiles(rawDir, ImageFormats).map(filePath => ({ filePath: filePath, inUse: false })));
        moduleResMap.set(moduleScope,
            FileUtils.getAllFiles(resDir, ImageFormats).map(filePath => ({ filePath: filePath, inUse: false })));
        // 缓存每个module中的资源
        for (let [key, value] of scene.getModuleSceneMap()) {
            mediaDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'base', 'media');
            rawDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'rawfile');
            resDir = path.join(value.getModulePath(), 'src', 'main', 'resources', 'resfile');
            moduleMediaMap.set(key,
                FileUtils.getAllFiles(mediaDir, ImageFormats).map(filePath => ({ filePath: filePath, inUse: false })));
            moduleRawMap.set(key,
                FileUtils.getAllFiles(rawDir, ImageFormats).map(filePath => ({ filePath: filePath, inUse: false })));
            moduleResMap.set(key,
                FileUtils.getAllFiles(resDir, ImageFormats).map(filePath => ({ filePath: filePath, inUse: false })));
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
            this.imageSuggest(ResourceType.MEDIA, 'AppScope', iconName, scene);
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
                this.checkImageFormatInAbility(key, abilities, scene);
            }
            let extensionAbilities = moduleJson5.extensionAbilities;
            if (extensionAbilities) {
                this.checkImageFormatInExtensionAbility(key, extensionAbilities, scene);
            }
        }
    }

    private imageSuggest(type: ResourceType, moduleName: string, imageName: string, scene: Scene): void {
        if (moduleName === 'AppScope') {
            // 如果模块名字为AppScope，则只找AppScope下面的资源
            let paths = moduleMediaMap.get('AppScope');
            if (paths === undefined) {
                return;
            }
            for (let imagePath of paths) {
                if (path.basename(imagePath.filePath).replace(path.extname(imagePath.filePath), '') === imageName) {
                    // 修改状态值
                    imagePath.inUse = true;
                }
            }
        } else {
            this.getImageFileByDependencyTree(type, scene, moduleName, imageName);
        }
    }

    private getImageFileByDependencyTree(type: ResourceType, scene: Scene, moduleName: string, imageName: string): void {
        // 根据资源类型，现在当前模块找
        if (this.moduleProcess(type, moduleName, imageName)) {
            // 本模块找到
            return;
        }
        // 去其他模块找
        let moduleInfo = scene.getModuleScene(moduleName);
        if (!moduleInfo) {
            return;
        }
        let ohPkgContent = moduleInfo.getOhPkgContent() as { [k: string]: unknown };
        let dependencies = ohPkgContent.dependencies;
        if (!dependencies) {
            return;
        }
        for (let [name, value] of Object.entries(dependencies as { [k: string]: unknown })) {
            // oh-package.json5中的modulename不一定为真实module名称
            let dependMoudleName = name;
            if (/^(file:)?\.{1,2}\//.test(value as string)) {
                // 需要解析相对路径最后一级的名称 "common": "file:../common"
                dependMoudleName = path.basename(value as string);
            }
            if (this.moduleProcess(type, dependMoudleName, imageName)) {
                // 本模块找到
                return;
            }
        }
    }

    private moduleProcess(type: ResourceType, moduleName: string, imageName: string): boolean {
        // 当前模块找到，返回查找结果
        let imageArrays: imageUse[] | undefined;
        switch (type) {
            case ResourceType.MEDIA:
                imageArrays = moduleMediaMap.get(moduleName);
                break;
            case ResourceType.RAWFILE:
                imageArrays = moduleRawMap.get(moduleName);
                break;
            case ResourceType.RESFILE:
                imageArrays = moduleResMap.get(moduleName);
                break;
            default:
                break;
        }
        return this.imageProcess(imageArrays, imageName);
    }

    private imageProcess(imageArrays: imageUse[] | undefined, imageName: string): boolean {
        if (imageArrays === undefined) {
            return false;
        }
        for (let imageArray of imageArrays) {
            if (path.basename(imageArray.filePath).replace(path.extname(imageArray.filePath), '') !== imageName) {
                continue;
            }
            let fileFormat = path.extname(imageArray.filePath);
            if (fileFormat === '.json') {
                // 解析json文件
                const jsonData = fetchDependenciesFromFile(imageArray.filePath);
                return this.checkMediaPrefix(jsonData, imageArrays);
            } else {
                // 修改状态值
                imageArray.inUse = true;
                return true;
            }
        }
        return false;
    }

    private checkMediaPrefix(obj: { [k: string]: unknown; }, imageArrays: imageUse[]): boolean {
        for (let key in obj) {
            let value: unknown = obj[key];
            if (typeof value === 'string' && (value as string).toString().startsWith('$media')) {
                let iconName = (value as string).substring((value as string).indexOf(':') + 1);
                return this.imageProcess(imageArrays, iconName);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                // 如果值是对象，递归调用函数继续检查
                this.checkMediaPrefix(obj[key] as { [k: string]: unknown }, imageArrays);
            }
        }
        return false;
    }

    private checkImageFormatInAbility(moduleName: string, abilities: moduleAbility[], scene: Scene): void {
        for (let ability of abilities) {
            let icon = ability.icon;
            if (icon && icon.startsWith('$media:')) {
                let iconName = icon.substring(icon.indexOf(':') + 1);
                this.imageSuggest(ResourceType.MEDIA, moduleName, iconName, scene);
            }
            let startWindowIcon: string = ability.startWindowIcon;
            if (startWindowIcon && startWindowIcon.startsWith('$media:')) {
                let iconName = startWindowIcon.substring(startWindowIcon.indexOf(':') + 1);
                this.imageSuggest(ResourceType.MEDIA, moduleName, iconName, scene);
            }
        }
    }

    private checkImageFormatInExtensionAbility(moduleName: string, extensionAbilities: extensionAbility[], scene: Scene): void {
        for (let extensionAbility of extensionAbilities) {
            let icon = extensionAbility.icon;
            if (icon && icon.startsWith('$media:')) {
                let iconName = icon.substring(icon.indexOf(':') + 1);
                this.imageSuggest(ResourceType.MEDIA, moduleName, iconName, scene);
            }
        }
    }

    private checkImageFormatInEts(arkFile: ArkFile, scene: Scene): void {
        for (let clazz of arkFile.getClasses()) {
            this.classProcess(clazz, scene);
        }
        for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
            for (let clazz of namespace.getClasses()) {
                this.classProcess(clazz, scene);
            }
        }
    }

    private classProcess(clazz: ArkClass, scene: Scene): void {
        for (let method of clazz.getMethods()) {
            let busyMethods = new Set<MethodSignature>();
            this.findSymbolInMethod(method, scene, busyMethods);
        }
        let instanceInitMethod = clazz.getInstanceInitMethod();
        let initBusyMethods = new Set<MethodSignature>();
        this.findSymbolInMethod(instanceInitMethod, scene, initBusyMethods);
        let staticInitMethod = clazz.getStaticInitMethod();
        let staticInitBusyMethods = new Set<MethodSignature>();
        this.findSymbolInMethod(staticInitMethod, scene, staticInitBusyMethods);
    }

    private findSymbolInMethod(method: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>): void {
        const stmts = method.getBody()?.getCfg().getStmts();
        if (!stmts) {
            return;
        }
        const curMethodSignature = method.getSignature();
        busyMethods.add(curMethodSignature);
        for (let stmt of stmts) {
            const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
            if (!invokeExpr) {
                continue;
            }
            const invokeSignature = invokeExpr.getMethodSignature();
            if (busyMethods.has(invokeSignature)) {
                continue;
            }
            let clazz = method.getDeclaringArkClass();
            let methodName = invokeSignature.getMethodSubSignature().getMethodName();
            let moduleName = clazz.getDeclaringArkFile().getModuleName();
            if (moduleName === undefined) {
                continue;
            }
            if (methodName === '$r') {
                let imagePath = this.getImagePath(invokeExpr, clazz, stmt);
                let imageName = imagePath.replace('app.media.', '');
                this.imageSuggest(ResourceType.MEDIA, moduleName, imageName, scene);
            } else if (methodName === '$rawfile') {
                let imagePath = this.getImagePath(invokeExpr, clazz, stmt);
                let imageName = path.basename(imagePath).replace(path.extname(imagePath), '');
                this.imageSuggest(ResourceType.RAWFILE, moduleName, imageName, scene);
            } else if (methodName === 'getRawFd' || methodName === 'getRawFdSync') {
                let imagePath = this.getImagePath(invokeExpr, clazz, stmt);
                this.getRawFdProcess(imagePath, moduleName, scene);
            }
        }
        busyMethods.delete(curMethodSignature);
    }

    private getImagePath(invokeExpr: AbstractInvokeExpr, clazz: ArkClass, stmt: Stmt): string {
        let arg = invokeExpr.getArg(0);
        let varInfo = new VarInfo(stmt, (stmt as StmtExt).scope);
        return StringUtils.getStringByScope(clazz.getDeclaringArkFile(), varInfo, arg);
    }

    private getRawFdProcess(imagePath: string, moduleName: string, scene: Scene): void {
        let valueLowCase = imagePath.toLocaleLowerCase();
        // 不检测手机沙盒资源，网络资源，手机媒体库资源
        if (valueLowCase.includes('/data/storage/') || valueLowCase.includes('http://') || valueLowCase.includes('https://') || valueLowCase.includes('ftp://') || valueLowCase.includes('file://')) {
            return;
        }
        // 其他类型资源，可能存在本地，获取文件名后，去本地资源查找
        let imageName = path.basename(imagePath).replace(path.extname(imagePath), '');
        if (imageName === '') {
            return;
        }
        this.imageSuggest(ResourceType.RAWFILE, moduleName, imageName, scene);
    }

    private mapProcess(): void {
        // 遍历map筛选
        for (let imageUses of moduleMediaMap.values()) {
            imageUses.forEach(imageUse => {
                if (!imageUse.inUse && path.extname(imageUse.filePath) !== '.json') {
                    this.reportIssue(imageUse.filePath);
                }
            });
        }
        for (let imageUses of moduleRawMap.values()) {
            imageUses.forEach(imageUse => {
                if (!imageUse.inUse && path.extname(imageUse.filePath) !== '.json') {
                    this.reportIssue(imageUse.filePath);
                }
            });
        }
        for (let imageUses of moduleResMap.values()) {
            imageUses.forEach(imageUse => {
                if (!imageUse.inUse && path.extname(imageUse.filePath) !== '.json') {
                    this.reportIssue(imageUse.filePath);
                }
            });
        }
    }

    private reportIssue(filePath: string): void {
        let severity = this.rule.alert ?? this.metaData.severity;
        let defects = new Defects(0, 0, 0, this.metaData.description, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defects, undefined));
    }
}