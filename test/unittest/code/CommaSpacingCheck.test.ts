/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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
import { CommaSpacingCheck } from '../../../src/checker/ArkTS-eslint/CommaSpacingCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/comma-spacing-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/CommaSpacing', rule, CHECK_MODE.FILE2CHECK, CommaSpacingCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('CommaSpacingTest', () => {
    /**
     * @tc.number: CommaSpacingTest_001
     * @tc.name: 使用默认配置，上报
     * @tc.desc: 使用默认配置，上报
     */
    test('CommaSpacingTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CommaSpacingReport.ets');
        const expectReportList = ['16%13', '16%13', '17%14', '18%25', '18%25', '19%7', '19%7', '20%11', '20%11', '21%16', '21%16', '22%3', '22%3'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: CommaSpacingTest_002
     * @tc.name: 使用默认配置，不上报
     * @tc.desc: 使用默认配置，不上报
     */
    test('CommaSpacingTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CommaSpacingNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: CommaSpacingTest_003
     * @tc.name: { "before": true, "after": false }，上报
     * @tc.desc: { "before": true, "after": false }，上报
     */
    test('CommaSpacingTest_003', async () => {
        rule.option = [{ "before": true, "after": false }]
        checkEntry = await testCaseCheck('./test/unittest/sample/CommaSpacing', rule, CHECK_MODE.FILE2CHECK, CommaSpacingCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'CommaSpacingReport1.ets');
        const expectReportList = ['16%12', '16%12', '17%14', '18%24', '18%24', '19%10', '20%15', '21%2', '21%2'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: CommaSpacingTest_004
     * @tc.name: { "before": true, "after": false }，不上报
     * @tc.desc: { "before": true, "after": false }，不上报
     */
    test('CommaSpacingTest_004', async () => {
        rule.option = [{ "before": true, "after": false }]
        checkEntry = await testCaseCheck('./test/unittest/sample/CommaSpacing', rule, CHECK_MODE.FILE2CHECK, CommaSpacingCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'CommaSpacingNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})