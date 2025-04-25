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

import { ArkFile } from "arkanalyzer";
import { FileReports, IssueReport } from "./Defects";

export interface Engine {
    /**
     * 首次调用修复引擎时会调用，不同引擎的后续修复，可以内部单独实现
     * @param arkFile
     * @param fixIssues 需要修复的issues列表
     * @param remainIssues 剩余issues列表
     * @returns FileReports
     */
    applyFix(arkFile: ArkFile, fixIssues: IssueReport[], remainIssues: IssueReport[]): FileReports
}