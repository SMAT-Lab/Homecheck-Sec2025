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
import { SetCachedCountForLazyforeachCheck } from '../../../src/checker/performance/SetCachedCountForLazyforeachCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/SetCachedCountForLazyforeach', rule, CHECK_MODE.PROJECT2CHECK, SetCachedCountForLazyforeachCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('SetCachedCountForLazyforeachTest', () => {

    test('SetCachedCountForLazyforeachTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CachedCountReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('33%7%10') || issue.defect.fixKey.includes('96%7%15') ||
                issue.defect.fixKey.includes('42%15%18')));
        expect(detectFileReports.length).toBe(3);
    });

    test('SetCachedCountForLazyforeachTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CachedCountItem.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('16%7%12')));
        expect(detectFileReports.length).toBe(1);
    });

    test('SetCachedCountForLazyforeachTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CachedCountNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})