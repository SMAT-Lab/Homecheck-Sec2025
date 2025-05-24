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
import { NoHighLoadedFrameRateRangeCheck } from '../../../src/checker/performance/NoHighLoadedFrameRateRangeCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoHighLoadedFrameRateRange', rule, CHECK_MODE.FILE2CHECK, NoHighLoadedFrameRateRangeCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoHighLoadedFrameRateRangeTest', () => {
    test('NoHighLoadedFrameRateRangeTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoHighLoadedFrameRateRangeReport1.ets');
        const expectReportList = ['26%30%55%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoHighLoadedFrameRateRangeTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoHighLoadedFrameRateRangeReport2.ets');
        const expectReportList = ['31%30%55%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoHighLoadedFrameRateRangeTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoHighLoadedFrameRateRangeReport3.ets');
        const expectReportList = ['30%30%55%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoHighLoadedFrameRateRangeTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoHighLoadedFrameRateRangeReport4.ets');
        const expectReportList = ['13%13%22%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoHighLoadedFrameRateRangeTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoHighLoadedFrameRateRangeNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('NoHighLoadedFrameRateRangeTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoHighLoadedFrameRateRangeNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('NoHighLoadedFrameRateRangeTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoHighLoadedFrameRateRangeNoReport3.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('NoHighLoadedFrameRateRangeTest_008', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoHighLoadedFrameRateRangeNoReport4.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})