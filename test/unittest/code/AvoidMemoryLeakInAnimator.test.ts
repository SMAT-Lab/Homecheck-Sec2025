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

import { assert, beforeAll, describe, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { AvoidMemoryLeakInAnimator } from '../../../src/checker/performance/AvoidMemoryLeakInAnimator';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/AvoidMemoryLeakInAnimator', rule, CHECK_MODE.FILE2CHECK, AvoidMemoryLeakInAnimator);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('AvoidMemoryLeakInAnimatorTest', () => {

    /**
     * @tc.number: AvoidMemoryLeakInAnimatorTest_001
     * @tc.name: 有finish/cancel,但未置空，需要上报
     * @tc.desc: 有finish/cancel,但未置空，需要上报
     */
    test('AvoidMemoryLeakInAnimatorTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvoidMemoryLeakInAnimatorReport.ets');
        const expectReportList = ['28%10%21%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: AvoidMemoryLeakInAnimatorTest_002
     * @tc.name: 先finish/cancel，再置空，不需要上报
     * @tc.desc: 先finish/cancel，再置空，不需要上报
     */
    test('AvoidMemoryLeakInAnimatorTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvoidMemoryLeakInAnimatorNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})