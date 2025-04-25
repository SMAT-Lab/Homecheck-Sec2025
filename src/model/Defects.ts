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
import { AIFix, FunctionFix, RuleFix } from "./Fix";

export const engine = {
    engineName: ''
}

export class Defects {
    reportLine: number;
    reportColumn: number;
    description: string = '';
    severity: number = -1;  // 0:info, 1:warning, 2:error
    ruleId: string = '@perforce/<checker-name>';
    mergeKey: string = '';  // 文件路径%行号%开始列号%结束列号%规则%规则描述
    ruleDocPath: string = 'doc/<checker-name>.md';
    disabled: boolean = true;
    checked: boolean = false;
    fixable: boolean = false;  // 是否可以修复
    fixKey: string = '';  // 行号%开始列号%结束列号%规则id
    showIgnoreIcon: boolean = true;
    engineName: string = engine.engineName;

    constructor(reportLine: number, reportColumn: number, endColumn: number, description: string, severity: number, ruleId: string,
        filePath: string, ruleDocPath: string, disabled: boolean, checked: boolean, fixable: boolean, showIgnoreIcon: boolean = true) {
        this.reportLine = reportLine;
        this.reportColumn = reportColumn;
        this.description = description;
        this.severity = severity;
        this.ruleId = ruleId;
        this.fixKey = this.reportLine + '%' + this.reportColumn + '%' + endColumn + '%' + this.ruleId;
        this.mergeKey = filePath + '%' + this.fixKey + '%' + this.description;
        this.ruleDocPath = ruleDocPath;
        this.disabled = disabled;
        this.checked = checked;
        this.fixable = fixable;
        this.showIgnoreIcon = showIgnoreIcon;
    }
}

export class IssueReport {
    defect: Defects;
    fix: RuleFix | FunctionFix | AIFix | undefined;

    constructor(defect: Defects, fix: RuleFix | FunctionFix | AIFix | undefined) {
        this.defect = defect;
        this.fix = fix;
    }
}

export interface FileIssues {
    filePath: string;
    issues: IssueReport[];
}

export interface FileReports {
    filePath: string;
    defects: Defects[];
    output?: string;
}