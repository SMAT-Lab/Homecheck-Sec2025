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
import { NoStateVarAccessInLoopCheck } from '../../../src/checker/performance/NoStateVarAccessInLoopCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoStateVarAccessInLoop', rule, CHECK_MODE.FILE2CHECK, NoStateVarAccessInLoopCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoStateVarAccessInLoopTest', () => {

    test('NoStateVarAccessInLoopTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoStateVarAccessInLoopReport1.ets');
        const expectReportList = ['36%13%24', '37%53%64', '38%53%62', '39%13%22', '40%24%33', '43%55%62', '44%15%22', '47%57%64', '48%17%24'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoStateVarAccessInLoopTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoStateVarAccessInLoopReport2.ets');
        const expectReportList = ['55%47%54'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoStateVarAccessInLoopTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoStateVarAccessInLoopReport3.ets');
        const expectReportList = ['24%45%56', '25%45%54'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoStateVarAccessInLoopTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoStateVarAccessInLoopReport4.ets');
        const expectReportList = ['25%45%56', '26%45%54'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoStateVarAccessInLoopTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoStateVarAccessInLoopReport5.ets');
        const expectReportList = ['25%45%56', '26%45%54'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoStateVarAccessInLoopTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoStateVarAccessInLoopReport6.ets');
        const expectReportList = ['19%47%58', '49%45%56', '20%47%56', '50%45%54'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('NoStateVarAccessInLoopTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoStateVarAccessInLoopNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

})