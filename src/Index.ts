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

// main
export { start, run } from './Main';

// checkers
export { BaseMetaData, BaseChecker } from './checker/BaseChecker';

// matchers
export * from './matcher/Matchers';

// models
export { CheckerStorage } from './utils/common/CheckerStorage';
export { Rule } from './model/Rule';
export { Defects, IssueReport, FileReports } from './model/Defects';
export { Message, MessageType } from './model/Message';
export { ProjectConfig } from './model/ProjectConfig';
export { RuleConfig } from './model/RuleConfig';
export * from './model/Scope';

// utils
export { CheckEntry } from './utils/common/CheckEntry';
export { CheckerUtils } from './utils/checker/CheckerUtils';
export { ConfigUtils } from './utils/common/ConfigUtils';
export { FileUtils, WriteFileMode } from './utils/common/FileUtils';
export { Json5parser } from './utils/common/Json5parser';
export { Utils } from './utils/common/Utils';

// tools
export { runTool, Tools } from './tools/toolEntry';