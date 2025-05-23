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

import { beforeAll, describe, expect, test } from 'vitest';
import { CHECK_MODE, testCaseCheckDedicated } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ResourcesFileCheck } from '../../../src/checker/performance/ResourcesFileCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/ResourcesFile/ets';
    const rule: Rule = new Rule('@performance/resources-file-check', ALERT_LEVEL.WARN);
    checkEntry = await testCaseCheckDedicated(testPath, rule, CHECK_MODE.PROJECT2CHECK, ResourcesFileCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ResourcesFileTest', () => {

    /**
     * @tc.number: ResourcesFileTest_001
     * @tc.name: AppScope模块，.json5文件使用图片资源
     * @tc.desc: AppScope模块，.json5文件使用图片资源
     */
    test('ResourcesFileTest_001', () => {
        const detectFile: string = path.join(realPath, 'AppScope', 'resources', 'base', 'media', 'app_icon.png');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: ResourcesFileTest_002
     * @tc.name: AppScope模块，.json5文件未使用到的图片资源
     * @tc.desc: AppScope模块，.json5文件未使用到的图片资源
     */
    test('ResourcesFileTest_002', () => {
        const detectFile: string = path.join(realPath, 'AppScope', 'resources', 'base', 'media', 'report1.png');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: ResourcesFileTest_003
     * @tc.name: AppScope模块，ets文件未使用到的图片资源
     * @tc.desc: AppScope模块，ets文件未使用到的图片资源
     */
    test('ResourcesFileTest_003', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'resources', 'base', 'media', 'report2.png');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(1);
    });
})