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

export class ProjectConfig {
    projectName: string;
    projectPath: string;
    logPath: string;
    ohosSdkPath: string;
    hmsSdkPath: string;
    checkPath: string;
    apiVersion: number;
    fix: string;
    fixSelected: boolean;
    npmPath: string;
    npmInstallDir: string;
    reportDir: string;
    sdksThirdParty: string[];
    arkCheckPath: string;
    product: string;
    homecheck_log_level: string;
    arkanalyzer_log_level: string;

    constructor(config: any) {
        this.projectName = config.projectName ?? '';
        this.projectPath = config.projectPath ?? '';
        this.logPath = config.logPath ?? '';
        this.ohosSdkPath = config.ohosSdkPath ?? '';
        this.hmsSdkPath = config.hmsSdkPath ?? '';
        this.checkPath = config.checkPath ?? '';
        this.apiVersion = config.sdkVersion ?? 14;
        this.fix = config.fix ?? 'false';
        this.fixSelected = config.fixSelected ?? false;
        this.npmPath = config.npmPath ? config.npmPath : 'npm';
        this.npmInstallDir = config.npmInstallDir ? config.npmInstallDir : './';
        this.reportDir = config.reportDir ? config.reportDir : './';
        this.sdksThirdParty = config.sdksThirdParty ?? [];
        this.arkCheckPath = config.arkCheckPath ?? '';
        this.product = config.product ?? '';
        this.homecheck_log_level = config.homecheck_log_level ?? 'info';
        this.arkanalyzer_log_level = config.arkanalyzer_log_level ?? 'error';
    }
}

export interface SelectedFileInfo {
    filePath: string;
    fixKey?: string[];
}