import { ArkFile, AstTreeUtils, Stmt, ts, ArkStaticInvokeExpr } from 'arkanalyzer';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../../BaseChecker';
import { Defects } from '../../../Index';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../../Index';
import { Rule } from '../../../Index';
import { IssueReport } from '../../../model/Defects';
import * as fs from 'fs';
import * as path from 'path';
import { JSONPath } from 'jsonpath-plus'; // 用于解析JSON/JSON5

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'InsecureComponentExposureCheck');

const gMetaData: BaseMetaData = {
    severity: 2, // 默认为中等风险，具体根据情况调整
    ruleDocPath: '', // 稍后可以补充文档路径
    description: 'Detects insecurely exposed abilities in module.json5 and checks for permission validation in code.'
};

// 假设的 module.json5 结构中的 Ability 定义
interface ManifestAbility {
    name: string;
    srcEntry?: string; // Ability的ts/ets文件路径，相对于module的src/main/ets
    type: 'page' | 'service' | 'data' | 'form' | 'extension'; // 根据实际情况调整
    exported?: boolean; // 默认为false，但某些类型如service可能默认为true或根据用途判断
    permissions?: string[];
    visible?: boolean;
    uri?: string; // 对于Data Ability等
    // 其他可能的属性...
}

// 假设的 module.json5 结构中的自定义权限定义
interface ManifestDefPermission {
    name: string;
    grantMode: 'system_grant' | 'user_grant'; // system_grant是高保护级别
    availableScope?: string[];
    label?: string;
    description?: string;
}

interface ParsedManifest {
    abilities: ManifestAbility[];
    defPermissions: ManifestDefPermission[];
    bundleName?: string; // 应用包名
}

export class InsecureComponentExposureCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private reportedLocations = new Set<string>();
    private projectRoot: string | undefined;
    private parsedManifests: Map<string, ParsedManifest> = new Map(); // 存储已解析的manifest，key为module.json5的路径

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const fileMatchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [fileMatchBuildCb];
    }

    // 辅助函数：查找并解析 module.json5
        private async findAndParseManifest(targetFilePath: string): Promise<ParsedManifest | undefined> {
        const moduleJson5Name = 'module.json5';
        let currentSearchDir = path.dirname(targetFilePath); // 开始从目标文件所在的目录查找
        let manifestPath: string | undefined;
        let searchLevels = 0; // 限制向上查找的层数

        logger.debug(`[InsecureComponentExposureCheck] Starting manifest search for: ${targetFilePath}`);
        logger.debug(`[InsecureComponentExposureCheck] Initial search directory: ${currentSearchDir}`);

        // 向上查找 module.json5，直到找到或达到项目根目录层级（或一个合理的层数限制）
        while (searchLevels < 8) { // 最多向上查找8层，根据你的项目结构调整
            const potentialManifestPath = path.join(currentSearchDir, moduleJson5Name);
            logger.debug(`[InsecureComponentExposureCheck] Checking for manifest at: ${potentialManifestPath}`);
            if (fs.existsSync(potentialManifestPath)) {
                manifestPath = potentialManifestPath;
                logger.info(`[InsecureComponentExposureCheck] Found manifest for ${targetFilePath} at: ${manifestPath}`);
                break;
            }

            const parentDir = path.dirname(currentSearchDir);
            if (parentDir === currentSearchDir) { // 已到达文件系统根目录
                logger.debug(`[InsecureComponentExposureCheck] Reached file system root while searching for manifest.`);
                break;
            }
            currentSearchDir = parentDir;
            searchLevels++;
        }

        if (!manifestPath) {
            logger.warn(`[InsecureComponentExposureCheck] 未能在 ${targetFilePath} 附近（向上查找 ${searchLevels} 层）找到 ${moduleJson5Name}。`);
            return undefined;
        }

        if (this.parsedManifests.has(manifestPath)) {
            logger.debug(`[InsecureComponentExposureCheck] Using cached manifest for: ${manifestPath}`);
            return this.parsedManifests.get(manifestPath);
        }

        try {
            logger.info(`[InsecureComponentExposureCheck] 正在解析配置文件: ${manifestPath}`);
            const content = fs.readFileSync(manifestPath, 'utf-8');
            const manifestJson = JSON.parse(content.replace(/^\uFEFF/, '').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''));


            const abilities: ManifestAbility[] = JSONPath({ path: '$.module.abilities[*]', json: manifestJson }) || [];
            const defPermissions: ManifestDefPermission[] = JSONPath({ path: '$.module.defPermissions[*]', json: manifestJson }) || [];
            const bundleName: string = JSONPath({ path: '$.app.bundleName', json: manifestJson, wrap: false }) ||
                                     JSONPath({ path: '$.module.bundleName', json: manifestJson, wrap: false });


            const parsed: ParsedManifest = { abilities, defPermissions, bundleName };
            this.parsedManifests.set(manifestPath, parsed);
            logger.info(`[InsecureComponentExposureCheck] 解析完成: ${manifestPath}, Abilities: ${abilities.length}, DefPermissions: ${defPermissions.length}`);
            return parsed;
        } catch (error: any) {
            logger.error(`[InsecureComponentExposureCheck] 解析 ${manifestPath} 失败: ${error.message}`);
            return undefined;
        }
    }

    public check = async (targetFile: ArkFile) => {
        logger.info(`[InsecureComponentExposureCheck] 开始检查文件: ${targetFile.getFilePath()}`);
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetFile);
        if (!sourceFile) {
            logger.error("[InsecureComponentExposureCheck] 无法获取源文件");
            return;
        }

        const manifest = await this.findAndParseManifest(targetFile.getFilePath());
        if (!manifest) {
            logger.warn(`[InsecureComponentExposureCheck] 未找到或无法解析 ${targetFile.getFilePath()} 相关的 module.json5，跳过部分检查。`);
            // 即使没有manifest，也可以尝试检查代码中的权限API调用，但意义不大
            return;
        }

        // 1. 检查配置文件中的暴露风险 (只在第一次处理与该manifest相关的ts文件时执行，或对manifest本身执行)
        // 为了简化，我们每次解析都检查，但通过reportedLocations避免重复报告
        for (const ability of manifest.abilities) {
            // 默认 exported 行为：
            // - Service abilities 默认为 true
            // - Page abilities (作为 mainElement 且是 entry 模块的) 默认为 true
            // - 其他通常默认为 false，除非显式设置
            // 这里简化处理：如果 exported 字段存在，则以其为准；否则根据类型粗略判断
            let isExported = ability.exported === true;
            if (ability.exported === undefined && (ability.type === 'service' /* || isMainEntryPage(ability, manifest) */)) {
                isExported = true; // 简化假设
            }

            if (isExported) {
                const abilityIdentifier = `${ability.name} (${ability.type})`;
                if (!ability.permissions || ability.permissions.length === 0) {
                    this.reportIssueInManifest(manifest, ability, `导出的Ability ${abilityIdentifier} 未声明任何权限 (permissions)，可能被任意应用调用。`, 2, targetFile.getFilePath());
                } else {
                    let hasWeakPermission = false;
                    for (const permName of ability.permissions) {
                        const defPerm = manifest.defPermissions.find(dp => dp.name === permName);
                        if (defPerm && defPerm.grantMode !== 'system_grant') {
                            hasWeakPermission = true;
                            this.reportIssueInManifest(manifest, ability, `导出的Ability ${abilityIdentifier} 依赖于非系统级权限 '${permName}' (grantMode: ${defPerm.grantMode})。`, 1, targetFile.getFilePath());
                            break;
                        } else if (!defPerm && !permName.startsWith('ohos.permission.')) { // 未定义的自定义权限，且不是系统权限
                             this.reportIssueInManifest(manifest, ability, `导出的Ability ${abilityIdentifier} 依赖于未在defPermissions中定义的自定义权限 '${permName}'。`, 1, targetFile.getFilePath());
                             hasWeakPermission = true; // 视为弱权限
                             break;
                        }
                    }
                    if (hasWeakPermission && ability.visible === true) {
                        logger.info(`[InsecureComponentExposureCheck] 导出的Ability ${abilityIdentifier} 可见 (visible=true) 且权限保护较弱。`);
                    }
                }
            }
        }


        // 2. 检查代码中的权限校验
        // 找到当前ts文件对应的Ability定义
        const currentAbilityManifest = manifest.abilities.find(a => {
            if (!a.srcEntry) return false;
            // 假设 srcEntry 是相对于 module/src/main/ets 的路径
            // e.g., MainAbility/MainAbility or MainAbility
            const expectedPathSuffix = path.normalize(a.srcEntry.endsWith('.ts') || a.srcEntry.endsWith('.ets') ? a.srcEntry : `${a.srcEntry}.ts`).replace(/\\/g, '/');
            const targetNormalized = path.normalize(targetFile.getFilePath()).replace(/\\/g, '/');
            return targetNormalized.endsWith(expectedPathSuffix) || targetNormalized.endsWith(expectedPathSuffix.replace('.ts', '.ets'));
        });


        if (currentAbilityManifest && (currentAbilityManifest.exported === true || (currentAbilityManifest.exported === undefined && currentAbilityManifest.type === 'service'))) {
            logger.info(`[InsecureComponentExposureCheck] 检查导出的Ability [${currentAbilityManifest.name}] 的代码权限校验: ${targetFile.getFilePath()}`);
            let foundPermissionCheck = false;
            const visitNode = (node: ts.Node) => {
                if (ts.isCallExpression(node) || ts.isCallChain(node)) {
                    const expression = node.expression;
                    let methodName = '';
                    if (ts.isPropertyAccessExpression(expression)) {
                        methodName = expression.name.getText(sourceFile);
                        // 检查是否调用了 abilityAccessCtrl 的 checkAccessToken 或 verifyAccessToken
                        if (methodName === 'checkAccessToken' || methodName === 'checkAccessTokenSync' ||
                            methodName === 'verifyAccessToken' || methodName === 'verifyAccessTokenSync') {
                            // 进一步检查调用对象是否是 AtManager 实例
                            const objExpr = expression.expression; // AtManager 实例
                            if (objExpr.getText(sourceFile).includes('abilityAccessCtrl.createAtManager()') ||
                                objExpr.getText(sourceFile).includes('atManager')) { // 假设实例名为 atManager
                                foundPermissionCheck = true;
                                logger.info(`[InsecureComponentExposureCheck] 在 ${currentAbilityManifest.name} 中找到权限检查调用: ${node.getText(sourceFile).substring(0,100)}`);
                            }
                        }
                    }
                }
                if (!foundPermissionCheck) { // 如果还没找到，继续遍历
                    ts.forEachChild(node, visitNode);
                }
            };

            visitNode(sourceFile);

            if (!foundPermissionCheck) {
                this.reportIssueFromTsNode(targetFile, sourceFile.getFirstToken() || sourceFile, // 报告在文件开头
                    `导出的Ability [${currentAbilityManifest.name}] 在代码中未检测到明确的权限校验调用 (如 checkAccessToken)。`,
                    `导出的Ability ${currentAbilityManifest.name} (${targetFile.getFilePath()}) 在其代码中似乎缺少对调用者权限的校验。请确保在处理外部请求前使用 abilityAccessCtrl.createAtManager().checkAccessTokenSync() 或类似API进行权限检查。`,
                    1 // 中等风险，因为配置文件可能已经声明了权限
                );
            }
        }

        logger.info(`[InsecureComponentExposureCheck] 文件检查完成: ${targetFile.getFilePath()}`);
    }

    // 报告在 module.json5 中发现的问题
    // 由于我们没有直接的AST Node for JSON，我们报告在与该manifest相关的第一个ts文件，或者提供一个虚拟位置
    private reportIssueInManifest(manifest: ParsedManifest, ability: ManifestAbility, message: string, severity: number, relatedTsFilePath: string): void {
        const issueType = `Manifest.Ability.${ability.name}`;
        // 尝试定位到 manifest 文件本身，如果能获取到其路径
        const manifestKey = Array.from(this.parsedManifests.entries()).find(([key, value]) => value === manifest)?.[0];
        const reportFilePath = manifestKey || relatedTsFilePath; // 优先用manifest文件路径

        // 对于JSON文件，行号和列号可能不准确，这里用虚拟位置或文件开头
        const lineNum = 1;
        const colNum = 1;
        const text = `Ability: ${ability.name}`;

        const locationKey = `${reportFilePath}:${lineNum}:${colNum}:${issueType}`;
        if (this.reportedLocations.has(locationKey)) {
            return;
        }
        this.reportedLocations.add(locationKey);

        logger.warn(`[InsecureComponentExposureCheck] 报告配置文件问题: 文件=${reportFilePath}, 类型=${issueType}, 消息=${message}`);

        const defects = new Defects(
            lineNum, colNum, colNum + text.length,
            message,
            severity,
            this.rule?.ruleId || "@software-sec/checker21241088/insecure-component-exposure",
            reportFilePath,
            this.metaData.ruleDocPath,
            true, false, false
        );
        this.issues.push(new IssueReport(defects, undefined));
    }


    // 报告在 .ts 代码文件中发现的问题
    private reportIssueFromTsNode(arkFile: ArkFile, tsNode: ts.Node, issueType: string, message: string, severityOverride?: number): void {
        const severity = severityOverride !== undefined ? severityOverride : (this.rule?.alert ?? this.metaData.severity);
        const filePath = arkFile.getFilePath();
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        if (!sourceFile) return;

        const startPos = tsNode.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(startPos);
        const lineNum = line + 1;
        const colNum = character + 1;
        const text = tsNode.getText(sourceFile).split('\n')[0] || issueType; // 取第一行作为代表

        const locationKey = `${filePath}:${lineNum}:${colNum}:${issueType}`;
        if (this.reportedLocations.has(locationKey)) return;
        this.reportedLocations.add(locationKey);

        logger.warn(`[InsecureComponentExposureCheck] 报告代码问题: 文件=${filePath}, 行=${lineNum}, 类型=${issueType}, 消息=${message}`);

        const defects = new Defects(
            lineNum, colNum, colNum + text.length,
            message,
            severity,
            this.rule?.ruleId || "@software-sec/checker21241088/insecure-component-exposure",
            filePath,
            this.metaData.ruleDocPath,
            true, false, false
        );
        this.issues.push(new IssueReport(defects, undefined));
    }
}