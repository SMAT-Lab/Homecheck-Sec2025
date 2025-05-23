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

import { FileUtils, WriteFileMode } from "./FileUtils";
import path from 'path';

export class HomeSecReport {
    private static instance: HomeSecReport | null = null;
    private homeSecReport: ProjectResult[] = [];

    private constructor() {}

    public static getInstance(): HomeSecReport {
        if (this.instance === null) {
            this.instance = new HomeSecReport();
        }
        return this.instance;
    }

    public addProjectResult(projectName: string, projectPath: string, issues: string): void {
        const projectResult = new ProjectResult(projectName, projectPath, issues);
        this.homeSecReport.push(projectResult);
    }

    public generateReport(){
        const report = this.homeSecReport.map(project => {
            let parsedIssues;
            try {
                parsedIssues = JSON.parse(project.issues);
            } catch (error) {
                console.error(`Failed to parse issues for project ${project.projectName}: ${error}`);
                parsedIssues = [];
            }
            return {
                projectName: project.projectName,
                projectPath: project.projectPath,
                issues: Array.isArray(parsedIssues) ? parsedIssues : [parsedIssues]
            };
        });
        const jsonString = JSON.stringify(report, null, 2);
        FileUtils.writeToFile(path.resolve("./report", 'issuesReport.json'), jsonString, WriteFileMode.OVERWRITE);
    }
}

class ProjectResult {
    projectName: string;
    projectPath: string;
    issues: string;
    constructor(projectName: string, projectPath: string, issues: string) {
        this.projectName = projectName;
        this.projectPath = projectPath;
        this.issues = issues;
    }
}
