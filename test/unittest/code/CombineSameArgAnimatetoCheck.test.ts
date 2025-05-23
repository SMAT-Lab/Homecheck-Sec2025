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
import { CombineSameArgAnimatetoCheck } from '../../../src/checker/performance/CombineSameArgAnimatetoCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/CombineSameArgAnimateto', rule, CHECK_MODE.PROJECT2CHECK, CombineSameArgAnimatetoCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('CombineSameArgAnimatetoTest', () => {
    
    test('CombineSameArgAnimatetoTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CombineSameArgAnimatetoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('10%5%13') || issue.defect.fixKey.includes('16%5%13') ||
                issue.defect.fixKey.includes('22%5%13') || issue.defect.fixKey.includes('28%5%13')));
        expect(detectFileReports.length).toBe(4);
    });

    test('CombineSameArgAnimatetoTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CombineSameArgAnimatetoNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})