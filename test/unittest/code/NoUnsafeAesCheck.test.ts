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
import { NoUnsafeAesCheck } from '../../../src/checker/security/NoUnsafeAesCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoUnsafeAes', rule, CHECK_MODE.FILE2CHECK, NoUnsafeAesCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoUnsafeAesTest', () => {
    test('NoUnsafeAesTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUnsafeAesReport1.ets');
        const expectReportList = ['6%19%31%', '7%19%31%', '8%33%45%', '9%33%45%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoUnsafeAesTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUnsafeAesReport2.ets');
        const expectReportList = ['11%23%35%', '12%23%35%', '13%37%49%', '14%37%49%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoUnsafeAesTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUnsafeAesNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('NoUnsafeAesTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUnsafeAesNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})