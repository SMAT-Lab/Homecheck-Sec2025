import * as fs from 'fs';
import * as path from 'path';
import { run } from '../../src/Main';
import { HomeSecReport } from '../../src/utils/common/HomeSecReport';

// Run tests for a specific issue directory
async function runTestForIssue(issueDir: string): Promise<boolean> {
    const projectConfigPath = path.join(issueDir, 'projectConfig.json');
    const ruleConfigPath = path.join(issueDir, 'ruleConfig.json');

    // Check if configuration files exist
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
        console.log(`Test failed for: ${path.basename(issueDir)}, Error: ${error}`);
        return false;
    }
}

// Main function to iterate and run tests for all issue directories
async function main(): Promise<void> {
    const sampleDir = path.join(__dirname, '../../sample/TemplateSample');

    // Check if the sample directory exists
    if (!fs.existsSync(sampleDir)) {
        console.log(`Directory does not exist: ${sampleDir}`);
        return;
    }

    // Get all issue directories
    const issueDirs = fs.readdirSync(sampleDir)
        .map(dir => path.join(sampleDir, dir))
        .filter(dir => fs.statSync(dir).isDirectory());

    if (issueDirs.length === 0) {
        console.log('No issue directories found.');
        return;
    }

    // Run tests for each issue directory
    for (const issueDir of issueDirs) {
        await runTestForIssue(issueDir);
    }

    HomeSecReport.getInstance().generateReport();
    console.log('All tests completed.');
}

// Execute the main function and handle errors
main().catch(error => {
    console.log(`Test execution failed: ${error}`);
    process.exit(1);
});