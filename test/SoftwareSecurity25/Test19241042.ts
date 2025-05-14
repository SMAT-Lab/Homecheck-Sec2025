import * as fs from 'fs';
import * as path from 'path';
import { run } from '../../src/Main';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'Test19241042');

/**
 * 为单个问题目录运行测试
 * @param issueDir 问题目录路径
 * @returns 是否成功
 */
async function runTestForIssue(issueDir: string): Promise<boolean> {
    const projectConfigPath = path.join(issueDir, 'projectConfig.json');
    const ruleConfigPath = path.join(issueDir, 'ruleConfig.json');

    // 检查配置文件是否存在
    if (!fs.existsSync(projectConfigPath) || !fs.existsSync(ruleConfigPath)) {
        logger.error(`在 ${issueDir} 中缺少配置文件`);
        return false;
    }

    logger.info(`正在为问题运行测试：${path.basename(issueDir)}`);
    const startTime = new Date().getTime();
    
    try {
        // 直接调用 run 函数，传入配置文件路径
        const result = await run(projectConfigPath, ruleConfigPath);
        const endTime = new Date().getTime();
        logger.info(`${path.basename(issueDir)} 的测试在 ${(endTime - startTime) / 1000} 秒内完成`);
        return result;
    } catch (error) {
        logger.error(`为 ${path.basename(issueDir)} 运行测试时出错：${error}`);
        return false;
    }
}

/**
 * 主函数，遍历并运行所有问题目录的测试
 */
async function main(): Promise<void> {
    const sampleDir = path.join(__dirname, '../../sample/Sample19241042');
    
    if (!fs.existsSync(sampleDir)) {
        logger.error(`目录 ${sampleDir} 不存在`);
        return;
    }

    // 获取所有问题目录
    const issueDirs = fs.readdirSync(sampleDir)
        .map(dir => path.join(sampleDir, dir))
        .filter(dir => fs.statSync(dir).isDirectory());

    if (issueDirs.length === 0) {
        logger.warn('未找到问题目录');
        return;
    }

    logger.info(`找到 ${issueDirs.length} 个问题目录需要测试`);

    // 并行运行所有测试
    const results = await Promise.all(
        issueDirs.map(async (issueDir) => {
            return {
                issue: path.basename(issueDir),
                success: await runTestForIssue(issueDir)
            };
        })
    );

    // 记录测试总结
    results.forEach(result => {
        logger.info(`${result.issue}: ${result.success ? '通过' : '失败'}`);
    });

    const failedCount = results.filter(r => !r.success).length;
    logger.info(`\n测试完成。${results.length - failedCount}/${results.length} 通过`);
    
    // 如果有测试失败，退出并返回错误码
    if (failedCount > 0) {
        process.exit(1);
    }
}

// 执行主函数并处理错误
main().catch(error => {
    logger.error(`测试执行失败：${error}`);
    process.exit(1);
});