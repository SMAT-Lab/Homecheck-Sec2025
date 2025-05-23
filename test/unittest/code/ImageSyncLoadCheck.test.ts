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
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { ImageSyncLoadCheck } from '../../../src/checker/performance/ImageSyncLoadCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/ImageSyncLoad', rule, CHECK_MODE.PROJECT2CHECK, ImageSyncLoadCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ImageSyncLoadTest', () => {
    /**
     * @tc.number: ImageSyncLoadTest_001
     * @tc.name: Image组件设置了.syncLoad(true)，上报
     * @tc.desc: Image组件设置了.syncLoad(true)，上报
     */
    test('ImageSyncLoadTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ImageSyncLoadReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('28%9%23') || issue.defect.fixKey.includes('44%7%21') ||
                issue.defect.fixKey.includes('59%9%23')));
        expect(detectFileReports.length).toBe(3);
    });

    /**
     * @tc.number: ImageSyncLoadTest_002
     * @tc.name: Image组件未设置.syncLoad(true)，不上报
     * @tc.desc: Image组件未设置.syncLoad(true)，不上报
     */
    test('ImageSyncLoadTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ImageSyncLoadNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})