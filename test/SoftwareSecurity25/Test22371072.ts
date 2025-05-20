import * as fs from 'fs';
import * as path from 'path';
import { run } from '../../src/Main';

// 运行特定问题的测试
async function runTestForIssue(issueDir: string): Promise<boolean> {
    const projectConfigPath = path.join(issueDir, 'projectConfig.json');
    const ruleConfigPath = path.join(issueDir, 'ruleConfig.json');

    // 检查配置文件是否存在
    if (!fs.existsSync(projectConfigPath) || !fs.existsSync(ruleConfigPath)) {
        console.log(`Missing configuration files in: ${issueDir}`);
        return false;
    }

    console.log(`Running test for: ${path.basename(issueDir)}`);
    try {
        await run(projectConfigPath, ruleConfigPath);
        console.log(`Test finished for: ${path.basename(issueDir)}`);
        return true;
    } catch (error) {
        console.log(`Test failed for: ${path.basename(issueDir)}, 错误: ${error}`);
        return false;
    }
}

// 主函数，遍历并运行所有问题的测试
async function main(): Promise<void> {
    const sampleDir = path.join(__dirname, '../../sample/Sample22371072');

    // 检查示例目录是否存在
    if (!fs.existsSync(sampleDir)) {
        console.log(`Directory does not exist: ${sampleDir}`);
        return;
    }

    // 获取所有问题目录
    const issueDirs = fs.readdirSync(sampleDir)
        .map(dir => path.join(sampleDir, dir))
        .filter(dir => fs.statSync(dir).isDirectory());

    if (issueDirs.length === 0) {
        console.log('No issue directories found.');
        return;
    }

    // 为每个问题目录运行测试
    for (const issueDir of issueDirs) {
        await runTestForIssue(issueDir);
    }

    console.log('All tests completed.');
}

// 执行主函数并处理错误
main().catch(error => {
    console.log(`Test execution failed: ${error}`);
    process.exit(1);
});
