import * as fs from 'fs';
import * as path from 'path';
import { run } from '../../src/Main';

async function scanProjects(basePath: string): Promise<void> {
    const issues = fs.readdirSync(basePath).filter((dir) => {
        const fullPath = path.join(basePath, dir);
        return fs.statSync(fullPath).isDirectory();
    });

    for (const issue of issues) {
        const projectConfigPath = path.join(basePath, issue, 'projectConfig.json');
        const configPath = path.join(basePath, issue, 'ruleConfig.json');

        if (fs.existsSync(projectConfigPath) && fs.existsSync(configPath)) {
            console.log(`Starting scan for project: ${issue}`);
            process.argv = [
                'node',
                'run.ts',
                `--projectConfigPath=${projectConfigPath}`,
                `--configPath=${configPath}`
            ];

            try {
                await run();
                console.log(`Scan completed for project: ${issue}`);
            } catch (error) {
                console.error(`Error scanning project: ${issue}`, error);
            }
        } else {
            console.warn(`Skipping project: ${issue} (missing config files)`);
        }
    }
}

(async () => {
    const basePath = path.resolve(__dirname, 'sample', 'Sample19241042');
    console.log(`Scanning projects in: ${basePath}`);
    await scanProjects(basePath);
    console.log('All projects scanned.');
})();