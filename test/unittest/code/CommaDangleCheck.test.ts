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
import { CommaDangleCheck } from '../../../src/checker/ArkTS-eslint/CommaDangleCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/comma-dangle-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/CommaDangle', rule, CHECK_MODE.FILE2CHECK, CommaDangleCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('CommaDangleTest', () => {
    /**
     * @tc.number: CommaDangleTest_001
     * @tc.name: 使用默认配置，上报
     * @tc.desc: 使用默认配置，上报
     */
    test('CommaDangleTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CommaDangleReport.ets');
        const expectReportList = ['18%14', '21%15', '25%14', '27%1', '28%1', '30%13', '31%13', '33%12', '34%12'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: CommaDangleTest_002
     * @tc.name: 使用默认配置，不上报
     * @tc.desc: 使用默认配置，不上报
     */
    test('CommaDangleTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CommaDangleNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: CommaDangleTest_003
     * @tc.name: ["error", "always"]，上报
     * @tc.desc: ["error", "always"]，上报
     */
    test('CommaDangleTest_003', async () => {
        rule.option = ["always"]
        checkEntry = await testCaseCheck('./test/unittest/sample/CommaDangle', rule, CHECK_MODE.FILE2CHECK, CommaDangleCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'CommaDangleReport1.ets');
        const expectReportList = ['18%13%14%', '21%15%16%', '25%13%14%', '27%1%2%', '28%1%2%', '31%13%14%', '32%13%14%', '34%12%13%', '35%12%13%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: CommaDangleTest_004
     * @tc.name: ["error", "always"]，不上报
     * @tc.desc: ["error", "always"]，不上报
     */
    test('CommaDangleTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CommaDangleNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})