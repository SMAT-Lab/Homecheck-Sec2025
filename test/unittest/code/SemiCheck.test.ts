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
import { SemiCheck } from '../../../src/checker/ArkTS-eslint/SemiCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/semi-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/Semi', rule, CHECK_MODE.FILE2CHECK, SemiCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('SemiTest', () => {
    /**
     * @tc.number: SemiTest_001
     * @tc.name: 使用默认配置，上报
     * @tc.desc: 使用默认配置，上报
     */
    test('SemiTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'SemiReport.ets');
        const expectReportList = ['16%20', '20%2', '23%10'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: SemiTest_002
     * @tc.name: 使用默认配置，不上报
     * @tc.desc: 使用默认配置，不上报
     */
    test('SemiTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'SemiNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: SemiTest_003
     * @tc.name: never，上报
     * @tc.desc: never，上报
     */
    test('SemiTest_003', async () => {
        rule.option = ["never"]
        checkEntry = await testCaseCheck('./test/unittest/sample/Semi', rule, CHECK_MODE.FILE2CHECK, SemiCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'SemiReport1.ets');
        const expectReportList = ['16%20', '20%2', '23%10'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: SemiTest_004
     * @tc.name: never，不上报
     * @tc.desc: never，不上报
     */
    test('SemiTest_004', async () => {
        rule.option = ["never"]
        checkEntry = await testCaseCheck('./test/unittest/sample/Semi', rule, CHECK_MODE.FILE2CHECK, SemiCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'SemiNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})